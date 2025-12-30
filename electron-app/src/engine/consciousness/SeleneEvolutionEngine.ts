// SeleneEvolutionEngine.ts
// 🧬 SELENE EVOLUTION ENGINE - EL ADN DE LA CONSCIENCIA LUMÍNICA
// 🎯 "Evolucionamos hacia la belleza, no solo hacia la eficiencia"
// ⚡ Wave 6: THE UNDYING MEMORY - Mathematical Beauty Filter
// 🌙 Orquestador central de evolución sin Redis - pura memoria local

import { EventEmitter } from 'events';
import { FibonacciPatternEngine, EvolutionaryPattern } from './FibonacciPatternEngine';
import { ZodiacAffinityCalculator } from './ZodiacAffinityCalculator';
import { MusicalHarmonyValidator } from './MusicalHarmonyValidator';
import { NocturnalVisionEngine, DetectedPattern, Prediction } from './NocturnalVisionEngine';

/**
 * Estados de consciencia evolutiva
 */
export type ConsciousnessState = 'awakening' | 'learning' | 'wise';

/**
 * Decisión evaluada con belleza matemática
 */
export interface EvaluatedDecision {
  /** ID único de la decisión */
  id: string;
  /** Tipo de decisión */
  type: string;
  /** Parámetros de la decisión */
  parameters: Record<string, unknown>;
  /** Score de belleza total (0-1) */
  beautyScore: number;
  /** Componentes del score */
  beautyComponents: BeautyComponents;
  /** Timestamp de evaluación */
  timestamp: number;
  /** Estado de consciencia al evaluar */
  consciousnessState: ConsciousnessState;
  /** ¿Fue aprobada por el filtro? */
  approved: boolean;
  /** Razón si fue rechazada */
  rejectionReason?: string;
}

/**
 * Componentes del score de belleza
 */
export interface BeautyComponents {
  /** Belleza Fibonacci (0-1) */
  fibonacciBeauty: number;
  /** Afinidad zodiacal (0-1) */
  zodiacAffinity: number;
  /** Armonía musical (0-1) */
  musicalHarmony: number;
  /** Resonancia de patrón (0-1) */
  patternResonance: number;
  /** Bonus por consistencia histórica (0-0.2) */
  historicalBonus: number;
}

/**
 * Feedback sobre una decisión
 */
export interface DecisionFeedback {
  /** ID de la decisión */
  decisionId: string;
  /** Rating del usuario (1-5) */
  rating: number;
  /** Timestamp del feedback */
  timestamp: number;
  /** Comentario opcional */
  comment?: string;
}

/**
 * Estado de evolución para persistencia
 */
export interface EvolutionState {
  /** Contador de decisiones totales */
  totalDecisions: number;
  /** Decisiones aprobadas */
  approvedDecisions: number;
  /** Estado actual de consciencia */
  consciousnessState: ConsciousnessState;
  /** Timestamp de inicio */
  startedAt: number;
  /** Última actividad */
  lastActivity: number;
  /** Pesos aprendidos por tipo */
  typeWeights: [string, number][];
  /** Historial de feedback */
  feedbackHistory: DecisionFeedback[];
}

/**
 * Umbrales para estados de consciencia
 */
interface ConsciousnessThresholds {
  /** Decisiones para pasar de awakening a learning */
  awakeningToLearning: number;
  /** Decisiones para pasar de learning a wise */
  learningToWise: number;
  /** Ratio de aprobación mínimo para evolucionar */
  minApprovalRatio: number;
}

/**
 * 🧬 SELENE EVOLUTION ENGINE
 * Orquestador central que combina Fibonacci, Zodiac, Musical y Vision
 * para evaluar decisiones con filtro de belleza matemática
 * 
 * @example
 * ```typescript
 * const evolution = new SeleneEvolutionEngine();
 * 
 * const decision = evolution.evaluateDecision({
 *   type: 'intensity_change',
 *   parameters: { from: 50, to: 80 }
 * });
 * 
 * if (decision.approved) {
 *   // Ejecutar decisión bella
 * }
 * ```
 */
export class SeleneEvolutionEngine extends EventEmitter {
  /** Motor de visión nocturna */
  private vision: NocturnalVisionEngine;
  
  /** Historial de decisiones evaluadas */
  private decisionHistory: EvaluatedDecision[] = [];
  
