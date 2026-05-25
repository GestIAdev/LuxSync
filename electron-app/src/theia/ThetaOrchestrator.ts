/**
 * 🎬 WAVE 4860 — THETA ORCHESTRATOR (renderer-side)
 *
 * Espejo del patrón de TrinityOrchestrator pero corre en el RENDERER y
 * gestiona un único Web Worker (theta.worker.ts). Se mantiene deliberadamente
 * separado de TrinityOrchestrator porque éste vive en main y opera con
 * `worker_threads` (incompatible con `OffscreenCanvas` y `WebCodecs`).
 *
 * Responsabilidades Phase 1:
 *  - Spawn del Web Worker.
 *  - Negociar el SharedArrayBuffer del FrameContext con el main process
 *    (one-shot vía IPC `theia:get-frame-context`).
 *  - Transferir el SAB y un OffscreenCanvas al worker en el INIT.
 *  - Heartbeat + circuit breaker + Phoenix (resurrection) idénticos en
 *    contrato al patrón de Trinity, adaptados a APIs de Web Worker.
 *
 * NO renderiza vídeo. NO decodifica. Eso llega en Phase 2/F3.
 */

import {
  makeThetaMessage,
  type ThetaErrorPayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaMessage,
  type ThetaStateReportPayload,
} from './protocol'

// ─────────────────────────────────────────────────────────────────────────
// Circuit breaker (paridad con TrinityOrchestrator)
// ─────────────────────────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface CircuitBreaker {
  state: CircuitState
  failures: number
  lastFailure: number
  successesInHalfOpen: number
}

const CIRCUIT_THRESHOLD = 3
const CIRCUIT_TIMEOUT = 5000
const CIRCUIT_HALF_OPEN_SUCCESS = 2

// ─────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────

export interface ThetaOrchestratorConfig {
  /** ms entre heartbeats (default 1000). */
  heartbeatInterval: number
  /** ms sin ACK antes de marcar fallo (default 3000). */
  heartbeatTimeout: number
  /** Máximo de resurrecciones antes de rendirse (default 5). */
  maxResurrections: number
  /** ms de espera entre la muerte y el respawn (default 500). */
  resurrectionDelay: number
  /** Periodo de poll del SAB dentro del worker (default 22ms ≈ 44Hz). */
  workerPollIntervalMs: number
}

const DEFAULT_CONFIG: ThetaOrchestratorConfig = {
  heartbeatInterval: 1000,
  heartbeatTimeout: 3000,
  maxResurrections: 5,
  resurrectionDelay: 500,
  workerPollIntervalMs: 22,
}

// ─────────────────────────────────────────────────────────────────────────
// IPC bridge — el preload expone window.lux.theia.getFrameContextSAB()
// ─────────────────────────────────────────────────────────────────────────

interface TheiaIPCBridge {
  getFrameContextSAB: () => Promise<SharedArrayBuffer | null>
}

function getBridge(): TheiaIPCBridge | null {
  // Acceso defensivo — el preload puede no haber expuesto el namespace en
  // configuraciones legacy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lux = (globalThis as any).lux ?? (globalThis as any).window?.lux
  if (!lux || !lux.theia || typeof lux.theia.getFrameContextSAB !== 'function') {
    return null
  }
  return lux.theia as TheiaIPCBridge
}

// ─────────────────────────────────────────────────────────────────────────
// ThetaOrchestrator
// ─────────────────────────────────────────────────────────────────────────

export class ThetaOrchestrator {
  private config: ThetaOrchestratorConfig
  private worker: Worker | null = null
  private isRunning = false
  private isReady = false
  private resurrections = 0

  private circuit: CircuitBreaker = {
    state: CircuitState.CLOSED,
    failures: 0,
    lastFailure: 0,
    successesInHalfOpen: 0,
  }

  private frameContextSAB: SharedArrayBuffer | null = null
  private offscreenCanvas: OffscreenCanvas | null = null

  private heartbeatHandle: number | null = null
  private heartbeatSequence = 0
  private lastHeartbeatAt = 0
  private lastHeartbeatLatencyMs = 0

  private lastStateReport: ThetaStateReportPayload | null = null

