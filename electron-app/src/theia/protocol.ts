/**
 * 🎬 WAVE 4860 — THEIA WORKER PROTOCOL
 *
 * Mensajería entre `ThetaOrchestrator` (renderer main thread) y
 * `theta.worker.ts` (Web Worker). Mantiene paridad nominal con el patrón
 * usado por TrinityOrchestrator/BETA/GAMMA pero adaptado a `postMessage`
 * de Web Workers (sin `parentPort`).
 *
 * Phase 1: solo lifecycle + heartbeat. Sin payloads de vídeo todavía.
 */

export type ThetaMessageType =
  // Lifecycle (orchestrator → worker)
  | 'theia:init'
  | 'theia:shutdown'
  | 'theia:heartbeat'
  // Phase 2: Video stream (orchestrator → worker)
  | 'theia:load-stream'
  | 'theia:unload-stream'
  // WAVE 4864 — Phase 4: Asset state machine (orchestrator → worker)
  | 'theia:force-state'
  // 🎬 WAVE 4921 — Atomic cognitive seek (Selene → orchestrator → worker)
  | 'theia:seek'
  // Lifecycle (worker → orchestrator)
  | 'theia:ready'
  | 'theia:heartbeat-ack'
  | 'theia:state-report'
  | 'theia:error'
  // Phase 2: Video status (worker → orchestrator)
  | 'theia:video-status'
  // WAVE 4864 — Phase 4: AssetStateMachine status (worker → orchestrator)
  | 'theia:asset-state'
  // 🎬 WAVE 4903 — ack del seek (worker → orchestrator)
  | 'theia:seek-ack'

export interface ThetaInitPayload {
  /** Reloj maestro compartido — escrito por TrinityOrchestrator @ 44Hz. */
  frameContextSAB: SharedArrayBuffer
  /** Periodo del poll que THETA hará sobre el SAB (ms). 22ms ≈ 44Hz. */
  pollIntervalMs: number
  /** OffscreenCanvas reservado para Phase 2 (decodificador de vídeo).
   *  En Phase 1 se acepta y se ignora — solo se valida que llegue intacto. */
  offscreenCanvas?: OffscreenCanvas
  /** WAVE 4864 — Phase 3: SAB compartido con la TheiaOutputWindow para blit
   *  full-resolution. Si está ausente el worker no escribirá el frame buffer
   *  HDMI (modo legacy: solo OffscreenCanvas en la UI principal). */
  videoFrameSAB?: SharedArrayBuffer
  /** WAVE 4867 — Phase 6: SAB de 64×64 RGBA8 para el twin-output LED/DMX.
   *  El worker escribe el downscale aquí; TheiaVideoRenderer lo lee en el
   *  hot-path de TitanOrchestrator y lo inyecta en AetherCanvasManager. */
  thumbPixelSAB?: SharedArrayBuffer
}

export interface ThetaHeartbeatPayload {
  timestamp: number
  sequence: number
}

export interface ThetaHeartbeatAckPayload {
  originalTimestamp: number
  ackTimestamp: number
  sequence: number
  latencyMs: number
}

export interface ThetaStateReportPayload {
  /** Último tickId leído del SAB. */
  lastTickId: number
  /** Generación del SAB (detección de drift). */
  lastGeneration: number
  /** Ticks observados desde el último report (para calcular drift). */
  ticksObserved: number
  /** Errores acumulados desde el último report. */
  errors: number
  /** Uptime del worker en ms. */
  uptimeMs: number
}

