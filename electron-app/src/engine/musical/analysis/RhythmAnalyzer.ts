/**
 * 🥁 RHYTHM ANALYZER - LA MATEMÁTICA DEL RITMO
 * =============================================
 * El Motor de Análisis Rítmico de Selene Lux
 * 
 * Este componente analiza el audio en tiempo real para detectar:
 * - Patrones rítmicos (Dembow, Caballito, Four-on-floor)
 * - Sincopación (el "swing" o "groove" de la música)
 * - Detección de drums (kick, snare, hihat)
 * - Fills y transiciones
 * 
 * REGLAS DE ORO APLICADAS:
 * - REGLA 1: Análisis LIGERO para Main Thread (< 5ms)
 * - REGLA 3: Sincopación como ciudadano de PRIMERA CLASE
 * 
 * MATEMÁTICA DE SINCOPACIÓN:
 * - Si la energía máxima cae en fase ~0.0 (on-beat) → sincopation ≈ 0
 * - Si la energía máxima cae en fase 0.25-0.75 (off-beat) → sincopation ↑
 * - syncopation = OffBeatEnergy / TotalEnergy
 * 
 * @module engines/musical/analysis/RhythmAnalyzer
 * @version 1.0.0
 * @date December 2025
 */

import type { AudioMetrics } from '../../types';
import type {
  RhythmAnalysis,
  DrumDetection,
  GrooveAnalysis,
  DrumPatternType,
} from '../types';

// ============================================================
// 📊 CONFIGURACIÓN
// ============================================================

/**
 * Configuración del analizador de ritmo
 */
export interface RhythmAnalyzerConfig {
  /** Tamaño del buffer circular para análisis (default: 16 frames) */
  bufferSize: number;
  
  /** Umbral de detección de kick (bass transient) */
  kickThreshold: number;
  
  /** Umbral de detección de snare (mid transient) */
  snareThreshold: number;
  
  /** Umbral de detección de hihat (treble transient) */
  hihatThreshold: number;
  
  /** Umbral para detectar fill */
  fillThreshold: number;
  
  /** Tiempo mínimo entre fills (ms) */
  minFillInterval: number;
}

const DEFAULT_CONFIG: RhythmAnalyzerConfig = {
  bufferSize: 16,
  kickThreshold: 0.6,
  snareThreshold: 0.5,
  hihatThreshold: 0.4,
  fillThreshold: 0.8,
  minFillInterval: 2000,
};

// ============================================================
// 📦 BUFFER CIRCULAR PARA ANÁLISIS
// ============================================================

/**
 * Frame de energía para análisis de sincopación
 */
interface EnergyFrame {
  /** Fase del beat cuando se capturó (0-1) */
  phase: number;
  /** Energía de graves */
  bass: number;
  /** Energía de medios */
  mid: number;
  /** Energía de agudos */
  treble: number;
  /** Energía total */
  total: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Buffer circular optimizado para análisis
 */
class CircularBuffer<T> {
  private buffer: T[];
  private writeIndex: number = 0;
  private count: number = 0;
  
  constructor(private readonly size: number) {
    this.buffer = new Array(size);
  }
  
  push(item: T): void {
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.size;
    if (this.count < this.size) this.count++;
  }
  
  getAll(): T[] {
    if (this.count < this.size) {
      return this.buffer.slice(0, this.count);
    }
    // Devolver en orden cronológico
    return [
      ...this.buffer.slice(this.writeIndex),
      ...this.buffer.slice(0, this.writeIndex),
    ];
  }
  
  isFull(): boolean {
    return this.count >= this.size;
  }
  
  clear(): void {
    this.writeIndex = 0;
    this.count = 0;
  }
}

// ============================================================
// 🥁 RHYTHM ANALYZER CLASS
// ============================================================

/**
 * 🥁 RhythmAnalyzer
 * 
 * Analiza patrones rítmicos y calcula sincopación
 * 
 * @example
 * ```typescript
 * const analyzer = new RhythmAnalyzer();
 * const result = analyzer.analyze(audioMetrics, beatState);
 * console.log(result.groove.syncopation); // 0.45 para reggaeton
 * ```
 */
export class RhythmAnalyzer {
  private config: RhythmAnalyzerConfig;
  private energyBuffer: CircularBuffer<EnergyFrame>;
  
  // Estado previo para detección de transientes
  private prevBass: number = 0;
  private prevMid: number = 0;
  private prevTreble: number = 0;
  
