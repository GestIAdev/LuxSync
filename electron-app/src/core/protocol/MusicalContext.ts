/**
 * 🏛️ WAVE 201: MUSICAL CONTEXT
 * 
 * Define la salida del CEREBRO (TrinityBrain).
 * El Cerebro analiza audio y produce SOLO este tipo.
 * 
 * REGLA: El Cerebro NO decide colores ni DMX. Solo describe QUÉ SUENA.
 * 
 * @layer CEREBRO → MOTOR
 * @version TITAN 2.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PRIMITIVOS MUSICALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Las 12 notas musicales posibles como tónica
 */
export type MusicalKey = 
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' 
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

/**
 * Modo musical detectado
 */
export type MusicalMode = 'major' | 'minor' | 'unknown'

/**
 * Tipo de sección musical
 */
export type SectionType = 
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'breakdown'
  | 'buildup'
  | 'drop'
  | 'outro'
  | 'unknown'

/**
 * Macro-género para clasificación rápida
 */
export type MacroGenre = 
  | 'ELECTRONIC'
  | 'LATIN'
  | 'ROCK'
  | 'POP'
  | 'CHILL'
  | 'UNKNOWN'

/**
 * Mood emocional detectado
 */
export type Mood = 
  | 'euphoric'
  | 'melancholic'
  | 'aggressive'
  | 'dreamy'
  | 'neutral'
  | 'mysterious'
  | 'triumphant'

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTOS COMPUESTOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Información de la sección actual
 */
export interface SectionContext {
  /** Tipo de sección detectada */
  type: SectionType
  /** Confianza en la detección (0-1) */
  confidence: number
  /** Tiempo en esta sección (ms) */
  duration: number
  /** ¿Es transición? */
  isTransition: boolean
}

/**
 * Información del género detectado
 */
export interface GenreContext {
  /** Macro-género principal */
  macro: MacroGenre
  /** Sub-género más específico si está disponible */
  subGenre: string | null
  /** Confianza en la detección (0-1) */
  confidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFAZ PRINCIPAL: MUSICAL CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧠 MUSICAL CONTEXT
 * 
 * La salida principal del CEREBRO. Describe completamente
 * el estado musical actual sin decidir nada sobre iluminación.
 * 
 * @example
 * ```typescript
 * const ctx: MusicalContext = {
 *   key: 'A',
 *   mode: 'minor',
 *   bpm: 128,
 *   beatPhase: 0.75,
 *   syncopation: 0.3,
 *   section: { type: 'drop', confidence: 0.9, duration: 4500, isTransition: false },
 *   energy: 0.85,
 *   mood: 'euphoric',
 *   genre: { macro: 'ELECTRONIC', subGenre: 'techno', confidence: 0.8 },
 *   confidence: 0.87,
 *   timestamp: Date.now()
 * }
 * ```
 */
export interface MusicalContext {
  // ═══════════════════════════════════════════════════════════════════════
  // HARMONIC
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Tonalidad detectada (null si no se puede determinar) */
  key: MusicalKey | null
  
  /** Modo musical (mayor, menor, o desconocido) */
  mode: MusicalMode

  // ═══════════════════════════════════════════════════════════════════════
  // RHYTHMIC
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Beats por minuto detectados */
  bpm: number
  
  /** Fase del beat actual (0-1, donde 0 = inicio del beat) */
  beatPhase: number
  
  /** Nivel de sincopación (0-1, donde 1 = muy sincopado) */
  syncopation: number

  // ═══════════════════════════════════════════════════════════════════════
  // STRUCTURAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Contexto de la sección musical actual */
  section: SectionContext

  // ═══════════════════════════════════════════════════════════════════════
  // EMOTIONAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Nivel de energía global (0-1) */
  energy: number
  
  /** Mood emocional detectado */
  mood: Mood

  // ═══════════════════════════════════════════════════════════════════════
  // CLASSIFICATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Contexto del género musical */
  genre: GenreContext

  // ═══════════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Confianza general en el análisis (0-1) */
  confidence: number
  
  /** Timestamp de cuando se generó este contexto */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un MusicalContext por defecto (silencio/unknown)
 */
export function createDefaultMusicalContext(): MusicalContext {
  return {
    key: null,
    mode: 'unknown',
    bpm: 120,
    beatPhase: 0,
    syncopation: 0,
    section: {
      type: 'unknown',
      confidence: 0,
      duration: 0,
      isTransition: false,
    },
    energy: 0,
    mood: 'neutral',
    genre: {
      macro: 'UNKNOWN',
      subGenre: null,
      confidence: 0,
    },
    confidence: 0,
    timestamp: Date.now(),
  }
}
