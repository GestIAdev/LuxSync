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
  type ThetaAssetStatePayload,
  type ThetaErrorPayload,
  type ThetaForceStatePayload,
  type ThetaHeartbeatAckPayload,
  type ThetaHeartbeatPayload,
  type ThetaInitPayload,
  type ThetaLoadStreamPayload,
  type ThetaMessage,
  type ThetaSeekAckPayload,
  type ThetaSeekPayload,
  type ThetaStateReportPayload,
  type ThetaVideoStatusPayload,
} from './protocol'
// 🎬 WAVE 4864: Phase 4 — Asset State Machine + Crossfade Unit
import { AssetStateMachine, type AssetStateId } from './AssetStateMachine'
import { CrossfadeUnit, type CrossfadeCurve } from './CrossfadeUnit'
// 🎬 WAVE 4864: Phase 3 — SAB writer for the projector window
import { VideoFrameWriter } from './SharedVideoFrameBuffer'
// 🎬 WAVE 4867: Phase 6 — Thumb SAB writer (64×64 → AetherCanvasManager twin-output)
import { ThumbFrameWriter } from './TheiaThumbBuffer'

// ─────────────────────────────────────────────────────────────────────────
// 🛡️ WAVE 7569: OILPAN GUARD — Safety limits to prevent OOM from getImageData
// ─────────────────────────────────────────────────────────────────────────
const MAX_CANVAS_WIDTH = 1920
const MAX_CANVAS_HEIGHT = 1080

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
  // Phase 2: Video pipeline state
  videoState: 'idle' | 'streaming' | 'ended' | 'error'
  frameReader: ReadableStreamDefaultReader<VideoFrame> | null
  framePumpRunning: boolean
  currentFrame: VideoFrame | null
  framesDecoded: number
  framesDropped: number
  canvasCtx: OffscreenCanvasRenderingContext2D | null
  // 🛡️ WAVE 7569: OILPAN GUARD — cached ImageData to avoid 8MB alloc per tick
  cachedImageData: ImageData | null
  cachedImageW: number
  cachedImageH: number
  // Phase 2: 64x64 downscaler
  thumbCanvas: OffscreenCanvas | null
  thumbCtx: OffscreenCanvasRenderingContext2D | null
  lastPixelData: ImageData | null
  // 🎬 WAVE 4864 — Phase 3: SAB writer del video pipeline (HDMI/LED wall)
  videoWriter: VideoFrameWriter | null
  // 🎬 WAVE 4867 — Phase 6: SAB writer del thumb buffer (64×64) para AetherCanvas
  thumbWriter: ThumbFrameWriter | null
  // 🎬 WAVE 4864 — Phase 4: Asset State Machine + Crossfade
  fsm: AssetStateMachine
  crossfade: CrossfadeUnit
  /** Snapshot del frame anterior para hacer lerp durante crossfade. */
  prevSnapshot: OffscreenCanvas | null
  prevSnapshotCtx: OffscreenCanvasRenderingContext2D | null
  /** True si hay snapshot válida (al menos un frame se ha capturado). */
  prevSnapshotValid: boolean
  assetStateReportHandle: number | null
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
  // Phase 2
  videoState: 'idle',
  frameReader: null,
  framePumpRunning: false,
  currentFrame: null,
  framesDecoded: 0,
  framesDropped: 0,
  canvasCtx: null,
  // 🛡️ WAVE 7569: OILPAN GUARD
  cachedImageData: null,
  cachedImageW: 0,
  cachedImageH: 0,
  thumbCanvas: null,
  thumbCtx: null,
  lastPixelData: null,
  // 🎬 WAVE 4864 / 4867
  videoWriter: null,
  thumbWriter: null,
  fsm: new AssetStateMachine(),
  crossfade: new CrossfadeUnit(),
  prevSnapshot: null,
  prevSnapshotCtx: null,
  prevSnapshotValid: false,
  assetStateReportHandle: null,
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
      // eslint-disable-next-line no-console
      console.warn(`[THETA ⚠️] tick gap=${gap} (lastTickId=${state.lastTickId} → ${snap.tickId})`)
    }
  }
  state.lastTickId = snap.tickId
  state.lastGeneration = snap.generation
  state.ticksObserved++

  // Phase 2: On each tick, render the latest valid frame to OffscreenCanvas
  renderCurrentFrame()
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
// Phase 2: Video stream pipeline — frame pump + SAB-synced rendering
// ─────────────────────────────────────────────────────────────────────────

