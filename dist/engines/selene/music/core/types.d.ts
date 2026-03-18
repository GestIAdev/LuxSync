/**
 * 🎸 MUSIC ENGINE PRO - TIPOS COMPARTIDOS
 */
/**
 * MODO DE GENERACIÓN
 */
export type GenerationMode = 'entropy' | 'risk' | 'punk';
/**
 * CONFIGURACIÓN DE MODO
 */
export interface ModeConfig {
    entropyFactor: number;
    riskThreshold: number;
    punkProbability: number;
}
/**
 * CALIDAD DE ACORDE
 */
export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'dominant' | 'half-diminished' | 'sus2' | 'sus4' | 'power';
/**
 * ARTICULACIÓN
 */
export type Articulation = 'staccato' | 'legato' | 'normal';
/**
 * TIPO DE SECCIÓN
 */
export type SectionType = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'pre-chorus' | 'interlude' | 'breakdown' | 'buildup' | 'drop';
/**
 * CONTORNO MELÓDICO
 */
export type MelodicContour = 'ascending' | 'descending' | 'arched' | 'valley' | 'wave' | 'static';
/**
 * EMOTIONAL MOOD
 */
export type EmotionalMood = 'calm' | 'energetic' | 'tense' | 'melancholic' | 'euphoric' | 'anxious' | 'meditative' | 'chaotic';
/**
 * VITAL SIGNS (SystemVitals integration)
 */
export interface VitalSigns {
    stress: number;
    harmony: number;
    creativity: number;
}
//# sourceMappingURL=types.d.ts.map