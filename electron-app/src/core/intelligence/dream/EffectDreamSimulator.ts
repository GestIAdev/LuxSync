/**
 * 🔮 EFFECT DREAM SIMULATOR
 * "El Oráculo que ve el futuro de los efectos"
 * 
 * WAVE 900.1 - Phase 1: Foundation
 * WAVE 920.2 - Mood integration (pre-filtering blocked effects)
 * WAVE 970 - 🧬 CONTEXTUAL DNA: Relevancia contextual reemplaza belleza hardcodeada
 * 
 * @module EffectDreamSimulator
 * @description Sistema de simulación predictiva para efectos visuales.
 *              Simula múltiples escenarios de efectos y rankea por RELEVANCIA CONTEXTUAL,
 *              riesgo, coherencia de vibe y diversidad.
 * 
 * RESPONSABILIDADES:
 * - Simular escenarios de efectos (no solo color como ScenarioSimulator)
 * - 🧬 WAVE 970: Predecir RELEVANCIA (no belleza) usando DNA matching
 * - Calcular risk level (GPU load, audience fatiga, cooldowns)
 * - Detectar conflictos de cooldown
 * - Mirar 4 compases adelante (musical prediction)
 * - Rankear escenarios por ADECUACIÓN CONTEXTUAL
 * - 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
 * 
 * FILOSOFÍA:
 * "Soñar antes de actuar. Ver el futuro antes de decidir."
 * 
 * 🧬 WAVE 970 PHILOSOPHY:
 * "Selene no busca belleza. Selene busca VERDAD."
 * Un efecto no es "bonito" o "feo" - es ADECUADO o INADECUADO para el contexto.
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-21
 */

import type { AudienceSafetyContext } from './AudienceSafetyContext'

// 🎭 WAVE 920.2: MOOD INTEGRATION
import { MoodController } from '../../mood/MoodController'

// 🧬 WAVE 970: CONTEXTUAL DNA SYSTEM
// 🎨 WAVE 1029: THE DREAMER - Texture Affinity Integration
import { 
  getDNAAnalyzer,
  type TargetDNA,
  type AudioMetricsForDNA,
  type MusicalContextForDNA
} from '../dna/EffectDNA'

// ⚡ WAVE 4824: DYNAMIC EFFECT REGISTRY — fuente única de verdad del arsenal
import { getDynamicEffectRegistry, effectDisplayName } from '../../arsenal/DynamicEffectRegistry'
// 🩸 WAVE 7548: VIBE ALIAS NORMALIZATION — mutantes pueden tener compatibleVibes
// con alias legacy ('latin' en vez de 'fiesta-latina'). El _appendToIndices del
// registry normaliza al insertar al bucket, pero los checks de coherencia
// (calculateVibeCoherence, pre-buffer, conscience engine) comparaban sin
// normalizar → HERESY false positive → VIB=0.400 → DEFERRED.
import { VIBE_ALIAS_MAP } from '../../../engine/vibe/profiles/index'

/**
 * 🩸 WAVE 7548: Checks if any of the effect's compatibleVibes matches the
 * current vibe, normalizing legacy aliases via VIBE_ALIAS_MAP.
 * Example: compatibleVibes=['latin'], currentVibe='fiesta-latina' → true
 */
function vibeMatches(compatibleVibes: readonly string[], currentVibe: string): boolean {
  for (const rawVibe of compatibleVibes) {
    const canonical = (VIBE_ALIAS_MAP as Record<string, string>)[rawVibe] ?? rawVibe
    if (canonical === currentVibe) return true
  }
  return false
}

// ⚡ WAVE 4846: SPATIAL COGNITION — Hardware Guard
import { getTitanOrchestrator } from '../../orchestrator/TitanOrchestrator'
import { normalizeZone } from '../../stage/ShowFileV2'

// SelenePalette type (minimal definition for Phase 1)
interface SelenePalette {
  primary: number
  secondary: number
  accent: number
  [key: string]: number
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface EffectCandidate {
  effect: string                    // 'industrial_strobe', 'acid_sweep', etc.
  effectName?: string               // Human-readable clip.name from .lfx (e.g., 'Acid Sweep Through Mars')
  intensity: number                 // 0-1
  zones: string[]                   // ['all'], ['movers'], etc.
  reasoning: string                 // Why this effect?
  confidence: number                // 0-1, from DecisionMaker
  projectedBeauty?: number          // From DreamEngine (si disponible)
  riskLevel?: number                // From DreamEngine (si disponible)
}

export interface SystemState {
  // 🎨 VISUAL STATE
  currentPalette: SelenePalette
  currentBeauty: number             // 0-1
  
  // ⚡ EFFECT STATE
  lastEffect: string | null
  lastEffectTime: number            // ms
  activeCooldowns: Map<string, number>
  
  // 📊 METRICS
  energy: number                    // 0-1, energía musical
  tempo: number                     // BPM
  vibe: string
}

export interface MusicalPrediction {
  // 🎵 PREDICTION (+4 bars)
  predictedEnergy: number           // Energía esperada
  predictedSection: string          // 'drop', 'buildup', 'breakdown', etc.
  predictedTempo: number            // BPM esperado
  
  // 🎯 CONFIDENCE
  confidence: number                // 0-1, confianza en predicción
  
  // 📊 ANALYSIS
  isDropComing: boolean             // ¿Viene un drop en 4 bars?
  isBreakdownComing: boolean        // ¿Viene un breakdown?
  energyTrend: 'rising' | 'stable' | 'falling'
  
  // 🧠 WAVE 1173: NEURAL LINK - Oracle → Dreamer
  /** Tipo de predicción cruda del Oráculo (para boost/penalty en scoring) */
  predictionType?: 'energy_spike' | 'buildup_starting' | 'breakdown_imminent' | 'drop_incoming' | 'energy_drop' | 'none'
  
  // 🔮 WAVE 1190: PROYECTO CASSANDRA - Anticipación inteligente
  /** Tiempo estimado hasta el evento predicho (ms) */
  timeToEventMs?: number
  /** ¿Es urgente? (<2s y alta probabilidad) */
  isUrgent?: boolean
  /** Probabilidad real del Oráculo (0-1) */
  oracleProbability?: number
  /** Efectos sugeridos por el Oráculo */
  suggestedEffects?: string[]
  /** Razonamiento del Oráculo para debug/learning */
  oracleReasoning?: string | null
}

export interface EffectScenario {
  // 🎯 EFFECT
  effect: EffectCandidate
  
  // 📊 PROJECTED METRICS
  // 🧬 WAVE 970: projectedBeauty DEPRECADO - ahora es projectedRelevance
  projectedBeauty: number           // 0-1, LEGACY (alias de projectedRelevance)
  projectedRelevance: number        // 🧬 0-1, relevancia contextual DNA
  beautyDelta: number               // Cambio vs estado actual (legacy)
  riskLevel: number                 // 0-1, riesgo del efecto
  
  // 🧬 WAVE 970: DNA METRICS
  dnaDistance: number               // Distancia euclidiana al Target DNA
  targetDNA?: TargetDNA             // Target DNA usado para calcular
  
  // 🔮 PREDICTION
  projectedConsonance: number       // Coherencia con estado anterior
  gpuLoadImpact: number             // Impacto en GPU (0-1)
  audienceFatigueImpact: number     // Impacto en fatiga (0-1)
  
  // ⚠️ CONFLICTS
  cooldownConflicts: string[]       // Efectos en cooldown que bloquean
  hardwareConflicts: string[]       // Conflictos de hardware
  
  // 🎭 CONTEXT
  vibeCoherence: number             // 0-1, qué tan coherente con vibe
  diversityScore: number            // 0-1, qué tan diverso vs recent
  
  // 🔬 CONFIDENCE
  simulationConfidence: number      // 0-1, confianza en simulación

  // 🧬 GENESIS: Organism identity for nurture bias
  trialsCount?: number              // Number of live fires (undefined = consolidated blueprint)
  isMutant?: boolean                // true if this candidate is an evolved organism

  // 🎨 WAVE 7168: Texture affinity contextual bonus (-0.03 to +0.08)
  textureBonus?: number             // Bonus/malus from texture affinity vs acoustic environment
}

export interface EffectDreamResult {
  scenarios: EffectScenario[]       // Todos los escenarios simulados
  bestScenario: EffectScenario | null // El mejor encontrado
  recommendation: 'execute' | 'modify' | 'abort' // Qué hacer
  reason: string                    // Por qué
  warnings: string[]                // Advertencias detectadas
  simulationTimeMs: number          // Tiempo de cómputo
}


// ═══════════════════════════════════════════════════════════════
// EFFECT DREAM SIMULATOR
// ═══════════════════════════════════════════════════════════════

/**
 * 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Cache
 * Guarda efectos pre-calculados para eventos predichos con alta confianza
 */
interface PreBufferedEffect {
  /** Efecto pre-calculado */
  effect: EffectCandidate
  /** Score del escenario */
  score: number
  /** Timestamp de cuando fue bufferizado */
  bufferedAt: number
  /** Timestamp predicho para el evento */
  predictedEventAt: number
  /** Tipo de predicción que lo generó */
  predictionType: string
  /** Probabilidad del Oráculo al momento de bufferizar */
  oracleProbability: number
}

export class EffectDreamSimulator {
  private simulationCount: number = 0
  private _lastFilterAuditTs: number = 0
  
  // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer system
  private preBuffer: PreBufferedEffect | null = null
  private readonly PRE_BUFFER_MIN_PROBABILITY = 0.65  // Solo buffer si Oráculo > 65% seguro
  private readonly PRE_BUFFER_MIN_TIME_MS = 2000      // Solo buffer si > 2s hasta evento
  private readonly PRE_BUFFER_MAX_AGE_MS = 5000       // Expira después de 5s
  