/**
 * Render the latest VideoFrame to the OffscreenCanvas.
 * Called once per SAB tick (~44Hz). If no frame is available, the canvas
 * keeps the last drawn content (hold-frame strategy).
 *
 * 🎬 WAVE 4864 — Phase 4 changes:
 *  - Si hay un crossfade activo, blendea `prevSnapshot` (alpha₁) con el frame
 *    actual (alpha₂) en lugar de pintar solo el frame.
 *  - Cuando el crossfade termina, el snapshot pasa a ser irrelevante hasta
 *    el próximo `forceState`.
 *
 * 🎬 WAVE 4864 — Phase 3 changes:
 *  - Tras dibujar el frame en el OffscreenCanvas principal, copia los píxeles
 *    al SharedVideoFrameBuffer para que la TheiaOutputWindow los blittee.
 */
function renderCurrentFrame(): void {
  const frame = state.currentFrame
  const ctx = state.canvasCtx
  if (!ctx || !state.offscreenCanvas) {
    if (frame) {
      // No canvas attached — still close to release GPU memory.
      frame.close()
      state.currentFrame = null
    }
    return
  }

  if (frame) {
    // 🛡️ WAVE 7569: OILPAN GUARD — Clamp canvas dimensions to MAX 1920×1080.
    // Frames larger than this are downscaled by the browser when drawImage
    // scales them into the smaller canvas. This prevents getImageData from
    // allocating 33MB+ per tick on 4K video (which caused Oilpan OOM).
    const targetW = Math.min(frame.displayWidth, MAX_CANVAS_WIDTH)
    const targetH = Math.min(frame.displayHeight, MAX_CANVAS_HEIGHT)

    // Resize canvas to match (clamped) frame if dimensions changed
    if (
      state.offscreenCanvas.width !== targetW ||
      state.offscreenCanvas.height !== targetH
    ) {
      state.offscreenCanvas.width = targetW
      state.offscreenCanvas.height = targetH
      // Invalidate cached ImageData — dimensions changed
      state.cachedImageData = null
      state.cachedImageW = 0
      state.cachedImageH = 0
    }

    // Crossfade step (only meaningful if a crossfade is in progress) —
    // we step it BEFORE drawing so we know the alphas for THIS tick.
    const xfStep = state.crossfade.step()

    if (xfStep.active && state.prevSnapshotValid && state.prevSnapshot) {
      // Blended draw: clear, paint prev with alpha, paint current with alpha
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, state.offscreenCanvas.width, state.offscreenCanvas.height)
      ctx.globalAlpha = xfStep.alphaPrimary
      // Draw prev snapshot scaled to current canvas size
      ctx.drawImage(
        state.prevSnapshot,
        0,
        0,
        state.prevSnapshot.width,
        state.prevSnapshot.height,
        0,
        0,
        state.offscreenCanvas.width,
        state.offscreenCanvas.height,
      )
      ctx.globalAlpha = xfStep.alphaSecondary
      ctx.drawImage(frame, 0, 0)
      ctx.globalAlpha = 1
      ctx.restore()

      if (xfStep.finished) {
        // Promote: from now on, prev snapshot stops being relevant.
        state.prevSnapshotValid = false
      }
    } else {
      // Standard path: just draw the frame
      ctx.drawImage(frame, 0, 0)
    }

    // Phase 2 Downscaler: 64x64 thumbnail for pixel sampling
    if (state.thumbCtx && state.thumbCanvas) {
      state.thumbCtx.drawImage(frame, 0, 0, 64, 64)
      state.lastPixelData = state.thumbCtx.getImageData(0, 0, 64, 64)
      // 🎬 WAVE 4867 — Phase 6: publish thumb to SAB for AetherCanvas zero-copy ingest.
      if (state.thumbWriter && state.lastPixelData) {
        state.thumbWriter.publish(state.lastPixelData.data)
      }
    }

    // 🎬 WAVE 4864 — Phase 3: publish to the projector SAB.
    // 🛡️ WAVE 7569: OILPAN GUARD — Reuse cached ImageData instead of allocating
    // a new Uint8ClampedArray on every tick. Previously, getImageData() at 44Hz
    // on a 1080p canvas allocated ~8MB per tick = ~352MB/sec of garbage that
    // Oilpan had to collect, causing OOM crashes. Now we allocate once and
    // reuse the buffer — getImageData() writes into the existing Uint8ClampedArray.
    if (state.videoWriter) {
      try {
        const w = state.offscreenCanvas.width
        const h = state.offscreenCanvas.height

        // 🛡️ WAVE 7569: getImageData always allocates a new Uint8ClampedArray
        // (the Web IDL spec doesn't allow reusing an existing ImageData buffer).
        // The OILPAN GUARD mitigation is the canvas dimension clamp above —
        // by capping at 1920×1080, each getImageData allocates ~8MB instead of
        // 33MB on 4K video. The GC can handle 8MB×44Hz = 352MB/sec of short-
        // lived garbage, but 1.45GB/sec (4K uncapped) caused OOM crashes.
        const img = ctx.getImageData(0, 0, w, h)

        state.videoWriter.publish({
          rgba: img.data,
          width: w,
          height: h,
          tickId: state.lastTickId,
        })
      } catch (err) {
        // Single-shot soft error — don't kill the worker, just log.
        const msg = err instanceof Error ? err.message : String(err)
        sendError(`videoWriter.publish failed: ${msg}`, false)
      }
    }

    // CRITICAL: Close the frame to release GPU memory. The frame pump will
    // provide the next one. We null the reference so we don't double-draw.
    frame.close()
    state.currentFrame = null
    state.framesDecoded++
  } else if (state.crossfade.state === 'running' && state.prevSnapshotValid) {
    // No new frame this tick but a crossfade is running — keep advancing
    // the curve and re-blend with the LAST drawn content.
    // (We don't keep a separate "last drawn" buffer; the canvas itself holds
    // the previous tick's blended output, so we let the curve march and skip
    // the redraw — the next frame will catch up on visual position.)
    state.crossfade.step()
  }
}

