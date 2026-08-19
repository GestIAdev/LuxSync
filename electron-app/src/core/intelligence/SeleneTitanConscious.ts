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
  getEligibleCandidates,
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
// ⚡ WAVE 4843: COGNITIVE BRIDGE — isHighSeverityEffect() reemplaza HEAVY_ARSENAL_EFFECTS
import { getDynamicEffectRegistry, effectDisplayName } from '../arsenal/DynamicEffectRegistry'
import type { FrozenGenome } from '../arsenal/lfxTypes'
// 🔬 WAVE 7539: getSpeciesQuotaSelector removed — semantic gating means we no
// longer query the DB for a fallback genome. Only Cassandra pre-buffer DNA is
// semantically valid for s_DNA Context-Genome Resonance.

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 973.3: MOOD CONTROLLER - Para ethics threshold
// ═══════════════════════════════════════════════════════════════════════════

import { MoodController } from '../mood/MoodController'

// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 978: ENERGY LOGGER
// ═══════════════════════════════════════════════════════════════════════════

import { EnergyLogger } from './EnergyLogger'

/**
 * ⚡ WAVE 4843: ¿Es este efecto de alta severidad (DROP/DIVINE-tier)?
 * Consulta el RegistryEntry: isHeavyCandidate, isDivineCandidate o isStrobe.
 * Reemplaza HEAVY_ARSENAL_EFFECTS.has() en el Refractory Lock de WAVE 4860.
 */
function isHighSeverityEffect(effectId: string): boolean {
  const simMeta = getDynamicEffectRegistry().getEntry(effectId)?.simMeta
  if (!simMeta) return false
  return simMeta.isHeavyCandidate || simMeta.isDivineCandidate || simMeta.isStrobe
}

// DEBUG ENERGY FLAG - Set to true to enable CSV logging
const DEBUG_ENERGY = false  // WAVE 2098: Calibration complete, lab closed

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
  DropBridge,
  type DropBridgeResult,
} from './think'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WAVE 685: CONTEXTUAL EFFECT SELECTOR
// 🔪 WAVE 1010.5: THE PURGE - Interfaces deprecated removidas
// ═══════════════════════════════════════════════════════════════════════════

