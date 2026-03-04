/**
 * 🌀 DREAM ENGINE INTEGRATOR
 * "El Tejedor que conecta Oráculo + Juez + Decisor"
 * 
 * WAVE 900.3 - Phase 3: Integration
 * 
 * FLUJO COMPLETO:
 * 1. Hunt genera candidatos (worthiness > threshold)
 * 2. Dream simula futuros (proyecta belleza)
 * 3. Decide selecciona top 3 candidatos
 * 4. Filter (Conscience) evalúa ética
 * 5. Execute dispara efecto aprobado
 * 6. Learn audita outcome
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 * @revision WAVE 900.3.1 - Fixed type casting, cache key, execution tracking
 */

import type { EffectCandidate, EffectDreamResult, SystemState, MusicalPrediction } from '../dream/EffectDreamSimulator'
import { effectDreamSimulator } from '../dream/EffectDreamSimulator'
import type { EthicalVerdict, EffectOutcome } from '../conscience/VisualConscienceEngine'
import { visualConscienceEngine } from '../conscience/VisualConscienceEngine'
import { effectBiasTracker } from '../dream/EffectBiasTracker'
import type { AudienceSafetyContext } from '../dream/AudienceSafetyContext'
import { AudienceSafetyContextBuilder } from '../dream/AudienceSafetyContext'

// 🎭 WAVE 920: MOOD INTEGRATION
import { MoodController } from '../../mood/MoodController'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES - Interfaces de datos para el pipeline
// ═══════════════════════════════════════════════════════════════════════════

export interface PipelineContext {
  pattern: {
    vibe: string
    energy?: number
    tempo?: number
  }
  huntDecision: {
    worthiness: number
    confidence?: number
  }
  crowdSize: number
  epilepsyMode: boolean
  estimatedFatigue: number
  gpuLoad: number
  maxLuminosity: number
  recentEffects: Array<{ effect: string; timestamp: number }>
  
  // 🧠 WAVE 975.5: ZONE UNIFICATION - Source of truth desde SeleneTitanConscious
  energyZone?: string  // 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'
  
  // 🛡️ WAVE 1178: ZONE PROTECTION - Z-Score para bloquear efectos en bajadas
  /** Z-Score de energía (derivada). Z<0 = bajando, Z>0 = subiendo */
  zScore?: number
  
  // 🧠 WAVE 1173: NEURAL LINK - Oracle prediction type for Dreamer scoring
  predictionType?: 'energy_spike' | 'buildup_starting' | 'breakdown_imminent' | 'drop_incoming' | 'energy_drop' | 'none'
  /** Tendencia de energía del Oráculo */
  energyTrend?: 'rising' | 'stable' | 'falling' | 'spike'
  
  // 🔮 WAVE 1190: PROYECTO CASSANDRA - Predicción completa del Oráculo
  /** Probabilidad real de la predicción (0-1) */
  predictionProbability?: number
  /** Tiempo estimado hasta el evento predicho (ms) */
  predictionTimeMs?: number
  /** Razonamiento del Oráculo */
  predictionReasoning?: string
  /** Efectos sugeridos por el Oráculo */
  suggestedEffects?: string[]

  // 🧬 WAVE 2093 COG-3: Spectral Context real desde sensory layer
  /** SpectralContext derivado del FFT real — reemplaza hardcode por vibe */
  spectralContext?: import('../../protocol/MusicalContext').SpectralContext
}

export interface IntegrationDecision {
  approved: boolean
  effect: EffectCandidate | null
  dreamTime: number
  filterTime: number
  totalTime: number
  dreamRecommendation: string
  ethicalVerdict: EthicalVerdict | null
  circuitHealthy: boolean
  fallbackUsed: boolean
  alternatives: EffectCandidate[]
}

export interface ExecutionResult {
  effectId: string | null
  success: boolean
  executionTime: number
  decision: IntegrationDecision
  outcome?: EffectOutcome
}

// ═══════════════════════════════════════════════════════════════════════════
// DREAM ENGINE INTEGRATOR
// ═══════════════════════════════════════════════════════════════════════════

