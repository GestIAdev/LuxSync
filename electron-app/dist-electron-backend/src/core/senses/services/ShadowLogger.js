/**
 * 👻 WAVE 2172 / WAVE 3504-EXT.5 — ShadowLogger
 *
 * Servicio de captura de telemetría offline para auditoría de BPM.
 *
 * Registra ~46 segundos de datos reales del pipeline de audio (1000 frames)
 * mientras el DJ pincha, y los vuelca a disco una sola vez. El dump resultante
 * es consumido por el test offline `IntervalBPMTracker.livedata.test.ts`
 * que reproduce la señal exacta en 50ms sin levantar un Worker.
 *
 * Datos capturados por frame:
 *   timestampMs   — clock musical determinista (WAVE 2307)
 *   rawLowFlux    — onset sub-bass (20-60Hz rising edge)
 *   rawMidFlux    — onset mid-range (250-2kHz rising edge)
 *   rawBassFlux   — onset bass completo (rawLowFlux + bassOnlyFlux)
 *   centroid      — centroide espectral en Hz
 *   needle        — valor final del Gated Needle fed al IntervalBPMTracker
 *
 * Ciclo de vida:
 *   record()  — añade un frame al buffer (no-op después del dump)
 *   reset()   — reactiva la captura (para uso tras un RESET_PACEMAKER)
 *   isDone()  — true cuando el dump ya se realizó
 *
 * Worker-agnostic: puede instanciarse sin Worker Thread activo.
 * El dump a disco usa require() dinámico — solo se ejecuta UNA VEZ.
 */
// ============================================
// CONSTANTES
// ============================================
/** Número de frames a capturar (~46s a ~21ms/frame con FFT de 2048 @ 44100Hz). */
const MAX_SHADOW_FRAMES = 1000;
/** Ruta del fichero de dump relativa al cwd (electron-app/). */
const DUMP_RELATIVE_PATH = 'test-data/live_audio_dump.json';
// ============================================
// ShadowLogger
// ============================================
/**
 * Servicio de captura de telemetría offline de BPM.
 *
 * Extrae la lógica del `shadowLog` + `shadowDumped` que vivía inline en
 * processAudioBuffer() de senses.ts (WAVE 2172).
 *
 * Zero-cost después del dump: `record()` hace un early-return cuando
 * `_dumped === true`. No hay timers ni setInterval internos.
 */
export class ShadowLogger {
    constructor() {
        this._log = [];
        this._dumped = false;
    }
    /**
     * Registra un frame de telemetría.
     * No-op después del dump. No-op si ya se alcanzaron MAX_SHADOW_FRAMES.
     */
    record(frame) {
        if (this._dumped)
            return;
        if (this._log.length >= MAX_SHADOW_FRAMES) {
            this._dump();
            return;
        }
        this._log.push(frame);
        if (this._log.length === MAX_SHADOW_FRAMES) {
            this._dump();
        }
    }
    /**
     * Reactiva la captura (útil tras RESET_PACEMAKER / cambio de fuente de audio).
     * No borra los frames anteriores — el log es acumulativo para la supervivencia
     * del archivo en disco; solo reinicia el flag de dump si el archivo ya existía.
     *
     * Para resetear completamente, crear una nueva instancia.
     */
    reset() {
        this._log.length = 0;
        this._dumped = false;
    }
    /** true cuando el dump ya se escribió a disco. */
    isDone() {
        return this._dumped;
    }
    /** Número de frames registrados hasta ahora. */
    get frameCount() {
        return this._log.length;
    }
    // ============================================
    // PRIVADO
    // ============================================
    /**
     * Escribe el log a disco UNA SOLA VEZ.
     * Usa require() dinámico para evitar imports estáticos de Node fs/path
     * que romperían la carga en entornos no-Node (tests de vitest browser mode, etc.)
     */
    _dump() {
        if (this._dumped)
            return;
        this._dumped = true;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const path = require('path');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            const dumpPath = path.join(process.cwd(), DUMP_RELATIVE_PATH);
            fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
            fs.writeFileSync(dumpPath, JSON.stringify(this._log, null, 2));
            console.log(`[SHADOW LOGGER] 🎯 DUMP COMPLETE: ${MAX_SHADOW_FRAMES} frames → ${dumpPath}`);
        }
        catch (e) {
            console.error('[SHADOW LOGGER] ❌ Dump failed:', e);
        }
    }
}
