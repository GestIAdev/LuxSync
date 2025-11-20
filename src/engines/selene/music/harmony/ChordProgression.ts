/**
 * 🎸 CHORD PROGRESSION - INTERFACES
 */

import { ChordQuality } from '../core/types.js'

export interface ChordProgression {
    id: string
    name: string
    description: string
    tags: string[]
    chords: ChordDegree[]
    totalBars: number
    voiceLeading: VoiceLeadingStrategy
    cyclic: boolean
}

export interface ChordDegree {
    degree: number
    quality: ChordQuality
    extensions: number[]
    alterations?: ChordAlteration[]
    duration: number
    inversion?: number
    borrowed?: boolean
}

export interface ChordAlteration {
    interval: number
    alteration: 'sharp' | 'flat'
}

export type VoiceLeadingStrategy =
    | 'smooth'
    | 'contrary'
    | 'parallel'
    | 'oblique'
    | 'free'

export interface ResolvedChord {
    root: number
    notes: number[]
    inversion: number
    degree: number
    quality: ChordQuality
    extensions: number[]
    startTime: number
    duration: number
}

