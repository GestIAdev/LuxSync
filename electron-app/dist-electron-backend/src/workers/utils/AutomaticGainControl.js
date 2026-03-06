/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎚️ WAVE 670: AUTOMATIC GAIN CONTROL (AGC) - WORKER EDITION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * OPERATION CLEAN SIGNAL - Normalización de audio ANTES del FFT.
 *
 * PROBLEMA ORIGINAL (WAVE 94):
 * - MP3 de salsa → picos de 0.30 → luces apagadas
 * - WAV de dubstep → muro de 0.90 → luces siempre encendidas
 *
 * PROBLEMA NUEVO (WAVE 660 - Contextual God):
 * - Sin normalización de entrada, los Z-Scores son FICCIÓN MATEMÁTICA
 * - Garbage In, Garbage Out → AGC es BLOCKER para todo el sistema
 *
 * SOLUCIÓN:
 * - Peak Tracker aplicado al BUFFER RAW antes del FFT
 * - Normalización: buffer[i] = buffer[i] * (targetRMS / currentRMS)
 * - El FFT recibe señal consistente independiente de la fuente
 *
 * DIFERENCIA vs EnergyNormalizer:
 * - EnergyNormalizer: Normaliza VALORES de energía DESPUÉS del análisis
 * - AGC: Normaliza el BUFFER DE AUDIO ANTES del análisis
 * - AMBOS son necesarios, hacen cosas diferentes
 *
 * @author PunkOpus (WAVE 670)
 * @created 2026-01-16
 */
// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 1011.9: AGC RECALIBRATION
// ═══════════════════════════════════════════════════════════════════════════════
// ANTES: targetRMS=0.25 → Metallica con bass=0.05 (ABSURDO)
// El AGC atenuaba señales fuertes demasiado, matando la dinámica.
// 
// AHORA: targetRMS=0.50 → Permite que señales fuertes pasen con más fuerza
// También subimos minGain de 0.25 a 0.5 para no atenuar tanto
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_AGC_CONFIG = {
    targetRMS: 0.50, // 🔥 WAVE 1011.9: Subido de 0.25 a 0.50 (menos atenuación)
    peakDecay: 0.997, // Muy lento: ~3 segundos para caer 50%
    maxGain: 8.0, // Máximo 8x amplificación (24dB)
    minGain: 0.5, // 🔥 WAVE 1011.9: Subido de 0.25 a 0.5 (mínimo 50% de señal)
    warmupFrames: 60, // 1 segundo @ 60fps para calibrar
    noiseFloor: 0.005, // Debajo de esto = silencio, no amplificar
};
/**
 * 🎚️ AUTOMATIC GAIN CONTROL - BUFFER NORMALIZER
 *
 * Normaliza el buffer de audio ANTES del FFT para que
 * todas las fuentes entreguen niveles consistentes.
 */
