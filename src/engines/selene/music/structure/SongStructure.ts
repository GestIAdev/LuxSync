/**
 * 🎸 SONG STRUCTURE - INTERFACES
 */

import { SectionType } from '../core/types.js'

// Estructura de Canción
export interface SongStructure {
    // Duración total
    totalDuration: number           // Segundos

    // Secciones que componen la canción
    sections: Section[]

    // Tempo global
    globalTempo: number             // BPM

    // Métrica
    timeSignature: [number, number]

    // Estrategia de transición
    transitionStyle: 'smooth' | 'abrupt' | 'crossfade' | 'silence'
}

// Sección Individual
export interface Section {
    // Identidad
    id: string                      // 'intro-1', 'verse-a', 'chorus-1'
    type: SectionType
    index: number                   // Orden en la canción

    // Timing
    startTime: number               // Segundos desde inicio
    duration: number                // Segundos de duración
    bars: number                    // Compases

    // Perfil musical
    profile: SectionProfile

    // Transición a siguiente sección
    transition?: Transition
}

// Perfil de Sección
export interface SectionProfile {
    // Intensidad emocional/energética
    intensity: number               // 0-1 (0 = calma, 1 = climax)

    // Densidad instrumental
    layerDensity: number            // 0-1 (cuántas capas activas)

    // Complejidad armónica
    harmonicComplexity: number      // 0-1

    // Densidad melódica
    melodicDensity: number          // 0-1

    // Densidad rítmica
    rhythmicDensity: number         // 0-1

    // Modulación tonal
    modulation?: Modulation

    // Tempo local (override de global)
    tempoMultiplier: number         // 1.0 = normal, 0.5 = mitad, 2.0 = doble

    // Características específicas
    characteristics: SectionCharacteristics
}

// Características de Sección
export interface SectionCharacteristics {
    // ¿Es repetitiva? (para estribillo)
    repetitive: boolean

    // ¿Tiene motivo prominente?
    motivic: boolean

    // ¿Es transitoria? (puente, buildup)
    transitional: boolean

    // ¿Es climática? (punto alto)
    climactic: boolean

    // ¿Es atmosférica? (intro, interludio)
    atmospheric: boolean
}

// Modulación entre Secciones
export interface Modulation {
    type: 'none' | 'relative' | 'parallel' | 'chromatic' | 'modal' | 'fifth'
    targetRoot?: number             // Nueva raíz (semitones desde original)
    targetMode?: string            // Nuevo modo
}

// Transición entre Secciones
export interface Transition {
    type: 'direct' | 'fade' | 'buildup' | 'breakdown' | 'silence' | 'fill'
    duration: number                // Duración de la transición (segundos)
    characteristics: {
        crescendo?: boolean         // Volumen creciente
        accelerando?: boolean       // Tempo creciente
        fillPattern?: 'drum' | 'melodic' | 'harmonic'
    }
}

