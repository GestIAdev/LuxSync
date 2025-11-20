/**
 * 🎸 MELODY ENGINE
 */

import { MelodicMotif } from './MelodicMotif.js'
import { MIDINote } from '../core/interfaces.js'
import { Section } from '../structure/SongStructure.js'
import { StylePreset } from '../style/StylePreset.js'
import { SeededRandom } from '../utils/SeededRandom.js'

export class MelodyEngine {
    generateMelody(
        section: Section,
        style: StylePreset,
        rootPitch: number,
        seed: number
    ): MIDINote[] {
        // TODO: Implementar generación completa
        throw new Error('Not implemented yet')
    }
}

