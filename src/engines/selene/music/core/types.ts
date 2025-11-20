/**
 * 🎸 MUSIC ENGINE PRO - TIPOS COMPARTIDOS
 */

/**
 * MODO DE GENERACIÓN
 */
export type GenerationMode = 'entropy' | 'risk' | 'punk'

/**
 * CONFIGURACIÓN DE MODO
 */
export interface ModeConfig {
    entropyFactor: number       // 0-100
    riskThreshold: number       // 0-100
    punkProbability: number     // 0-100
}

/**
 * CALIDAD DE ACORDE
 */
export type ChordQuality = 
    | 'major' 
    | 'minor' 
    | 'diminished' 
    | 'augmented' 
    | 'dominant' 
    | 'half-diminished'
    | 'sus2'
    | 'sus4'
    | 'power'

/**
 * ARTICULACIÓN
 */
export type Articulation = 'staccato' | 'legato' | 'normal'

/**
 * TIPO DE SECCIÓN
 */
export type SectionType = 
    | 'intro'       // Introducción
    | 'verse'       // Estrofa (A)
    | 'chorus'      // Estribillo (B)
    | 'bridge'      // Puente (C)
    | 'outro'       // Final
    | 'pre-chorus'  // Pre-estribillo
    | 'interlude'   // Interludio
    | 'breakdown'   // Breakdown
    | 'buildup'     // Buildup
    | 'drop'        // Drop (EDM)

/**
 * CONTORNO MELÓDICO
 */
export type MelodicContour = 'ascending' | 'descending' | 'arched' | 'valley' | 'wave' | 'static'

/**
 * EMOTIONAL MOOD
 */
export type EmotionalMood = 
    | 'calm' 
    | 'energetic' 
    | 'tense' 
    | 'melancholic' 
    | 'euphoric' 
    | 'anxious' 
    | 'meditative' 
    | 'chaotic'

/**
 * VITAL SIGNS (SystemVitals integration)
 */
export interface VitalSigns {
    stress: number      // 0-1
    harmony: number     // 0-1
    creativity: number  // 0-1
}

