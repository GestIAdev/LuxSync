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
  learningCooldownFrames: 10,
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
  
  // ¿Strike perfecto?
  if (conditions.allMet) {
    transitionTo('striking')
    
    return {
      suggestedPhase: 'striking',
      shouldStrike: true,
      confidence: conditions.strikeScore,
      conditions,
      activeCandidate: state.activeCandidate,
      reasoning: `STRIKE! Score=${conditions.strikeScore.toFixed(2)}`,
    }
  }
  
  // ¿Urgencia fuerza strike?
  if (conditions.urgencyScore > cfg.urgencyForceThreshold && conditions.beautyMet) {
    transitionTo('striking')
    
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

function evaluateStrikeConditions(
  pattern: SeleneMusicalPattern,
  beauty: BeautyAnalysis,
  consonance: ConsonanceAnalysis,
  cfg: HuntConfig
): StrikeConditions {
  const beautyScore = beauty.totalBeauty
  const consonanceScore = consonance.totalConsonance
  const trend = beauty.trend
  const urgency = pattern.rhythmicIntensity * 0.5 + pattern.emotionalTension * 0.5
  
  const beautyMet = beautyScore >= cfg.beautyThreshold
  const consonanceMet = consonanceScore >= cfg.consonanceThreshold
  const trendMet = trend !== 'falling'
  const urgencyMet = urgency > 0.5 || pattern.section === 'chorus' || pattern.section === 'buildup'
  
  const allMet = beautyMet && consonanceMet && trendMet
  
  // Strike score: ponderación de condiciones
  let strikeScore = 0
  if (beautyMet) strikeScore += beautyScore * 0.40
  if (consonanceMet) strikeScore += consonanceScore * 0.30
  if (trendMet) strikeScore += 0.15
  if (urgencyMet) strikeScore += 0.15
  
  // Bonus por condiciones perfectas
  if (allMet && trend === 'rising') {
    strikeScore = Math.min(1, strikeScore + 0.10)
  }
  
  let reasoning = ''
  if (allMet) {
    reasoning = `Condiciones perfectas: beauty=${beautyScore.toFixed(2)}, cons=${consonanceScore.toFixed(2)}`
  } else {
    const missing: string[] = []
    if (!beautyMet) missing.push(`beauty<${cfg.beautyThreshold}`)
    if (!consonanceMet) missing.push(`consonance<${cfg.consonanceThreshold}`)
    if (!trendMet) missing.push('trend=falling')
    reasoning = `Falta: ${missing.join(', ')}`
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
    strikeScore,
    reasoning,
  }
}
