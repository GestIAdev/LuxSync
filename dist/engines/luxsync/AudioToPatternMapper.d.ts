/**
 * 🎵 AUDIO TO PATTERN MAPPER
 * Convierte audio raw (FFT) → patrones musicales que Selene entiende
 *
 * FLUJO:
 * AudioFrame (bass/mid/treble/beat/bpm) → MusicalPattern (mood/energy/features)
 */
import { AudioFrame } from '../audio/index.js';
/**
 * MOODS MUSICALES
 */
export type MusicMood = 'chill' | 'build' | 'drop' | 'break';
/**
 * PATRÓN MUSICAL
 * Formato que Selene Consciousness puede procesar
 */
export interface MusicalPattern {
    mood: MusicMood;
    energy: number;
    bpm: number;
    spectralProfile: {
        bass: number;
        mid: number;
        treble: number;
    };
    entropy: number;
    density: number;
    spectralCentroid: number;
    timestamp: number;
}
/**
 * FEATURES MUSICALES EXTENDIDOS
 */
export interface MusicalFeatures {
    energy: number;
    density: number;
    spectralCentroid: number;
    spectralFlux: number;
    harmonicRatio: number;
    entropy: number;
}
/**
 * AUDIO TO PATTERN MAPPER
 */
export declare class AudioToPatternMapper {
    private previousFrame;
    /**
     * Detectar mood musical
     */
    detectMood(frame: AudioFrame): MusicMood;
    /**
     * Extraer features musicales
     */
    extractFeatures(frame: AudioFrame): MusicalFeatures;
    /**
     * Convertir AudioFrame → MusicalPattern
     */
    toSelenePattern(frame: AudioFrame): MusicalPattern;
    /**
     * Reset state (útil para testing)
     */
    reset(): void;
}
//# sourceMappingURL=AudioToPatternMapper.d.ts.map