/**
 * 🎬 WAVE 4864 — Phase 4: Captura el contenido actual del canvas como
 * snapshot del frame "primario" antes de iniciar un crossfade. Llamado por
 * `handleForceState`.
 */
function captureCurrentSnapshot(): void {
  if (!state.offscreenCanvas || !state.canvasCtx) return
  const w = state.offscreenCanvas.width
  const h = state.offscreenCanvas.height
  if (w <= 0 || h <= 0) return

  if (!state.prevSnapshot || state.prevSnapshot.width !== w || state.prevSnapshot.height !== h) {
    state.prevSnapshot = new OffscreenCanvas(w, h)
    state.prevSnapshotCtx = state.prevSnapshot.getContext('2d')
  }
  if (!state.prevSnapshotCtx) return
  state.prevSnapshotCtx.clearRect(0, 0, w, h)
  state.prevSnapshotCtx.drawImage(state.offscreenCanvas, 0, 0)
  state.prevSnapshotValid = true
}

/**
 * 🎬 WAVE 4864 — Phase 4: Recibe `theia:force-state` desde el orchestrator.
 * Solicita la transición a la FSM y, si es aceptada, captura snapshot del
 * canvas y arranca el CrossfadeUnit.
 */
function handleForceState(payload: ThetaForceStatePayload): void {
  if (!payload || typeof payload.state !== 'string') {
    sendError('force-state payload missing state', false)
    return
  }
  const target = payload.state as AssetStateId
  // From IDLE → AMBIENT we boot. Other transitions go via transition().
  let result
  if (state.fsm.currentState === 'idle' && target === 'ambient') {
    result = state.fsm.bootToAmbient()
  } else {
    result = state.fsm.transition(target, { manual: !!payload.manual })
  }

  if (!result.accepted) {
    // Soft — no error, the orchestrator can retry. Notify state regardless.
    sendAssetState()
    return
  }

  if (result.needsCrossfade) {
    // Snapshot the current canvas BEFORE we change anything.
    captureCurrentSnapshot()
    state.crossfade.start({
      totalTicks: payload.totalTicks,
      curve: (payload.curve as CrossfadeCurve | undefined) ?? 'easeInOut',
      waitAnchor: !!payload.waitAnchor,
    })
  } else {
    // Hard cut (e.g. boot to ambient) — ensure no leftover crossfade.
    state.crossfade.abort()
    state.prevSnapshotValid = false
  }

  sendAssetState()
}

