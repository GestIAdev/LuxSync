/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🎚️ WAVE 94: AUTOMATIC GAIN CONTROL (AGC)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * THE PROFESSIONAL EAR - Normalización dinámica para todas las fuentes de audio.
 * 
 * PROBLEMA:
 * - MP3 de salsa → picos de 0.30 → luces apagadas (Gate 0.40 nunca se alcanza)
 * - WAV de cumbia → muro de 0.90 → luces siempre encendidas (todo supera Gate)
 * 
 * SOLUCIÓN:
 * - Peak Tracker con decaimiento lento (0.995/frame)
 * - Normalización: señal_normalizada = señal_cruda / maxPeak
 * - Resultado: ambas canciones entregan 0.0-1.0 en su rango dinámico REAL
 * 
 * COMPORTAMIENTO:
 * - maxPeak sube INSTANTÁNEAMENTE con señales fuertes
 * - maxPeak baja LENTAMENTE (0.995^frame) para adaptarse a canciones más silenciosas
 * - Floor de 0.1 para evitar división por casi-cero
 * 
 * @author Copilot WAVE 94
 * @created 2024-12-23
 */

export interface AGCOutput {
  /** Energía normalizada (0.0 - 1.0) */
  normalizedEnergy: number;
  /** Bass normalizado (0.0 - 1.0) */
  normalizedBass: number;
  /** Mid normalizado (0.0 - 1.0) */
  normalizedMid: number;
  /** Treble normalizado (0.0 - 1.0) */
  normalizedTreble: number;
  
  /** Pico máximo detectado (para debug) */
  maxPeak: number;
  /** Factor de ganancia actual (1.0 / maxPeak) */
  gainFactor: number;
  
  /** 🎯 WAVE 94.2: Energía promedio normalizada (rolling average ~3s) */
  avgNormEnergy: number;
}

export interface AGCConfig {
  /** Decay por frame (0.995 = muy lento, 0.99 = moderado, 0.98 = rápido) */
  peakDecay: number;
  
  /** Pico mínimo para evitar amplificación excesiva (default: 0.1) */
  minPeak: number;
  
  /** Pico inicial (default: 0.5 para adaptación rápida) */
  initialPeak: number;
  
  /** Ventana de warmup en frames (no normalizar hasta calibrar) */
  warmupFrames: number;
}

/**
 * 🎚️ AUTOMATIC GAIN CONTROL
 * 
 * Normaliza la señal de audio dinámicamente para compensar
 * diferencias de volumen entre canciones/formatos.
 */
export class AutomaticGainControl {
  private readonly config: AGCConfig;
  
  /** Pico máximo rastreado (sube instantáneo, baja lento) */
  private maxPeak: number;
  
  /** Picos por banda (para normalización independiente) */
  private maxBass: number;
  private maxMid: number;
  private maxTreble: number;
  
  /** 🎯 WAVE 94.2: Rolling average de energía normalizada (~3s window) */
  private avgNormEnergy: number = 0.5;
  private readonly AVG_ALPHA = 0.01; // EMA: ~100 frames para 63% convergencia
  
  /** Contador de frames para warmup */
  private frameCount = 0;
  
  /** Último log frame (para throttling) */
  private lastLogFrame = 0;
  
  private static readonly DEFAULT_CONFIG: AGCConfig = {
    peakDecay: 0.995,        // Muy lento: 0.995^60 = 0.74 después de 1 segundo
    minPeak: 0.10,           // No amplificar más de 10x
    initialPeak: 0.50,       // Comenzar con peak moderado
    warmupFrames: 120,       // 2 segundos de calibración
  };
  
  constructor(config: Partial<AGCConfig> = {}) {
    this.config = { ...AutomaticGainControl.DEFAULT_CONFIG, ...config };
    this.maxPeak = this.config.initialPeak;
    this.maxBass = this.config.initialPeak;
    this.maxMid = this.config.initialPeak;
    this.maxTreble = this.config.initialPeak;
  }
  
