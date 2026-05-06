/**
 * ⚡ WAVE 3504-EXT.3 — PsychoacousticScaler
 *
 * Puro. Sin estado. Sin side-effects.
 * Funciones de transferencia dB → lineal para escalar bandas a rango [0,1]
 * compatible con WebAudio AnalyserNode byte scaling.
 *
 * Extraído de senses.ts (WAVE 3431 TRUE WEBAUDIO POLYFILL).
 * El Worker sigue usando sus constantes locales — este módulo se
 * convierte en la fuente de verdad que SpectrumAnalyzer consumirá.
 *
 * Sin dependencia de parentPort, IPC, SharedRingBuffer ni Worker Thread.
 */
// ============================================
// WAVE 3431: WebAudio AnalyserNode-compatible scaling
// Mapea magnitudes lineales del FFT al mismo rango [0..1] que
// AnalyserNode.getByteFrequencyData produce con minDecibels/maxDecibels.
// ============================================
const W3431_MIN_DB = 0;
const W3431_MAX_DB = 8;
const W3431_OUTPUT_SCALE = 2.5;
/**
 * Clamp genérico — sin dependencia de ningún módulo externo.
 */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/**
 * Convierte una magnitud lineal (salida del FFT) a nivel normalizado [0, ~1]
 * compatible con el escalado perceptual de WebAudio AnalyserNode.
 *
 * Pipeline:
 *   1. Protección contra log(0): safeMag = max(0, linearMagnitude)
 *   2. dB = 20 * log10(safeMag + 1)          ← +1 para evitar log(0)
 *   3. Normalización lineal en [MIN_DB, MAX_DB]
 *   4. Clamp [0, 1]
 *   5. Escala de salida × OUTPUT_SCALE         ← equipara al byte range de WebAudio
 *
 * @param linearMagnitude  Magnitud lineal del bin FFT (salida del GodEarAnalyzer)
 * @returns                Nivel en rango [0, OUTPUT_SCALE] (típico ~[0..1])
 */
export function toWebAudioScaledLevel(linearMagnitude) {
    const safeMag = Math.max(0, linearMagnitude);
    const db = 20 * Math.log10(safeMag + 1);
    const scaledPreClamp = (db - W3431_MIN_DB) / (W3431_MAX_DB - W3431_MIN_DB);
    const scaledClamped = clamp(scaledPreClamp, 0, 1);
    return scaledClamped * W3431_OUTPUT_SCALE;
}
/**
 * Aplica el escalado psicoacústico a cada campo de un objeto de bandas.
 * Devuelve un nuevo objeto — no muta el original.
 *
 * @param rawBands  Objeto con campos subBass, bass, lowMid, mid, highMid, treble
 *                  (magnitudes lineales del legacy converter GodEar)
 */
export function scaleBandsToWebAudio(rawBands) {
    return {
        subBass: toWebAudioScaledLevel(rawBands.subBass),
        bass: toWebAudioScaledLevel(rawBands.bass),
        lowMid: toWebAudioScaledLevel(rawBands.lowMid),
        mid: toWebAudioScaledLevel(rawBands.mid),
        highMid: toWebAudioScaledLevel(rawBands.highMid),
        treble: toWebAudioScaledLevel(rawBands.treble),
    };
}
