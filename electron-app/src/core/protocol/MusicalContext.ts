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
  /** Alias para type (legacy compatibility) */
  current: SectionType
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
// 🔋 WAVE 931: ENERGY CONTEXT - CONSCIENCIA ENERGÉTICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zona de intensidad energética
 * 
 * Permite a Selene entender el nivel ABSOLUTO de energía,
 * no solo las desviaciones estadísticas (Z-Score).
 * 
 * CRITICAL: Esto evita el "Síndrome del Grito en la Biblioteca"
 * donde un Z-Score alto en silencio dispara efectos épicos.
 */
export type EnergyZone = 
  | 'silence'   // E < 0.10 - Silencio total, pad, viento
  | 'valley'    // E 0.10-0.20 - Pre-drop silence, transición
  | 'ambient'   // E 0.20-0.35 - Ambiente suave, coro lejano
  | 'gentle'    // E 0.35-0.50 - Verso, melodía suave
  | 'active'    // E 0.50-0.70 - Pre-chorus, buildup
  | 'intense'   // E 0.70-0.85 - Chorus, clímax
  | 'peak'      // E > 0.85 - Drop, explosión

/**
 * 🔋 ENERGY CONTEXT
 * 
 * Contexto energético absoluto para decisiones inteligentes.
 * 
 * DISEÑO ASIMÉTRICO (Edge Case del "Fake Drop"):
 * - Para ENTRAR en silence/valley: Usa promedio lento (500ms)
 * - Para SALIR de silence/valley: Usa valor instantáneo (0ms)
 * 
 * Esto previene que Selene bloquee el disparo inicial de un drop
 * cuando el DJ corta todo súbitamente antes de la explosión.
 */
export interface EnergyContext {
  /** Energía absoluta instantánea (0-1) - Sin suavizado */
  absolute: number
  
  /** Energía suavizada para detección de zonas bajas (0-1) */
  smoothed: number
  
  /** Percentil histórico (0-100) - "Estás en el X% más bajo de la pista" */
  percentile: number
  
  /** Zona energética actual - El "termómetro" de Selene */
  zone: EnergyZone
  
  /** Zona anterior (para detectar transiciones) */
  previousZone: EnergyZone
  
  /** ¿Llevamos mucho tiempo en energía baja? (E<0.4 por >5s) */
  sustainedLow: boolean
  
  /** ¿Llevamos tiempo en energía alta? (E>0.7 por >3s) */
  sustainedHigh: boolean
  
  /** Velocidad de cambio de energía (-1 a 1, positivo=subiendo) */
  trend: number
  
  /** Timestamp de último cambio de zona */
  lastZoneChange: number
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
  // 🔋 WAVE 931: CONSCIENCIA ENERGÉTICA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Contexto energético detallado para decisiones inteligentes
   * Evita el "Síndrome del Grito en la Biblioteca"
   * 
   * 🔋 WAVE 932: Marcado como opcional para compatibilidad retroactiva
   * Los módulos que no lo provean obtendrán createDefaultEnergyContext()
   */
  energyContext?: EnergyContext

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
 * Crea un EnergyContext por defecto (silencio)
 */
export function createDefaultEnergyContext(): EnergyContext {
  return {
    absolute: 0,
    smoothed: 0,
    percentile: 0,
    zone: 'silence',
    previousZone: 'silence',
    sustainedLow: true,
    sustainedHigh: false,
    trend: 0,
    lastZoneChange: Date.now(),
  }
}

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
      current: 'unknown',
      confidence: 0,
      duration: 0,
      isTransition: false,
    },
    energy: 0,
    mood: 'neutral',
    energyContext: createDefaultEnergyContext(),
    genre: {
      macro: 'UNKNOWN',
      subGenre: null,
      confidence: 0,
    },
    confidence: 0,
    timestamp: Date.now(),
  }
}
