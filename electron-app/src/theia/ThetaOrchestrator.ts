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
 *  - 🌊 WAVE 8215 — GLASS BRIDGE: hacer pull de los MessagePorts al preload
 *    (`requestTheiaPort`) y consumir la telemetría por ping-pong: cada
 *    buffer 256B (clone main→renderer — WAVE 8216) se espeja al ring LOCAL
 *    (SharedArrayBuffer renderer-side — intra-proceso, legal bajo el veto)
 *    y su copia se devuelve al pump por `ack` con transfer. El reloj
 *    maestro ya NO cruza la frontera como SAB.
 *  - Entregar el `video-port` (role producer) al worker por transferencia.
 *  - Transferir el ring SAB y un OffscreenCanvas al worker en el INIT.
 *  - Heartbeat + circuit breaker + Phoenix (resurrection) idénticos en
 *    contrato al patrón de Trinity, adaptados a APIs de Web Worker.
 *
 * NO renderiza vídeo. NO decodifica. Eso llega en Phase 2/F3.
 */

import {
  makeThetaMessage,
  type TheiaAssetStateId,
  type ThetaAssetStatePayload,
  type ThetaErrorPayload,
  type ThetaForceStatePayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaLoadStreamPayload,
  type ThetaMessage,
  type ThetaSeekAckPayload,
  type ThetaSeekPayload,
  type ThetaStateReportPayload,
  type ThetaVideoPortPayload,
  type ThetaVideoStatusPayload,
} from './protocol'
// 🌊 WAVE 8215 — Glass Bridge page-world side + telemetry ring mirror
import {
  onTheiaGlassMessage,
  requestTheiaPort,
  type TheiaGlassMessage,
} from './glassBridge'
import {
  ackTelemetryFrame,
  createTelemetryRing,
  isTelemetryMessage,
  mirrorTelemetryIntoRing,
} from './TheiaTelemetryRing'
// 🎬 WAVE 4867 — Phase 6: thumb buffer SAB
import { createThumbSAB } from './TheiaThumbBuffer'

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

// WAVE 4933.1 - THETA KILLSWITCH
// Emergency global shutdown: disables worker spawn, heartbeat, and phoenix loop.
// 🌊 WAVE 8207 — QUARANTINE LIFTED: re-enabled. The pipeline is now WebGL-based
// (gl.readPixels → SAB zero-copy), which removes the getImageData OOM path that
// motivated the original killswitch. Keep this flag as the emergency brake.
export const ENABLE_THETA_ORCHESTRATOR = true

// ─────────────────────────────────────────────────────────────────────────
// IPC bridge — el preload expone window.lux.theia (control de ventana).
// 🌊 WAVE 8215: los canales de datos ya NO van por window.lux — son
// MessagePorts entregados por el Glass Relay del preload (ver glassBridge.ts).
// ─────────────────────────────────────────────────────────────────────────

interface TheiaIPCBridge {
  openOutput?: () => Promise<{ ok: boolean; error?: string }>
  closeOutput?: () => Promise<{ ok: boolean }>
  isOutputOpen?: () => Promise<boolean>
}