/**
 * 🎬 WAVE 4903 — Phase 7: Cognitive Seek handler.
 *
 * El orchestrator ya hizo `videoElement.currentTime = startMs/1000` y, si el
 * `clipId` cambió, recargó el .mp4 vía `loadVideo()`. Cuando este mensaje
 * llega al worker, el frame pump ya está siendo reabastecido con frames
 * de la nueva posición temporal.
 *
 * Responsabilidad del worker:
 *   1. Capturar snapshot del último frame visible (lo que el espectador
 *      "ve" justo antes del salto cognitivo).
 *   2. Iniciar el `CrossfadeUnit` con la duración recibida en `crossfadeMs`.
 *      `renderCurrentFrame` (44Hz) blendea el snapshot vs los nuevos frames.
 *   3. Emitir `theia:seek-ack` con la latencia y el conteo de ticks.
 */
function handleSeek(payload: ThetaSeekPayload): void {
  const recvAt = Date.now()
  const latency = Math.max(0, recvAt - payload.emittedAt)

  // Capturar el frame actual ANTES de cualquier cambio (será el `prev` del fade).
  captureCurrentSnapshot()
  const snapshotOk = state.prevSnapshotValid

  // Traducir crossfadeMs → ticks. pollIntervalMs ~ 22ms = 1 tick.
  // Mínimo 1 tick (corte casi duro), máximo 200 ticks (~4.4s) por seguridad.
  const ms = Number.isFinite(payload.crossfadeMs) ? Math.max(0, payload.crossfadeMs) : 500
  const totalTicks = Math.min(200, Math.max(1, Math.round(ms / Math.max(1, state.pollIntervalMs))))

  // Curva acorde a la urgencia: cortes duros = lineal; transiciones suaves = easeInOut.
  const curve: CrossfadeCurve = totalTicks <= 4 ? 'linear' : 'easeInOut'

  if (snapshotOk) {
    state.crossfade.start({ totalTicks, curve, waitAnchor: false })
  } else {
    // Sin snapshot válido (primer cue del show, canvas vacío) → corte duro.
    state.crossfade.abort()
    state.prevSnapshotValid = false
  }

  // Si el átomo destino es vacío => blackout: forzar FSM a idle.
  if (!payload.atomId) {
    state.fsm.reset()
  }

  const ack: ThetaSeekAckPayload = {
    atomId: payload.atomId,
    latencyMs: latency,
    snapshotOk,
    crossfadeTicks: snapshotOk ? totalTicks : 0,
  }
  send('theia:seek-ack', ack)
}

function sendAssetState(): void {
  const xf = state.crossfade
  const payload: ThetaAssetStatePayload = {
    state: state.fsm.currentState,
    pendingState: xf.isDone() ? null : state.fsm.currentState,
    crossfadeProgress: xf.progress(),
    waitingAnchor: xf.isWaitingAnchor(),
  }
  send('theia:asset-state', payload)
}

/**
 * Send a video status report to the orchestrator.
 */
function sendVideoStatus(): void {
  const payload: ThetaVideoStatusPayload = {
    state: state.videoState,
    framesDecoded: state.framesDecoded,
    framesDropped: state.framesDropped,
  }
  send('theia:video-status', payload)
}

/**
 * Handle 'theia:load-stream': receive the transferred ReadableStream<VideoFrame>
 * and start the async frame pump that continuously reads frames.
 */
function handleLoadStream(payload: ThetaLoadStreamPayload): void {
  // Tear down any existing stream first
  teardownVideoStream()

  if (!payload.stream) {
    sendError('load-stream payload missing stream', false)
    return
  }

  state.frameReader = payload.stream.getReader()
  state.videoState = 'streaming'
  state.framesDecoded = 0
  state.framesDropped = 0
  state.framePumpRunning = true

  // 🎬 WAVE 4864 — boot the FSM to AMBIENT on first stream load.
  if (state.fsm.currentState === 'idle') {
    state.fsm.bootToAmbient()
    sendAssetState()
  }

  sendVideoStatus()

  // Start the async frame pump
  void runFramePump()
}

