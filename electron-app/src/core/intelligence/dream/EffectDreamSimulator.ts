/**
 * 🔮 EFFECT DREAM SIMULATOR
 * "El Oráculo que ve el futuro de los efectos"
 * 
 * WAVE 900.1 - Phase 1: Foundation
 * WAVE 920.2 - Mood integration (pre-filtering blocked effects)
 * 
 * @module EffectDreamSimulator
 * @description Sistema de simulación predictiva para efectos visuales.
 *              Simula múltiples escenarios de efectos y rankea por belleza proyectada,
 *              riesgo, coherencia de vibe y diversidad.
 * 
 * RESPONSABILIDADES:
 * - Simular escenarios de efectos (no solo color como ScenarioSimulator)
 * - Predecir belleza proyectada de cada efecto
 * - Calcular risk level (GPU load, audience fatiga, cooldowns)
 * - Detectar conflictos de cooldown
 * - Mirar 4 compases adelante (musical prediction)
 * - Rankear escenarios por belleza esperada
 * - 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
 * 
 * FILOSOFÍA:
 * "Soñar antes de actuar. Ver el futuro antes de decidir."
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */

import type { AudienceSafetyContext } from './AudienceSafetyContext'

// 🎭 WAVE 920.2: MOOD INTEGRATION
import { MoodController } from '../../mood/MoodController'

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
}

export interface EffectScenario {
  // 🎯 EFFECT
  effect: EffectCandidate
  