export class DreamEngineIntegrator {
  private dreamCache: Map<string, { result: EffectDreamResult; timestamp: number }> = new Map()
  private dreamCacheTTL: number = 5000
  
  private executionHistory: IntegrationDecision[] = []
  private maxHistorySize: number = 100
  
  // Timeout para dream simulation (evita hangs)
  private dreamTimeoutMs: number = 3000
  
  constructor() {
    // 🔧 WAVE 1003.15: Comentado para reducir spam de logs
    // console.log('[INTEGRATOR] 🌀 Dream Engine Integrator initialized')
  }
  
  /**
   * Ejecuta pipeline COMPLETO: Hunt → Dream → Decide → Filter → Execute
   */
  public async executeFullPipeline(context: PipelineContext): Promise<IntegrationDecision> {
    const pipelineStartTime = Date.now()
    
    // 🎭 WAVE 920: MOOD-AWARE THRESHOLD
    const moodController = MoodController.getInstance()
    const currentProfile = moodController.getCurrentProfile()
    const rawWorthiness = context.huntDecision.worthiness
    const effectiveWorthiness = moodController.applyThreshold(rawWorthiness)
    
    // 🔧 WAVE 1003.15: Comentado para reducir spam de logs
    // console.log(
    //   `[INTEGRATOR] 🎭 Mood: ${currentProfile.emoji} | ` +
    //   `Raw worthiness: ${rawWorthiness.toFixed(2)} → Effective: ${effectiveWorthiness.toFixed(2)}`
    // )
    
    // 🚫 Guard: Si hunt no recomendó disparo (MOOD-AWARE)
    // 🔧 WAVE 973.2: Threshold bajado de 0.65 → 0.60
    // 🔧 WAVE 976.5: Threshold bajado de 0.60 → 0.55
    // Permite que más DNA decisions lleguen al DecisionMaker
    // Matemática con balanced (1.15x):
    //   Raw 0.64 / 1.15 = 0.557 → PASA ✅ (antes fallaba)
    //   Raw 0.70 / 1.15 = 0.609 → PASA ✅
    //   Raw 0.75 / 1.15 = 0.652 → PASA ✅
    // 🩸 WAVE 2100: Gate lowered 0.55 → 0.50
    // At 0.50, only truly unworthy moments (raw < 0.60 in balanced) get blocked.
    if (effectiveWorthiness < 0.50) {  // 🩸 WAVE 2100: was 0.55
      // 🔧 WAVE 1003.15: Comentado para reducir spam de logs
      // console.log(`[INTEGRATOR] 🚫 Worthiness too low after mood adjustment (${currentProfile.name})`)
      return {
        approved: false,
        effect: null,
        dreamTime: 0,
        filterTime: 0,
        totalTime: Date.now() - pipelineStartTime,
        dreamRecommendation: `Hunt worthiness insufficient (${currentProfile.name} mode: ${rawWorthiness.toFixed(2)} → ${effectiveWorthiness.toFixed(2)})`,
        ethicalVerdict: null,
        circuitHealthy: true,
        fallbackUsed: false,
        alternatives: []
      }
    }

    // 🩸 WAVE 2101.3: ENERGY ZONE GATE
    // No ejecutar el pipeline completo en zonas de silencio/valle/ambient.
    // 🩸 WAVE 2101.5: AMBIENT también bloqueado.
    // Drops reales bypasean.
    const energyZone = context.energyZone ?? 'ambient'
    const predTimeMs = context.predictionTimeMs ?? 9999
    const predProb = context.predictionProbability ?? 0
    const predType = context.predictionType ?? 'none'
    const isRealDropImminent = (predType === 'drop_incoming' || predType === 'energy_spike') 
      && predTimeMs < 1500 && predProb > 0.75

    if ((energyZone === 'silence' || energyZone === 'valley' || energyZone === 'ambient') && !isRealDropImminent) {
      return {
        approved: false,
        effect: null,
        dreamTime: 0,
        filterTime: 0,
        totalTime: Date.now() - pipelineStartTime,
        dreamRecommendation: `Zone gate: ${energyZone} without imminent drop`,
        ethicalVerdict: null,
        circuitHealthy: true,
        fallbackUsed: false,
        alternatives: []
      }
    }
    
    // ═════════════════════════════════════════════════════════════════════
    // STEP 2: DREAM (simula futuros)
    // ═════════════════════════════════════════════════════════════════════
    const dreamStartTime = Date.now()
    const dreamResult = await this.dreamEffects(context)
    const dreamTime = Date.now() - dreamStartTime
    
    // Generate candidates
    const candidates = this.generateCandidates(dreamResult)
    
    if (candidates.length === 0) {
      console.warn('[INTEGRATOR] ⚠️ Dream produced no candidates')
      return {
        approved: false,
        effect: null,
        dreamTime,
        filterTime: 0,
        totalTime: Date.now() - pipelineStartTime,
        dreamRecommendation: 'No candidates generated',
        ethicalVerdict: null,
        circuitHealthy: true,
        fallbackUsed: true,
        alternatives: []
      }
    }
    
    // ═════════════════════════════════════════════════════════════════════
    // STEP 3: FILTER (Conscience evalúa ética)
    // ═════════════════════════════════════════════════════════════════════
    const filterStartTime = Date.now()
    const safetyContext = this.buildAudienceSafetyContext(context)
    const ethicalVerdict = await visualConscienceEngine.evaluate(
      candidates,
      safetyContext
    )
    const filterTime = Date.now() - filterStartTime
    
    // ═════════════════════════════════════════════════════════════════════
    // STEP 4: DECIDE (APPROVED/REJECTED/DEFERRED)
    // ═════════════════════════════════════════════════════════════════════
    
    // 🎭 WAVE 920: Apply mood intensity modifier to approved effect
    let moodAdjustedEffect = ethicalVerdict.approvedEffect
    if (moodAdjustedEffect) {
      const rawIntensity = moodAdjustedEffect.intensity
      const adjustedIntensity = moodController.applyIntensity(rawIntensity)
      
      if (rawIntensity !== adjustedIntensity) {
        console.log(
          `[INTEGRATOR] 🎭 Intensity adjusted: ${rawIntensity.toFixed(2)} → ${adjustedIntensity.toFixed(2)} (${currentProfile.emoji})`
        )
        // Clone effect with adjusted intensity
        moodAdjustedEffect = {
          ...moodAdjustedEffect,
          intensity: adjustedIntensity
        }
      }
    }
    
    const decision: IntegrationDecision = {
      approved: ethicalVerdict.verdict === 'APPROVED',
      effect: moodAdjustedEffect,
      dreamTime,
      filterTime,
      totalTime: Date.now() - pipelineStartTime,
      dreamRecommendation: dreamResult.recommendation,
      ethicalVerdict,
      circuitHealthy: ethicalVerdict.circuitBreakerStatus !== 'OPEN',
      fallbackUsed: ethicalVerdict.verdict !== 'APPROVED' || ethicalVerdict.approvedEffect === null,
      alternatives: ethicalVerdict.alternatives.slice(0, 2)
    }
    
    // � WAVE 2102: MINIMUM INTENSITY GATE — log approvals and reject weak intensities
    if (decision.approved && decision.effect) {
      if (decision.effect.intensity < 0.30) {
        console.log(
          `[INTEGRATOR] 🔇 LOW INTENSITY BLOCKED: ${decision.effect.effect} @ ${decision.effect.intensity.toFixed(2)} (min=0.30)`
        )
        return {
          ...decision,
          approved: false,
          dreamRecommendation: `Intensity gate: ${decision.effect.intensity.toFixed(2)} < 0.30 minimum`,
        }
      }
      console.log(
        `[INTEGRATOR] ✅ APPROVED: ${decision.effect.effect} @ ${decision.effect.intensity.toFixed(2)} | ` +
        `ethics=${decision.ethicalVerdict?.ethicalScore?.toFixed(3) ?? '?'} | ` +
        `Dream: ${dreamTime}ms | Total: ${decision.totalTime}ms`
      )
    } else if (decision.totalTime > 10 || !decision.approved) {
      console.log(
        `[INTEGRATOR] 📊 Pipeline: ${decision.approved ? '✅ APPROVED' : '❌ REJECTED'} | ` +
        `Dream: ${dreamTime}ms | Filter: ${filterTime}ms | Total: ${decision.totalTime}ms | ` +
        `reason=${decision.dreamRecommendation?.substring(0, 60) ?? '?'}`
      )
    }

    // Record for learning
    if (decision.approved && decision.effect) {
      effectBiasTracker.recordEffect({
        effect: decision.effect.effect,
        timestamp: Date.now(),
        intensity: decision.effect.intensity,
        zones: decision.effect.zones ?? ['all'],
        success: true,
        vibe: context.pattern.vibe
      })
    }
    
    // Track decision in history
    this.recordDecision(decision)
    
    return decision
  }
  
