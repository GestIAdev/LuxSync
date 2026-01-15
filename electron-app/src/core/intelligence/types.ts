/**
 * 🧬 WAVE 500: PROJECT GENESIS - Core Types
 * ==========================================
 * 
 * Interfaces nativas para SeleneTitanConscious.
 * Diseñadas desde cero para la arquitectura TitanEngine.
 * 
 * FILOSOFÍA:
 * - Input viene de TitanEngine (estabilizado)
 * - Output va a MasterArbiter Layer 1
 * - Todo tipado estrictamente
 * - 0 legacy imports
 * 
 * @module core/intelligence/types
 * @version 500.0.0
 */

import type { VibeId } from '../../types/VibeProfile'
import type { GenerationOptions, SelenePalette } from '../../engine/color/SeleneColorEngine'
import type { MetaEmotion } from '../../engine/color/MoodArbiter'
import type { ColorStrategy } from '../../engine/color/StrategyArbiter'

// ═══════════════════════════════════════════════════════════════════════════
// INPUT: Estado Estabilizado de Titan
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado estabilizado de TitanEngine
 * 
 * Este es el INPUT nativo para SeleneTitanConscious.
 * Todos los datos ya pasaron por los stabilizers (anti-epilepsia).
 */
export interface TitanStabilizedState {
  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXTO DEL VIBE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** ID del Vibe activo */
  vibeId: VibeId
  
  /** Constitución del color (leyes cromáticas) */
  constitution: GenerationOptions
  
  // ═══════════════════════════════════════════════════════════════════════
  // DATOS ESTABILIZADOS (anti-epilepsia)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Key musical estabilizada (12s buffer, 10s lock) */
  stableKey: string | null
  
  /** Emoción estabilizada (10s buffer, 5s lock) */
  stableEmotion: MetaEmotion
  
  /** Estrategia de color estabilizada (15s rolling, 15s lock) */
  stableStrategy: ColorStrategy
  
  /** Energía suavizada (rolling 2s) */
  smoothedEnergy: number
  
  /** ¿Estamos en un DROP? (FSM detectó drop relativo) */
  isDropActive: boolean
  
  /** Temperatura térmica (4500-9500K) */
  thermalTemperature: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIO EN TIEMPO REAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Intensidad de bass (0-1) */
  bass: number
  
  /** Intensidad de mids (0-1) */
  mid: number
  
  /** Intensidad de highs (0-1) */
  high: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXTO MUSICAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /** BPM detectado */
  bpm: number
  
  /** Fase del beat actual (0-1) */
  beatPhase: number
  
  /** Nivel de sincopación (0-1) - El "groove" */
  syncopation: number
  
  /** Tipo de sección musical */
  sectionType: 'intro' | 'verse' | 'chorus' | 'drop' | 'bridge' | 'outro' | 'build' | 'breakdown' | 'unknown'
  
  // ═══════════════════════════════════════════════════════════════════════
  // PALETA ACTUAL (para simulaciones)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Paleta actualmente renderizada */
  currentPalette: SelenePalette
  
  // ═══════════════════════════════════════════════════════════════════════
  // TIMING
  // ═══════════════════════════════════════════════════════════════════════
  
  /** ID del frame actual */
  frameId: number
  
  /** Timestamp en ms */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT: Decisión de Consciencia
// ═══════════════════════════════════════════════════════════════════════════

// Re-exportamos de ConsciousnessOutput.ts (ya están bien definidos)
export type {
  ConsciousnessOutput,
  ConsciousnessColorDecision,
  ConsciousnessPhysicsModifier,
  ConsciousnessMovementDecision,
  ConsciousnessDebugInfo,
  HuntState,
  DecisionSource,
} from '../../engine/consciousness/ConsciousnessOutput'

export {
  ENERGY_OVERRIDE_THRESHOLD,
  isEnergyOverrideActive,
  createEmptyOutput,
  clampPhysicsModifier,
  clampColorDecision,
} from '../../engine/consciousness/ConsciousnessOutput'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS INTERNOS DE SELENE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patrón musical percibido por Selene
 * (Versión simplificada del legacy MusicalPattern)
 */
export interface SeleneMusicalPattern {
  /** Nota musical (DO, RE, MI...) */
  note: MusicalNote
  
