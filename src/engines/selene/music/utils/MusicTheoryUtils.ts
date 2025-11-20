/**
 * 🎸 MUSIC THEORY UTILS
 * Utilidades de teoría musical
 */

import { ChordQuality } from '../core/types.js'

/**
 * Construir acorde desde fundamental
 */
export function buildChord(root: number, quality: ChordQuality): number[] {
    const intervals: Record<ChordQuality, number[]> = {
        'major': [0, 4, 7],
        'minor': [0, 3, 7],
        'diminished': [0, 3, 6],
        'augmented': [0, 4, 8],
        'dominant': [0, 4, 7, 10],
        'half-diminished': [0, 3, 6, 10],
        'sus2': [0, 2, 7],
        'sus4': [0, 5, 7],
        'power': [0, 7]
    }
    
    return intervals[quality].map(interval => root + interval)
}

/**
 * Transponer nota
 */
export function transpose(pitch: number, semitones: number): number {
    return Math.max(0, Math.min(127, pitch + semitones))
}

/**
 * Calcular intervalo entre dos notas
 */
export function interval(pitch1: number, pitch2: number): number {
    return Math.abs(pitch2 - pitch1)
}