  /**
   * Post-execution audit
   */
  public async auditExecution(
    decision: IntegrationDecision,
    outcome: EffectOutcome
  ): Promise<void> {
    if (!decision.ethicalVerdict || !decision.effect) return
    
    const audit = visualConscienceEngine.audit(
      {
        effect: decision.effect,
        timestamp: Date.now(),
        verdict: decision.approved ? 'APPROVED' : 'REJECTED',
        ethicalScore: decision.ethicalVerdict.ethicalScore
      },
      outcome
    )
    
    if (!audit.passes) {
      console.warn('[INTEGRATOR] 🔍 Audit failed:', audit.violations.map(v => v.description))
    }
    
    // Evolve maturity
    const maturityUpdate = visualConscienceEngine.evolveMaturity(
      {
        effect: decision.effect,
        timestamp: Date.now(),
        verdict: decision.approved ? 'APPROVED' : 'REJECTED',
        ethicalScore: decision.ethicalVerdict.ethicalScore
      },
      outcome
    )
    
    if (maturityUpdate.unlockedFeatures.length > 0) {
      console.log(`[INTEGRATOR] 🧠 Maturity evolved: ${maturityUpdate.evolutionReason}`)
      console.log(`[INTEGRATOR] 🔓 Unlocked: ${maturityUpdate.unlockedFeatures.join(', ')}`)
    }
  }
  
