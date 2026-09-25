/**
 * 🎬 WAVE 4864 / 🌊 WAVE 8215 — TRANSFERABLE VIDEO FRAME BUFFER (Glass Bridge)
 *
 * Formato de los `ArrayBuffer` transferibles que el ThetaWorker intercambia
 * con la `TheiaOutputWindow` a través de un `MessageChannel` directo
 * (worker ↔ output, brokered por `TheiaWindowManager` en main).
 *
 * WAVE 8215 — THE OPUS PIVOT: `SharedArrayBuffer` ya no cruza la frontera
 * Main↔Renderer (Chromium lo rechaza: "An object could not be cloned").
 * En su lugar, buffers `ArrayBuffer` estándar viajan por OWNERSHIP TRANSFER
 * (`port.postMessage(msg, [buffer])`) — zero-copy, el puntero se mueve, no
 * se copia. El consumidor devuelve el buffer al productor vía `ack`
 * (ping-pong): el pool es finito y NUNCA se re-asigna en el hot path.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Estructura (un ArrayBuffer = un frame):
 *   [0..META_BYTES)          meta:  Int32Array(8)
 *     [0] width             ancho del frame (px)
 *     [1] height            alto del frame (px)
 *     [2] seq               monotonic producer sequence
 *     [3] tickId            tickId del FrameContext al escribirse
 *     [4] flags             bit 0 = present
 *     [5..7] reserved
 *   [META_BYTES, META_BYTES + SLOT_BYTES)   payload RGBA8 (bottom-up GL readout)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * El buffer se aloja a resolución máxima una sola vez (pool allocation) y los
 * frames más pequeños ocupan la esquina superior-izquierda — el reader lee
 * solo `w*h*4` bytes del payload.
 */

// ─────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────

/** Resolución máxima soportada. Frames más grandes serían rechazados. */
export const VIDEO_MAX_WIDTH = 1920
export const VIDEO_MAX_HEIGHT = 1080
export const VIDEO_BYTES_PER_PIXEL = 4

/** Bytes de la zona meta (Int32Array de 8 slots). */
export const VIDEO_META_INT32_LENGTH = 8
export const VIDEO_META_BYTES = VIDEO_META_INT32_LENGTH * 4 // 32

/** Bytes que ocupa el payload RGBA full-size. */
export const VIDEO_SLOT_BYTES =
  VIDEO_MAX_WIDTH * VIDEO_MAX_HEIGHT * VIDEO_BYTES_PER_PIXEL // ~8.3 MB

/** Total bytes de UN buffer transferible (meta + un frame). */
export const VIDEO_FRAME_BUFFER_BYTES = VIDEO_META_BYTES + VIDEO_SLOT_BYTES

// Meta slot indices
const META_WIDTH = 0
const META_HEIGHT = 1
const META_SEQ = 2
const META_FRAME_TICK_ID = 3
const META_FLAGS = 4
// const META_RESERVED_5 = 5
// const META_RESERVED_6 = 6
// const META_RESERVED_7 = 7

const FLAG_PRESENT = 1 << 0

// ─────────────────────────────────────────────────────────────────────────
// Allocation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Crea UN buffer transferible de frame. Se llama SOLO al poblar/re-llenar el
 * pool del productor (attach de link o recuperación tras link perdido) —
 * nunca por frame. La propiedad del buffer viaja con cada postMessage.
 */
export function createVideoFrameBuffer(): ArrayBuffer {
  return new ArrayBuffer(VIDEO_FRAME_BUFFER_BYTES)
}

// ─────────────────────────────────────────────────────────────────────────
// Writer — vive en el ThetaWorker (único propietario hasta el transfer)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Escribe UN frame sobre UN buffer transferible propiedad del caller.
 * Sin Atomics: el productor es el único que toca el buffer hasta que lo
 * transfiere — no hay concurrencia que arbitrar.
 */
export class VideoFrameWriter {
  private readonly meta: Int32Array
  private readonly payload: Uint8Array

  constructor(private readonly buffer: ArrayBuffer) {
    if (buffer.byteLength < VIDEO_FRAME_BUFFER_BYTES) {
      throw new Error(
        `[VideoFrameWriter] buffer too small: ${buffer.byteLength} < ${VIDEO_FRAME_BUFFER_BYTES}`,
      )
    }
    this.meta = new Int32Array(buffer, 0, VIDEO_META_INT32_LENGTH)
    this.payload = new Uint8Array(buffer, VIDEO_META_BYTES, VIDEO_SLOT_BYTES)
  }

  /** The underlying transferable buffer (postMessage target). */
  get transferable(): ArrayBuffer {
    return this.buffer
  }

