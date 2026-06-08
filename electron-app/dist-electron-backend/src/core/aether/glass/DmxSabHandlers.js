import { CHANNELS_PER_UNI, DMX_DATA_BYTES, DMX_HEADER_BYTES, DMX_HEADER_I32 } from './layout';
/**
 * Escritor del DMX_UNIVERSE_SAB.
 * Vive en el Main Process (Node.js).
 * Único escritor; múltiples lectores permitidos.
 */
export class DmxUniverseWriter {
    constructor(sab) {
        this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32);
        this.u8 = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES);
    }
    /**
     * Escribe de forma atómica (seqlock) un frame DMX en la memoria compartida.
     *
     * @param frameId Identificador monotónico del frame.
     * @param universes Array de Uint8Array con los universos a volcar.
     * @param dirtyMask Máscara de 64 bits indicando qué universos cambiaron.
     */
    commitFrame(frameId, universes, dirtyMask) {
        // 1. Iniciar escritura: incrementar SEQLOCK a impar
        Atomics.add(this.i32, 0 /* DmxHdr.SEQLOCK */, 1);
        // 2. Volcar datos binarios (zero-allocation)
        for (let u = 0; u < universes.length; u++) {
            this.u8.set(universes[u], u * CHANNELS_PER_UNI);
        }
        // 3. Actualizar metadata del header
        this.i32[1 /* DmxHdr.FRAME_ID */] = frameId;
        this.i32[2 /* DmxHdr.UNIVERSE_MASK */] = Number(dirtyMask & BigInt(0xffffffff));
        this.i32[3 /* DmxHdr.UNIVERSE_MASK_HI */] = Number(dirtyMask >> BigInt(32));
        // 4. Finalizar escritura: incrementar SEQLOCK a par
        Atomics.add(this.i32, 0 /* DmxHdr.SEQLOCK */, 1);
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
        this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32);
        this.u8 = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES);
    }
    /**
     * Lee un frame completo garantizando coherencia (evita el tearing).
     * Usa un scratch buffer interno preasignado (zero-allocation).
     * Devuelve null si no hay un frame nuevo.
     */
    readCoherent(lastFrameId) {
        let s1 = 0;
        let s2 = -1;
        do {
            s1 = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
            // Si es impar, el Main Process está escribiendo. Reintentamos.
            if ((s1 & 1) !== 0) {
                s2 = -1; // Garantiza que s1 !== s2 para repetir el bucle
                continue;
            }
            const frameId = this.i32[1 /* DmxHdr.FRAME_ID */];
            // Si el frame no ha cambiado, no copiamos nada.
            if (frameId === lastFrameId)
                return null;
            // Tomamos el snapshot atómico de los 25.600 bytes en el buffer scratch
            this.scratch.set(this.u8);
            s2 = Atomics.load(this.i32, 0 /* DmxHdr.SEQLOCK */);
            // Si el seqlock cambió durante nuestra lectura, hubo una re-escritura simultánea (tearing).
            // El do-while se repite.
        } while (s1 !== s2);
        return { frameId: this.i32[1 /* DmxHdr.FRAME_ID */], data: this.scratch };
    }
}