  /**
   * Get health status
   */
  public getHealthStatus() {
    const circuitStatus = visualConscienceEngine.checkCircuitHealth()
    const maturityMetrics = visualConscienceEngine.getMaturityMetrics()

    return {
      circuitBreakerState: circuitStatus.state,
      evolutionLevel: maturityMetrics?.level ?? 1,
      cacheSize: this.dreamCache.size
    }
  }

  /**
   * ⚡ WAVE 2093.2: Invalidar Dream cache
   * Se llama cuando un efecto se disparó con éxito para forzar alternativas
   */
  public invalidateDreamCache(): void {
    this.dreamCache.clear()
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE: DREAM EXECUTION
  // ═════════════════════════════════════════════════════════════════════════
  
  private async dreamEffects(context: PipelineContext): Promise<EffectDreamResult> {
    const cacheKey = this.getDreamCacheKey(context)
    
    // Check cache
    const cached = this.dreamCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.dreamCacheTTL) {
      // 🧹 WAVE 1015: Silenciado - spam innecesario
      return cached.result
    }
    
    // Run dream simulation with timeout protection
    try {
      // Build proper SystemState
      const systemState: SystemState = {
        currentPalette: { primary: 0, secondary: 0.33, accent: 0.66 }, // Default neutral
        currentBeauty: context.huntDecision.confidence ?? 0.5,
        lastEffect: null,
        lastEffectTime: 0,
        activeCooldowns: new Map(),
        energy: context.pattern.energy ?? 0.5,
        tempo: context.pattern.tempo ?? 120,
        vibe: context.pattern.vibe
      }
      
      // Build proper MusicalPrediction
      // 🧠 WAVE 1173: NEURAL LINK - Pass Oracle prediction to Dreamer
      // 🔮 WAVE 1190: PROYECTO CASSANDRA - Usar predicción REAL del Oráculo
      const energy = context.pattern.energy ?? 0.5
      const predictionType = context.predictionType ?? 'none'
      const energyTrend = context.energyTrend ?? 'stable'
      
      // 🔮 CASSANDRA: Usar probabilidad REAL, no hardcodeada
      const realProbability = context.predictionProbability ?? 0
      const hasStrongPrediction = realProbability > 0.5
      
      // Derive drop/breakdown flags from prediction type
      const isDropComing = predictionType === 'drop_incoming' || 
                           predictionType === 'energy_spike' ||
                           (energy > 0.8 && energyTrend === 'rising')
      const isBreakdownComing = predictionType === 'breakdown_imminent' ||
                                 predictionType === 'energy_drop' ||
                                 (energy < 0.3 && energyTrend === 'falling')
      
      // 🔮 CASSANDRA: Calcular tiempo de anticipación para el Dreamer
      // Si el Oráculo predice algo en <2s, el Dreamer tiene que actuar YA
      const timeToEvent = context.predictionTimeMs ?? 8000
      const isUrgent = timeToEvent < 2000 && hasStrongPrediction
      
      const musicalPrediction: MusicalPrediction = {
        predictedEnergy: energy,
        predictedSection: this.deriveSectionFromPrediction(predictionType, energy),
        predictedTempo: context.pattern.tempo ?? 120,
        // 🔮 CASSANDRA: Usar probabilidad REAL del Oráculo
        confidence: hasStrongPrediction ? realProbability : (predictionType !== 'none' ? 0.5 : 0.3),
        isDropComing,
        isBreakdownComing,
        energyTrend: energyTrend === 'spike' ? 'rising' : energyTrend as 'rising' | 'stable' | 'falling',
        // 🧠 WAVE 1173: Pass raw prediction type to Dreamer
        predictionType,
        // 🔮 CASSANDRA: Nuevos campos para anticipación inteligente
        timeToEventMs: timeToEvent,
        isUrgent,
        oracleProbability: realProbability,  // 🔮 Probabilidad cruda del Oráculo para scoring
        suggestedEffects: context.suggestedEffects ?? [],
        oracleReasoning: context.predictionReasoning ?? null,
      }
      
      // Execute with timeout
      const dreamPromise = effectDreamSimulator.dreamEffects(
        systemState,
        musicalPrediction,
        this.buildAudienceSafetyContext(context)
      )
      
      // Timeout wrapper
      const result = await Promise.race([
        dreamPromise,
        new Promise<EffectDreamResult>((_, reject) => 
          setTimeout(() => reject(new Error('Dream timeout')), this.dreamTimeoutMs)
        )
      ])
      
      // Cache result
      this.dreamCache.set(cacheKey, { result, timestamp: Date.now() })
      
      return result
    } catch (error) {
      console.error('[INTEGRATOR] ❌ Dream simulation error:', error)
      
      // Fallback: empty but valid result
      return {
        scenarios: [],
        bestScenario: null,
        recommendation: 'abort',
        reason: `Dream simulation failed: ${error}`,
        warnings: ['Dream engine error - using fallback'],
        simulationTimeMs: 0
      }
    }
  }
  
