/**
 * 🎸 STYLE PRESET - INTERFACE
 */
import { ModalScale } from '../core/interfaces.js';
import { ModeConfig } from '../core/types.js';
export interface StylePreset {
    id: string;
    name: string;
    description: string;
    tags: string[];
    musical: MusicalParameters;
    layers: LayerConfiguration;
    instruments?: InstrumentConfiguration;
    melodicLayerPools?: MelodicLayerPools;
    layerStrategies?: Record<VibeType, LayerStrategy>;
    texture: TextureProfile;
    temporal: TemporalBehavior;
    modeOverrides?: Partial<ModeConfig>;
}
export interface MusicalParameters {
    mode: ModalScale;
    scalePattern?: number[];
    tempo: number;
    timeSignature: [number, number];
    rootRange: [number, number];
    harmonic: HarmonicStyle;
    melodic: MelodicStyle;
    rhythmic: RhythmicStyle;
}
export interface HarmonicStyle {
    progressionType: 'tonal' | 'modal' | 'chromatic' | 'atonal' | 'quartal';
    chordComplexity: 'triads' | 'seventh' | 'extended' | 'clusters';
    density: number;
    inversionProbability: number;
    dissonanceLevel: number;
    modulationStrategy: 'none' | 'relative' | 'parallel' | 'chromatic' | 'modal';
}
export interface MelodicStyle {
    range: [number, number];
    contourPreference: 'ascending' | 'descending' | 'arched' | 'wave' | 'random';
    noteDensity: number;
    restProbability: number;
    ornamentation: 'none' | 'minimal' | 'moderate' | 'heavy';
    motifRepetition: number;
}
export interface RhythmicStyle {
    baseDivision: number;
    complexity: 'simple' | 'moderate' | 'complex' | 'polyrhythmic';
    swing: number;
    syncopation: number;
    layerDensity: number;
}
export interface LayerConfiguration {
    melody: LayerConfig | false;
    harmony: LayerConfig | false;
    bass: LayerConfig | false;
    rhythm: LayerConfig | false;
    pad: LayerConfig | false;
    lead: LayerConfig | false;
}
export interface LayerConfig {
    enabled: boolean;
    octave: number;
    range?: [number, number];
    velocity: number;
    velocityVariation: number;
    articulation: 'staccato' | 'legato' | 'normal';
    noteDuration: number;
    mixWeight: number;
    channel?: number;
    program?: number;
}
export interface InstrumentSelection {
    key: string;
    type: 'multisample' | 'oneshot' | 'drumkit';
    samples?: Record<number, string>;
}
export type InstrumentRole = 'harmony' | 'melody' | 'rhythm' | 'bass';
export type VibeType = 'chill' | 'dubchill';
export interface SonicPalette {
    vibe: VibeType;
    harmonyInstrument: InstrumentSelection;
    melodyInstrument: InstrumentSelection;
    rhythmPalette: InstrumentSelection[];
    bassPalette: InstrumentSelection[];
}
export interface InstrumentConfiguration {
    harmony_chill: InstrumentSelection[];
    harmony_dubchill: InstrumentSelection[];
    melody_chill: InstrumentSelection[];
    melody_dubchill: InstrumentSelection[];
    bass_chill: InstrumentSelection[];
    bass_dubchill: InstrumentSelection[];
    rhythm_chill: InstrumentSelection[];
    rhythm_dubchill: InstrumentSelection[];
    pad: InstrumentSelection[];
}
export interface MelodicLayerPools {
    strings: InstrumentSelection[];
    plucks: InstrumentSelection[];
    vocals: InstrumentSelection[];
    leads: InstrumentSelection[];
}
export interface LayerStrategy {
    minLayers: number;
    maxLayers: number;
    pools: string[];
    weights: number[];
}
export interface TextureProfile {
    density: 'sparse' | 'medium' | 'dense' | 'ultra-dense';
    verticalSpacing: number;
    activeLayersRange: [number, number];
    transparency: number;
}
export interface TemporalBehavior {
    tempoEvolution: 'static' | 'accelerando' | 'ritardando' | 'rubato';
    tempoVariation: number;
    intensityArc: 'flat' | 'crescendo' | 'diminuendo' | 'wave' | 'dramatic';
    fadeIn: number;
    fadeOut: number;
    loopable: boolean;
}
export interface ResolvedStyle {
    preset: StylePreset;
    effectiveParams: any;
}
//# sourceMappingURL=StylePreset.d.ts.map