export interface ThetaErrorPayload {
  message: string
  fatal: boolean
  stack?: string
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 2: Video stream payloads
// ─────────────────────────────────────────────────────────────────────────

export interface ThetaLoadStreamPayload {
  /** ReadableStream<VideoFrame> transferred from the main thread. */
  stream: ReadableStream<VideoFrame>
  /** Video native width (informational for aspect ratio). */
  width: number
  /** Video native height. */
  height: number
}

export interface ThetaVideoStatusPayload {
  /** Current pipeline state. */
  state: 'idle' | 'streaming' | 'ended' | 'error'
  /** Frames decoded and drawn since last report. */
  framesDecoded: number
  /** Frames dropped (stream backpressure). */
  framesDropped: number
  /** Optional error message when state='error'. */
  error?: string
}

// ──────────────────────────────────────────────────────────────────
// WAVE 4864 — Phase 4: Asset State Machine
// ──────────────────────────────────────────────────────────────────

export type TheiaAssetStateId = 'idle' | 'ambient' | 'buildup' | 'drop' | 'decay'

export interface ThetaForceStatePayload {
  /** Estado destino solicitado por la UI o por el Brain. */
  state: TheiaAssetStateId
  /** Si true, el crossfade arranca cuando el reloj maestro lo libere
   *  (downbeat). Si false, arranca en el siguiente tick. */
  waitAnchor?: boolean
  /** Curva del crossfade. Default 'easeInOut'. */
  curve?: 'linear' | 'easeInOut' | 'cosine'
  /** Duración total del crossfade en ticks (default 22 ≈ 500ms). */
  totalTicks?: number
  /** Marca este intent como manual del operador — puede romper drop-lock. */
  manual?: boolean
}

export interface ThetaAssetStatePayload {
  state: TheiaAssetStateId
  /** Estado destino si hay un crossfade en curso. */
  pendingState: TheiaAssetStateId | null
  /** Progreso del crossfade actual (0..1). */
  crossfadeProgress: number
  /** Si está esperando al downbeat. */
  waitingAnchor: boolean
}

// ──────────────────────────────────────────────────────────────────
// 🎬 WAVE 4903 — Phase 7: Cognitive Seek (Selene → Theia)
// ──────────────────────────────────────────────────────────────────

/**
 * Mensaje IPC público (renderer-internal) emitido por el wiring de Selene
 * cuando `SeleneTheiaAdapter` produce un `AtomPlayIntent`. Es consumido por
 * `ThetaOrchestrator.handleCueJump()`.
 *
 * WAVE 4921: el payload abandona `cuepointId` (el modelo cuepoint murió);
 * ahora identifica únicamente al átomo destino vía `atomId`.
 *
 * Nota arquitectónica: en LuxSync, tanto Selene como Theta viven en el
 * proceso renderer. NO hay `mainWindow.webContents.send` real — el "IPC"
 * es un EventTarget interno del renderer (`theiaCueJumpBus`). Se conserva
 * la nomenclatura IPC para compatibilidad si en el futuro se separan los
 * procesos.
 */
export interface TheiaPlayAtomMessage {
  type: 'theia:play-atom'
  payload: {
    /** ID del átomo (.theia) destino. Vacío = blackout. */
    atomId: string
    /** Offset temporal donde el videoElement debe saltar (ms). */
    startMs: number
    /** Duración del crossfade visual (ms). */
    crossfadeMs: number
    /** Texto humano de telemetría. */
    reason: string
    /** Timestamp de emisión (renderer ms) — para latency tracking. */
    emittedAt: number
  }
}

/** @deprecated WAVE 4922 — alias histórico de `TheiaPlayAtomMessage`. */
export type TheiaCueJumpMessage = TheiaPlayAtomMessage

/**
 * Payload `orchestrator → worker`. El orchestrator ya hizo el `videoElement.currentTime`
 * y la lazy-load del .mp4 si era necesario; el worker solo necesita preparar
 * el crossfade visual (snapshot del frame previo + arranque de la curva).
 *
 * WAVE 4921: `atomId` reemplaza al legacy `clipId + cuepointId`.
 */
export interface ThetaSeekPayload {
  /** ID del átomo destino (informativo para logs). Vacío = blackout. */
  atomId: string
  /** Posición destino dentro del átomo (ms). Solo informativo — el seek real
   *  ya lo aplicó el orchestrator sobre el videoElement. */
  startMs: number
  /** Duración del crossfade visual en ms. Se traduce a ticks (~22ms cada uno). */
  crossfadeMs: number
  /** Razón legible (telemetría). */
  reason: string
  /** Timestamp de emisión (renderer ms). */
  emittedAt: number
}

/** Ack del worker tras procesar `theia:seek`. */
export interface ThetaSeekAckPayload {
  atomId: string
  /** Latencia medida emit→worker (ms). */
  latencyMs: number
  /** Snapshot capturado correctamente. False si el canvas estaba vacío. */
  snapshotOk: boolean
  /** Total de ticks programados para el crossfade. */
  crossfadeTicks: number
}

export interface ThetaMessage<T = unknown> {
  type: ThetaMessageType
  payload: T
}

/** Helper tipado para construir mensajes desde cualquier lado. */
export function makeThetaMessage<T>(type: ThetaMessageType, payload: T): ThetaMessage<T> {
  return { type, payload }
}
