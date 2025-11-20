/**
 * 🎸 MUSIC ENGINE PRO - INTERFACES PÚBLICAS
 * Todas las interfaces exportables de la API
 */

// No importar VitalSigns externa - usar la local de types.ts

/**
 * PARÁMETROS DE GENERACIÓN MUSICAL
 * API desacoplada de ConsensusResult
 */
export interface MusicGenerationParams {
    // Core
    seed: number
    beauty: number              // 0-1
    complexity: number          // 0-1
    
    // Control
    duration?: number           // segundos
    targetDuration?: number     // segundos (alias para duration)
    stylePreset?: string        // 'cyberpunk-ambient', 'indie-game-loop', etc.
    styleOverrides?: Partial<StylePreset>
    
    // Mode
    mode?: 'entropy' | 'risk' | 'punk'
    
    // Structure
    form?: string               // 'A-B-A', 'verse-chorus', etc.
    loopable?: boolean
    fadeIn?: boolean
    fadeOut?: boolean
    
    // Advanced
    advanced?: {
        rootPitch?: number
        modalScale?: ModalScale
        tempo?: number
        progression?: string
    }
    
    // Metadata
    metadata?: {
        title?: string
        tags?: string[]
        description?: string
    }
}

/**
 * OUTPUT DE GENERACIÓN MUSICAL
 */
export interface MusicEngineOutput {
    midi: {
        buffer: Buffer
        notes: MIDINote[]
        tracks: MIDITrack[]
        // 🎨 SCHERZO SÓNICO - Fase 4.1: Metadata JSON para bypass Bug C
        trackMetadata?: Array<{
            empiricalIndex: number      // Índice empírico (0, 2, 4, 5, 7 - workaround Bug C)
            trackType: string            // 'melody', 'harmony', 'bass', 'rhythm', 'pad'
            instrumentKey: string        // 'melody/pluck/MAX' o 'rythm/hard-kick1'
            instrumentType: 'multisample' | 'oneshot'
        }>
    }
    poetry: {
        verses: string[]
        fullText: string
        theme: string
        mood: string
    }
    metadata: {
        duration: number
        tempo: number
        key: string
        mode: ModalScale
        structure: string
        stylePreset: string
        seed: number
        timestamp: number
    }
    analysis: {
        complexity: number
        intensity: number
        harmony: number
        motifDevelopment: string
        progressionUsed: string
    }
    nft?: {
        tokenId?: string
        signature?: string
        attributes: Record<string, any>
        rarity: number
    }
}

/**
 * NOTA MIDI
 */
export interface MIDINote {
    pitch: number           // 0-127
    velocity: number        // 0-127
    startTime: number       // segundos
    duration: number        // segundos
    channel?: number        // 0-15
}

/**
 * TRACK MIDI
 */
export interface MIDITrack {
    id: string
    name: string
    channel: number
    program?: number        // MIDI program (instrumento)
    notes: MIDINote[]
    volume: number          // 0-127
}

/**
 * ESCALA MODAL
 */
export type ModalScale = 
    | 'major'           // Jónico: [0,2,4,5,7,9,11]
    | 'minor'           // Eólico: [0,2,3,5,7,8,10]
    | 'dorian'          // Dórico: [0,2,3,5,7,9,10]
    | 'phrygian'        // Frigio: [0,1,3,5,7,8,10]
    | 'lydian'          // Lidio: [0,2,4,6,7,9,11]
    | 'mixolydian'      // Mixolidio: [0,2,4,5,7,9,10]
    | 'locrian'         // Locrio: [0,1,3,5,6,8,10]
    | 'harmonic-minor'  // Menor armónica: [0,2,3,5,7,8,11]
    | 'melodic-minor'   // Menor melódica: [0,2,3,5,7,9,11]
    | 'pentatonic'      // Pentatónica: [0,2,4,7,9]
    | 'blues'           // Blues: [0,3,5,6,7,10]
    | 'whole-tone'      // Tonos enteros: [0,2,4,6,8,10]
    | 'chromatic'       // Cromática: [0,1,2,3,4,5,6,7,8,9,10,11]

// Exportar resto de interfaces desde otros módulos
export * from '../style/StylePreset.js'
export * from '../structure/SongStructure.js'
export * from '../harmony/ChordProgression.js'
export * from '../melody/MelodicMotif.js'

// Re-exportar StylePreset para evitar circular dependency
import type { StylePreset } from '../style/StylePreset.js'
export type { StylePreset }

