/**
 * 🎬 WAVE 4860 — THEIA FRAME CONTEXT RING
 *
 * Reloj maestro compartido vía SharedArrayBuffer entre el Main Process (donde
 * vive TrinityOrchestrator + NodeArbiter) y el ThetaWorker (renderer). El SAB
 * se crea UNA SOLA VEZ al arrancar TrinityOrchestrator y se transfiere por
 * referencia al renderer (vía IPC) y de ahí al Web Worker (vía postMessage).
 *
 * Uso clave: THETA NUNCA depende de eventos IPC asíncronos para conocer el
 * tick actual. Lee directamente con Atomics.load() en su propio loop a 44Hz.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Layout (4 × Int32 = 16 bytes):
 *   [0] tickId        → contador monotónico del NodeArbiter
 *   [1] timestampLo   → bits bajos de Date.now() (ms)
 *   [2] timestampHi   → bits altos de Date.now()
 *   [3] generation    → incrementado en cada escritura (lock-free change check)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Este módulo es ISOMORPHIC: corre tanto en Node (worker_threads) como en el
 * renderer y dentro del Web Worker. No depende de APIs específicas de cada
 * entorno — solo de SharedArrayBuffer + Int32Array + Atomics.
 */
export const FRAME_CONTEXT_BYTE_LENGTH = 16;
export const FRAME_CONTEXT_INT32_LENGTH = 4;
const SLOT_TICK_ID = 0;
const SLOT_TIMESTAMP_LO = 1;
const SLOT_TIMESTAMP_HI = 2;
const SLOT_GENERATION = 3;
/**
 * Crea un SharedArrayBuffer dimensionado para el FrameContext.
 * Se llama UNA sola vez en el Main Process al arrancar TrinityOrchestrator.
 */
export function createFrameContextSAB() {
    return new SharedArrayBuffer(FRAME_CONTEXT_BYTE_LENGTH);
}
/**
 * Writer — vive en el Main Process (TrinityOrchestrator).
 * Cada llamada a `advance()` publica un nuevo tick de forma atómica.
 */
export class FrameContextWriter {
    constructor(sab) {
        if (sab.byteLength < FRAME_CONTEXT_BYTE_LENGTH) {
            throw new Error(`[FrameContextWriter] SAB too small: ${sab.byteLength} < ${FRAME_CONTEXT_BYTE_LENGTH}`);
        }
        this.view = new Int32Array(sab);
    }
    /**
     * Publica un tick. Diseñado para llamarse desde el frame loop del NodeArbiter
     * (~44Hz / 23ms). Las cuatro escrituras son atómicas individuales; el slot
     * `generation` se actualiza al final como "barrera lógica" — el reader
     * que vea una generation nueva sabe que tickId/timestamp ya están escritos.
     */
    advance(tickId, timestampMs) {
        Atomics.store(this.view, SLOT_TICK_ID, tickId | 0);
        // 53-bit ms timestamp split into two 32-bit halves
        const ts = Math.floor(timestampMs);
        const lo = ts | 0;
        const hi = Math.floor(ts / 0x100000000) | 0;
        Atomics.store(this.view, SLOT_TIMESTAMP_LO, lo);
        Atomics.store(this.view, SLOT_TIMESTAMP_HI, hi);
        // generation last → publishing barrier
        const prevGen = Atomics.load(this.view, SLOT_GENERATION);
        Atomics.store(this.view, SLOT_GENERATION, (prevGen + 1) | 0);
    }
    /** Snapshot para diagnóstico desde el writer side. */
    read() {
        return readSnapshot(this.view);
    }
}
/**
 * Reader — vive en el ThetaWorker (renderer Web Worker) o en cualquier
 * consumidor que tenga acceso al mismo SAB.
 */
export class FrameContextReader {
    constructor(sab) {
        this._lastGeneration = 0;
        if (sab.byteLength < FRAME_CONTEXT_BYTE_LENGTH) {
            throw new Error(`[FrameContextReader] SAB too small: ${sab.byteLength} < ${FRAME_CONTEXT_BYTE_LENGTH}`);
        }
        this.view = new Int32Array(sab);
    }
    /** Lee el tickId actual sin más metadata. */
    getTickId() {
        return Atomics.load(this.view, SLOT_TICK_ID);
    }
    /** Snapshot completo (tickId + timestamp + generation). */
    read() {
        return readSnapshot(this.view);
    }
    /**
     * Devuelve el snapshot SOLO si la generation cambió desde la última lectura.
     * Útil para que el worker no procese el mismo tick dos veces si su poll es
     * más rápido que el writer.
     */
    readIfChanged() {
        const gen = Atomics.load(this.view, SLOT_GENERATION);
        if (gen === this._lastGeneration)
            return null;
        this._lastGeneration = gen;
        return readSnapshot(this.view);
    }
    /**
     * Salta la próxima lectura como "ya vista" — útil tras reconectar SAB
     * para evitar reprocesar un tick antiguo.
     */
    resync() {
        this._lastGeneration = Atomics.load(this.view, SLOT_GENERATION);
    }
}
function readSnapshot(view) {
    const tickId = Atomics.load(view, SLOT_TICK_ID);
    const lo = Atomics.load(view, SLOT_TIMESTAMP_LO) >>> 0;
    const hi = Atomics.load(view, SLOT_TIMESTAMP_HI);
    const generation = Atomics.load(view, SLOT_GENERATION);
    // Recompose 53-bit ms (lo is unsigned, hi is signed; combined fits in safe int range)
    const timestamp = hi * 0x100000000 + lo;
    return { tickId, timestamp, generation };
}
