// ═══════════════════════════════════════════════════════════════════════════
//  📊 ROLLING STATS - Estadísticas Rodantes en Tiempo Real
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 664 - CONTEXTUAL MEMORY - PHASE 1
//  "La matemática que detecta lo extraordinario en lo ordinario"
// ═══════════════════════════════════════════════════════════════════════════

import { CircularBuffer } from './CircularBuffer';

/**
 * Estadísticas de una métrica individual.
 */
export interface MetricStats {
  /** Media aritmética */
  mean: number;
  /** Desviación estándar */
  stdDev: number;
  /** Valor mínimo en la ventana */
  min: number;
  /** Valor máximo en la ventana */
  max: number;
  /** Valor actual (más reciente) */
  current: number;
  /** Z-Score del valor actual: (current - mean) / stdDev */
  zScore: number;
}

/**
 * Configuración de RollingStats.
 */
export interface RollingStatsConfig {
  /** Tamaño del buffer (número de muestras) */
  windowSize: number;
  /** Desviación estándar mínima para evitar división por cero */
  minStdDev?: number;
}

const DEFAULT_CONFIG: Required<RollingStatsConfig> = {
  windowSize: 300, // ~5 segundos a 60fps
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 1181.1: Z-SCORE FLOOR FIX
  // ═══════════════════════════════════════════════════════════════════════════
  // PROBLEMA: Durante breakdowns con poca variación (stdDev real = 0.02),
  // cualquier pico moderado se convierte en Z=9σ porque:
  //   Z = (0.30 - 0.12) / 0.02 = 9σ
  //
  // SOLUCIÓN: Establecer un FLOOR de stdDev realista para música.
  // En la realidad musical, la variación natural de energía es ~10-15%.
  // Usamos 0.08 como floor → Máximo Z-Score posible ≈ 10σ con pico de 1.0
  //
  // ANTES: minStdDev: 0.001 → Z = 9σ fácilmente
  // AHORA: minStdDev: 0.08 → Z = (1.0 - 0.2) / 0.08 = 10σ máximo teórico
  // ═══════════════════════════════════════════════════════════════════════════
  minStdDev: 0.08, // 🔬 WAVE 1181.1: Floor realista (was 0.001)
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
  private config: Required<RollingStatsConfig>;
  private buffer: CircularBuffer<number>;
  
  // Welford's algorithm state para cálculo incremental
  private sum: number = 0;
  private sumSquares: number = 0;
  private min: number = Infinity;
  private max: number = -Infinity;
  
  // Cache de stats calculadas
  private cachedStats: MetricStats | null = null;
  private lastUpdateFrame: number = 0;

  constructor(config: Partial<RollingStatsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = new CircularBuffer<number>(this.config.windowSize);
  }

  /**
   * Actualiza las estadísticas con un nuevo valor.
   * 
   * @param value - Nuevo valor a añadir
   * @returns Estadísticas actualizadas incluyendo Z-Score
   */
  update(value: number): MetricStats {
    // Si el buffer está lleno, necesitamos "olvidar" el valor más antiguo
    if (this.buffer.isFull) {
      const oldest = this.buffer.get(0)!;
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
    } else {
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
  getStats(): MetricStats | null {
    return this.cachedStats;
  }

  /**
   * Calcula el Z-Score de un valor hipotético sin modificar el buffer.
   * Útil para simulaciones tipo "¿qué pasaría si...?"
   */
  hypotheticalZScore(value: number): number {
    if (this.buffer.isEmpty) return 0;
    
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
  get isWarmedUp(): boolean {
    return this.buffer.size >= this.config.windowSize * 0.5;
  }

  /**
   * Porcentaje del buffer lleno (0-1).
   */
  get fillRatio(): number {
    return this.buffer.size / this.config.windowSize;
  }

  /**
   * Número de muestras actualmente en el buffer.
   */
  get sampleCount(): number {
    return this.buffer.size;
  }

  /**
   * Reinicia las estadísticas.
   */
  reset(): void {
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
  private recalculateMinMax(): void {
    this.min = Infinity;
    this.max = -Infinity;
    
    for (const value of this.buffer) {
      this.min = Math.min(this.min, value);
      this.max = Math.max(this.max, value);
    }
  }
}

export default RollingStats;
