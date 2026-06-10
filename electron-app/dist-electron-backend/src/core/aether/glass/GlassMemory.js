// ─────────────────────────────────────────────────────────────────────────────
// WAVE 6005 — GLASS MEMORY: Writers & Readers con SEQLOCK
//
// Protocolo SEQLOCK (lock-free, single-writer / multi-reader):
//   Escritor: Atomics.add(hdr, SEQLOCK, 1)  → impar (writing)
//             [escribe datos]
//             Atomics.add(hdr, SEQLOCK, 1)  → par   (stable)
//   Lector:   do { s1 = seqlock } while (s1 & 1)
//             [lee datos]
//             s2 = seqlock; if (s1 !== s2) → tearing, reintentar
//
// Zero-allocation en hot-path: todos los métodos write/read operan sobre
// vistas pre-asignadas. No se devuelven arrays nuevos desde el hot-path.
// ─────────────────────────────────────────────────────────────────────────────
import { DMX_HEADER_I32, DMX_HEADER_BYTES, DMX_SAB_BYTES, MAX_UNIVERSES, CHANNELS_PER_UNI, FIX_HEADER_I32, FIX_HEADER_BYTES, FIX_SAB_BYTES, FIX_DATA_FLOATS, MAX_FIXTURES, FLOATS_PER_FIX, } from './layout';
// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────
/** Espera activa hasta que el seqlock sea par (estado estable). */
function waitEven(hdr, slot) {
    let s;
    // En main thread / worker (JS single-threaded): el spin loop siempre sale
    // si el escritor opera en el mismo realm o el SAB fue escrito por otro thread.
    do {
        s = Atomics.load(hdr, slot);
    } while (s & 1);
    return s;
}
// ─────────────────────────────────────────────────────────────────────────────
// DMX Universe Buffer — WRITER
// ─────────────────────────────────────────────────────────────────────────────
export class DmxUniverseWriter {
    constructor(sab) {
        if (sab.byteLength < DMX_SAB_BYTES) {
            throw new RangeError(`DmxUniverseWriter: SAB demasiado pequeño. Mínimo ${DMX_SAB_BYTES} bytes, ` +
                `recibido ${sab.byteLength}.`);
        }
        this._hdr = new Int32Array(sab, 0, DMX_HEADER_I32);
        this._data = new Uint8Array(sab, DMX_HEADER_BYTES);
    }
    /**
     * Escribe uno o varios universos DMX en el buffer compartido.
     *
     * @param frameId   - ID secuencial del frame actual (Int32).
     * @param universes - Array de hasta MAX_UNIVERSES vistas Uint8Array,
     *                    cada una de exactamente CHANNELS_PER_UNI bytes.
     *                    Puede contener undefined/null para universos sin cambio.
     * @param timestamp - performance.now() o Date.now() del frame (ms).
     *
     * HOT-PATH: zero-allocation. Usa Uint8Array.set() y Atomics.
     */
    commitFrame(frameId, universes, timestamp) {
        const hdr = this._hdr;
        const data = this._data;
        // ── Abrir escritura (seqlock → impar) ────────────────────────────────
        Atomics.add(hdr, 0 /* DmxHdr.SEQLOCK */, 1);
        // ── Cabecera ──────────────────────────────────────────────────────────
        hdr[1 /* DmxHdr.FRAME_ID */] = frameId | 0;
        let maskLo = 0;
        let maskHi = 0;
        let activeCount = 0;
        const count = Math.min(universes.length, MAX_UNIVERSES);
        for (let u = 0; u < count; u++) {
            const uData = universes[u];
            if (uData == null)
                continue;
            data.set(uData, u * CHANNELS_PER_UNI);
            activeCount++;
            if (u < 32) {
                maskLo |= (1 << u);
            }
            else {
                maskHi |= (1 << (u - 32));
            }
        }
        hdr[2 /* DmxHdr.UNIVERSE_MASK */] = maskLo;
        hdr[3 /* DmxHdr.UNIVERSE_MASK_HI */] = maskHi;
        hdr[4 /* DmxHdr.ACTIVE_UNIS */] = activeCount;
        // Timestamp en dos Int32 (simulando BigInt split)
        const tsMs = timestamp | 0;
        hdr[5 /* DmxHdr.TIMESTAMP_LO */] = tsMs;
        hdr[6 /* DmxHdr.TIMESTAMP_HI */] = 0;
        // ── Cerrar escritura (seqlock → par) ──────────────────────────────────
        Atomics.add(hdr, 0 /* DmxHdr.SEQLOCK */, 1);
    }
    /** Retorna el valor actual del seqlock (diagnóstico / tests). */
    peekSeqlock() {
        return Atomics.load(this._hdr, 0 /* DmxHdr.SEQLOCK */);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// DMX Universe Buffer — READER
// ─────────────────────────────────────────────────────────────────────────────
export class DmxUniverseReader {
    constructor(sab) {
        if (sab.byteLength < DMX_SAB_BYTES) {
            throw new RangeError(`DmxUniverseReader: SAB demasiado pequeño. Mínimo ${DMX_SAB_BYTES} bytes, ` +
                `recibido ${sab.byteLength}.`);
        }
        this._hdr = new Int32Array(sab, 0, DMX_HEADER_I32);
        this._data = new Uint8Array(sab, DMX_HEADER_BYTES);
    }
    /**
     * Lee un snapshot coherente del universo DMX.
     *
     * @param destUniverse - Buffer pre-asignado de MAX_UNIVERSES × CHANNELS_PER_UNI
     *                       bytes donde se copiará el snapshot (zero-alloc).
     * @param lastFrameId  - Último frame procesado. Si el frame no cambió,
     *                       devuelve null para evitar trabajo inútil.
     * @returns frameId leído, o null si no hubo cambio desde lastFrameId.
     *
     * HOT-PATH: zero-allocation, spin-loop SEQLOCK garantiza coherencia.
     */
    readCoherent(destUniverse, lastFrameId) {
        const hdr = this._hdr;
        const data = this._data;
        let s1, s2;
        let frameId;
        do {
            // Esperar a que seqlock sea par (estado estable)
            s1 = waitEven(hdr, 0 /* DmxHdr.SEQLOCK */);
            frameId = hdr[1 /* DmxHdr.FRAME_ID */];
            // Optimización: si el frame no cambió, no leer datos
            if (frameId === lastFrameId)
                return null;
            destUniverse.set(data);
            // Verificar que no hubo tearing durante la lectura
            s2 = Atomics.load(hdr, 0 /* DmxHdr.SEQLOCK */);
        } while (s1 !== s2);
        return frameId;
    }
    /**
     * Lee el snapshot si el seqlock está en estado estable.
     * Retorna null inmediatamente si seqlock es impar (escritura en curso).
     * Útil para tests y para contextos donde el spin no es aceptable.
     */
    tryReadIfStable(destUniverse) {
        const hdr = this._hdr;
        const data = this._data;
        const s1 = Atomics.load(hdr, 0 /* DmxHdr.SEQLOCK */);
        if (s1 & 1)
            return null; // seqlock impar: escritura en curso
        const frameId = hdr[1 /* DmxHdr.FRAME_ID */];
        destUniverse.set(data);
        const s2 = Atomics.load(hdr, 0 /* DmxHdr.SEQLOCK */);
        if (s1 !== s2)
            return null; // tearing detectado
        return frameId;
    }
    /** Retorna el valor actual del seqlock (diagnóstico / tests). */
    peekSeqlock() {
        return Atomics.load(this._hdr, 0 /* DmxHdr.SEQLOCK */);
    }
    /** Lee solo la cabecera sin copiar datos de universo. */
    peekHeader() {
        const hdr = this._hdr;
        return {
            frameId: hdr[1 /* DmxHdr.FRAME_ID */],
            activeUnis: hdr[4 /* DmxHdr.ACTIVE_UNIS */],
            maskLo: hdr[2 /* DmxHdr.UNIVERSE_MASK */],
            maskHi: hdr[3 /* DmxHdr.UNIVERSE_MASK_HI */],
        };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Fixture State Buffer — WRITER
// ─────────────────────────────────────────────────────────────────────────────
export class FixtureStateWriter {
    constructor(sab) {
        if (sab.byteLength < FIX_SAB_BYTES) {
            throw new RangeError(`FixtureStateWriter: SAB demasiado pequeño. Mínimo ${FIX_SAB_BYTES} bytes, ` +
                `recibido ${sab.byteLength}.`);
        }
        this._hdr = new Int32Array(sab, 0, FIX_HEADER_I32);
        this._data = new Float32Array(sab, FIX_HEADER_BYTES, FIX_DATA_FLOATS);
    }
    /**
     * Escribe un snapshot completo del estado de fixtures.
     *
     * @param frameId   - ID secuencial del frame.
     * @param fixtureData - Float32Array de exactamente (count × FLOATS_PER_FIX) floats,
     *                    layout inline: [fixture0_R, fixture0_G, ..., fixture0_FLAGS,
     *                                    fixture1_R, ...]
     * @param count     - Número de fixtures contenidos en fixtureData.
     * @param timestamp - performance.now() o Date.now() (ms).
     *
     * HOT-PATH: zero-allocation, Float32Array.set().
     */
    commitFixtures(frameId, fixtureData, count, timestamp) {
        const hdr = this._hdr;
        const data = this._data;
        const clampedCount = Math.min(count, MAX_FIXTURES);
        // ── Abrir escritura ───────────────────────────────────────────────────
        Atomics.add(hdr, 0 /* FixHdr.SEQLOCK */, 1);
        hdr[1 /* FixHdr.FRAME_ID */] = frameId | 0;
        hdr[2 /* FixHdr.FIXTURE_COUNT */] = clampedCount;
        hdr[3 /* FixHdr.TIMESTAMP_LO */] = timestamp | 0;
        hdr[4 /* FixHdr.TIMESTAMP_HI */] = 0;
        const floatsToCopy = clampedCount * FLOATS_PER_FIX;
        data.set(fixtureData.subarray(0, floatsToCopy));
        // ── Cerrar escritura ──────────────────────────────────────────────────
        Atomics.add(hdr, 0 /* FixHdr.SEQLOCK */, 1);
    }
    /**
     * Actualiza un campo individual de un fixture sin SEQLOCK completo.
     * Útil para actualizaciones de un único canal (p.ej. dimmer override).
     * El llamador es responsable de abrir/cerrar el SEQLOCK si lo requiere.
     */
    writeFixtureField(fixtureIndex, field, value) {
        if (fixtureIndex < 0 || fixtureIndex >= MAX_FIXTURES)
            return;
        this._data[fixtureIndex * FLOATS_PER_FIX + field] = value;
    }
    /** Retorna el valor actual del seqlock (diagnóstico / tests). */
    peekSeqlock() {
        return Atomics.load(this._hdr, 0 /* FixHdr.SEQLOCK */);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Fixture State Buffer — READER
// ─────────────────────────────────────────────────────────────────────────────
export class FixtureStateReader {
    constructor(sab) {
        if (sab.byteLength < FIX_SAB_BYTES) {
            throw new RangeError(`FixtureStateReader: SAB demasiado pequeño. Mínimo ${FIX_SAB_BYTES} bytes, ` +
                `recibido ${sab.byteLength}.`);
        }
        this._hdr = new Int32Array(sab, 0, FIX_HEADER_I32);
        this._data = new Float32Array(sab, FIX_HEADER_BYTES, FIX_DATA_FLOATS);
    }
    /**
     * Lee un snapshot coherente del estado de fixtures.
     *
     * @param destFixtures - Float32Array pre-asignado de MAX_FIXTURES × FLOATS_PER_FIX
     *                       floats. Se copia el snapshot en él (zero-alloc).
     * @param lastFrameId  - Último frame procesado. Devuelve null si sin cambio.
     * @returns frameId leído y count de fixtures, o null si no hubo cambio.
     */
    readCoherent(destFixtures, lastFrameId) {
        const hdr = this._hdr;
        const data = this._data;
        let s1, s2;
        let frameId;
        let count;
        do {
            s1 = waitEven(hdr, 0 /* FixHdr.SEQLOCK */);
            frameId = hdr[1 /* FixHdr.FRAME_ID */];
            if (frameId === lastFrameId)
                return null;
            count = hdr[2 /* FixHdr.FIXTURE_COUNT */];
            const floatsToCopy = Math.min(count, MAX_FIXTURES) * FLOATS_PER_FIX;
            destFixtures.set(data.subarray(0, floatsToCopy));
            s2 = Atomics.load(hdr, 0 /* FixHdr.SEQLOCK */);
        } while (s1 !== s2);
        return { frameId, count };
    }
    /**
     * Lee el campo individual de un fixture sin copiar el buffer completo.
     * No tiene protección SEQLOCK — úsalo solo para lecturas tolerantes a tearing.
     */
    readFixtureField(fixtureIndex, field) {
        if (fixtureIndex < 0 || fixtureIndex >= MAX_FIXTURES)
            return 0;
        return this._data[fixtureIndex * FLOATS_PER_FIX + field];
    }
    /**
     * Lee si el seqlock es estable. Retorna null si impar (escritura en curso).
     * Útil para tests y contextos sin spin loop.
     */
    tryReadIfStable(destFixtures) {
        const hdr = this._hdr;
        const data = this._data;
        const s1 = Atomics.load(hdr, 0 /* FixHdr.SEQLOCK */);
        if (s1 & 1)
            return null;
        const frameId = hdr[1 /* FixHdr.FRAME_ID */];
        const count = hdr[2 /* FixHdr.FIXTURE_COUNT */];
        const floatsToCopy = Math.min(count, MAX_FIXTURES) * FLOATS_PER_FIX;
        destFixtures.set(data.subarray(0, floatsToCopy));
        const s2 = Atomics.load(hdr, 0 /* FixHdr.SEQLOCK */);
        if (s1 !== s2)
            return null;
        return { frameId, count };
    }
    /** Retorna el valor actual del seqlock (diagnóstico / tests). */
    peekSeqlock() {
        return Atomics.load(this._hdr, 0 /* FixHdr.SEQLOCK */);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers — instanciación canónica de los SABs
// ─────────────────────────────────────────────────────────────────────────────
/** Crea un SharedArrayBuffer del tamaño exacto para DMX_UNIVERSE_SAB. */
export function createDmxSab() {
    return new SharedArrayBuffer(DMX_SAB_BYTES);
}
/** Crea un SharedArrayBuffer del tamaño exacto para FIXTURE_STATE_SAB. */
export function createFixtureSab() {
    return new SharedArrayBuffer(FIX_SAB_BYTES);
}
// WAVE 6010 PATCH 2a: Singleton canónico del DMX_UNIVERSE_SAB compartido
// entre DmxUniverseWriter (TickEngine) y dmxPhantomWorker (worker_thread).
let _dmxSab = null;
export function getDmxSab() {
    if (!_dmxSab)
        _dmxSab = createDmxSab();
    return _dmxSab;
}