  /**
   * Devuelve la vista del payload para `gl.readPixels(...)` directo.
   * El caller DEBE llamar `commit()` tras escribir los píxeles.
   */
  beginWrite(width: number, height: number): Uint8Array | null {
    if (width <= 0 || height <= 0) return null
    if (width > VIDEO_MAX_WIDTH || height > VIDEO_MAX_HEIGHT) return null
    return this.payload.subarray(0, width * height * 4)
  }

  /**
   * Publica el meta del frame ya escrito por `beginWrite()`.
   * NOTA: el readout GL es BOTTOM-UP — el consumidor flipea al blittear.
   */
  commit(width: number, height: number, tickId: number, seq: number): void {
    this.meta[META_WIDTH] = width | 0
    this.meta[META_HEIGHT] = height | 0
    this.meta[META_FRAME_TICK_ID] = tickId | 0
    this.meta[META_SEQ] = seq | 0
    this.meta[META_FLAGS] = FLAG_PRESENT
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reader — vive en TheiaOutputWindow
// ─────────────────────────────────────────────────────────────────────────

export interface VideoFrameSnapshot {
  /** Vista directa al buffer transferido. Longitud = w*h*4. */
  view: Uint8Array
  width: number
  height: number
  tickId: number
  seq: number
}

/**
 * Parsea el meta + payload de un buffer de frame recibido por transfer.
 * El buffer ya es propiedad exclusiva del reader — sin concurrencia.
 */
export function readVideoFrame(buffer: ArrayBuffer): VideoFrameSnapshot | null {
  if (buffer.byteLength < VIDEO_META_BYTES) return null
  const meta = new Int32Array(buffer, 0, VIDEO_META_INT32_LENGTH)
  if ((meta[META_FLAGS] & FLAG_PRESENT) === 0) return null
  const width = meta[META_WIDTH]
  const height = meta[META_HEIGHT]
  if (width <= 0 || height <= 0) return null
  if (width > VIDEO_MAX_WIDTH || height > VIDEO_MAX_HEIGHT) return null
  const bytes = width * height * 4
  if (VIDEO_META_BYTES + bytes > buffer.byteLength) return null
  return {
    view: new Uint8Array(buffer, VIDEO_META_BYTES, bytes),
    width,
    height,
    tickId: meta[META_FRAME_TICK_ID],
    seq: meta[META_SEQ],
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 🌊 WAVE 8215 — Glass Bridge port protocol (producer ↔ consumer)
//
// Los mensajes viajan por el `MessagePort` entrelazado por
// `MessageChannelMain` (brokered en TheiaWindowManager). Cada `buffer` se
// lista SIEMPRE en el array de transferencia de `postMessage` — ownership
// move, nunca structured-clone. El consumidor devuelve el MISMO ArrayBuffer
// vía `ack` tras consumirlo: el pool del productor es finito y no se
// re-asigna jamás en el hot path (certificación zero-alloc).
// ─────────────────────────────────────────────────────────────────────────

/** Mensaje productor→consumidor: un frame listo para blittear. */
export const THEIA_VIDEO_FRAME_MSG = 'theia:video-frame'

export interface TheiaVideoFrameMessage {
  type: typeof THEIA_VIDEO_FRAME_MSG
  /** Monotonic producer sequence (espeja meta[META_SEQ]). */
  seq: number
  /** Buffer transferible — propiedad pasa al receptor. */
  buffer: ArrayBuffer
}

/**
 * Mensaje consumidor→productor (`ackFrame`): el buffer ya fue leído y
 * vuelve al pool. Misma forma `{ ack, seq, buffer }` que usa
 * `TheiaTelemetryPump` (Modo B) — un solo contrato para todo Theia.
 */
export interface TheiaAckMessage {
  ack: true
  seq?: number
  buffer: ArrayBuffer
}

/** Type-guard laxo para el tráfico entrante del puerto. */
export function isVideoFrameMessage(data: unknown): data is TheiaVideoFrameMessage {
  const d = data as TheiaVideoFrameMessage | null
  return (
    !!d &&
    d.type === THEIA_VIDEO_FRAME_MSG &&
    d.buffer instanceof ArrayBuffer &&
    d.buffer.byteLength >= VIDEO_FRAME_BUFFER_BYTES
  )
}

/** Type-guard laxo para los acks que retornan buffers al pool. */
export function isAckMessage(data: unknown): data is TheiaAckMessage {
  const d = data as TheiaAckMessage | null
  return (
    !!d &&
    d.ack === true &&
    d.buffer instanceof ArrayBuffer &&
    d.buffer.byteLength >= VIDEO_FRAME_BUFFER_BYTES
  )
}
