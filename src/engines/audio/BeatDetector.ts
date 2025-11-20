/**
 * BeatDetector.ts
 * Detecta beats usando onset detection con análisis de energía espectral
 * Algoritmo basado en cambios súbitos de energía en bandas de frecuencia
 */

export interface BeatDetectionConfig {
  threshold: number;          // Umbral de detección (0.1 - 1.0, típico: 0.3)
  minBeatInterval: number;    // Intervalo mínimo entre beats en ms (típico: 250ms = 240 BPM)
  energyWindowSize: number;   // Tamaño de ventana para promedio de energía
  adaptiveThreshold: boolean; // Ajustar threshold dinámicamente
}

export interface BeatEvent {
  timestamp: number;          // Momento del beat (ms)
  strength: number;           // Fuerza del beat (0-1)
  confidence: number;         // Confianza de la detección (0-1)
  bpm?: number;               // BPM estimado (si está disponible)
}

/**
 * Detector de beats en tiempo real
 * Usa análisis de energía espectral con ventana deslizante
 */
export class BeatDetector {
  private config: BeatDetectionConfig;
  private energyHistory: number[] = [];
  private lastBeatTime: number = 0;
  private beatIntervals: number[] = [];
  private currentBPM: number = 0;

  constructor(config: Partial<BeatDetectionConfig> = {}) {
    this.config = {
      threshold: config.threshold || 0.3,
      minBeatInterval: config.minBeatInterval || 250, // 240 BPM máximo
      energyWindowSize: config.energyWindowSize || 43, // ~1 segundo a 43Hz
      adaptiveThreshold: config.adaptiveThreshold !== false,
    };
  }

  /**
   * Procesa un buffer de audio y detecta beats
   * @param samples Array de muestras de audio [-1, 1]
   * @param timestamp Timestamp del buffer
   * @returns BeatEvent si se detectó beat, null si no
   */
  detect(samples: Float32Array, timestamp: number): BeatEvent | null {
    // 1. Calcular energía instantánea del buffer
    const energy = this.calculateEnergy(samples);

    // 2. Agregar a historial
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.config.energyWindowSize) {
      this.energyHistory.shift();
    }

    // 3. Calcular energía promedio y varianza
    const avgEnergy = this.calculateAverage(this.energyHistory);
    const variance = this.calculateVariance(this.energyHistory, avgEnergy);

    // 4. Calcular threshold adaptativo
    let threshold = this.config.threshold;
    if (this.config.adaptiveThreshold) {
      // Threshold = promedio + (varianza * factor)
      threshold = avgEnergy + (Math.sqrt(variance) * 1.5);
    }

    // 5. Detectar onset (cambio súbito de energía)
    const isOnset = energy > threshold && energy > avgEnergy * 1.3;

    // 6. Verificar intervalo mínimo entre beats
    const timeSinceLastBeat = timestamp - this.lastBeatTime;
    if (isOnset && timeSinceLastBeat >= this.config.minBeatInterval) {
      // ¡BEAT DETECTADO! 🎵
      
      // Calcular fuerza del beat (normalizada 0-1)
      const strength = Math.min(1.0, (energy - avgEnergy) / (avgEnergy * 2));

      // Calcular confianza basada en varianza y energía
      const confidence = Math.min(1.0, variance / (avgEnergy * 0.5));

      // Actualizar BPM
      this.updateBPM(timeSinceLastBeat);
      this.lastBeatTime = timestamp;

      return {
        timestamp,
        strength: Math.max(0, strength),
        confidence: Math.max(0, confidence),
        bpm: this.currentBPM,
      };
    }

    return null;
  }

  /**
   * Calcula la energía de un buffer de audio
   * E = sum(sample^2) / length
   */
  private calculateEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / samples.length;
  }

  /**
   * Calcula el promedio de un array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calcula la varianza de un array
   */
  private calculateVariance(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.calculateAverage(squaredDiffs);
  }

  /**
   * Actualiza el BPM basado en intervalos entre beats
   */
  private updateBPM(interval: number): void {
    // Agregar intervalo al historial
    this.beatIntervals.push(interval);
    
    // Mantener solo los últimos 8 intervalos (~2 compases en 4/4)
    if (this.beatIntervals.length > 8) {
      this.beatIntervals.shift();
    }

    // Calcular BPM promedio
    if (this.beatIntervals.length >= 2) {
      const avgInterval = this.calculateAverage(this.beatIntervals);
      // BPM = 60000ms / interval_ms
      this.currentBPM = Math.round(60000 / avgInterval);
      
      // Limitar a rango razonable (60-200 BPM)
      this.currentBPM = Math.max(60, Math.min(200, this.currentBPM));
    }
  }

  /**
   * Obtiene el BPM actual estimado
   */
  getBPM(): number {
    return this.currentBPM;
  }

  /**
   * Ajusta la sensibilidad del detector
   * @param threshold Nuevo threshold (0.1 - 1.0)
   */
  setThreshold(threshold: number): void {
    this.config.threshold = Math.max(0.1, Math.min(1.0, threshold));
  }

  /**
   * Reinicia el estado del detector
   */
  reset(): void {
    this.energyHistory = [];
    this.lastBeatTime = 0;
    this.beatIntervals = [];
    this.currentBPM = 0;
    console.log('🔄 BeatDetector: Estado reiniciado');
  }

  /**
   * Obtiene estadísticas del detector
   */
  getStats(): {
    bpm: number;
    avgEnergy: number;
    threshold: number;
    beatCount: number;
  } {
    return {
      bpm: this.currentBPM,
      avgEnergy: this.calculateAverage(this.energyHistory),
      threshold: this.config.threshold,
      beatCount: this.beatIntervals.length,
    };
  }
}