  private generateCandidates(dreamResult: EffectDreamResult): EffectCandidate[] {
    const candidates: EffectCandidate[] = []
    const moodController = MoodController.getInstance()
    const profile = moodController.getCurrentProfile()
    
    // 🎭 WAVE 920: Helper para filtrar por blockList
    const isBlocked = (effectId: string): boolean => {
      if (moodController.isEffectBlocked(effectId)) {
        console.log(`[INTEGRATOR] 🚫 Effect "${effectId}" blocked by ${profile.emoji} mood`)
        return true
      }
      return false
    }
    
    if (dreamResult.bestScenario && !isBlocked(dreamResult.bestScenario.effect.effect)) {
      candidates.push(dreamResult.bestScenario.effect)
    }
    
    for (const scenario of dreamResult.scenarios.slice(0, 3)) {
      // Skip si es el best scenario ya añadido O si está bloqueado
      if (scenario.effect === dreamResult.bestScenario?.effect) continue
      if (isBlocked(scenario.effect.effect)) continue
      
      candidates.push(scenario.effect)
    }
    
    return candidates.slice(0, 5)
  }
  
  private buildAudienceSafetyContext(context: PipelineContext): AudienceSafetyContext {
    const builder = new AudienceSafetyContextBuilder()
      .withVibe(context.pattern.vibe)
      .withEnergy(context.pattern.energy ?? 0.5)
      .withCrowdSize(context.crowdSize)
      .withGpuLoad(context.gpuLoad)
    
    // 🧠 WAVE 975.5: ZONE UNIFICATION - Inyectar zona desde SeleneTitanConscious
    if (context.energyZone) {
      builder.withEnergyZone(context.energyZone)
    }
    
    // 🛡️ WAVE 1178: ZONE PROTECTION - Inyectar Z-Score para bloquear disparos en bajadas
    if (context.zScore !== undefined) {
      builder.withZScore(context.zScore)
    }
    
    // Add epilepsy mode if enabled
    if (context.epilepsyMode) {
      builder.withEpilepsyMode(true)
    }

    // 🧬 WAVE 2093 COG-3: Spectral Context
    if (context.spectralContext) {
      builder.withSpectral(context.spectralContext)
    }
    
    // 🔥 WAVE 996.8: CABLEAR EL HISTORIAL AL DREAMSIMULATOR
    // El Diversity Engine NECESITA el historial de efectos recientes para penalizar repeticiones
    // Sin esto, recentEffects siempre era [] y cyber_dualism ganaba TODO
    if (context.recentEffects && context.recentEffects.length > 0) {
      // Convertir al formato que espera el builder (EffectHistoryEntry[])
      const effectHistoryEntries = context.recentEffects.map(e => ({
        effect: e.effect,
        timestamp: e.timestamp,
        energy: 0.7,        // Default razonable
        intensity: 0.7,     // Default razonable  
        duration: 2000,     // Default 2s
        zones: ['all'],     // Default zones
        success: true,      // Asumimos que se ejecutó
        vibe: context.pattern.vibe  // Vibe actual del contexto
      }))
      builder.withRecentEffects(effectHistoryEntries)
      // 🧹 WAVE 1015: Silenciado - spam innecesario
    }
    
    return builder.build()
  }
  