  // Historial para detección de patrones
  private kickHistory: number[] = [];      // Fases donde se detectó kick
  private snareHistory: number[] = [];     // Fases donde se detectó snare
  private hihatHistory: number[] = [];     // Fases donde se detectó hihat
  private readonly historySize = 32;
  
  // Estado de fill
  private lastFillTime: number = 0;
  private consecutiveHighEnergy: number = 0;
  
  // Cache del último resultado
  private cachedResult: RhythmAnalysis | null = null;
  
  // 🌊 WAVE 41.0: EMA para suavizar sincopación (evitar saltos 0→1)
  private smoothedSyncopation: number = 0;
  private readonly SYNC_ALPHA = 0.08; // Factor de suavizado (lento y estable)
  
  constructor(config: Partial<RhythmAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.energyBuffer = new CircularBuffer<EnergyFrame>(this.config.bufferSize);
  }
  
  // ============================================================
  // 🎯 MÉTODO PRINCIPAL: analyze()
  // ============================================================
  
  /**
   * 🎯 Analizar frame de audio
   * 
   * ⚠️ REGLA 1: Este método debe ser LIGERO (< 5ms)
   * Se ejecuta en Main Thread a 30ms de frecuencia
   * 
   * @param audio - Métricas de audio del frame actual
   * @param beat - Estado del beat (bpm, phase, etc.)
   * @returns Análisis rítmico completo
   */
  analyze(audio: AudioMetrics, beat: { bpm: number; phase: number; onBeat: boolean }): RhythmAnalysis {
    const now = audio.timestamp;
    
    // 1. Detectar transientes (cambios bruscos de energía)
    const drums = this.detectDrums(audio);
    
    // 2. Registrar en buffer de energía
    this.energyBuffer.push({
      phase: beat.phase,
      bass: audio.bass,
      mid: audio.mid,
      treble: audio.treble,
      total: audio.energy,
      timestamp: now,
    });
    
    // 3. Registrar hits de drums con sus fases
    if (drums.kickDetected) this.recordHit(this.kickHistory, beat.phase);
    if (drums.snareDetected) this.recordHit(this.snareHistory, beat.phase);
    if (drums.hihatDetected) this.recordHit(this.hihatHistory, beat.phase);
    
    // 4. Calcular groove (sincopación, swing, complejidad)
    const groove = this.calculateGroove(beat.phase);
    
    // 5. Detectar tipo de patrón
    const pattern = this.detectPatternType(audio, drums, groove, beat.bpm);
    
    // 6. Detectar fill en progreso
    const fillInProgress = this.detectFill(audio, drums, now);
    
    // 7. Calcular confianza general
    const confidence = this.calculateConfidence(groove, drums);
    
    // 8. Actualizar estado previo
    this.prevBass = audio.bass;
    this.prevMid = audio.mid;
    this.prevTreble = audio.treble;
    
    // 9. Construir resultado
    const result: RhythmAnalysis = {
      bpm: beat.bpm,
      confidence,
      beatPhase: beat.phase,
      barPhase: (beat.phase * 4) % 1,  // Asumiendo 4/4
      pattern: {
        type: pattern.type,
        confidence: pattern.confidence,
      },
      drums,
      groove,
      fillInProgress,
      timestamp: now,
    };
    
    this.cachedResult = result;
    return result;
  }
  
  // ============================================================
  // 🥁 DETECCIÓN DE DRUMS
  // ============================================================
  
  /**
   * Detectar kicks, snares y hihats
   */
  private detectDrums(audio: AudioMetrics): DrumDetection {
    // Calcular transientes (cambios bruscos)
    const bassTransient = Math.max(0, audio.bass - this.prevBass);
    const midTransient = Math.max(0, audio.mid - this.prevMid);
    const trebleTransient = Math.max(0, audio.treble - this.prevTreble);
    
    // Detectar kick: Bass transient fuerte + nivel de bass alto
    const kickDetected = bassTransient > this.config.kickThreshold && audio.bass > 0.5;
    
    // Detectar snare: Mid transient fuerte + nivel de mid
    const snareDetected = midTransient > this.config.snareThreshold && audio.mid > 0.4;
    
    // Detectar hihat: Treble transient + nivel de treble
    const hihatDetected = trebleTransient > this.config.hihatThreshold && audio.treble > 0.3;
    
    // Detectar crash: Treble MUY fuerte + bass simultáneo
    const crashDetected = audio.treble > 0.8 && audio.bass > 0.6 && trebleTransient > 0.5;
    
    return {
      kickDetected,
      kickIntensity: kickDetected ? audio.bass : 0,
      snareDetected,
      snareIntensity: snareDetected ? audio.mid : 0,
      hihatDetected,
      hihatIntensity: hihatDetected ? audio.treble : 0,
      crashDetected,
      fillDetected: false, // Se actualiza en detectFill()
    };
  }
  