  // 📊 PROJECTED METRICS
  projectedBeauty: number           // 0-1, belleza esperada
  beautyDelta: number               // Cambio vs estado actual
  riskLevel: number                 // 0-1, riesgo del efecto
  
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
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🌀 WAVE 902: VOCABULARY SYNC - Real effect names only
// ═══════════════════════════════════════════════════════════════════════════

// Efectos conocidos agrupados por categoría (SYNCED with EffectManager registry)
// 🎯 WAVE 902.1: TRUTH - Only 2 genres implemented (Latina + Techno)
const EFFECT_CATEGORIES = {
  'techno-industrial': [
    'industrial_strobe',  // ✅ WAVE 780: The hammer
    'acid_sweep',         // ✅ WAVE 780: The blade
    'cyber_dualism'       // ✅ WAVE 810: The twins
  ],
  'latino-organic': [
    'solar_flare',        // ✅ WAVE 600: Takeover
    'strobe_storm',       // ✅ WAVE 680: Harsh (multi-genre, latina compatible)
    'strobe_burst',       // ✅ WAVE 691: Rhythmic latina strobe
    'tidal_wave',         // ✅ WAVE 680: Wave flow
    'ghost_breath',       // ✅ WAVE 680: Soft breathing
    'tropical_pulse',     // ✅ WAVE 692: Conga bursts
    'salsa_fire',         // ✅ WAVE 692: Fire flicker
    'cumbia_moon',        // ✅ WAVE 692: Moon glow
    'clave_rhythm',       // ✅ WAVE 700.6: 3-2 pattern
    'corazon_latino'      // ✅ WAVE 750: Heartbeat passion
  ]
  // 🚧 chill-ambient: NOT IMPLEMENTED YET
  // 🚧 pop-rock: NOT IMPLEMENTED YET
}

// Pesos de belleza por tipo de efecto (WAVE 902.1: TRUTH - Only Latina + Techno)
const EFFECT_BEAUTY_WEIGHTS = {
  // 🔪 TECHNO-INDUSTRIAL (3 effects)
  'industrial_strobe': { base: 0.75, energyMultiplier: 1.2, technoBonus: 0.15 },
  'acid_sweep': { base: 0.78, energyMultiplier: 1.15, technoBonus: 0.13 },
  'cyber_dualism': { base: 0.65, energyMultiplier: 1.0, technoBonus: 0.10 },
  // 🌴 LATINO-ORGANIC (10 effects)
  'solar_flare': { base: 0.85, energyMultiplier: 1.3, latinoBonus: 0.20 },
  'strobe_storm': { base: 0.80, energyMultiplier: 1.25, latinoBonus: 0.18 },
  'strobe_burst': { base: 0.78, energyMultiplier: 1.22, latinoBonus: 0.16 },
  'tidal_wave': { base: 0.72, energyMultiplier: 1.05, latinoBonus: 0.12 },
  'ghost_breath': { base: 0.68, energyMultiplier: 0.95, latinoBonus: 0.10 },
  'tropical_pulse': { base: 0.82, energyMultiplier: 1.25, latinoBonus: 0.17 },
  'salsa_fire': { base: 0.76, energyMultiplier: 1.15, latinoBonus: 0.14 },
  'cumbia_moon': { base: 0.70, energyMultiplier: 1.00, latinoBonus: 0.11 },
  'clave_rhythm': { base: 0.74, energyMultiplier: 1.10, latinoBonus: 0.13 },
  'corazon_latino': { base: 0.90, energyMultiplier: 1.4, latinoBonus: 0.25 }
} as const

// GPU cost por efecto (WAVE 902.1: TRUTH)
const EFFECT_GPU_COST = {
  // 🔪 TECHNO-INDUSTRIAL (Alta intensidad)
  'industrial_strobe': 0.25,
  'acid_sweep': 0.30,
  'cyber_dualism': 0.28,
  // 🌴 LATINO-ORGANIC (Media-Alta intensidad)
  'solar_flare': 0.22,
  'strobe_storm': 0.32,
  'strobe_burst': 0.28,
  'tidal_wave': 0.10,
  'ghost_breath': 0.12,
  'tropical_pulse': 0.20,
  'salsa_fire': 0.18,
  'cumbia_moon': 0.08,
  'clave_rhythm': 0.15,
  'corazon_latino': 0.24
} as const

// Fatigue impact por efecto (WAVE 902.1: TRUTH)
const EFFECT_FATIGUE_IMPACT = {
  // 🔪 TECHNO-INDUSTRIAL (Aumenta fatiga)
  'industrial_strobe': 0.08,
  'acid_sweep': 0.07,
  'cyber_dualism': 0.06,
  // 🌴 LATINO-ORGANIC (Mixto: strobes aumentan, suaves reducen)
  'solar_flare': 0.06,
  'strobe_storm': 0.09,
  'strobe_burst': 0.07,
  'tidal_wave': -0.01,     // Suave, reduce fatiga
  'ghost_breath': -0.02,   // Breathing, reduce fatiga
  'tropical_pulse': 0.04,
  'salsa_fire': 0.03,
  'cumbia_moon': -0.03,    // Moon glow, reduce fatiga
  'clave_rhythm': 0.02,
  'corazon_latino': 0.05
} as const

// ═══════════════════════════════════════════════════════════════
// EFFECT DREAM SIMULATOR
// ═══════════════════════════════════════════════════════════════

export class EffectDreamSimulator {
  private simulationCount: number = 0
  
