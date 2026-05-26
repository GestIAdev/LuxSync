// ════════════════════════════════════════════════════════════════════════════
// 🎬 WAVE 4867 — THEIA THUMB BUFFER
// ════════════════════════════════════════════════════════════════════════════
//
//  SharedArrayBuffer minúsculo (64×64 RGBA8 = 16 384 bytes + 8 bytes de meta)
//  dedicado al downscale de THETA. Producer = theta.worker.ts,
//  Consumer = TheiaVideoRenderer (hilo principal / TitanOrchestrator hot-path).
//
//  Layout (Int32Array de 4 slots al inicio, luego Uint8Array de 64×64×4):
//    [0] seq      — producer escribe, consumer detecta novedad
//    [1] active   — 1 = hay frame válido, 0 = sin datos todavía
//    [2] width    — siempre THUMB_W (presente para self-description)
//    [3] height   — siempre THUMB_H
//    [4..N] RGBA8 pixels — 64*64*4 = 16 384 bytes
//
//  La única operación atómica necesaria es un CAS/store en `seq` por el
//  productor y una lectura en el consumidor. El buffer es SPSC.
// ════════════════════════════════════════════════════════════════════════════
export const THUMB_W = 64;
export const THUMB_H = 64;
export const THUMB_PIXELS = THUMB_W * THUMB_H;
export const THUMB_RGBA_BYTES = THUMB_PIXELS * 4;
/** Número de Int32 de metadatos al inicio del SAB. */
const META_INTS = 4;
/** Byte-offset donde empiezan los pixels (después de los 4 Int32 = 16 bytes). */
const PIXEL_OFFSET = META_INTS * Int32Array.BYTES_PER_ELEMENT;
/** Tamaño total del SAB en bytes. */
export const THUMB_SAB_BYTE_LENGTH = PIXEL_OFFSET + THUMB_RGBA_BYTES;
// Índices en el Int32Array de meta
const META_SEQ = 0;
const META_ACTIVE = 1;
const META_W = 2;
const META_H = 3;
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Asigna un nuevo SAB del tamaño correcto e inicializa los metadatos.
 */
export function createThumbSAB() {
    const sab = new SharedArrayBuffer(THUMB_SAB_BYTE_LENGTH);
    const meta = new Int32Array(sab);
    Atomics.store(meta, META_SEQ, 0);
    Atomics.store(meta, META_ACTIVE, 0);
    Atomics.store(meta, META_W, THUMB_W);
    Atomics.store(meta, META_H, THUMB_H);
    return sab;
}
// ─────────────────────────────────────────────────────────────────────────────
// Producer (theta.worker.ts — puede correr en un Web Worker)
// ─────────────────────────────────────────────────────────────────────────────
export class ThumbFrameWriter {
    constructor(sab) {
        if (sab.byteLength < THUMB_SAB_BYTE_LENGTH) {
            throw new RangeError(`ThumbFrameWriter: SAB too small (${sab.byteLength} < ${THUMB_SAB_BYTE_LENGTH})`);
        }
        this._meta = new Int32Array(sab);
        this._pixels = new Uint8ClampedArray(sab, PIXEL_OFFSET, THUMB_RGBA_BYTES);
    }
    /**
     * Copia los pixels del 64×64 downscale al SAB e incrementa seq.
     * Zero-alloc: `data` es el Uint8ClampedArray del getImageData().
     */
    publish(data) {
        // Escribir datos primero, luego bump seq atómico (release fence implícito en V8).
        this._pixels.set(data.length > THUMB_RGBA_BYTES ? data.subarray(0, THUMB_RGBA_BYTES) : data);
        Atomics.store(this._meta, META_ACTIVE, 1);
        // Incremento secuencial monotónico — el consumer detecta novedad comparando seq.
        Atomics.add(this._meta, META_SEQ, 1);
    }
    /** Marca el buffer como inactivo (p.ej. al parar el worker). */
    clear() {
        Atomics.store(this._meta, META_ACTIVE, 0);
        this._pixels.fill(0);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Consumer (hilo principal / TitanOrchestrator hot-path)
// ─────────────────────────────────────────────────────────────────────────────
export class ThumbFrameReader {
    constructor(sab) {
        this._lastSeq = -1;
        if (sab.byteLength < THUMB_SAB_BYTE_LENGTH) {
            throw new RangeError(`ThumbFrameReader: SAB too small (${sab.byteLength} < ${THUMB_SAB_BYTE_LENGTH})`);
        }
        this._meta = new Int32Array(sab);
        this._pixels = new Uint8ClampedArray(sab, PIXEL_OFFSET, THUMB_RGBA_BYTES);
    }
    /** Dimensiones declaradas por el productor. */
    get width() { return Atomics.load(this._meta, META_W); }
    get height() { return Atomics.load(this._meta, META_H); }
    /** True si el productor ha publicado al menos un frame. */
    get hasData() { return Atomics.load(this._meta, META_ACTIVE) === 1; }
    /**
     * Devuelve los pixels si hay un frame NUEVO desde la última lectura,
     * de lo contrario `null` (sin copia extra).
     *
     * El caller NO debe retener la referencia entre ticks: apunta al SAB
     * compartido y puede ser sobreescrita por el producer en cualquier momento.
     * Copia a un buffer propio antes del próximo tick si necesitas persistencia.
     */
    readIfNew() {
        const seq = Atomics.load(this._meta, META_SEQ);
        if (seq === this._lastSeq)
            return null;
        if (Atomics.load(this._meta, META_ACTIVE) !== 1)
            return null;
        this._lastSeq = seq;
        return this._pixels;
    }
    /**
     * Fuerza lectura aunque no haya frame nuevo (útil para el primer tick
     * después de conectar el reader).
     */
    readLatest() {
        if (Atomics.load(this._meta, META_ACTIVE) !== 1)
            return null;
        this._lastSeq = Atomics.load(this._meta, META_SEQ);
        return this._pixels;
    }
    /** Resetea el cursor de seq para volver a recibir el frame actual como "nuevo". */
    resync() {
        this._lastSeq = -1;
    }
}
