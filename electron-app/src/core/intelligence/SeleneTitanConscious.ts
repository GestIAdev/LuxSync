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
  isEnergyOverrideActive,
} from './validate/EnergyOverride'

import {
  validateColorDecision,
  enforceConstitution,
} from './validate/ConstitutionGuard'

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
      console.log(`[SeleneTitanConscious] 🐱 Hunt=${this.state.huntPhase} Beauty=${pattern.beauty.toFixed(2)} Conf=${finalOutput.confidence.toFixed(2)}`)
    }
    
    return finalOutput
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SENSE: Percepción
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 👁️ Percibir el estado actual como patrón musical
   */
  private sense(state: TitanStabilizedState): SeleneMusicalPattern {
    // TODO: Implementar MusicalPatternSensor
    // Por ahora, conversión básica
    
    const note = this.keyToNote(state.stableKey)
    const element = this.keyToElement(state.stableKey)
    const emotionalTone = this.emotionToTone(state.stableEmotion)
    const beauty = this.calculateBeauty(state)
    const beautyTrend = this.calculateBeautyTrend(beauty)
    const consonance = this.calculateConsonance(state)
    
    return {
      note,
      element,
      emotionalTone,
      beauty,
      beautyTrend,
      consonance,
      confidence: 0.75, // Default hasta tener más sensores
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // THINK: Cognición
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🧠 Decidir qué hacer basado en el patrón percibido
   */
  private think(
    state: TitanStabilizedState,
    pattern: SeleneMusicalPattern
  ): ConsciousnessOutput {
    // TODO: Implementar HuntEngine + PredictionEngine + DecisionMaker
    // Por ahora, decisión básica basada en hunt phase
    
    // Actualizar hunt phase
    this.updateHuntPhase(pattern)
    
    // Crear output base
    const output = createEmptyOutput()
    output.timestamp = state.timestamp
    output.source = 'hunt'
    output.debugInfo.huntState = this.state.huntPhase
    output.debugInfo.beautyScore = pattern.beauty
    output.debugInfo.consonance = pattern.consonance
    output.debugInfo.beautyTrend = pattern.beautyTrend
    output.debugInfo.cyclesInCurrentState = this.state.cyclesInPhase
    
    // Decisiones basadas en fase
    if (this.state.huntPhase === 'striking') {
      // STRIKE MODE: Sugerir cambios más agresivos
      output.colorDecision = {
        suggestedStrategy: 'complementary',
        saturationMod: 1.1,
        brightnessMod: 1.05,
        confidence: pattern.beauty,
        reasoning: `Strike ejecutado (beauty=${pattern.beauty.toFixed(2)})`,
      }
      output.physicsModifier = {
        strobeIntensity: 0.8 + pattern.beauty * 0.2,
        flashIntensity: 0.85,
        confidence: pattern.beauty,
      }
      output.confidence = pattern.beauty
      this.stats.strikesExecuted++
      
    } else if (this.state.huntPhase === 'stalking') {
      // STALKING MODE: Observar sin cambios agresivos
      output.colorDecision = {
        saturationMod: 1.0,
        brightnessMod: 1.0,
        confidence: 0.5,
        reasoning: `Stalking (cycles=${this.state.cyclesInPhase})`,
      }
      output.confidence = 0.4
      
    } else {
      // OTROS: Mínima intervención
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
  // UTILIDADES INTERNAS
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
  
  private keyToNote(key: string | null): SeleneMusicalPattern['note'] {
    const map: Record<string, SeleneMusicalPattern['note']> = {
      'C': 'DO', 'Cm': 'DO', 'D': 'RE', 'Dm': 'RE',
      'E': 'MI', 'Em': 'MI', 'F': 'FA', 'Fm': 'FA',
      'G': 'SOL', 'Gm': 'SOL', 'A': 'LA', 'Am': 'LA',
      'B': 'SI', 'Bm': 'SI',
    }
    return map[key ?? 'C'] ?? 'DO'
  }
  
  private keyToElement(key: string | null): SeleneMusicalPattern['element'] {
    const map: Record<string, SeleneMusicalPattern['element']> = {
      'C': 'fire', 'G': 'fire', 'D': 'fire',
      'F': 'earth', 'Bb': 'earth', 'Eb': 'earth',
      'Am': 'air', 'Em': 'air', 'Bm': 'air',
      'Dm': 'water', 'Gm': 'water', 'Cm': 'water',
    }
    return map[key ?? 'C'] ?? 'fire'
  }
  
  private emotionToTone(emotion: string): SeleneMusicalPattern['emotionalTone'] {
    const map: Record<string, SeleneMusicalPattern['emotionalTone']> = {
      'BRIGHT': 'energetic',
      'DARK': 'peaceful',
      'NEUTRAL': 'harmonious',
    }
    return map[emotion] ?? 'harmonious'
  }
  
  private calculateBeauty(state: TitanStabilizedState): number {
    // Beauty = coherencia musical + balance de frecuencias
    const energyScore = 1 - Math.abs(state.smoothedEnergy - 0.55) * 2
    const syncopationScore = 1 - Math.abs(state.syncopation - 0.3)
    const balanceScore = 1 - Math.abs(state.bass - state.high)
    
    return Math.max(0, Math.min(1, 
      energyScore * 0.4 + syncopationScore * 0.3 + balanceScore * 0.3
    ))
  }
  
  private calculateBeautyTrend(currentBeauty: number): SeleneMusicalPattern['beautyTrend'] {
    if (this.state.beautyHistory.length < 3) return 'stable'
    
    const recent = this.state.beautyHistory.slice(-3)
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    const diff = currentBeauty - avg
    
    if (diff > 0.05) return 'rising'
    if (diff < -0.05) return 'falling'
    return 'stable'
  }
  
  private calculateConsonance(state: TitanStabilizedState): number {
    // Consonancia = qué tan bien encaja con el estado anterior
    if (!this.state.lastPattern) return 0.7 // Default
    
    // Mismo elemento = más consonante
    const element = this.keyToElement(state.stableKey)
    const lastElement = this.state.lastPattern.element
    
    if (element === lastElement) return 0.9
    
    // Elementos compatibles
    const compatible: Record<string, string[]> = {
      'fire': ['fire', 'air'],
      'earth': ['earth', 'water'],
      'air': ['air', 'fire'],
      'water': ['water', 'earth'],
    }
    
    if (compatible[element]?.includes(lastElement)) return 0.75
    return 0.5
  }
  
  private updateHistory(pattern: SeleneMusicalPattern): void {
    this.state.beautyHistory.push(pattern.beauty)
    if (this.state.beautyHistory.length > BEAUTY_HISTORY_SIZE) {
      this.state.beautyHistory.shift()
    }
    
    this.state.consonanceHistory.push(pattern.consonance)
    if (this.state.consonanceHistory.length > CONSONANCE_HISTORY_SIZE) {
      this.state.consonanceHistory.shift()
    }
  }
  
  private updateHuntPhase(pattern: SeleneMusicalPattern): void {
    this.state.cyclesInPhase++
    
    // Estado machine simplificada
    switch (this.state.huntPhase) {
      case 'sleeping':
        // Despertar si hay suficiente belleza
        if (pattern.beauty > 0.4) {
          this.state.huntPhase = 'stalking'
          this.state.cyclesInPhase = 0
        }
        break
        
      case 'stalking':
        // Evaluar si hay candidato bueno
        if (pattern.beauty > 0.7 && this.state.cyclesInPhase >= 5) {
          this.state.huntPhase = 'evaluating'
          this.state.cyclesInPhase = 0
        }
        // Dormir si belleza cae mucho
        if (pattern.beauty < 0.3 && this.state.cyclesInPhase > 30) {
          this.state.huntPhase = 'sleeping'
          this.state.cyclesInPhase = 0
        }
        break
        
      case 'evaluating':
        // Strike si condiciones perfectas
        if (pattern.beauty > 0.75 && pattern.consonance > 0.65 && pattern.beautyTrend !== 'falling') {
          this.state.huntPhase = 'striking'
          this.state.cyclesInPhase = 0
        }
        // Volver a stalking si condiciones empeoran
        if (pattern.beauty < 0.6 || this.state.cyclesInPhase > 10) {
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
    
    if (this.config.debug) {
      console.log('[SeleneTitanConscious] 🔄 Reset complete')
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
