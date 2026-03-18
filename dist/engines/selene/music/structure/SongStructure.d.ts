/**
 * 🎸 SONG STRUCTURE - INTERFACES
 */
import { SectionType } from '../core/types.js';
export interface SongStructure {
    totalDuration: number;
    sections: Section[];
    globalTempo: number;
    timeSignature: [number, number];
    transitionStyle: 'smooth' | 'abrupt' | 'crossfade' | 'silence';
}
export interface Section {
    id: string;
    type: SectionType;
    index: number;
    startTime: number;
    duration: number;
    bars: number;
    profile: SectionProfile;
    transition?: Transition;
}
export interface SectionProfile {
    intensity: number;
    layerDensity: number;
    harmonicComplexity: number;
    melodicDensity: number;
    rhythmicDensity: number;
    modulation?: Modulation;
    tempoMultiplier: number;
    characteristics: SectionCharacteristics;
}
export interface SectionCharacteristics {
    repetitive: boolean;
    motivic: boolean;
    transitional: boolean;
    climactic: boolean;
    atmospheric: boolean;
}
export interface Modulation {
    type: 'none' | 'relative' | 'parallel' | 'chromatic' | 'modal' | 'fifth';
    targetRoot?: number;
    targetMode?: string;
}
export interface Transition {
    type: 'direct' | 'fade' | 'buildup' | 'breakdown' | 'silence' | 'fill';
    duration: number;
    characteristics: {
        crescendo?: boolean;
        accelerando?: boolean;
        fillPattern?: 'drum' | 'melodic' | 'harmonic';
    };
}
//# sourceMappingURL=SongStructure.d.ts.map