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
// 🎲 WAVE 667-669: FUZZY DECISION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

import {
  FuzzyDecisionMaker,
  DropBridge,
  type FuzzyDecision,
  type DropBridgeResult,
} from './think'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WAVE 685: CONTEXTUAL EFFECT SELECTOR
// ═══════════════════════════════════════════════════════════════════════════

import {
  ContextualEffectSelector,
  getContextualEffectSelector,
  type ContextualEffectSelection,
  type ContextualSelectorInput,
} from '../effects/ContextualEffectSelector'

// 🔋 WAVE 931: Motor de Consciencia Energética
import { 
  EnergyConsciousnessEngine, 
  createEnergyConsciousnessEngine 
} from './EnergyConsciousnessEngine'

// ═══════════════════════════════════════════════════════════════════════════
// 🌀 WAVE 900.4: DREAM ENGINE INTEGRATOR - Cerebro Unificado
// ═══════════════════════════════════════════════════════════════════════════

import {
  dreamEngineIntegrator,
  type PipelineContext,
  type IntegrationDecision,
} from './integration/DreamEngineIntegrator'

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 810.5: EFFECT MANAGER IMPORT (for cooldown surgery)
// ═══════════════════════════════════════════════════════════════════════════

import { getEffectManager } from '../effects/EffectManager'

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
  
  // 🎲 WAVE 667-669: Fuzzy Decision System
  private fuzzyDecisionMaker: FuzzyDecisionMaker
  private dropBridge: DropBridge
  private lastFuzzyDecision: FuzzyDecision | null = null
  private lastDropBridgeResult: DropBridgeResult | null = null
  
  // 🎯 WAVE 685: Contextual Effect Selector
  private effectSelector: ContextualEffectSelector
  private lastEffectTimestamp: number = 0
  private lastEffectType: string | null = null
  private energyTrend: 'rising' | 'stable' | 'falling' = 'stable'
  private energyHistory: number[] = []
  
  // 🔋 WAVE 931: Motor de Consciencia Energética
  private energyConsciousness: EnergyConsciousnessEngine
  
  // 🧬 WAVE 972: Effect history para DNA system (lastDream cache removido - ahora sincrónico)
  private effectHistory: Array<{ type: string; timestamp: number }> = []
  
  // 🔋 WAVE 934+: Zone transition throttling (prevent spam logging)
  private lastLoggedZone: string | null = null
  private framesInLastLoggedZone: number = 0
  private readonly ZONE_LOG_THRESHOLD = 5  // Log only after 5 frames in new zone (100ms @ 50fps)
  
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
    
    // 🎲 WAVE 667-669: Inicializar sistema de decisión fuzzy
    this.fuzzyDecisionMaker = new FuzzyDecisionMaker()
    this.dropBridge = new DropBridge({
      zScoreThreshold: 3.0,       // 3 sigma = condición divina
      peakSections: ['drop', 'chorus'],
      minEnergy: 0.75,
    })
    
    // 🎯 WAVE 685: Inicializar selector de efectos contextual
    this.effectSelector = new ContextualEffectSelector()
    
    // � WAVE 931: Inicializar motor de consciencia energética
    // Diseño asimétrico: Lento para entrar en silencio, rápido para detectar drops
    this.energyConsciousness = createEnergyConsciousnessEngine()
    
    // �🔥 WAVE 810.5: COOLDOWN SURGERY - Escuchar disparos exitosos
    // Solo registrar cooldown cuando EffectManager REALMENTE dispara el efecto
    // (no bloqueado por Shield/Traffic)
    const effectManager = getEffectManager()
    effectManager.on('effectTriggered', (event: any) => {
      this.effectSelector.registerEffectFired(event.effectType)
      console.log(`[SeleneTitanConscious 🔥] Cooldown registered: ${event.effectType}`)
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
   * 🧬 WAVE 972: ASYNC para permitir DNA Brain sincrónico
   * 
   * @param titanState Estado estabilizado de TitanEngine
   * @returns Decisión de consciencia
   */
  async process(titanState: TitanStabilizedState): Promise<ConsciousnessOutput> {
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
    const rawDecision = await this.think(titanState, pattern)
    
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
   * 🌀 WAVE 900.4: Integra DreamEngine (non-blocking via cache)
   * 🧬 WAVE 972: SINCRÓNICO - DNA Brain tiene la última palabra
   */
  private async think(
    state: TitanStabilizedState,
    pattern: SeleneMusicalPattern
  ): Promise<ConsciousnessOutput> {
    
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎲 WAVE 667-669: FUZZY DECISION SYSTEM
    // ═══════════════════════════════════════════════════════════════════════
    
    // 3.5a. DROP BRIDGE: ¿Es un momento divino?
    const zScore = pattern.energyZScore ?? 0
    // Normalizar sectionType (algunos vienen como 'build' en vez de 'buildup')
    const normalizedSection = state.sectionType === 'build' ? 'buildup' : state.sectionType
    
    // 🔋 WAVE 932: Calcular energyContext ANTES del fuzzy para supresión
    // (Lo movemos aquí para que FuzzyDecisionMaker tenga consciencia de zona)
    const energyContext = this.energyConsciousness.process(state.rawEnergy)
    
    // 🔋 WAVE 934+: Log zone transitions only when persistent (prevent spam)
    // Track frames in current zone
    if (energyContext.zone === this.lastLoggedZone) {
      this.framesInLastLoggedZone++
    } else {
      // Zone changed
      if (this.framesInLastLoggedZone >= this.ZONE_LOG_THRESHOLD && this.lastLoggedZone !== null) {
        // Log the LAST zone transition after it was stable
        console.log(`[SeleneTitanConscious 🔋] Zone transition: ${this.lastLoggedZone} → ${energyContext.zone} (E=${state.rawEnergy.toFixed(2)})`)
      }
      this.lastLoggedZone = energyContext.zone
      this.framesInLastLoggedZone = 0
    }
    
    this.lastDropBridgeResult = this.dropBridge.check({
      energyZScore: zScore,
      sectionType: normalizedSection as 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro',
      rawEnergy: state.rawEnergy,
      hasKick: false, // TODO: Integrar detección de transientes
      harshness: state.harshness,
    })
    
    // 3.5b. FUZZY DECISION: Evaluar lógica difusa
    // 🔋 WAVE 932: Ahora con consciencia de zona energética
    this.lastFuzzyDecision = this.fuzzyDecisionMaker.evaluate({
      energy: state.rawEnergy,
      zScore: zScore,
      sectionType: normalizedSection as 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro',
      harshness: state.harshness ?? 0,
      huntScore: huntDecision.confidence,
      beauty: beautyAnalysis.totalBeauty,
      energyContext: energyContext,  // 🔋 WAVE 932: Inyectar contexto energético
    })
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🧬 WAVE 972.2: DNA BRAIN SIMULATION (ANTES DE DECISIONMAKER)
    // El simulador genera DATA, DecisionMaker toma la DECISIÓN
    // ═══════════════════════════════════════════════════════════════════════
    
    let dreamIntegrationData: any = null
    
    // Si Hunt detectó momento digno, ejecutar simulador DNA
    const WORTHINESS_THRESHOLD = 0.65
    if (huntDecision.worthiness >= WORTHINESS_THRESHOLD) {
      // Construir contexto para el pipeline integrado
      const pipelineContext: PipelineContext = {
        pattern: {
          vibe: pattern.vibeId,
          energy: state.rawEnergy,
          tempo: pattern.bpm,
        },
        huntDecision: {
          worthiness: huntDecision.worthiness,
          confidence: huntDecision.confidence,
        },
        crowdSize: 500,
        epilepsyMode: false,
        estimatedFatigue: this.lastEffectTimestamp ? 
          Math.min(1, (Date.now() - this.lastEffectTimestamp) / 60000) : 0,
        gpuLoad: 0.5,
        maxLuminosity: 100,
        recentEffects: this.effectHistory.slice(-10).map(e => ({ 
          effect: e.type, 
          timestamp: e.timestamp 
        })),
      }
      
      // 🧬 DNA Brain simula - NO decide
      try {
        dreamIntegrationData = await Promise.race([
          dreamEngineIntegrator.executeFullPipeline(pipelineContext),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Dream timeout')), 15)
          )
        ])
        
        if (dreamIntegrationData) {
          console.log(
            `[SeleneTitanConscious] 🧬 DNA SIMULATION COMPLETE: ${dreamIntegrationData.effect?.effect ?? 'none'} | ` +
            `Dream: ${dreamIntegrationData.dreamTime}ms | Ethics: ${dreamIntegrationData.ethicalVerdict?.ethicalScore?.toFixed(2) ?? 'N/A'}`
          )
        }
      } catch (err: any) {
        console.warn('[SeleneTitanConscious] 🧬 DNA Simulation timeout/error:', err?.message || err)
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. DECISION MAKER: EL LÓBULO FRONTAL - TIENE TODO EL CONTEXTO
    // ═══════════════════════════════════════════════════════════════════════
    
    const inputs: DecisionInputs = {
      pattern,
      beauty: beautyAnalysis,
      consonance: consonanceAnalysis,
      huntDecision,
      prediction,
      timestamp: state.timestamp,
      // 🧬 WAVE 972.2: DNA DATA para el cerebro
      dreamIntegration: dreamIntegrationData ?? undefined,
    }
    
    let output = makeDecision(inputs)
    
    // ═══════════════════════════════════════════════════════════════════════
    //  WAVE 685: CONTEXTUAL EFFECT SELECTION (FALLBACK SI DECISIONMAKER NO DECIDE)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Actualizar trend de energía
    this.updateEnergyTrend(state.rawEnergy)
    
    // Normalizar sección para el selector
    const selectorSection = this.normalizeSectionType(state.sectionType)
    
    // Construir input para el selector (fallback)
    const selectorInput: ContextualSelectorInput = {
      musicalContext: {
        zScore: zScore,
        bpm: pattern.bpm,
        energy: state.rawEnergy,
        vibeId: pattern.vibeId,
        beatPhase: pattern.beatPhase,
        inDrop: selectorSection === 'drop',
        energyContext: energyContext,
      },
      huntDecision,
      fuzzyDecision: this.lastFuzzyDecision ?? undefined,
      sectionType: selectorSection,
      energyTrend: this.energyTrend,
      lastEffectTimestamp: this.lastEffectTimestamp,
      lastEffectType: this.lastEffectType,
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🧬 WAVE 972.2: DECISION FLOW SIMPLIFICADO
    // DecisionMaker YA decidió (tiene DNA). Solo verificar Gatekeeper.
    // ═══════════════════════════════════════════════════════════════════════
    
    let finalEffectDecision = null
    
    // 1. Si DecisionMaker tiene decisión (ya procesó DNA internamente)
    if (output.effectDecision) {
      const intent = output.effectDecision.effectType
      const availability = this.effectSelector.checkAvailability(intent, pattern.vibeId)
      
      if (availability.available) {
        finalEffectDecision = output.effectDecision
        
        console.log(
          `[SeleneTitanConscious] 🧠 DECISION MAKER APPROVED: ${intent} | ` +
          `confidence=${output.effectDecision.confidence?.toFixed(2)} | ${output.effectDecision.reason}`
        )
      } else {
        console.log(
          `[SeleneTitanConscious] 🚪 GATEKEEPER BLOCKED: ${intent} | ${availability.reason}`
        )
        
        output = {
          ...output,
          effectDecision: null,
          debugInfo: {
            ...output.debugInfo,
            reasoning: `🚪 BLOCKED: ${intent} - ${availability.reason}`,
          }
        }
      }
    }
    
    // 2. FALLBACK: Si DecisionMaker no decidió, usar Selector Contextual
    if (!finalEffectDecision) {
      const effectSelection = this.effectSelector.select(selectorInput)
    
      if (effectSelection.effectType) {
        finalEffectDecision = {
          effectType: effectSelection.effectType,
          intensity: effectSelection.intensity,
          zones: ['all'] as ('all' | 'front' | 'back' | 'movers' | 'pars')[],
          reason: effectSelection.reason,
          confidence: effectSelection.confidence,
        }
        
        output = {
          ...output,
          confidence: Math.max(output.confidence, effectSelection.confidence),
          effectDecision: finalEffectDecision,
          debugInfo: {
            ...output.debugInfo,
            reasoning: `🎯 CONTEXTUAL FALLBACK: ${effectSelection.reason}`,
            fuzzyAction: this.lastFuzzyDecision?.action ?? 'hold',
            zScore: zScore,
          }
        }
        
        if (this.config.debug) {
          console.log(
            `[SeleneTitanConscious] 🎯 CONTEXTUAL FALLBACK: ` +
            `${effectSelection.effectType} @ ${effectSelection.intensity.toFixed(2)} | ` +
            `Z=${zScore.toFixed(2)}σ | Section=${selectorSection}`
          )
        }
      }
    }
    
    // 3. Track para cooldown y anti-repetición
    if (finalEffectDecision) {
      this.lastEffectTimestamp = Date.now()
      this.lastEffectType = finalEffectDecision.effectType
      
      // 🧬 WAVE 972.2: Track para Dream Engine
      this.effectHistory.push({
        type: finalEffectDecision.effectType,
        timestamp: Date.now(),
      })
      // Mantener solo últimos 20 efectos
      if (this.effectHistory.length > 20) {
        this.effectHistory.shift()
      }
      
      output = { ...output, effectDecision: finalEffectDecision }
      
      this.emit('contextualEffectSelected', {
        effectType: finalEffectDecision.effectType,
        intensity: finalEffectDecision.intensity,
        zScore,
        section: selectorSection,
        vibeId: pattern.vibeId,
        reason: finalEffectDecision.reason || 'unknown',
        dreamIntegrated: !!dreamIntegrationData?.approved,
      })
    }
    
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
    
    // Log periódico con información fuzzy
    if (this.config.debug && this.stats.framesProcessed % 30 === 0) {
      const fuzzyEmoji = {
        force_strike: '⚡',
        strike: '🎯',
        prepare: '🔮',
        hold: '😴',
      }[this.lastFuzzyDecision.action]
      
      console.log(
        `[SeleneTitanConscious] 🧠 Hunt=${this.state.huntPhase} ` +
        `Fuzzy=${fuzzyEmoji}${this.lastFuzzyDecision.action} ` +
        `Z=${zScore.toFixed(1)}σ ` +
        `Alert=${this.lastDropBridgeResult.alertLevel}`
      )
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
    
    // 🎲 WAVE 667-669: Resetear sistema fuzzy
    this.fuzzyDecisionMaker.reset()
    this.dropBridge.reset()
    this.lastFuzzyDecision = null
    this.lastDropBridgeResult = null
    
    if (this.config.debug) {
      console.log('[SeleneTitanConscious] 🔄 Reset complete (PHASES 2-4 + Memory + Fuzzy)')
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎲 WAVE 667-669: API DE FUZZY DECISION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtiene la última decisión fuzzy tomada.
   */
  getFuzzyDecision(): FuzzyDecision | null {
    return this.lastFuzzyDecision
  }
  
  /**
   * Obtiene el último resultado del Drop Bridge.
   */
  getDropBridgeResult(): DropBridgeResult | null {
    return this.lastDropBridgeResult
  }
  
  /**
   * ¿Está el Drop Bridge en alerta alta? (múltiples frames con z alto)
   */
  isDropBridgeOnHighAlert(): boolean {
    return this.dropBridge.isHighAlert()
  }
  
  /**
   * Obtiene el nivel de alerta actual del Drop Bridge.
   */
  getDropBridgeAlertLevel(): 'none' | 'watching' | 'imminent' | 'activated' {
    return this.lastDropBridgeResult?.alertLevel ?? 'none'
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 685: HELPERS PARA CONTEXTUAL EFFECT SELECTOR
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Actualiza la tendencia de energía basada en historial reciente.
   */
  private updateEnergyTrend(energy: number): void {
    // Mantener historial de 15 frames (~250ms @ 60fps)
    this.energyHistory.push(energy)
    if (this.energyHistory.length > 15) {
      this.energyHistory.shift()
    }
    
    if (this.energyHistory.length < 5) {
      this.energyTrend = 'stable'
      return
    }
    
    // Calcular tendencia comparando promedio de primera mitad vs segunda mitad
    const half = Math.floor(this.energyHistory.length / 2)
    const firstHalf = this.energyHistory.slice(0, half)
    const secondHalf = this.energyHistory.slice(half)
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const delta = avgSecond - avgFirst
    
    if (delta > 0.05) {
      this.energyTrend = 'rising'
    } else if (delta < -0.05) {
      this.energyTrend = 'falling'
    } else {
      this.energyTrend = 'stable'
    }
  }
  
  /**
   * Normaliza el tipo de sección para el selector.
   */
  private normalizeSectionType(sectionType: string): 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro' {
    // Normalizar 'build' → 'buildup'
    if (sectionType === 'build') return 'buildup'
    
    // Validar que sea un tipo conocido
    const validTypes = ['intro', 'verse', 'chorus', 'bridge', 'buildup', 'drop', 'breakdown', 'outro']
    if (validTypes.includes(sectionType)) {
      return sectionType as any
    }
    
    // Default para secciones desconocidas
    return 'verse'
  }
  
  /**
   * 🎯 WAVE 685: Obtiene la última selección contextual de efecto.
   */
  getLastEffectSelection(): { effectType: string | null; timestamp: number } {
    return {
      effectType: this.lastEffectType,
      timestamp: this.lastEffectTimestamp,
    }
  }
  
  /**
   * 🎯 WAVE 685: Obtiene la tendencia de energía actual.
   */
  getEnergyTrend(): 'rising' | 'stable' | 'falling' {
    return this.energyTrend
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
