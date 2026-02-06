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
  type SpectralHint,  // 🔮 WAVE 1026: ROSETTA STONE
} from './think/HuntEngine'

import {
  predict,
  predictCombined, // 🔮 WAVE 1169: Predicción reactiva por energía
  resetPredictionEngine,
  getEnergyPredictionState, // 🔥 WAVE 1176: OPERATION SNIPER - Expose velocity for UI
  type MusicalPrediction,
} from './think/PredictionEngine'

import {
  makeDecision,
  type DecisionInputs,
} from './think/DecisionMaker'

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 973.3: MOOD CONTROLLER - Para ethics threshold
// ═══════════════════════════════════════════════════════════════════════════

import { MoodController } from '../mood/MoodController'

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 978: ENERGY LOGGER
// ═══════════════════════════════════════════════════════════════════════════

import { EnergyLogger } from './EnergyLogger'

// DEBUG ENERGY FLAG - Set to true to enable CSV logging
const DEBUG_ENERGY = true  // 🧪 Set to TRUE to activate Energy Lab

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTAR META-CONSCIENCIA - PHASE 4 COMPLETE
// ═══════════════════════════════════════════════════════════════════════════

// 🚫 WAVE 1169: ScenarioSimulator DEPRECATED for V1.0
// TODO WAVE 2.0: Reactivar cuando el motor evolutivo esté listo
// import {
//   dream as simulateDream,
//   resetDreamEngine,
// } from './dream/ScenarioSimulator'

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
// 🔪 WAVE 1010.5: THE PURGE - Interfaces deprecated removidas
// ═══════════════════════════════════════════════════════════════════════════

