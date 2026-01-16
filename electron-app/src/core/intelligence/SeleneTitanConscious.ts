/**
 * 🧬 WAVE 500: SELENE TITAN CONSCIOUS
 * ====================================
 * "La Gata que Baila con la Luz de la Luna" - Versión 2.0
 * 
 * Este es el CEREBRO de Selene, diseñado desde cero para TitanEngine.
 * No tiene legacy, no tiene deuda técnica, no tiene compromisos.
 * 
 * ARQUITECTURA:
 * 
 *   TitanStabilizedState
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │ ENERGY CHECK │ ← Si energy > 85% → OVERRIDE (physics veto)
 *   └──────────────┘
 *          │ (valley mode)
 *          ▼
 *   ┌──────────────┐
 *   │    SENSE     │ ← Percibir: Pattern + Beauty + Consonance
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │    THINK     │ ← Decidir: Hunt + Prediction + Decision
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │    DREAM     │ ← Simular: ¿Funcionará? ¿Hay sesgos?
 *   └──────────────┘
 *          │
 *          ▼
 *   ┌──────────────┐
 *   │   VALIDATE   │ ← Constitución es LEY
 *   └──────────────┘
 *          │
 *          ▼
 *   ConsciousnessOutput
 * 
 * @module core/intelligence/SeleneTitanConscious
 * @version 500.0.0
 */

import { EventEmitter } from 'events'
import {
  type TitanStabilizedState,
  type ConsciousnessOutput,
  type SeleneInternalState,
  type SeleneMusicalPattern,
  createEmptyOutput,
  BEAUTY_HISTORY_SIZE,
  CONSONANCE_HISTORY_SIZE,
} from './types'

import {
  applyEnergyOverride,
  getEnergyOverrideInfo,
} from './validate/EnergyOverride'

import {
  validateColorDecision,
} from './validate/ConstitutionGuard'

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR SENSORES - PHASE 2 COMPLETE
// ═══════════════════════════════════════════════════════════════════════════

import {
  senseMusicalPattern,
  calculateMomentUrgency,
  resetPatternHistory,
} from './sense/MusicalPatternSensor'

import {
  senseBeauty,
  getAverageBeauty,
  getBeautyTrend,
  resetBeautyHistory,
  type BeautyAnalysis,
} from './sense/BeautySensor'

import {
  senseConsonance,
  resetConsonanceState,
  type ConsonanceAnalysis,
} from './sense/ConsonanceSensor'

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR COGNICIÓN - PHASE 3 COMPLETE
// ═══════════════════════════════════════════════════════════════════════════

import {
  processHunt,
  resetHuntEngine,
  getHuntState,
  type HuntDecision,
} from './think/HuntEngine'

import {
  predict,
  resetPredictionEngine,
  type MusicalPrediction,
} from './think/PredictionEngine'

import {
  makeDecision,
  type DecisionInputs,
} from './think/DecisionMaker'

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR META-CONSCIENCIA - PHASE 4 COMPLETE
// ═══════════════════════════════════════════════════════════════════════════

import {
  dream as simulateDream,
  resetDreamEngine,
} from './dream/ScenarioSimulator'

import {
  recordDecision,
  analyzeBiases,
  getBiasStrings,
  resetBiasDetector,
} from './dream/BiasDetector'

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 666: IMPORTAR CONTEXTUAL MEMORY
// ═══════════════════════════════════════════════════════════════════════════

import {
  ContextualMemory,
  type ContextualMemoryOutput,
  type AnomalyReport,
  type NarrativeContext,
} from './memory'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuración del cerebro
 */
export interface SeleneTitanConsciousConfig {
  /** Modo debug (logs verbosos) */
  debug: boolean
  
  /** Habilitar consciencia */
  enabled: boolean
  
  /** Umbral de confianza para aplicar decisiones */
  confidenceThreshold: number
  
  /** Peso de las decisiones de consciencia (0-1) */
  consciousnessWeight: number
}