import {
  ArsenalRepository,
  getArsenalRepository,
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
// 🌊 WAVE 7003.3: SELENE V3 LIQUID COGNITION — SHADOW MODE
// ═══════════════════════════════════════════════════════════════════════════

import {
  LiquidCognitionCore,
  type LiquidVerdict,
} from './liquid/LiquidCognitionCore'
import { LiquidTelemetryRecorder } from './liquid/LiquidTelemetryRecorder'
import { SovereignClockGuard } from './guards/SovereignClockGuard'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 7004.5: SELENE V3 AUTHORITY CUTOVER
// ═══════════════════════════════════════════════════════════════════════════
// V3 Liquid Cognition tiene autoridad sobre SI disparar. El fluido `ignite`
// es la señal soberana. V2 (DecisionMaker) sigue seleccionando QUÉ efecto,
// pero no puede vetar el disparo cuando V3 dice ignite.
// Los mecanismos de seguridad (HARD_COOLDOWN, VisualConscienceEngine)
// siguen evaluando el candidato — V3 tiene autoridad, no inmunidad.
const SELENE_V3_AUTHORITY = true

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
  
  private dropBridge: DropBridge
  private lastDropBridgeResult: DropBridgeResult | null = null
  
  // 🎯 WAVE 685: Arsenal Repository (WAVE 4992)
  private effectSelector: ArsenalRepository
  private lastEffectTimestamp: number = 0
  private lastEffectType: string | null = null
  private energyTrend: 'rising' | 'stable' | 'falling' = 'stable'
  // 🩸 WAVE 6040: REGLA DEL VALLE — energía mínima desde último disparo
  private minEnergySinceLastEffect: number = 1.0
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

  // §5.3: Aesthetic cooldowns ERADICATED — V(t) vapor pressure is the sole
  // refractory mechanism. The 8 legacy timers (global, pipeline, DNA override,
  // bypass V3, post-drop, drop chain, just-fired, Latina-specific) have been
  // purged. Only HARD_COOLDOWN (photosensitive epilepsy compliance, enforced
  // by ArsenalRepository.checkAvailability) survives as a safety limit.

  // ═══════════════════════════════════════════════════════════════════════
  // 🎧 WAVE 4863: FFT X-RAY SNIFFER — Diagnóstico temporal de bandas
  // ═══════════════════════════════════════════════════════════════════════
  // Buffer rodante de 180 frames (~3s @ 60fps) para auditar qué bandas
  // mantienen el Absolute Energy Gate abierto durante los valles del reggaetón.
  // Se sospecha que la compresión de voces (MID) sostiene el candado artificialmente.
  // ═══════════════════════════════════════════════════════════════════════
  private readonly FFT_XRAY_BUFFER_SIZE = 180        // 3s @ 60fps
  private readonly FFT_XRAY_LOG_INTERVAL_MS = 3000   // Log cada 3s
  private _fftXRayLow: Float32Array = new Float32Array(this.FFT_XRAY_BUFFER_SIZE)
  private _fftXRayMid: Float32Array = new Float32Array(this.FFT_XRAY_BUFFER_SIZE)
  private _fftXRayHigh: Float32Array = new Float32Array(this.FFT_XRAY_BUFFER_SIZE)
  private _fftXRayTotal: Float32Array = new Float32Array(this.FFT_XRAY_BUFFER_SIZE)
  private _fftXRayHead: number = 0
  private _fftXRayCount: number = 0
  private _fftXRayLastLogMs: number = 0

  // 🔮 WAVE 1168: NEURAL BRIDGE - Dream/Energy state for UI telemetry
  private lastDreamIntegrationResult: IntegrationDecision | null = null
  // 🔬 WAVE 7522: Throttle map for DNA simulation log (was 60fps spam)
  private _dnaLogThrottle = new Map<string, number>()
  private lastEnergyZone: 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak' = 'ambient'

  // 🩸 WAVE 2102: Evitar spam logs
  private lastGatekeeperLogs: Record<string, number> = {}
  // 🩸 WAVE 2111: FALLTHROUGH ABOLISHED — exhaustion cache no longer needed.
  // History: WAVE 2100 introduced fallthrough. WAVE 2104.2 added exhaustion cache.
  // 11 WAVEs of patches later, the whole concept was wrong. Silence > garbage effects.
  // private fallthroughExhaustionCache: Record<string, number> = {}   // DEAD CODE
  // private readonly FALLTHROUGH_EXHAUSTION_COOLDOWN_MS = 5000       // DEAD CODE

  // 🩸 WAVE 2105: THROTTLE constitution violation logs (65 lines of spam per 700-line log)
  private _constitutionLogThrottle: Record<string, number> = {}

  // V3 TUNE: Throttle Gatekeeper telemetry — only log on state change, not every frame
  private _lastGatekeeperLogKey: string = ''

  // 🩸 WAVE 2106: SECTION CHANGE DETECTION — invalidate DNA cache on section transitions
  // LOG EVIDENCE: acid_sweep DNA result computed during buildup gets CACHED,
  // then FIRES during breakdown when GLOBAL_COOLDOWN expires and cache is reused.
  // The cached decision was correct FOR THE BUILDUP — but the music moved on.
  // Track last section to detect transitions and nuke the stale cache.
  private _lastSectionForCacheInvalidation: string = ''

  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 7004.5: LIQUID COGNITION V3 — AUTHORITY MODE
  // V3 tiene autoridad sobre SI disparar (ignite). V2 selecciona QUÉ efecto.
  // HARD_COOLDOWN y VisualConscienceEngine siguen evaluando el candidato.
  // ═══════════════════════════════════════════════════════════════════════
  private _liquidCore: LiquidCognitionCore = new LiquidCognitionCore()
  private _lastLiquidVerdict: LiquidVerdict | null = null
  /**
   * Buffer pre-asignado [low, mid, high] para el TRUE CREST DETECTOR de Π.
   * La intensidad de Poisson de una superposición de procesos independientes
   * es la suma de intensidades: un kick y un hi-hat son DOS transitorios, y
   * una única envolvente de banda ancha solo registraría uno.
   */
  private readonly _bandEnergies = new Float32Array(3)
  private _liquidRecorder: LiquidTelemetryRecorder = new LiquidTelemetryRecorder()
  private _v3Ignite: boolean = false
  private _lastSuppressedLog: number = 0
  private _sovereignGuard: SovereignClockGuard = new SovereignClockGuard()

  // 🧬 WAVE 7535 → WAVE 7539: Candidate DNA resolution for s_DNA Context-Genome
  // Resonance. Semantic gating: only Cassandra pre-buffer DNA is used.
  // The SpeciesQuotaSelector fallback fields were removed (Option C).
  // FrozenGenome import retained for the return type of _resolveCandidateGenome.

  constructor(config: Partial<SeleneTitanConsciousConfig> = {}) {
    super()
    
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    // 🧠 WAVE 666: Inicializar memoria contextual
    // 🐘 WAVE 4861: 300→1800 — The Elephant Memory (30s @ 60fps)
    // WAVE 1181 corrigió el DEFAULT del módulo pero la instancia aquí seguía en 300.
    // Z-Scores sobre 5s provocan inflación estadística en valles breves → false positives.
    this.contextualMemory = new ContextualMemory({
      bufferSize: 1800,      // 🐘 WAVE 4861: 30 segundos @ 60fps (was 300 = 5s)
      zScoreNotable: 1.5,
      zScoreSignificant: 2.0,
      zScoreEpic: 2.5,       // Threshold para anomalía
    })
    
    this.dropBridge = new DropBridge({
      peakSections: ['drop', 'chorus'],
    })
    
    // 🎯 WAVE 685: Inicializar Arsenal Repository
    this.effectSelector = new ArsenalRepository()
    
    // 🔋 WAVE 931: Inicializar motor de consciencia energética
    // Diseño asimétrico: Lento para entrar en silencio, rápido para detectar drops
    this.energyConsciousness = createEnergyConsciousnessEngine()
    
    // 🧪 WAVE 978: Inicializar Energy Logger si DEBUG activo
    if (DEBUG_ENERGY) {
      EnergyLogger.initialize()
    }
    
    // 🔥 WAVE 810.5: COOLDOWN SURGERY - Escuchar disparos exitosos
    // Solo registrar cooldown cuando EffectManager REALMENTE dispara el efecto
    // (no bloqueado por Shield/Traffic)
    const effectManager = getEffectManager()
    effectManager.on('effectTriggered', (event: any) => {
      this.effectSelector.registerEffectFired(event.effectType)
      console.log(`[SeleneTitanConscious 🔥] Cooldown registered: ${effectDisplayName(event.effectType)}`)
      
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
    
    // 🩸 WAVE 2530: Invalidate cached dream result on mood change.
    // lastDreamIntegrationResult is reused when global cooldown blocks the
    // pipeline. Without this, switching from CALM to BALANCED would keep
    // serving the CALM-filtered result until the cooldown expired.
    MoodController.getInstance().onMoodChange(() => {
      this.lastDreamIntegrationResult = null
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

    // 🌊 WAVE 7004.5: Liquid Cognition V3 — Authority Mode init
    this._liquidCore = new LiquidCognitionCore()
    this._lastLiquidVerdict = null
    this._liquidRecorder = new LiquidTelemetryRecorder()
    this._v3Ignite = false

    if (this.config.debug) {
      // WAVE 2098: Boot silence — GENESIS banner removed (debug-only noise)
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

  /**
   * 🧬 WAVE 7535 → WAVE 7539: Resolves the candidate effect genome for s_DNA
   * Context-Genome Resonance.
   *
   * 🔬 WAVE 7539: SEMANTIC GATING (Option C — Confidence Resuscitation).
   *
   * The genome is ONLY returned when it comes directly from Cassandra's
   * pre-buffer — i.e., when there IS a concrete candidate effect that Selene
   * is about to evaluate. In that case, measuring context-genome resonance
   * is semantically valid: we're asking "does this SPECIFIC effect's DNA
   * match the room right now?"
   *
   * The previous SpeciesQuotaSelector fallback was semantically invalid: the
   * top organism in the DB is NOT the candidate for an ambient tick. Feeding
   * its DNA into the Gaussian kernel produced low s_DNA values on every
   * non-Cassandra frame, which suppressed C(t) below Q_base and silently
   * killed Selene's ignition capability.
   *
   * When no pre-buffer is active, returns null → s_DNA falls back to the
   * internal coherence formula (geometric mean of acoustic descriptors),
   * which was the original behavior before WAVE 7535 and is semantically
   * correct for general ambient frames.
   *
   * This closes Bucle 1 of the Area 5 audit: the candidate genome now
   * influences the ignition DECISION, not just the selection — but only
   * when there IS a candidate.
   */
  private _resolveCandidateGenome(_now: number): FrozenGenome | null {
    // Cassandra pre-buffer — the ONLY semantically valid source.
    // The pre-buffered effect IS the candidate Selene is about to evaluate.
    const bufferStatus = dreamEngineIntegrator.getPreBufferStatus()
    if (bufferStatus) {
      const entry = getDynamicEffectRegistry().getEntry(bufferStatus.effectId)
      if (entry?.dna) {
        return entry.dna
      }
    }

    // No pre-buffer active → no candidate → return null.
    // s_DNA will use the internal coherence fallback (geometric mean),
    // which is the correct formula for general ambient frames.
    return null
  }

  async process(titanState: TitanStabilizedState): Promise<ConsciousnessOutput> {
    this.state.framesProcessed++
    this.stats.framesProcessed++
    // 🩸 WAVE 6040: REGLA DEL VALLE — rastrear valle de energía post-disparo
    this.minEnergySinceLastEffect = Math.min(this.minEnergySinceLastEffect, titanState.rawEnergy)
    
    // ─────────────────────────────────────────────────────────────────────
    // 0. 👁️ SENSE + 🌊 V3 LIQUID COGNITION — MUST RUN EVERY FRAME
    // V3 procesa ANTES que el EnergyOverride para que `ignite` pueda bypassarlo.
    // Si V3 dice "fuego ahora", ni siquiera el EnergyOverride puede silenciarlo.
    // 🌊 WAVE 8007: Movido ANTES del `enabled` check — la telemetría V3 debe
    // grabarse incluso cuando la consciencia está deshabilitada (modo reactivo).
    // ─────────────────────────────────────────────────────────────────────
    const pattern = this.sense(titanState)
    this.updateHistory(pattern)

    {
      // V3.4: Sync mood to LiquidCognitionCore (zero-alloc check, only acts on change)
      const currentMood = MoodController.getInstance().getCurrentMood()
      if (this._liquidCore.mood !== currentMood) {
        this._liquidCore.setMood(currentMood)
      }

      const now = Date.now()
      const zScore = this.lastMemoryOutput?.stats.energy.zScore ?? 0
      const energyMax = this.lastMemoryOutput?.stats.energy.max ?? titanState.rawEnergy
      const beauty = this.currentBeauty?.totalBeauty ?? 0.5
      const consonance = this.currentConsonance?.totalConsonance ?? 0.7

      const predProb = this.state.activePrediction?.probability ?? 0
      const predAlign = this.state.activePrediction ? 0.7 : 0.0

      // 🧬 WAVE 7535: Resolve candidate effect genome for s_DNA resonance.
      // Priority: Cassandra pre-buffer → SpeciesQuotaSelector fallback (cached 2s).
      const effectGenome = this._resolveCandidateGenome(now)

      // Bandas para el detector de crestas de Π (escritura in-place, zero-alloc)
      this._bandEnergies[0] = titanState.bass
      this._bandEnergies[1] = titanState.mid
      this._bandEnergies[2] = titanState.high

      this._lastLiquidVerdict = this._liquidCore.process({
        rawEnergy: titanState.rawEnergy,
        zScore,
        energyMaxHistoric: energyMax,
        bassPresence: titanState.bass,
        midPresence: titanState.mid,
        harshness: titanState.harshness,
        spectralFlatness: titanState.spectralFlatness,
        harmonicDensity: pattern.harmonicDensity,
        syncopation: pattern.syncopation,
        rhythmicIntensity: pattern.rhythmicIntensity,
        bandEnergies: this._bandEnergies,
        predictionProbability: predProb,
        predictionAlignment: predAlign,
        totalBeauty: beauty,
        consonance,
        contextualPhase: this.lastMemoryOutput?.narrative?.narrativePhase ?? 'building',
        isWarmedUp: this.lastMemoryOutput?.isWarmedUp ?? false,
        acousticReality: this.lastMemoryOutput?.acousticReality,
        effectGenome,
      }, now)

      this._v3Ignite = SELENE_V3_AUTHORITY && this._lastLiquidVerdict.ignite

      if (this._v3Ignite) {
        const now = Date.now()
        if (now - this._lastSuppressedLog > 1000) {
          const lv = this._lastLiquidVerdict!
          const fd = this._liquidCore.descriptors
          console.log(
            `[SeleneTitanConscious 🌊] V3 IGNITE: C=${lv.confidence.toFixed(3)} ` +
            `Q=${lv.squelch.toFixed(3)} I_fx=${lv.intensity.toFixed(3)} ` +
            `epicness=${lv.epicness.toFixed(3)} ` +
            `| I(t)=${lv.fluid.impact.toFixed(3)} CF=${lv.fluid.crestFactor.toFixed(3)} ` +
            `T=${lv.fluid.tension.toFixed(3)} μ=${lv.fluid.viscosity.toFixed(3)} ` +
            `V=${lv.fluid.vaporPressure.toFixed(3)} X=${lv.fluid.excitability.toFixed(3)} ` +
            `| Π=${fd.percussiveness.toFixed(3)} M=${fd.melodicity.toFixed(3)} ` +
            `Δ=${fd.dirtiness.toFixed(3)} G=${fd.groove.toFixed(3)} ` +
            `→ V3 AUTHORITY ACTIVE`
          )
          this._lastSuppressedLog = now
        }
      }

      // 🌊 WAVE 7003.4: Grabar frame en la Caja Negra (ring buffer zero-alloc)
      // 🌊 WAVE 8007: Movido aquí (antes del `enabled` check) para que la telemetría
      // se grabe incluso en modo reactivo (consciencia deshabilitada).
      this._liquidRecorder.recordFrame(this._lastLiquidVerdict, now, titanState.snare_energy, titanState.hh_energy)
    }

    // ─────────────────────────────────────────────────────────────────────
    // 0. CHECK: ¿Está habilitada la consciencia?
    // ─────────────────────────────────────────────────────────────────────
    if (!this.config.enabled) {
      return this.lastOutput
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 0.5 🔮 CASSANDRA'S SOVEREIGN CLOCK (WAVE 5011) + 🪟 GLASS BREAK SENSOR (WAVE 5016)
    // Fast path: si Cassandra tiene un efecto pre-bufferizado cuyo executeAt
    // ha llegado, lo disparamos AHORA — sin pasar por HuntEngine, Fuzzy,
    // ni ningún gate energético. Esta es la voluntad del Oráculo y es LEY.
    // Ventana de ejecución soberana: [predictedEventAt, predictedEventAt + 500ms]
    //
    // 🪟 WAVE 5016 — DROP COLLISION (GLASS BREAK):
    // Cassandra era esclava de su propio reloj. Si faltaba 1s para el disparo
    // pre-bufferizado pero el DJ adelantaba el drop (la energía/Z-score explota
    // AHORA), el sistema se quedaba sordo esperando a su countdown.
    // El Glass Break detecta ese impacto masivo inmediato: si hay un sello
    // temporal en cuenta regresiva (timeToEvent > 0) y el motor sensorial
    // reporta un Z-Score anómalo con energía real alta, Selene ROMPE EL CRISTAL:
    // aborta la cuenta atrás, dispara el efecto retenido al instante y limpia
    // el buffer.
    // ─────────────────────────────────────────────────────────────────────
    {
      const bufferStatus = dreamEngineIntegrator.getPreBufferStatus()
      if (bufferStatus) {
        const nowSovereign = Date.now()
        const fd = this._liquidCore.descriptors
        const verdict = this._sovereignGuard.evaluate({
          now: nowSovereign,
          bufferStatus,
          candidate: dreamEngineIntegrator.getPreBufferedCandidate(),
          titanState,
          currentZScore: this.contextualMemory.getEnergyZScore(),
          minEnergySinceLastEffect: this.minEnergySinceLastEffect,
          isWarmedUp: this.contextualMemory.isWarmedUp,
          epicness: this._lastLiquidVerdict?.epicness ?? 0,
          acousticReality: this.lastMemoryOutput?.acousticReality ?? null,
          rmsAverage10s: this.energyConsciousness.getRmsAverage10s(),
          effectHistory: this.effectHistory,
          descriptors: {
            percussiveness: fd.percussiveness,
            melodicity: fd.melodicity,
            dirtiness: fd.dirtiness,
            groove: fd.groove,
          },
          crestEvent: this._liquidCore.crestEvent,
        })

        if (verdict.action === 'clear') {
          console.log(
            `[SeleneTitanConscious] 🔮💀 CASSANDRA SILENT CLEAR: "${bufferStatus.effectId}" expired`
          )
          dreamEngineIntegrator.clearPreBuffer()
        } else if (verdict.action === 'abort') {
          console.log(
            `[SeleneTitanConscious] 🔮🚫 CASSANDRA SOVEREIGN ABORT: "${bufferStatus.effectId}" ` +
            `| ${verdict.reason}`
          )
          dreamEngineIntegrator.clearPreBuffer()
          this.lastOutput = createEmptyOutput()
          return this.lastOutput
        } else if (verdict.action === 'fire' && verdict.candidate) {
          dreamEngineIntegrator.clearPreBuffer()
          const candidate = verdict.candidate
          const fireEffectId = verdict.reroutedEffectId ?? candidate.effect
          const fireEffectName = verdict.reroutedEffectId
            ? effectDisplayName(verdict.reroutedEffectId)
            : candidate.effectName
          const fireIntensity = verdict.reroutedEffectId
            ? Math.min(candidate.intensity, 0.75)
            : candidate.intensity

          if (verdict.trigger === 'glass_break') {
            console.log(
              `[SeleneTitanConscious] 🪟💥 CASSANDRA GLASS BREAK: firing "${fireEffectName ?? fireEffectId}" ` +
              `| drop landed EARLY | ${verdict.reason ?? ''}`
            )
          } else {
            console.log(
              `[SeleneTitanConscious] 🔮👑 CASSANDRA SOVEREIGN CLOCK: firing "${fireEffectName ?? fireEffectId}" ` +
              `| confidence=${candidate.confidence.toFixed(2)}` +
              `${verdict.reroutedEffectId ? ' | 🔄 HEAVY RE-ROUTED' : ''}` +
              `| bypassing HuntEngine + Fuzzy + EnergyOverride`
            )
          }

          const reason = verdict.trigger === 'glass_break'
            ? `🪟💥 CASSANDRA GLASS BREAK (WAVE 5016)`
            : verdict.reroutedEffectId
              ? `🔮👑 CASSANDRA SOVEREIGN CLOCK (WAVE 5011) 🔄 HEAVY RE-ROUTE`
              : '🔮👑 CASSANDRA SOVEREIGN CLOCK (WAVE 5011)'

          const sovereignOutput: ConsciousnessOutput = {
            ...createEmptyOutput(),
            confidence: Math.max(candidate.confidence, 0.85),
            effectDecision: {
              effectType: fireEffectId,
              effectName: fireEffectName,
              intensity: fireIntensity,
              zones: (candidate.zones.length > 0 ? candidate.zones : ['all']) as any,
              confidence: Math.max(candidate.confidence, 0.85),
              reason,
            },
            timestamp: nowSovereign,
            source: 'hunt',
          }

          this.lastEffectTimestamp = nowSovereign
          this.minEnergySinceLastEffect = 1.0
          this.lastEffectType = fireEffectId
          this.effectHistory.push({ type: candidate.effect, timestamp: nowSovereign })
          if (this.effectHistory.length > 20) this.effectHistory.shift()

          this.lastOutput = sovereignOutput
          return sovereignOutput
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 1. ⚡ ENERGY OVERRIDE CHECK — V3 ignite can bypass this
    // "En los drops, la física manda" — unless V3 says "fuego ahora"
    // ─────────────────────────────────────────────────────────────────────
    const energyOverride = applyEnergyOverride(titanState)
    
    if (energyOverride && !this._v3Ignite) {
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
    // 🩸 WAVE 7543: UNIVERSAL BASS GATE — V3 Ignition Anti-Autotune Veto
    // 🩸 WAVE 7553: REVERTED to simple bass <= 0.35 veto. Removed zL checks,
    //   vocal dominance, and ratio checks (WAVE 7550-7552 bloat purged).
    //   The .lfx zScoreGuards.minimumZ system was also eradicated — Z-floor
    //   is now centralized in code (Z >= 1.0 for heavy effects).
    // ─────────────────────────────────────────────────────────────────────
    if (finalOutput.effectDecision && this._v3Ignite) {
      const effectId = finalOutput.effectDecision.effectType
      if (isHighSeverityEffect(effectId)) {
        const V3_BASS_GATE_THRESHOLD = 0.35
        const v3BassEnergy = titanState.bass
        // 🩸 WAVE 7553: CENTRALIZED HEAVY Z-FLOOR — Z >= 1.0 for heavy effects
        const V3_HEAVY_MIN_Z = 1.0
        const v3ZScore = this.contextualMemory.getEnergyZScore()
        if (v3BassEnergy <= V3_BASS_GATE_THRESHOLD) {
          console.log(
            `[SeleneTitanConscious 🌊🛡️] V3 BASS GATE VETO: ` +
            `"${finalOutput.effectDecision.effectName ?? effectId}" suppressed ` +
            `(bass=${v3BassEnergy.toFixed(3)} ≤ ${V3_BASS_GATE_THRESHOLD}) — ` +
            `vocal/autotune false positive, no sub-bass foundation`
          )
          finalOutput.effectDecision = null
        } else if (v3ZScore < V3_HEAVY_MIN_Z) {
          console.log(
            `[SeleneTitanConscious 🌊🛡️] V3 HEAVY Z-FLOOR VETO: ` +
            `"${finalOutput.effectDecision.effectName ?? effectId}" suppressed ` +
            `(Z=${v3ZScore.toFixed(2)}σ < ${V3_HEAVY_MIN_Z}) — ` +
            `energy not statistically unusual enough for heavy effect`
          )
          finalOutput.effectDecision = null
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 🌊 WAVE 7004.5: LIQUID COGNITION V3 — POST-VALIDATE TELEMETRY
    // El veredicto V3 ya fue computado antes de think(). Aquí solo
    // registramos telemetría y notificamos ignición materializada.
    // ─────────────────────────────────────────────────────────────────────
    if (this._lastLiquidVerdict) {
      const now = Date.now()

      // Si V3 ignite Y un efecto pasó todos los gates → notificar ignición materializada
      if (this._lastLiquidVerdict.ignite && finalOutput.effectDecision) {
        this._liquidCore.notifyIgnition(this._lastLiquidVerdict.intensity, now)
        console.log(
          `[SeleneTitanConscious 🌊✅] V3 IGNITION MATERIALIZED: ` +
          `${finalOutput.effectDecision.effectName ?? finalOutput.effectDecision.effectType} ` +
          `| I=${this._lastLiquidVerdict.intensity.toFixed(3)}`
        )
      } else if (this._v3Ignite && !finalOutput.effectDecision) {
        // V3 quiso disparar pero V2/safety no produjo un candidato válido
        if (now - this._lastSuppressedLog > 1000) {
          console.log(
            `[SeleneTitanConscious 🌊⏸️] V3 IGNITE SUPPRESSED: no valid effect candidate ` +
            `(HARD_COOLDOWN or Gatekeeper blocked) — safety wins`
          )
          this._lastSuppressedLog = now
        }
      }

      // Exponer telemetría V3 en debugInfo
      finalOutput.debugInfo.liquidCognition = {
        ignite: this._lastLiquidVerdict.ignite,
        confidence: this._lastLiquidVerdict.confidence,
        squelch: this._lastLiquidVerdict.squelch,
        intensity: this._lastLiquidVerdict.intensity,
        epicness: this._lastLiquidVerdict.epicness,
        tension: this._lastLiquidVerdict.fluid.tension,
        viscosity: this._lastLiquidVerdict.fluid.viscosity,
        vaporPressure: this._lastLiquidVerdict.fluid.vaporPressure,
        excitability: this._lastLiquidVerdict.fluid.excitability,
        temperature: this._lastLiquidVerdict.fluid.temperature,
        impact: this._lastLiquidVerdict.fluid.impact,
        crestFactor: this._lastLiquidVerdict.fluid.crestFactor,
        sensors: {
          s_DNA: this._lastLiquidVerdict.sensors.s_DNA,
          s_Z: this._lastLiquidVerdict.sensors.s_Z,
          s_E: this._lastLiquidVerdict.sensors.s_E,
          s_V: this._lastLiquidVerdict.sensors.s_V,
          s_X: this._lastLiquidVerdict.sensors.s_X,
          s_P: this._lastLiquidVerdict.sensors.s_P,
          s_B: this._lastLiquidVerdict.sensors.s_B,
        },
      }
    }

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
      // console.log(`[SeleneTitanConscious] 🐱 Hunt=${this.state.huntPhase} Section=${pattern.section} Conf=${finalOutput.confidence.toFixed(2)}`)
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
    // 🌊 M-SARFE Phase 3: Pass evidence + multiSpectralZone for TVE + Coupler
    this.lastMemoryOutput = this.contextualMemory.update({
      energy: state.rawEnergy,
      bass: state.bass,
      harshness: state.harshness,
      sectionType: state.sectionType as any, // Compatibilidad de tipos
      timestamp: state.timestamp,
      hasTransient: false, // TODO: Integrar detección de transientes
      evidence: state.sectionEvidence,
      multiSpectralZone: this.energyConsciousness.getMultiSpectralZone() ?? undefined,
    })
    
    // 🧠 WAVE 666: Enriquecer el patrón con Z-Score de energía
    const enrichedPattern: SeleneMusicalPattern = {
      ...pattern,
      energyZScore: this.lastMemoryOutput.stats.energy.zScore,
      // 🎧 WAVE 4867: Bass suavizado — inercia contra plosivas y 808 cortos
      bassPresenceSustained: this._fftXRayAvgLowLastN(30),
    }
    
    // 🎧 WAVE 4863: FFT X-Ray — alimentar buffer de diagnóstico de bandas
    this._fftXRayUpdate(state.bass, state.mid, state.high, state.rawEnergy, state.timestamp)

    // Capturar belleza y consonancia para decisiones posteriores
    this.currentBeauty = senseBeauty(state.currentPalette, enrichedPattern)
    this.currentConsonance = senseConsonance(state.currentPalette, enrichedPattern)
    
    return enrichedPattern
  }

  /**
   * 🎧 WAVE 4867: Promedio de los últimos N frames del buffer LOW.
   * Usado por el Sustained Spectral Gate para ignorar plosivas instantáneas.
   */
  private _fftXRayAvgLowLastN(n: number): number {
    const count = Math.min(n, this._fftXRayCount)
    if (count === 0) return 0
    let sum = 0
    const head = this._fftXRayHead
    for (let i = 0; i < count; i++) {
      const idx = (head - 1 - i + this.FFT_XRAY_BUFFER_SIZE) % this.FFT_XRAY_BUFFER_SIZE
      sum += this._fftXRayLow[idx]
    }
    return sum / count
  }

  /**
   * 🎧 WAVE 4863: FFT X-RAY SNIFFER
   * Buffer rodante de 3s con media por bandas. Log periódico en consola para
   * correlacionar qué banda sostiene el Absolute Energy Gate en los valles.
   */
  private _fftXRayUpdate(low: number, mid: number, high: number, total: number, nowMs: number): void {
    const idx = this._fftXRayHead % this.FFT_XRAY_BUFFER_SIZE
    this._fftXRayLow[idx]   = low
    this._fftXRayMid[idx]   = mid
    this._fftXRayHigh[idx]  = high
    this._fftXRayTotal[idx] = total
    this._fftXRayHead++
    if (this._fftXRayCount < this.FFT_XRAY_BUFFER_SIZE) this._fftXRayCount++

    if (nowMs - this._fftXRayLastLogMs >= this.FFT_XRAY_LOG_INTERVAL_MS) {
      this._fftXRayLastLogMs = nowMs
      const n = this._fftXRayCount
      let sumLow = 0, sumMid = 0, sumHigh = 0, sumTotal = 0
      for (let i = 0; i < n; i++) {
        sumLow   += this._fftXRayLow[i]
        sumMid   += this._fftXRayMid[i]
        sumHigh  += this._fftXRayHigh[i]
        sumTotal += this._fftXRayTotal[i]
      }
      const avgLow   = sumLow   / n
      const avgMid   = sumMid   / n
      const avgHigh  = sumHigh  / n
      const avgTotal = sumTotal / n
      const max30s   = this.lastMemoryOutput?.stats.energy.max ?? 0
      console.log(
        `[FFT X-RAY 🎧] 3s Avg -> LOW: ${avgLow.toFixed(3)} | MID: ${avgMid.toFixed(3)} | ` +
        `HIGH: ${avgHigh.toFixed(3)} | TOTAL: ${avgTotal.toFixed(3)} | Max_30s: ${max30s.toFixed(3)}`
      )
    }
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
    
    // 2. HUNT ENGINE: V3.3.B — Telemetry-only FSM (no mathematical authority)
    const huntDecision = processHunt(pattern)
    
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
    }, state.sectionEvidence, pattern.vibeId)
    
    // 🔋 WAVE 934+: Log zone transitions only when persistent (prevent spam)
    // Track frames in current zone
    if (energyContext.zone === this.lastLoggedZone) {
      this.framesInLastLoggedZone++
    } else {
      // Zone changed
      if (this.framesInLastLoggedZone >= this.ZONE_LOG_THRESHOLD && this.lastLoggedZone !== null) {
        // Log the LAST zone transition after it was stable
        // console.log(`[SeleneTitanConscious 🔋] Zone transition: ${this.lastLoggedZone} → ${energyContext.zone} (E=${state.rawEnergy.toFixed(2)})`)
      }
      this.lastLoggedZone = energyContext.zone
      this.framesInLastLoggedZone = 0
    }
    
    this.lastDropBridgeResult = this.dropBridge.check({
      energyZScore: zScore,
      sectionType: normalizedSection as 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro',
      rawEnergy: state.rawEnergy,
      vibeId: pattern.vibeId,
      hasKick: false, // TODO: Integrar detección de transientes
      harshness: state.harshness,
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
    // 🩸 WAVE 2106: SECTION CHANGE → INVALIDATE DNA CACHE
    // ═══════════════════════════════════════════════════════════════════════
    // LOG EVIDENCE: buildup→breakdown transition at line 84 of log.
    //   DNA computed acid_sweep for buildup context → GLOBAL_COOLDOWN caches it.
    //   Cooldown expires during breakdown → cached acid_sweep FIRES in darkness.
    //   The DNA result was stale — computed for a different musical moment.
    // FIX: When section changes, nuke lastDreamIntegrationResult.
    //   Next tick must run a fresh DNA pipeline (or get SILENCE from DecisionMaker).
    // ═══════════════════════════════════════════════════════════════════════
    if (normalizedSection !== this._lastSectionForCacheInvalidation) {
      if (this._lastSectionForCacheInvalidation !== '') {
        // Not the first frame — this is a real transition
        this.lastDreamIntegrationResult = null
      }
      this._lastSectionForCacheInvalidation = normalizedSection
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // ⏱️ WAVE 2730: CACHE STALENESS CHECK — Si el efecto cacheado ya se disparó,
    // el cache es stale. Sin esto, el mismo efecto puede ser aprobado frame a frame
    // porque el cache sigue diciendo "approved: X" pero X ya está en cooldown.
    // El Gatekeeper del EffectManager (WAVE 2730) lo bloqueará, pero mejor
    // no contaminar al DecisionMaker con decisiones que ya se ejecutaron.
    // ═══════════════════════════════════════════════════════════════════════
    if (this.lastDreamIntegrationResult?.approved && this.lastDreamIntegrationResult.effect?.effect) {
      const cachedEffect = this.lastDreamIntegrationResult.effect.effect
      try {
        const selector = getArsenalRepository()
        const cachedAvailability = selector.checkAvailability(cachedEffect, pattern.vibeId)
        if (!cachedAvailability.available) {
          this.lastDreamIntegrationResult = null
        }
      } catch (_) {
        // Selector no inicializado — mantener cache
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // � WAVE 976.7: DNA SIMULATION - Hunt dice hay presa → DNA simula
    // 🔒 WAVE 1179: PERO SOLO SI NO HAY DICTADOR
    // ═══════════════════════════════════════════════════════════════════════
    // DNA NO TIENE COOLDOWN. DNA simula CADA VEZ que Hunt detecta momento worthy.
    // Gatekeeper controla el spam con cooldowns de efectos.
    // 🔒 WAVE 1179: Si hay dictador activo, el DNA respeta el silencio.
    // ═══════════════════════════════════════════════════════════════════════
    
    // V3 LIQUID AUTHORITY: _v3Ignite is the sole authority for running the DNA pipeline.
    // HuntEngine FSM lobotomized — worthiness gate removed (V2 vestigial).
    // §5.3: Legacy cooldowns ERADICATED — V(t) vapor pressure is the sole refractory
    // mechanism. After each ignition, notifyIgnition() resets V(t), which raises Q(t)
    // (squelch), making the next _v3Ignite harder to achieve. The pipeline naturally
    // self-throttles through the V(t) loop — no artificial timers needed.
    const shouldRunDNA = this._v3Ignite && !activeDictator
    if (shouldRunDNA) {
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
        // 🛡️ WAVE 2093.1: Guard Infinity — `Infinity ?? 4000` = Infinity (Infinity is NOT null).
        // Si estimatedTimeMs es Infinity, NaN, negativo o 0, fallback a 4000ms.
        predictionTimeMs: (Number.isFinite(prediction.estimatedTimeMs) && prediction.estimatedTimeMs > 0)
          ? prediction.estimatedTimeMs : 4000,
        suggestedEffects: prediction.suggestedActions?.map(a => a.effect) ?? [],

        // 🧬 WAVE 2093 COG-3: SPECTRAL CONTEXT REAL desde FFT
        // Antes: DreamSimulator hardcodeaba textura por vibe (chill=clean, techno=harsh).
        // Ahora: datos reales del análisis de audio. Dark Ambient en chill ya no es "clean".
        spectralContext: {
          texture: this.deriveTextureFromState(state),
          clarity: state.clarity,
          harshness: state.harshness,
          flatness: state.spectralFlatness,
          centroid: state.spectralCentroid,
          bands: {
            subBass: state.bass * 0.8,    // Aproximación: bass contiene sub+bass
            bass: state.bass,
            lowMid: state.mid * 0.7,      // Aproximación conservadora
            mid: state.mid,
            highMid: state.high * 0.6,    // Aproximación: high contiene highMid+treble
            treble: state.high,
            ultraAir: state.ultraAir,     // 🎯 Dato real desde TitanEngine
          }
        },
        // 🧬 M-SARFE: Inject AcousticRealityState for real DNA target derivation
        acousticReality: this.lastMemoryOutput?.acousticReality,
        // Narrative phase for BUILDING cooldown scaling + aggression filter
        narrativePhase: this.lastMemoryOutput?.narrative?.narrativePhase ?? 'building',
      }

      // 🧬 DNA Brain simula - NO decide
      try {
        dreamIntegrationData = await Promise.race([
          dreamEngineIntegrator.executeFullPipeline(pipelineContext),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Dream timeout')), 15)
          )
        ])

        // 🔮 WAVE 1168: NEURAL BRIDGE - Cache dream result for UI telemetry
        this.lastDreamIntegrationResult = dreamIntegrationData?.approved ? dreamIntegrationData : null

        // ⚡ WAVE 2093.3: DNA SIMULATION LOG — throttled by state+effect (WAVE 7522)
        // Was firing every frame (60fps). Now: 1 log/sec per unique state+effect combo.
        if (dreamIntegrationData) {
          const _dnaState = `${dreamIntegrationData.approved ? 'ok' : 'no'}_${dreamIntegrationData.effect?.effect ?? 'none'}_${dreamIntegrationData.dreamRecommendation ?? ''}`
          const _now = Date.now()
          const _last = this._dnaLogThrottle.get(_dnaState) ?? 0
          if (_now - _last >= 1000) {
            console.log(
              `[SeleneTitanConscious] 🧬 DNA: ${dreamIntegrationData.approved ? '✅' : '❌'} ${effectDisplayName(dreamIntegrationData.effect?.effectName ?? dreamIntegrationData.effect?.effect ?? 'none')} | ` +
              `ethics=${dreamIntegrationData.ethicalVerdict?.ethicalScore?.toFixed(3) ?? 'N/A'} | ` +
              `dream=${dreamIntegrationData.dreamTime}ms | ${dreamIntegrationData.dreamRecommendation?.substring(0, 50) ?? ''}`
            )
            this._dnaLogThrottle.set(_dnaState, _now)
          }
        }
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
      // 🩸 WAVE 7543: Bass energy for Universal Spectral Bass Gate (anti-autotune)
      bassEnergy: state.bass,
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
      // 🐘 WAVE 4861: Energía máxima del buffer de 30s para Absolute Energy Gate
      energyMaxHistoric: this.lastMemoryOutput?.stats.energy.max,
      // V3.4: Epicness from Liquid Cognition — sole authority for Divine routing
      v3Epicness: this._lastLiquidVerdict?.epicness ?? 0,
      // V3 TUNE: Contextual phase for DROP gating — only BUILDING can drop
      contextualPhase: this.lastMemoryOutput?.narrative?.narrativePhase ?? 'building',
      // 🩸 WAVE 7171: RMS 10s for two-path divine gate (sustained epicness check)
      rmsAverage10s: this.energyConsciousness.getRmsAverage10s(),
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
    // ArsenalRepository (WAVE 4992) — only availability check
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
          output.effectDecision.effectName = getDynamicEffectRegistry().getEntry(availableWeapon)?.name
          
          // ═══════════════════════════════════════════════════════════════
          // 🛡️ WAVE 2200.4: LOG HONESTY — DIVINE vs DROP origin
          // ═══════════════════════════════════════════════════════════════
          // ROOT CAUSE: Antes siempre imprimía "🌩️ DIVINE ARSENAL" porque
          // el campo divineArsenal lo usan TANTO generateDivineStrikeDecision()
          // como generateDropPreparationDecision(). Los drops NO son divinos.
          //
          // FIX: Inspeccionar effectDecision.reason para determinar el origen real.
          // El DecisionMaker ya marca el reason con "🌩️ DIVINE" o "🔴 DROP".
          // ═══════════════════════════════════════════════════════════════
          const reasonStr = output.effectDecision.reason ?? ''
          const isDivineOrigin = reasonStr.includes('🌩️ DIVINE')
          const originEmoji = isDivineOrigin ? '🌩️' : '🔴'
          const originLabel = isDivineOrigin ? 'DIVINE ARSENAL' : 'DROP ARSENAL'
          console.log(
            `[SeleneTitanConscious ${originEmoji}] ${originLabel}: Selected ${effectDisplayName(availableWeapon)} from [${divineArsenal.map(effectDisplayName).join(', ')}]`
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
      
      // ═══════════════════════════════════════════════════════════════════════════
      // ═══════════════════════════════════════════════════════════════════════════
      // §5.3: LEGACY COOLDOWNS ERADICATED — V(t) vapor pressure is the sole refractory
      // mechanism. The 8 independent timers (global, pipeline, DNA override, bypass V3,
      // post-drop, drop chain, just-fired, Latina-specific) have been purged.
      //
      // The gate now relies on:
      //   1. HARD_COOLDOWN (ArsenalRepository) — photosensitive epilepsy compliance
      //   2. V(t) vapor pressure — emergent refractory: after each ignition,
      //      notifyIgnition() resets V(t) and raises Q(t) squelch, making the next
      //      _v3Ignite harder to achieve. The system self-throttles organically.
      //   3. Epicness floor — acoustic pressure gate (no fire without justification)
      //   4. Oceanic protection — sacred ambient effects in chill vibes
      // ═══════════════════════════════════════════════════════════════════════════
      const isDNADecision = inputs.dreamIntegration?.approved
      const ethicsScore = inputs.dreamIntegration?.ethicalVerdict?.ethicalScore ?? 0

      // 🎭 WAVE 973.5: Ethics threshold viene del MoodController
      const currentMoodProfile = MoodController.getInstance().getCurrentProfile()
      const ethicsThreshold = currentMoodProfile.ethicsThreshold

      // 🌊 WAVE 1073.4: OCEANIC EFFECTS PROTECTION
      const isOceanicEffect = OCEANIC_EFFECTS_NO_OVERRIDE.has(intent)
      const isChillVibe = pattern.vibeId === 'chill-lounge'
      const oceanicProtection = isOceanicEffect && isChillVibe

      // 🔪 WAVE 1010: Si ya procesamos DIVINE arsenal, el efecto ya está validado
      // 🛡️ V3 TUNE: DROP-origin divineArsenal must NOT bypass — only true DIVINE strikes
      const isDivineOrigin = output.effectDecision?.reason?.includes('🌩️ DIVINE')
      const alreadyValidatedByArsenal = isDivineOrigin && divineArsenal && divineArsenal.length > 0 && output.effectDecision

      // ═══════════════════════════════════════════════════════════════════════════
      // 🔒 WAVE 1179: DICTATOR HARD MINIMUM PROTECTION — the ONLY surviving cooldown
      // HARD_COOLDOWN is the absolute law for photosensitive epilepsy compliance.
      // All other cooldowns have been eradicated in favor of V(t) vapor pressure.
      // ═══════════════════════════════════════════════════════════════════════════
      const hardMinimumCheck = this.effectSelector.checkAvailability(intent, pattern.vibeId)
      const isHardMinimumBlocked = hardMinimumCheck.reason?.includes('HARD_COOLDOWN')

      // V3 TUNE: Epicness available for gating decisions
      const v3Epic = this._lastLiquidVerdict?.epicness ?? 0
      // 🛡️ V3 TUNE: Dynamic epicness floor — scales with recent RMS energy.
      // Hardcoded 0.05 was too low for techno minimal (sustained energy ~0.45 but
      // epicness ~0.02). Dynamic floor: max(0.05, rmsAverage10s * 0.10).
      // In techno (RMS~0.45): floor becomes ~0.045 → still permissive but proportional.
      // In silence (RMS~0.05): floor stays at 0.05.
      //
      // 🩸 WAVE 7159: HARD EFFECT FLOOR — hard/divine candidates require higher
      // acoustic pressure (epicness) to fire. Ambient effects can still fire at
      // the lower floor, but aggressive effects must clear a stricter bar.
      // This separates hard from ambient via acoustic pressure, not genre strings.
      const candidateEntry = getDynamicEffectRegistry().getEntry(intent)
      const isDivineCandidate = candidateEntry?.simMeta.isDivineCandidate ?? false
      const isHardForBypass = candidateEntry?.simMeta.isHeavyCandidate
        || isDivineCandidate
        || (candidateEntry?.dna.aggression ?? 0) > 0.7
      const v3EpicnessFloor = isHardForBypass
        ? Math.max(0.15, this.energyConsciousness.getRmsAverage10s() * 0.20)
        : Math.max(0.05, this.energyConsciousness.getRmsAverage10s() * 0.10)

      // ═══════════════════════════════════════════════════════════════════════
      // 🩸 WAVE 7543: UNIVERSAL SPECTRAL BASS GATE (Anti-Autotune Veto)
      // 🩸 WAVE 7553: REVERTED to simple bass <= 0.35. Purgado de zL/vocal/ratio.
      // ═══════════════════════════════════════════════════════════════════════
      const BASS_GATE_THRESHOLD = 0.35
      const hasSubstantialBass = state.bass > BASS_GATE_THRESHOLD
      const bassGateVetoed = isHardForBypass && !hasSubstantialBass

      // 🔒 WAVE 7526: DIVINE DECOUPLING — Divine effects must NEVER fire via the
      // DROP path's v3Bypass at the reduced epicness floor (0.15-0.25). They are
      // exclusively locked behind the Sovereign Clock (epicness > 0.60) or the
      // Divine Moment logic (generateDivineStrikeDecision). This defensive guard
      // ensures that even if a divine effect somehow enters the DROP arsenal
      // (e.g. via a misconfigured registry), it cannot bypass the divine gate.
      const isDropOrigin = output.effectDecision?.reason?.includes('🔴 DROP')
      const isDivineInDropPath = isDivineCandidate && isDropOrigin

      // V3 IGNITE is the sole authority. V(t) vapor pressure provides the refractory
      // period: after each fire, notifyIgnition() resets V(t), raising Q(t) squelch.
      // No artificial bypass timers needed — the fluid dynamics self-throttle.
      const v3IgniteBypass = this._v3Ignite
        && isDNADecision
        && ethicsScore >= ethicsThreshold
        && !isHardMinimumBlocked
        && !oceanicProtection
        && !alreadyValidatedByArsenal
        && !isDivineInDropPath
        && !bassGateVetoed
        && v3Epic >= v3EpicnessFloor

      // 🩸 WAVE 7543: Log bass gate veto (throttled to avoid spam)
      if (bassGateVetoed && isDNADecision && this._v3Ignite) {
        const _bassKey = `${intent}|bass-gate`
        const _bassNow = Date.now()
        const _bassLast = this._dnaLogThrottle.get(_bassKey) ?? 0
        if (_bassNow - _bassLast >= 2000) {
          const _vetoReason = `bass=${state.bass.toFixed(3)} ≤ ${BASS_GATE_THRESHOLD}`
          console.log(
            `[SeleneTitanConscious 🛡️] BASS GATE VETO: "${effectDisplayName(intent)}" ` +
            `(aggression=${(candidateEntry?.dna.aggression ?? 0).toFixed(2)}) blocked — ` +
            `${_vetoReason} (vocal/autotune false positive)`
          )
          this._dnaLogThrottle.set(_bassKey, _bassNow)
        }
      }

      // 🎯 WAVE 7158: RESOURCE MASKING — Prevent effect overlap on spatial resources
      // Interrogates actual output vectors of active effects (not static maps).
      // If the candidate will control spatial resources (pan/tilt/movement) AND
      // active effects are already controlling movement, abort the prior effects
      // for a clean handoff. This prevents jitter from two effects fighting over
      // the same pan/tilt channels.
      const candidateControlsMovement = candidateEntry
        ? candidateEntry.spatialBehavior !== 'static'
        : false
      const activeControlsMovement = getEffectManager().hasActiveMovementControl()
      if (v3IgniteBypass && candidateControlsMovement && activeControlsMovement) {
        const aborted = getEffectManager().abortEffectsControllingMovement()
        if (aborted.length > 0) {
          console.log(
            `[V3 IGNITE 🎯 RESOURCE MASKING] Aborted ${aborted.length} active effect(s) ` +
            `controlling movement: [${aborted.join(', ')}] — clean handoff for "${effectDisplayName(intent)}"`
          )
        }
      }

      // 📊 GATEKEEPER TELEMETRY — log only on state change to prevent per-frame spam
      if (isDNADecision && output.effectDecision) {
        const logKey = `${intent}|${this._v3Ignite}|${isHardMinimumBlocked}`
        if (logKey !== this._lastGatekeeperLogKey) {
          this._lastGatekeeperLogKey = logKey
          console.log(
            `[Gatekeeper 📊] ${effectDisplayName(intent)} | v3Ignite=${this._v3Ignite} epicness=${v3Epic.toFixed(3)} | ` +
            `hardBlocked=${isHardMinimumBlocked} | ` +
            `arsenalValidated=${!!alreadyValidatedByArsenal} | ` +
            `v3Bypass=${v3IgniteBypass} | ` +
            `cooldown=${hardMinimumCheck.available ? 'OK' : hardMinimumCheck.reason} | ` +
            `ethics=${ethicsScore.toFixed(2)}/${ethicsThreshold} | ` +
            `floor=${v3EpicnessFloor.toFixed(3)}${isHardForBypass ? ' (HARD)' : ''}`
          )
        }
      }

      // V3 TUNE: Ambient DNA classification — DNA-approved but NOT divine/drop origin.
      // These are the "normal" effects that overfire. They must respect V3 ignition.
      // NOTE: isDropOrigin is now computed earlier (WAVE 7526) for the divine guard.
      const isAmbientDNA = isDNADecision && !isDropOrigin && !alreadyValidatedByArsenal

      // V3 TUNE: Drop reservation window — when Cassandra predicts a drop within 3s,
      // block ambient effects to save Selene for the drop. Prevents "arriving late"
      // because Selene was busy showing an ambient effect during the buildup.
      const isDropImminent = prediction?.type === 'drop_incoming'
        && prediction.estimatedTimeMs < 3000
        && prediction.probability > 0.60

      // §5.3: Availability cascade — HARD_COOLDOWN is the only timer. V(t) handles
      // refractory organically. Epicness floor provides acoustic justification gate.
      const availability = isHardMinimumBlocked
        ? hardMinimumCheck  // 🔒 HARD_COOLDOWN is LEY ABSOLUTA (epilepsy compliance)
        : bassGateVetoed
        ? { available: false, reason: `Bass Gate veto (bass=${state.bass.toFixed(3)} ≤ ${BASS_GATE_THRESHOLD}: vocal/autotune false positive)` }
        : alreadyValidatedByArsenal
        ? { available: true, reason: 'DIVINE arsenal pre-validated' }
        : v3IgniteBypass
        ? { available: true, reason: `V3 IGNITE (ethics=${ethicsScore.toFixed(2)}, V(t) refractory active)` }
        : isAmbientDNA && v3Epic < 0.10
        ? { available: false, reason: `Epicness too low for ambient DNA (${v3Epic.toFixed(3)} < 0.10)` }
        : isAmbientDNA && isDropImminent
        ? { available: false, reason: 'Drop reservation — saving Selene for imminent drop' }
        : isHardForBypass && v3Epic < v3EpicnessFloor
        ? { available: false, reason: `Epicness floor for hard/strobe effect (${v3Epic.toFixed(3)} < ${v3EpicnessFloor.toFixed(3)})` }
        : hardMinimumCheck

      if (availability.available && output.effectDecision) {
        finalEffectDecision = output.effectDecision

        // 🌊 V(t) REFRACTORY: Notify the liquid core that an ignition was materialized.
        // This resets vapor pressure and updates refractoriness — the emergent
        // cooldown that replaces all 8 legacy timers. No timestamp tracking needed.
        if (this._lastLiquidVerdict) {
          this._liquidCore.notifyIgnition(output.effectDecision.intensity ?? 0.5, Date.now())
        }

        if (v3IgniteBypass) {
          console.log(
            `[SeleneTitanConscious 🌊] V3 IGNITE: ${effectDisplayName(intent)} | ` +
            `ethics=${ethicsScore.toFixed(2)} | V(t) refractory activated | ` +
            `epicness=${v3Epic.toFixed(3)} ≥ floor=${v3EpicnessFloor.toFixed(3)}`
          )
        } else {
          console.log(
            `[SeleneTitanConscious] 🧠 DECISION MAKER APPROVED: ${effectDisplayName(output.effectDecision.effectName ?? intent)} | ` +
            `confidence=${output.effectDecision.confidence?.toFixed(2)} | ${output.effectDecision.reason}`
          )
        }
      } else if (output.effectDecision) {
        // ═══════════════════════════════════════════════════════════════════════
        // 🩸 WAVE 2111: FALLTHROUGH ABOLISHED — "The true intelligence is knowing when NOT to fire"
        // ═══════════════════════════════════════════════════════════════════════
        // HISTORY: Fallthrough was born in WAVE 2100 to avoid silence when cooldown blocked.
        //   It spawned: section gates (2103), energy gates (2103), breakdown removal (2106),
        //   exhaustion cache (2104.2), double-fire fix (2110) — 11 WAVEs of patches on a bad idea.
        //
        // PHILOSOPHY: If the DNA chose acid_sweep and it's in cooldown, SILENCE is correct.
        //   The DNA evaluated the musical context and picked THE RIGHT effect. A random substitute
        //   doesn't carry that contextual weight. Better to wait for the next real opportunity
        //   than to fire core_meltdown at I=0.30 because "something must happen."
        //   For controlled chaos, that's what PUNK mode is for.
        // ═══════════════════════════════════════════════════════════════════════

        // 🩸 WAVE 2102: Throttled gatekeeper log — one message per blocked effect per 3s
        const gatekeeperKey = `denied_${intent}`
        const nowTime = Date.now()
        if (!this.lastGatekeeperLogs) this.lastGatekeeperLogs = {}
        if (nowTime - (this.lastGatekeeperLogs[gatekeeperKey] ?? 0) > 3000) {
          console.log(
            `[SeleneTitanConscious] 🚪 GATEKEEPER BLOCKED: ${effectDisplayName(intent)} | ${availability.reason}`
          )
          this.lastGatekeeperLogs[gatekeeperKey] = nowTime
        }

        // Blocked = silence. No plan B. No panic substitution.
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
      this.minEnergySinceLastEffect = 1.0  // 🩸 WAVE 6040: Reset valley tracker
      this.lastEffectType = finalEffectDecision.effectType

      // 🔧 DIAG: Log detallado en cada disparo para ver por qué se dispara
      const _v = this._lastLiquidVerdict
      const _zL = this.lastMemoryOutput?.acousticReality?.zScores.low ?? 0
      console.log(
        `[FIRE-DIAG] ${effectDisplayName(finalEffectDecision.effectName ?? finalEffectDecision.effectType)} | ` +
        `reason=${finalEffectDecision.reason ?? 'none'} | ` +
        `E=${state.rawEnergy.toFixed(3)} Z=${zScore.toFixed(2)}σ | ` +
        `bass=${state.bass.toFixed(3)} mid=${state.mid.toFixed(3)} high=${state.high.toFixed(3)} zL=${_zL.toFixed(2)}σ | ` +
        `epicness=${(_v?.epicness ?? 0).toFixed(3)} v3Ignite=${this._v3Ignite} | ` +
        `I(t)=${(_v?.fluid.impact ?? 0).toFixed(3)} T=${(_v?.fluid.tension ?? 0).toFixed(3)} | ` +
        `phase=${this.lastMemoryOutput?.narrative?.narrativePhase ?? '?'} | ` +
        `huntW=${huntDecision.worthiness.toFixed(3)} huntC=${huntDecision.confidence.toFixed(3)} | ` +
        `pred=${prediction.type} predProb=${prediction.probability.toFixed(2)} predETA=${prediction.estimatedTimeMs}ms | ` +
        `dna=${!!dreamIntegrationData?.approved} ethics=${dreamIntegrationData?.ethicalVerdict?.ethicalScore?.toFixed(3) ?? 'N/A'} | ` +
        `intensity=${finalEffectDecision.intensity?.toFixed(2) ?? 'N/A'}`
      )
      
      // ⚡ WAVE 2093.2: Invalidar Dream cache para forzar diversidad
      // Sin esto, el cache devuelve el mismo efecto 3s seguidos → monotonía
      dreamEngineIntegrator.invalidateDreamCache()
      
      // 🔒 WAVE 1177: REMOVED - History push moved to effectTriggered listener
      // This prevents blocked effects from contaminating history
      // (See constructor: effectManager.on('effectTriggered', ...))
      
      output = { ...output, effectDecision: finalEffectDecision }
      
      this.emit('contextualEffectSelected', {
        effectType: finalEffectDecision.effectType,
        effectName: finalEffectDecision.effectName,
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
      
      // 🩸 WAVE 2105: THROTTLE constitution violation logs — was ~65 lines per 700-line log
      // The Constitution forces analogous on every tick, logging the same message endlessly.
      // Now: log once per violation TYPE per 5 seconds, not every 16ms tick.
      if (this.config.debug) {
        const now = Date.now()
        for (const v of result.violations) {
          const lastLog = this._constitutionLogThrottle?.[v.description] ?? 0
          if (now - lastLog > 5000) {
            console.log(`[SeleneTitanConscious] 📜 Violation avoided: ${v.description}`)
            if (!this._constitutionLogThrottle) this._constitutionLogThrottle = {}
            this._constitutionLogThrottle[v.description] = now
          }
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

    // 🌊 WAVE 7004.5: Reset Liquid Cognition V3
    // §5.3: Legacy cooldown timestamps eradicated — V(t) vapor pressure reset
    // via _liquidCore.reset() is the sole refractory mechanism.
    this._liquidCore.reset()
    this._lastLiquidVerdict = null
    this._liquidRecorder.reset()
    this._v3Ignite = false

    // Resetear cognición (PHASE 3)
    resetHuntEngine()
    resetPredictionEngine()
    
    // 🚫 WAVE 1169: ScenarioSimulator DEPRECATED for V1.0
    // resetDreamEngine()
    resetBiasDetector()
    
    // 🧠 WAVE 666: Resetear memoria contextual
    this.contextualMemory.reset()
    this.lastMemoryOutput = null
    
    this.dropBridge.reset()
    this.lastDropBridgeResult = null
    
    if (this.config.debug) {
      console.log('[SeleneTitanConscious] 🔄 Reset complete (PHASES 2-4 + Memory + Fuzzy)')
    }
  }

  /**
   * 🌊 WAVE 7004.2: Dump Liquid Telemetry ring buffer to JSONL.
   * Called by TitanEngine.dumpLiquidTelemetry() → IPC → frontend DUMP button.
   * @returns Absolute path to the written .jsonl file, or null if no data.
   */
  public async dumpLiquidTelemetry(): Promise<string | null> {
    return this._liquidRecorder.dumpToFile()
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
  private normalizeSectionType(sectionType: string): 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'textural_drop' | 'breakdown' | 'outro' {
    // Normalizar 'build' → 'buildup'
    if (sectionType === 'build') return 'buildup'
    
    // Validar que sea un tipo conocido
    const validTypes = ['intro', 'verse', 'chorus', 'bridge', 'buildup', 'drop', 'textural_drop', 'breakdown', 'outro']
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
