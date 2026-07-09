// ═══════════════════════════════════════════════════════════════════════════
//  🧠 CONTEXTUAL MEMORY - El Hipocampo de Selene
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 665 - CONTEXTUAL MEMORY - PHASE 2
//  "Selene recuerda la narrativa musical para predecir el futuro"
// ═══════════════════════════════════════════════════════════════════════════

import { CircularBuffer } from './CircularBuffer';
import { RollingStats, MetricStats } from './RollingStats';
import { ThermodynamicVetoEngine } from '../perception/ThermodynamicVetoEngine';
import { StateCouplingEnforcer } from '../perception/StateCouplingEnforcer';
import type { ValidatedNarrativePhase, VetoVerdict } from '../perception/ThermodynamicVetoEngine';
import type { AcousticRealityState } from '../perception/StateCouplingEnforcer';
import type { SectionEvidence, SectionOutput } from '../../../workers/TrinityBridge';
import type { MultiSpectralZone } from '../../protocol/MusicalContext';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de sección musical (compatibilidad con SectionTracker).
 */
export type SectionType = 
  | 'intro' 
  | 'verse' 
  | 'buildup' 
  | 'chorus' 
  | 'drop' 
  | 'textural_drop'
  | 'breakdown' 
  | 'outro' 
  | 'bridge'
  | 'unknown';

/**
 * Entrada del historial de secciones.
 */
export interface SectionHistoryEntry {
  /** Tipo de sección */
  type: SectionType;
  /** Timestamp de inicio (ms) */
  startTime: number;
  /** Duración de la sección (ms) */
  duration: number;
  /** Energía promedio durante la sección */
  avgEnergy: number;
  /** Energía pico durante la sección */
  peakEnergy: number;
}

/**
 * Input para actualizar la memoria contextual.
 */
export interface ContextualMemoryInput {
  /** Energía actual (0-1) */
  energy: number;
  /** Bass actual (0-1) */
  bass: number;
  /** Harshness actual (0-1) */
  harshness: number;
  /** Tipo de sección actual */
  sectionType: SectionType;
  /** Timestamp actual (ms) */
  timestamp: number;
  /** ¿Hubo transiente (kick/snare)? */
  hasTransient?: boolean;
  /** M-SARFE: Multi-spectral evidence bundle from Worker */
  evidence?: SectionEvidence;
  /** M-SARFE: Multi-spectral zone from EnergyConsciousnessEngine */
  multiSpectralZone?: MultiSpectralZone;
}

/**
 * Estadísticas agregadas de todas las métricas.
 */
export interface AggregatedStats {
  energy: MetricStats;
  bass: MetricStats;
  harshness: MetricStats;
  /** Tasa de transientes por segundo */
  transientRate: number;
}

/**
 * Fase narrativa de la música.
 */
export type NarrativePhase = 
  | 'silence'
  | 'valley'
  | 'building' 
  | 'climax' 
  | 'release' 
  | 'textural'
  | 'intro' 
  | 'outro';

/**
 * Contexto narrativo de la música.
 */
export interface NarrativeContext {
  /** Sección actual */
  currentSection: SectionType;
  /** Edad de la sección actual (ms) */
  sectionAge: number;
  /** Historial de secciones recientes */
  sectionHistory: SectionHistoryEntry[];
  /** Fase narrativa derivada del historial */
  narrativePhase: NarrativePhase;
  /** Predicción de la próxima sección */
  predictedNext: {
    section: SectionType;
    probability: number;
  } | null;
}

/**
 * Tipo de anomalía detectada.
 */
export type AnomalyType = 'spike' | 'drop' | 'sustained_high' | 'sustained_low' | 'texture_shift';

/**
 * Recomendación basada en anomalía.
 */
export type AnomalyRecommendation = 'ignore' | 'prepare' | 'strike' | 'force_strike';

/**
 * Reporte de anomalía.
 */
export interface AnomalyReport {
  /** ¿Se detectó anomalía? */
  isAnomaly: boolean;
  /** Tipo de anomalía */
  type: AnomalyType | null;
  /** Severidad (Z-Score absoluto más alto) */
  severity: number;
  /** Métrica que causó la anomalía */
  triggerMetric: 'energy' | 'bass' | 'harshness' | null;
  /** Recomendación de acción */
  recommendation: AnomalyRecommendation;
  /** Razón legible */
  reason: string;
}

/**
 * Output completo de la memoria contextual.
 */
