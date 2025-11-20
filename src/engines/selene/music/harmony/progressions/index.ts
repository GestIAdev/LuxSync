/**
 * � CHORD PROGRESSIONS CATALOG
 * Catálogo completo de progresiones armónicas
 */

import { ChordProgression } from '../ChordProgression.js'
import { POP_PROGRESSIONS } from './pop.js'
import { ROCK_PROGRESSIONS } from './rock.js'
import { JAZZ_PROGRESSIONS } from './jazz.js'
import { BLUES_PROGRESSIONS } from './blues.js'
import { MODAL_PROGRESSIONS } from './modal.js'
import { CLASSICAL_PROGRESSIONS } from './classical.js'

/**
 * Catálogo completo de progresiones armónicas
 * Organizado por géneros musicales
 */
export const CHORD_PROGRESSIONS = {
    pop: POP_PROGRESSIONS,
    rock: ROCK_PROGRESSIONS,
    jazz: JAZZ_PROGRESSIONS,
    blues: BLUES_PROGRESSIONS,
    modal: MODAL_PROGRESSIONS,
    classical: CLASSICAL_PROGRESSIONS
} as const

/**
 * Lista plana de todas las progresiones disponibles
 */
export const ALL_PROGRESSIONS: Record<string, ChordProgression> = {
    ...POP_PROGRESSIONS,
    ...ROCK_PROGRESSIONS,
    ...JAZZ_PROGRESSIONS,
    ...BLUES_PROGRESSIONS,
    ...MODAL_PROGRESSIONS,
    ...CLASSICAL_PROGRESSIONS
}

/**
 * Tipos de progresiones disponibles
 */
export type ProgressionGenre = keyof typeof CHORD_PROGRESSIONS

/**
 * Obtener progresiones por género
 */
export function getProgressionsByGenre(genre: ProgressionGenre): Record<string, ChordProgression> {
    return CHORD_PROGRESSIONS[genre]
}

/**
 * Obtener una progresión específica por ID
 */
export function getProgressionById(id: string): ChordProgression | undefined {
    return ALL_PROGRESSIONS[id]
}

/**
 * Obtener progresiones por tags
 */
export function getProgressionsByTags(tags: string[]): Record<string, ChordProgression> {
    const result: Record<string, ChordProgression> = {}

    for (const [id, progression] of Object.entries(ALL_PROGRESSIONS)) {
        const hasAllTags = tags.every(tag => progression.tags.includes(tag))
        if (hasAllTags) {
            result[id] = progression
        }
    }

    return result
}

/**
 * Estadísticas del catálogo
 */
export const PROGRESSIONS_STATS = {
    total: Object.keys(ALL_PROGRESSIONS).length,
    byGenre: Object.fromEntries(
        Object.entries(CHORD_PROGRESSIONS).map(([genre, progressions]) => [
            genre,
            Object.keys(progressions).length
        ])
    )
} as const