import {
  ContextualEffectSelector,
  getContextualEffectSelector,
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

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 1073.4: OCEANIC EFFECTS - NO DNA COOLDOWN OVERRIDE
// ═══════════════════════════════════════════════════════════════════════════
// Estos efectos tienen cooldowns especiales gestionados por ChillStereoPhysics.
// El DNA Cooldown Override NO debe saltarse sus cooldowns - la física oceánica
// es sagrada y debe respetarse para mantener la narrativa de la marea.
const OCEANIC_EFFECTS_NO_OVERRIDE: Set<string> = new Set([
  'solar_caustics',      // ☀️ Rayos solares descendiendo - SHALLOWS
  'school_of_fish',      // 🐟 Cardumen en movimiento - OCEAN
  'whale_song',          // 🐋 Canto de ballena - TWILIGHT
  'abyssal_jellyfish',   // 🪼 Medusas bioluminiscentes - MIDNIGHT
])

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
  enabled: false,  // 🧠 WAVE 1166: AI LOBOTOMY - Start in Reactive Mode (no dreams)
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
  
  // 🔇 WAVE 976.3: SILENCE LOG THROTTLING - "El silencio no debe spammear"
  private lastSilenceLogTimestamp: number = 0
  private readonly SILENCE_LOG_THROTTLE_MS = 5000  // Log silence solo cada 5 segundos
  
  // 🔮 WAVE 1168: NEURAL BRIDGE - Dream/Energy state for UI telemetry
  private lastDreamIntegrationResult: IntegrationDecision | null = null
  private lastEnergyZone: 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak' = 'ambient'
  
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
    
    // 🔋 WAVE 931: Inicializar motor de consciencia energética
    // Diseño asimétrico: Lento para entrar en silencio, rápido para detectar drops
    this.energyConsciousness = createEnergyConsciousnessEngine()
    
    // 🧪 WAVE 978: Inicializar Energy Logger si DEBUG activo
    if (DEBUG_ENERGY) {
      console.log('[🧪 ENERGY_LAB] DEBUG_ENERGY = TRUE → Initializing logger...')
      EnergyLogger.initialize()
    }
    
    // 🔥 WAVE 810.5: COOLDOWN SURGERY - Escuchar disparos exitosos
    // Solo registrar cooldown cuando EffectManager REALMENTE dispara el efecto
    // (no bloqueado por Shield/Traffic)
    const effectManager = getEffectManager()
    effectManager.on('effectTriggered', (event: any) => {
      this.effectSelector.registerEffectFired(event.effectType)
      console.log(`[SeleneTitanConscious 🔥] Cooldown registered: ${event.effectType}`)
      
      // 🔒 WAVE 1177: CALIBRATION - Solo pushear al historial cuando REALMENTE se ejecuta
      // Esto evita que efectos bloqueados por GLOBAL_LOCK contaminen el historial
      this.effectHistory.push({
        type: event.effectType,
        timestamp: Date.now(),
      })
      
      // Mantener solo últimos 20 efectos
      if (this.effectHistory.length > 20) {
        this.effectHistory.shift()
      }
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔮 WAVE 1026: ROSETTA STONE - Spectral Texture Derivation
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Deriva la textura espectral desde el estado de TitanEngine
   * Replica la lógica de mind.ts para consistencia
   * 
   * @param state - Estado estabilizado de Titan
   * @returns Textura derivada: clean | warm | harsh | noisy
   */
  private deriveTextureFromState(
    state: TitanStabilizedState
  ): 'clean' | 'warm' | 'harsh' | 'noisy' {
    const { harshness, clarity, spectralCentroid } = state
    
    // 🎸 Metal controlado: Alta agresión CON claridad = PODER, no ruido
    if (harshness > 0.6 && clarity > 0.7) return 'harsh'
    
    // ⚠️ Ruido sucio: Alta agresión SIN claridad = caos estresante  
    if (harshness > 0.6 && clarity < 0.4) return 'noisy'
    
    // 🌙 Warm: Centroide bajo = sonido oscuro/profundo
    if (spectralCentroid < 300) return 'warm'
    
    // ✨ Default: Clean production
    return 'clean'
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔮 WAVE 1190: PROJECT CASSANDRA - Spectral Buildup Detection
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Historial de valores espectrales para detectar tendencias */
  private spectralHistory: {
    flatness: number[],
    centroid: number[],
    bass: number[],
    timestamp: number
  } = { flatness: [], centroid: [], bass: [], timestamp: 0 }
  
  /**
   * 🔮 WAVE 1190: Calcular score de buildup espectral
   * 
   * Detecta patrones físicos de buildup en EDM:
   * - Rising centroid: El brillo sube (high-pass abriendo)
   * - Rising flatness: Ruido blanco aumenta (snare roll, white noise sweep)
   * - Falling bass: El bajo desaparece (ducking antes del drop)
   * 
   * @param state - Estado estabilizado de Titan
   * @returns Score 0-1 de "probabilidad de buildup espectral"
   */
  private calculateSpectralBuildupScore(state: TitanStabilizedState): number {
    const now = Date.now()
    
    // Actualizar historial
    this.spectralHistory.flatness.push(state.spectralFlatness)
    this.spectralHistory.centroid.push(state.spectralCentroid)
    this.spectralHistory.bass.push(state.bass)
    this.spectralHistory.timestamp = now
    
    // Mantener últimas 10 muestras (~1-2 segundos a 60fps)
    const MAX_HISTORY = 10
    if (this.spectralHistory.flatness.length > MAX_HISTORY) {
      this.spectralHistory.flatness.shift()
      this.spectralHistory.centroid.shift()
      this.spectralHistory.bass.shift()
    }
    
    // Necesitamos al menos 5 muestras para detectar tendencia
    if (this.spectralHistory.flatness.length < 5) {
      return 0
    }
    
    const len = this.spectralHistory.flatness.length
    const halfLen = Math.floor(len / 2)
    
    // Calcular promedios de primera y segunda mitad
    const avgFlatnessFirst = this.spectralHistory.flatness.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen
    const avgFlatnessSecond = this.spectralHistory.flatness.slice(halfLen).reduce((a, b) => a + b, 0) / (len - halfLen)
    
    const avgCentroidFirst = this.spectralHistory.centroid.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen
    const avgCentroidSecond = this.spectralHistory.centroid.slice(halfLen).reduce((a, b) => a + b, 0) / (len - halfLen)
    
    const avgBassFirst = this.spectralHistory.bass.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen
    const avgBassSecond = this.spectralHistory.bass.slice(halfLen).reduce((a, b) => a + b, 0) / (len - halfLen)
    
    let buildupScore = 0
    
    // ⬆️ Rising Centroid (brillo sube) - peso 0.35
    const centroidRising = avgCentroidSecond > avgCentroidFirst * 1.1 // >10% incremento
    if (centroidRising) {
      const centroidDelta = (avgCentroidSecond - avgCentroidFirst) / (avgCentroidFirst + 1)
      buildupScore += Math.min(0.35, centroidDelta * 0.5)
    }
    
    // ⬆️ Rising Flatness (ruido blanco sube) - peso 0.35
    const flatnessRising = avgFlatnessSecond > avgFlatnessFirst + 0.05 // >5% incremento absoluto
    if (flatnessRising) {
      const flatnessDelta = avgFlatnessSecond - avgFlatnessFirst
      buildupScore += Math.min(0.35, flatnessDelta * 3.5)
    }
    
    // ⬇️ Falling Bass (bajo cae) - peso 0.30
    const bassFalling = avgBassSecond < avgBassFirst * 0.85 // >15% caída
    if (bassFalling) {
      const bassDelta = (avgBassFirst - avgBassSecond) / (avgBassFirst + 0.01)
      buildupScore += Math.min(0.30, bassDelta * 0.5)
    }
    
    return Math.min(1, buildupScore)
  }
  
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
    
    // 🔮 WAVE 1026: ROSETTA STONE - Build SpectralHint from TitanState
    const spectralHint = {
      clarity: state.clarity,
      harshness: state.harshness,
      texture: this.deriveTextureFromState(state),
    }
    
    // 2. HUNT ENGINE: Procesar FSM del depredador (🔮 con SpectralHint)
    const huntDecision = processHunt(pattern, beautyAnalysis, consonanceAnalysis, spectralHint)
    
    // 3. PREDICTION ENGINE: Anticipar próximos eventos
    // 🔮 WAVE 1169: Usar predictCombined para detección reactiva por energía
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Integrar spectral buildup score
    const spectralBuildupScore = this.calculateSpectralBuildupScore(state)
    const prediction = predictCombined(pattern, state.smoothedEnergy, spectralBuildupScore)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎲 WAVE 667-669: FUZZY DECISION SYSTEM
    // ═══════════════════════════════════════════════════════════════════════
    
    // 3.5a. DROP BRIDGE: ¿Es un momento divino?
    const zScore = pattern.energyZScore ?? 0
    // Normalizar sectionType (algunos vienen como 'build' en vez de 'buildup')
    const normalizedSection = state.sectionType === 'build' ? 'buildup' : state.sectionType
    
    // 🔋 WAVE 932: Calcular energyContext ANTES del fuzzy para supresión
    // (Lo movemos aquí para que FuzzyDecisionMaker tenga consciencia de zona)
    // 🧪 WAVE 978: Pasamos debugData para el EnergyLogger
    const energyContext = this.energyConsciousness.process(state.rawEnergy, {
      bassEnergy: state.bass,
      midEnergy: state.mid,
      trebleEnergy: state.high,
      // AGC gain no disponible en TitanState (TODO: agregar en el futuro)
      // spectralFlux no disponible en TitanState (TODO: agregar en el futuro)
    })
    
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔒 WAVE 1179: DICTATOR AWARENESS - Si hay dictador, DNA NO simula
    // ═══════════════════════════════════════════════════════════════════════
    // PROBLEMA: El DNA seguía recomendando efectos aunque había un dictador activo.
    // Esto generaba spam de GLOBAL_LOCK (acid_sweep bloqueado 14 veces seguidas).
    // SOLUCIÓN: Verificar dictador ANTES de simular, no después de recomendar.
    // ═══════════════════════════════════════════════════════════════════════
    const activeDictator = getEffectManager().hasDictator()
    
    // ═══════════════════════════════════════════════════════════════════════
    // � WAVE 976.7: DNA SIMULATION - Hunt dice hay presa → DNA simula
    // 🔒 WAVE 1179: PERO SOLO SI NO HAY DICTADOR
    // ═══════════════════════════════════════════════════════════════════════
    // DNA NO TIENE COOLDOWN. DNA simula CADA VEZ que Hunt detecta momento worthy.
    // Gatekeeper controla el spam con cooldowns de efectos.
    // 🔒 WAVE 1179: Si hay dictador activo, el DNA respeta el silencio.
    // ═══════════════════════════════════════════════════════════════════════
    
    // Si Hunt detectó momento digno Y no hay dictador activo, ejecutar simulador DNA
    const WORTHINESS_THRESHOLD = 0.65
    if (huntDecision.worthiness >= WORTHINESS_THRESHOLD && !activeDictator) {
      // Construir contexto para el pipeline integrado
      // 🧠 WAVE 1173: NEURAL LINK - Pasar predicción del Oráculo al Dreamer
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
        // 🧠 WAVE 975.5: ZONE UNIFICATION - Inyectar zona desde EnergyConsciousness
        energyZone: energyContext.zone,
        // 🛡️ WAVE 1178: ZONE PROTECTION - Inyectar Z-Score para bloquear disparos en bajadas
        zScore: zScore,
        // 🧠 WAVE 1173: NEURAL LINK - Oracle → Dreamer
        predictionType: prediction.type as PipelineContext['predictionType'],
        energyTrend: prediction.type === 'energy_spike' ? 'spike' : 
                     (prediction.reasoning?.includes('RISING') ? 'rising' :
                      prediction.reasoning?.includes('FALLING') ? 'falling' : 'stable'),
        // ═══════════════════════════════════════════════════════════════
        // 🔮 WAVE 1190: PROJECT CASSANDRA - ORACLE → DREAMER DATA FLOW
        // Ahora el Dreamer recibe los datos REALES del Oráculo para:
        // 1. Saber CUÁNTO tiempo tiene para actuar
        // 2. Saber QUÉ TAN SEGURO está el Oráculo
        // 3. Recibir SUGERENCIAS de efectos apropiados
        // ═══════════════════════════════════════════════════════════════
        predictionProbability: prediction.probability,
        predictionTimeMs: prediction.estimatedTimeMs ?? 4000,
        suggestedEffects: prediction.suggestedActions?.map(a => a.effect) ?? [],
      }
      
      // 🧬 DNA Brain simula - NO decide
      try {
        dreamIntegrationData = await Promise.race([
          dreamEngineIntegrator.executeFullPipeline(pipelineContext),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Dream timeout')), 15)
          )
        ])
        
        // � WAVE 1168: NEURAL BRIDGE - Cache dream result for UI telemetry
        this.lastDreamIntegrationResult = dreamIntegrationData
        
        // �🔇 WAVE 982.5: DNA logs silenciados (arqueología del día 2)
        /*
        if (dreamIntegrationData) {
          console.log(
            `[SeleneTitanConscious] 🧬 DNA SIMULATION COMPLETE: ${dreamIntegrationData.effect?.effect ?? 'none'} | ` +
            `Dream: ${dreamIntegrationData.dreamTime}ms | Ethics: ${dreamIntegrationData.ethicalVerdict?.ethicalScore?.toFixed(2) ?? 'N/A'}`
          )
        }
        */
      } catch (err: any) {
        console.warn('[SeleneTitanConscious] 🧬 DNA Simulation timeout/error:', err?.message || err)
      }
    }
    
    // 🔮 WAVE 1168: NEURAL BRIDGE - Cache energy zone for UI telemetry
    this.lastEnergyZone = energyContext.zone
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. DECISION MAKER: EL ÚNICO GENERAL (WAVE 1010: UNIFIED BRAIN)
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🎨 WAVE 1028: THE CURATOR - Build SpectralContext for texture awareness
    const spectralContextForDecision = {
      clarity: state.clarity,
      texture: this.deriveTextureFromState(state),
      harshness: state.harshness,
      flatness: state.spectralFlatness,
      centroid: state.spectralCentroid,
    }
    
    const inputs: DecisionInputs = {
      pattern,
      beauty: beautyAnalysis,
      consonance: consonanceAnalysis,
      huntDecision,
      prediction,
      timestamp: state.timestamp,
      // 🧬 WAVE 972.2: DNA DATA para el cerebro
      dreamIntegration: dreamIntegrationData ?? undefined,
      // 🔪 WAVE 1010: Zone & Z-Score Awareness (movido desde Selector)
      energyContext: energyContext,
      zScore: zScore,
      // 🎨 WAVE 1028: THE CURATOR - Spectral Context for texture filtering
      spectralContext: spectralContextForDecision,
      // 🔒 WAVE 1177: CALIBRATION - Check if dictator is active to prevent DIVINE spam
      activeDictator: getEffectManager().hasDictator(),
    }
    
    // 🔍 WAVE 976.3: DEBUG - Ver qué recibe DecisionMaker
    // 🔇 WAVE 982.5: Silenciado
    /*
    if (dreamIntegrationData && this.config.debug) {
      console.log(
        `[SeleneTitanConscious] 🔍 DNA DATA TO DECISIONMAKER: ` +
        `approved=${dreamIntegrationData.approved} | ` +
        `effect=${dreamIntegrationData.effect?.effect ?? 'null'} | ` +
        `ethics=${dreamIntegrationData.ethicalVerdict?.ethicalScore?.toFixed(2) ?? 'N/A'}`
      )
    }
    */
    
    let output = makeDecision(inputs)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔪 WAVE 1010: SIMPLIFIED FLOW - DecisionMaker is THE ONLY decision point
    // ContextualEffectSelector is now EffectRepository (only availability check)
    // ═══════════════════════════════════════════════════════════════════════
    
    // Actualizar trend de energía
    this.updateEnergyTrend(state.rawEnergy)
    
    // Normalizar sección para el selector
    const selectorSection = this.normalizeSectionType(state.sectionType)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔪 WAVE 1010.5: THE PURGE - selectorInput REMOVED (zombie variable)
    // ═══════════════════════════════════════════════════════════════════════
    // DELETED: selectorInput construction (20 lines)
    // REASON: Nunca se usaba después de WAVE 1010 (DecisionMaker es el cerebro)
    // ═══════════════════════════════════════════════════════════════════════
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🧬 WAVE 972.2: DECISION FLOW SIMPLIFICADO
    // DecisionMaker YA decidió (tiene DNA). Solo verificar Gatekeeper.
    // ═══════════════════════════════════════════════════════════════════════
    
    let finalEffectDecision = null
    
    // 1. Si DecisionMaker tiene decisión (ya procesó DNA internamente)
    if (output.effectDecision) {
      let intent = output.effectDecision.effectType
      
      // 🔪 WAVE 1010: DIVINE STRIKE con Arsenal - el Repository elige el arma disponible
      const divineArsenal = (output.effectDecision as any).divineArsenal as string[] | undefined
      if (divineArsenal && divineArsenal.length > 0) {
        // El General ordenó DIVINE STRIKE, el Bibliotecario busca el arma
        const availableWeapon = this.effectSelector.getAvailableFromArsenal(divineArsenal, pattern.vibeId)
        if (availableWeapon) {
          intent = availableWeapon
          output.effectDecision.effectType = availableWeapon
          console.log(
            `[SeleneTitanConscious 🌩️] DIVINE ARSENAL: Selected ${availableWeapon} from [${divineArsenal.join(', ')}]`
          )
        } else {
          // Todo el arsenal en cooldown - silencio forzado
          console.log(
            `[SeleneTitanConscious 🌩️] DIVINE ARSENAL EXHAUSTED - all weapons in cooldown`
          )
          output = {
            ...output,
            effectDecision: null,
            debugInfo: {
              ...output.debugInfo,
              reasoning: `🌩️ DIVINE BLOCKED: Arsenal exhausted [${divineArsenal.join(', ')}]`,
            }
          }
        }
      }
      
      // 🧬 WAVE 973.3: DNA COOLDOWN OVERRIDE (MOOD-AWARE)
      // Si DNA decidió con ethics score alto SEGÚN EL MOOD ACTUAL,
      // ignora cooldown. Cada mood define su umbral ético.
      const isDNADecision = inputs.dreamIntegration?.approved
      const ethicsScore = inputs.dreamIntegration?.ethicalVerdict?.ethicalScore ?? 0
      
      // 🎭 WAVE 973.5: Ethics threshold viene del MoodController
      const currentMoodProfile = MoodController.getInstance().getCurrentProfile()
      const ethicsThreshold = currentMoodProfile.ethicsThreshold
      
      // 🌊 WAVE 1073.4: OCEANIC EFFECTS PROTECTION
      // Los efectos oceánicos NO permiten DNA override en chill-lounge
      // Sus cooldowns son gestionados por ChillStereoPhysics y son sagrados
      const isOceanicEffect = OCEANIC_EFFECTS_NO_OVERRIDE.has(intent)
      const isChillVibe = pattern.vibeId === 'chill-lounge'
      const oceanicProtection = isOceanicEffect && isChillVibe
      
      const hasHighEthicsOverride = isDNADecision && ethicsScore > ethicsThreshold && !oceanicProtection
      
      // 🔪 WAVE 1010: Si ya procesamos DIVINE arsenal, el efecto ya está validado
      const alreadyValidatedByArsenal = divineArsenal && divineArsenal.length > 0 && output.effectDecision
      
      // ═══════════════════════════════════════════════════════════════════════════
      // 🔒 WAVE 1179: DICTATOR HARD MINIMUM PROTECTION
      // ═══════════════════════════════════════════════════════════════════════════
      // Incluso con DNA COOLDOWN OVERRIDE, verificamos el HARD MINIMUM primero.
      // Esto evita que abyssal_rise se dispare 2x en 10 segundos.
      // ═══════════════════════════════════════════════════════════════════════════
      const hardMinimumCheck = this.effectSelector.checkAvailability(intent, pattern.vibeId)
      const isHardMinimumBlocked = hardMinimumCheck.reason?.includes('HARD_COOLDOWN')
      
      const availability = isHardMinimumBlocked
        ? hardMinimumCheck  // 🔒 HARD MINIMUM es LEY ABSOLUTA
        : alreadyValidatedByArsenal
        ? { available: true, reason: 'DIVINE arsenal pre-validated' }
        : hasHighEthicsOverride
        ? { available: true, reason: `DNA override (${currentMoodProfile.emoji} ${currentMoodProfile.name}: ethics ${ethicsScore.toFixed(2)} > ${ethicsThreshold})` }
        : hardMinimumCheck
      
      if (availability.available && output.effectDecision) {
        finalEffectDecision = output.effectDecision
        
        if (hasHighEthicsOverride) {
          console.log(
            `[SeleneTitanConscious] � DNA COOLDOWN OVERRIDE (${currentMoodProfile.emoji} ${currentMoodProfile.name}): ` +
            `${intent} | ethics=${ethicsScore.toFixed(2)} > threshold=${ethicsThreshold}`
          )
        } else if (oceanicProtection && isDNADecision && ethicsScore > ethicsThreshold) {
          // 🌊 WAVE 1073.4: Log cuando protección oceánica bloqueó el override
          console.log(
            `[SeleneTitanConscious] 🌊 OCEANIC PROTECTION: ${intent} respects ChillStereoPhysics cooldown ` +
            `(would have overridden: ethics=${ethicsScore.toFixed(2)} > ${ethicsThreshold})`
          )
        } else {
          console.log(
            `[SeleneTitanConscious] �🧠 DECISION MAKER APPROVED: ${intent} | ` +
            `confidence=${output.effectDecision.confidence?.toFixed(2)} | ${output.effectDecision.reason}`
          )
        }
      } else if (output.effectDecision) {
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
    
    // 🔪 WAVE 976: THE EXORCISM - Fallback eliminado
    // Si DecisionMaker no decidió, SILENCIO. No hay plan B.
    if (!finalEffectDecision) {
      // 🔇 WAVE 976.3: SILENCE LOG THROTTLING - Solo 1 vez cada 5 segundos
      const now = Date.now()
      if (this.config.debug && (now - this.lastSilenceLogTimestamp >= this.SILENCE_LOG_THROTTLE_MS)) {
        console.log(
          `[SeleneTitanConscious] 🧘 SILENCE (throttled, last ${((now - this.lastSilenceLogTimestamp) / 1000).toFixed(1)}s ago) | ` +
          `vibe=${pattern.vibeId} | E=${state.rawEnergy.toFixed(2)} | Z=${zScore.toFixed(2)}σ`
        )
        this.lastSilenceLogTimestamp = now
      }
    }
    
    // 3. Track para cooldown y anti-repetición
    if (finalEffectDecision) {
      this.lastEffectTimestamp = Date.now()
      this.lastEffectType = finalEffectDecision.effectType
      
      // 🔒 WAVE 1177: REMOVED - History push moved to effectTriggered listener
      // This prevents blocked effects from contaminating history
      // (See constructor: effectManager.on('effectTriggered', ...))
      
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
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Umbral bajado a 0.25
    // Ahora TODAS las predicciones medias+ se muestran en UI
    // El Oráculo merece ser escuchado, incluso sin certeza total
    if (prediction.probability > 0.25) {
      this.state.activePrediction = prediction
    } else {
      this.state.activePrediction = null
    }
    
    // 🔌 WAVE 1191: VISUAL SILENCE FIX - Inyectar activePrediction en debugInfo
    // Ahora TitanEngine.getConsciousnessTelemetry() recibirá el dato REAL
    if (this.state.activePrediction) {
      output = {
        ...output,
        debugInfo: {
          ...output.debugInfo,
          activePrediction: {
            type: this.state.activePrediction.type,
            probability: this.state.activePrediction.probability,
            timeUntilMs: this.state.activePrediction.estimatedTimeMs ?? 0,
          }
        }
      }
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
   * 
   * 🚫 WAVE 1169: DEPRECATED - ScenarioSimulator desconectado para V1.0
   * El motor evolutivo y DB están preparados pero no para esta release.
   * Este método ahora es un pass-through que solo registra decisiones.
   * 
   * TODO WAVE 2.0: Reactivar cuando el motor evolutivo esté listo
   */
  private dream(
    state: TitanStabilizedState,
    decision: ConsciousnessOutput
  ): ConsciousnessOutput {
    this.stats.dreamsSimulated++
    
    // 🚫 WAVE 1169: ScenarioSimulator BYPASSED
    // Solo registramos la decisión para análisis de sesgos
    // El dream simulation se reactivará con el motor evolutivo
    recordDecision(decision)
    
    // Pass-through: devolver la decisión sin modificar
    return decision
    
    /* ═══════════════════════════════════════════════════════════════════════
     * 🧊 FROZEN CODE - ScenarioSimulator (reactivar en WAVE 2.0)
     * ═══════════════════════════════════════════════════════════════════════
     *
     * // Obtener pattern y beauty actuales
     * const pattern = this.state.lastPattern ?? senseMusicalPattern(state)
     * const currentBeauty = this.currentBeauty?.totalBeauty ?? 0.5
     * 
     * // Solo soñar en estados de baja energía (cuando hay tiempo)
     * if (state.smoothedEnergy > 0.6 || decision.confidence < 0.4) {
     *   recordDecision(decision)
     *   return decision
     * }
     * 
     * // SCENARIO SIMULATOR: ¿Hay un mejor camino?
     * const dreamResult = simulateDream(state, pattern, currentBeauty)
     * this.state.lastDream = dreamResult
     * 
     * // ... rest of dream logic ...
     * 
     * ═══════════════════════════════════════════════════════════════════════ */
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
    
    // 🚫 WAVE 1169: ScenarioSimulator DEPRECATED for V1.0
    // resetDreamEngine()
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
  // 🔮 WAVE 1168: NEURAL BRIDGE - UI TELEMETRY API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtiene el último resultado del Dream Engine Integrator.
   * Contiene: approved, effect, dreamRecommendation, ethicalVerdict
   */
  getLastDreamResult(): IntegrationDecision | null {
    return this.lastDreamIntegrationResult
  }
  
  /**
   * Obtiene la zona de energía actual del EnergyConsciousness.
   * Zonas: silence, valley, ambient, gentle, active, intense, peak
   */
  getEnergyZone(): 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak' {
    return this.lastEnergyZone
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

  /**
   * 🔥 WAVE 1176: OPERATION SNIPER - Obtiene la velocidad de energía cruda
   * Para mostrar en UI el slope de predicción
   */
  getEnergyVelocity(): number {
    const state = getEnergyPredictionState()
    return state.velocity
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
