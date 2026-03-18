/**
 * 🎸 MUSIC THEORY UTILS
 * Utilidades de teoría musical
 */
import { ChordQuality } from '../core/types.js';
/**
 * Construir acorde desde fundamental
 */
export declare function buildChord(root: number, quality: ChordQuality): number[];
/**
 * Transponer nota
 */
export declare function transpose(pitch: number, semitones: number): number;
/**
 * Calcular intervalo entre dos notas
 */
export declare function interval(pitch1: number, pitch2: number): number;
//# sourceMappingURL=MusicTheoryUtils.d.ts.map