  // ═════════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 1173: NEURAL LINK - Helper methods
  // ═════════════════════════════════════════════════════════════════════════
  
  /**
   * Deriva la sección musical esperada del tipo de predicción del Oráculo
   */
  private deriveSectionFromPrediction(
    predictionType: string,
    energy: number
  ): string {
    switch (predictionType) {
      case 'energy_spike':
      case 'drop_incoming':
        return 'drop'
      case 'buildup_starting':
        return 'buildup'
      case 'breakdown_imminent':
      case 'energy_drop':
        return 'breakdown'
      default:
        // Fallback basado en energía
        if (energy > 0.8) return 'drop'
        if (energy > 0.6) return 'chorus'
        if (energy < 0.3) return 'breakdown'
        return 'verse'
    }
  }
  
  private getDreamCacheKey(context: PipelineContext): string {
    // Cache key incluye factores que afectan decisión ética
    // NO cachear si epilepsyMode diferente (cambia completamente los resultados)
    // 🔥 WAVE 996.5: INCLUIR recentEffects para que Diversity Engine funcione correctamente
    const energy = Math.round((context.pattern.energy ?? 0.5) * 10)
    const worthiness = context.huntDecision.worthiness.toFixed(1)
    const gpuBucket = Math.round(context.gpuLoad * 5) // 0, 0.2, 0.4, 0.6, 0.8, 1.0
    const epilepsy = context.epilepsyMode ? '1' : '0'
    // 🎯 WAVE 996.5: Hash de efectos recientes para invalidar cache cuando cambia el historial
    const recentEffectsHash = context.recentEffects
      .map(e => e.effect)
      .join(',')
    return `${context.pattern.vibe}:e${energy}:w${worthiness}:g${gpuBucket}:ep${epilepsy}:h${recentEffectsHash}`
  }
  
  private recordDecision(decision: IntegrationDecision): void {
    this.executionHistory.push(decision)
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift()
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═════════════════════════════════════════════════════════════════════════

export const dreamEngineIntegrator = new DreamEngineIntegrator()
