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
  // Lifecycle (worker → orchestrator)
  | 'theia:ready'
  | 'theia:heartbeat-ack'
  | 'theia:state-report'
  | 'theia:error'

export interface ThetaInitPayload {
  /** Reloj maestro compartido — escrito por TrinityOrchestrator @ 44Hz. */
  frameContextSAB: SharedArrayBuffer
  /** Periodo del poll que THETA hará sobre el SAB (ms). 22ms ≈ 44Hz. */
  pollIntervalMs: number
  /** OffscreenCanvas reservado para Phase 2 (decodificador de vídeo).
   *  En Phase 1 se acepta y se ignora — solo se valida que llegue intacto. */
  offscreenCanvas?: OffscreenCanvas
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

export interface ThetaMessage<T = unknown> {
  type: ThetaMessageType
  payload: T
}

/** Helper tipado para construir mensajes desde cualquier lado. */
export function makeThetaMessage<T>(type: ThetaMessageType, payload: T): ThetaMessage<T> {
  return { type, payload }
}
