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
  
  constructor(config: Partial<SeleneTitanConsciousConfig> = {}) {
    super()
    
    this.config = { ...DEFAULT_CONFIG, ...config }
    
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
   */
  private sense(state: TitanStabilizedState): SeleneMusicalPattern {
    // Usar el sensor de patrones musicales
    const pattern = senseMusicalPattern(state)
    
    // Capturar belleza y consonancia para decisiones posteriores
    this.currentBeauty = senseBeauty(state.currentPalette, pattern)
    this.currentConsonance = senseConsonance(state.currentPalette, pattern)
    
    return pattern
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // THINK: Cognición - MODERNIZADO PARA TITAN
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🧠 Decidir qué hacer basado en el patrón percibido
   * AHORA USA MÉTRICAS NATIVAS DE TITAN
   */
  private think(
    state: TitanStabilizedState,
    pattern: SeleneMusicalPattern
  ): ConsciousnessOutput {
    // TODO: Implementar HuntEngine + PredictionEngine + DecisionMaker (PHASE 3)
    // Por ahora, decisión basada en hunt phase + métricas de sensores
    
    // Actualizar hunt phase
    this.updateHuntPhase(pattern)
    
    // Obtener métricas de sensores
    const beauty = this.currentBeauty?.totalBeauty ?? 0.5
    const beautyTrend = this.currentBeauty?.trend ?? 'stable'
    const consonance = this.currentConsonance?.totalConsonance ?? 0.7
    const urgency = calculateMomentUrgency(pattern)
    
    // Crear output base
    const output = createEmptyOutput()
    output.timestamp = state.timestamp
    output.source = 'hunt'
    output.debugInfo.huntState = this.state.huntPhase
    output.debugInfo.beautyScore = beauty
    output.debugInfo.consonance = consonance
    output.debugInfo.beautyTrend = beautyTrend
    output.debugInfo.cyclesInCurrentState = this.state.cyclesInPhase
    
    // Decisiones basadas en fase
    if (this.state.huntPhase === 'striking') {
      // STRIKE MODE: Sugerir cambios más agresivos
      output.colorDecision = {
        suggestedStrategy: 'complementary',
        saturationMod: 1.1,
        brightnessMod: 1.05,
        confidence: beauty,
        reasoning: `Strike ejecutado (beauty=${beauty.toFixed(2)}, urgency=${urgency.toFixed(2)})`,
      }
      output.physicsModifier = {
        strobeIntensity: 0.8 + beauty * 0.2,
        flashIntensity: 0.85,
        confidence: beauty,
      }
      output.confidence = beauty
      this.stats.strikesExecuted++
      
    } else if (this.state.huntPhase === 'stalking') {
      // STALKING MODE: Observar sin cambios agresivos
      output.colorDecision = {
        saturationMod: 1.0,
        brightnessMod: 1.0,
        confidence: 0.5,
        reasoning: `Stalking (cycles=${this.state.cyclesInPhase}, urgency=${urgency.toFixed(2)})`,
      }
      output.confidence = 0.4
      
    } else if (this.state.huntPhase === 'evaluating') {
      // EVALUATING MODE: Preparando strike
      output.colorDecision = {
        saturationMod: 1.02, // Sutil aumento
        brightnessMod: 1.0,
        confidence: 0.6,
        reasoning: `Evaluating target (beauty=${beauty.toFixed(2)}, consonance=${consonance.toFixed(2)})`,
      }
      output.confidence = 0.5
      
    } else {
      // OTROS (sleeping, learning): Mínima intervención
      output.confidence = 0.2
    }
    
    return output
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DREAM: Simulación
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 💭 Simular si la decisión mejorará la belleza
   */
  private dream(
    state: TitanStabilizedState,
    decision: ConsciousnessOutput
  ): ConsciousnessOutput {
    // TODO: Implementar ScenarioSimulator + BiasDetector
    // Por ahora, pass-through
    
    this.stats.dreamsSimulated++
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
  
  /**
   * Actualiza fase de caza usando métricas nativas de Titan
   * MODERNIZADO: Usa pattern.rhythmicIntensity, emotionalTension, etc.
   */
  private updateHuntPhase(pattern: SeleneMusicalPattern): void {
    this.state.cyclesInPhase++
    
    // Obtener métricas de sensores (beauty/consonance vienen de sensores, no del pattern)
    const beauty = this.currentBeauty?.totalBeauty ?? 0.5
    const beautyTrend = this.currentBeauty?.trend ?? 'stable'
    const consonance = this.currentConsonance?.totalConsonance ?? 0.7
    
    // Métricas nativas del pattern
    const urgency = pattern.rhythmicIntensity * 0.6 + pattern.emotionalTension * 0.4
    
    // Estado machine simplificada
    switch (this.state.huntPhase) {
      case 'sleeping':
        // Despertar si hay suficiente actividad o belleza
        if (beauty > 0.4 || urgency > 0.5) {
          this.state.huntPhase = 'stalking'
          this.state.cyclesInPhase = 0
        }
        break
        
      case 'stalking':
        // Evaluar si hay candidato bueno
        if (beauty > 0.7 && this.state.cyclesInPhase >= 5) {
          this.state.huntPhase = 'evaluating'
          this.state.cyclesInPhase = 0
        }
        // Dormir si belleza cae mucho y no hay urgencia
        if (beauty < 0.3 && urgency < 0.3 && this.state.cyclesInPhase > 30) {
          this.state.huntPhase = 'sleeping'
          this.state.cyclesInPhase = 0
        }
        break
        
      case 'evaluating':
        // Strike si condiciones perfectas
        if (beauty > 0.75 && consonance > 0.65 && beautyTrend !== 'falling') {
          this.state.huntPhase = 'striking'
          this.state.cyclesInPhase = 0
        }
        // Volver a stalking si condiciones empeoran
        if (beauty < 0.6 || this.state.cyclesInPhase > 10) {
          this.state.huntPhase = 'stalking'
          this.state.cyclesInPhase = 0
        }
        break
        
      case 'striking':
        // Después de strike, aprender
        this.state.huntPhase = 'learning'
        this.state.cyclesInPhase = 0
        break
        
      case 'learning':
        // Volver a stalking después de aprender
        if (this.state.cyclesInPhase > 5) {
          this.state.huntPhase = 'stalking'
          this.state.cyclesInPhase = 0
        }
        break
    }
  }
  
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
    
    // Resetear sensores
    this.currentBeauty = null
    this.currentConsonance = null
    resetPatternHistory()
    resetBeautyHistory()
    resetConsonanceState()
    
    if (this.config.debug) {
      console.log('[SeleneTitanConscious] 🔄 Reset complete (+ sensors)')
    }
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