function getBridge(): TheiaIPCBridge | null {
  // Acceso defensivo — el preload puede no haber expuesto el namespace en
  // configuraciones legacy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lux = (globalThis as any).lux ?? (globalThis as any).window?.lux
  if (!lux || !lux.theia || typeof lux.theia !== 'object') {
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

  /**
   * 🌊 WAVE 8215 — Telemetry ring LOCAL (256B, SharedArrayBuffer
   * renderer-side). Lo alimenta el `telemetry-port` del Glass Bridge por
   * ping-pong — ya NO se pide un SAB al main process (vetado). Sus primeros
   * 16B replican el layout FrameContextRing (tickId/ts/gen), que es lo que
   * lee el worker; el resto queda reservado para el Euclid ring (WAVE 8208).
   * Se pasa al worker en INIT como `frameContextSAB` — intra-proceso, legal.
   */
  private readonly telemetryRing: SharedArrayBuffer = createTelemetryRing()
  /** Port del canal de telemetría (main pump ↔ esta página). Vive AQUÍ —
   *  no en el worker — para sobrevivir respawns Phoenix. */
  private telemetryPort: MessagePort | null = null
  /** Port de video buffered si llega antes del spawn del worker. */
  private pendingVideoPort: MessagePort | null = null
  private unsubGlass: (() => void) | null = null
  private offscreenCanvas: OffscreenCanvas | null = null
  // 🎬 WAVE 4867 — Phase 6: thumb SAB (64×64 RGBA8) — allocado aquí y compartido con
  // TitanOrchestrator a través de `getThumbPixelSAB()` para TheiaVideoRenderer.
  private readonly thumbPixelSAB: SharedArrayBuffer = createThumbSAB()
  // 🎬 WAVE 4864 — Phase 4: last asset-state report from worker
  private lastAssetState: ThetaAssetStatePayload | null = null

  // Phase 2: Hidden video pipeline
  private videoElement: HTMLVideoElement | null = null
  private videoStream: MediaStream | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private trackProcessor: any = null
  private lastVideoStatus: ThetaVideoStatusPayload | null = null
  private hasLoggedFirstFrame = false

  // 🎬 WAVE 4922 — cognitive play-atom tracking
  /** ID del átomo (.theia) actualmente cargado en el videoElement. */
  private currentAtomId: string | null = null
  /** Última URL pasada a loadVideo() — usada para evitar re-loads idempotentes. */
  private currentAtomUrl: string | null = null
  /** Último ack de seek recibido del worker (telemetría). */
  private lastSeekAck: ThetaSeekAckPayload | null = null

  private heartbeatHandle: number | null = null
  private heartbeatSequence = 0
  private lastHeartbeatAt = 0
  private lastHeartbeatLatencyMs = 0

  private lastStateReport: ThetaStateReportPayload | null = null

  // 🌊 WAVE 8211 — Master uniforms desired by the UI. Persisted here so a
  // Phoenix respawn replays them on 'theia:ready' (the worker is stateless).
  private desiredUniforms = new Map<string, number>()

  constructor(config: Partial<ThetaOrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Adopta un OffscreenCanvas que será transferido al worker en el INIT.
   * Debe llamarse ANTES de `start()`. El canvas pasa a propiedad del worker
   * (estructura nativa de transferControlToOffscreen → postMessage).
   */
  attachOffscreenCanvas(canvas: OffscreenCanvas): void {
    if (this.isRunning && this.worker) {
      // 🌊 WAVE 8207 — live transfer: the worker mirrors its internal GL
      // framebuffer into any canvas that arrives post-start, so the
      // TheiaEngineView viewport works regardless of attach ordering.
      try {
        this.worker.postMessage(
          makeThetaMessage('theia:attach-canvas', { canvas }),
          [canvas],
        )
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[THETA] attach-canvas transfer failed:', err)
      }
      return
    }
    this.offscreenCanvas = canvas
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    if (!ENABLE_THETA_ORCHESTRATOR) {
      this.isRunning = false
      this.isReady = false
      this.resurrections = 0
      this.stopHeartbeat()
      return
    }

    // 🌊 WAVE 8215 — GLASS BRIDGE: armamos el relay ANTES del spawn para
    // que los ports entregados por el broker se reenvíen al worker apenas
    // éste exista. El pull marca los kinds como "wanted" en el preload:
    // ports buffered → entrega inmediata; si no → main re-brokerea un
    // channel nuevo y auto-entrega al llegar.
    if (!getBridge()) {
      // El namespace window.lux.theia falta (preload roto/legacy): sin él
      // tampoco hay relay Glass ni control de la output window. No es
      // fatal para el worker (arranca con ring local), pero no habrá
      // telemetría ni proyector — avisar y continuar.
      // eslint-disable-next-line no-console
      console.warn('[THETA] window.lux.theia missing — Glass Bridge relay may be unavailable')
    }
    this.armGlassBridge()

    this.isRunning = true
    this.resurrections = 0
    await this.spawnWorker()
    this.startHeartbeat()
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.stopHeartbeat()
    this.teardownVideo()
    // 🌊 WAVE 8215 — cerrar los extremos Glass: el pump (main) retira el
    // link al ver 'close' y el worker libera su link en terminate().
    this.unsubGlass?.()
    this.unsubGlass = null
    try { this.telemetryPort?.close() } catch { /* noop */ }
    this.telemetryPort = null
    try { this.pendingVideoPort?.close() } catch { /* noop */ }
    this.pendingVideoPort = null
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
    videoStatus: ThetaVideoStatusPayload | null
    assetState: ThetaAssetStatePayload | null
  } {
    return {
      isRunning: this.isRunning,
      isReady: this.isReady,
      resurrections: this.resurrections,
      circuitState: this.circuit.state,
      lastHeartbeatLatencyMs: this.lastHeartbeatLatencyMs,
      lastStateReport: this.lastStateReport,
      videoStatus: this.lastVideoStatus,
      assetState: this.lastAssetState,
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // � WAVE 8215 — GLASS BRIDGE (transferable ports + ping-pong)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Suscribe el relay del preload y hace pull de ambos kinds. Idempotente.
   * Los ports que llegan se consumen así:
   *   telemetry-port → esta página (espeja el ring, ack, sobrevive Phoenix)
   *   video-port     → transferido al theta.worker (role 'producer')
   *   video-unlink   → notify al worker (output window murió)
   */
  private armGlassBridge(): void {
    if (!this.unsubGlass) {
      this.unsubGlass = onTheiaGlassMessage((msg) => this.handleGlassMessage(msg))
    }
    requestTheiaPort('telemetry-port')
    requestTheiaPort('video-port')
  }

  private handleGlassMessage(msg: TheiaGlassMessage): void {
    if (msg.kind === 'telemetry-port' && msg.port) {
      this.attachTelemetryPort(msg.port)
      return
    }
    if (msg.kind === 'video-port') {
      if (msg.port && msg.role === 'producer') {
        this.deliverVideoPort(msg.port)
      } else {
        // Defensive: este renderer es siempre el producer; un port sin rol
        // no se usa — cerrarlo evita links huérfanos en el broker.
        try { msg.port?.close() } catch { /* noop */ }
      }
      return
    }
    if (msg.kind === 'video-unlink') {
      try {
        this.worker?.postMessage(makeThetaMessage('theia:video-unlink', {}))
      } catch { /* worker may be dead */ }
    }
  }

  /**
   * Consume el port de telemetría en la PÁGINA (no en el worker): el ring
   * SAB local sobrevive respawns y también lo leen futuros consumers del
   * renderer. Cada buffer de 256B (clone serializado — WAVE 8216: el
   * MessagePortMain del pump no transfiere) se espeja al ring y se devuelve
   * por `ack` CON transfer en el mismo handler — ZERO-ALLOC: aquí jamás se
   * instancia un ArrayBuffer; el ack repone el pool fijo del pump.
   */
  private attachTelemetryPort(port: MessagePort): void {
    try { this.telemetryPort?.close() } catch { /* noop */ }
    this.telemetryPort = port
    port.onmessage = (ev: MessageEvent) => {
      const data = ev.data
      if (!isTelemetryMessage(data)) return
      mirrorTelemetryIntoRing(this.telemetryRing, data.buffer)
      ackTelemetryFrame(port, data)
    }
    port.start()
  }

  /**
   * Entrega el extremo productor del video link al worker por transferencia
   * (`theia:video-port`). Si el worker aún no existe (arranque), queda
   * buffered hasta el spawn — los mensajes a un Worker se encolan antes del
   * handler, pero transferir tras spawn evita ports atrapados en un worker
   * muerto (Phoenix → re-pull → channel nuevo del broker).
   */
  private deliverVideoPort(port: MessagePort): void {
    if (this.worker) {
      try {
        const payload: ThetaVideoPortPayload = { port }
        this.worker.postMessage(makeThetaMessage('theia:video-port', payload), [port])
        return
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[THETA] video-port transfer to worker failed:', err)
      }
    }
    try { this.pendingVideoPort?.close() } catch { /* noop */ }
    this.pendingVideoPort = port
  }

  // ──────────────────────────────────────────────────────────────────
  // �🎬 WAVE 4864 — Phase 4: AssetStateMachine API (force-state)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Solicita una transición de la Asset State Machine en el worker. El worker
   * iniciará un crossfade de 500ms (default) entre el frame anterior y el nuevo.
   *
   * Usado por la UI manual (botones Force Drop / Force Ambient en TheiaEngineView)
   * y, en futuras fases, por el BrainTheiaBridge derivando de MusicalContext.
   */
  forceState(
    state: TheiaAssetStateId,
    opts: {
      curve?: 'linear' | 'easeInOut' | 'cosine'
      totalTicks?: number
      waitAnchor?: boolean
      manual?: boolean
    } = {},
  ): void {
    if (!this.worker || !this.isReady) {
      // eslint-disable-next-line no-console
      console.warn('[THETA] forceState called before worker is ready — ignored')
      return
    }
    const payload: ThetaForceStatePayload = {
      state,
      curve: opts.curve,
      totalTicks: opts.totalTicks,
      waitAnchor: opts.waitAnchor,
      manual: opts.manual ?? true, // UI calls are manual by default
    }
    try {
      this.worker.postMessage(makeThetaMessage('theia:force-state', payload))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[THETA] forceState postMessage failed:', err)
    }
  }

  /** Último reporte de la AssetStateMachine recibido del worker. */
  getAssetState(): ThetaAssetStatePayload | null {
    return this.lastAssetState
  }

  // ──────────────────────────────────────────────────────────────────
  // 🎬 WAVE 4922 — Cognitive Play-Atom (Selene → Theta)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Procesa un `AtomPlayIntent` emitido por `SeleneTheiaAdapter`.
   *
   * Pipeline:
   *   1. Si `atomId === ''` → blackout: detiene reproducción y limpia worker.
   *   2. Si `atomId !== currentAtomId` → resuelve filePath via `TheiaRegistry`
   *      y llama a `loadVideo()` (lazy load del átomo binario).
   *   3. Aplica `videoElement.currentTime = startMs / 1000`.
   *   4. Asegura `play()` (Selene asume reproducción activa post-trigger).
   *   5. PostMessage al worker con `theia:seek` para que prepare el crossfade
   *      visual (snapshot + curva de mezcla).
   *
   * Es idempotente y resiliente: si el worker no está listo, log + return.
   * No lanza excepciones.
   */
  async playAtom(intent: {
    atomId: string
    startMs: number
    crossfadeMs: number
    reason: string
    /** Resolver opcional `atomId → URL`. Si no se provee, se intenta el
     *  resolver interno (TheiaRegistry-aware) registrado vía
     *  `setClipUrlResolver()`. */
    urlResolver?: (atomId: string) => string | null
  }): Promise<void> {
    if (!this.isRunning || !this.worker) {
      // eslint-disable-next-line no-console
      console.warn('[THETA 🎬] playAtom called before start — ignored')
      return
    }

    // ── Caso 1: blackout ─────────────────────────────────────────────────
    if (!intent.atomId) {
      this._emitSeekToWorker({
        atomId: '',
        startMs: 0,
        crossfadeMs: intent.crossfadeMs,
        reason: 'blackout',
      })
      try {
        if (this.videoElement) this.videoElement.pause()
      } catch { /* noop */ }
      return
    }

    // ── Caso 2: cambio de asset → lazy load ──────────────────────────────
    if (intent.atomId !== this.currentAtomId) {
      const resolver = intent.urlResolver ?? this._clipUrlResolver
      const url = resolver ? resolver(intent.atomId) : null
      if (!url) {
        // eslint-disable-next-line no-console
        console.warn(`[THETA 🎬] play-atom '${intent.atomId}' — no URL resolver`)
        return
      }
      try {
        await this.loadVideo(url)
        this.currentAtomId = intent.atomId
        this.currentAtomUrl = url
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[THETA 🎬] play-atom load failed for '${intent.atomId}':`, err)
        return
      }
    }

    // ── Caso 3: SEEK + play ──────────────────────────────────────────────
    if (this.videoElement) {
      try {
        // Math.max porque ms negativos romperían el currentTime; clampear a 0.
        const seconds = Math.max(0, intent.startMs / 1000)
        this.videoElement.currentTime = seconds
        if (this.videoElement.paused) {
          this.videoElement.play().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn('[THETA 🎬] play() after seek failed:', err)
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[THETA 🎬] videoElement.currentTime assignment failed:', err)
      }
    }

    // ── Caso 4: notificar al worker para crossfade visual ────────────────
    this._emitSeekToWorker({
      atomId: intent.atomId,
      startMs: intent.startMs,
      crossfadeMs: intent.crossfadeMs,
      reason: intent.reason,
    })
  }

  /**
   * Registra un resolver `atomId → URL` para que `playAtom` pueda
   * cargar lazily los `.mp4` declarados por los manifests `.theia`.
   *
   * Típicamente la wiring de Selene hace:
   *   `orchestrator.setClipUrlResolver(id => theiaRegistry.getAtom(id)?.filePath ?? null)`
   */
  setClipUrlResolver(resolver: ((atomId: string) => string | null) | null): void {
    this._clipUrlResolver = resolver
  }
  private _clipUrlResolver: ((atomId: string) => string | null) | null = null

  /** Último ack de seek recibido del worker (telemetría). */
  getLastSeekAck(): ThetaSeekAckPayload | null {
    return this.lastSeekAck
  }

  /**
   * WAVE 4910.5 — Expone el videoElement interno para que el renderer pueda
   * consultar `currentTime` y `duration` sin IPC round-trip.
   * Solo válido después de un `loadVideo()` exitoso.
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement
  }

  /** ID del átomo actualmente cargado, o null. */
  getCurrentAtomId(): string | null {
    return this.currentAtomId
  }

  /** @deprecated WAVE 4922 — alias histórico de `getCurrentAtomId`. */
  getCurrentClipId(): string | null {
    return this.currentAtomId
  }

  /**
   * @deprecated WAVE 4922 — alias histórico de `playAtom`.
   */
  handleCueJump(intent: {
    atomId: string
    startMs: number
    crossfadeMs: number
    reason: string
    urlResolver?: (atomId: string) => string | null
  }): Promise<void> {
    return this.playAtom(intent)
  }

  // ── private helper ──
  private _emitSeekToWorker(p: Omit<ThetaSeekPayload, 'emittedAt'>): void {
    if (!this.worker) return
    const payload: ThetaSeekPayload = { ...p, emittedAt: Date.now() }
    try {
      this.worker.postMessage(makeThetaMessage('theia:seek', payload))
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[THETA 🎬] seek postMessage failed:', err)
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 🎬 WAVE 4867 — Phase 6: Thumb SAB accessor para TheiaVideoRenderer
  // ──────────────────────────────────────────────────────────────────

  /**
   * Devuelve el SAB de 64×64 RGBA8 que el worker rellena con el downscale
   * de cada frame. TitanOrchestrator lo usa para construir TheiaVideoRenderer.
   * El SAB vive para toda la vida del orchestrator (inmutable).
   */
  getThumbPixelSAB(): SharedArrayBuffer {
    return this.thumbPixelSAB
  }

  // ──────────────────────────────────────────────────────────────────
  // 🎬 WAVE 4864 — Phase 3: Output Window control (BrowserWindow secundaria)
  // ──────────────────────────────────────────────────────────────────

  /** Abre la ventana secundaria del proyector (frameless, fullscreen). */
  async openOutputWindow(): Promise<{ ok: boolean; error?: string }> {
    const bridge = getBridge()
    if (!bridge || typeof bridge.openOutput !== 'function') {
      return { ok: false, error: 'preload bridge missing openOutput' }
    }
    return bridge.openOutput()
  }

  /** Cierra la ventana del proyector si está abierta. */
  async closeOutputWindow(): Promise<{ ok: boolean }> {
    const bridge = getBridge()
    if (!bridge || typeof bridge.closeOutput !== 'function') return { ok: false }
    return bridge.closeOutput()
  }

  /** Reporta si la ventana del proyector está abierta actualmente. */
  async isOutputWindowOpen(): Promise<boolean> {
    const bridge = getBridge()
    if (!bridge || typeof bridge.isOutputOpen !== 'function') return false
    return bridge.isOutputOpen()
  }

  // ─────────────────────────────────────────────────────────────────────
  // Phase 2: Video playback API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Load a video URL into the hidden player, extract a ReadableStream<VideoFrame>
   * via MediaStreamTrackProcessor, and transfer it to the ThetaWorker.
   * The worker will consume frames and render them to its OffscreenCanvas.
   */
  async loadVideo(url: string): Promise<void> {
    if (!ENABLE_THETA_ORCHESTRATOR) {
      // eslint-disable-next-line no-console
      console.warn('[THETA] loadVideo ignored (Theta disabled by WAVE 4933.1 killswitch)')
      return
    }

    if (!this.isRunning || !this.worker) {
      throw new Error('[THETA] loadVideo called before start() or worker is dead')
    }

    // eslint-disable-next-line no-console
    console.log('[THETA TRACE] 🎬 loadVideo enter:', { url })

    // Tear down any previous video pipeline
    this.teardownVideo()
    this.hasLoggedFirstFrame = false

    // 1) Create a hidden <video> element
    const video = document.createElement('video')
    video.src = url
    video.crossOrigin = 'anonymous'
    video.muted = true // required for autoplay in Chromium
    video.playsInline = true
    video.preload = 'auto'
    video.style.position = 'fixed'
    video.style.top = '-9999px'
    video.style.left = '-9999px'
    video.style.width = '1px'
    video.style.height = '1px'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
    this.videoElement = video

    // 2) Wait for metadata to resolve dimensions
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => resolve(), { once: true })
      video.addEventListener('error', () => reject(new Error(`[THETA] video load error: ${video.error?.message ?? 'unknown'}`)), { once: true })
    })

    // eslint-disable-next-line no-console
    console.log('[THETA TRACE] 🎬 metadata ready:', {
      width: video.videoWidth,
      height: video.videoHeight,
    })

    // 3) Capture the video stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: MediaStream = (video as any).captureStream()
    this.videoStream = stream
    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      throw new Error('[THETA] captureStream() returned no video tracks')
    }

    // 4) MediaStreamTrackProcessor → ReadableStream<VideoFrame>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MediaStreamTrackProcessorCtor = (globalThis as any).MediaStreamTrackProcessor
    if (!MediaStreamTrackProcessorCtor) {
      throw new Error('[THETA] MediaStreamTrackProcessor not available in this browser/Electron version')
    }
    this.trackProcessor = new MediaStreamTrackProcessorCtor({ track: videoTrack })
    const readable: ReadableStream<VideoFrame> = (this.trackProcessor as any).readable

    // 5) Transfer the ReadableStream to the worker
    const payload: ThetaLoadStreamPayload = {
      stream: readable,
      width: video.videoWidth,
      height: video.videoHeight,
    }
    // eslint-disable-next-line no-console
    console.log('[THETA TRACE] 📡 posting theia:load-stream to worker')
    this.worker.postMessage(
      makeThetaMessage('theia:load-stream', payload),
      // Transfer the stream — ownership moves to the worker
      [readable] as unknown as Transferable[],
    )

    // eslint-disable-next-line no-console
    console.log(`[THETA] 🎬 loadVideo: ${video.videoWidth}x${video.videoHeight} — stream transferred to worker`)
  }

  /**
   * Start or resume video playback. The worker will start receiving frames.
   */
  play(): void {
    if (this.videoElement) {
      this.videoElement.play().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[THETA] video.play() failed:', err)
      })
    }
  }

  /**
   * Pause video playback. Frame stream stops flowing.
   */
  pause(): void {
    if (this.videoElement) {
      this.videoElement.pause()
    }
  }

  /**
   * Set playback rate (1.0 = normal, 0.5 = half speed, 2.0 = double).
   */
  setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate
    }
  }

  /**
   * 🌊 WAVE 8211 — Scalar uniform bridge to the worker's shader pipeline.
   * The value is persisted in `desiredUniforms` so worker respawns replay it
   * on 'theia:ready'. Safe to call before start() — it queues silently.
   */
  setUniform(name: string, value: number): void {
    this.desiredUniforms.set(name, value)
    if (!this.worker) return
    try {
      this.worker.postMessage(makeThetaMessage('theia:set-uniform', { name, value }))
    } catch { /* worker may be dead — the replay on ready covers it */ }
  }

  /**
   * Unload the current video, stopping the stream and cleaning up resources.
   */
  unloadVideo(): void {
    this.teardownVideo()
    if (this.worker) {
      try {
        this.worker.postMessage(makeThetaMessage('theia:unload-stream', {}))
      } catch { /* worker may be dead */ }
    }
  }

  private teardownVideo(): void {
    // 🎬 WAVE 4922 — clear play-atom tracking when the underlying átomo goes away.
    this.currentAtomId = null
    this.currentAtomUrl = null
    if (this.trackProcessor) {
      // Stop the track processor (closes the readable stream)
      try {
        const track = this.videoStream?.getVideoTracks()[0]
        if (track) track.stop()
      } catch { /* noop */ }
      this.trackProcessor = null
    }
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop())
      this.videoStream = null
    }
    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.src = ''
      this.videoElement.remove()
      this.videoElement = null
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Spawn / lifecycle
  // ───────────────────────────────────────────────────────────────────────

  private async spawnWorker(): Promise<void> {
    if (!ENABLE_THETA_ORCHESTRATOR) {
      return
    }

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

    // El ring local siempre existe (readonly, init en campo) — es un SAB
    // renderer-side, no requiere IPC ni negociación con el main process.

    // Vite resolves this URL at build time and emits a separate worker chunk.
    // 🌊 WAVE 8207: the worker type must match the serving mode —
    //   dev  → Vite serves the file as ESM (imports intact) → 'module'
    //   prod → emitted chunk is IIFE (worker.format='iife', WAVE-7790) and
    //          file:// opaque origins reject module workers → 'classic'
    // Two static call sites: Vite cannot parse a ternary in worker options,
    // and the dead branch is DCE'd by the build-time env replacement.
    const worker = import.meta.env.DEV
      ? new Worker(new URL('./theta.worker.ts', import.meta.url), {
          type: 'module',
          name: 'theta',
        })
      : new Worker(new URL('./theta.worker.ts', import.meta.url), {
          type: 'classic',
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
        // 🌊 WAVE 8215 — ring local de 256B alimentado por el telemetry
        // port (ping-pong con el pump de main). Sus primeros 16B replican
        // el FrameContextRing que el worker pollea — ya no hay SAB remoto.
        frameContextSAB: this.telemetryRing,
        pollIntervalMs: this.config.workerPollIntervalMs,
        offscreenCanvas: canvas ?? undefined,
        // 🎬 WAVE 4867 — Phase 6: pass the thumb SAB (always present).
        thumbPixelSAB: this.thumbPixelSAB,
      }),
      transfer,
    )
    // Tras transferir el canvas perdemos su control en este lado.
    if (canvas) this.offscreenCanvas = null

    // 🌊 WAVE 8215 — flush del video port si el broker lo entregó antes
    // del spawn (página tardía / respawn): transferencia inmediata.
    if (this.pendingVideoPort) {
      this.deliverVideoPort(this.pendingVideoPort)
      this.pendingVideoPort = null
    }
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
        // 🌊 WAVE 8211 — replay persisted uniforms (fresh worker is stateless)
        if (this.desiredUniforms.size > 0) {
          for (const [name, value] of this.desiredUniforms) {
            try {
              this.worker?.postMessage(makeThetaMessage('theia:set-uniform', { name, value }))
            } catch { /* replay is best-effort */ }
          }
        }
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

      case 'theia:video-status':
        this.lastVideoStatus = msg.payload as ThetaVideoStatusPayload
        if (!this.hasLoggedFirstFrame && this.lastVideoStatus.framesDecoded > 0) {
          this.hasLoggedFirstFrame = true
          // eslint-disable-next-line no-console
          console.log('[THETA TRACE] ✅ first frame received from worker', {
            state: this.lastVideoStatus.state,
            framesDecoded: this.lastVideoStatus.framesDecoded,
            framesDropped: this.lastVideoStatus.framesDropped,
          })
        }
        break

      case 'theia:asset-state':
        this.lastAssetState = msg.payload as ThetaAssetStatePayload
        break

      case 'theia:seek-ack':
        this.lastSeekAck = msg.payload as ThetaSeekAckPayload
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
      // 🌊 WAVE 8215 — el video port murió con el worker terminado (era
      // propiedad suya): re-pull → el broker entrega un channel FRESCO a
      // ambos extremos y el nuevo worker recibe el extremo productor.
      // El telemetry port NO se re-pulle: vive en esta página y el ring
      // SAB ya pasó al worker nuevo en el INIT.
      requestTheiaPort('video-port')
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
  // 🌊 WAVE 8207: single instance shared by TrinityProvider (power lifecycle)
  // and the Theia UI — one worker = one producer on the video/thumb SABs.
  if (!_instance) _instance = new ThetaOrchestrator()
  return _instance
}