export class AutomaticGainControl {
    constructor(config = {}) {
        /** Ganancia actual aplicada */
        this.currentGain = 1.0;
        /** Contador de frames para warmup */
        this.frameCount = 0;
        /** Último log frame (throttling) */
        this.lastLogFrame = 0;
        /** Rolling buffer para suavizar ganancia (evita pumping) */
        this.gainHistory = [];
        this.GAIN_SMOOTH_SIZE = 15; // ~250ms @ 60fps
        this.config = { ...DEFAULT_AGC_CONFIG, ...config };
        this.peakRMS = this.config.targetRMS; // Empezar en target
    }
    /**
     * 🎚️ PROCESO PRINCIPAL - Normaliza un buffer de audio in-place
     *
     * @param buffer - Float32Array de audio (se modifica in-place)
     * @returns Información del procesamiento para debug
     */
    processBuffer(buffer) {
        this.frameCount++;
        // ═══════════════════════════════════════════════════════════════════
        // PASO 1: CALCULAR RMS DEL BUFFER
        // ═══════════════════════════════════════════════════════════════════
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
            sumSquares += buffer[i] * buffer[i];
        }
        const inputRMS = Math.sqrt(sumSquares / buffer.length);
        // ═══════════════════════════════════════════════════════════════════
        // PASO 2: PEAK TRACKING (Subida instantánea, bajada lenta)
        // ═══════════════════════════════════════════════════════════════════
        if (inputRMS > this.peakRMS) {
            // Subida INSTANTÁNEA - track nuevos picos inmediatamente
            this.peakRMS = inputRMS;
        }
        else {
            // Bajada LENTA - decay exponencial para adaptarse a canciones silenciosas
            this.peakRMS *= this.config.peakDecay;
        }
        // Floor: No bajar del noise floor
        this.peakRMS = Math.max(this.config.noiseFloor, this.peakRMS);
        // ═══════════════════════════════════════════════════════════════════
        // PASO 3: CALCULAR GANANCIA
        // ═══════════════════════════════════════════════════════════════════
        let targetGain = 1.0;
        // Solo calcular ganancia si hay señal válida
        if (inputRMS > this.config.noiseFloor) {
            // Ganancia = targetRMS / peakRMS
            // Si peak es bajo, subimos ganancia. Si es alto, la bajamos.
            targetGain = this.config.targetRMS / this.peakRMS;
        }
        // Clamear ganancia a límites seguros
        targetGain = Math.max(this.config.minGain, Math.min(this.config.maxGain, targetGain));
        // ═══════════════════════════════════════════════════════════════════
        // PASO 4: SUAVIZAR GANANCIA (anti-pumping)
        // ═══════════════════════════════════════════════════════════════════
        this.gainHistory.push(targetGain);
        if (this.gainHistory.length > this.GAIN_SMOOTH_SIZE) {
            this.gainHistory.shift();
        }
        // Media móvil para suavizar cambios de ganancia
        const smoothedGain = this.gainHistory.reduce((a, b) => a + b, 0) / this.gainHistory.length;
        // ═══════════════════════════════════════════════════════════════════
        // PASO 5: WARMUP INTERPOLATION
        // ═══════════════════════════════════════════════════════════════════
        const isWarmingUp = this.frameCount < this.config.warmupFrames;
        const warmupFactor = Math.min(1, this.frameCount / this.config.warmupFrames);
        // Durante warmup, interpolar entre gain=1.0 y gain calculada
        this.currentGain = 1.0 * (1 - warmupFactor) + smoothedGain * warmupFactor;
        // ═══════════════════════════════════════════════════════════════════
        // PASO 6: APLICAR GANANCIA AL BUFFER (in-place)
        // ═══════════════════════════════════════════════════════════════════
        if (inputRMS > this.config.noiseFloor) {
            for (let i = 0; i < buffer.length; i++) {
                buffer[i] *= this.currentGain;
                // Soft clipping para evitar distorsión
                if (buffer[i] > 1.0)
                    buffer[i] = 1.0;
                if (buffer[i] < -1.0)
                    buffer[i] = -1.0;
            }
        }
        // Calcular RMS de salida para verificación
        let sumSquaresOut = 0;
        for (let i = 0; i < buffer.length; i++) {
            sumSquaresOut += buffer[i] * buffer[i];
        }
        const outputRMS = Math.sqrt(sumSquaresOut / buffer.length);
        // ═══════════════════════════════════════════════════════════════════
        // PASO 7: LOGGING DIAGNÓSTICO (throttled)
        // ═══════════════════════════════════════════════════════════════════
        if (this.frameCount - this.lastLogFrame >= 60) {
            this.lastLogFrame = this.frameCount;
            console.log(`[AGC 🎚️] Gain: ${this.currentGain.toFixed(2)}x | ` +
                `In: ${inputRMS.toFixed(3)} → Out: ${outputRMS.toFixed(3)} | ` +
                `Peak: ${this.peakRMS.toFixed(3)} | ` +
                `${isWarmingUp ? '⏳ WARMUP' : '✅ ACTIVE'}`);
        }
        return {
            gainFactor: this.currentGain,
            inputRMS,
            outputRMS,
            maxPeak: this.peakRMS,
            isWarmingUp,
            frameCount: this.frameCount,
        };
    }
    /**
     * 🔄 RESET - Llamar cuando cambia la fuente de audio
     */
    reset() {
        this.peakRMS = this.config.targetRMS;
        this.currentGain = 1.0;
        this.frameCount = 0;
        this.gainHistory = [];
        console.log('[AGC 🎚️] 🔄 RESET: Ready for new audio source');
    }
    /**
     * 📊 GET STATE - Para telemetría/debug
     */
    getState() {
        return {
            gainFactor: this.currentGain,
            peakRMS: this.peakRMS,
            frameCount: this.frameCount,
            isWarmedUp: this.frameCount >= this.config.warmupFrames,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON PATTERN - Para uso global en el Worker
// ═══════════════════════════════════════════════════════════════════════════════
let agcInstance = null;
/**
 * 🎚️ GET AGC INSTANCE
 * Retorna la instancia singleton del AGC.
 */
export function getAGC() {
    if (!agcInstance) {
        agcInstance = new AutomaticGainControl();
    }
    return agcInstance;
}
/**
 * 🔄 RESET AGC
 * Resetea el AGC (útil para cambio de canción/fuente).
 */
export function resetAGC() {
    if (agcInstance) {
        agcInstance.reset();
    }
}