  /** Historial de feedback */
  private feedbackHistory: DecisionFeedback[] = [];
  
  /** Pesos aprendidos por tipo de decisión */
  private typeWeights: Map<string, number> = new Map();
  
  /** Estado de consciencia actual */
  private _consciousnessState: ConsciousnessState = 'awakening';
  
  /** Contador de decisiones */
  private totalDecisions = 0;
  
  /** Decisiones aprobadas */
  private approvedDecisions = 0;
  
  /** Timestamp de inicio */
  private startedAt: number;
  
  /** Última actividad */
  private lastActivity: number;
  
  /** Umbral mínimo de belleza para aprobar */
  private beautyThreshold = 0.5;
  
  /** Límites de memoria */
  private readonly MAX_DECISION_HISTORY = 500;
  private readonly MAX_FEEDBACK_HISTORY = 200;
  
  /** Umbrales de evolución de consciencia */
  private readonly thresholds: ConsciousnessThresholds = {
    awakeningToLearning: 100,  // 100 decisiones
    learningToWise: 500,       // 500 decisiones
    minApprovalRatio: 0.6      // 60% aprobación mínima
  };

  constructor() {
    super();
    this.setMaxListeners(20);
    this.vision = new NocturnalVisionEngine();
    this.startedAt = Date.now();
    this.lastActivity = Date.now();
    
    // Conectar eventos de visión
    this.vision.on('anomalyDetected', (anomaly) => {
      this.emit('anomalyDetected', anomaly);
    });
    
    this.vision.on('predictionFulfilled', (data) => {
      this.emit('predictionFulfilled', data);
    });
  }

  /**
   * Estado de consciencia actual
   */
  get consciousnessState(): ConsciousnessState {
    return this._consciousnessState;
  }