const DEFAULT_CONFIG: SeleneTitanConsciousConfig = {
  debug: false,
  enabled: true,
  confidenceThreshold: 0.60,
  consciousnessWeight: 0.65,
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════════════

interface SeleneStats {
  framesProcessed: number
  decisionsApplied: number
  decisionsRejected: number
  energyOverridesTriggered: number
  constitutionViolationsAvoided: number
  strikesExecuted: number
  dreamsSimulated: number
  biasesDetected: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SELENE TITAN CONSCIOUS - EL CEREBRO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🐱 SELENE TITAN CONSCIOUS
 * 
 * El cerebro consciente de LuxSync.
 * Percibe, piensa, sueña, y decide.
 * 
 * @example
 * ```typescript
 * const selene = new SeleneTitanConscious({ debug: true })
 * 
 * // En el loop de TitanEngine:
 * const output = selene.process(titanState)
 * if (output.confidence > 0.5) {
 *   // Aplicar decisiones al MasterArbiter Layer 1
 * }
 * ```
 */
export class SeleneTitanConscious extends EventEmitter {
  private config: SeleneTitanConsciousConfig
  private state: SeleneInternalState
  private stats: SeleneStats
  private lastOutput: ConsciousnessOutput
  
  // 🧠 WAVE 666: Contextual Memory
  private contextualMemory: ContextualMemory
  private lastMemoryOutput: ContextualMemoryOutput | null = null
  
  constructor(config: Partial<SeleneTitanConsciousConfig> = {}) {
    super()
    
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // 🧠 WAVE 666: Inicializar memoria contextual
    this.contextualMemory = new ContextualMemory({
      bufferSize: 300,       // ~5 segundos @ 60fps
      zScoreNotable: 1.5,
      zScoreSignificant: 2.0,
      zScoreEpic: 2.5,       // Threshold para anomalía
    })
    
    // Inicializar estado interno
    this.state = this.createInitialState()
    
    // Inicializar estadísticas
    this.stats = {
      framesProcessed: 0,
      decisionsApplied: 0,
      decisionsRejected: 0,
      energyOverridesTriggered: 0,
      constitutionViolationsAvoided: 0,
      strikesExecuted: 0,
      dreamsSimulated: 0,
      biasesDetected: 0,
    }
    
    // Output inicial
    this.lastOutput = createEmptyOutput()
    
    if (this.config.debug) {
      console.log('[SeleneTitanConscious] 🧬 GENESIS - Cerebro V2 inicializado')
      console.log('[SeleneTitanConscious]    🛡️ Energy Override: ARMED')
      console.log('[SeleneTitanConscious]    📜 Constitution Guard: ARMED')
      console.log('[SeleneTitanConscious]    🎯 Confidence Threshold:', this.config.confidenceThreshold)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🧠 PROCESAR FRAME - El latido del cerebro
   * 
   * Recibe estado estabilizado de Titan, procesa, y devuelve decisión.
   * 
   * @param titanState Estado estabilizado de TitanEngine
   * @returns Decisión de consciencia
   */
  process(titanState: TitanStabilizedState): ConsciousnessOutput {
    this.state.framesProcessed++
    this.stats.framesProcessed++
    
    // ─────────────────────────────────────────────────────────────────────
    // 0. CHECK: ¿Está habilitada la consciencia?
    // ─────────────────────────────────────────────────────────────────────
    if (!this.config.enabled) {
      return this.lastOutput
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 1. ⚡ ENERGY OVERRIDE CHECK (PRIMERO SIEMPRE)
    // "En los drops, la física manda"
    // ─────────────────────────────────────────────────────────────────────
    const energyOverride = applyEnergyOverride(titanState)
    
    if (energyOverride) {
      this.stats.energyOverridesTriggered++
      
      if (this.config.debug && this.stats.framesProcessed % 60 === 0) {
        const info = getEnergyOverrideInfo(titanState)
        console.log(`[SeleneTitanConscious] ⚡ ${info.reason}`)
      }
      
      this.lastOutput = energyOverride
      this.emit('energyOverride', { energy: titanState.smoothedEnergy })
      return energyOverride
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 2. 👁️ SENSE: Percibir el estado musical
    // ─────────────────────────────────────────────────────────────────────
    const pattern = this.sense(titanState)
    
    // Actualizar historial
    this.updateHistory(pattern)
    
    // ─────────────────────────────────────────────────────────────────────
    // 3. 🧠 THINK: Decidir qué hacer
    // ─────────────────────────────────────────────────────────────────────
    const rawDecision = this.think(titanState, pattern)
    
    // ─────────────────────────────────────────────────────────────────────
    // 4. 💭 DREAM: Simular si la decisión es buena
    // ─────────────────────────────────────────────────────────────────────
    const dreamValidated = this.dream(titanState, rawDecision)
    
    // ─────────────────────────────────────────────────────────────────────
    // 5. 📜 VALIDATE: Asegurar que respeta la Constitución
    // ─────────────────────────────────────────────────────────────────────
    const finalOutput = this.validate(titanState, dreamValidated)
    
    // ─────────────────────────────────────────────────────────────────────
    // 6. 📊 STATS & OUTPUT
    // ─────────────────────────────────────────────────────────────────────
    if (finalOutput.confidence >= this.config.confidenceThreshold) {
      this.stats.decisionsApplied++
    } else {
      this.stats.decisionsRejected++
    }
    
    this.lastOutput = finalOutput
    this.state.lastPattern = pattern
    
    // Log periódico
    if (this.config.debug && this.stats.framesProcessed % 60 === 0) {
      console.log(`[SeleneTitanConscious] 🐱 Hunt=${this.state.huntPhase} Section=${pattern.section} Conf=${finalOutput.confidence.toFixed(2)}`)
    }
    
    return finalOutput
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SENSE: Percepción - USANDO SENSORES REALES
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Estado sensorial actual (para debug y decisiones) */
  private currentBeauty: BeautyAnalysis | null = null
  private currentConsonance: ConsonanceAnalysis | null = null
  
  /**
   * 👁️ Percibir el estado actual como patrón musical
   * AHORA USA LOS SENSORES REALES DE PHASE 2
   * 🧠 WAVE 666: + CONTEXTUAL MEMORY con Z-Scores
   */
  private sense(state: TitanStabilizedState): SeleneMusicalPattern {
    // Usar el sensor de patrones musicales
    const pattern = senseMusicalPattern(state)
    
    // 🧠 WAVE 666: Actualizar memoria contextual
    this.lastMemoryOutput = this.contextualMemory.update({
      energy: state.rawEnergy,
      bass: state.bass,
      harshness: state.harshness,
      sectionType: state.sectionType as any, // Compatibilidad de tipos
      timestamp: state.timestamp,
      hasTransient: false, // TODO: Integrar detección de transientes
    })
    
    // 🧠 WAVE 666: Enriquecer el patrón con Z-Score de energía
    const enrichedPattern: SeleneMusicalPattern = {
      ...pattern,
      energyZScore: this.lastMemoryOutput.stats.energy.zScore,
    }
    
    // Capturar belleza y consonancia para decisiones posteriores
    this.currentBeauty = senseBeauty(state.currentPalette, enrichedPattern)
    this.currentConsonance = senseConsonance(state.currentPalette, enrichedPattern)
    
    return enrichedPattern
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // THINK: Cognición - PHASE 3 COMPLETE - USANDO MÓDULOS REALES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🧠 Decidir qué hacer basado en el patrón percibido
   * PHASE 3: USA HuntEngine + PredictionEngine + DecisionMaker
   */
  private think(
    state: TitanStabilizedState,
    pattern: SeleneMusicalPattern
  ): ConsciousnessOutput {
    
    // 1. Obtener análisis de sensores (con fallback robusto)
    const beautyAnalysis = this.currentBeauty ?? {
      totalBeauty: 0.5,
      phiAlignment: 0.5,
      fibonacciDistribution: 0.5,
      chromaticHarmony: 0.5,
      contrastBalance: 0.5,
      trend: 'stable' as const,
      timestamp: Date.now()
    }
    
    const consonanceAnalysis = this.currentConsonance ?? {
      totalConsonance: 0.7,
      chromaticConsonance: 0.7,
      rhythmicConsonance: 0.7,
      emotionalConsonance: 0.7,
      dominantInterval: 'unison',
      transitionType: 'smooth' as const,
      suggestedTransitionMs: 500,
      timestamp: Date.now()
    }
    
    // 2. HUNT ENGINE: Procesar FSM del depredador
    const huntDecision = processHunt(pattern, beautyAnalysis, consonanceAnalysis)
    
    // 3. PREDICTION ENGINE: Anticipar próximos eventos
    const prediction = predict(pattern)
    
    // 4. DECISION MAKER: Síntesis final
    const inputs: DecisionInputs = {
      pattern,
      beauty: beautyAnalysis,
      consonance: consonanceAnalysis,
      huntDecision,
      prediction,
      timestamp: state.timestamp,
    }
    
    const output = makeDecision(inputs)
    
    // 5. Actualizar estado interno
    const huntState = getHuntState()
    this.state.huntPhase = huntState.phase
    this.state.cyclesInPhase = huntState.framesInPhase
    
    // 6. Almacenar predicción completa (WAVE 500: tipo real)
    if (prediction.probability > 0.5) {
      this.state.activePrediction = prediction
    } else {
      this.state.activePrediction = null
    }
    
    // Log periódico
    if (this.config.debug && this.stats.framesProcessed % 30 === 0) {
      console.log(`[SeleneTitanConscious] 🧠 Hunt=${this.state.huntPhase} Strike=${huntDecision.shouldStrike} Pred=${prediction.type}(${(prediction.probability * 100).toFixed(0)}%)`)
    }
    
    return output
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DREAM: Simulación - PHASE 4 COMPLETE - USANDO MÓDULOS REALES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 💭 Simular si la decisión mejorará la belleza
   * PHASE 4: USA ScenarioSimulator + BiasDetector
   */
  private dream(
    state: TitanStabilizedState,
    decision: ConsciousnessOutput
  ): ConsciousnessOutput {
    this.stats.dreamsSimulated++
    
    // Obtener pattern y beauty actuales
    const pattern = this.state.lastPattern ?? senseMusicalPattern(state)
    const currentBeauty = this.currentBeauty?.totalBeauty ?? 0.5
    
    // Solo soñar en estados de baja energía (cuando hay tiempo)
    // En momentos de alta actividad, pasamos directo
    if (state.smoothedEnergy > 0.6 || decision.confidence < 0.4) {
      // Registrar decisión para análisis de sesgos
      recordDecision(decision)
      return decision
    }
    
    // SCENARIO SIMULATOR: ¿Hay un mejor camino?
    const dreamResult = simulateDream(state, pattern, currentBeauty)
    
    // Guardar resultado del sueño
    this.state.lastDream = dreamResult
    
    // Si el sueño recomienda abortar, reducir confianza
    if (dreamResult.recommendation === 'abort') {
      return {
        ...decision,
        confidence: decision.confidence * 0.6,
        debugInfo: {
          ...decision.debugInfo,
          reasoning: `Dream abort: ${dreamResult.reason}`,
          lastDream: {
            scenario: dreamResult.bestScenario?.type ?? 'none',
            beautyDelta: dreamResult.bestScenario?.beautyDelta ?? 0,
            recommendation: 'abort'
          }
        }
      }
    }
    
    // Si el sueño recomienda ejecutar con mejor escenario
    if (dreamResult.recommendation === 'execute' && dreamResult.bestScenario) {
      const best = dreamResult.bestScenario
      
      // Usar la decisión del mejor escenario soñado
      return {
        ...decision,
        colorDecision: best.decision,
        confidence: Math.min(1, decision.confidence * 1.2), // Boost de confianza
        source: 'dream',
        debugInfo: {
          ...decision.debugInfo,
          reasoning: `Dream execute: ${best.description}`,
          lastDream: {
            scenario: best.type,
            beautyDelta: best.beautyDelta,
            recommendation: 'execute'
          }
        }
      }
    }
    
    // BIAS DETECTOR: Analizar sesgos periódicamente
    recordDecision(decision)
    
    if (this.stats.framesProcessed % 100 === 0) {
      const biasAnalysis = analyzeBiases()
      this.state.detectedBiases = getBiasStrings()
      this.stats.biasesDetected += biasAnalysis.biases.length
      
      if (this.config.debug && biasAnalysis.biases.length > 0) {
        console.log(`[SeleneTitanConscious] 🧠 Biases detected: ${this.state.detectedBiases.join(', ')}`)
      }
    }
    
    return decision
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATE: Guardianes
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 📜 Validar decisión contra Constitución
   */
  private validate(
    state: TitanStabilizedState,
    decision: ConsciousnessOutput
  ): ConsciousnessOutput {
    
    if (!decision.colorDecision) {
      return decision
    }
    
    const result = validateColorDecision(decision.colorDecision, state.constitution)
    
    if (!result.isValid) {
      this.stats.constitutionViolationsAvoided++
      
      if (this.config.debug) {
        for (const v of result.violations) {
          console.log(`[SeleneTitanConscious] 📜 Violation avoided: ${v.description}`)
        }
      }
      
      return {
        ...decision,
        colorDecision: result.correctedDecision,
      }
    }
    
    return decision
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // UTILIDADES INTERNAS - MODERNIZADAS PARA TITAN
  // ═══════════════════════════════════════════════════════════════════════
  
  private createInitialState(): SeleneInternalState {
    return {
      huntPhase: 'sleeping',
      cyclesInPhase: 0,
      lastPattern: null,
      beautyHistory: [],
      consonanceHistory: [],
      strikeCandidates: [],
      activePrediction: null,
      lastDream: null,
      detectedBiases: [],
      framesProcessed: 0,
    }
  }
  
  /**
   * Actualiza historial usando los sensores reales
   * MODERNIZADO: Ya no usa pattern.beauty directo, usa los sensores
   */
  private updateHistory(_pattern: SeleneMusicalPattern): void {
    // Ahora usamos los sensores para obtener belleza y consonancia
    const beauty = this.currentBeauty?.totalBeauty ?? 0.5
    const consonance = this.currentConsonance?.totalConsonance ?? 0.7
    
    this.state.beautyHistory.push(beauty)
    if (this.state.beautyHistory.length > BEAUTY_HISTORY_SIZE) {
      this.state.beautyHistory.shift()
    }
    
    this.state.consonanceHistory.push(consonance)
    if (this.state.consonanceHistory.length > CONSONANCE_HISTORY_SIZE) {
      this.state.consonanceHistory.shift()
    }
  }
  
  // WAVE 500 PHASE 5: updateHuntPhase eliminado - ahora HuntEngine lo maneja
  
  // ═══════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Obtiene estadísticas */
  getStats(): SeleneStats {
    return { ...this.stats }
  }
  
  /** Obtiene estado interno (para debug) */
  getInternalState(): SeleneInternalState {
    return { ...this.state }
  }
  
  /** Obtiene último output */
  getLastOutput(): ConsciousnessOutput {
    return this.lastOutput
  }
  
  /** Habilita/deshabilita */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    if (this.config.debug) {
      console.log(`[SeleneTitanConscious] ${enabled ? '✅ Enabled' : '⏸️ Disabled'}`)
    }
  }
  
  /** Obtiene estado habilitado/deshabilitado */
  isEnabled(): boolean {
    return this.config.enabled
  }
  
  /** Resetea estado */
  reset(): void {
    this.state = this.createInitialState()
    this.stats = {
      framesProcessed: 0,
      decisionsApplied: 0,
      decisionsRejected: 0,
      energyOverridesTriggered: 0,
      constitutionViolationsAvoided: 0,
      strikesExecuted: 0,
      dreamsSimulated: 0,
      biasesDetected: 0,
    }
    this.lastOutput = createEmptyOutput()
    
    // Resetear sensores (PHASE 2)
    this.currentBeauty = null
    this.currentConsonance = null
    resetPatternHistory()
    resetBeautyHistory()
    resetConsonanceState()
    
    // Resetear cognición (PHASE 3)
    resetHuntEngine()
    resetPredictionEngine()
    
    // Resetear meta-consciencia (PHASE 4)
    resetDreamEngine()
    resetBiasDetector()
    
    // 🧠 WAVE 666: Resetear memoria contextual
    this.contextualMemory.reset()
    this.lastMemoryOutput = null
    
    if (this.config.debug) {
      console.log('[SeleneTitanConscious] 🔄 Reset complete (PHASES 2-4 + Memory)')
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 666: API DE MEMORIA CONTEXTUAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtiene el Z-Score actual de energía.
   * Z > 2.5 = anomalía, Z > 3.0 = momento épico
   */
  getEnergyZScore(): number {
    return this.contextualMemory.getEnergyZScore()
  }
  
  /**
   * Obtiene el último output de la memoria contextual.
   */
  getMemoryOutput(): ContextualMemoryOutput | null {
    return this.lastMemoryOutput
  }
  
  /**
   * Obtiene el reporte de anomalía actual.
   */
  getAnomalyReport(): AnomalyReport | null {
    return this.lastMemoryOutput?.anomaly ?? null
  }
  
  /**
   * Obtiene el contexto narrativo actual.
   */
  getNarrativeContext(): NarrativeContext | null {
    return this.lastMemoryOutput?.narrative ?? null
  }
  
  /**
   * ¿Está la memoria suficientemente calentada para Z-Scores confiables?
   */
  isMemoryWarmedUp(): boolean {
    return this.contextualMemory.isWarmedUp
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON (Opcional)
// ═══════════════════════════════════════════════════════════════════════════

let seleneInstance: SeleneTitanConscious | null = null

/**
 * Obtiene instancia singleton de Selene
 */
export function getSelene(config?: Partial<SeleneTitanConsciousConfig>): SeleneTitanConscious {
  if (!seleneInstance) {
    seleneInstance = new SeleneTitanConscious(config)
  }
  return seleneInstance
}

/**
 * Resetea instancia singleton
 */
export function resetSelene(): void {
  if (seleneInstance) {
    seleneInstance.reset()
    seleneInstance = null
  }
}
