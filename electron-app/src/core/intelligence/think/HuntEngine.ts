// ═══════════════════════════════════════════════════════════════════════════
//  🐆 HUNT ENGINE - El Instinto del Cazador
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  "Stalking + Evaluating + Striking - Unificado y Nativo"
// ═══════════════════════════════════════════════════════════════════════════

import type { SeleneMusicalPattern, SectionClassification, HuntPhase } from '../types'
import type { BeautyAnalysis } from '../sense/BeautySensor'
import type { ConsonanceAnalysis } from '../sense/ConsonanceSensor'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS INTERNOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Candidato de caza - un momento/estado que vale la pena "atacar"
 */
export interface HuntCandidate {
  /** ID único para tracking */
  id: string
  
  /** Cuándo se detectó por primera vez */
  firstSpottedAt: number
  
  /** Cuántos frames llevamos observándolo */
  framesObserved: number
  
  /** Score de "caza-worthiness" (0-1) */
  worthiness: number
  
  /** Tendencia del worthiness */
  worthinessTrend: 'rising' | 'stable' | 'falling'
  
  /** Razón por la que es interesante */
  reason: string
}

/**
 * Condiciones de strike evaluadas
 */
export interface StrikeConditions {
  /** Belleza suficiente */
  beautyMet: boolean
  beautyScore: number
  
  /** Consonancia suficiente */
  consonanceMet: boolean
  consonanceScore: number
  
  /** Tendencia favorable */
  trendMet: boolean
  trend: 'rising' | 'stable' | 'falling'
  
  /** Urgencia del momento */
  urgencyMet: boolean
  urgencyScore: number
  
  /** Todas las condiciones */
  allMet: boolean
  
  /** Score combinado (0-1) */
  strikeScore: number
  
  /** Razón de la evaluación */
  reasoning: string
}

/**
 * Resultado del hunt engine
 */
export interface HuntDecision {
  /** Nueva fase sugerida */
  suggestedPhase: HuntPhase
  
  /** Si deberíamos hacer strike ahora */
  shouldStrike: boolean
  
  /** Confianza en la decisión (0-1) */
  confidence: number
  
  /** Condiciones evaluadas (si en evaluating/striking) */
  conditions: StrikeConditions | null
  
  /** Candidato actual (si hay) */
  activeCandidate: HuntCandidate | null
  
  /** Razón de la decisión */
  reasoning: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

interface HuntConfig {
  /** Mínimos frames en stalking antes de poder evaluar */
  minStalkingFrames: number
  
  /** Máximos frames en stalking antes de forzar decisión */
  maxStalkingFrames: number
  
  /** Umbral de belleza para considerar strike */
  beautyThreshold: number
  
  /** Umbral de consonancia para considerar strike */
  consonanceThreshold: number
  
  /** Umbral de urgencia para forzar strike */
  urgencyForceThreshold: number
  
  /** Frames máximos en evaluating antes de abortar */
  maxEvaluatingFrames: number
  
