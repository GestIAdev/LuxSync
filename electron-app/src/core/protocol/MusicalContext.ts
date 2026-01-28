/**
 * 🏛️ WAVE 201: MUSICAL CONTEXT
 * 
 * Define la salida del CEREBRO (TrinityBrain).
 * El Cerebro analiza audio y produce SOLO este tipo.
 * 
 * REGLA: El Cerebro NO decide colores ni DMX. Solo describe QUÉ SUENA.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔬 WAVE 1026: THE ROSETTA STONE
 * ═══════════════════════════════════════════════════════════════════════════
 * Expansión del protocolo para transportar la carga útil del God Ear FFT 8K:
 * - SpectralContext: clarity, texture, bands (7 tactical bands)
 * - NarrativeContext: buildupScore, relativeEnergy, consensusVote (WAVE 1024)
 * 
 * CONSUMIDORES:
 * - SeleneTitanConscious: Usa clarity para evaluación ética (no stress)
 * - HuntEngine: Usa texture para criterios de caza (glitch effects)
 * - SeleneLux: Usa ultraAir para lasers/scanners
 * - EffectDreamSimulator: Usa texture para DNA de efectos
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * @layer CEREBRO → MOTOR
 * @version TITAN 2.0 → WAVE 1026
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌋 WAVE 960: FLASHBANG PROTOCOL
  // ═══════════════════════════════════════════════════════════════════════
  /**
   * ¿Es un salto instantáneo de zona baja (silence/valley) a alta (intense/peak)?
   * 
   * TRUE = Salto de Fe detectado (puede ser Drop o Grito)
   * → Disparar SOLO efectos cortos (StrobeBurst) en el primer frame
   * → NO disparar efectos largos (Gatling, CyberDualism) hasta confirmar sustain
   * 
   * Esto previene que un grito aislado deje una Gatling disparando 4s al aire.
   */
  isFlashbang: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔬 WAVE 1026: SPECTRAL CONTEXT - THE ROSETTA STONE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Textura del sonido detectada
 * 
 * Derivada de harshness + clarity:
 * - clean: harshness < 0.3, clarity > 0.6 (piano, voz limpia)
 * - warm: centroid < 300Hz (graves dominantes, bass music)
 * - harsh: harshness > 0.6, clarity > 0.7 (metal controlado, distorsión intencional)
 * - noisy: harshness > 0.6, clarity < 0.4 (ruido sucio, clipping, audio malo)
 */
export type SpectralTexture = 'clean' | 'warm' | 'harsh' | 'noisy'

/**
 * 🔬 SPECTRAL CONTEXT
 * 
 * Contexto espectral del God Ear FFT 8K.
 * Transporta la información de frecuencias tácticas para decisiones avanzadas.
 * 
 * CONSUMIDORES:
 * - HuntEngine: Usa texture para criterios de caza ('harsh' → glitch effects)
 * - SeleneTitanConscious: Usa clarity para evaluación ética
 * - SeleneLux: Usa bands.ultraAir para lasers/scanners
 * - EffectDreamSimulator: Usa texture para DNA matching
 */
export interface SpectralContext {
  // ═══════════════════════════════════════════════════════════════════════
  // MÉTRICAS GLOBALES
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Claridad de la señal (0-1)
   * 
   * CRÍTICO para SeleneTitanConscious:
   * - High Energy + High Harshness + HIGH CLARITY = EUPHORIA (no stress)
   * - High Energy + High Harshness + LOW CLARITY = STRESS (audio malo)
   */
  clarity: number
  
  /** Textura del sonido detectada */
  texture: SpectralTexture
  
  /** 
   * Planitud espectral (0-1)
   * 0 = Señal tonal pura (nota musical)
   * 1 = Ruido blanco puro
   */
  flatness: number
  
  /** 
   * Centroide espectral (Hz)
   * Indica el "centro de masa" de las frecuencias.
   * Valores bajos = sonido oscuro/cálido
   * Valores altos = sonido brillante/agudo
   */
  centroid: number
  
