/**
 * 🎸 MELODIC MOTIF - INTERFACE
 */

import { MelodicContour, Articulation } from '../core/types.js'

export interface MelodicMotif {
    intervals: number[]
    rhythm: number[]
    articulation: Articulation[]
    contour: MelodicContour
    length: number
    range: [number, number]
}