  // ============================================================
  // 🎵 CÁLCULO DE SINCOPACIÓN - EL ARMA SECRETA
  // ============================================================
  
  /**
   * 🎯 Calcular groove (sincopación, swing, complejidad)
   * 
   * MATEMÁTICA DE SINCOPACIÓN - FÓRMULA FINAL:
   * - Dividir el beat en ON-BEAT (fase 0.0-0.15, 0.85-1.0) y OFF-BEAT (0.15-0.85)
   * - Medir qué % de la energía TOTAL está en off-beat
   * - PERO ponderar por la INTENSIDAD de los picos off-beat
   * 
   * CLAVE: Four-on-floor tiene picos SOLO en on-beat
   *        Reggaeton tiene picos FUERTES en off-beat (dembow)
   * 
   * FÓRMULA: syncopation = (peakOffBeat / maxPeak) * (offBeatEnergy / totalEnergy)
   * 
   * UMBRALES (de types.ts):
   * - < 0.15: Straight/Four-on-floor (Techno, House)
   * - 0.15-0.4: Moderado (Pop, Rock)
   * - > 0.4: Alto (Reggaeton, Funk)
   */
  private calculateGroove(_currentPhase: number): GrooveAnalysis {
    const frames = this.energyBuffer.getAll();
    
    // Si no hay suficientes datos, devolver valores neutros
    if (frames.length < 4) {
      return {
        syncopation: 0, // RESCUE DIRECTIVE: NO DEFAULTS - use 0 if no data
        swingAmount: 0.0,
        complexity: 'low',
        humanization: 0.05,
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎯 CÁLCULO DE SINCOPACIÓN - FÓRMULA MEJORADA V2
    // ═══════════════════════════════════════════════════════════
    
    let onBeatEnergy = 0;
    let offBeatEnergy = 0;
    let peakOnBeat = 0;   // Pico más alto en on-beat
    let peakOffBeat = 0;  // Pico más alto en off-beat
    
    for (const frame of frames) {
      // Usar bass + mid ponderado (bass domina el groove)
      const energy = frame.bass + frame.mid * 0.5;
      
      // On-beat: cerca de 0.0 o 1.0 (inicio del beat)
      const isOnBeat = frame.phase < 0.15 || frame.phase > 0.85;
      
      if (isOnBeat) {
        onBeatEnergy += energy;
        peakOnBeat = Math.max(peakOnBeat, energy);
      } else {
        offBeatEnergy += energy;
        peakOffBeat = Math.max(peakOffBeat, energy);
      }
    }
    
    const totalEnergy = onBeatEnergy + offBeatEnergy;
    
    // Factor 1: Qué proporción de energía está off-beat (0-1)
    const offBeatRatio = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0; // RESCUE DIRECTIVE: NO DEFAULTS - use 0 if no energy
    
    // Factor 2: Qué tan fuertes son los picos off-beat vs ON-beat
    // Si peakOffBeat ≈ peakOnBeat → hay golpes importantes off-beat (alto syncopation)
    // Si peakOffBeat << peakOnBeat → toda la acción está on-beat (bajo syncopation)
    // CLAVE: Comparar con peakOnBeat, no con maxPeak
    const peakDominance = peakOnBeat > 0.01 
      ? Math.min(1, peakOffBeat / peakOnBeat)  // 0 si offBeat débil, 1 si igual o mayor
      : (peakOffBeat > 0.3 ? 1 : 0); // RESCUE DIRECTIVE: If no onBeat, use 0 not 0.5
    
    // FÓRMULA FINAL:
    // - offBeatRatio alto + peakDominance alto = ALTA syncopation (reggaeton)
    // - offBeatRatio bajo + peakDominance bajo = BAJA syncopation (four-on-floor)
    // El peakDominance es clave: si los picos off-beat son débiles comparados con on-beat,
    // la syncopation es baja aunque haya energía background off-beat
    const syncopation = peakDominance * 0.7 + offBeatRatio * 0.3;
    
    // ═══════════════════════════════════════════════════════════
    // 🎷 CÁLCULO DE SWING
    // ═══════════════════════════════════════════════════════════
    // Swing: Energía desplazada hacia la segunda mitad de cada división
    // Jazz típico tiene swing > 0.15
    
    let earlyOffBeatEnergy = 0;  // 0.2-0.4
    let lateOffBeatEnergy = 0;   // 0.6-0.8
    
    for (const frame of frames) {
      if (frame.phase > 0.2 && frame.phase < 0.4) {
        earlyOffBeatEnergy += frame.total;
      } else if (frame.phase > 0.6 && frame.phase < 0.8) {
        lateOffBeatEnergy += frame.total;
      }
    }
    
    const totalOffBeat = earlyOffBeatEnergy + lateOffBeatEnergy;
    const swingAmount = totalOffBeat > 0.01
      ? (lateOffBeatEnergy / totalOffBeat) - 0.5  // 0 = sin swing, >0 = swung
      : 0;
    
    // Normalizar a 0-1
    const normalizedSwing = Math.max(0, Math.min(1, swingAmount * 2));
    
    // ═══════════════════════════════════════════════════════════
    // 📊 CÁLCULO DE COMPLEJIDAD
    // ═══════════════════════════════════════════════════════════
    
    // Complejidad basada en:
    // 1. Variación de fases donde hay hits
    // 2. Cantidad de hits por beat
    // 3. Variación de intensidad
    
    const phaseVariance = this.calculatePhaseVariance();
    const hitDensity = (this.kickHistory.length + this.snareHistory.length + this.hihatHistory.length) / 
                       Math.max(1, this.historySize);
    
    let complexity: 'low' | 'medium' | 'high';
    
    if (phaseVariance > 0.3 || hitDensity > 0.5) {
      complexity = 'high';
    } else if (phaseVariance > 0.15 || hitDensity > 0.3) {
      complexity = 'medium';
    } else {
      complexity = 'low';
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🤖 CÁLCULO DE HUMANIZACIÓN
    // ═══════════════════════════════════════════════════════════
    // Humanización: Variación del timing de los kicks respecto al beat perfecto
    
    const humanization = this.calculateHumanization();
    
    // 🌊 WAVE 41.0: Aplicar EMA para suavizar sincopación
    // Evita saltos bruscos (0.00 → 1.00) que confunden al GenreClassifier
    const instantSync = Math.max(0, Math.min(1, syncopation));
    this.smoothedSyncopation = (this.SYNC_ALPHA * instantSync) + ((1 - this.SYNC_ALPHA) * this.smoothedSyncopation);
    
    return {
      syncopation: this.smoothedSyncopation, // 🌊 WAVE 41.0: Exportar valor suavizado
      swingAmount: normalizedSwing,
      complexity,
      humanization,
    };
  }
  
  /**
   * Calcular varianza de fases de hits
   */
  private calculatePhaseVariance(): number {
    const allPhases = [...this.kickHistory, ...this.snareHistory];
    if (allPhases.length < 3) return 0;
    
    const mean = allPhases.reduce((a, b) => a + b, 0) / allPhases.length;
    const variance = allPhases.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / allPhases.length;
    
    return Math.sqrt(variance);  // Desviación estándar
  }
  
  /**
   * Calcular humanización (variación de timing)
   */
  private calculateHumanization(): number {
    // Kicks deberían estar en fase ~0.0
    // La humanización es cuánto se desvían del beat perfecto
    
    if (this.kickHistory.length < 4) return 0.05;
    
    // Calcular desviación media de fase 0.0 o 0.5
    let totalDeviation = 0;
    
    for (const phase of this.kickHistory) {
      // Distancia al beat más cercano (0.0, 0.5 o 1.0)
      const distTo0 = Math.min(phase, 1 - phase);
      const distTo05 = Math.abs(phase - 0.5);
      totalDeviation += Math.min(distTo0, distTo05);
    }
    
    const avgDeviation = totalDeviation / this.kickHistory.length;
    
    // Normalizar: 0.06 es típico para drums humanizados
    return Math.min(0.15, avgDeviation * 2);
  }
  
  // ============================================================
  // 🎭 DETECCIÓN DE PATRONES
  // ============================================================
  
  /**
   * 🎭 Detectar tipo de patrón rítmico
   * 
   * ⚠️ REGLA 3: Priorizar SYNCOPATION sobre BPM
   * 
   * Orden de detección:
   * 1. Sincopación → Reggaeton (>0.4) vs Techno (<0.15)
   * 2. Constancia de treble → Cumbia (güiro constante)
   * 3. Swing → Jazz (>0.15)
   * 4. BPM → Solo para desempatar
   */
  private detectPatternType(
    audio: AudioMetrics,
    _drums: DrumDetection,
    groove: GrooveAnalysis,
    bpm: number
  ): { type: DrumPatternType; confidence: number } {
    
    // ═══════════════════════════════════════════════════════════
    // 🎯 REGGAETON (Dembow pattern)
    // ═══════════════════════════════════════════════════════════
    // - Alta sincopación (> 0.4)
    // - Patrón Dembow: Kick en 1, Snare/Rim en 1.75 y 2.75
    // - BPM: 85-100
    // - Bass heavy
    
    if (groove.syncopation > 0.4 && this.hasDembowPattern()) {
      const bpmMatch = bpm >= 85 && bpm <= 100 ? 1.0 : 0.7;
      const bassMatch = audio.bass > 0.6 ? 1.0 : 0.8;
      return {
        type: 'reggaeton',
        confidence: Math.min(0.95, (groove.syncopation * 0.4 + bpmMatch * 0.3 + bassMatch * 0.3)),
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🇦🇷 CUMBIA (Caballito pattern)
    // ═══════════════════════════════════════════════════════════
    // - Güiro/Shaker CONSTANTE en trebles
    // - NO tiene Dembow
    // - BPM: 85-115
    // - Treble constante con micro-variaciones
    
    if (this.hasConstantHighPercussion(audio) && !this.hasDembowPattern()) {
      const bpmMatch = bpm >= 85 && bpm <= 115 ? 1.0 : 0.6;
      const trebleConstancy = this.calculateTrebleConstancy();
      
      if (trebleConstancy > 0.6) {
        return {
          type: 'cumbia',
          confidence: Math.min(0.90, (trebleConstancy * 0.5 + bpmMatch * 0.3 + 0.2)),
        };
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎹 FOUR ON THE FLOOR (Techno, House, Disco)
    // ═══════════════════════════════════════════════════════════
    // - Sincopación MUY BAJA (< 0.15)
    // - Kick en cada beat (1, 2, 3, 4)
    // - Swing muy bajo
    
    if (groove.syncopation < 0.15 && groove.swingAmount < 0.1) {
      const hasRegularKick = this.hasRegularKickPattern();
      if (hasRegularKick) {
        return {
          type: 'four_on_floor',
          confidence: Math.min(0.90, ((1 - groove.syncopation) * 0.5 + 0.4)),
        };
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎷 JAZZ SWING
    // ═══════════════════════════════════════════════════════════
    // - Swing alto (> 0.15)
    // - Complejidad alta
    // - Treble dominante (ride cymbal)
    
    if (groove.swingAmount > 0.15 && groove.complexity === 'high') {
      return {
        type: 'jazz_swing',
        confidence: Math.min(0.85, (groove.swingAmount * 0.4 + 0.45)),
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎸 HALF TIME (Dubstep, Trap)
    // ═══════════════════════════════════════════════════════════
    // - Snare en beat 3, no en 2
    // - Bass MUY heavy
    // - Complejidad baja
    
    if (this.hasHalfTimeSnare() && audio.bass > 0.7 && groove.complexity === 'low') {
      return {
        type: 'half_time',
        confidence: 0.75,
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🥁 BREAKBEAT (Drum & Bass, Jungle)
    // ═══════════════════════════════════════════════════════════
    // - Alta sincopación (> 0.5)
    // - Alta complejidad
    // - BPM alto (160-180)
    
    if (groove.syncopation > 0.5 && groove.complexity === 'high' && bpm > 150) {
      return {
        type: 'breakbeat',
        confidence: 0.75,
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎸 ROCK STANDARD
    // ═══════════════════════════════════════════════════════════
    // - Sincopación media
    // - Snare en 2 y 4
    // - Kick en 1 y 3
    
    if (groove.syncopation >= 0.15 && groove.syncopation <= 0.35 && this.hasRockPattern()) {
      return {
        type: 'rock_standard',
        confidence: 0.70,
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 🎵 LATIN (Clave patterns)
    // ═══════════════════════════════════════════════════════════
    if (groove.syncopation > 0.35 && groove.complexity === 'medium') {
      return {
        type: 'latin',
        confidence: 0.60,
      };
    }
    
    // ═══════════════════════════════════════════════════════════
    // ⏸️ MINIMAL (Intro/Outro)
    // ═══════════════════════════════════════════════════════════
    if (audio.energy < 0.3 && this.kickHistory.length < 4) {
      return {
        type: 'minimal',
        confidence: 0.50,
      };
    }
    
    // Fallback
    return {
      type: 'unknown',
      confidence: 0.30,
    };
  }
  
  // ============================================================
  // 🔍 HELPERS DE DETECCIÓN DE PATRONES
  // ============================================================
  
  /**
   * Detectar patrón Dembow (Reggaeton)
   * 
   * El Dembow tiene un patrón característico:
   * - Kick fuerte en beat 1
   * - Snare/Rim en ~1.75 (off-beat del 2)
   * - Otro Snare/Rim en ~2.75 (off-beat del 3)
   * 
   * "Tum... pa-Tum... pa" 
   */
  private hasDembowPattern(): boolean {
    if (this.snareHistory.length < 4) return false;
    
    // Buscar snares en fases típicas del Dembow: ~0.75 y ~0.25
    // (que corresponden a 1.75 y 2.75 en el compás)
    let dembowHits = 0;
    
    for (const phase of this.snareHistory.slice(-8)) {
      // Off-beats típicos del Dembow
      if ((phase > 0.2 && phase < 0.35) || (phase > 0.7 && phase < 0.85)) {
        dembowHits++;
      }
    }
    
    // Si más del 50% de los snares están en posiciones Dembow
    return dembowHits / Math.min(8, this.snareHistory.length) > 0.5;
  }
  
  /**
   * 🇦🇷 Detectar percusión alta constante (Güiro de Cumbia)
   * 
   * El "Caballito" de la cumbia:
   * - Güiro/Shaker SIEMPRE presente
   * - Treble alto y CONSTANTE
   * - Micro-variaciones de volumen (pero siempre ahí)
   */
  private hasConstantHighPercussion(audio: AudioMetrics): boolean {
    // Necesitamos treble alto
    if (audio.treble < 0.4) return false;
    
    // Verificar constancia en el buffer
    const frames = this.energyBuffer.getAll();
    if (frames.length < 8) return false;
    
    // Contar frames con treble presente
    let treblePresent = 0;
    for (const frame of frames) {
      if (frame.treble > 0.35) treblePresent++;
    }
    
    // Si más del 70% de los frames tienen treble alto → constante
    return treblePresent / frames.length > 0.7;
  }
  
  /**
   * Calcular constancia del treble (para Cumbia)
   */
  private calculateTrebleConstancy(): number {
    const frames = this.energyBuffer.getAll();
    if (frames.length < 4) return 0;
    
    // Calcular varianza del treble
    const trebles = frames.map(f => f.treble);
    const mean = trebles.reduce((a, b) => a + b, 0) / trebles.length;
    const variance = trebles.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / trebles.length;
    
    // Constancia alta = varianza baja pero media alta
    const constancy = mean > 0.3 ? (1 - Math.min(1, variance * 10)) : 0;
    
    return constancy;
  }
  
  /**
   * Detectar kick regular (Four-on-floor)
   */
  private hasRegularKickPattern(): boolean {
    if (this.kickHistory.length < 4) return false;
    
    // Kicks deberían estar cerca de fase 0.0
    let onBeatKicks = 0;
    for (const phase of this.kickHistory.slice(-8)) {
      if (phase < 0.15 || phase > 0.85) {
        onBeatKicks++;
      }
    }
    
    return onBeatKicks / Math.min(8, this.kickHistory.length) > 0.7;
  }
  
  /**
   * Detectar half-time snare (beat 3 en lugar de 2)
   */
  private hasHalfTimeSnare(): boolean {
    if (this.snareHistory.length < 4) return false;
    
    // En half-time, snare está en fase ~0.5 (beat 3 de un compás de 4)
    let halfTimeHits = 0;
    for (const phase of this.snareHistory.slice(-8)) {
      if (phase > 0.45 && phase < 0.55) {
        halfTimeHits++;
      }
    }
    
    return halfTimeHits / Math.min(8, this.snareHistory.length) > 0.5;
  }
  
  /**
   * Detectar patrón de rock (snare en 2 y 4)
   */
  private hasRockPattern(): boolean {
    if (this.snareHistory.length < 4) return false;
    
    // Rock: snare en ~0.25 (beat 2) y ~0.75 (beat 4)
    let rockHits = 0;
    for (const phase of this.snareHistory.slice(-8)) {
      if ((phase > 0.2 && phase < 0.3) || (phase > 0.7 && phase < 0.8)) {
        rockHits++;
      }
    }
    
    return rockHits / Math.min(8, this.snareHistory.length) > 0.5;
  }
  
  // ============================================================
  // 🎭 DETECCIÓN DE FILLS
  // ============================================================
  
  /**
   * Detectar fill en progreso
   * 
   * Un fill se caracteriza por:
   * - Alta densidad de hits
   * - Variación rápida de intensidad
   * - Duración corta (típicamente 1-2 beats)
   * - O energía sostenida muy alta (builds en EDM)
   */
  private detectFill(audio: AudioMetrics, drums: DrumDetection, now: number): boolean {
    // Verificar intervalo mínimo entre fills
    if (now - this.lastFillTime < this.config.minFillInterval) {
      // Pero si ya detectamos un fill reciente, mantenerlo brevemente
      if (this.consecutiveHighEnergy > 3) return true;
    }
    
    // OPCIÓN 1: Alta energía + muchos hits (fill clásico)
    const highEnergy = audio.energy > this.config.fillThreshold;
    const manyHits = (drums.kickDetected ? 1 : 0) + 
                     (drums.snareDetected ? 1 : 0) + 
                     (drums.hihatDetected ? 1 : 0) >= 2;
    
    // OPCIÓN 2: Energía MUY alta sostenida (build/riser)
    // Bass + mid + treble todos altos simultáneamente
    const extremeEnergy = audio.energy > 0.85 && 
                          audio.bass > 0.7 && 
                          audio.mid > 0.7;
    
    if ((highEnergy && manyHits) || extremeEnergy) {
      this.consecutiveHighEnergy++;
      
      if (this.consecutiveHighEnergy >= 4) {
        this.lastFillTime = now;
        return true;
      }
    } else {
      this.consecutiveHighEnergy = Math.max(0, this.consecutiveHighEnergy - 1);
    }
    
    return false;
  }
  
  // ============================================================
  // 📊 CÁLCULO DE CONFIANZA
  // ============================================================
  
  /**
   * Calcular confianza general del análisis
   * 
   * ⚠️ REGLA 2: Confianza < 0.5 → usar modo reactivo
   */
  private calculateConfidence(groove: GrooveAnalysis, drums: DrumDetection): number {
    // Factores que aumentan confianza:
    // - Buffer lleno
    // - Historial de hits suficiente
    // - Patrón detectado claro
    // - Energía presente
    
    let confidence = 0.3;  // Base
    
    // Buffer de energía lleno
    if (this.energyBuffer.isFull()) {
      confidence += 0.2;
    }
    
    // Historial de kicks suficiente
    if (this.kickHistory.length >= 8) {
      confidence += 0.15;
    }
    
    // Groove claro (no neutral)
    if (groove.syncopation < 0.15 || groove.syncopation > 0.35) {
      confidence += 0.15;  // Patrón claro (muy bajo o muy alto)
    }
    
    // Drums detectados recientemente
    if (drums.kickDetected || drums.snareDetected) {
      confidence += 0.1;
    }
    
    // Complejidad no desconocida
    if (groove.complexity !== 'low') {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }
  
  // ============================================================
  // 🔧 UTILIDADES
  // ============================================================
  
  /**
   * Registrar hit en historial
   */
  private recordHit(history: number[], phase: number): void {
    history.push(phase);
    if (history.length > this.historySize) {
      history.shift();
    }
  }
  
  /**
   * Obtener último resultado cacheado
   */
  getLastResult(): RhythmAnalysis | null {
    return this.cachedResult;
  }
  
  /**
   * Reset del analizador
   */
  reset(): void {
    this.energyBuffer.clear();
    this.kickHistory = [];
    this.snareHistory = [];
    this.hihatHistory = [];
    this.prevBass = 0;
    this.prevMid = 0;
    this.prevTreble = 0;
    this.lastFillTime = 0;
    this.consecutiveHighEnergy = 0;
    this.cachedResult = null;
  }
}