  /**
   * Harshness / Aspereza (0-1)
   * Ratio de energía en 2-5kHz vs total.
   * Alto = sonido agresivo/metálico
   */
  harshness: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // 7 BANDAS TÁCTICAS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Acceso directo a las 7 bandas de frecuencia tácticas.
   * Cada banda normalizada 0-1.
   */
  bands: {
    /** 20-60Hz - Kicks profundos, sub graves */
    subBass: number
    
    /** 60-250Hz - Bass, bajo eléctrico */
    bass: number
    
    /** 250-500Hz - Cuerpo, calidez */
    lowMid: number
    
    /** 500-2000Hz - Voz, instrumentos principales */
    mid: number
    
    /** 2000-4000Hz - Presencia, claridad */
    highMid: number
    
    /** 4000-8000Hz - Brillo, platillos */
    treble: number
    
    /** 
     * 8000-20000Hz - Aire, espacio
     * 🆕 WAVE 1026: Para drivers de Laser/Scanner (aunque no tengamos fixtures aún)
     */
    ultraAir: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 WAVE 1024/1026: NARRATIVE CONTEXT - THE STORY ARC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎬 NARRATIVE CONTEXT
 * 
 * Contexto narrativo del SectionTracker WAVE 1024.
 * Transporta la información de la "historia" de la canción.
 * 
 * Permite a los consumidores entender:
 * - ¿Estamos en un buildup espectral?
 * - ¿Cuál es la energía relativa al track (no absoluta)?
 * - ¿Hay consenso entre múltiples motores?
 */
export interface NarrativeContext {
  /** 
   * Score de buildup espectral (0-1)
   * Detectado por tendencias de rolloff↑, flatness↑, subBass↓
   * > 0.6 = Buildup inminente
   */
  buildupScore: number
  
  /**
   * Energía relativa al track (0-1)
   * Normalizada al min/max de los últimos 30 segundos.
   * > 0.8 = Cerca del máximo local (probable DROP)
   * < 0.25 = Cerca del mínimo local (probable BREAKDOWN)
   */
  relativeEnergy: number
  
  /**
   * Consenso entre motores
   * null = No hay consenso claro
   * object = Múltiples motores coinciden en la sección
   */
  consensus: {
    section: SectionType
    weight: number
  } | null
  
  /**
   * Diagnósticos del Sliding Window (opcional, para debugging)
   */
  slidingWindow?: {
    localMin: number
    localMax: number
    sampleCount: number
  }
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
  // 🔬 WAVE 1026: SPECTRAL CONTEXT - THE ROSETTA STONE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Contexto espectral del God Ear FFT 8K.
   * 
   * OPCIONAL para compatibilidad retroactiva.
   * Los módulos que no lo provean obtendrán createDefaultSpectralContext()
   * 
   * CONSUMIDORES:
   * - HuntEngine: texture para criterios de caza
   * - SeleneTitanConscious: clarity para evaluación ética
   * - SeleneLux: bands.ultraAir para lasers/scanners
   */
  spectral?: SpectralContext

  // ═══════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 1024/1026: NARRATIVE CONTEXT - THE STORY ARC
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Contexto narrativo del SectionTracker.
   * 
   * OPCIONAL para compatibilidad retroactiva.
   * Los módulos que no lo provean obtendrán createDefaultNarrativeContext()
   * 
   * Permite decisiones basadas en la "historia" del track:
   * - buildupScore: ¿Viene un DROP?
   * - relativeEnergy: ¿Energía alta para ESTE track?
   * - consensus: ¿Múltiples motores coinciden?
   */
  narrative?: NarrativeContext

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
    isFlashbang: false,  // 🌋 WAVE 960
  }
}

/**
 * 🔬 WAVE 1026: Crea un SpectralContext por defecto (silencio/clean)
 */
export function createDefaultSpectralContext(): SpectralContext {
  return {
    clarity: 0.5,
    texture: 'clean',
    flatness: 0,
    centroid: 440,  // A4 - punto neutral
    harshness: 0,
    bands: {
      subBass: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
      ultraAir: 0,
    },
  }
}

/**
 * 🎬 WAVE 1026: Crea un NarrativeContext por defecto (sin historia)
 */
export function createDefaultNarrativeContext(): NarrativeContext {
  return {
    buildupScore: 0,
    relativeEnergy: 0.5,  // Medio del rango
    consensus: null,
    slidingWindow: {
      localMin: 0,
      localMax: 1,
      sampleCount: 0,
    },
  }
}

/**
 * 🔬 WAVE 1026: Deriva la textura espectral desde harshness, clarity y centroid
 * 
 * REGLAS:
 * - clean: harshness < 0.3, clarity > 0.6 (piano, voz limpia)
 * - warm: centroid < 300Hz (graves dominantes, bass music)
 * - harsh: harshness > 0.6, clarity > 0.7 (metal controlado, distorsión intencional)
 * - noisy: harshness > 0.6, clarity < 0.4 (ruido sucio, clipping, audio malo)
 */
export function deriveSpectralTexture(
  harshness: number,
  clarity: number,
  centroid: number
): SpectralTexture {
  // Prioridad 1: ¿Es cálido? (frecuencias bajas dominantes)
  if (centroid < 300) {
    return 'warm'
  }
  
  // Prioridad 2: ¿Es ruidoso? (harshness alta + clarity baja = basura)
  if (harshness > 0.6 && clarity < 0.4) {
    return 'noisy'
  }
  
  // Prioridad 3: ¿Es áspero pero controlado? (metal, rock pesado)
  if (harshness > 0.6 && clarity > 0.7) {
    return 'harsh'
  }
  
  // Default: limpio
  return 'clean'
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
    // 🔬 WAVE 1026: Nuevos contextos
    spectral: createDefaultSpectralContext(),
    narrative: createDefaultNarrativeContext(),
    confidence: 0,
    timestamp: Date.now(),
  }
}
