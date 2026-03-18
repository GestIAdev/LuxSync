// ═══════════════════════════════════════════════════════════════════════════
//  📊 ROLLING STATS - Estadísticas Rodantes en Tiempo Real
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 664 - CONTEXTUAL MEMORY - PHASE 1
//  "La matemática que detecta lo extraordinario en lo ordinario"
// ═══════════════════════════════════════════════════════════════════════════
import { CircularBuffer } from './CircularBuffer';
const DEFAULT_CONFIG = {
    windowSize: 300, // ~5 segundos a 60fps
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔬 WAVE 1181.1: Z-SCORE FLOOR FIX
    // 🔬 WAVE 2185: RECALIBRATED — 0.08 → 0.05
    // ═══════════════════════════════════════════════════════════════════════════
    // PROBLEMA ORIGINAL (1181.1): Durante breakdowns con poca variación
    // (stdDev real = 0.02), cualquier pico moderado se convierte en Z=9σ.
    //
    // WAVE 2185 REFINAMIENTO: 0.08 era demasiado agresivo como floor.
    // En minimal techno, la variación natural real de energía es ~5-8%.
    // Con floor=0.08, estábamos APLASTANDO señales legítimas de Z=3-4σ
    // porque el floor era más alto que la stdDev real del género.
    //
    // 0.05 = sweet spot:
    //   - Máximo Z teórico = (1.0 - 0.1) / 0.05 = 18σ (extremo, irreal)
    //   - Z típico en drop real = (0.7 - 0.3) / 0.05 = 8σ (filtrado por DIVINE_THRESHOLD=4.0)
    //   - Z en micro-valley = (0.35 - 0.30) / 0.05 = 1σ (ignorado correctamente)
    // ═══════════════════════════════════════════════════════════════════════════
    minStdDev: 0.05, // 🔬 WAVE 2185: Recalibrado (was 0.08, was 0.001)
};
/**
 * 📊 ROLLING STATS
 *
 * Calcula estadísticas rodantes (mean, stdDev, Z-Score) sobre una ventana
 * temporal de tamaño fijo. Usa Welford's algorithm para cálculo incremental
 * eficiente de varianza.
 *
 * @example
 * ```typescript
 * const stats = new RollingStats({ windowSize: 60 }); // 1 segundo @ 60fps
 *
 * // En cada frame:
 * const result = stats.update(currentEnergy);
 * console.log(`Z-Score: ${result.zScore.toFixed(2)}σ`);
 *
 * // Z-Score > 2.5 = momento notable
 * // Z-Score > 3.0 = momento épico (estadísticamente raro)
 * ```
 */
export class RollingStats {
    constructor(config = {}) {
        // Welford's algorithm state para cálculo incremental
        this.sum = 0;
        this.sumSquares = 0;
        this.min = Infinity;
        this.max = -Infinity;
        // Cache de stats calculadas
        this.cachedStats = null;
        this.lastUpdateFrame = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.buffer = new CircularBuffer(this.config.windowSize);
    }
    /**
     * Actualiza las estadísticas con un nuevo valor.
     *
     * @param value - Nuevo valor a añadir
     * @returns Estadísticas actualizadas incluyendo Z-Score
     */
    update(value) {
        // Si el buffer está lleno, necesitamos "olvidar" el valor más antiguo
        if (this.buffer.isFull) {
            const oldest = this.buffer.get(0);
            this.sum -= oldest;
            this.sumSquares -= oldest * oldest;
        }
        // Añadir nuevo valor
        this.buffer.push(value);
        this.sum += value;
        this.sumSquares += value * value;
        // Actualizar min/max (recalcular si el buffer está lleno para precisión)
        if (this.buffer.isFull) {
            this.recalculateMinMax();
        }
        else {
            this.min = Math.min(this.min, value);
            this.max = Math.max(this.max, value);
        }
        // Calcular estadísticas
        const n = this.buffer.size;
        const mean = this.sum / n;
        // Varianza usando fórmula: E[X²] - E[X]²
        const variance = Math.max(0, (this.sumSquares / n) - (mean * mean));
        const stdDev = Math.max(this.config.minStdDev, Math.sqrt(variance));
        // Z-Score: cuántas desviaciones estándar del valor actual respecto a la media
        const zScore = (value - mean) / stdDev;
        this.cachedStats = {
            mean,
            stdDev,
            min: this.min,
            max: this.max,
            current: value,
            zScore,
        };
        this.lastUpdateFrame++;
        return this.cachedStats;
    }
    /**
     * Obtiene las últimas estadísticas calculadas sin añadir un nuevo valor.
     */
    getStats() {
        return this.cachedStats;
    }
    /**
     * Calcula el Z-Score de un valor hipotético sin modificar el buffer.
     * Útil para simulaciones tipo "¿qué pasaría si...?"
     */
    hypotheticalZScore(value) {
        if (this.buffer.isEmpty)
            return 0;
        const n = this.buffer.size;
        const mean = this.sum / n;
        const variance = Math.max(0, (this.sumSquares / n) - (mean * mean));
        const stdDev = Math.max(this.config.minStdDev, Math.sqrt(variance));
        return (value - mean) / stdDev;
    }
    /**
     * ¿Está el buffer suficientemente lleno para estadísticas confiables?
     * Se considera "calentado" cuando tiene al menos 50% de su capacidad.
     */
    get isWarmedUp() {
        return this.buffer.size >= this.config.windowSize * 0.5;
    }
    /**
     * Porcentaje del buffer lleno (0-1).
     */
    get fillRatio() {
        return this.buffer.size / this.config.windowSize;
    }
    /**
     * Número de muestras actualmente en el buffer.
     */
    get sampleCount() {
        return this.buffer.size;
    }
    /**
     * Reinicia las estadísticas.
     */
    reset() {
        this.buffer.clear();
        this.sum = 0;
        this.sumSquares = 0;
        this.min = Infinity;
        this.max = -Infinity;
        this.cachedStats = null;
        this.lastUpdateFrame = 0;
    }
    /**
     * Recalcula min/max iterando todo el buffer.
     * Se llama automáticamente cuando el buffer está lleno.
     */
    recalculateMinMax() {
        this.min = Infinity;
        this.max = -Infinity;
        for (const value of this.buffer) {
            this.min = Math.min(this.min, value);
            this.max = Math.max(this.max, value);
        }
    }
}
export default RollingStats;
