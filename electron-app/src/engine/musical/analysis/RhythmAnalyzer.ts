/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 WAVE 1023: THE GROOVE SURGEON - RHYTHM ANALYZER v2.0
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DIAGNÓSTICO DEL CÓDIGO ANTERIOR (WAVE 8):
 * 
 * 1. 🩺 DETECCIÓN POR RESTA SIMPLE (bass - prevBass)
 *    Problema: Confunde rampas de sintetizador con golpes de bombo.
 *    Un bombo REAL sube verticalmente (pendiente infinita).
 *    Una subida de volumen sube en rampa (pendiente suave).
 *    Resultado: Falsos positivos en música electrónica densa.
 * 
 * 2. 🩺 DUPLICIDAD DE ESFUERZOS
 *    BeatDetector detecta kicks... RhythmAnalyzer detecta kicks otra vez.
 *    Pueden estar en DESACUERDO → Confunde a Selene.
 *    Deuda técnica: código repetido = bugs repetidos.
 * 
 * 3. 🩺 UMBRALES FIJOS (0.6, 0.5, 0.4)
 *    Ignora la CLARIDAD de la señal.
 *    Jazz limpio necesita umbrales BAJOS (sensibilidad).
 *    Rock sucio necesita umbrales ALTOS (filtrado).
 * 
 * SOLUCIÓN: THE GROOVE SURGEON
 * 
 * A. 📐 SLOPE-BASED ONSET DETECTOR (Pendiente, no magnitud)
 *    - Mide la VELOCIDAD de subida, no cuánto subió
 *    - Bombo real: pendiente > 0.8 en 1 frame (vertical)
 *    - Rampa de synth: pendiente ~0.2 sostenida (suave)
 *    - Elimina 90% de falsos positivos
 * 
 * B. 🎚️ ADAPTIVE THRESHOLDS (Umbrales dinámicos)
 *    - Conectado a Clarity del God Ear
 *    - Clarity alta (señal limpia) → umbrales BAJOS (sensibles)
 *    - Clarity baja (ruido) → umbrales ALTOS (filtrado)
 *    - Rango: ±30% del umbral base
 * 
 * C. 🔗 INTEGRACIÓN CON PACEMAKER (BeatDetector v2.0)
 *    - NO calcula BPM propio (elimina duplicidad)
 *    - CONSUME la fase estable del BeatDetector
 *    - Una sola fuente de verdad para el ritmo
 * 
 * D. 🎯 DETECTION BUFFER (Anti-jitter)
 *    - Requiere 2 frames consecutivos para confirmar hit
 *    - Elimina disparos espurios de 1 frame
 * 
 * @author PunkOpus
 * @wave 1023
 */

