/**
 * 🎸 MUSIC ENGINE PRO - INTERFACES PÚBLICAS
 * Todas las interfaces exportables de la API
 */
/**
 * PARÁMETROS DE GENERACIÓN MUSICAL
 * API desacoplada de ConsensusResult
 */
export interface MusicGenerationParams {
    seed: number;
    beauty: number;
    complexity: number;
    duration?: number;
    targetDuration?: number;
    stylePreset?: string;
    styleOverrides?: Partial<StylePreset>;
    mode?: 'entropy' | 'risk' | 'punk';
    form?: string;
    loopable?: boolean;
    fadeIn?: boolean;
    fadeOut?: boolean;
    advanced?: {
        rootPitch?: number;
        modalScale?: ModalScale;
        tempo?: number;
        progression?: string;
    };
    metadata?: {
        title?: string;
        tags?: string[];
        description?: string;
    };
}
/**
 * OUTPUT DE GENERACIÓN MUSICAL
 */
export interface MusicEngineOutput {
    midi: {
        buffer: Buffer;
        notes: MIDINote[];
        tracks: MIDITrack[];
        trackMetadata?: Array<{
            empiricalIndex: number;
            trackType: string;
            instrumentKey: string;
            instrumentType: 'multisample' | 'oneshot';
        }>;
    };
    poetry: {
        verses: string[];
        fullText: string;
        theme: string;
        mood: string;
    };
    metadata: {
        duration: number;
        tempo: number;
        key: string;
        mode: ModalScale;
        structure: string;
        stylePreset: string;
        seed: number;
        timestamp: number;
    };
    analysis: {
        complexity: number;
        intensity: number;
        harmony: number;
        motifDevelopment: string;
        progressionUsed: string;
    };
    nft?: {
        tokenId?: string;
        signature?: string;
        attributes: Record<string, any>;
        rarity: number;
    };
}
/**
 * NOTA MIDI
 */
export interface MIDINote {
    pitch: number;
    velocity: number;
    startTime: number;
    duration: number;
    channel?: number;
}
/**
 * TRACK MIDI
 */
export interface MIDITrack {
    id: string;
    name: string;
    channel: number;
    program?: number;
    notes: MIDINote[];
    volume: number;
}
/**
 * ESCALA MODAL
 */
export type ModalScale = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'harmonic-minor' | 'melodic-minor' | 'pentatonic' | 'blues' | 'whole-tone' | 'chromatic';
export * from '../style/StylePreset.js';
export * from '../structure/SongStructure.js';
export * from '../harmony/ChordProgression.js';
export * from '../melody/MelodicMotif.js';
import type { StylePreset } from '../style/StylePreset.js';
export type { StylePreset };
//# sourceMappingURL=interfaces.d.ts.map