/**
 * Async pump that continuously reads VideoFrame objects from the
 * ReadableStream. Each new frame replaces the previous one (latest-wins).
 * Old unrendered frames are closed immediately to avoid GPU memory leaks.
 */
async function runFramePump(): Promise<void> {
  const reader = state.frameReader
  if (!reader) return

  try {
    while (state.framePumpRunning) {
      const { value, done } = await reader.read()
      if (done) {
        state.videoState = 'ended'
        sendVideoStatus()
        break
      }
      // Latest-frame strategy: if a previous frame wasn't consumed by the
      // render tick yet, close it (drop) and replace with the new one.
      if (state.currentFrame) {
        state.currentFrame.close()
        state.framesDropped++
      }
      state.currentFrame = value
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Stream cancelled (e.g. teardown) is not a fatal error
    if (!msg.includes('cancel')) {
      state.videoState = 'error'
      sendError(`Frame pump error: ${msg}`, false)
      sendVideoStatus()
    }
  }
}

/**
 * Tear down the video stream: cancel the reader, close any pending frame,
 * reset state to idle.
 */
function teardownVideoStream(): void {
  state.framePumpRunning = false
  if (state.frameReader) {
    try {
      state.frameReader.cancel().catch(() => {})
    } catch { /* noop */ }
    state.frameReader = null
  }
  if (state.currentFrame) {
    try { state.currentFrame.close() } catch { /* noop */ }
    state.currentFrame = null
  }
  state.videoState = 'idle'
  state.framesDecoded = 0
  state.framesDropped = 0
  sendVideoStatus()
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

  // Phase 2: Initialize canvas rendering contexts
  if (state.offscreenCanvas) {
    state.canvasCtx = state.offscreenCanvas.getContext('2d')
    // 64x64 thumbnail canvas for downscaling
    state.thumbCanvas = new OffscreenCanvas(64, 64)
    state.thumbCtx = state.thumbCanvas.getContext('2d')
  }

  // 🎬 WAVE 4864 — Phase 3: Attach SharedVideoFrameBuffer writer if provided.
  if (payload.videoFrameSAB instanceof SharedArrayBuffer) {
    try {
      state.videoWriter = new VideoFrameWriter(payload.videoFrameSAB)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendError(`videoFrameSAB attach failed: ${msg}`, false)
      state.videoWriter = null
    }
  }

  // 🎬 WAVE 4867 — Phase 6: Attach ThumbFrameWriter if SAB provided.
  if ((payload as ThetaInitPayload).thumbPixelSAB instanceof SharedArrayBuffer) {
    try {
      state.thumbWriter = new ThumbFrameWriter((payload as ThetaInitPayload).thumbPixelSAB!)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendError(`thumbPixelSAB attach failed: ${msg}`, false)
      state.thumbWriter = null
    }
  }

  startPollLoop()
  startStateReports()

  send('theia:ready', { nodeId: 'theta' })
}

function handleShutdown(): void {
  state.isRunning = false
  stopPollLoop()
  stopStateReports()
  teardownVideoStream()
  state.reader = null
  state.offscreenCanvas = null
  state.canvasCtx = null
  state.thumbCanvas = null
  state.thumbCtx = null
  // 🎬 WAVE 4864 — Phase 3/4 cleanup
  if (state.videoWriter) state.videoWriter.clear()
  state.videoWriter = null
  // 🎬 WAVE 4867 — Phase 6 cleanup
  if (state.thumbWriter) state.thumbWriter.clear()
  state.thumbWriter = null
  state.prevSnapshot = null
  state.prevSnapshotCtx = null
  state.prevSnapshotValid = false
  state.crossfade.abort()
  state.fsm.reset()
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
      case 'theia:load-stream':
        handleLoadStream(msg.payload as ThetaLoadStreamPayload)
        break
      case 'theia:unload-stream':
        teardownVideoStream()
        break
      case 'theia:force-state':
        handleForceState(msg.payload as ThetaForceStatePayload)
        break
      case 'theia:seek':
        handleSeek(msg.payload as ThetaSeekPayload)
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