  constructor() {
    // WAVE 2098: Boot silence
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Simula múltiples escenarios de efectos y rankea por belleza
   */
  public async dreamEffects(
    currentState: SystemState,
    musicalPrediction: MusicalPrediction,
    context: AudienceSafetyContext
  ): Promise<EffectDreamResult> {
    const startTime = Date.now()
    this.simulationCount++
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Check
    // Si tenemos un efecto pre-bufferizado y el evento está cerca, USARLO
    // ═══════════════════════════════════════════════════════════════
    
    const now = Date.now()
    // 🛡️ WAVE 2093.1: Guard Infinity — `Infinity ?? 4000` returns Infinity (not null).
    const timeToEvent = (Number.isFinite(musicalPrediction.timeToEventMs) && musicalPrediction.timeToEventMs! > 0)
      ? musicalPrediction.timeToEventMs! : 4000
    const oracleProbability = musicalPrediction.oracleProbability ?? 0
    const isUrgent = musicalPrediction.isUrgent ?? false
    
    // Verificar si el pre-buffer es válido y relevante
    if (this.preBuffer) {
      const bufferAge = now - this.preBuffer.bufferedAt
      const isExpired = bufferAge > this.PRE_BUFFER_MAX_AGE_MS
      
      // ⏳ WAVE 5009 FIX 3: El reloj real de Cassandra
      // predictionTimeMs es estático (siempre 2000 o 4000). Debemos usar el reloj interno
      // del pre-buffer (predictedEventAt) para saber si de verdad el evento es inminente.
      const realTimeToEvent = this.preBuffer.predictedEventAt - now
      const isEventImminent = realTimeToEvent < 1500 // < 1.5s = ya casi llega
      
      if (isExpired) {
        // Buffer expirado, limpiar
        this.preBuffer = null
      } else if (isEventImminent) {
        // 🚀 CASSANDRA FAST PATH: Usar el efecto pre-bufferizado!
        console.log(`[DREAM_SIMULATOR] 🔮⚡ CASSANDRA FAST PATH: Using pre-buffered "${this.preBuffer.effect.effect}" (buffered ${bufferAge}ms ago, event in ${realTimeToEvent}ms)`)
        
        // Crear escenario desde el buffer
        const bufferedScenario = this.simulateScenario(this.preBuffer.effect, currentState, context)
        
        // Limpiar buffer (usado)
        const usedBuffer = this.preBuffer
        this.preBuffer = null
        
        const simulationTimeMs = Date.now() - startTime
        
        return {
          scenarios: [bufferedScenario],
          bestScenario: bufferedScenario,
          recommendation: 'execute',
          reason: `🔮 CASSANDRA FAST PATH: "${usedBuffer.effect.effect}" ready for ${usedBuffer.predictionType} (${(usedBuffer.oracleProbability * 100).toFixed(0)}% confidence)`,
          warnings: [],
          simulationTimeMs
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // NORMAL PATH: Generar y evaluar candidatos
    // ═══════════════════════════════════════════════════════════════
    
    // 1. Generar candidatos basados en vibe y prediction
    const candidates = this.generateCandidates(currentState, musicalPrediction, context)
    
    // 2. Simular cada escenario
    const scenarios: EffectScenario[] = []
    for (const candidate of candidates) {
      const scenario = this.simulateScenario(candidate, currentState, context)
      scenarios.push(scenario)
    }
    
    // 3. Rankear escenarios
    const rankedScenarios = this.rankScenarios(scenarios, musicalPrediction)
    
    // ═══════════════════════════════════════════════════════════════
    // 🧬 QUARANTINE: Minions (status='alive') stay in rankedScenarios for
    // fitness scoring ONLY. The bestScenario for execution AND pre-buffering
    // must come from liveCandidates (non-alive). This prevents minions from
    // winning the ranking and flowing through the normal pipeline.
    // ═══════════════════════════════════════════════════════════════
    
    const registry = getDynamicEffectRegistry()
    const liveCandidates = rankedScenarios.filter(s => {
      const entry = registry.getEntry(s.effect.effect)
      return entry?.organismStatus !== 'alive'
    })
    
    // 4. Seleccionar mejor escenario — from live candidates only
    const bestScenario = liveCandidates[0] || null
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Storage
    // Si alta confianza y tiempo suficiente, guardar el mejor para después
    // 🧬 QUARANTINE: Minions (status='alive') are EXCLUDED from pre-buffering.
    //   They remain in rankedScenarios for fitness scoring ONLY.
    //   Only champion/canonized organisms can be pre-buffered for live fire.
    // ═══════════════════════════════════════════════════════════════

    // 🔬 WAVE 7541: VIBE-AWARE PRE-BUFFER (Climax Blackout Prevention, Fix A).
    // The old code pre-buffered bestScenario unconditionally. If the #1 ranked
    // candidate was a vibe HERETIC (high DNA score but incompatible
    // compatibleVibes), Cassandra sealed it for 3s. When the FAST PATH
    // released it, the Conscience Engine rejected it for HERESY (penalty=1.0,
    // score=0.000) with no fallback → total blackout during the drop.
    //
    // FIX: Iterate liveCandidates and pick the first one whose
    // compatibleVibes includes the current vibe. This guarantees that
    // whatever Cassandra seals will pass the Conscience Engine's
    // vibe_coherence/vibe_effect_match rule.
    const currentVibe = context.vibe
    const preBufferScenario = liveCandidates.find(s => {
      const entry = registry.getEntry(s.effect.effect)
      if (!entry) return false
      // No vibe restriction = universally compatible
      if (entry.compatibleVibes.length === 0) return true
      // 🩸 WAVE 7548: Normalize aliases — mutantes pueden tener 'latin' en vez de 'fiesta-latina'
      return vibeMatches(entry.compatibleVibes, currentVibe)
    }) ?? null

    if (preBufferScenario && preBufferScenario !== bestScenario) {
      console.log(
        `[DREAM_SIMULATOR] 🔮🛡️ VIBE-AWARE PRE-BUFFER: #1 "${effectDisplayName(bestScenario?.effect.effectName ?? bestScenario?.effect.effect ?? '?')}" was vibe-incompatible, ` +
        `selected "${effectDisplayName(preBufferScenario.effect.effectName ?? preBufferScenario.effect.effect)}" instead (vibe=${currentVibe})`
      )
    }

    if (preBufferScenario &&
        oracleProbability >= this.PRE_BUFFER_MIN_PROBABILITY &&
        timeToEvent >= this.PRE_BUFFER_MIN_TIME_MS &&
        !this.preBuffer) {  // Solo si no hay buffer ya

      const predictionType = musicalPrediction.predictionType ?? 'none'

      if (predictionType !== 'none') {
        this.preBuffer = {
          effect: preBufferScenario.effect,
          score: preBufferScenario.projectedRelevance,
          bufferedAt: now,
          predictedEventAt: now + timeToEvent,
          predictionType,
          oracleProbability,
        }

        console.log(`[DREAM_SIMULATOR] 🔮📦 CASSANDRA PRE-BUFFER: "${preBufferScenario.effect.effectName ?? preBufferScenario.effect.effect}" stored for ${predictionType} in ~${(timeToEvent / 1000).toFixed(1)}s (${(oracleProbability * 100).toFixed(0)}% confidence)`)
      }
    }
    
    // 5. Generar recomendación
    const recommendation = this.generateRecommendation(bestScenario, context)
    
    // 6. Detectar warnings
    const warnings = this.detectWarnings(rankedScenarios, context)
    
    const simulationTimeMs = Date.now() - startTime
    
    // 🧹 WAVE 1015: Solo logear si slow (>5ms) o si hay problema
    if (simulationTimeMs > 5 && bestScenario) {
      console.log(`[DREAM_SIMULATOR] 🎯 ${bestScenario.effect.effectName ?? bestScenario.effect.effect} (${simulationTimeMs}ms)`)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 2200.1: CASSANDRA TEMPORAL SEAL
    // ═══════════════════════════════════════════════════════════════
    // ROOT CAUSE: Cuando Cassandra almacena un pre-buffer (timeToEvent >= 2000ms),
    // generateRecommendation() TAMBIÉN devuelve 'execute' si projectedRelevance >= 0.30.
    // El Integrator ve 'execute' → aprueba → DecisionMaker dispara inmediatamente.
    // El pre-buffer se vuelve redundante porque el efecto ya se disparó.
    //
    // FIX: Si ESTE frame acaba de almacenar un pre-buffer, la recomendación se
    // degrada a 'modify' (= "tengo algo pero NO es hora"). El efecto queda
    // sellado en el buffer hasta que el FAST PATH lo libere cuando:
    //   - timeToEvent < 1500ms (urgencia real)
    //   - O la sección predicha se confirme
    //
    // EVIDENCE: buildupextrema.md frame ~7780:
    //   CASSANDRA stores core_meltdown for drop in ~3.9s
    //   → INTEGRATOR ✅ APPROVED (because recommendation was 'execute')
    //   → core_meltdown fires at Z=0.5σ during buildup. PREMATURO.
    // ═══════════════════════════════════════════════════════════════
    const justBuffered = this.preBuffer && this.preBuffer.bufferedAt === now
    if (justBuffered && recommendation.action === 'execute') {
      const deferredReason = `🔮 CASSANDRA DEFERRED: "${bestScenario!.effect.effect}" sealed for ${this.preBuffer!.predictionType} in ~${(timeToEvent / 1000).toFixed(1)}s — awaiting section confirmation`
      console.log(`[DREAM_SIMULATOR] 🔮🛡️ TEMPORAL SEAL: ${effectDisplayName(bestScenario!.effect.effect)} → 'modify' (pre-buffer active, timeToEvent=${timeToEvent}ms)`)
      return {
        scenarios: rankedScenarios,
        bestScenario,
        recommendation: 'modify',
        reason: deferredReason,
        warnings,
        simulationTimeMs,
      }
    }
    
    return {
      scenarios: rankedScenarios,
      bestScenario,
      recommendation: recommendation.action,
      reason: recommendation.reason,
      warnings,
      simulationTimeMs
    }
  }
  
  /**
   * Simula UN escenario específico (para evaluación rápida)
   */
  public simulateScenario(
    effect: EffectCandidate,
    currentState: SystemState,
    context: AudienceSafetyContext
  ): EffectScenario {
    // Proyectar belleza
    const projectedBeauty = this.projectBeauty(effect, currentState, context)
    const beautyDelta = projectedBeauty - currentState.currentBeauty
    
    // Calcular riesgo
    const riskLevel = this.calculateRisk(effect, currentState, context)
    
    // Proyectar consonancia (coherencia con estado anterior)
    const projectedConsonance = this.projectConsonance(effect, currentState)
    
    // Impacto en GPU
    const gpuLoadImpact = this.calculateGpuImpact(effect, context)
    
    // Impacto en fatiga de audiencia
    const audienceFatigueImpact = this.calculateFatigueImpact(effect, context)
    
    // Detectar conflictos
    const cooldownConflicts = this.detectCooldownConflicts(effect, currentState)
    const hardwareConflicts = this.detectHardwareConflicts(effect, context)
    
    // Coherencia con vibe
    const vibeCoherence = this.calculateVibeCoherence(effect, context)
    
    // Score de diversidad
    const diversityScore = this.calculateDiversityScore(effect, context)
    
    // Confianza en simulación
    const simulationConfidence = this.calculateSimulationConfidence(
      effect,
      currentState,
      context
    )
    
    // 🧬 WAVE 970: DNA-based contextual relevance
    const { relevance: projectedRelevance, distance: dnaDistance, targetDNA } = 
      this.calculateDNARelevance(effect, currentState, context)
    
    // 🧬 GENESIS: Extract organism identity from Registry for nurture bias
    const registry = getDynamicEffectRegistry()
    const registryEntry = registry.getEntry(effect.effect)
    const trialsCount = registryEntry?.trialsCount
    const isMutant = !!registryEntry?.organismId

    // 🎨 WAVE 7168: Texture affinity contextual bonus
    const textureBonus = this.calculateTextureBonus(effect.effect, context)
    
    return {
      effect,
      projectedBeauty,
      projectedRelevance,       // 🧬 WAVE 970: DNA relevance (replaces beauty as primary)
      beautyDelta,
      riskLevel,
      dnaDistance,              // 🧬 WAVE 970: Euclidean distance to target DNA
      targetDNA,                // 🧬 WAVE 970: For debugging/logging
      projectedConsonance,
      gpuLoadImpact,
      audienceFatigueImpact,
      cooldownConflicts,
      hardwareConflicts,
      vibeCoherence,
      diversityScore,
      simulationConfidence,
      trialsCount,              // 🧬 GENESIS: for nurture bias
      isMutant,                 // 🧬 GENESIS: mutant flag
      textureBonus,             // 🎨 WAVE 7168: texture affinity bonus
    }
  }
  
  /**
   * Explora efectos alternativos (similar a hue shifts pero para efectos)
   */
  public exploreAlternatives(
    primaryEffect: EffectCandidate,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    // ⚡ WAVE 4824: Registry exclusivo — EFFECT_CATEGORIES exterminado
    const registry = getDynamicEffectRegistry()
    const primaryEntry = registry.getEntry(primaryEffect.effect)
    if (!primaryEntry) return []

    const vibe = primaryEntry.compatibleVibes[0] ?? ''
    return registry.getEffectsForVibe(vibe)
      .filter(e => e.id !== primaryEffect.effect)
      .map(e => ({
        effect: e.id,
        effectName: e.name,
        intensity: primaryEffect.intensity * 0.9,
        zones: primaryEffect.zones,
        reasoning: `Alternative to ${primaryEffect.effect} (same vibe)`,
        confidence: primaryEffect.confidence * 0.8
      }))
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // 🔮 WAVE 5011: CASSANDRA'S SOVEREIGN CLOCK — Pre-buffer introspection API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Returns the current Cassandra pre-buffer status for sovereign fast path checks.
   * null = no active pre-buffer.
   */
  public getPreBufferStatus(): { effectId: string; predictedEventAt: number; bufferedAt: number } | null {
    if (!this.preBuffer) return null
    return {
      effectId: this.preBuffer.effect.effect,
      predictedEventAt: this.preBuffer.predictedEventAt,
      bufferedAt: this.preBuffer.bufferedAt,
    }
  }

  /**
   * Returns the full pre-buffered effect candidate (needed to build the sovereign output).
   * null = no active pre-buffer.
   */
  public getPreBufferedCandidate(): { effect: string; effectName?: string; intensity: number; zones: string[]; confidence: number } | null {
    if (!this.preBuffer) return null
    return {
      effect: this.preBuffer.effect.effect,
      effectName: this.preBuffer.effect.effectName,
      intensity: this.preBuffer.effect.intensity,
      zones: this.preBuffer.effect.zones ?? [],
      confidence: this.preBuffer.effect.confidence,
    }
  }

  /**
   * Clears the Cassandra pre-buffer (called after sovereign fast path consumes it).
   */
  public clearPreBuffer(): void {
    this.preBuffer = null
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: CANDIDATE GENERATION
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * 🛡️ WAVE 975: VIBE SHIELD
   * 
   * Solo efectos permitidos para el VIBE actual.
   * industrial_strobe NUNCA aparece en fiesta-latina.
   * cumbia_moon NUNCA aparece en techno-club.
   */
  private getVibeAllowedEffects(vibe: string): string[] {
    // ⚡ WAVE 4824: Registry exclusivo — EFFECTS_BY_VIBE exterminado
    const entries = getDynamicEffectRegistry().getEffectsForVibe(vibe)
    if (entries.length === 0) return []
    // 🩸 WAVE 7550: MOOD BLOCKLIST FILTER — filter out blocked effects BEFORE
    // simulation. Without this, CALM blocks strobes in generateCandidates()
    // (Integrator) but the dream simulator already only simulated that one
    // strobe → no alternatives → SILENCE. By filtering here, the simulator
    // only sees mood-allowed effects → always has valid candidates → natural
    // degradation to softer effects instead of silence.
    const mood = MoodController.getInstance()
    const filtered = entries.filter(e => !mood.isEffectBlocked(e.id))
    // Fallback: if ALL effects are blocked (unlikely), return unfiltered
    // rather than producing zero candidates.
    return (filtered.length > 0 ? filtered : entries).map(e => e.id)
  }
  
  /**
   * 🧘 WAVE 975: ZONE AWARENESS
   * 🔥 WAVE 982: ZONE FILTER RECALIBRATION - Post Peak Hold
   * 
   * Filtra efectos por zona energética usando DNA Aggression.
   * 
   * FILOSOFÍA DE DISEÑO:
   * - DigitalRain (A=0.35): Efecto AMBIENTAL, no debe aparecer en drops pesados
   * - Gatling (A=0.90): AMETRALLADORA para builds finales y peaks ultra-rápidos
   * 
   * AJUSTES POST-PEAK HOLD (WAVE 980.4):
   * - Zonas energéticas: active (0.82), intense (0.92), peak (≥0.92)
   * - Techno builds pre-drop (E=0.78-0.82) están en 'active'
   * 
   * PROBLEMA DETECTADO (WAVE 982):
   * - Gatling (A=0.90) bloqueado en 'active' (max era 0.85)
   * - Builds intensos (E=0.80) = zona 'active' pero necesitan Gatling
   * 
   * SOLUCIÓN:
   * - 'active': max 0.85 → 0.95 (GATLING entra en builds)
   * - 'intense': min 0.45 SIN CAMBIOS (DigitalRain correctamente bloqueado)
   */
  private filterByZone(effects: string[], zone: string): string[] {
    // 🎚️ WAVE 996: THE LADDER OVERRIDES - Rangos ampliados para no competir con ContextualEffectSelector
    // THE LADDER ya hace la clasificación correcta en ContextualEffectSelector.
    // Aquí solo filtramos extremos obvios (no poner strobe pesado en silence).
    // 🩸 WAVE 7170: DEAD ZONE CLOSURE — Rangos contiguos sin huecos matemáticos.
    // corazon_latino (A=0.38) caía en el hueco entre silence(0.30) y active(0.40).
    // Ahora los rangos son contiguos: cada max de zona Z coincide con el min de zona Z+1.
    const aggressionLimits: Record<string, { min: number; max: number }> = {
      'silence': { min: 0,    max: 0.35 },    // Solo efectos muy suaves
      'valley':  { min: 0,    max: 0.50 },    // Suaves + algo de respiración
      'ambient': { min: 0,    max: 0.70 },    // Moderados (ampliar para digital_rain + acid_sweep)
      'gentle':  { min: 0,    max: 0.85 },    // Transición amplia (incluir ambient_strobe, binary_glitch)
      'active':  { min: 0.35, max: 0.80 },    // 🔬 WAVE 5003+7170: min 0.40→0.35 para cerrar el hueco
      'intense': { min: 0.60, max: 1.00 },    // 🔬 WAVE 5003: Solo hard, medios a active
      'peak':    { min: 0.70, max: 1.00 },    // Solo los más brutales (gatling, core_meltdown, industrial)
    }
    
    const limits = aggressionLimits[zone] || { min: 0, max: 1 }
    
    const registry = getDynamicEffectRegistry()
    const filtered = effects.filter(effect => {
      const entry = registry.getEntry(effect)
      if (!entry) {
        console.warn(`[DREAM_SIMULATOR] ⚠️ No Registry entry for effect: ${effect}`)
        return false
      }
      return entry.dna.aggression >= limits.min && entry.dna.aggression <= limits.max
    })
    
    // 🩸 WAVE 7170: ANTI-MONOPOLY FALLBACK — Dispara si el pool es < 4, no solo si es 0.
    // Evita la competencia binaria constante (2 candidatos) que permite que un solo
    // efecto domine el ranking ciclo tras ciclo.
    // 🔒 WAVE 7180: ZONE-ADJACENT EXPANSION — Solo traer efectos de zonas ±1 nivel.
    // Antes se añadían TODOS los efectos restantes, lo que metía efectos ambientales
    // (Amazon Mist, Ghost Breath) en pools de alta energía y viceversa.
    if (filtered.length < 4) {
      const ZONE_ORDER = ['silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak']
      const zoneIdx = ZONE_ORDER.indexOf(zone)
      const adjacentZones = new Set<string>()
      if (zoneIdx > 0) adjacentZones.add(ZONE_ORDER[zoneIdx - 1])
      if (zoneIdx < ZONE_ORDER.length - 1) adjacentZones.add(ZONE_ORDER[zoneIdx + 1])

      const existing = new Set(filtered)
      const extras = effects
        .filter(e => {
          if (existing.has(e)) return false
          const entry = registry.getEntry(e)
          if (!entry) return false
          // Solo incluir si la aggression del efecto cae en una zona adyacente
          const effZone = ZONE_ORDER.find(z => {
            const l = aggressionLimits[z]
            return entry.dna.aggression >= l.min && entry.dna.aggression <= l.max
          })
          return effZone ? adjacentZones.has(effZone) : false
        })
        .sort((a, b) => (registry.getEntry(a)?.dna.aggression ?? 0) - (registry.getEntry(b)?.dna.aggression ?? 0))
      const merged = [...filtered, ...extras]
      console.log(
        `[DREAM_SIMULATOR] 🧘 Zone ${zone} pool too small (${filtered.length} < 4), ` +
        `expanded to ${merged.length} by adding ${extras.length} adjacent-zone effects (adjacent: ${[...adjacentZones].join(', ')})`
      )
      return merged
    }

    return filtered
  }

  /**
   * 🎯 pressureRange gate — filters candidates whose acoustic pressure envelope
   * does not contain the current real-time pressure.
   *
   * A pressureRange of {0,0} is permissive (no gate).
   * If relaxGuardsForFuture is true:
   *   - For heavy/buildup events: the MIN gate is bypassed (pressure will rise).
   *   - For breakdown/valley events: the MAX gate is bypassed (pressure will fall).
   *
   * 🌊 WAVE 7556: YIN YANG — relaxGuardsForFuture ahora es BIDIRECCIONAL.
   * Antes solo perdonaba que la presión actual fuera demasiado baja (drop incoming).
   * Ahora también perdona que sea demasiado alta (breakdown incoming) para que
   * los efectos ambientales con pressureRange.max bajo puedan competir como
   * candidatos cuando viene un parón, en vez de ser filtrados por la presión
   * alta del frame actual.
   */
  private filterByPressure(
    effects: string[],
    currentPressure: number,
    relaxGuardsForFuture: boolean,
    isFutureLowEnergyEvent: boolean = false,
  ): string[] {
    const registry = getDynamicEffectRegistry()
    const filtered = effects.filter(effect => {
      const entry = registry.getEntry(effect)
      if (!entry) return false
      const pr = entry.pressureRange
      if (pr.min === 0 && pr.max === 0) return true
      if (relaxGuardsForFuture) {
        // Drop/buildup incoming: la presión subirá — perdonar MIN.
        if (currentPressure < pr.min) return true
        // 🌊 WAVE 7556: Breakdown/valley incoming: la presión bajará — perdonar MAX.
        if (isFutureLowEnergyEvent && currentPressure > pr.max) return true
      }
      return currentPressure >= pr.min && currentPressure <= pr.max
    })

    if (filtered.length === 0) {
      console.log(
        `[DREAM_SIMULATOR] 🎯 Pressure filter too strict (pressure=${currentPressure.toFixed(3)}), returning all zone-filtered effects`,
      )
      return effects
    }

    return filtered
  }

  /**
   * Helper para logging: muestra el rango de agresión de una zona
   * 🎚️ WAVE 996: Updated para THE LADDER - rangos ampliados
   */
  private getZoneAggressionRange(zone: string): string {
    const ranges: Record<string, string> = {
      'silence': '0-0.30',
      'valley': '0-0.50',
      'ambient': '0-0.70',
      'gentle': '0-0.85',
      'active': '0.40-0.80',
      'intense': '0.60-1.00',
      'peak': '0.70-1.00',
    }
    return ranges[zone] || '0-1.00'
  }
  
  /**
   * 🎲 WAVE 1178: ANTI-DETERMINISM - Hash de nombre de efecto
   * 
   * Genera un número determinista (0-99) basado en el nombre del efecto.
   * NO ES ALEATORIO - el mismo nombre siempre da el mismo hash.
   * 
   * Se usa combinado con el timestamp para crear una "rotación"
   * de qué efectos tienen boost en cada ventana de tiempo.
   * 
   * Esto rompe el determinismo sin violar el Axioma Anti-Simulación
   * (no usamos Math.random(), usamos el timestamp del mundo real).
   */
  private hashEffectName(name: string): number {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash) % 100
  }
  
  /**
   * 🧘 WAVE 975: Deriva la zona energética del valor de energía (0-1)
   * Mismo mapeo que SeleneTitanConscious usa
   */
  private deriveEnergyZone(energy: number): string {
    if (energy < 0.10) return 'silence'
    if (energy < 0.25) return 'valley'
    if (energy < 0.40) return 'ambient'
    if (energy < 0.55) return 'gentle'
    if (energy < 0.70) return 'active'
    if (energy < 0.85) return 'intense'
    return 'peak'
  }
  
  private generateCandidates(
    state: SystemState,
    prediction: MusicalPrediction,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    const candidates: EffectCandidate[] = []
    
    // 🛡️ WAVE 975: VIBE SHIELD - Solo efectos permitidos para este VIBE
    const vibeAllowedEffects = this.getVibeAllowedEffects(state.vibe)
    
    // 🛡️ WAVE 1178: ZONE PROTECTION - Obtener Z-Score para protección de valles
    const zScore = context.zScore ?? 0
    
    // 🔴 WAVE 1178: VALLEY/SILENCE PROTECTION
    // Si estamos en zone de baja energía Y la energía está BAJANDO (Z<0),
    // NO DISPARAR EFECTOS. La música está en un funeral, no molestes.
    const energyZone = context.energyZone ?? this.deriveEnergyZone(context.energy)
    
    if ((energyZone === 'valley' || energyZone === 'silence') && zScore < 0) {
      // 🧹 WAVE 1178.1: Log SILENCIADO - spam innecesario
      // console.log(`[DREAM_SIMULATOR] 🛡️ VALLEY PROTECTION: zone=${energyZone} Z=${zScore.toFixed(3)} → NO CANDIDATES`)
      return [] // No generar candidatos - la música está muriendo
    }
    
    const zoneSource = context.energyZone ? 'SeleneTitanConscious' : 'local-fallback'
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔮 WAVE 5014: THE ORACLE'S VISION — Projected Zone & Z-Guard Relaxation
    // ═══════════════════════════════════════════════════════════════════════════
    // ROOT CAUSE (WAVE 5013-ALPHA forensics):
    //   generateCandidates() evaluaba filterByZone y zScoreGuards usando la
    //   energía y Z-Score del frame ACTUAL, incluso cuando Cassandra simulaba
    //   un Drop que ocurriría en 3 segundos. Durante un buildup (zona 'active',
    //   aggression max 0.80), todos los efectos pesados (A>0.80) eran descartados
    //   ANTES de que sus Z-Guards fueran evaluados. Resultado: solo void_mist y
    //   abyssal_rise sobrevivían → arsenal nuclear invisible para Cassandra.
    //
    // FIX: Si la predicción es un evento futuro garantizado (drop_predicted,
    //   buildup_starting) con timeToEventMs > 0, usar una zona proyectada
    //   que refleje las condiciones DEL EVENTO, no del frame actual.
    //   También relajar minimumZ y minimumEnergy porque en el momento del drop
    //   la señal habrá explosionado — no tiene sentido bloquear el arsenal hoy
    //   por culpa de un Z-Score de buildup tranquilo.
    // ═══════════════════════════════════════════════════════════════════════════
    const predType = prediction.predictionType ?? 'none'
    const timeToEvent = (Number.isFinite(prediction.timeToEventMs) && prediction.timeToEventMs! > 0)
      ? prediction.timeToEventMs! : 0
    const isFutureHeavyEvent = (
      predType === 'drop_incoming' ||
      predType === 'energy_spike'
    ) && timeToEvent > 0
    const isFutureBuildup = predType === 'buildup_starting' && timeToEvent > 0
    // 🌊 WAVE 7556: YIN YANG — Predicciones de BAJA energía. El oráculo ya
    // producía breakdown_imminent/energy_drop pero el Dream Simulator los
    // ignoraba para el zone override y el pressure relaxation. Ahora los
    // escuchamos para que los efectos ambientales/transitorios compitan
    // como candidatos proactivos, no solo como reroute de rescate.
    const isFutureBreakdown = predType === 'breakdown_imminent' && timeToEvent > 0
    const isFutureValley = predType === 'energy_drop' && timeToEvent > 0
    const isFutureLowEnergyEvent = isFutureBreakdown || isFutureValley

    // Zona proyectada: la que habrá en el momento del evento, no la actual.
    // drop/energy_spike → peak; buildup → intense; cualquier otro → zona actual.
    // 🌊 WAVE 7556: YIN YANG — Override BIDIRECCIONAL. Antes solo subía
    // (peak/intense). Ahora también baja: breakdown → gentle, valley → ambient.
    // Esto permite que filterByZone incluya efectos ambientales (aggression
    // baja) como candidatos cuando viene un parón, en vez de filtrarlos.
    // §5.4: Vibe branch PURGED — groove-based interpolation replaces isLatinVibe.
    // High-groove contexts (latin reggaeton) have chronically high energy that
    // makes the predictor see "energy_spike" on every beat. The zone cap is now
    // a continuous function of groove: high groove → cap at 'active', low groove
    // → no cap. We use syncopation as the groove proxy (available in SystemState
    // indirectly via energy/tempo pattern).
    // 🔬 WAVE 7522: Solo aplicar el cap cuando la energía es moderada (< 0.85).
    //   Con energy ≥ 0.85 (pleno climax), proyectar peak/intense → active elimina
    //   16 de 18 efectos en fiesta-latina porque el pressure filter (pressure≈1.0)
    //   descarta los efectos con pressureRange.max < 1.0. Solo sobrevivían
    //   tidal_wave (max=1.0) y latin_bubbles (max=0, permissive).
    //
    // 🎨 WAVE 7547: GRADUAL GROOVE PROXY — replaces binary 0.8/0.2 with a
    // continuous cosine curve. The old binary proxy degraded peak/intense →
    // 'active' whenever tempo ∈ [90,130] AND energy ∈ [0.55,0.85], which
    // killed heavy effects (aggression > 0.80) like latin_strobe (A=0.972)
    // in almost all fiesta-latina contexts. They only escaped during true
    // climax (energy ≥ 0.85), firing ~1/150 times.
    //
    // The new gradual proxy:
    //   - tempoGroove: cosine curve, peak=1.0 at 110 BPM, zero at 90/130
    //   - energyGroove: cosine curve, peak=1.0 at 0.70, zero at 0.55/0.85
    //   - grooveProxy = tempoGroove × energyGroove ∈ [0, 1]
    //
    // Zone degradation is now two-tier:
    //   grooveProxy > 0.85 (extreme groove, center of latin range):
    //     peak/intense → 'active' (original behavior, anti-energy-spike)
    //   grooveProxy > 0.50 (moderate groove, edges of latin range):
    //     peak → 'intense' (NOT 'active' — allows heavy effects with
    //     aggression up to 1.00 to pass the zone filter)
    //   grooveProxy ≤ 0.50: no cap, zone stays as-is
    //
    // This allows latin_strobe (A=0.972) to fire during moderate-groove
    // latin contexts (tempo ~95-105 or ~120-130, energy ~0.58-0.65 or
    // ~0.75-0.82) where the zone degrades to 'intense' (max=1.00) instead
    // of 'active' (max=0.80). Only in the exact center of the latin range
    // (tempo ~110, energy ~0.70) does the cap reach 'active'.
    const tempoGroove = state.tempo >= 90 && state.tempo <= 130
      ? Math.cos((state.tempo - 110) * Math.PI / 40)  // peak at 110, zero at 90/130
      : 0
    const energyGroove = state.energy > 0.55 && state.energy < 0.85
      ? Math.cos((state.energy - 0.70) * Math.PI / 0.30)  // peak at 0.70, zero at 0.55/0.85
      : 0
    const grooveProxy = Math.max(0, Math.min(1, tempoGroove * energyGroove))
    // 🌊 WAVE 7556: YIN YANG — rawProjectedZone ahora es bidireccional.
    //   Sube: heavy→peak, buildup→intense (comportamiento original)
    //   Baja: breakdown→gentle, valley→ambient (NUEVO)
    //   Neutral: ningún evento futuro → zona actual
    const rawProjectedZone = isFutureHeavyEvent ? 'peak'
      : isFutureBuildup ? 'intense'
      : isFutureBreakdown ? 'gentle'
      : isFutureValley ? 'ambient'
      : energyZone
    // El groove cap solo aplica a overrides ASCENDENTES (peak/intense).
    // Los overrides descendentes (gentle/ambient) no se capan — el objetivo
    // es precisamente abrir el pool a efectos suaves, no limitarlos.
    const projectedZone = grooveProxy > 0.5 && (rawProjectedZone === 'peak' || rawProjectedZone === 'intense')
      ? grooveProxy > 0.85 ? 'active' : 'intense'
      : rawProjectedZone

    // Relajar guards predictivos: si el evento está garantizado, el Z y la energía
    // del frame actual son irrelevantes — subirán cuando el drop rompa.
    // Solo se relaja si la predicción es de alta confianza (> 0.55).
    // 🌊 WAVE 7556: YIN YANG — Ahora también se relaja para eventos de BAJA
    // energía. Si viene un breakdown/valley, la presión actual puede ser alta
    // pero bajará — perdonamos que currentPressure > pr.max (ver filterByPressure).
    // 🩸 WAVE 7557: El threshold universal 0.55 se mantiene para todos los
    // eventos. El parche temporal (0.40 para low-energy) fue removido porque
    // la probabilidad del energy_drop ahora es orgánica (WAVE 7557 en
    // PredictionEngine) y supera 0.55 naturalmente cuando la caída es real.
    // 🌊 WAVE 7560: ASYMMETRIC RELAXATION — Breakdowns/valleys son minorías
    // estadísticas (prob ~0.40-0.45). El threshold 0.55 los bloquea
    // sistemáticamente. Ahora el threshold es context-aware:
    //   - Minority events (breakdown_imminent, energy_drop):
    //     0.40 — suficiente para confiar en la estructura del Markov.
    //   - Majority events (drop, buildup, spike): 0.55 — requiere evidencia.
    // Esto, combinado con el TRUE CONFIDENCE del DreamEngineIntegrator
    // (WAVE 7560), permite que un breakdown_imminent con prob 0.45 relaje
    // el MAX pressure guard y deje entrar efectos ambientales al pre-buffer
    // durante un climax.
    const isMinorityEvent = predType === 'breakdown_imminent'
      || predType === 'energy_drop'
    const requiredConfidence = isMinorityEvent ? 0.40 : 0.55
    const relaxGuardsForFuture = (isFutureHeavyEvent || isFutureBuildup || isFutureLowEnergyEvent)
      && prediction.confidence > requiredConfidence
      && timeToEvent > 0

    if (projectedZone !== energyZone) {
      console.log(
        `[DREAM_SIMULATOR] 🔮 ORACLE VISION: zone override ${energyZone} → ${projectedZone} ` +
        `(pred=${predType} timeToEvent=${timeToEvent}ms conf=${prediction.confidence.toFixed(3)})` +
        (relaxGuardsForFuture ? ' | Z-guards RELAXED' : '')
      )
    }

    const zoneFilteredEffects = this.filterByZone(vibeAllowedEffects, projectedZone)

    // 🎯 pressureRange gate — filter by acoustic pressure envelope
    const currentPressure = context.energy ?? state.energy
    const pressureFilteredEffects = this.filterByPressure(zoneFilteredEffects, currentPressure, relaxGuardsForFuture, isFutureLowEnergyEvent)

    // 🔍 WAVE 7522: FILTER AUDIT — Log once every 30s to see where effects are lost
    if (!this._lastFilterAuditTs || Date.now() - this._lastFilterAuditTs > 30000) {
      this._lastFilterAuditTs = Date.now()
      console.log(
        `[DREAM_AUDIT 🔍] vibe="${state.vibe}" zone=${projectedZone} pressure=${currentPressure.toFixed(3)} | ` +
        `vibeAllowed=${vibeAllowedEffects.length} → zoneFiltered=${zoneFilteredEffects.length} → pressureFiltered=${pressureFilteredEffects.length} | ` +
        `cooldowns=${state.activeCooldowns.size} | phase=${context.narrativePhase ?? 'n/a'}`
      )
    }

    // 🎯 WAVE 4865: Muestreo sin reemplazo por effect id.
    // Evita clones en ranking cuando múltiples aliases/vías aportan el mismo efecto.
    const seenEffectIds = new Set<string>()
    
    // 🧹 WAVE 1015: Silenciado - spam innecesario
    
    // 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
    const moodController = MoodController.getInstance()
    const currentProfile = moodController.getCurrentProfile()
    let blockedCount = 0
    let zoneBlockedCount = vibeAllowedEffects.length - pressureFilteredEffects.length
    
    // ⚡ WAVE 4846: SPATIAL COGNITION — Hardware manifest snapshot (once per call)
    // Construimos el Set de CanonicalZones activas UNA SOLA VEZ antes del loop.
    // Cada fixture habilitado contribuye su zona normalizada → el guard compara contra este Set.
    const _hwManifest = getTitanOrchestrator().getFixturesForZoneMapping()
    const activeZoneSet = new Set<string>(
      _hwManifest
        .filter(f => f.enabled !== false)
        .map(f => normalizeZone(f.zone))
    )

    // Generar candidatos SOLO de efectos filtrados
    for (const effect of pressureFilteredEffects) {
      if (seenEffectIds.has(effect)) {
        continue
      }
      seenEffectIds.add(effect)

      // 🎭 WAVE 920.2: Skip efectos bloqueados por mood (no gastar CPU simulando)
      if (moodController.isEffectBlocked(effect)) {
        blockedCount++
        continue
      }

      // 🧬 WAVE 6000.V7: COOLDOWN SEAL — Skip cooldown-locked effects early
      //   Avoids wasting CPU simulating candidates that the Gatekeeper will reject.
      if (state.activeCooldowns.has(effect)) {
        continue
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // ⚡ WAVE 4843: COGNITIVE BRIDGE — STROBE Z-GUARD + ZSCORE GUARDS
      // 🔮 WAVE 5014: Guards relajados para predicciones futuras garantizadas
      // ═══════════════════════════════════════════════════════════════════════════
      // WAVE 1179/1180 usaban una lista hardcodeada STROBE_EFFECTS y un nombre
      // hardcodeado ('gatling_raid'). Ambos destruidos en WAVE 4843.
      //
      // NUEVO COMPORTAMIENTO (lee directamente del .lfx):
      //   1. Si entry.simMeta.isStrobe === true y zScore <= 0 → skip
      //      EXCEPCIÓN (WAVE 5014): Si es predicción futura garantizada (relaxGuardsForFuture)
      //      el strobe guard se omite — el Z subirá cuando el drop rompa.
      //
      //   2. Si entry.simMeta.zScoreGuards.minimumZ existe y zScore < minimumZ → skip
      //      EXCEPCIÓN (WAVE 5014): Omitido si relaxGuardsForFuture.
      //
      //   3. Si entry.simMeta.zScoreGuards.minimumEnergy existe y energy < minimumEnergy → skip
      //      EXCEPCIÓN (WAVE 5014): Omitido si relaxGuardsForFuture.
      //
      // Esto convierte los guards en metadatos del efecto, no del motor.
      // ═══════════════════════════════════════════════════════════════════════════
      const registry = getDynamicEffectRegistry()
      const entry = registry.getEntry(effect)
      if (entry) {
        // BUILDING phase aggression filter: reject high-aggression effects during buildup
        const narrativePhase = (context.narrativePhase ?? '').toLowerCase()
        // 🩸 WAVE 7170: PARADOX RESOLUTION — Si projectedZone es 'intense' o 'peak',
        // la proyección energética manda sobre la restricción de fase base.
        // Sin esto, building + projectedZone='intense' (min aggression 0.60) es una
        // contradicción lógica: el filtro building rechaza >0.4 pero intense requiere ≥0.60.
        const isProjectedHighEnergy = projectedZone === 'intense' || projectedZone === 'peak'
        if (narrativePhase === 'building' && entry.dna.aggression > 0.4 && !isProjectedHighEnergy) {
          continue
        }
        // 🧬 PURGATORY WALL: Only elite organisms fire in the live rig.
        // 'alive' minions are quarantined — they must earn 'champion' or 'canonized'
        // status through simulation before being selected for live output.
        // Built-in blueprints (no organismId) are always allowed.
        if (entry.organismId && entry.organismStatus === 'alive') {
          if (this.simulationCount % 30 === 0) {
            console.log(`[DREAM_SIMULATOR] 🧬🛡️ PURGATORY WALL: ${effectDisplayName(effect)} blocked (status=alive, needs promotion)`)
          }
          continue
        }

        const { isStrobe } = entry.simMeta
        const { energy } = context
        const aggression = entry.dna.aggression ?? 0

        // Guard 1: Strobe en energía descendente
        // 🔮 WAVE 5014: Solo se aplica si NO es una predicción futura garantizada
        if (isStrobe && zScore <= 0 && !relaxGuardsForFuture) {
          continue
        }

        // Guard 2: HEAVY Z-FLOOR (WAVE 7553 — centralized, replaces .lfx minimumZ)
        // Any effect with aggression > 0.80 MUST have Z >= 1.0 to fire.
        // This is the single source of truth for heavy Z-gating.
        // 🔮 WAVE 5014: Omitido en predicciones futuras — el Z subirá en el evento
        if (!relaxGuardsForFuture && aggression > 0.80 && zScore < 1.0) {
          continue
        }

        // Guard 3: Hardware Compatibility — fixtureTargeting vs active manifest
        // ⚡ WAVE 4846: Si el .lfx exige un hardware específico (movers, strobes, pars…)
        // que no está presente en el rig actual, el candidato se descarta aquí.
        // 'all' = universal, siempre pasa. Fail-open: targeting desconocido → no bloquea.
        if (!this._isTargetingAvailable(entry.execHints.fixtureTargeting, activeZoneSet)) {
          continue
        }
      }
      
      // Calcular intensidad basada en energía predicha
      const intensity = this.calculateIntensity(prediction.predictedEnergy, effect)
      
      // 🔮 WAVE 1190: PROYECTO CASSANDRA - Boost para efectos sugeridos por el Oráculo
      const isSuggestedByOracle = prediction.suggestedEffects?.some(
        suggested => effect.includes(suggested) || suggested.includes(effect)
      ) ?? false
      
      // 🔮 CASSANDRA: Confidence boost si el Oráculo sugirió este efecto
      // 🩸 WAVE 2104: Reducido de 0.15 a 0.08 — sugerencia, no imposición
      const oracleBoost = isSuggestedByOracle ? 0.08 : 0
      const baseConfidence = prediction.confidence * 0.9
      const finalConfidence = Math.min(1, baseConfidence + oracleBoost)
      
      candidates.push({
        effect,
        effectName: entry?.name,
        intensity,
        zones: ['all'], // Simplificado para Phase 1
        reasoning: isSuggestedByOracle 
          ? `🔮 CASSANDRA: Oracle suggested | vibe=${state.vibe} zone=${projectedZone}${projectedZone !== energyZone ? ` (actual:${energyZone})` : ''}`
          : `🧬 DNA Dream: vibe=${state.vibe} zone=${projectedZone}${projectedZone !== energyZone ? ` (actual:${energyZone})` : ''}`,
        confidence: finalConfidence
      })
    }
    
    // 🔮 WAVE 1190: CASSANDRA LOG - Solo si hay predicción fuerte
    if (prediction.confidence > 0.6 && prediction.predictionType !== 'none') {
      console.log(
        `[DREAM_SIMULATOR] 🔮 CASSANDRA: type=${prediction.predictionType} ` +
        `conf=${prediction.confidence.toFixed(3)} ` +
        `timeToEvent=${prediction.timeToEventMs ?? '?'}ms ` +
        `urgent=${prediction.isUrgent} ` +
        `candidates=${candidates.length}`
      )
    }

    // 🩸 WAVE 7553: MINIMAL RESCUE ERADICATED.
    // The old WAVE 5009 rescue bypassed zScoreGuards.minimumZ when all candidates
    // were blocked, forcing bypassed shots. Now that zScoreGuards.minimumZ is
    // null everywhere and the heavy Z-floor (Z >= 1.0) is centralized in code,
    // there is no need for a rescue. If all effects are blocked by valid
    // constraints, the system gracefully degrades to silence or CALM ambient.

    return candidates
  }
  
  /**
   * ⚡ WAVE 4846: SPATIAL COGNITION — Hardware Guard
   *
   * Verifica si el hardware presente en el rig satisface el requisito declarado
   * en `fixtureTargeting` del .lfx. Opera sobre el Set de CanonicalZones activas
   * construido una vez en `generateCandidates()` con normalizeZone().
   *
   * Mapping FixtureTargeting → CanonicalZone:
   *   'all'        → universal, siempre true
   *   'movers'     → movers-left | movers-right
   *   'pars'       → front | back | floor
   *   'strobes'    → center  (normalizeZone('strobes') = 'center')
   *   'zone-front' → front
   *   'zone-back'  → back
   *   'zone-left'  → movers-left
   *   'zone-right' → movers-right
   *   unknown      → true  (fail-open: no bloqueamos targeting futuro desconocido)
   */
  private _isTargetingAvailable(targeting: string, activeZones: Set<string>): boolean {
    switch (targeting) {
      case 'all':   return true
      case 'movers':    return activeZones.has('movers-left') || activeZones.has('movers-right')
      case 'pars':      return activeZones.has('front') || activeZones.has('back') || activeZones.has('floor')
      case 'strobes':   return activeZones.has('center')
      case 'zone-front': return activeZones.has('front')
      case 'zone-back':  return activeZones.has('back')
      case 'zone-left':  return activeZones.has('movers-left')
      case 'zone-right': return activeZones.has('movers-right')
      default:      return true
    }
  }

  private calculateIntensity(predictedEnergy: number, effect: string): number {
    // ⚡ WAVE 4997: SELENE INTENSITY FLOOR & DE-GHOSTING
    const MIN_VISIBLE_INTENSITY = 0.80
    
    // Intensidad base: la energía predicha o el suelo garantizado
    let intensity = Math.max(MIN_VISIBLE_INTENSITY, predictedEnergy)
    
    // Ajustar por tipo de efecto (usando la intensidad base con suelo)
    if (effect.includes('strobe') || effect.includes('laser')) {
      // Efectos agresivos usan full energy
      intensity = Math.min(1.0, intensity * 1.1)
    } else if (effect.includes('wave') || effect.includes('cascade')) {
      // Efectos suaves usan menos energy
      intensity = intensity * 0.8
    }
    
    return Math.max(0, Math.min(1, intensity))
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 🦕 LEGACY: BEAUTY PROJECTION (WAVE 970: DEPRECADO)
  // ═══════════════════════════════════════════════════════════════
  // 
  // ⚠️ WAVE 970: Este método está DEPRECADO.
  // La "belleza" ya no es el criterio principal.
  // Usamos calculateDNARelevance() para matching contextual.
  // 
  // Este método se mantiene SOLO para:
  // 1. Compatibilidad con código legacy que espere projectedBeauty
  // 2. Período de transición mientras se valida el nuevo sistema
  // 
  // TODO WAVE 971+: Remover completamente una vez validado DNA system
  // ═══════════════════════════════════════════════════════════════
  
  private projectBeauty(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    // ⚡ WAVE 4823: Registry exclusivo — EFFECT_BEAUTY_WEIGHTS exterminado (ACO Triad)
    const simMeta = getDynamicEffectRegistry().getSimMeta(effect.effect)
    if (!simMeta) return 0.5  // No en registry → neutro

    const { base, energyMultiplier, vibeBonus } = simMeta.beautyWeights

    // ACO Triad: base × energía × vibe
    let beauty = base
    beauty *= (1 + (context.energy - 0.5) * (energyMultiplier - 1))
    beauty += vibeBonus

    // Intensity factor + momentum de belleza actual
    beauty *= (0.7 + 0.3 * effect.intensity)
    beauty = beauty * 0.7 + state.currentBeauty * 0.3

    return Math.max(0, Math.min(1, beauty))
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: RISK CALCULATION
  // ═══════════════════════════════════════════════════════════════
  
  private calculateRisk(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    let risk = 0.0
    
    // GPU overload risk — ⚡ WAVE 4823: Registry
    const simMeta = getDynamicEffectRegistry().getSimMeta(effect.effect)
    const gpuCost = simMeta?.gpuCost ?? 0.15
    const projectedGpuLoad = context.gpuLoad + gpuCost * effect.intensity
    
    if (projectedGpuLoad > 0.8) {
      risk += 0.3 // High GPU risk
    } else if (projectedGpuLoad > 0.6) {
      risk += 0.1 // Moderate GPU risk
    }
    
    // Audience fatigue risk — ⚡ WAVE 4823: Registry
    const fatigueImpact = simMeta?.fatigueImpact ?? 0.05
    const projectedFatigue = context.audienceFatigue + fatigueImpact * effect.intensity
    
    if (projectedFatigue > 0.8) {
      risk += 0.4 // High fatigue risk
    } else if (projectedFatigue > 0.6) {
      risk += 0.2 // Moderate fatigue risk
    }
    
    // Epilepsy risk (strobes en epilepsy mode)
    if (context.epilepsyMode && effect.effect.includes('strobe')) {
      risk += 0.5 // Critical risk
    }
    
    // Cooldown violation risk
    if (state.activeCooldowns.has(effect.effect)) {
      risk += 0.2
    }
    
    // Intensity risk (muy alto = arriesgado)
    if (effect.intensity > 0.9) {
      risk += 0.1
    }
    
    return Math.min(1.0, risk)
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: OTHER PROJECTIONS
  // ═══════════════════════════════════════════════════════════════
  
  private projectConsonance(effect: EffectCandidate, state: SystemState): number {
    // Si no hay efecto anterior, consonancia neutral
    if (!state.lastEffect) return 0.7
    
    // Mismo efecto = alta consonancia (pero puede ser monotonía)
    if (effect.effect === state.lastEffect) return 0.9
    
    // ⚡ WAVE 4824: Misma familia de vibes = consonancia moderada (Registry)
    const registry = getDynamicEffectRegistry()
    const effectVibes = registry.getEntry(effect.effect)?.compatibleVibes ?? []
    const lastVibes = registry.getEntry(state.lastEffect)?.compatibleVibes ?? []
    if (effectVibes.some(v => lastVibes.includes(v))) {
      return 0.7
    }
    
    // Efectos de categoría diferente = baja consonancia (puede ser bueno o malo)
    return 0.4
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 🧬 WAVE 970: DNA-BASED CONTEXTUAL RELEVANCE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calcula la relevancia contextual de un efecto usando DNA matching.
   * Reemplaza el antiguo sistema de "belleza" con algo más inteligente.
   * 
  * @returns { relevance: 0-1, distance: 0-√3, targetDNA: TargetDNA }
   */
  private calculateDNARelevance(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): { relevance: number; distance: number; targetDNA: TargetDNA } {
    // Obtener el DNA del efecto del Registry dinámico
    const effectEntry = getDynamicEffectRegistry().getEntry(effect.effect)
    
    // Si no existe en el registry, usar valores neutros
    if (!effectEntry) {
      console.warn(`[DREAM_SIMULATOR] ⚠️ Effect ${effect.effect} not in Registry, using neutral DNA`)
      return {
        relevance: 0.50,  // Neutral
        distance: 0.866,  // √3/2 = centro del espacio
        targetDNA: { aggression: 0.5, chaos: 0.5, organicity: 0.5, confidence: 0.5 }
      }
    }
    
    // ⚡ WAVE 4849: Texture neutralized in Selene runtime (no reject/boost by texture)
    const harshness = context.spectral?.harshness ?? 0.4
    const spectralFlatness = context.spectral?.flatness ?? 0.5
    
    // Construir MusicalContext para el DNAAnalyzer
    // 🧬 M-SARFE: When ARS is available, the DNAAnalyzer uses it for target derivation.
    // The legacy fields below are only used as fallback when ARS is absent.
    const musicalContext: MusicalContextForDNA = {
      energy: state.energy,
      syncopation: undefined,
      mood: 'neutral',
      section: {
        type: this.deriveSection(state, context),
        confidence: 0.75
      },
      rhythm: {
        drums: {
          kickIntensity: 0
        },
        fillDetected: false,
        groove: 0.5,
        confidence: 0.7
      },
      energyContext: {
        trend: state.energy > 0.5 ? 1 : state.energy < 0.3 ? -1 : 0
      },
      confidence: 0.75
    }
    
    // Construir AudioMetrics para el DNAAnalyzer
    // 🧬 M-SARFE: When ARS is present, bass/mid/treble are NOT used for target derivation.
    // Only harshness and spectralFlatness are passed through (they come from real FFT).
    const audioMetrics: AudioMetricsForDNA = {
      bass: 0.5,
      mid: 0.5,
      treble: 0.5,
      volume: state.energy,
      harshness,
      spectralFlatness
    }
    
    // Usar el DNAAnalyzer singleton para derivar el Target DNA
    // 🧬 M-SARFE: Pass AcousticRealityState for real acoustic target derivation
    const dnaAnalyzer = getDNAAnalyzer()
    const targetDNA = dnaAnalyzer.deriveTargetDNA(musicalContext, audioMetrics, context.acousticReality)
    
    // 🩸 WAVE 2104.1: DIAGNOSTIC — Target DNA (throttled: 1 per effect per dream cycle)
    // Solo loguear para el PRIMER efecto evaluado en cada dream cycle (evitar spam)
    if (this.simulationCount % 5 === 0 && effect.effect === 'acid_sweep') {
      console.log(`[DNA_TARGET] 🎯 Target: A=${targetDNA.aggression.toFixed(3)} C=${targetDNA.chaos.toFixed(3)} O=${targetDNA.organicity.toFixed(3)} | E=${state.energy.toFixed(3)} H=${harshness.toFixed(3)}`)
    }
    
    // Calcular distancia euclidiana 3D usando dna del Registry
    const effDna = effectEntry.dna
    const dA = effDna.aggression - targetDNA.aggression
    const dC = effDna.chaos - targetDNA.chaos
    const dO = effDna.organicity - targetDNA.organicity
    const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)
    
    // Convertir distancia a relevancia (0-1)
    // Distancia máxima teórica es √3 ≈ 1.732
    const MAX_DISTANCE = Math.sqrt(3)
    let relevance = 1.0 - (distance / MAX_DISTANCE)
    
    relevance = Math.max(0, Math.min(1, relevance))
    
    return { relevance, distance, targetDNA }
  }
  
  /**
   * 🧬 WAVE 970: Deriva sección del estado actual
   */
  private deriveSection(state: SystemState, context: AudienceSafetyContext): 'drop' | 'buildup' | 'breakdown' | 'verse' | 'chorus' | 'intro' | 'outro' {
    // Derivación simple basada en energía
    if (state.energy > 0.85) return 'drop'
    if (state.energy > 0.65) return 'chorus'
    if (state.energy < 0.25) return 'breakdown'
    return 'verse'
  }

  private calculateGpuImpact(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ⚡ WAVE 4823: Registry
    const gpuCost = getDynamicEffectRegistry().getSimMeta(effect.effect)?.gpuCost ?? 0.15
    return Math.min(1.0, gpuCost * effect.intensity)
  }
  
  private calculateFatigueImpact(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ⚡ WAVE 4823: Registry
    const fatigueImpact = getDynamicEffectRegistry().getSimMeta(effect.effect)?.fatigueImpact ?? 0.05
    return fatigueImpact * effect.intensity
  }
  
  private detectCooldownConflicts(effect: EffectCandidate, state: SystemState): string[] {
    const conflicts: string[] = []
    
    if (state.activeCooldowns.has(effect.effect)) {
      const remainingMs = state.activeCooldowns.get(effect.effect)!
      conflicts.push(`${effect.effect} in cooldown (${(remainingMs / 1000).toFixed(1)}s remaining)`)
    }
    
    return conflicts
  }
  
  private detectHardwareConflicts(effect: EffectCandidate, context: AudienceSafetyContext): string[] {
    const conflicts: string[] = []
    
    // GPU overload — ⚡ WAVE 4823: Registry
    const gpuCost = getDynamicEffectRegistry().getSimMeta(effect.effect)?.gpuCost ?? 0.15
    if (context.gpuLoad + gpuCost > 0.9) {
      conflicts.push('GPU overload risk')
    }
    
    // Epilepsy mode
    if (context.epilepsyMode && effect.effect.includes('strobe')) {
      conflicts.push('Epilepsy mode blocks strobes')
    }
    
    return conflicts
  }
  
  private calculateVibeCoherence(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ═══════════════════════════════════════════════════════════════
    // §5.4: VIBE BRANCHES PURGED — genre-string family lists eradicated.
    //
    // The coherence score is now derived from the DynamicEffectRegistry's
    // compatibleVibes metadata — the .lfx files declare which vibes an effect
    // belongs to. If the effect's registry entry lists the current vibe as
    // compatible, it's "family" (0.85). If not, it's neutral (0.4). No
    // hardcoded TECHNO_FAMILY / LATINO_FAMILY arrays.
    //
    // FILOSOFÍA: La coherencia de vibe ya se filtra en generateCandidates() con
    //            getVibeAllowedEffects(). Si un efecto llegó hasta aquí, ES coherente.
    //            The registry is the single source of truth for vibe compatibility.
    // ═══════════════════════════════════════════════════════════════
    const entry = getDynamicEffectRegistry().getEntry(effect.effect)
    if (!entry) return 0.4  // Unknown effect — neutral

    // Check if the effect's compatibleVibes includes the current vibe
    const compatibleVibes = entry.compatibleVibes
    if (compatibleVibes.length === 0) return 0.6  // No vibe restriction — neutral
    // 🩸 WAVE 7548: Normalize aliases — 'latin' should match 'fiesta-latina'
    if (vibeMatches(compatibleVibes, context.vibe)) return 0.85  // Family
    return 0.4  // Not family but not explicitly blocked either
  }
  
  private calculateDiversityScore(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ═══════════════════════════════════════════════════════════════
    // 🔥 WAVE 982.5: DIVERSITY ENGINE - ESCALERA DE PENALIZACIÓN
    // ═══════════════════════════════════════════════════════════════
    
    // 🧹 WAVE 1178.1: DEBUG silenciado
    // if (effect.effect === 'cyber_dualism') {
    //   console.log(`[DIVERSITY_DEBUG] 🔍 cyber_dualism: historySize=${context.recentEffects.length}, effects=[${context.recentEffects.map(e=>e.effect).join(',')}]`)
    // }
    
    // Contar uso reciente (últimos efectos en el historial)
    const recentUsage = context.recentEffects
      .filter(e => e.effect === effect.effect)
      .length
    
    // 🎯 ESCALERA DE PENALIZACIÓN DIRECTA
    let diversityScore: number
    
    switch (recentUsage) {
      case 0:
        diversityScore = 1.0   // ✅ Efecto fresco - sin penalización
        break
      case 1:
        diversityScore = 0.7   // ⚠️ Usado 1x - 30% penalty
        break
      case 2:
        diversityScore = 0.4   // 🟠 Usado 2x - 60% penalty
        break
      default:
        diversityScore = 0.1   // 🔴 Usado 3+x - 90% SHADOWBAN
        break
    }

    // 🩸 WAVE 4865: FATIGUE Z-SCORE — efectos con fatiga extrema se castigan más.
    // 0.80 -> x1.00, 0.90 -> x0.75, 1.00 -> x0.50
    const fatigueImpact = getDynamicEffectRegistry().getSimMeta(effect.effect)?.fatigueImpact ?? 0
    if (fatigueImpact > 0.8) {
      const highFatigueMultiplier = 1 - ((fatigueImpact - 0.8) * 2.5)
      diversityScore *= Math.max(0.5, highFatigueMultiplier)
      diversityScore = Math.max(0.05, diversityScore)
    }
    
    return diversityScore
  }
  
  private calculateSimulationConfidence(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    let confidence = 1.0
    
    // Reducir confianza si poco historial
    if (context.recentEffects.length < 10) {
      confidence *= 0.7
    }
    
    // Reducir confianza si alta fatiga (comportamiento impredecible)
    if (context.audienceFatigue > 0.7) {
      confidence *= 0.8
    }
    
    // Reducir confianza si efecto desconocido en Registry
    if (!getDynamicEffectRegistry().getEntry(effect.effect)) {
      confidence *= 0.5
    }
    
    return confidence
  }

  // ═══════════════════════════════════════════════════════════════
  // 🎨 WAVE 7168: TEXTURE AFFINITY CONTEXTUAL BONUS
  // ═══════════════════════════════════════════════════════════════
  // Re-activates texture affinity as a SOFT contextual modifier (not a gate).
  // Uses the same dirtiness formula as FluidDescriptorEngine for consistency.
  //
  // Bonus range: -0.03 (mild conflict) to +0.08 (strong match).
  // Universal effects: always 0 (neutral).
  // Dirty effects: bonus proportional to environment dirtiness.
  // Clean effects: bonus proportional to environment cleanliness.
  // Cross-match (dirty in clean / clean in dirty): small -0.03 penalty.
  // ═══════════════════════════════════════════════════════════════

  private calculateTextureBonus(
    effectId: string,
    context: AudienceSafetyContext
  ): number {
    const entry = getDynamicEffectRegistry().getEntry(effectId)
    if (!entry) return 0

    const affinity = entry.textureAffinity
    if (affinity === 'universal') return 0

    const spectral = context.spectral
    if (!spectral) return 0

    const harshness = spectral.harshness ?? 0.3
    const flatness = spectral.flatness ?? 0.1
    const clarity = spectral.clarity ?? 0.5

    // Same formula as FluidDescriptorEngine.dirtiness
    const dirtiness = harshness * (0.5 + 0.5 * flatness)
    const cleanliness = clarity * (1 - dirtiness)

    if (affinity === 'dirty') {
      // Dirty effect thrives in dirty environment
      let bonus = dirtiness * 0.08
      // Mild penalty if environment is very clean
      if (dirtiness < 0.12) bonus -= 0.03
      return bonus
    }

    if (affinity === 'clean') {
      // Clean effect thrives in clean environment
      let bonus = cleanliness * 0.08
      // Mild penalty if environment is very dirty
      if (dirtiness > 0.35) bonus -= 0.03
      return bonus
    }

    return 0
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: RANKING & RECOMMENDATION
  // ═══════════════════════════════════════════════════════════════
  
  private rankScenarios(scenarios: EffectScenario[], prediction: MusicalPrediction): EffectScenario[] {
    // Multi-factor ranking
    // 🔍 WAVE 996.6: DEBUG - Log top candidates to diagnose diversity issues
    const scored = scenarios.map(s => ({
      scenario: s,
      score: this.calculateScenarioScore(s, prediction)
    })).sort((a, b) => b.score - a.score)
    
    // � WAVE 2104.1: DIAGNOSTIC LOG — Top 5 candidatos con desglose completo
    // SIN ESTO ESTAMOS CIEGOS. Se desactiva cuando el sistema esté calibrado.
    const top5 = scored.slice(0, 5)
    const predType = prediction.predictionType ?? 'none'
    console.log(
      `[DREAM_RANKING] 🏆 TOP 5 (${scored.length} total) | pred=${predType} conf=${prediction.confidence.toFixed(3)}:\n` +
      top5.map((s, i) => {
        const sc = s.scenario
        const dna = `DNA=${sc.projectedRelevance.toFixed(3)}`
        const div = `DIV=${sc.diversityScore.toFixed(3)}`
        const vib = `VIB=${sc.vibeCoherence.toFixed(3)}`
        const rsk = `RSK=${sc.riskLevel.toFixed(3)}`
        const dist = `dist=${sc.dnaDistance.toFixed(3)}`
        const tex = sc.textureBonus ? `TEX=${sc.textureBonus >= 0 ? '+' : ''}${sc.textureBonus.toFixed(3)}` : ''
        const displayName = effectDisplayName(sc.effect.effectName ?? sc.effect.effect)
        return `  ${i + 1}. ${displayName.padEnd(20)} SCORE=${s.score.toFixed(3)} | ${dna} ${div} ${vib} ${rsk} ${dist} ${tex}`
      }).join('\n')
    )
    
    return scored.map(s => s.scenario)
  }
  
  private calculateScenarioScore(scenario: EffectScenario, prediction: MusicalPrediction): number {
    // ═══════════════════════════════════════════════════════════════
    // 🧬 WAVE 970: DNA-BASED SCORING
    // 🔥 WAVE 982.5: DIVERSITY ENGINE INTEGRATION
    // 🧠 WAVE 1173: NEURAL LINK - Oracle → Dreamer scoring
    // 🎲 WAVE 1178: ANTI-DETERMINISM ENGINE - Exploration factor
    // ═══════════════════════════════════════════════════════════════
    // 
    // FÓRMULA:
    // FinalScore = (Relevance * DiversityFactor) + vibeBonus + riskPenalty + SPIKE_BOOST + EXPLORATION
    // 
    // 🎲 WAVE 1178: EXPLORATION FACTOR
    // El problema: DNA scoring es 100% determinista, siempre gana el mismo.
    // Solución: Añadir varianza basada en TIMESTAMP para que diferentes
    //           candidatos ganen en diferentes momentos sin usar Math.random().
    // 
    // El exploration factor usa el hash del nombre del efecto XOR timestamp
    // para crear una rotación determinista que varía en el tiempo.
    // Esto NO es aleatorio, pero tampoco es predecible sin conocer el timestamp.
    // ═══════════════════════════════════════════════════════════════
    
    let score = 0
    const effectName = scenario.effect.effect.toLowerCase()
    
    // 🩸 WAVE 2104: adjustedRelevance ya no se usa en pesos principales
    // (diversity es factor independiente ahora), pero se mantiene para el perfect match check
    // WAVE 7158: adjustedRelevance removed — diversity is now a final multiplicative penalty
    // and the perfect-match check was redundant since diversity is globally enforced.
    
    // 🎲 WAVE 1178: ANTI-DETERMINISM - Exploration Factor
    // 🩸 WAVE 2104: Ventana 10s→8s, probabilidad 30%→40%, boost 0.15→0.12
    // Más efectos rotan más frecuentemente pero con boost más moderado.
    // Antes: 30% recibían +0.15 cada 10s = picos agresivos infrecuentes
    // Ahora: 40% reciben +0.12 cada 8s = rotación más suave y constante
    const effectHash = this.hashEffectName(effectName)
    const timeWindow = Math.floor(Date.now() / 8000) // 🩸 WAVE 2104: Cambia cada 8 segundos (era 10)
    const explorationSeed = (effectHash + timeWindow) % 100
    const explorationBoost = (explorationSeed < 40) ? 0.12 : 0 // 🩸 WAVE 2104: 40% de efectos (era 30%), boost 0.12 (era 0.15)
    
    // 🧬 Pesos del scoring (ajustados para hacer espacio a exploración)
    // 🩸 WAVE 2104: REBALANCE — "Cassandra es el copiloto, no el piloto"
    // ANTES: relevance*0.45, vibe*0.18, risk*0.18, simConf*0.09, exploration*0.10
    // PROBLEMA: DNA relevance (45%) dominaba todo. cyber_dualism SIEMPRE ganaba porque
    //           su DNA (A=0.55, C=0.50, O=0.45) está en el CENTRO del espacio y
    //           la distancia euclidiana es MÍNIMA para energías medias.
    //           Diversity se multiplicaba DENTRO de relevance → el efecto con mejor
    //           DNA distance aplastaba cualquier penalización de diversidad.
    // AHORA: Diversity se pondera SEPARADAMENTE del DNA relevance.
    //        DNA baja a 0.35, Diversity sube a 0.20 como factor INDEPENDIENTE.
    //        Exploration sube a 0.12 para más varianza temporal.
    score += scenario.projectedRelevance * 0.35     // 🧬 DNA puro (era 0.45 con diversity incluida)
    score += scenario.diversityScore * 0.20          // 🎲 Diversity INDEPENDIENTE (nuevo)
    score += scenario.vibeCoherence * 0.15           // Coherencia de vibe (era 0.18, ahora que es igualitaria baja)
    score += (1 - scenario.riskLevel) * 0.13         // Bajo riesgo (era 0.18)
    score += scenario.simulationConfidence * 0.05    // Confianza (era 0.09)
    score += explorationBoost                        // 🎲 WAVE 1178: Exploration (12% efectivo)
    
    // Penalizar conflictos
    score -= scenario.cooldownConflicts.length * 0.15
    score -= scenario.hardwareConflicts.length * 0.20
    
    // Boost si viene drop
    if (prediction.isDropComing && scenario.effect.intensity > 0.7) {
      score += 0.1
    }
    
    // Boost si match perfecto (alta relevancia Y cercanía DNA)
    // WAVE 7158: adjustedRelevance removed — diversity now enforced as final multiplier
    if (scenario.projectedRelevance > 0.80 && scenario.dnaDistance < 0.3) {
      score += 0.05
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🧠 WAVE 1173: NEURAL LINK - Oracle Spike Reaction
    // 🎯 WAVE 1176: OPERATION SNIPER - Reacción VIOLENTA a drops
    // "El sistema debe reaccionar visualmente ANTES que el humano"
    // ═══════════════════════════════════════════════════════════════
    
    const predictionType = prediction.predictionType ?? 'none'
    
    if (predictionType === 'energy_spike' || predictionType === 'drop_incoming') {
      // 🎯 WAVE 2093 COG-6: RATIO SIMÉTRICO ±0.40
      // Era +0.50/-0.70 (ratio 7:5 asimétrico) — destruía candidatos atmosféricos en falsos spike.
      // Ahora ±0.40 simétrico: boost justo, penalti justo. Equilibrio.
      //
      // 🩸 WAVE 2095.3: Añadidos 'saw', 'abyssal', 'rise', 'dualism', 'cyber'
      // PROBLEMA: Los efectos hard con textureAffinity='dirty' (industrial_strobe, gatling_raid)
      // eran los únicos con keywords en IMPACT_EFFECTS. Pero en textura CLEAN (Brejcha,
      // clarity 0.80, harshness 0.01), todos los 'dirty' son VETADOS por texture filter.
      // Los efectos universal agresivos (sky_saw A=0.80, abyssal_rise A=0.80, cyber_dualism A=0.55)
      // NO tenían keywords aquí → ninguno recibía el +0.40 boost durante drops.
      // Resultado: en clean texture + drop_incoming, NADIE recibía boost → acid_sweep seguía ganando.
      const IMPACT_EFFECTS = [
        'strobe', 'flash', 'blind', 'gatling', 'thunder', 'meltdown', 
        'storm', 'raid', 'snap', 'spark', 'burst', 'strike', 'glitch',
        'saw', 'abyssal', 'rise', 'dualism', 'cyber'  // 🩸 WAVE 2095.3: universal agresivos
      ]
      const isImpactEffect = IMPACT_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isImpactEffect) {
        score += 0.40  // 🎯 WAVE 2093: Simétrico (era 0.50)
        // También boost intensity del candidato (mutación temporal para scoring)
        scenario.effect.intensity = Math.min(1.0, scenario.effect.intensity * 1.25)
      }
      
      // 🎯 WAVE 2093 COG-6: Penalti simétrico para lentos
      const SLOW_EFFECTS = [
        'breath', 'mist', 'drift', 'moon', 'wave', 'sweep', 'ambient', 
        'fiber', 'pulse', 'shimmer', 'plankton', 'whale', 'caustic'
      ]
      const isSlowEffect = SLOW_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isSlowEffect) {
        score -= 0.40  // 🎯 WAVE 2093: Simétrico (era 0.70 — demasiado destructivo)
      }
    }
    
    // 🌊 WAVE 1173: Buildup - Boost efectos de tensión
    if (predictionType === 'buildup_starting') {
      const TENSION_EFFECTS = ['rise', 'sweep', 'ramp', 'build', 'acid']
      const isTensionEffect = TENSION_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isTensionEffect) {
        score += 0.15
      }
    }
    
    // 📉 WAVE 1173: Breakdown - Boost efectos atmosféricos
    if (predictionType === 'breakdown_imminent' || predictionType === 'energy_drop') {
      const ATMOSPHERIC_EFFECTS = ['mist', 'breath', 'ambient', 'fiber', 'drift', 'moon']
      const isAtmospheric = ATMOSPHERIC_EFFECTS.some(keyword => effectName.includes(keyword))

      if (isAtmospheric) {
        score += 0.20
      }

      // 🌊 WAVE 7556: YIN YANG — Bonus arquetípico para candidatos ambientales.
      // El boost por keyword solo captura efectos con nombres obvios (mist, breath).
      // Efectos transitorios custom (latin_bubbles, etc.) con archetype 'ambient' o
      // 'utility' y aggression baja no recibían el boost → perdían contra heavy
      // effects que colaban por el anti-monopoly fallback.
      // Ahora: archetype ambient/utility + aggression <= 0.60 → +0.15 bonus.
      // Esto es simétrico al isHeavyCandidate/isDivineCandidate que ya reciben
      // prioridad en drops via el IMPACT_EFFECTS boost.
      const _registry = getDynamicEffectRegistry()
      const _entry = _registry.getEntry(scenario.effect.effect)
      if (_entry) {
        const archetype = _entry.archetype
        const aggression = _entry.dna.aggression ?? 0.5
        const isAmbientArchetype = archetype === 'ambient' || archetype === 'utility'
        const isLowAggression = aggression <= 0.60
        if (isAmbientArchetype && isLowAggression) {
          score += 0.15
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1189: PROJECT CASSANDRA - URGENCY SCORING
    // Si el Oráculo dice que algo viene PRONTO (< 2s), hay que actuar YA
    // No hay tiempo para deliberación - el efecto correcto AHORA > perfecto tarde
    // ═══════════════════════════════════════════════════════════════
    
    const isUrgent = prediction.isUrgent ?? false
    // 🛡️ WAVE 2093.1: Guard Infinity — same pattern as Cassandra pre-buffer
    const timeToEvent = (Number.isFinite(prediction.timeToEventMs) && prediction.timeToEventMs! > 0)
      ? prediction.timeToEventMs! : 4000
    const oracleProbability = prediction.oracleProbability ?? 0
    
    if (isUrgent && oracleProbability > 0.5) {
      // 🚨 URGENCIA ALTA: < 2 segundos para el evento
      // 🩸 WAVE 2104: "Cassandra es el copiloto de rally que anticipa curvas, no el piloto"
      // ANTES: Max +0.35 → dominaba el scoring, convertía al Oráculo en dictador
      // AHORA: Max +0.18 → influencia significativa pero no dictatorial
      const urgencyBoost = Math.min(0.18, (2000 - timeToEvent) / 2000 * 0.18)
      score += urgencyBoost
      // 🔇 WAVE 7524: Per-effect urgency log removed — fired 20x per frame (one per candidate).
      // The CASSANDRA prediction log above already shows urgent=true + timeToEvent + prob.
    }
    
    // 🔮 CASSANDRA: Boost adicional si alta probabilidad del Oráculo (> 0.7)
    // 🩸 WAVE 2104: Reducido de 0.2 a 0.10 — apoyo, no dominación
    if (oracleProbability > 0.7) {
      const confidenceBoost = (oracleProbability - 0.7) * 0.10 // Max +0.03 para prob=1.0 (era +0.06)
      score += confidenceBoost
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🧬 GENESIS: NURTURE BIAS / PURGATORY BOOST
    // Newborn mutants (< 5 live trials) get a small scoring boost to give
    // them a fighting chance against optimized consolidated blueprints.
    // Without this, young organisms starve — they never win the DNA
    // Euclidean distance race against battle-tested effects.
    // The boost is small enough to not override DNA matching but enough
    // to break ties in favor of exploration.
    // ═══════════════════════════════════════════════════════════════
    const isNewborn = scenario.trialsCount !== undefined && scenario.trialsCount < 5
    const nurtureBoost = isNewborn ? 0.08 : 0
    score += nurtureBoost
    
    if (nurtureBoost > 0 && this.simulationCount % 10 === 0) {
      console.log(`[DREAM_SIMULATOR] 🧬 NURTURE BIAS: "${effectDisplayName(effectName)}" +${nurtureBoost} (trials: ${scenario.trialsCount})`)
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎨 WAVE 7168: TEXTURE AFFINITY CONTEXTUAL BONUS
    // Soft modifier: +0.08 max match, -0.03 max conflict, 0 for universal.
    // Applied AFTER nurture bias, BEFORE diversity multiplicative penalty
    // so it participates in the final score but never vetoes a candidate.
    // ═══════════════════════════════════════════════════════════════
    const textureBonus = scenario.textureBonus ?? 0
    score += textureBonus

    // ═══════════════════════════════════════════════════════════════
    // 🎲 WAVE 7158: DIVERSITY MULTIPLICATIVE FINAL PENALTY
    // ═══════════════════════════════════════════════════════════════
    // The additive diversityScore * 0.20 term (line ~1476) acts as a small
    // tiebreaker among fresh effects, but cannot prevent a high-DNA candidate
    // used 3× from winning via other boosts (vibe, risk, urgency, impact +0.40).
    // This final multiplier ensures diversity is an ABSOLUTE gate: a shadowbanned
    // effect (diversityScore=0.1) can never score above 0.1×max_possible.
    score *= scenario.diversityScore

    return Math.max(0, Math.min(1, score))
  }
  
  private generateRecommendation(
    bestScenario: EffectScenario | null,
    context: AudienceSafetyContext
  ): { action: 'execute' | 'modify' | 'abort'; reason: string } {
    if (!bestScenario) {
      return {
        action: 'abort',
        reason: 'No viable scenarios found'
      }
    }
    
    // ABORT conditions
    if (bestScenario.riskLevel > 0.7) {
      return {
        action: 'abort',
        reason: `High risk: ${bestScenario.riskLevel.toFixed(3)}`
      }
    }
    
    if (bestScenario.hardwareConflicts.length > 0) {
      return {
        action: 'abort',
        reason: `Hardware conflicts: ${bestScenario.hardwareConflicts.join(', ')}`
      }
    }
    
    // MODIFY conditions
    // 🧬 WAVE 2093 COG-2: projectedBeauty → projectedRelevance (ghost dependency fix)
    // projectedBeauty era una métrica legacy deprecada desde WAVE 970.
    // projectedRelevance es la métrica primaria: distancia euclidiana DNA real.
    //
    // 🩸 WAVE 2095.3: Gate bajado 0.45 → 0.30
    // PROBLEMA: Con drop_incoming, los efectos IMPACT (strobes, aggression=0.85-0.95) 
    // tienen projectedRelevance BAJA (~0.35) porque el target DNA tiene aggression ~0.35
    // a energías medias de Brejcha. El ranking de CASSANDRA ya incorporó el boost de
    // +0.40 para IMPACT_EFFECTS, así que si llegó como bestScenario, GANÓ la competencia.
    // El gate de 0.45 era un second-guess redundante que MATABA todo efecto hard durante drops.
    // 0.30 mantiene protección contra efectos genuinamente irrelevantes sin vetar a los ganadores.
    if (bestScenario.projectedRelevance < 0.30) {
      return {
        action: 'modify',
        reason: `Low relevance: ${bestScenario.projectedRelevance.toFixed(3)} - consider alternatives`
      }
    }
    
    if (bestScenario.cooldownConflicts.length > 0) {
      return {
        action: 'modify',
        reason: `Cooldown conflicts - try alternative`
      }
    }
    
    // EXECUTE
    return {
      action: 'execute',
      reason: `Relevance: ${bestScenario.projectedRelevance.toFixed(3)}, Risk: ${bestScenario.riskLevel.toFixed(3)} - GO!`
    }
  }
  
  private detectWarnings(scenarios: EffectScenario[], context: AudienceSafetyContext): string[] {
    const warnings: string[] = []
    
    // High risk scenarios
    const highRiskScenarios = scenarios.filter(s => s.riskLevel > 0.7)
    if (highRiskScenarios.length > scenarios.length / 2) {
      warnings.push('⚠️ Majority of scenarios are high-risk')
    }
    
    // Low diversity
    const lowDiversityScenarios = scenarios.filter(s => s.diversityScore < 0.3)
    if (lowDiversityScenarios.length > scenarios.length / 2) {
      warnings.push('⚠️ Approaching monotony - diversity low')
    }
    
    // GPU stress
    if (context.gpuLoad > 0.7) {
      warnings.push('⚠️ GPU load high - consider lighter effects')
    }
    
    // Audience fatigue
    if (context.audienceFatigue > 0.7) {
      warnings.push('⚠️ Audience fatigue high - consider rest')
    }
    
    return warnings
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

export const effectDreamSimulator = new EffectDreamSimulator()
