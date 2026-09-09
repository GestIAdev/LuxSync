import { CHANNELS_PER_UNI, DMX_DATA_BYTES, DMX_HEADER_BYTES, DMX_HEADER_I32, DMX_SAB_BYTES, } from './layout';
/**
 * Escritor del DMX_UNIVERSE_SAB.
 * Vive en el Main Process (Node.js).
 * Único escritor; múltiples lectores permitidos.
 */
export class DmxUniverseWriter {
    constructor(sab) {
        if (sab.byteLength < DMX_SAB_BYTES) {
            throw new RangeError(`DmxUniverseWriter: SAB demasiado pequeño. Mínimo ${DMX_SAB_BYTES} bytes, ` +
                `recibido ${sab.byteLength}.`);
        }
        this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32);
        this.u8 = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES);
    }
    /** Retorna el valor actual del seqlock (diagnóstico / tests). */
    peekSeqlock() {
        return Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
    }
    /**
     * Escribe de forma atómica (seqlock) un frame DMX en la memoria compartida.
     *
     * @param frameId Identificador monotónico del frame.
     * @param universes Array de Uint8Array con los universos a volcar.
     * @param maskLo   Máscara de 32 bits para universos 0–30.
     * @param maskHi   Máscara de 32 bits para universes 31–63.
     */
    commitFrame(frameId, universes, maskLo, maskHi) {
        // 1. Iniciar escritura: incrementar SEQLOCK a impar
        const seqlockBefore = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
        Atomics.add(this.i32, 0 /* DmxHdr.SEQLOCK */, 1);
        const seqlockAfterStart = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
        // 🚨 WAVE 7750.1: Verificar que el SEQLOCK sea ahora impar
        if ((seqlockAfterStart & 1) === 0) {
            console.error(`🚨 DMX WRITER SEQLOCK ERROR: expected odd after Atomics.add(1), got ${seqlockAfterStart}. Before: ${seqlockBefore}. Binary error in mask logic?`);
        }
        // 2. Volcar datos binarios — P1: Bitwise mask-driven iteration.
        //    Only write universes whose bit is set in maskLo/maskHi.
        //    maskLo: bits 0-30 → universes 0-30
        let mLo = maskLo >>> 0;
        let loMissing = 0;
        while (mLo !== 0) {
            const i = Math.clz32(mLo & -mLo) ^ 31;
            const uBuf = universes[i];
            if (!uBuf) {
                loMissing++; // Cuenta cuantos universos faltantes
            }
            else {
                this.u8.set(uBuf, i * CHANNELS_PER_UNI);
            }
            mLo &= mLo - 1;
        }
        if (loMissing > 0) {
            console.warn(`⚠️ DMX WRITER: ${loMissing} universes in maskLo were undefined. Stale data will remain in SAB.`);
        }
        //    maskHi: bits 0-31 → universes 31-62
        let mHi = maskHi >>> 0;
        let hiMissing = 0;
        while (mHi !== 0) {
            const i = Math.clz32(mHi & -mHi) ^ 31;
            const u = i + 31;
            const uBuf = universes[u];
            if (!uBuf) {
                hiMissing++; // Cuenta cuantos universos faltantes
            }
            else {
                this.u8.set(uBuf, u * CHANNELS_PER_UNI);
            }
            mHi &= mHi - 1;
        }
        if (hiMissing > 0) {
            console.warn(`⚠️ DMX WRITER: ${hiMissing} universes in maskHi were undefined. Stale data will remain in SAB.`);
        }
        // 3. Actualizar metadata del header
        this.i32[1 /* DmxHdr.FRAME_ID */] = frameId;
        this.i32[2 /* DmxHdr.UNIVERSE_MASK */] = maskLo;
        this.i32[3 /* DmxHdr.UNIVERSE_MASK_HI */] = maskHi;
        // 4. Finalizar escritura: incrementar SEQLOCK a par
        Atomics.add(this.i32, 0 /* DmxHdr.SEQLOCK */, 1);
        const seqlockAfterEnd = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
        // 🚨 WAVE 7750.1: Verificar que el SEQLOCK sea ahora par
        if ((seqlockAfterEnd & 1) !== 0) {
            console.error(`🚨 DMX WRITER SEQLOCK ERROR: expected even after final Atomics.add(1), got ${seqlockAfterEnd}. After-start was ${seqlockAfterStart}. CRITICAL STATE.`);
        }
        // 5. Despertar a los workers que estén bloqueados esperando
        Atomics.notify(this.i32, 0 /* DmxHdr.SEQLOCK */);
    }
}
/**
 * Lector del DMX_UNIVERSE_SAB.
 * Vive en el DMX Phantom Worker (worker_thread).
 */