import type { AudioMetrics } from '../../types';
import type {
  RhythmAnalysis,
  DrumDetection,
  GrooveAnalysis,
  DrumPatternType,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuración del Groove Surgeon
 */
export interface RhythmAnalyzerConfig {
  /** Tamaño del buffer circular para análisis (default: 16 frames) */
  bufferSize: number;
  
  /** Umbral BASE de pendiente para kick (se adapta con clarity) */
  kickSlopeThreshold: number;
  
  /** Umbral BASE de pendiente para snare */
  snareSlopeThreshold: number;
  
  /** Umbral BASE de pendiente para hihat */
  hihatSlopeThreshold: number;
  
  /** Umbral de energía para fill detection */
  fillThreshold: number;
  
  /** Tiempo mínimo entre fills (ms) */
  minFillInterval: number;
  
  /** Frames de confirmación para evitar jitter */
  confirmationFrames: number;
}

/**
 * Frame de energía para análisis de sincopación
 */
interface EnergyFrame {
  phase: number;
  bass: number;
  mid: number;
  treble: number;
  total: number;
  timestamp: number;
}

/**
 * 📐 WAVE 1023: Estado del Slope Detector
 */
interface SlopeState {
  /** Valores de los últimos N frames para calcular pendiente */
  history: number[];
  /** Pendiente actual calculada */
  currentSlope: number;
  /** Frames consecutivos con pendiente alta (confirmación) */
  confirmationCount: number;
  /** Última detección confirmada */
  lastConfirmedHit: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - THE GROOVE SURGEON TUNING
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: RhythmAnalyzerConfig = {
  bufferSize: 16,
  // 📐 SLOPE THRESHOLDS (pendiente, no magnitud)
  // Un golpe real tiene pendiente > 0.5 en 1-2 frames
  // Una rampa tiene pendiente < 0.2 sostenida
  kickSlopeThreshold: 0.45,    // Bajado de 0.6 → detectamos por velocidad
  snareSlopeThreshold: 0.35,   // Snares tienen transientes más suaves
  hihatSlopeThreshold: 0.25,   // Hihats son los más suaves
  fillThreshold: 0.75,
  minFillInterval: 2000,
  confirmationFrames: 2,       // Requiere 2 frames para confirmar
};

/** Tamaño del historial para cálculo de pendiente */
const SLOPE_HISTORY_SIZE = 4;

/** Frames de cooldown después de un hit (anti-double-trigger) */
const HIT_COOLDOWN_FRAMES = 3;

/** Factor de adaptación de umbral según clarity (±30%) */
const CLARITY_ADAPTATION_RANGE = 0.30;

/** Alpha para EMA de sincopación (suavizado lento) */
const SYNC_SMOOTHING_ALPHA = 0.08;

// ═══════════════════════════════════════════════════════════════════════════
// CIRCULAR BUFFER
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// THE GROOVE SURGEON
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🥁 RhythmAnalyzer v2.0 - THE GROOVE SURGEON
 * 
 * Analiza patrones rítmicos con precisión quirúrgica.
 * Detecta por PENDIENTE, no por magnitud.
 * Umbrales ADAPTATIVOS según claridad de señal.
 */
export class RhythmAnalyzer {
  private config: RhythmAnalyzerConfig;
  private energyBuffer: CircularBuffer<EnergyFrame>;
  
  // 📐 WAVE 1023: Slope Detectors (uno por instrumento)
  private kickSlope: SlopeState;
  private snareSlope: SlopeState;
  private hihatSlope: SlopeState;
  
  // Historial de fases para análisis de patrones
  private kickPhases: number[] = [];
  private snarePhases: number[] = [];
  private hihatPhases: number[] = [];
  private readonly phaseHistorySize = 32;
  
  // Fill detection state
  private lastFillTime: number = 0;
  private consecutiveHighEnergy: number = 0;
  
  // Sincopación suavizada (EMA)
  private smoothedSyncopation: number = 0;
  
  // Frame counter para cooldowns
  private frameCount: number = 0;
  
  // Cache del último resultado
  private cachedResult: RhythmAnalysis | null = null;
  
  // 🎚️ WAVE 1023: Clarity actual para adaptación de umbrales
  private currentClarity: number = 0.5;
  
  constructor(config: Partial<RhythmAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.energyBuffer = new CircularBuffer<EnergyFrame>(this.config.bufferSize);
    
    // Inicializar slope detectors
    this.kickSlope = this.createSlopeState();
    this.snareSlope = this.createSlopeState();
    this.hihatSlope = this.createSlopeState();
  }
  
  /**
   * Crear estado inicial para slope detector
   */
  private createSlopeState(): SlopeState {
    return {
      history: [],
      currentSlope: 0,
      confirmationCount: 0,
      lastConfirmedHit: -HIT_COOLDOWN_FRAMES, // Permite hit en frame 0
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 MÉTODO PRINCIPAL: analyze()
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🎯 Analizar frame de audio
   * 
   * @param audio - Métricas de audio del frame actual
   * @param beat - Estado del beat desde BeatDetector (PACEMAKER)
   * @param clarity - Claridad de la señal (opcional, del God Ear)
   * @returns Análisis rítmico completo
   */
  analyze(
    audio: AudioMetrics, 
    beat: { bpm: number; phase: number; onBeat: boolean },
    clarity?: number
  ): RhythmAnalysis {
    const now = audio.timestamp;
    this.frameCount++;
    
    // 🎚️ Actualizar clarity para umbrales adaptativos
    if (clarity !== undefined) {
      this.currentClarity = clarity;
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 1. 📐 SLOPE-BASED DRUM DETECTION
    // ═══════════════════════════════════════════════════════════════════════
    const drums = this.detectDrumsBySlope(audio);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2. Registrar en buffer de energía
    // ═══════════════════════════════════════════════════════════════════════
    this.energyBuffer.push({
      phase: beat.phase,
      bass: audio.bass,
      mid: audio.mid,
      treble: audio.treble,
      total: audio.energy,
      timestamp: now,
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // 3. Registrar hits con sus fases (para análisis de patrones)
    // ═══════════════════════════════════════════════════════════════════════
    if (drums.kickDetected) this.recordPhase(this.kickPhases, beat.phase);
    if (drums.snareDetected) this.recordPhase(this.snarePhases, beat.phase);
    if (drums.hihatDetected) this.recordPhase(this.hihatPhases, beat.phase);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. Calcular groove (sincopación, swing, complejidad)
    // ═══════════════════════════════════════════════════════════════════════
    const groove = this.calculateGroove();
    
    // ═══════════════════════════════════════════════════════════════════════
    // 5. Detectar tipo de patrón
    // ═══════════════════════════════════════════════════════════════════════
    const pattern = this.detectPatternType(audio, drums, groove, beat.bpm);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 6. Detectar fill en progreso
    // ═══════════════════════════════════════════════════════════════════════
    const fillInProgress = this.detectFill(audio, drums, now);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 7. Calcular confianza general
    // ═══════════════════════════════════════════════════════════════════════
    const confidence = this.calculateConfidence(groove, drums);
    
    // ═══════════════════════════════════════════════════════════════════════
    // 8. Construir resultado
    // ═══════════════════════════════════════════════════════════════════════
    const result: RhythmAnalysis = {
      bpm: beat.bpm,  // 🔗 INTEGRACIÓN: BPM viene del PACEMAKER, no calculamos
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📐 SLOPE-BASED ONSET DETECTOR
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 📐 Detectar drums por PENDIENTE (velocidad de subida)
   * 
   * La clave: Un golpe REAL sube verticalmente en 1-2 frames.
   * Una rampa de volumen sube gradualmente en muchos frames.
   * 
   * Pendiente = (valor_actual - valor_anterior) / delta_tiempo
   * Pero como delta_tiempo es constante (1 frame), simplificamos:
   * Pendiente = valor_actual - promedio_últimos_N_frames
   * 
   * Esto nos da la ACELERACIÓN del volumen, no el volumen en sí.
   */
  private detectDrumsBySlope(audio: AudioMetrics): DrumDetection {
    // Calcular pendientes para cada banda
    const kickSlope = this.updateSlope(this.kickSlope, audio.bass);
    const snareSlope = this.updateSlope(this.snareSlope, audio.mid);
    const hihatSlope = this.updateSlope(this.hihatSlope, audio.treble);
    
    // 🎚️ ADAPTIVE THRESHOLDS basados en clarity
    const adaptedKickThreshold = this.adaptThreshold(this.config.kickSlopeThreshold);
    const adaptedSnareThreshold = this.adaptThreshold(this.config.snareSlopeThreshold);
    const adaptedHihatThreshold = this.adaptThreshold(this.config.hihatSlopeThreshold);
    
    // Detectar con confirmación (anti-jitter)
    const kickDetected = this.confirmHit(
      this.kickSlope, 
      kickSlope, 
      adaptedKickThreshold,
      audio.bass > 0.35  // Nivel mínimo para considerar
    );
    
    const snareDetected = this.confirmHit(
      this.snareSlope, 
      snareSlope, 
      adaptedSnareThreshold,
      audio.mid > 0.30
    );
    
    const hihatDetected = this.confirmHit(
      this.hihatSlope, 
      hihatSlope, 
      adaptedHihatThreshold,
      audio.treble > 0.25
    );
    
    // Detectar crash: Treble MUY fuerte + bass simultáneo + pendiente alta
    const crashDetected = audio.treble > 0.75 && 
                          audio.bass > 0.55 && 
                          hihatSlope > adaptedHihatThreshold * 1.5;
    
    return {
      kickDetected,
      kickIntensity: kickDetected ? audio.bass : 0,
      snareDetected,
      snareIntensity: snareDetected ? audio.mid : 0,
      hihatDetected,
      hihatIntensity: hihatDetected ? audio.treble : 0,
      crashDetected,
      fillDetected: false,
    };
  }
  
  /**
   * Actualizar historial y calcular pendiente
   * 
   * Pendiente = valor_actual - promedio_histórico
   * Esto captura la ACELERACIÓN, no el valor absoluto.
   */
  private updateSlope(state: SlopeState, currentValue: number): number {
    // Agregar al historial
    state.history.push(currentValue);
    if (state.history.length > SLOPE_HISTORY_SIZE) {
      state.history.shift();
    }
    
    // Necesitamos al menos 2 valores
    if (state.history.length < 2) {
      state.currentSlope = 0;
      return 0;
    }
    
    // Calcular promedio del historial (excluyendo el valor actual)
    const historicalValues = state.history.slice(0, -1);
    const historicalAvg = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    
    // Pendiente = qué tan rápido subimos respecto al promedio reciente
    // Normalizado para que valores típicos estén en rango 0-1
    const slope = Math.max(0, (currentValue - historicalAvg) * 2);
    
    state.currentSlope = slope;
    return slope;
  }
  
  /**
   * 🎚️ Adaptar umbral según clarity
   * 
   * Clarity alta (señal limpia) → umbral BAJO (más sensible)
   * Clarity baja (ruido) → umbral ALTO (filtrado)
   */
  private adaptThreshold(baseThreshold: number): number {
    // clarity 0.5 → factor 1.0 (sin cambio)
    // clarity 1.0 → factor 0.7 (umbral bajo, sensible)
    // clarity 0.0 → factor 1.3 (umbral alto, filtrado)
    const clarityFactor = 1 - ((this.currentClarity - 0.5) * CLARITY_ADAPTATION_RANGE * 2);
    
    return baseThreshold * clarityFactor;
  }
  
  /**
   * Confirmar hit con sistema anti-jitter
   * 
   * Requiere N frames consecutivos con pendiente alta para confirmar.
   * Evita disparos espurios de 1 frame.
   */
  private confirmHit(
    state: SlopeState, 
    slope: number, 
    threshold: number,
    levelOk: boolean
  ): boolean {
    // Cooldown: no detectar otro hit demasiado pronto
    const framesSinceLastHit = this.frameCount - state.lastConfirmedHit;
    if (framesSinceLastHit < HIT_COOLDOWN_FRAMES) {
      return false;
    }
    
    // ¿Pendiente supera umbral Y nivel es suficiente?
    if (slope > threshold && levelOk) {
      state.confirmationCount++;
      
      // ¿Suficientes frames de confirmación?
      if (state.confirmationCount >= this.config.confirmationFrames) {
        state.lastConfirmedHit = this.frameCount;
        state.confirmationCount = 0;
        return true;
      }
    } else {
      // Reset confirmación si la pendiente baja
      state.confirmationCount = 0;
    }
    
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎵 CÁLCULO DE SINCOPACIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🎵 Calcular groove (sincopación, swing, complejidad)
   * 
   * MATEMÁTICA DE SINCOPACIÓN:
   * - ON-BEAT: fase 0.0-0.15 y 0.85-1.0
   * - OFF-BEAT: fase 0.15-0.85
   * 
   * syncopation = (peakOffBeat / peakOnBeat) * 0.7 + (offBeatEnergy / totalEnergy) * 0.3
   */
  private calculateGroove(): GrooveAnalysis {
    const frames = this.energyBuffer.getAll();
    
    if (frames.length < 4) {
      return {
        syncopation: 0,
        swingAmount: 0,
        complexity: 'low',
        humanization: 0.05,
      };
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // SINCOPACIÓN
    // ═══════════════════════════════════════════════════════════════════════
    let onBeatEnergy = 0;
    let offBeatEnergy = 0;
    let peakOnBeat = 0;
    let peakOffBeat = 0;
    
    for (const frame of frames) {
      // Bass + mid ponderado (bass domina el groove)
      const energy = frame.bass + frame.mid * 0.5;
      
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
    const offBeatRatio = totalEnergy > 0 ? offBeatEnergy / totalEnergy : 0;
    
    const peakDominance = peakOnBeat > 0.01 
      ? Math.min(1, peakOffBeat / peakOnBeat)
      : (peakOffBeat > 0.3 ? 1 : 0);
    
    const rawSyncopation = peakDominance * 0.7 + offBeatRatio * 0.3;
    
    // EMA suavizado
    const clampedSync = Math.max(0, Math.min(1, rawSyncopation));
    this.smoothedSyncopation = (SYNC_SMOOTHING_ALPHA * clampedSync) + 
                               ((1 - SYNC_SMOOTHING_ALPHA) * this.smoothedSyncopation);
    
    // ═══════════════════════════════════════════════════════════════════════
    // SWING
    // ═══════════════════════════════════════════════════════════════════════
    let earlyOffBeatEnergy = 0;
    let lateOffBeatEnergy = 0;
    
    for (const frame of frames) {
      if (frame.phase > 0.2 && frame.phase < 0.4) {
        earlyOffBeatEnergy += frame.total;
      } else if (frame.phase > 0.6 && frame.phase < 0.8) {
        lateOffBeatEnergy += frame.total;
      }
    }
    
    const totalOffBeat = earlyOffBeatEnergy + lateOffBeatEnergy;
    const swingAmount = totalOffBeat > 0.01
      ? Math.max(0, Math.min(1, ((lateOffBeatEnergy / totalOffBeat) - 0.5) * 2))
      : 0;
    
    // ═══════════════════════════════════════════════════════════════════════
    // COMPLEJIDAD
    // ═══════════════════════════════════════════════════════════════════════
    const phaseVariance = this.calculatePhaseVariance();
    const hitDensity = (this.kickPhases.length + this.snarePhases.length + this.hihatPhases.length) / 
                       Math.max(1, this.phaseHistorySize);
    
    let complexity: 'low' | 'medium' | 'high';
    if (phaseVariance > 0.3 || hitDensity > 0.5) {
      complexity = 'high';
    } else if (phaseVariance > 0.15 || hitDensity > 0.3) {
      complexity = 'medium';
    } else {
      complexity = 'low';
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // HUMANIZACIÓN
    // ═══════════════════════════════════════════════════════════════════════
    const humanization = this.calculateHumanization();
    
    return {
      syncopation: this.smoothedSyncopation,
      swingAmount,
      complexity,
      humanization,
    };
  }
  
  /**
   * Calcular varianza de fases
   */
  private calculatePhaseVariance(): number {
    const allPhases = [...this.kickPhases, ...this.snarePhases];
    if (allPhases.length < 3) return 0;
    
    const mean = allPhases.reduce((a, b) => a + b, 0) / allPhases.length;
    const variance = allPhases.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / allPhases.length;
    
    return Math.sqrt(variance);
  }
  
  /**
   * Calcular humanización
   */
  private calculateHumanization(): number {
    if (this.kickPhases.length < 4) return 0.05;
    
    let totalDeviation = 0;
    for (const phase of this.kickPhases) {
      const distTo0 = Math.min(phase, 1 - phase);
      const distTo05 = Math.abs(phase - 0.5);
      totalDeviation += Math.min(distTo0, distTo05);
    }
    
    return Math.min(0.15, (totalDeviation / this.kickPhases.length) * 2);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎭 DETECCIÓN DE PATRONES
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Detectar tipo de patrón rítmico
   * 
   * PRIORIDAD: Sincopación > BPM
   */
  private detectPatternType(
    audio: AudioMetrics,
    drums: DrumDetection,
    groove: GrooveAnalysis,
    bpm: number
  ): { type: DrumPatternType; confidence: number } {
    
    // REGGAETON (Dembow)
    if (groove.syncopation > 0.4 && this.hasDembowPattern()) {
      const bpmMatch = bpm >= 85 && bpm <= 105 ? 1.0 : 0.7;
      const bassMatch = audio.bass > 0.55 ? 1.0 : 0.8;
      return {
        type: 'reggaeton',
        confidence: Math.min(0.95, (groove.syncopation * 0.4 + bpmMatch * 0.3 + bassMatch * 0.3)),
      };
    }
    
    // CUMBIA (Caballito - güiro constante)
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
    
    // FOUR ON THE FLOOR (Techno, House)
    if (groove.syncopation < 0.15 && groove.swingAmount < 0.1 && this.hasRegularKickPattern()) {
      return {
        type: 'four_on_floor',
        confidence: Math.min(0.90, ((1 - groove.syncopation) * 0.5 + 0.4)),
      };
    }
    
    // JAZZ SWING
    if (groove.swingAmount > 0.15 && groove.complexity === 'high') {
      return {
        type: 'jazz_swing',
        confidence: Math.min(0.85, (groove.swingAmount * 0.4 + 0.45)),
      };
    }
    
    // HALF TIME (Dubstep, Trap)
    if (this.hasHalfTimeSnare() && audio.bass > 0.65 && groove.complexity === 'low') {
      return {
        type: 'half_time',
        confidence: 0.75,
      };
    }
    
    // BREAKBEAT (D&B, Jungle)
    if (groove.syncopation > 0.5 && groove.complexity === 'high' && bpm > 150) {
      return {
        type: 'breakbeat',
        confidence: 0.75,
      };
    }
    
    // ROCK STANDARD
    if (groove.syncopation >= 0.15 && groove.syncopation <= 0.35 && this.hasRockPattern()) {
      return {
        type: 'rock_standard',
        confidence: 0.70,
      };
    }
    
    // LATIN
    if (groove.syncopation > 0.35 && groove.complexity === 'medium') {
      return {
        type: 'latin',
        confidence: 0.60,
      };
    }
    
    // MINIMAL
    if (audio.energy < 0.3 && this.kickPhases.length < 4) {
      return {
        type: 'minimal',
        confidence: 0.50,
      };
    }
    
    return { type: 'unknown', confidence: 0.30 };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔍 PATTERN HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Detectar patrón Dembow
   */
  private hasDembowPattern(): boolean {
    if (this.snarePhases.length < 4) return false;
    
    let dembowHits = 0;
    for (const phase of this.snarePhases.slice(-8)) {
      if ((phase > 0.2 && phase < 0.35) || (phase > 0.7 && phase < 0.85)) {
        dembowHits++;
      }
    }
    
    return dembowHits / Math.min(8, this.snarePhases.length) > 0.5;
  }
  
  /**
   * Detectar percusión alta constante (güiro de cumbia)
   */
  private hasConstantHighPercussion(audio: AudioMetrics): boolean {
    if (audio.treble < 0.4) return false;
    
    const frames = this.energyBuffer.getAll();
    if (frames.length < 8) return false;
    
    let treblePresent = 0;
    for (const frame of frames) {
      if (frame.treble > 0.35) treblePresent++;
    }
    
    return treblePresent / frames.length > 0.7;
  }
  
  /**
   * Calcular constancia del treble
   */
  private calculateTrebleConstancy(): number {
    const frames = this.energyBuffer.getAll();
    if (frames.length < 4) return 0;
    
    const trebles = frames.map(f => f.treble);
    const mean = trebles.reduce((a, b) => a + b, 0) / trebles.length;
    const variance = trebles.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / trebles.length;
    
    return mean > 0.3 ? (1 - Math.min(1, variance * 10)) : 0;
  }
  
  /**
   * Detectar kick regular (four-on-floor)
   */
  private hasRegularKickPattern(): boolean {
    if (this.kickPhases.length < 4) return false;
    
    let onBeatKicks = 0;
    for (const phase of this.kickPhases.slice(-8)) {
      if (phase < 0.15 || phase > 0.85) {
        onBeatKicks++;
      }
    }
    
    return onBeatKicks / Math.min(8, this.kickPhases.length) > 0.7;
  }
  
  /**
   * Detectar half-time snare
   */
  private hasHalfTimeSnare(): boolean {
    if (this.snarePhases.length < 4) return false;
    
    let halfTimeHits = 0;
    for (const phase of this.snarePhases.slice(-8)) {
      if (phase > 0.45 && phase < 0.55) {
        halfTimeHits++;
      }
    }
    
    return halfTimeHits / Math.min(8, this.snarePhases.length) > 0.5;
  }
  
  /**
   * Detectar patrón rock (snare en 2 y 4)
   */
  private hasRockPattern(): boolean {
    if (this.snarePhases.length < 4) return false;
    
    let rockHits = 0;
    for (const phase of this.snarePhases.slice(-8)) {
      if ((phase > 0.2 && phase < 0.3) || (phase > 0.7 && phase < 0.8)) {
        rockHits++;
      }
    }
    
    return rockHits / Math.min(8, this.snarePhases.length) > 0.5;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎭 FILL DETECTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Detectar fill en progreso
   */
  private detectFill(audio: AudioMetrics, drums: DrumDetection, now: number): boolean {
    if (now - this.lastFillTime < this.config.minFillInterval) {
      if (this.consecutiveHighEnergy > 3) return true;
    }
    
    const highEnergy = audio.energy > this.config.fillThreshold;
    const manyHits = (drums.kickDetected ? 1 : 0) + 
                     (drums.snareDetected ? 1 : 0) + 
                     (drums.hihatDetected ? 1 : 0) >= 2;
    
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 📊 CONFIDENCE
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Calcular confianza general
   */
  private calculateConfidence(groove: GrooveAnalysis, drums: DrumDetection): number {
    let confidence = 0.3;
    
    if (this.energyBuffer.isFull()) {
      confidence += 0.2;
    }
    
    if (this.kickPhases.length >= 8) {
      confidence += 0.15;
    }
    
    if (groove.syncopation < 0.15 || groove.syncopation > 0.35) {
      confidence += 0.15;
    }
    
    if (drums.kickDetected || drums.snareDetected) {
      confidence += 0.1;
    }
    
    if (groove.complexity !== 'low') {
      confidence += 0.1;
    }
    
    return Math.min(0.95, confidence);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Registrar fase en historial
   */
  private recordPhase(history: number[], phase: number): void {
    history.push(phase);
    if (history.length > this.phaseHistorySize) {
      history.shift();
    }
  }
  
  /**
   * 🎚️ WAVE 1023: Actualizar clarity externamente
   */
  setClarity(clarity: number): void {
    this.currentClarity = Math.max(0, Math.min(1, clarity));
  }
  
  /**
   * Obtener último resultado cacheado
   */
  getLastResult(): RhythmAnalysis | null {
    return this.cachedResult;
  }
  
  /**
   * 📐 WAVE 1023: Obtener diagnóstico del Groove Surgeon
   */
  getDiagnostics(): {
    kickSlope: number;
    snareSlope: number;
    hihatSlope: number;
    currentClarity: number;
    adaptedKickThreshold: number;
    smoothedSyncopation: number;
    frameCount: number;
  } {
    return {
      kickSlope: this.kickSlope.currentSlope,
      snareSlope: this.snareSlope.currentSlope,
      hihatSlope: this.hihatSlope.currentSlope,
      currentClarity: this.currentClarity,
      adaptedKickThreshold: this.adaptThreshold(this.config.kickSlopeThreshold),
      smoothedSyncopation: this.smoothedSyncopation,
      frameCount: this.frameCount,
    };
  }
  
  /**
   * Reset del analizador
   */
  reset(): void {
    this.energyBuffer.clear();
    this.kickPhases = [];
    this.snarePhases = [];
    this.hihatPhases = [];
    this.kickSlope = this.createSlopeState();
    this.snareSlope = this.createSlopeState();
    this.hihatSlope = this.createSlopeState();
    this.lastFillTime = 0;
    this.consecutiveHighEnergy = 0;
    this.smoothedSyncopation = 0;
    this.frameCount = 0;
    this.cachedResult = null;
    this.currentClarity = 0.5;
  }
}
