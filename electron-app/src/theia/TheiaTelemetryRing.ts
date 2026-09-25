/**
 * 🌊 WAVE 8215 — THEIA TELEMETRY RING (Glass Bridge · Modo B, consumer side)
 *
 * Contrato de los buffers de 256B que `TheiaTelemetryPump` (main) envía por
 * `MessagePort` a cada renderer suscrito, en ping-pong:
 *
 *   pump ──{type:'theia:telemetry', seq, buffer}──▶ consumer
 *          structured-clone 256B — `MessagePortMain` NO transfiere
 *          ArrayBuffers (WAVE 8216 fix: "Port at index 0 is not a valid port")
 *   consumer ──{ack:true, seq, buffer}──▶ pump     (ackFrame — devolución por
 *          ownership transfer: el DOM MessagePort renderer→main SÍ transfiere)
 *
 * El consumidor NUNCA retiene el buffer: copia los 256B a su ring LOCAL
 * (`SharedArrayBuffer` intra-proceso — legal bajo el veto WAVE 8215, que
 * solo aplica a la frontera Main↔Renderer) y devuelve su copia en el mismo
 * handler. Cero alloc por tick: el ring local se crea UNA vez; el buffer
 * ack-transferido repone el pool fijo del pump (backpressure incluida).
 *
 * Layout compartido (espejo de `TheiaTelemetryPump`):
 *   [0..16)   FrameContextRing verbatim — Int32[4]: tickId, tsLo, tsHi, gen
 *   [16..256) reservado para el Euclid `TheiaTelemetryRing` (WAVE 8208):
 *             telemetría Selene/Cassandra · GodEar FFT V3 · Omniliquid.
 *
 * Consumidores actuales:
 *   - ThetaOrchestrator (ventana principal): espeja al ring que pasa al
 *     worker como `frameContextSAB` — su primera página de 16B es el reloj.
 *   - TheiaOutputView (Modo B): ring local para el futuro shader propio.
 */

/** Bytes del ring Euclid — una línea de caché ×4. */
export const TELEMETRY_RING_BYTES = 256
export const TELEMETRY_RING_INT32_LENGTH = TELEMETRY_RING_BYTES / 4 // 64

/** Slot Int32 donde vive `generation` (barrera lógica — escribir ÚLTIMO). */
const SLOT_GENERATION = 3

/** Mensaje pump→consumer. */
export const THEIA_TELEMETRY_MSG = 'theia:telemetry'

export interface TheiaTelemetryMessage {
  type: typeof THEIA_TELEMETRY_MSG
  /** Monotonic pump sequence. */
  seq: number
  /** Buffer 256B — llega por clone (WAVE 8216); se devuelve por transfer en el ack. */
  buffer: ArrayBuffer
}

/** `ackFrame` consumidor→pump: el buffer leído vuelve al pool. */
export interface TheiaTelemetryAck {
  ack: true
  seq?: number
  buffer: ArrayBuffer
}

/** Crea el ring LOCAL de un consumidor (intra-proceso, una sola vez). */
export function createTelemetryRing(): SharedArrayBuffer {
  return new SharedArrayBuffer(TELEMETRY_RING_BYTES)
}

/**
 * Espeja un buffer de telemetría recibido dentro del ring local.
 * Copia verbatim 256B EXCEPTO `generation`, que se escribe al final con
 * `Atomics.store` para preservar la barrera lógica del seqlock-lite: un
 * reader que observe el gen nuevo garantiza que los slots anteriores ya son
 * coherentes (mismo contrato que `FrameContextWriter.advance`).
 */
export function mirrorTelemetryIntoRing(ring: SharedArrayBuffer, buffer: ArrayBuffer): void {
  if (buffer.byteLength < TELEMETRY_RING_BYTES) return
  const dst = new Int32Array(ring, 0, TELEMETRY_RING_INT32_LENGTH)
  const src = new Int32Array(buffer, 0, TELEMETRY_RING_INT32_LENGTH)
  dst.subarray(0, SLOT_GENERATION).set(src.subarray(0, SLOT_GENERATION))
  dst.subarray(SLOT_GENERATION + 1).set(src.subarray(SLOT_GENERATION + 1))
  Atomics.store(dst, SLOT_GENERATION, Atomics.load(src, SLOT_GENERATION))
}

/** Type-guard laxo para telemetría entrante del port. */
export function isTelemetryMessage(data: unknown): data is TheiaTelemetryMessage {
  const d = data as TheiaTelemetryMessage | null
  return (
    !!d &&
    d.type === THEIA_TELEMETRY_MSG &&
    d.buffer instanceof ArrayBuffer &&
    d.buffer.byteLength >= TELEMETRY_RING_BYTES
  )
}

/**
 * `ackFrame()` — devuelve el buffer al pump por ownership transfer.
 * El ÚNICO postMessage permitido por tick; nunca se instancia un buffer
 * nuevo en este camino.
 */
export function ackTelemetryFrame(port: MessagePort, msg: TheiaTelemetryMessage): void {
  const ack: TheiaTelemetryAck = { ack: true, seq: msg.seq, buffer: msg.buffer }
  port.postMessage(ack, [msg.buffer])
}