  constructor() {
    console.log('[DREAM_SIMULATOR] 🔮 Initialized')
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
    
    console.log(`[DREAM_SIMULATOR] 🔮 Dream #${this.simulationCount} - Exploring futures...`)
    
    // 1. Generar candidatos basados en vibe y prediction
    const candidates = this.generateCandidates(currentState, musicalPrediction, context)
    
    console.log(`[DREAM_SIMULATOR] 📊 Generated ${candidates.length} candidates`)
    
    // 2. Simular cada escenario
    const scenarios: EffectScenario[] = []
    for (const candidate of candidates) {
      const scenario = this.simulateScenario(candidate, currentState, context)
      scenarios.push(scenario)
    }
    
    // 3. Rankear escenarios
    const rankedScenarios = this.rankScenarios(scenarios, musicalPrediction)
    
    // 4. Seleccionar mejor escenario
    const bestScenario = rankedScenarios[0] || null
    
    // 5. Generar recomendación
    const recommendation = this.generateRecommendation(bestScenario, context)
    
    // 6. Detectar warnings
    const warnings = this.detectWarnings(rankedScenarios, context)
    
    const simulationTimeMs = Date.now() - startTime
    
    console.log(`[DREAM_SIMULATOR] ✨ Dream complete in ${simulationTimeMs}ms`)
    if (bestScenario) {
      console.log(`[DREAM_SIMULATOR] 🎯 Best: ${bestScenario.effect.effect} (beauty: ${bestScenario.projectedBeauty.toFixed(2)}, risk: ${bestScenario.riskLevel.toFixed(2)})`)
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
    
    return {
      effect,
      projectedBeauty,
      beautyDelta,
      riskLevel,
      projectedConsonance,
      gpuLoadImpact,
      audienceFatigueImpact,
      cooldownConflicts,
      hardwareConflicts,
      vibeCoherence,
      diversityScore,
      simulationConfidence
    }
  }
  
  /**
   * Explora efectos alternativos (similar a hue shifts pero para efectos)
   */
  public exploreAlternatives(
    primaryEffect: EffectCandidate,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    const alternatives: EffectCandidate[] = []
    
    // Encontrar categoría del efecto primario
    let category: string | null = null
    for (const [cat, effects] of Object.entries(EFFECT_CATEGORIES)) {
      if ((effects as string[]).includes(primaryEffect.effect)) {
        category = cat
        break
      }
    }
    
    if (!category) {
      console.warn(`[DREAM_SIMULATOR] ⚠️ Unknown category for ${primaryEffect.effect}`)
      return []
    }
    
    // Generar alternativas de la misma categoría
    const categoryEffects = EFFECT_CATEGORIES[category as keyof typeof EFFECT_CATEGORIES]
    
    for (const effect of categoryEffects) {
      if (effect === primaryEffect.effect) continue
      
      alternatives.push({
        effect,
        intensity: primaryEffect.intensity * 0.9, // Ligeramente menor
        zones: primaryEffect.zones,
        reasoning: `Alternative to ${primaryEffect.effect} (same category)`,
        confidence: primaryEffect.confidence * 0.8
      })
    }
    
    return alternatives
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: CANDIDATE GENERATION
  // ═══════════════════════════════════════════════════════════════
  
  private generateCandidates(
    state: SystemState,
    prediction: MusicalPrediction,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    const candidates: EffectCandidate[] = []
    
    // Determinar qué categoría de efectos explorar basado en vibe
    let categoriesToExplore: string[] = []
    
    if (state.vibe.includes('techno')) {
      categoriesToExplore = ['techno-industrial']
    } else if (state.vibe.includes('latino') || state.vibe.includes('latina')) {
      categoriesToExplore = ['latino-organic']
    } else if (state.vibe.includes('chill')) {
      categoriesToExplore = ['chill-ambient']
    } else {
      // Explorar todas si vibe desconocido
      categoriesToExplore = Object.keys(EFFECT_CATEGORIES)
    }
    
    // Generar candidatos de cada categoría
    // 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
    const moodController = MoodController.getInstance()
    const currentProfile = moodController.getCurrentProfile()
    let blockedCount = 0
    
    for (const category of categoriesToExplore) {
      const effects = EFFECT_CATEGORIES[category as keyof typeof EFFECT_CATEGORIES]
      
      for (const effect of effects) {
        // 🎭 WAVE 920.2: Skip efectos bloqueados por mood (no gastar CPU simulando)
        if (moodController.isEffectBlocked(effect)) {
          blockedCount++
          continue
        }
        
        // Calcular intensidad basada en energía predicha
        const intensity = this.calculateIntensity(prediction.predictedEnergy, effect)
        
        candidates.push({
          effect,
          intensity,
          zones: ['all'], // Simplificado para Phase 1
          reasoning: `Dream exploration: ${category}`,
          confidence: prediction.confidence * 0.9 // Ligeramente menor que prediction
        })
      }
    }
    
    if (blockedCount > 0) {
      console.log(`[DREAM_SIMULATOR] 🎭 Pre-filtered ${blockedCount} effects (blocked by ${currentProfile.emoji} mood)`)
    }
    
    return candidates
  }
  
  private calculateIntensity(predictedEnergy: number, effect: string): number {
    // Intensidad base de la energía predicha
    let intensity = predictedEnergy
    
    // Ajustar por tipo de efecto
    if (effect.includes('strobe') || effect.includes('laser')) {
      // Efectos agresivos usan full energy
      intensity = Math.min(1.0, predictedEnergy * 1.1)
    } else if (effect.includes('wave') || effect.includes('cascade')) {
      // Efectos suaves usan menos energy
      intensity = predictedEnergy * 0.8
    }
    
    return Math.max(0, Math.min(1, intensity))
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: BEAUTY PROJECTION
  // ═══════════════════════════════════════════════════════════════
  
  private projectBeauty(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    const weights = EFFECT_BEAUTY_WEIGHTS[effect.effect as keyof typeof EFFECT_BEAUTY_WEIGHTS]
    
    if (!weights) {
      console.warn(`[DREAM_SIMULATOR] ⚠️ Unknown effect beauty weights: ${effect.effect}`)
      return 0.5 // Neutral
    }
    
    // Base beauty
    let beauty = weights.base
    
    // Energy multiplier
    beauty *= (1 + (context.energy - 0.5) * (weights.energyMultiplier - 1))
    
    // Vibe bonus (WAVE 902.1: Only Techno + Latino implemented)
    if (context.vibe.includes('techno') && 'technoBonus' in weights) {
      beauty += weights.technoBonus
    } else if (context.vibe.includes('latino') && 'latinoBonus' in weights) {
      beauty += weights.latinoBonus
    }
    // Note: chillBonus removed - chill genre not implemented yet
    
    // Intensity factor
    beauty *= (0.7 + 0.3 * effect.intensity)
    
    // Current beauty influence (momentum)
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
    
    // GPU overload risk
    const gpuCost = EFFECT_GPU_COST[effect.effect as keyof typeof EFFECT_GPU_COST] || 0.15
    const projectedGpuLoad = context.gpuLoad + gpuCost * effect.intensity
    
    if (projectedGpuLoad > 0.8) {
      risk += 0.3 // High GPU risk
    } else if (projectedGpuLoad > 0.6) {
      risk += 0.1 // Moderate GPU risk
    }
    
    // Audience fatigue risk
    const fatigueImpact = EFFECT_FATIGUE_IMPACT[effect.effect as keyof typeof EFFECT_FATIGUE_IMPACT] || 0.05
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
    
    // Efectos de misma categoría = moderada consonancia
    for (const effects of Object.values(EFFECT_CATEGORIES)) {
      const effectList = effects as string[]
      if (effectList.includes(effect.effect) && 
          effectList.includes(state.lastEffect)) {
        return 0.7
      }
    }
    
    // Efectos de categoría diferente = baja consonancia (puede ser bueno o malo)
    return 0.4
  }
  
  private calculateGpuImpact(effect: EffectCandidate, context: AudienceSafetyContext): number {
    const gpuCost = EFFECT_GPU_COST[effect.effect as keyof typeof EFFECT_GPU_COST] || 0.15
    return Math.min(1.0, gpuCost * effect.intensity)
  }
  
  private calculateFatigueImpact(effect: EffectCandidate, context: AudienceSafetyContext): number {
    const fatigueImpact = EFFECT_FATIGUE_IMPACT[effect.effect as keyof typeof EFFECT_FATIGUE_IMPACT] || 0.05
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
    
    // GPU overload
    const gpuCost = EFFECT_GPU_COST[effect.effect as keyof typeof EFFECT_GPU_COST] || 0.15
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
    // WAVE 902.1: TRUTH - Only Techno + Latino implemented
    if (context.vibe.includes('techno')) {
      if (['industrial_strobe', 'acid_sweep', 'cyber_dualism'].includes(effect.effect)) {
        return 1.0
      } else if (['solar_flare', 'tropical_pulse', 'salsa_fire', 'corazon_latino'].includes(effect.effect)) {
        return 0.0 // HEREJÍA - Latino en sesión Techno
      }
      return 0.5
    }
    
    // WAVE 902.1: TRUTH - Latino effects (all 10)
    if (context.vibe.includes('latino')) {
      if (['solar_flare', 'strobe_storm', 'strobe_burst', 'tidal_wave', 'ghost_breath', 
           'tropical_pulse', 'salsa_fire', 'cumbia_moon', 'clave_rhythm', 'corazon_latino'].includes(effect.effect)) {
        return 1.0
      }
      return 0.6
    }
    
    return 0.7 // Neutral para vibes desconocidos
  }
  
  private calculateDiversityScore(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // Contar uso reciente
    const recentUsage = context.recentEffects
      .filter(e => e.effect === effect.effect)
      .length
    
    const totalRecent = context.recentEffects.length
    
    if (totalRecent === 0) return 1.0
    
    const usageRate = recentUsage / totalRecent
    
    // Invertir: menos uso = más diversidad
    return Math.max(0, 1 - usageRate * 2) // *2 para penalizar más
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
    
    // Reducir confianza si efecto desconocido
    if (!(effect.effect in EFFECT_BEAUTY_WEIGHTS)) {
      confidence *= 0.5
    }
    
    return confidence
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: RANKING & RECOMMENDATION
  // ═══════════════════════════════════════════════════════════════
  
  private rankScenarios(scenarios: EffectScenario[], prediction: MusicalPrediction): EffectScenario[] {
    // Multi-factor ranking
    return scenarios.sort((a, b) => {
      // Calcular score compuesto
      const scoreA = this.calculateScenarioScore(a, prediction)
      const scoreB = this.calculateScenarioScore(b, prediction)
      
      return scoreB - scoreA // Descending
    })
  }
  
  private calculateScenarioScore(scenario: EffectScenario, prediction: MusicalPrediction): number {
    // Weighted score
    let score = 0
    
    score += scenario.projectedBeauty * 0.35      // Belleza es factor principal
    score += scenario.vibeCoherence * 0.25        // Coherencia de vibe crítica
    score += scenario.diversityScore * 0.15       // Diversidad importante
    score += (1 - scenario.riskLevel) * 0.15      // Bajo riesgo preferido
    score += scenario.simulationConfidence * 0.10 // Confianza en predicción
    
    // Penalizar conflictos
    score -= scenario.cooldownConflicts.length * 0.1
    score -= scenario.hardwareConflicts.length * 0.15
    
    // Boost si viene drop
    if (prediction.isDropComing && scenario.effect.intensity > 0.7) {
      score += 0.1
    }
    
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
        reason: `High risk: ${bestScenario.riskLevel.toFixed(2)}`
      }
    }
    
    if (bestScenario.hardwareConflicts.length > 0) {
      return {
        action: 'abort',
        reason: `Hardware conflicts: ${bestScenario.hardwareConflicts.join(', ')}`
      }
    }
    
    // MODIFY conditions
    if (bestScenario.projectedBeauty < 0.5) {
      return {
        action: 'modify',
        reason: `Low beauty: ${bestScenario.projectedBeauty.toFixed(2)} - consider alternatives`
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
      reason: `Beauty: ${bestScenario.projectedBeauty.toFixed(2)}, Risk: ${bestScenario.riskLevel.toFixed(2)} - GO!`
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