  /**
   * 🎚️ PROCESO PRINCIPAL
   * 
   * Recibe señales crudas y retorna señales normalizadas.
   */
  update(
    rawEnergy: number,
    rawBass: number,
    rawMid: number,
    rawTreble: number
  ): AGCOutput {
    this.frameCount++;
    
    // Clamp inputs — NaN/Infinity → 0 (Math.max(0, NaN) = NaN, so must guard explicitly)
    const energy = Number.isFinite(rawEnergy) ? Math.max(0, Math.min(1, rawEnergy)) : 0;
    const bass = Number.isFinite(rawBass) ? Math.max(0, Math.min(1, rawBass)) : 0;
    const mid = Number.isFinite(rawMid) ? Math.max(0, Math.min(1, rawMid)) : 0;
    const treble = Number.isFinite(rawTreble) ? Math.max(0, Math.min(1, rawTreble)) : 0;
    
    // ═══════════════════════════════════════════════════════════════════
    // PASO 1: PEAK TRACKING (Subida instantánea, bajada lenta)
    // ═══════════════════════════════════════════════════════════════════
    
    // Energy peak (general)
    if (energy > this.maxPeak) {
      this.maxPeak = energy;  // Subida INSTANTÁNEA
    } else {
      this.maxPeak *= this.config.peakDecay;  // Bajada LENTA
    }
    this.maxPeak = Math.max(this.config.minPeak, this.maxPeak);  // Floor
    
    // Bass peak
    if (bass > this.maxBass) {
      this.maxBass = bass;
    } else {
      this.maxBass *= this.config.peakDecay;
    }
    this.maxBass = Math.max(this.config.minPeak, this.maxBass);
    
    // Mid peak
    if (mid > this.maxMid) {
      this.maxMid = mid;
    } else {
      this.maxMid *= this.config.peakDecay;
    }
    this.maxMid = Math.max(this.config.minPeak, this.maxMid);
    
    // Treble peak
    if (treble > this.maxTreble) {
      this.maxTreble = treble;
    } else {
      this.maxTreble *= this.config.peakDecay;
    }
    this.maxTreble = Math.max(this.config.minPeak, this.maxTreble);
    
    // ═══════════════════════════════════════════════════════════════════
    // PASO 2: NORMALIZACIÓN
    // ═══════════════════════════════════════════════════════════════════
    
    // Durante warmup, usamos valores sin normalizar (o parcialmente)
    const warmupFactor = Math.min(1, this.frameCount / this.config.warmupFrames);
    
    // Factor de ganancia (1.0 / peak)
    const gainFactor = 1.0 / this.maxPeak;
    
    // Normalizar cada banda independientemente
    const rawNormEnergy = (energy / this.maxPeak);
    const rawNormBass = (bass / this.maxBass);
    const rawNormMid = (mid / this.maxMid);
    const rawNormTreble = (treble / this.maxTreble);
    
    // Interpolar entre raw y normalizado durante warmup
    const normalizedEnergy = Math.min(1, energy * (1 - warmupFactor) + rawNormEnergy * warmupFactor);
    const normalizedBass = Math.min(1, bass * (1 - warmupFactor) + rawNormBass * warmupFactor);
    const normalizedMid = Math.min(1, mid * (1 - warmupFactor) + rawNormMid * warmupFactor);
    const normalizedTreble = Math.min(1, treble * (1 - warmupFactor) + rawNormTreble * warmupFactor);
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎯 WAVE 94.2: ROLLING AVERAGE (para Relative Gates)
    // ═══════════════════════════════════════════════════════════════════
    // EMA con alpha pequeño (~3 segundos para 63% convergencia a 60fps)
    // Esto captura el "nivel típico" de la canción, no los picos
    this.avgNormEnergy = this.avgNormEnergy * (1 - this.AVG_ALPHA) + normalizedEnergy * this.AVG_ALPHA;
    
    // ═══════════════════════════════════════════════════════════════════
    // PASO 3: LOGGING DIAGNÓSTICO (una vez por segundo)
    // ═══════════════════════════════════════════════════════════════════
    if (this.frameCount - this.lastLogFrame >= 60) {
      this.lastLogFrame = this.frameCount;
      console.log(`[AGC] Peak:${this.maxPeak.toFixed(2)} Gain:${gainFactor.toFixed(1)}x Avg:${this.avgNormEnergy.toFixed(2)} | Raw:[E:${energy.toFixed(2)} B:${bass.toFixed(2)}] → Norm:[E:${normalizedEnergy.toFixed(2)} B:${normalizedBass.toFixed(2)}]`);
    }
    
    return {
      normalizedEnergy,
      normalizedBass,
      normalizedMid,
      normalizedTreble,
      maxPeak: this.maxPeak,
      gainFactor,
      avgNormEnergy: this.avgNormEnergy,
    };
  }
  
  /**
   * 🔄 RESET
   * Reinicia el AGC (para cambio de canción/fuente)
   */
  reset(): void {
    this.maxPeak = this.config.initialPeak;
    this.maxBass = this.config.initialPeak;
    this.maxMid = this.config.initialPeak;
    this.maxTreble = this.config.initialPeak;
    this.avgNormEnergy = 0.5;  // 🎯 WAVE 94.2: Reset average
    this.frameCount = 0;
    console.log('[AGC] 🔄 RESET: Peaks reinitialized');
  }
  
  /**
   * 📊 GET STATE (para telemetría)
   */
  getState(): { maxPeak: number; gainFactor: number; frameCount: number } {
    return {
      maxPeak: this.maxPeak,
      gainFactor: 1.0 / this.maxPeak,
      frameCount: this.frameCount,
    };
  }
}
