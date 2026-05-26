/**
 * 🎬 WAVE 4864 — SHARED VIDEO FRAME BUFFER (SAB, SPSC double-buffer)
 *
 * Memoria compartida para los frames RGBA full-resolution producidos por el
 * ThetaWorker y consumidos por la `TheiaOutputWindow` (BrowserWindow secundaria
 * que blittea por HDMI/LED wall).
 *
 * Layout fijo, SAB no se reasigna. El tamaño máximo (1920×1080) se reserva al
 * arranque y los frames más pequeños se escriben en la esquina superior-izquierda
 * con `width`/`height` reales en la zona meta — el reader lee solo `w*h*4` bytes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Estructura (single SharedArrayBuffer):
 *   [0..META_BYTES)         meta:  Int32Array(8)
 *     [0] width             ancho actual del frame (px)
 *     [1] height            alto actual del frame (px)
 *     [2] producerSeq       monotonic, incrementa en cada flip()
 *     [3] consumerSeq       último seq leído (informativo, lo escribe el output)
 *     [4] frameTickId       tickId del FrameContextRing en el momento del flip
 *     [5] activeSlot        0 ó 1 — slot que contiene el frame válido más reciente
 *     [6] flags             bit 0 = present (al menos un frame escrito)
 *     [7] reserved
 *
 *   [META_BYTES, META_BYTES + SLOT_BYTES)              slot 0  (RGBA8)
 *   [META_BYTES + SLOT_BYTES, META_BYTES + 2*SLOT_BYTES) slot 1  (RGBA8)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Doble buffer: el productor escribe SIEMPRE en `1 - activeSlot`, luego publica
 * con `Atomics.store(activeSlot, ...)`. El consumidor lee `activeSlot` en su rAF.
 * No bloquea jamás — frame perdido = frame anterior se mantiene visible.
 *
 * Isomorphic: corre en main process (creación) y en renderer/worker (lectura/
 * escritura). Solo depende de SharedArrayBuffer + Int32Array + Atomics.
 */
// ─────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────
/** Resolución máxima soportada por el SAB. Frames más grandes serían rechazados. */
export const VIDEO_MAX_WIDTH = 1920;
export const VIDEO_MAX_HEIGHT = 1080;
export const VIDEO_BYTES_PER_PIXEL = 4;
/** Bytes de la zona meta (Int32Array de 8 slots). */
export const VIDEO_META_INT32_LENGTH = 8;
export const VIDEO_META_BYTES = VIDEO_META_INT32_LENGTH * 4; // 32
/** Bytes que ocupa un slot RGBA full-size. */
export const VIDEO_SLOT_BYTES = VIDEO_MAX_WIDTH * VIDEO_MAX_HEIGHT * VIDEO_BYTES_PER_PIXEL; // ~8.3 MB
/** Total bytes del SAB. */
export const VIDEO_SAB_BYTE_LENGTH = VIDEO_META_BYTES + 2 * VIDEO_SLOT_BYTES;
// Meta slot indices
const META_WIDTH = 0;
const META_HEIGHT = 1;
const META_PRODUCER_SEQ = 2;
const META_CONSUMER_SEQ = 3;
const META_FRAME_TICK_ID = 4;
const META_ACTIVE_SLOT = 5;
const META_FLAGS = 6;
// const META_RESERVED = 7
const FLAG_PRESENT = 1 << 0;
// ─────────────────────────────────────────────────────────────────────────
// Allocation
// ─────────────────────────────────────────────────────────────────────────
/**
 * Crea el SharedArrayBuffer del video pipeline. Se llama una sola vez en el
 * Main Process (por TheiaWindowManager) y se transfiere por referencia tanto
 * al renderer principal (para el ThetaWorker) como a la TheiaOutputWindow.
 */
