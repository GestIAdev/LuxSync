/**
 * 🎬 WAVE 4860 — THETA WORKER (Web Worker, renderer-side)
 *
 * Esqueleto del worker de vídeo. Phase 1: cero decodificación, solo:
 *  - Recibe el SharedArrayBuffer del FrameContext en INIT.
 *  - Lee el tickId maestro vía Atomics @ 44Hz (sin IPC en hot-path).
 *  - Responde a heartbeat con latency.
 *  - Acepta (y guarda referencia a) un OffscreenCanvas para Phase 2.
 *  - Reporta drift / ticks observados a su orquestador.
 *
 * NOTA — entorno: este archivo se carga vía
 *   `new Worker(new URL('./theta.worker.ts', import.meta.url), { type: 'module' })`
 * desde el bundle del renderer (Vite lo trata como Web Worker module).
 */

import { FrameContextReader, type FrameContextSnapshot } from './FrameContextRing'
import {
  makeThetaMessage,
  type ThetaErrorPayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaInitPayload,
  type ThetaMessage,
  type ThetaStateReportPayload,
} from './protocol'

// ─────────────────────────────────────────────────────────────────────────
// Worker-local state
// ─────────────────────────────────────────────────────────────────────────

interface WorkerState {
  isRunning: boolean
  startTime: number
  reader: FrameContextReader | null
  pollHandle: number | null
  pollIntervalMs: number
  offscreenCanvas: OffscreenCanvas | null
  lastTickId: number
  lastGeneration: number
  ticksObserved: number
  errors: number
  reportHandle: number | null
}

const state: WorkerState = {
  isRunning: false,
  startTime: 0,
  reader: null,
  pollHandle: null,
  pollIntervalMs: 22,
  offscreenCanvas: null,
  lastTickId: -1,
  lastGeneration: 0,
  ticksObserved: 0,
  errors: 0,
  reportHandle: null,
}

// ─────────────────────────────────────────────────────────────────────────
// Outbound helper
// ─────────────────────────────────────────────────────────────────────────

function send<T>(type: Parameters<typeof makeThetaMessage>[0], payload: T): void {
  ;(self as unknown as Worker).postMessage(makeThetaMessage(type, payload))
}

function sendError(message: string, fatal: boolean, stack?: string): void {
  state.errors++
  const payload: ThetaErrorPayload = { message, fatal, stack }
  send('theia:error', payload)
}

// ─────────────────────────────────────────────────────────────────────────
// Frame context poll loop — 44Hz lock-free read of the master tickId
// ─────────────────────────────────────────────────────────────────────────

function pollFrameContext(): void {
  const reader = state.reader
  if (!reader) return
  const snap = reader.readIfChanged()
  if (snap === null) return // nothing new this tick
  onFrameContextTick(snap)
}

function onFrameContextTick(snap: FrameContextSnapshot): void {
  // Drift detection: tickId should advance by 1 per generation under healthy
  // conditions. Larger gaps mean main-thread stalled or worker poll lagged.
  if (state.lastTickId >= 0) {
    const gap = snap.tickId - state.lastTickId
    if (gap > 2) {
      // Soft warning — still keep going. Phase 2 may upgrade this to a
      // resync or a Phoenix request.
      // eslint-disable-next-line no-console
      console.warn(`[THETA ⚠️] tick gap=${gap} (lastTickId=${state.lastTickId} → ${snap.tickId})`)
    }
  }
  state.lastTickId = snap.tickId
  state.lastGeneration = snap.generation
  state.ticksObserved++

  // Phase 1: no rendering, no decoding. The tick is acknowledged silently.
  // Phase 2 (F3) will push the tick into the AssetStateMachine here.
}

function startPollLoop(): void {
  if (state.pollHandle !== null) return
  state.pollHandle = (self as unknown as Window).setInterval(
    pollFrameContext,
    state.pollIntervalMs,
  ) as unknown as number
}

function stopPollLoop(): void {
  if (state.pollHandle !== null) {
    ;(self as unknown as Window).clearInterval(state.pollHandle as unknown as number)
    state.pollHandle = null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// State reporting loop — orchestrator-facing telemetry
// ─────────────────────────────────────────────────────────────────────────

const STATE_REPORT_INTERVAL_MS = 1000

function startStateReports(): void {
  if (state.reportHandle !== null) return
  state.reportHandle = (self as unknown as Window).setInterval(() => {
    const payload: ThetaStateReportPayload = {
      lastTickId: state.lastTickId,
      lastGeneration: state.lastGeneration,
      ticksObserved: state.ticksObserved,
      errors: state.errors,
      uptimeMs: Date.now() - state.startTime,
    }
    send('theia:state-report', payload)
    // Reset ticksObserved so each report is per-window.
    state.ticksObserved = 0
  }, STATE_REPORT_INTERVAL_MS) as unknown as number
}

function stopStateReports(): void {
  if (state.reportHandle !== null) {
    ;(self as unknown as Window).clearInterval(state.reportHandle as unknown as number)
    state.reportHandle = null
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────────────────────────────────

function handleInit(payload: ThetaInitPayload): void {
  if (state.isRunning) {
    sendError('INIT received while already running — ignoring duplicate init', false)
    return
  }
  if (!(payload.frameContextSAB instanceof SharedArrayBuffer)) {
    sendError('INIT payload missing valid SharedArrayBuffer (frameContextSAB)', true)
    return
  }
  state.reader = new FrameContextReader(payload.frameContextSAB)
  state.reader.resync() // discard whatever tick was published before we attached
  state.pollIntervalMs = payload.pollIntervalMs > 0 ? payload.pollIntervalMs : 22
  state.offscreenCanvas = payload.offscreenCanvas ?? null
  state.startTime = Date.now()
  state.isRunning = true

  startPollLoop()
  startStateReports()

  send('theia:ready', { nodeId: 'theta' })
}

function handleShutdown(): void {
  state.isRunning = false
  stopPollLoop()
  stopStateReports()
  state.reader = null
  state.offscreenCanvas = null
  // No process.exit() — Web Workers are torn down by `worker.terminate()` on
  // the orchestrator side. We just stop work and let GC run.
}

function handleHeartbeat(payload: ThetaHeartbeatPayload): void {
  const now = Date.now()
  const ack: ThetaHeartbeatAckPayload = {
    originalTimestamp: payload.timestamp,
    ackTimestamp: now,
    sequence: payload.sequence,
    latencyMs: now - payload.timestamp,
  }
  send('theia:heartbeat-ack', ack)
}

self.addEventListener('message', (ev: MessageEvent<ThetaMessage>) => {
  const msg = ev.data
  if (!msg || typeof msg.type !== 'string') return
  try {
    switch (msg.type) {
      case 'theia:init':
        handleInit(msg.payload as ThetaInitPayload)
        break
      case 'theia:shutdown':
        handleShutdown()
        break
      case 'theia:heartbeat':
        handleHeartbeat(msg.payload as ThetaHeartbeatPayload)
        break
      default:
        sendError(`Unknown message type: ${msg.type}`, false)
    }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    sendError(e.message, true, e.stack)
  }
})

// Surface uncaught errors back to the orchestrator so the circuit breaker
// can react. Web Workers do not have `process.on('uncaughtException')`.
self.addEventListener('error', (ev: ErrorEvent) => {
  sendError(ev.message ?? 'unknown worker error', true, ev.error?.stack)
})
self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  const reason = ev.reason
  const msg = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  sendError(msg, false, stack)
})