  /** Frames de cooldown después de strike (learning) */
  learningCooldownFrames: number
}

const DEFAULT_CONFIG: HuntConfig = {
  minStalkingFrames: 5,
  maxStalkingFrames: 60, // ~1 segundo a 60fps
  beautyThreshold: 0.65,
  consonanceThreshold: 0.60,
  urgencyForceThreshold: 0.90,
  maxEvaluatingFrames: 15,
  learningCooldownFrames: 120,  // 🔥 WAVE 635: 2 segundos de cooldown (era 10 = 166ms)
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO INTERNO
// ═══════════════════════════════════════════════════════════════════════════

interface HuntState {
  phase: HuntPhase
  framesInPhase: number
  activeCandidate: HuntCandidate | null
  lastStrikeTimestamp: number
  strikesThisSession: number
  worthinessHistory: number[]
}

let state: HuntState = createInitialState()

function createInitialState(): HuntState {
  return {
    phase: 'sleeping',
    framesInPhase: 0,
    activeCandidate: null,
    lastStrikeTimestamp: 0,
    strikesThisSession: 0,
    worthinessHistory: [],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Procesa el estado actual y decide qué hacer
 * 
 * @param pattern - Patrón musical actual
 * @param beauty - Análisis de belleza
 * @param consonance - Análisis de consonancia
 * @param config - Configuración opcional
 * @returns Decisión de caza
 */
export function processHunt(
  pattern: SeleneMusicalPattern,
  beauty: BeautyAnalysis,
  consonance: ConsonanceAnalysis,
  config: Partial<HuntConfig> = {}
): HuntDecision {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  state.framesInPhase++
  
  // Calcular worthiness actual
  const worthiness = calculateWorthiness(pattern, beauty, consonance)
  updateWorthinessHistory(worthiness)
  
  // Decisión basada en fase actual
  switch (state.phase) {
    case 'sleeping':
      return processSleeping(pattern, worthiness, cfg)
    
    case 'stalking':
      return processStalking(pattern, beauty, consonance, worthiness, cfg)
    
    case 'evaluating':
      return processEvaluating(pattern, beauty, consonance, worthiness, cfg)
    
    case 'striking':
      return processStriking(pattern, cfg)
    
    case 'learning':
      return processLearning(pattern, cfg)
    
    default:
      return processSleeping(pattern, worthiness, cfg)
  }
}

/**
 * Fuerza transición de fase (para control externo)
 */
export function forcePhaseTransition(newPhase: HuntPhase): void {
  state.phase = newPhase
  state.framesInPhase = 0
  
  if (newPhase === 'sleeping') {
    state.activeCandidate = null
  }
}

/**
 * Obtiene estado actual (para debug)
 */
export function getHuntState(): Readonly<HuntState> {
  return { ...state }
}

/**
 * Resetea el hunt engine
 */
export function resetHuntEngine(): void {
  state = createInitialState()
}

/**
 * Obtiene estadísticas de la sesión
 */
export function getHuntStats(): { strikes: number; lastStrike: number } {
  return {
    strikes: state.strikesThisSession,
    lastStrike: state.lastStrikeTimestamp,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESADORES POR FASE
// ═══════════════════════════════════════════════════════════════════════════

function processSleeping(
  pattern: SeleneMusicalPattern,
  worthiness: number,
  cfg: HuntConfig
): HuntDecision {
  // Despertar si hay algo interesante
  const shouldWake = worthiness > 0.35 || 
                     pattern.isBuilding || 
                     pattern.section === 'buildup'
  
  if (shouldWake) {
    transitionTo('stalking')
    state.activeCandidate = createCandidate(worthiness, 'Actividad interesante detectada')
    
    return {
      suggestedPhase: 'stalking',
      shouldStrike: false,
      confidence: 0.4,
      conditions: null,
      activeCandidate: state.activeCandidate,
      reasoning: `Despertando: worthiness=${worthiness.toFixed(2)}`,
    }
  }
  
  return {
    suggestedPhase: 'sleeping',
    shouldStrike: false,
    confidence: 0.2,
    conditions: null,
    activeCandidate: null,
    reasoning: 'Durmiendo - nada interesante',
  }
}

function processStalking(
  pattern: SeleneMusicalPattern,
  beauty: BeautyAnalysis,
  consonance: ConsonanceAnalysis,
  worthiness: number,
  cfg: HuntConfig
): HuntDecision {
  // Actualizar candidato
  if (state.activeCandidate) {
    state.activeCandidate.framesObserved++
    state.activeCandidate.worthiness = worthiness
    state.activeCandidate.worthinessTrend = calculateTrend()
  }
  
  // ¿Suficientes frames para evaluar?
  if (state.framesInPhase >= cfg.minStalkingFrames) {
    // ¿Vale la pena evaluar?
    if (worthiness > cfg.beautyThreshold * 0.8) {
      transitionTo('evaluating')
      
      return {
        suggestedPhase: 'evaluating',
        shouldStrike: false,
        confidence: 0.5,
        conditions: null,
        activeCandidate: state.activeCandidate,
        reasoning: `Promoviendo a evaluating después de ${state.framesInPhase} frames`,
      }
    }
  }
  
  // ¿Demasiado tiempo sin encontrar nada bueno?
  if (state.framesInPhase > cfg.maxStalkingFrames && worthiness < 0.3) {
    transitionTo('sleeping')
    
    return {
      suggestedPhase: 'sleeping',
      shouldStrike: false,
      confidence: 0.3,
      conditions: null,
      activeCandidate: null,
      reasoning: 'Volviendo a dormir - nada prometedor',
    }
  }
  
  return {
    suggestedPhase: 'stalking',
    shouldStrike: false,
    confidence: 0.4,
    conditions: null,
    activeCandidate: state.activeCandidate,
    reasoning: `Stalking frame ${state.framesInPhase}, worthiness=${worthiness.toFixed(2)}`,
  }
}

function processEvaluating(
  pattern: SeleneMusicalPattern,
  beauty: BeautyAnalysis,
  consonance: ConsonanceAnalysis,
  worthiness: number,
  cfg: HuntConfig
): HuntDecision {
  // Evaluar condiciones de strike
  const conditions = evaluateStrikeConditions(pattern, beauty, consonance, cfg)
  
  // ¿Strike perfecto? (WAVE 625: Weighted score >= threshold)
  if (conditions.allMet) {
    transitionTo('striking')
    
    // 🧨 WAVE 630: THE WHY LOG - Log explícito con breakdown
    const weights = getVibeWeights(pattern.vibeId)
    console.log(`[SOLAR FLARE] 🚀 FIRED! Score: ${conditions.strikeScore.toFixed(2)} (Threshold: ${weights.threshold.toFixed(2)}) | Breakdown: Urgency(${conditions.urgencyScore.toFixed(2)})*${weights.urgencyWeight} + Beauty(${conditions.beautyScore.toFixed(2)})*${weights.beautyWeight} + Consonance(${conditions.consonanceScore.toFixed(2)})*${weights.consonanceWeight} | Vibe: ${pattern.vibeId}`)
    
    return {
      suggestedPhase: 'striking',
      shouldStrike: true,
      confidence: conditions.strikeScore,
      conditions,
      activeCandidate: state.activeCandidate,
      reasoning: conditions.reasoning,  // WAVE 625: Usar reasoning detallado
    }
  }
  
  // ¿Urgencia fuerza strike?
  if (conditions.urgencyScore > cfg.urgencyForceThreshold && conditions.beautyMet) {
    transitionTo('striking')
    
    // 🧨 WAVE 630: THE WHY LOG para FORCED STRIKE
    console.log(`[SOLAR FLARE] 🚀 FORCED FIRE! Urgency=${conditions.urgencyScore.toFixed(2)} (Threshold: ${cfg.urgencyForceThreshold}) | Beauty=${conditions.beautyScore.toFixed(2)} | Vibe: ${pattern.vibeId}`)
    
    return {
      suggestedPhase: 'striking',
      shouldStrike: true,
      confidence: conditions.strikeScore * 0.9, // Penalizar por forzar
      conditions,
      activeCandidate: state.activeCandidate,
      reasoning: `FORCED STRIKE por urgencia=${conditions.urgencyScore.toFixed(2)}`,
    }
  }
  
  // ¿Demasiado tiempo evaluando?
  if (state.framesInPhase > cfg.maxEvaluatingFrames) {
    // Abortar - volver a stalking
    transitionTo('stalking')
    
    return {
      suggestedPhase: 'stalking',
      shouldStrike: false,
      confidence: 0.3,
      conditions,
      activeCandidate: state.activeCandidate,
      reasoning: 'Timeout en evaluating - volviendo a stalking',
    }
  }
  
  // ¿Condiciones empeorando?
  if (conditions.trend === 'falling' && conditions.strikeScore < 0.5) {
    transitionTo('stalking')
    
    return {
      suggestedPhase: 'stalking',
      shouldStrike: false,
      confidence: 0.3,
      conditions,
      activeCandidate: state.activeCandidate,
      reasoning: 'Condiciones empeorando - abortar evaluación',
    }
  }
  
  // 🕵️ WAVE 610: NEAR MISS LOGGING - El Chivato
  // 🎯 WAVE 625: Updated para mostrar weighted score vs threshold
  if (conditions.strikeScore > 0.4) {
    const weights = getVibeWeights(pattern.vibeId)
    
    if (!conditions.allMet) {
      const delta = (weights.threshold - conditions.strikeScore).toFixed(2)
      console.log(`[HUNT 🕵️] NEAR MISS: ${conditions.reasoning}`)
    }
  }
  
  return {
    suggestedPhase: 'evaluating',
    shouldStrike: false,
    confidence: 0.5,
    conditions,
    activeCandidate: state.activeCandidate,
    reasoning: `Evaluando: score=${conditions.strikeScore.toFixed(2)}, waiting...`,
  }
}

function processStriking(
  _pattern: SeleneMusicalPattern,
  _cfg: HuntConfig
): HuntDecision {
  // El strike se ejecutó - transicionar a learning
  state.strikesThisSession++
  state.lastStrikeTimestamp = Date.now()
  
  transitionTo('learning')
  
  return {
    suggestedPhase: 'learning',
    shouldStrike: false, // Ya se hizo
    confidence: 0.8,
    conditions: null,
    activeCandidate: state.activeCandidate,
    reasoning: `Strike #${state.strikesThisSession} ejecutado`,
  }
}

function processLearning(
  _pattern: SeleneMusicalPattern,
  cfg: HuntConfig
): HuntDecision {
  // Cooldown después de strike
  if (state.framesInPhase >= cfg.learningCooldownFrames) {
    transitionTo('stalking')
    
    return {
      suggestedPhase: 'stalking',
      shouldStrike: false,
      confidence: 0.4,
      conditions: null,
      activeCandidate: null, // Reset candidato
      reasoning: 'Cooldown completado - volviendo a stalking',
    }
  }
  
  return {
    suggestedPhase: 'learning',
    shouldStrike: false,
    confidence: 0.3,
    conditions: null,
    activeCandidate: state.activeCandidate,
    reasoning: `Learning cooldown: ${state.framesInPhase}/${cfg.learningCooldownFrames}`,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function transitionTo(newPhase: HuntPhase): void {
  state.phase = newPhase
  state.framesInPhase = 0
  
  if (newPhase === 'sleeping' || newPhase === 'learning') {
    state.activeCandidate = null
    state.worthinessHistory = []
  }
}

function createCandidate(worthiness: number, reason: string): HuntCandidate {
  return {
    id: `hunt_${Date.now()}`,
    firstSpottedAt: Date.now(),
    framesObserved: 1,
    worthiness,
    worthinessTrend: 'stable',
    reason,
  }
}

function calculateWorthiness(
  pattern: SeleneMusicalPattern,
  beauty: BeautyAnalysis,
  consonance: ConsonanceAnalysis
): number {
  // Combinar métricas para "worthiness" de caza
  
  const beautyScore = beauty.totalBeauty
  const consonanceScore = consonance.totalConsonance
  const tensionScore = pattern.emotionalTension
  const rhythmScore = pattern.rhythmicIntensity
  
  // Bonus por momentos especiales
  let bonus = 0
  
  // Buildup = muy interesante
  if (pattern.section === 'buildup' || pattern.isBuilding) {
    bonus += 0.15
  }
  
  // Chorus = interesante
  if (pattern.section === 'chorus') {
    bonus += 0.10
  }
  
  // Alta tensión = interesante
  if (tensionScore > 0.7) {
    bonus += 0.10
  }
  
  // Tendencia de belleza subiendo = muy interesante
  if (beauty.trend === 'rising') {
    bonus += 0.10
  }
  
  // Combinar (ponderado)
  const base = 
    beautyScore * 0.35 +
    consonanceScore * 0.25 +
    tensionScore * 0.20 +
    rhythmScore * 0.20
  
  return Math.min(1, Math.max(0, base + bonus))
}

function updateWorthinessHistory(worthiness: number): void {
  state.worthinessHistory.push(worthiness)
  if (state.worthinessHistory.length > 15) {
    state.worthinessHistory.shift()
  }
}

function calculateTrend(): 'rising' | 'stable' | 'falling' {
  if (state.worthinessHistory.length < 3) return 'stable'
  
  const recent = state.worthinessHistory.slice(-5)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const delta = last - first
  
  if (delta > 0.05) return 'rising'
  if (delta < -0.05) return 'falling'
  return 'stable'
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 625: DYNAMIC STRIKE MATRIX - Matriz por Vibe
// ═══════════════════════════════════════════════════════════════════════════

interface VibeStrikeWeights {
  /** Peso de belleza armónica (0-1) */
  beautyWeight: number
  
  /** Peso de urgencia rítmica (0-1) */
  urgencyWeight: number
  
  /** Peso de consonancia (0-1) */
  consonanceWeight: number
  
  /** Umbral de strikeScore necesario (0-1) */
  threshold: number
  
  /** Boost de urgencia base para géneros rhythm-driven */
  urgencyBoost: number
}

/**
 * WAVE 625: MATRIZ DINÁMICA DE STRIKES POR VIBE
 * WAVE 635: SNIPER CALIBRATION - Rebalance de pesos y thresholds
 * WAVE 640: SWEET SPOT UNLOCK - Thresholds más accesibles para música real
 * 
 * LOS 4 VIBES REALES DE LUXSYNC:
 * - FIESTA-LATINA: Reggaeton/Cumbia → Ritmo es rey, armonía simple
 * - TECHNO-CLUB: Techno/House → Urgencia hipnótica, poca variación armónica
 * - POP-ROCK: Pop/Rock → Balance armonía + energía
 * - CHILL-LOUNGE: Ambient/Lounge → Belleza armónica > Urgencia
 * 
 * WAVE 635 CHANGES:
 * - Consonance: 20% → 10% (dejó de regalar puntos)
 * - Beauty: Variable según vibe (20-70%)
 * - Urgency: Variable según vibe (10-60%)
 * - Thresholds: Subidos para evitar falsos positivos (podcasts)
 * 
 * WAVE 640 CHANGES:
 * - fiesta-latina threshold: 0.70 → 0.65 (aceptar near-miss drops)
 * - techno-club threshold: 0.70 → 0.65 (loops repetitivos necesitan umbral bajo)
 * - Pesos: Sin cambios (funcionan bien)
 */
const VIBE_STRIKE_MATRIX: Record<string, VibeStrikeWeights> = {
  // 🎉 FIESTA-LATINA: Rhythm-driven, armonía simple
  'fiesta-latina': {
    beautyWeight: 0.3,      // WAVE 635: Subido de 0.2 a 0.3
    urgencyWeight: 0.6,     // Ritmo sigue siendo rey
    consonanceWeight: 0.1,  // WAVE 635: Bajado de 0.2 a 0.1
    threshold: 0.65,        // WAVE 640: Bajado de 0.70 a 0.65 (sweet spot para cumbia)
    urgencyBoost: 0.1       // WAVE 635: Bajado de 0.2 a 0.1 (más sutil)
  },
  
  // 🔊 TECHNO-CLUB: Hypnotic urgency, minimal harmony
  'techno-club': {
    beautyWeight: 0.2,      // WAVE 635: Subido de 0.1 a 0.2
    urgencyWeight: 0.7,     // WAVE 635: Bajado de 0.8 a 0.7
    consonanceWeight: 0.1,  // WAVE 635: Mantenido en 0.1
    threshold: 0.65,        // WAVE 640: Bajado de 0.70 a 0.65 (loops necesitan umbral bajo)
    urgencyBoost: 0.1       // WAVE 635: Bajado de 0.2 a 0.1
  },
  
  // 🎸 POP-ROCK: Balanced, el estándar
  'pop-rock': {
    beautyWeight: 0.4,      // Balance armonía + energía
    urgencyWeight: 0.5,     // WAVE 635: Subido de 0.4 a 0.5
    consonanceWeight: 0.1,  // WAVE 635: Bajado de 0.2 a 0.1
    threshold: 0.70,        // WAVE 635: Subido de 0.65 a 0.70
    urgencyBoost: 0.0       // No boost, mediciones naturales
  },
  
  // 🌙 CHILL-LOUNGE: Harmony-driven, belleza es arte
  'chill-lounge': {
    beautyWeight: 0.7,      // Belleza armónica es prioridad
    urgencyWeight: 0.2,     // WAVE 635: Subido de 0.1 a 0.2
    consonanceWeight: 0.1,  // WAVE 635: Bajado de 0.2 a 0.1
    threshold: 0.75,        // WAVE 635: Subido de 0.70 a 0.75 (muy selectivo)
    urgencyBoost: 0.0
  },
  
  // 💤 IDLE: Neutro (cuando no hay vibe activo)
  'idle': {
    beautyWeight: 0.4,
    urgencyWeight: 0.5,     // WAVE 635: Subido de 0.4 a 0.5
    consonanceWeight: 0.1,  // WAVE 635: Bajado de 0.2 a 0.1
    threshold: 0.75,        // WAVE 635: Subido de 0.70 a 0.75 (casi nunca dispara)
    urgencyBoost: 0.0
  },
}

/**
 * Obtiene los pesos de strike para el vibe actual
 * Si el vibe no existe en la matriz, usa pop-rock como default
 */
function getVibeWeights(vibeId: string): VibeStrikeWeights {
  return VIBE_STRIKE_MATRIX[vibeId] ?? VIBE_STRIKE_MATRIX['pop-rock']
}

// ═══════════════════════════════════════════════════════════════════════════
// EVALUACIÓN DE CONDICIONES - WAVE 625 DYNAMIC MATRIX
// ═══════════════════════════════════════════════════════════════════════════

function evaluateStrikeConditions(
  pattern: SeleneMusicalPattern,
  beauty: BeautyAnalysis,
  consonance: ConsonanceAnalysis,
  cfg: HuntConfig
): StrikeConditions {
  // Métricas base
  const beautyScore = beauty.totalBeauty
  const consonanceScore = consonance.totalConsonance
  const trend = beauty.trend
  
  // WAVE 625: Calcular urgencia base (rhythmic + emotional)
  let urgency = pattern.rhythmicIntensity * 0.5 + pattern.emotionalTension * 0.5
  
  // WAVE 625: Obtener matriz de pesos del vibe actual
  const weights = getVibeWeights(pattern.vibeId)
  
  // WAVE 625: Aplicar urgency boost para géneros rhythm-driven
  if (weights.urgencyBoost > 0) {
    urgency = Math.min(1.0, urgency + weights.urgencyBoost)
  }
  
  // WAVE 625: Calcular strikeScore PONDERADO en lugar de checks booleanos
  const strikeScore = 
    (beautyScore * weights.beautyWeight) +
    (urgency * weights.urgencyWeight) +
    (consonanceScore * weights.consonanceWeight)
  
  // Condiciones individuales (para logging y reasoning)
  const beautyMet = beautyScore >= cfg.beautyThreshold
  const consonanceMet = consonanceScore >= cfg.consonanceThreshold
  const trendMet = trend !== 'falling'
  const urgencyMet = urgency > 0.5 || pattern.section === 'chorus' || pattern.section === 'buildup'
  
  // WAVE 625: allMet ahora se basa en strikeScore >= threshold
  const allMet = strikeScore >= weights.threshold
  
  // Bonus por sección musical (chorus/buildup = momento crítico)
  let finalScore = strikeScore
  if (pattern.section === 'chorus' || pattern.section === 'buildup') {
    finalScore = Math.min(1.0, strikeScore + 0.05)
  }
  
  // Bonus por trend rising (momentum ascendente)
  if (trend === 'rising') {
    finalScore = Math.min(1.0, finalScore + 0.05)
  }
  
  // Reasoning para debug
  let reasoning = ''
  if (allMet) {
    reasoning = `[${pattern.vibeId}] STRIKE! Score=${finalScore.toFixed(2)} (threshold=${weights.threshold.toFixed(2)}) | Beauty=${beautyScore.toFixed(2)}×${weights.beautyWeight} Urgency=${urgency.toFixed(2)}×${weights.urgencyWeight} Cons=${consonanceScore.toFixed(2)}×${weights.consonanceWeight}`
  } else {
    const delta = (weights.threshold - finalScore).toFixed(2)
    reasoning = `[${pattern.vibeId}] Score=${finalScore.toFixed(2)} < ${weights.threshold.toFixed(2)} (need +${delta}) | Beauty=${beautyScore.toFixed(2)} Urgency=${urgency.toFixed(2)} Cons=${consonanceScore.toFixed(2)}`
  }
  
  return {
    beautyMet,
    beautyScore,
    consonanceMet,
    consonanceScore,
    trendMet,
    trend,
    urgencyMet,
    urgencyScore: urgency,
    allMet,
    strikeScore: finalScore,
    reasoning,
  }
}