export function createSharedVideoFrameBuffer() {
    return new SharedArrayBuffer(VIDEO_SAB_BYTE_LENGTH);
}
export class VideoFrameWriter {
    constructor(sab) {
        this._producerSeq = 0;
        if (sab.byteLength < VIDEO_SAB_BYTE_LENGTH) {
            throw new Error(`[VideoFrameWriter] SAB too small: ${sab.byteLength} < ${VIDEO_SAB_BYTE_LENGTH}`);
        }
        this.meta = new Int32Array(sab, 0, VIDEO_META_INT32_LENGTH);
        this.slots = [
            new Uint8Array(sab, VIDEO_META_BYTES, VIDEO_SLOT_BYTES),
            new Uint8Array(sab, VIDEO_META_BYTES + VIDEO_SLOT_BYTES, VIDEO_SLOT_BYTES),
        ];
    }
    /**
     * Publica un frame de forma atómica. Escribe en el slot inactivo y luego
     * cambia `activeSlot` para que el consumer vea el nuevo frame entero.
     *
     * No realiza ninguna asignación — el caller ya tiene los bytes.
     * Frames mayores que 1920×1080 se rechazan silenciosamente (return false).
     */
    publish(info) {
        const { rgba, width, height, tickId } = info;
        if (width <= 0 || height <= 0)
            return false;
        if (width > VIDEO_MAX_WIDTH || height > VIDEO_MAX_HEIGHT)
            return false;
        const expectedBytes = width * height * 4;
        if (rgba.length < expectedBytes)
            return false;
        const currentActive = Atomics.load(this.meta, META_ACTIVE_SLOT);
        const writeSlot = currentActive === 0 ? 1 : 0;
        const dst = this.slots[writeSlot];
        // Copia los bytes del frame al slot inactivo.
        if (rgba.length === expectedBytes) {
            dst.set(rgba);
        }
        else {
            // El caller pasó un buffer mayor (e.g. ImageData de 1920×1080 con frame
            // pequeño); copiamos solo el subrango válido.
            dst.set(rgba.subarray(0, expectedBytes));
        }
        // Publica meta — orden importa: dimensiones primero, luego activeSlot.
        Atomics.store(this.meta, META_WIDTH, width | 0);
        Atomics.store(this.meta, META_HEIGHT, height | 0);
        Atomics.store(this.meta, META_FRAME_TICK_ID, tickId | 0);
        this._producerSeq = (this._producerSeq + 1) | 0;
        Atomics.store(this.meta, META_PRODUCER_SEQ, this._producerSeq);
        // Barrera lógica: el flip atómico publica el slot escrito.
        Atomics.store(this.meta, META_ACTIVE_SLOT, writeSlot);
        // Marca presence flag (one-way latch).
        const flags = Atomics.load(this.meta, META_FLAGS);
        if ((flags & FLAG_PRESENT) === 0) {
            Atomics.store(this.meta, META_FLAGS, flags | FLAG_PRESENT);
        }
        return true;
    }
    /** Limpia el flag de "presente" — el output mostrará negro hasta nuevo frame. */
    clear() {
        Atomics.store(this.meta, META_FLAGS, 0);
        Atomics.store(this.meta, META_WIDTH, 0);
        Atomics.store(this.meta, META_HEIGHT, 0);
    }
}
export class VideoFrameReader {
    constructor(sab) {
        this._lastSeenSeq = -1;
        if (sab.byteLength < VIDEO_SAB_BYTE_LENGTH) {
            throw new Error(`[VideoFrameReader] SAB too small: ${sab.byteLength} < ${VIDEO_SAB_BYTE_LENGTH}`);
        }
        this.meta = new Int32Array(sab, 0, VIDEO_META_INT32_LENGTH);
        this.slots = [
            new Uint8Array(sab, VIDEO_META_BYTES, VIDEO_SLOT_BYTES),
            new Uint8Array(sab, VIDEO_META_BYTES + VIDEO_SLOT_BYTES, VIDEO_SLOT_BYTES),
        ];
    }
    hasFrame() {
        return (Atomics.load(this.meta, META_FLAGS) & FLAG_PRESENT) !== 0;
    }
    /**
     * Devuelve un snapshot SOLO si hay un frame nuevo desde la última lectura.
     * El `view` apunta directamente al SAB — el caller debe copiar a memoria
     * propia antes de pasarlo a APIs que requieran un buffer no-shared (ej.
     * `new ImageData(...)` no acepta SharedArrayBuffer; usar `imageData.data.set(view)`).
     */
    readIfChanged() {
        const seq = Atomics.load(this.meta, META_PRODUCER_SEQ);
        if (seq === this._lastSeenSeq)
            return null;
        this._lastSeenSeq = seq;
        const slot = Atomics.load(this.meta, META_ACTIVE_SLOT);
        const width = Atomics.load(this.meta, META_WIDTH);
        const height = Atomics.load(this.meta, META_HEIGHT);
        const tickId = Atomics.load(this.meta, META_FRAME_TICK_ID);
        if (width <= 0 || height <= 0)
            return null;
        const bytes = width * height * 4;
        const view = this.slots[slot].subarray(0, bytes);
        // Mark as consumed (informational — does not block writer)
        Atomics.store(this.meta, META_CONSUMER_SEQ, seq);
        return { view, width, height, tickId, producerSeq: seq };
    }
    /** Salta el siguiente frame como "ya visto" (útil tras attach). */
    resync() {
        this._lastSeenSeq = Atomics.load(this.meta, META_PRODUCER_SEQ);
    }
}
