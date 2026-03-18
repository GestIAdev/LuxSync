/**
 * 🎸 MELODY ENGINE
 */
import { MIDINote } from '../core/interfaces.js';
import { Section } from '../structure/SongStructure.js';
import { StylePreset } from '../style/StylePreset.js';
export declare class MelodyEngine {
    generateMelody(section: Section, style: StylePreset, rootPitch: number, seed: number): MIDINote[];
}
//# sourceMappingURL=MelodyEngine.d.ts.map