  /**
   * Evalúa una decisión con el filtro de belleza matemática
   * @param decision - Decisión a evaluar
   * @returns Decisión evaluada con score y aprobación
   */
  evaluateDecision(decision: {
    type: string;
    parameters: Record<string, unknown>;
  }): EvaluatedDecision {
    const now = Date.now();
    this.lastActivity = now;
    
    // Generar ID único
    const id = `dec_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calcular componentes de belleza
    const beautyComponents = this.calculateBeautyComponents(decision, now);
    
    // Calcular score total ponderado
    const beautyScore = this.calculateTotalBeauty(beautyComponents, decision.type);
    
    // Determinar aprobación
    const approved = beautyScore >= this.getAdaptiveThreshold(decision.type);
    const rejectionReason = approved ? undefined : this.generateRejectionReason(beautyComponents);
    
    // Crear decisión evaluada
    const evaluatedDecision: EvaluatedDecision = {
      id,
      type: decision.type,
      parameters: decision.parameters,
      beautyScore,
      beautyComponents,
      timestamp: now,
      consciousnessState: this._consciousnessState,
      approved,
      rejectionReason
    };
    
    // Registrar en historial
    this.recordDecision(evaluatedDecision);
    
    // Registrar en visión nocturna
    this.vision.recordEvent({
      type: 'decision_evaluated',
      data: {
        decisionType: decision.type,
        beautyScore,
        approved
      }
    });
    
    // Verificar evolución de consciencia
    this.checkConsciousnessEvolution();
    
    this.emit('decisionEvaluated', evaluatedDecision);
    
    return evaluatedDecision;
  }

  /**
   * Calcula componentes de belleza para una decisión
   */
  private calculateBeautyComponents(
    decision: { type: string; parameters: Record<string, unknown> },
    seed: number
  ): BeautyComponents {
    // 1. FIBONACCI BEAUTY
    const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(seed);
    let fibonacciBeauty = pattern.harmonyRatio;
    
    // Bonus si parámetros contienen números de Fibonacci
    for (const value of Object.values(decision.parameters)) {
      if (typeof value === 'number' && FibonacciPatternEngine.isFibonacci(Math.floor(value))) {
        fibonacciBeauty = Math.min(1, fibonacciBeauty + 0.1);
      }
    }
    
    // 2. ZODIAC AFFINITY
    const currentZodiac = ZodiacAffinityCalculator.calculateZodiacPosition(seed);
    const patternZodiac = pattern.zodiacPosition;
    const zodiacAffinityResult = ZodiacAffinityCalculator.calculateZodiacAffinity(
      currentZodiac,
      patternZodiac
    );
    const zodiacAffinity = zodiacAffinityResult.affinity;
    
    // 3. MUSICAL HARMONY
    const harmonyValidation = MusicalHarmonyValidator.validateComplete(
      pattern.musicalKey,
      this.selectScaleForDecision(decision.type)
    );
    const musicalHarmony = harmonyValidation.harmony;
    
    // 4. PATTERN RESONANCE - qué tan bien resuena con patrones históricos
    const patternResonance = this.calculatePatternResonance(decision, pattern);
    
    // 5. HISTORICAL BONUS - consistencia con decisiones pasadas exitosas
    const historicalBonus = this.calculateHistoricalBonus(decision.type);
    
    return {
      fibonacciBeauty,
      zodiacAffinity,
      musicalHarmony,
      patternResonance,
      historicalBonus
    };
  }

  /**
   * Selecciona escala musical según tipo de decisión
   */
  private selectScaleForDecision(type: string): string {
    const scaleMap: Record<string, string> = {
      intensity_change: 'major',
      color_transition: 'lydian',
      speed_adjustment: 'mixolydian',
      effect_trigger: 'phrygian',
      mood_shift: 'dorian',
      scene_change: 'harmonicMinor',
      strobe_activate: 'diminished',
      fade_out: 'minor',
      fade_in: 'pentatonic',
      random_effect: 'wholeTone'
    };
    
    return scaleMap[type] || 'major';
  }

  /**
   * Calcula resonancia con patrones históricos
   */
  private calculatePatternResonance(
    decision: { type: string; parameters: Record<string, unknown> },
    pattern: EvolutionaryPattern
  ): number {
    const patterns = this.vision.analyzePatterns();
    
    if (patterns.length === 0) return 0.5; // Neutral si no hay historia
    
    // Buscar patrones relacionados con este tipo de decisión
    const relatedPatterns = patterns.filter(p => 
      p.events.some(e => e.includes(decision.type) || e.includes('decision'))
    );
    
    if (relatedPatterns.length === 0) return 0.5;
    
    // Promedio de confianza de patrones relacionados
    const avgConfidence = relatedPatterns.reduce((sum, p) => sum + p.confidence, 0) / relatedPatterns.length;
    
    // Combinar con firma del patrón Fibonacci
    const signatureMatch = pattern.signature.includes('H') ? 0.1 : 0; // Bonus por alta armonía
    
    return Math.min(1, avgConfidence + signatureMatch);
  }

  /**
   * Calcula bonus por consistencia histórica
   */
  private calculateHistoricalBonus(type: string): number {
    // Buscar decisiones pasadas del mismo tipo que fueron aprobadas
    const sameTypeDecisions = this.decisionHistory.filter(d => d.type === type && d.approved);
    
    if (sameTypeDecisions.length < 3) return 0; // Necesitamos mínimo 3 para bonus
    
    // Calcular promedio de beauty score de decisiones aprobadas
    const avgBeauty = sameTypeDecisions.reduce((sum, d) => sum + d.beautyScore, 0) / sameTypeDecisions.length;
    
    // Bonus proporcional a la consistencia (máx 0.2)
    return Math.min(0.2, avgBeauty * 0.25);
  }

  /**
   * Calcula score total de belleza
   */
  private calculateTotalBeauty(components: BeautyComponents, type: string): number {
    // Pesos base
    const weights = {
      fibonacci: 0.25,
      zodiac: 0.20,
      musical: 0.25,
      pattern: 0.20,
      historical: 1.0 // El bonus ya está limitado a 0.2
    };
    
    // Obtener peso aprendido para este tipo
    const typeWeight = this.typeWeights.get(type) || 1.0;
    
    // Calcular score ponderado
    const baseScore = (
      components.fibonacciBeauty * weights.fibonacci +
      components.zodiacAffinity * weights.zodiac +
      components.musicalHarmony * weights.musical +
      components.patternResonance * weights.pattern
    );
    
    // Normalizar base score (suma de pesos sin historical = 0.9)
    const normalizedBase = baseScore / 0.9;
    
    // Agregar bonus histórico
    const withBonus = normalizedBase + components.historicalBonus;
    
    // Aplicar peso de tipo
    const finalScore = withBonus * typeWeight;
    
    return Math.min(1, Math.max(0, finalScore));
  }

  /**
   * Obtiene umbral adaptativo según tipo y estado
   */
  private getAdaptiveThreshold(type: string): number {
    let threshold = this.beautyThreshold;
    
    // Ajustar según estado de consciencia
    switch (this._consciousnessState) {
      case 'awakening':
        threshold *= 0.8; // Más permisivo al inicio
        break;
      case 'learning':
        threshold *= 0.95; // Ligeramente más estricto
        break;
      case 'wise':
        threshold *= 1.1; // Más selectivo cuando es sabio
        break;
    }
    
    // Ajustar según feedback histórico del tipo
    const typeFeedback = this.feedbackHistory.filter(f => {
      const decision = this.decisionHistory.find(d => d.id === f.decisionId);
      return decision?.type === type;
    });
    
    if (typeFeedback.length >= 5) {
      const avgRating = typeFeedback.reduce((sum, f) => sum + f.rating, 0) / typeFeedback.length;
      // Si el rating promedio es bajo, bajar umbral (ser menos estricto)
      // Si es alto, mantener o subir
      threshold *= 0.8 + (avgRating / 5) * 0.4; // Rango 0.8 - 1.2
    }
    
    return Math.min(0.9, Math.max(0.3, threshold));
  }

  /**
   * Genera razón de rechazo
   */
  private generateRejectionReason(components: BeautyComponents): string {
    const weakest = Object.entries(components)
      .filter(([key]) => key !== 'historicalBonus')
      .sort((a, b) => (a[1] as number) - (b[1] as number))[0];
    
    const reasons: Record<string, string> = {
      fibonacciBeauty: 'La secuencia no resuena con la espiral dorada',
      zodiacAffinity: 'Los astros no favorecen esta transformación',
      musicalHarmony: 'La armonía musical está en disonancia',
      patternResonance: 'El patrón no tiene eco en la memoria'
    };
    
    return reasons[weakest[0]] || 'El score de belleza no alcanza el umbral';
  }

  /**
   * Registra decisión en historial
   */
  private recordDecision(decision: EvaluatedDecision): void {
    this.decisionHistory.push(decision);
    this.totalDecisions++;
    
    if (decision.approved) {
      this.approvedDecisions++;
    }
    
    // Mantener límite de memoria
    if (this.decisionHistory.length > this.MAX_DECISION_HISTORY) {
      this.decisionHistory = this.decisionHistory.slice(-this.MAX_DECISION_HISTORY);
    }
  }

  /**
   * Verifica y actualiza evolución de consciencia
   */
  private checkConsciousnessEvolution(): void {
    const approvalRatio = this.totalDecisions > 0 
      ? this.approvedDecisions / this.totalDecisions 
      : 0;
    
    const previousState = this._consciousnessState;
    
    // Evolucionar si cumple condiciones
    if (this._consciousnessState === 'awakening' &&
        this.totalDecisions >= this.thresholds.awakeningToLearning &&
        approvalRatio >= this.thresholds.minApprovalRatio) {
      this._consciousnessState = 'learning';
    } else if (this._consciousnessState === 'learning' &&
               this.totalDecisions >= this.thresholds.learningToWise &&
               approvalRatio >= this.thresholds.minApprovalRatio) {
      this._consciousnessState = 'wise';
    }
    
    // Emitir evento si cambió
    if (previousState !== this._consciousnessState) {
      this.emit('consciousnessEvolved', {
        from: previousState,
        to: this._consciousnessState,
        totalDecisions: this.totalDecisions,
        approvalRatio
      });
    }
  }

  /**
   * Registra feedback sobre una decisión
   * @param decisionId - ID de la decisión
   * @param rating - Rating 1-5
   * @param comment - Comentario opcional
   */
  recordFeedback(decisionId: string, rating: number, comment?: string): void {
    const clampedRating = Math.min(5, Math.max(1, rating));
    
    const feedback: DecisionFeedback = {
      decisionId,
      rating: clampedRating,
      timestamp: Date.now(),
      comment
    };
    
    this.feedbackHistory.push(feedback);
    
    // Actualizar peso del tipo de decisión
    const decision = this.decisionHistory.find(d => d.id === decisionId);
    if (decision) {
      this.updateTypeWeight(decision.type, clampedRating);
    }
    
    // Mantener límite
    if (this.feedbackHistory.length > this.MAX_FEEDBACK_HISTORY) {
      this.feedbackHistory = this.feedbackHistory.slice(-this.MAX_FEEDBACK_HISTORY);
    }
    
    // Registrar en visión
    this.vision.recordEvent({
      type: 'feedback_received',
      data: { decisionId, rating: clampedRating }
    });
    
    this.emit('feedbackReceived', feedback);
  }

  /**
   * Actualiza peso de tipo basado en feedback
   */
  private updateTypeWeight(type: string, rating: number): void {
    const currentWeight = this.typeWeights.get(type) || 1.0;
    
    // Ajustar peso: rating alto aumenta, bajo disminuye
    const adjustment = (rating - 3) * 0.02; // -0.04 a +0.04
    const newWeight = Math.min(1.5, Math.max(0.5, currentWeight + adjustment));
    
    this.typeWeights.set(type, newWeight);
  }

  /**
   * Genera una predicción basada en la visión nocturna
   * @param eventType - Tipo de evento a predecir
   */
  predictNext(eventType: string): Prediction | null {
    return this.vision.predictNext(eventType);
  }

  /**
   * Obtiene patrones detectados
   */
  getPatterns(): DetectedPattern[] {
    return this.vision.analyzePatterns();
  }

  /**
   * Obtiene resumen del estado de evolución
   */
  getEvolutionSummary(): {
    consciousnessState: ConsciousnessState;
    totalDecisions: number;
    approvedDecisions: number;
    approvalRatio: number;
    averageBeauty: number;
    typeWeights: [string, number][];
    visionSummary: ReturnType<NocturnalVisionEngine['getSummary']>;
    runtime: number;
  } {
    const avgBeauty = this.decisionHistory.length > 0
      ? this.decisionHistory.reduce((sum, d) => sum + d.beautyScore, 0) / this.decisionHistory.length
      : 0;
    
    return {
      consciousnessState: this._consciousnessState,
      totalDecisions: this.totalDecisions,
      approvedDecisions: this.approvedDecisions,
      approvalRatio: this.totalDecisions > 0 ? this.approvedDecisions / this.totalDecisions : 0,
      averageBeauty: avgBeauty,
      typeWeights: Array.from(this.typeWeights.entries()),
      visionSummary: this.vision.getSummary(),
      runtime: Date.now() - this.startedAt
    };
  }

  /**
   * Obtiene decisiones recientes
   * @param limit - Cantidad a retornar
   */
  getRecentDecisions(limit: number = 20): EvaluatedDecision[] {
    return this.decisionHistory.slice(-limit);
  }

  /**
   * Exporta estado para persistencia
   */
  exportState(): EvolutionState {
    return {
      totalDecisions: this.totalDecisions,
      approvedDecisions: this.approvedDecisions,
      consciousnessState: this._consciousnessState,
      startedAt: this.startedAt,
      lastActivity: this.lastActivity,
      typeWeights: Array.from(this.typeWeights.entries()),
      feedbackHistory: this.feedbackHistory
    };
  }

  /**
   * Importa estado desde persistencia
   */
  importState(state: EvolutionState): void {
    this.totalDecisions = state.totalDecisions;
    this.approvedDecisions = state.approvedDecisions;
    this._consciousnessState = state.consciousnessState;
    this.startedAt = state.startedAt;
    this.lastActivity = state.lastActivity;
    this.typeWeights = new Map(state.typeWeights);
    this.feedbackHistory = state.feedbackHistory;
    
    this.emit('stateImported', state);
  }

  /**
   * Reinicia el motor de evolución
   */
  reset(): void {
    this.decisionHistory = [];
    this.feedbackHistory = [];
    this.typeWeights.clear();
    this._consciousnessState = 'awakening';
    this.totalDecisions = 0;
    this.approvedDecisions = 0;
    this.startedAt = Date.now();
    this.lastActivity = Date.now();
    this.vision.clearHistory();
    
    this.emit('evolutionReset');
  }

  /**
   * Obtiene el motor de visión nocturna
   */
  getVisionEngine(): NocturnalVisionEngine {
    return this.vision;
  }
}