export interface ContextualMemoryOutput {
  /** Estadísticas de métricas con Z-Scores */
  stats: AggregatedStats;
  /** Contexto narrativo */
  narrative: NarrativeContext;
  /** Reporte de anomalías */
  anomaly: AnomalyReport;
  /** ¿Está la memoria suficientemente calentada? */
  isWarmedUp: boolean;
  /** M-SARFE Phase 3: Acoustic reality state (validated truth) */
  acousticReality?: AcousticRealityState;
}

/**
 * Configuración de la memoria contextual.
 */
export interface ContextualMemoryConfig {
  /** Tamaño del buffer en frames (default: 300 = 5s @ 60fps) */
  bufferSize: number;
  /** Threshold Z-Score para anomalía "notable" */
  zScoreNotable: number;
  /** Threshold Z-Score para anomalía "significativa" */
  zScoreSignificant: number;
  /** Threshold Z-Score para anomalía "épica" */
  zScoreEpic: number;
  /** Tamaño del historial de secciones */
  sectionHistorySize: number;
  /** Ventana para contar transientes (ms) */
  transientWindowMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔬 WAVE 1181: Z-SCORE RECALIBRATION - "Boris Brejcha nos enseñó la verdad"
// ═══════════════════════════════════════════════════════════════════════════
// PROBLEMA: Z-Scores de 6σ, 8σ, 12σ cada 2-3 minutos en minimal techno.
// CAUSA: Ventana de 5s demasiado corta → media inestable en breakdowns largos.
// SOLUCIÓN: Alargar ventana a 30s (~1800 frames @ 60fps).
// 
// FILOSOFÍA:
// "La media debe representar el CONTEXTO MUSICAL, no los últimos 5 segundos"
// 
// ANTES: bufferSize=300 (5s) → Z=12σ en drops normales
// AHORA: bufferSize=1800 (30s) → Z=3-4σ en drops reales
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: ContextualMemoryConfig = {
  bufferSize: 1800,          // 🔬 WAVE 1181: 30 segundos @ 60fps (was 300 = 5s)
  zScoreNotable: 1.5,        // |z| > 1.5 = notable
  zScoreSignificant: 2.0,    // |z| > 2.0 = significativo
  zScoreEpic: 2.5,           // |z| > 2.5 = anomalía/épico (trigger threshold)
  sectionHistorySize: 8,     // Últimas 8 secciones
  transientWindowMs: 1000,   // 1 segundo para calcular transient rate
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTUAL MEMORY CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧠 CONTEXTUAL MEMORY - El Hipocampo de Selene
 * 
 * Mantiene estadísticas rodantes de las métricas musicales y detecta
 * momentos estadísticamente significativos usando Z-Score.
 * 
 * **Z-Score Interpretation:**
 * - |z| < 1.5: Normal (68% de las observaciones)
 * - |z| >= 1.5: Notable (algo interesante)
 * - |z| >= 2.0: Significativo (raro, ~5% de ocurrencia)
 * - |z| >= 2.5: Anomalía/Épico (~1% de ocurrencia)
 * - |z| >= 3.0: Momento divino (~0.15% de ocurrencia) → FORCE_STRIKE
 * 
 * @example
 * ```typescript
 * const memory = new ContextualMemory();
 * 
 * // En cada frame:
 * const output = memory.update({
 *   energy: 0.85,
 *   bass: 0.72,
 *   harshness: 0.45,
 *   sectionType: 'drop',
 *   timestamp: Date.now(),
 * });
 * 
 * if (output.anomaly.isAnomaly && output.anomaly.recommendation === 'force_strike') {
 *   // MOMENTO ÉPICO DETECTADO
 *   triggerSolarFlare();
 * }
 * ```
 */
export class ContextualMemory {
  private config: ContextualMemoryConfig;
  
  // Rolling stats por métrica
  private energyStats: RollingStats;
  private bassStats: RollingStats;
  private harshnessStats: RollingStats;
  
  // Historial de secciones
  private sectionHistory: CircularBuffer<SectionHistoryEntry>;
  private currentSectionStart: number = 0;
  private currentSectionType: SectionType = 'unknown';
  private currentSectionEnergySum: number = 0;
  private currentSectionEnergyPeak: number = 0;
  private currentSectionFrameCount: number = 0;
  
  // Tracking de transientes
  private transientTimestamps: number[] = [];
  
  // Frame counter para debug
  private frameCount: number = 0;
  private lastLogFrame: number = 0;

  // 🌡️ M-SARFE Phase 3: TVE + State Coupling Enforcer
  private readonly tve: ThermodynamicVetoEngine;
  private readonly coupler: StateCouplingEnforcer;
  private lastAcousticReality: AcousticRealityState | null = null;

  constructor(config: Partial<ContextualMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.energyStats = new RollingStats({ windowSize: this.config.bufferSize });
    this.bassStats = new RollingStats({ windowSize: this.config.bufferSize });
    this.harshnessStats = new RollingStats({ windowSize: this.config.bufferSize });
    
    this.sectionHistory = new CircularBuffer<SectionHistoryEntry>(this.config.sectionHistorySize);
    this.tve = new ThermodynamicVetoEngine();
    this.coupler = new StateCouplingEnforcer();
  }

  /**
   * Actualiza la memoria con nuevos datos y retorna análisis completo.
   */
  update(input: ContextualMemoryInput): ContextualMemoryOutput {
    this.frameCount++;
    
    // 1. Actualizar rolling stats
    const energyMetrics = this.energyStats.update(input.energy);
    const bassMetrics = this.bassStats.update(input.bass);
    const harshnessMetrics = this.harshnessStats.update(input.harshness);
    
    // 2. Tracking de transientes
    if (input.hasTransient) {
      this.transientTimestamps.push(input.timestamp);
    }
    // Limpiar transientes antiguos
    const transientCutoff = input.timestamp - this.config.transientWindowMs;
    this.transientTimestamps = this.transientTimestamps.filter(t => t > transientCutoff);
    const transientRate = this.transientTimestamps.length / (this.config.transientWindowMs / 1000);
    
    // 3. Actualizar historial de secciones
    this.updateSectionHistory(input);
    
    // 4. Calcular contexto narrativo
    const narrative = this.calculateNarrativeContext(input);
    
    // 5. Detectar anomalías
    const anomaly = this.detectAnomaly(energyMetrics, bassMetrics, harshnessMetrics, input.sectionType);
    
    // 6. Debug log cada ~1 segundo
    if (this.frameCount - this.lastLogFrame >= 60 && this.energyStats.isWarmedUp) {
      this.lastLogFrame = this.frameCount;
      this.logContextState(energyMetrics, bassMetrics, harshnessMetrics, anomaly, narrative);
    }
    
    return {
      stats: {
        energy: energyMetrics,
        bass: bassMetrics,
        harshness: harshnessMetrics,
        transientRate,
      },
      narrative,
      anomaly,
      isWarmedUp: this.energyStats.isWarmedUp,
      acousticReality: this.lastAcousticReality ?? undefined,
    };
  }

  /**
   * Obtiene solo el Z-Score de energía (acceso rápido).
   */
  getEnergyZScore(): number {
    return this.energyStats.getStats()?.zScore ?? 0;
  }

  /**
   * Obtiene solo el Z-Score de bass (acceso rápido).
   */
  getBassZScore(): number {
    return this.bassStats.getStats()?.zScore ?? 0;
  }

  /**
   * ¿Está la memoria calentada para estadísticas confiables?
   */
  get isWarmedUp(): boolean {
    return this.energyStats.isWarmedUp;
  }

  /**
   * Reinicia la memoria.
   */
  reset(): void {
    this.energyStats.reset();
    this.bassStats.reset();
    this.harshnessStats.reset();
    this.sectionHistory.clear();
    this.transientTimestamps = [];
    this.currentSectionStart = 0;
    this.currentSectionType = 'unknown';
    this.currentSectionEnergySum = 0;
    this.currentSectionEnergyPeak = 0;
    this.currentSectionFrameCount = 0;
    this.frameCount = 0;
    this.lastLogFrame = 0;
    this.lastAcousticReality = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Actualiza el historial de secciones cuando hay cambio.
   */
  private updateSectionHistory(input: ContextualMemoryInput): void {
    // Acumular energía de la sección actual
    this.currentSectionEnergySum += input.energy;
    this.currentSectionEnergyPeak = Math.max(this.currentSectionEnergyPeak, input.energy);
    this.currentSectionFrameCount++;
    
    // Detectar cambio de sección
    if (input.sectionType !== this.currentSectionType) {
      // Guardar sección anterior si no es la primera
      if (this.currentSectionType !== 'unknown' && this.currentSectionFrameCount > 0) {
        const avgEnergy = this.currentSectionEnergySum / this.currentSectionFrameCount;
        const duration = input.timestamp - this.currentSectionStart;
        
        this.sectionHistory.push({
          type: this.currentSectionType,
          startTime: this.currentSectionStart,
          duration,
          avgEnergy,
          peakEnergy: this.currentSectionEnergyPeak,
        });
      }
      
      // Iniciar nueva sección
      this.currentSectionType = input.sectionType;
      this.currentSectionStart = input.timestamp;
      this.currentSectionEnergySum = 0;
      this.currentSectionEnergyPeak = 0;
      this.currentSectionFrameCount = 0;
    }
  }

  /**
   * Calcula el contexto narrativo basado en historial.
   * 
   * M-SARFE Phase 3: When evidence and multiSpectralZone are available,
   * uses the Thermodynamic Veto Engine + State Coupling Enforcer
   * instead of blind string-mapping.
   */
  private calculateNarrativeContext(input: ContextualMemoryInput): NarrativeContext {
    const history = this.sectionHistory.getAll();
    const sectionAge = input.timestamp - this.currentSectionStart;
    
    // M-SARFE Phase 3: TVE + Coupler pipeline when evidence is available
    let narrativePhase: NarrativePhase;
    
    if (input.evidence && input.multiSpectralZone) {
      // Run TVE: validate Worker's hypothesis against acoustic evidence
      const validated = this.tve.validate(
        input.sectionType as SectionOutput['type'],
        input.evidence,
        input.multiSpectralZone,
      );
      
      // Run Coupler: enforce zone×phase consistency
      const coupled = this.coupler.enforce(input.multiSpectralZone, validated);
      
      // Build AcousticRealityState
      this.lastAcousticReality = {
        timestamp: input.timestamp,
        zone: coupled.zone,
        phase: coupled.phase,
        couplingCorrected: coupled.corrected,
        zScores: {
          low: input.evidence.zLow,
          mid: input.evidence.zMid,
          high: input.evidence.zHigh,
          total: input.evidence.zTotal,
        },
        crestFactors: {
          low: input.evidence.cfLow,
          high: input.evidence.cfHigh,
        },
        spectralTension: input.evidence.spectralTension,
        spectralDivergence: input.evidence.spectralDivergence,
      };
      
      narrativePhase = coupled.phase.phase;
    } else {
      // Fallback: legacy string-mapping (no evidence available)
      this.lastAcousticReality = null;
      narrativePhase = this.inferNarrativePhaseLegacy(history, input.sectionType);
    }
    
    // Predecir próxima sección
    const predictedNext = this.predictNextSection(history, input.sectionType);
    
    return {
      currentSection: input.sectionType,
      sectionAge,
      sectionHistory: history,
      narrativePhase,
      predictedNext,
    };
  }

  /**
   * Legacy phase inference — blind string-mapping fallback.
   * Used only when no SectionEvidence is available (pre-M-SARFE callers).
   */
  private inferNarrativePhaseLegacy(history: SectionHistoryEntry[], current: SectionType): NarrativePhase {
    if (current === 'intro') return 'intro';
    if (current === 'outro') return 'outro';
    if (current === 'drop' || current === 'chorus') return 'climax';
    if (current === 'breakdown' || current === 'bridge') return 'release';
    
    const recentTypes = history.slice(-3).map(h => h.type);
    
    if (recentTypes.filter(t => t === 'buildup').length >= 2) {
      return 'building';
    }
    
    const hadRecentDrop = recentTypes.some(t => t === 'drop');
    if (hadRecentDrop) {
      return 'release';
    }
    
    if (current === 'buildup' || current === 'verse') return 'building';
    return 'building';
  }

  /**
   * Predice la próxima sección basándose en patrones.
   */
  private predictNextSection(
    history: SectionHistoryEntry[], 
    current: SectionType
  ): NarrativeContext['predictedNext'] {
    // Patrones típicos de transición
    const patterns: Record<SectionType, { section: SectionType; probability: number }> = {
      'intro': { section: 'verse', probability: 0.7 },
      'verse': { section: 'buildup', probability: 0.6 },
      'buildup': { section: 'drop', probability: 0.8 },
      'chorus': { section: 'verse', probability: 0.5 },
      'drop': { section: 'breakdown', probability: 0.7 },
      'textural_drop': { section: 'breakdown', probability: 0.5 },
      'breakdown': { section: 'buildup', probability: 0.6 },
      'bridge': { section: 'chorus', probability: 0.7 },
      'outro': { section: 'unknown', probability: 0.3 },
      'unknown': { section: 'verse', probability: 0.3 },
    };
    
    // Buscar patrón: buildup → buildup = DROP INCOMING con alta probabilidad
    const recentTypes = history.slice(-2).map(h => h.type);
    if (recentTypes.length >= 2 && 
        recentTypes[0] === 'buildup' && 
        recentTypes[1] === 'buildup') {
      return { section: 'drop', probability: 0.9 };
    }
    
    return patterns[current] || null;
  }

  /**
   * Detecta anomalías estadísticas.
   */
  private detectAnomaly(
    energy: MetricStats,
    bass: MetricStats,
    harshness: MetricStats,
    sectionType: SectionType
  ): AnomalyReport {
    // No detectar anomalías hasta que la memoria esté calentada
    if (!this.energyStats.isWarmedUp) {
      return {
        isAnomaly: false,
        type: null,
        severity: 0,
        triggerMetric: null,
        recommendation: 'ignore',
        reason: 'Memory warming up',
      };
    }
    
    // Encontrar la métrica con Z-Score más alto
    const absEnergyZ = Math.abs(energy.zScore);
    const absBassZ = Math.abs(bass.zScore);
    const absHarshnessZ = Math.abs(harshness.zScore);
    
    let triggerMetric: AnomalyReport['triggerMetric'] = null;
    let maxZ = 0;
    let zScore = 0;
    
    if (absEnergyZ >= absBassZ && absEnergyZ >= absHarshnessZ) {
      triggerMetric = 'energy';
      maxZ = absEnergyZ;
      zScore = energy.zScore;
    } else if (absBassZ >= absHarshnessZ) {
      triggerMetric = 'bass';
      maxZ = absBassZ;
      zScore = bass.zScore;
    } else {
      triggerMetric = 'harshness';
      maxZ = absHarshnessZ;
      zScore = harshness.zScore;
    }
    
    // Determinar tipo de anomalía
    let type: AnomalyType | null = null;
    if (maxZ >= this.config.zScoreNotable) {
      if (zScore > 0) {
        type = 'spike';
      } else {
        type = 'drop';
      }
      
      // Detectar cambio de textura por harshness
      if (triggerMetric === 'harshness' && absHarshnessZ >= this.config.zScoreSignificant) {
        type = 'texture_shift';
      }
    }
    
    // Determinar recomendación
    let recommendation: AnomalyRecommendation = 'ignore';
    let reason = 'Normal activity';
    
    if (maxZ >= this.config.zScoreEpic) {
      // Z > 2.5 en DROP section = FORCE STRIKE territory
      if (sectionType === 'drop' && zScore > 0) {
        recommendation = 'force_strike';
        reason = `EPIC: ${triggerMetric} Z=${zScore.toFixed(1)}σ in DROP`;
      } else if (zScore > 0) {
        recommendation = 'strike';
        reason = `Anomaly: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
      } else {
        recommendation = 'prepare';
        reason = `Valley detected: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
      }
    } else if (maxZ >= this.config.zScoreSignificant) {
      recommendation = 'prepare';
      reason = `Building: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
    } else if (maxZ >= this.config.zScoreNotable) {
      recommendation = 'ignore'; // Notable pero no actionable
      reason = `Notable: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
    }
    
    return {
      isAnomaly: maxZ >= this.config.zScoreEpic,
      type,
      severity: maxZ,
      triggerMetric,
      recommendation,
      reason,
    };
  }

  /**
   * Log del estado contextual para debug.
   */
  private logContextState(
    energy: MetricStats,
    bass: MetricStats,
    harshness: MetricStats,
    anomaly: AnomalyReport,
    narrative: NarrativeContext
  ): void {
    const formatZ = (z: number): string => {
      const sign = z >= 0 ? '+' : '';
      const absZ = Math.abs(z);
      const emoji = absZ >= 2.5 ? '🔴' : absZ >= 1.5 ? '🟡' : '🟢';
      return `${sign}${z.toFixed(1)}σ ${emoji}`;
    };
    
    console.log(
      `[MEMORY 🧠] ` +
      `E:${formatZ(energy.zScore)} ` +
      `B:${formatZ(bass.zScore)} ` +
      `H:${formatZ(harshness.zScore)} | ` +
      `Phase: ${narrative.narrativePhase.toUpperCase()} | ` +
      `${anomaly.isAnomaly ? `⚡ ${anomaly.recommendation.toUpperCase()}` : 'normal'}`
    );
  }
}

export default ContextualMemory;