  /** Elemento zodiacal */
  element: ElementType
  
  /** Tono emocional percibido */
  emotionalTone: EmotionalTone
  
  /** Puntuación de belleza (0-1) */
  beauty: number
  
  /** Tendencia de belleza */
  beautyTrend: BeautyTrend
  
  /** Consonancia con estado anterior (0-1) */
  consonance: number
  
  /** Confianza en este patrón (0-1) */
  confidence: number
}

export type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI'
export type ElementType = 'fire' | 'earth' | 'air' | 'water'
export type EmotionalTone = 'peaceful' | 'energetic' | 'chaotic' | 'harmonious' | 'building' | 'dropping'
export type BeautyTrend = 'rising' | 'falling' | 'stable'

/**
 * Estado interno de la consciencia
 */
export interface SeleneInternalState {
  /** Estado de caza actual */
  huntPhase: HuntPhase
  
  /** Ciclos en fase actual */
  cyclesInPhase: number
  
  /** Último patrón procesado */
  lastPattern: SeleneMusicalPattern | null
  
  /** Historial de belleza (últimos 30 frames) */
  beautyHistory: number[]
  
  /** Historial de consonancia (últimos 30 frames) */
  consonanceHistory: number[]
  
  /** Candidatos actuales para strike */
  strikeCandidates: StrikeCandidate[]
  
  /** Predicción activa (si hay) */
  activePrediction: MusicalPrediction | null
  
  /** Último sueño simulado (si hay) */
  lastDream: DreamResult | null
  
  /** Sesgos detectados */
  detectedBiases: string[]
  
  /** Frames procesados total */
  framesProcessed: number
}

export type HuntPhase = 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'

/**
 * Candidato para strike
 */
export interface StrikeCandidate {
  pattern: SeleneMusicalPattern
  score: number
  cyclesObserved: number
  firstSeenAt: number
}

/**
 * Predicción musical
 */
export interface MusicalPrediction {
  /** Tipo de evento predicho */
  type: 'drop_incoming' | 'buildup_starting' | 'breakdown_imminent' | 'transition' | 'fill_expected'
  
  /** Probabilidad (0-1) */
  probability: number
  
  /** Tiempo hasta el evento (ms) */
  timeUntilMs: number
  
  /** Timestamp de cuando se hizo la predicción */
  predictedAt: number
}

/**
 * Resultado de simulación (sueño)
 */
export interface DreamResult {
  /** Escenario soñado */
  scenario: DreamScenario
  
  /** Belleza actual */
  currentBeauty: number
  
  /** Belleza proyectada */
  projectedBeauty: number
  
  /** Delta de belleza */
  beautyDelta: number
  
  /** Recomendación */
  recommendation: 'execute' | 'modify' | 'abort'
  
  /** Confianza en la simulación */
  confidence: number
  
  /** Razón */
  reasoning: string
}

export type DreamScenario = 
  | 'palette_change'
  | 'intensity_shift'
  | 'movement_change'
  | 'effect_activation'
  | 'mood_transition'
  | 'strike_execution'
  | 'full_scene_change'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES FELINAS
// ═══════════════════════════════════════════════════════════════════════════

/** PHI - La proporción áurea */
export const PHI = (1 + Math.sqrt(5)) / 2  // ≈ 1.6180339887

/** PHI inverso */
export const PHI_INVERSE = 1 / PHI  // ≈ 0.6180339887

/** Umbral de belleza para considerar strike */
export const BEAUTY_STRIKE_THRESHOLD = 0.75

/** Umbral de consonancia para strike */
export const CONSONANCE_STRIKE_THRESHOLD = 0.65

/** Mínimo de ciclos de stalking antes de strike */
export const MIN_STALKING_CYCLES = 5

/** Máximo de ciclos de stalking (evitar parálisis) */
export const MAX_STALKING_CYCLES = 30

/** Tamaño del historial de belleza */
export const BEAUTY_HISTORY_SIZE = 30

/** Tamaño del historial de consonancia */
export const CONSONANCE_HISTORY_SIZE = 30