export class DmxUniverseReader {
    constructor(sab) {
        this.scratch = new Uint8Array(DMX_DATA_BYTES);
        if (sab.byteLength < DMX_SAB_BYTES) {
            throw new RangeError(`DmxUniverseReader: SAB demasiado pequeño. Mínimo ${DMX_SAB_BYTES} bytes, ` +
                `recibido ${sab.byteLength}.`);
        }
        this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32);
        this.u8 = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES);
    }
    /** Retorna el valor actual del seqlock (diagnóstico / tests). */
    peekSeqlock() {
        return Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
    }
    /** Lee solo la cabecera sin copiar datos de universo. */
    peekHeader() {
        const hdr = this.i32;
        return {
            frameId: hdr[1 /* DmxHdr.FRAME_ID */],
            activeUnis: hdr[4 /* DmxHdr.ACTIVE_UNIS */],
            maskLo: hdr[2 /* DmxHdr.UNIVERSE_MASK */],
            maskHi: hdr[3 /* DmxHdr.UNIVERSE_MASK_HI */],
        };
    }
    /**
     * Lee el snapshot si el seqlock está en estado estable.
     * Retorna null inmediatamente si seqlock es impar (escritura en curso).
     * Útil para tests y para contextos donde el spin no es aceptable.
     */
    tryReadIfStable(lastFrameId) {
        const s1 = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
        if ((s1 & 1) !== 0)
            return null;
        const frameId = this.i32[1 /* DmxHdr.FRAME_ID */];
        if (frameId === lastFrameId)
            return null;
        this.scratch.set(this.u8);
        const s2 = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
        if (s1 !== s2)
            return null;
        return { frameId, data: this.scratch };
    }
    /**
     * Lee un frame completo garantizando coherencia (evita el tearing).
     * Usa un scratch buffer interno preasignado (zero-allocation).
     * Devuelve null si no hay un frame nuevo o si se excede el límite de reintentos.
     *
     * NOTA DE VOLATILIDAD: `data` apunta al scratch buffer interno.
     * El caller debe consumir los datos antes de llamar readCoherent() nuevamente,
     * ya que la próxima llamada sobrescribirá el mismo buffer.
     *
     * 🚨 WAVE 7750.1: TELEMETRÍA DE EMERGENCIA — Detect SAB spinlock deadlocks
     */
    readCoherent(lastFrameId) {
        let s1 = 0;
        let s2 = -1;
        let frameId = 0;
        let retries = 0;
        let spinLoopCountOdd = 0; // Cuenta vueltas esperando que SEQLOCK sea par
        let spinLoopCountTear = 0; // Cuenta vueltas por tearing (s1 !== s2)
        do {
            s1 = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
            // Si es impar, el Main Process está escribiendo. Reintentamos.
            if ((s1 & 1) !== 0) {
                spinLoopCountOdd++;
                if (spinLoopCountOdd > 100) {
                    console.error(`🚨 DEADLOCK EN DMX READER: SEQLOCK=${s1} (impar), spinOdd=${spinLoopCountOdd} vueltas sin cambio. Main Process se quedó escribiendo sin liberar.`);
                }
                if (++retries > DmxUniverseReader.MAX_SEQLOCK_RETRIES) {
                    console.error(`🚨 SAB-DEADLOCK LIMIT EXCEEDED: retries=${retries}, spinOdd=${spinLoopCountOdd}, SEQLOCK stuck at ${s1}`);
                    return null;
                }
                s2 = -1; // Garantiza que s1 !== s2 para repetir el bucle
                continue;
            }
            // Capturar frameId DENTRO de la ventana seqlock válida (s1 es par aquí)
            frameId = this.i32[1 /* DmxHdr.FRAME_ID */];
            // Si el frame no ha cambiado, no copiamos nada.
            if (frameId === lastFrameId)
                return null;
            // Tomamos el snapshot atómico de los bytes en el buffer scratch
            this.scratch.set(this.u8);
            s2 = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
            // Si el seqlock cambió durante nuestra lectura, hubo tearing.
            if (s1 !== s2) {
                spinLoopCountTear++;
                if (spinLoopCountTear > 50) {
                    console.warn(`⚠️ DMX READER: Tearing detectado ${spinLoopCountTear} veces. s1=${s1}, s2=${s2}. Main puede estar escribiendo demasiado rápido.`);
                }
                if (++retries > DmxUniverseReader.MAX_SEQLOCK_RETRIES) {
                    console.error(`🚨 SAB-TEARING LIMIT: retries=${retries}, spinTear=${spinLoopCountTear}, última lectura: s1=${s1}, s2=${s2}`);
                    return null;
                }
            }
        } while (s1 !== s2);
        // frameId fue capturado dentro de la ventana seqlock validada.
        return { frameId, data: this.scratch };
    }
}
DmxUniverseReader.MAX_SEQLOCK_RETRIES = 64;
// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers — instanciación canónica del DMX SAB
// ─────────────────────────────────────────────────────────────────────────────
export function createDmxSab() {
    return new SharedArrayBuffer(DMX_SAB_BYTES);
}
let _dmxSab = null;
export function getDmxSab() {
    if (!_dmxSab)
        _dmxSab = createDmxSab();
    return _dmxSab;
}