  constructor(config: Partial<ThetaOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Adopta un OffscreenCanvas que será transferido al worker en el INIT.
   * Debe llamarse ANTES de `start()`. El canvas pasa a propiedad del worker
   * (estructura nativa de transferControlToOffscreen → postMessage).
   */
  attachOffscreenCanvas(canvas: OffscreenCanvas): void {
    if (this.isRunning) {
      // eslint-disable-next-line no-console
      console.warn('[THETA] attachOffscreenCanvas() called after start — canvas ignored')
      return
    }
    this.offscreenCanvas = canvas
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    // 1) Pedir el SAB al main process — UNA SOLA VEZ.
    const bridge = getBridge()
    if (!bridge) {
      throw new Error(
        '[THETA] preload bridge not found (window.lux.theia.getFrameContextSAB missing)',
      )
    }
    const sab = await bridge.getFrameContextSAB()
    if (!sab || !(sab instanceof SharedArrayBuffer)) {
      throw new Error('[THETA] main process did not return a SharedArrayBuffer for FrameContext')
    }
    this.frameContextSAB = sab

    this.isRunning = true
    this.resurrections = 0
    await this.spawnWorker()
    this.startHeartbeat()
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.stopHeartbeat()
    if (this.worker) {
      try {
        this.worker.postMessage(makeThetaMessage('theia:shutdown', {}))
      } catch {
        /* worker may already be dead */
      }
      try {
        this.worker.terminate()
      } catch {
        /* noop */
      }
      this.worker = null
    }
    this.isReady = false
  }

  getStatus(): {
    isRunning: boolean
    isReady: boolean
    resurrections: number
    circuitState: CircuitState
    lastHeartbeatLatencyMs: number
    lastStateReport: ThetaStateReportPayload | null
  } {
    return {
      isRunning: this.isRunning,
      isReady: this.isReady,
      resurrections: this.resurrections,
      circuitState: this.circuit.state,
      lastHeartbeatLatencyMs: this.lastHeartbeatLatencyMs,
      lastStateReport: this.lastStateReport,
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Spawn / lifecycle
  // ───────────────────────────────────────────────────────────────────────

  private async spawnWorker(): Promise<void> {
    if (this.circuit.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.circuit.lastFailure
      if (elapsed < CIRCUIT_TIMEOUT) {
        // eslint-disable-next-line no-console
        console.log('[THETA] Circuit OPEN — waiting before respawn')
        return
      }
      this.circuit.state = CircuitState.HALF_OPEN
      // eslint-disable-next-line no-console
      console.log('[THETA] Circuit HALF-OPEN — testing respawn')
    }

    if (!this.frameContextSAB) {
      throw new Error('[THETA] cannot spawn worker — frameContextSAB is null')
    }

    // Vite resolves this URL at build time and emits a separate worker chunk.
    const worker = new Worker(new URL('./theta.worker.ts', import.meta.url), {
      type: 'module',
      name: 'theta',
    })

    worker.addEventListener('message', (ev: MessageEvent<ThetaMessage>) => {
      this.handleWorkerMessage(ev.data)
    })
    worker.addEventListener('error', (ev: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error('[THETA] worker error:', ev.message)
      this.handleWorkerFailure(ev.message ?? 'worker error')
    })
    // Web Workers do not emit 'exit' like Node workers, but message channel
    // closure surfaces as `messageerror` on transferred-object failures.
    worker.addEventListener('messageerror', (ev: MessageEvent) => {
      // eslint-disable-next-line no-console
      console.error('[THETA] worker messageerror:', ev)
      this.handleWorkerFailure('messageerror — transferable failed')
    })

    this.worker = worker

    // INIT: transferimos el OffscreenCanvas (si lo hay). El SAB NO se
    // transfiere — se comparte por referencia (estructura clone-by-share).
    const transfer: Transferable[] = []
    const canvas = this.offscreenCanvas
    if (canvas) {
      transfer.push(canvas)
    }
    worker.postMessage(
      makeThetaMessage('theia:init', {
        frameContextSAB: this.frameContextSAB,
        pollIntervalMs: this.config.workerPollIntervalMs,
        offscreenCanvas: canvas ?? undefined,
      }),
      transfer,
    )
    // Tras transferir el canvas perdemos su control en este lado.
    if (canvas) this.offscreenCanvas = null
  }

  private handleWorkerMessage(msg: ThetaMessage | undefined): void {
    if (!msg || typeof msg.type !== 'string') return
    switch (msg.type) {
      case 'theia:ready':
        this.isReady = true
        this.circuit.state = CircuitState.CLOSED
        this.circuit.failures = 0
        // eslint-disable-next-line no-console
        console.log('[THETA] worker READY')
        break

      case 'theia:heartbeat-ack': {
        const ack = msg.payload as ThetaHeartbeatAckPayload
        this.lastHeartbeatAt = Date.now()
        this.lastHeartbeatLatencyMs = ack.latencyMs
        if (this.circuit.state === CircuitState.HALF_OPEN) {
          this.circuit.successesInHalfOpen++
          if (this.circuit.successesInHalfOpen >= CIRCUIT_HALF_OPEN_SUCCESS) {
            this.circuit.state = CircuitState.CLOSED
            this.circuit.failures = 0
            // eslint-disable-next-line no-console
            console.log('[THETA] Circuit CLOSED')
          }
        }
        break
      }

      case 'theia:state-report':
        this.lastStateReport = msg.payload as ThetaStateReportPayload
        break

      case 'theia:error': {
        const err = msg.payload as ThetaErrorPayload
        // eslint-disable-next-line no-console
        console.error(`[THETA] worker error: ${err.message}`, err.stack)
        if (err.fatal) this.handleWorkerFailure(err.message)
        break
      }

      default:
        // eslint-disable-next-line no-console
        console.warn('[THETA] unknown message:', msg.type)
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Heartbeat
  // ───────────────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatHandle = (globalThis as unknown as Window).setInterval(() => {
      if (!this.worker || !this.isReady) return
      this.heartbeatSequence++
      const payload: ThetaHeartbeatPayload = {
        timestamp: Date.now(),
        sequence: this.heartbeatSequence,
      }
      try {
        this.worker.postMessage(makeThetaMessage('theia:heartbeat', payload))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[THETA] heartbeat send failed:', err)
        this.handleWorkerFailure('heartbeat send failed')
        return
      }
      const elapsed = Date.now() - this.lastHeartbeatAt
      if (this.lastHeartbeatAt > 0 && elapsed > this.config.heartbeatTimeout) {
        // eslint-disable-next-line no-console
        console.warn(`[THETA] missed heartbeat (${elapsed}ms)`)
        this.handleWorkerFailure('heartbeat timeout')
      }
    }, this.config.heartbeatInterval) as unknown as number
  }

  private stopHeartbeat(): void {
    if (this.heartbeatHandle !== null) {
      ;(globalThis as unknown as Window).clearInterval(this.heartbeatHandle as unknown as number)
      this.heartbeatHandle = null
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Phoenix
  // ───────────────────────────────────────────────────────────────────────

  private handleWorkerFailure(_reason: string): void {
    this.circuit.failures++
    this.circuit.lastFailure = Date.now()
    if (this.circuit.failures >= CIRCUIT_THRESHOLD) {
      this.circuit.state = CircuitState.OPEN
      // eslint-disable-next-line no-console
      console.log(
        `[THETA] Circuit OPEN after ${this.circuit.failures} failures — backoff ${CIRCUIT_TIMEOUT}ms`,
      )
    }
    if (this.resurrections < this.config.maxResurrections) {
      void this.resurrectWorker()
    } else {
      // eslint-disable-next-line no-console
      console.error(`[THETA] exceeded max resurrections (${this.config.maxResurrections})`)
      this.isReady = false
    }
  }

  private async resurrectWorker(): Promise<void> {
    if (this.worker) {
      try {
        this.worker.terminate()
      } catch {
        /* noop */
      }
      this.worker = null
    }
    this.isReady = false
    this.resurrections++
    // eslint-disable-next-line no-console
    console.log(`[THETA] 🔥 PHOENIX: resurrecting worker (attempt ${this.resurrections})`)
    await new Promise((r) => setTimeout(r, this.config.resurrectionDelay))
    if (!this.isRunning) return
    try {
      await this.spawnWorker()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[THETA] resurrect failed:', err)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Singleton helper
// ─────────────────────────────────────────────────────────────────────────

let _instance: ThetaOrchestrator | null = null

export function getThetaOrchestrator(): ThetaOrchestrator {
  if (!_instance) _instance = new ThetaOrchestrator()
  return _instance
}
