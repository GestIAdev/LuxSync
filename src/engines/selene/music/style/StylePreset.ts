/**
 * 🎸 STYLE PRESET - INTERFACE
 */

import { ModalScale } from '../core/interfaces.js'
import { ModeConfig } from '../core/types.js'

// Identidad
export interface StylePreset {
    id: string                      // 'cyberpunk-ambient', 'indie-game-loop'
    name: string                    // 'Cyberpunk Ambient'
    description: string             // 'Atmósfera oscura y espaciosa...'
    tags: string[]                  // ['ambient', 'dark', 'electronic']

    // Parámetros Musicales Core
    musical: MusicalParameters

    // Configuración de Capas
    layers: LayerConfiguration

    // 🎨 SCHERZO SÓNICO - Fase 4.1: Arsenal de Instrumentos
    instruments?: InstrumentConfiguration  // Opcional para retrocompatibilidad

    // 🎸 FASE 6.0 - FRENTE #A: Pools Temáticos + Estrategias Multicapa
    melodicLayerPools?: MelodicLayerPools         // Pools temáticos (strings, plucks, vocals, leads)
    layerStrategies?: Record<VibeType, LayerStrategy>  // Estrategias por vibe (chill, dubchill)

    // Textura y Densidad
    texture: TextureProfile

    // Comportamiento Temporal
    temporal: TemporalBehavior

    // Overrides de Modo (opcional)
    modeOverrides?: Partial<ModeConfig>
}

// Parámetros Musicales Fundamentales
export interface MusicalParameters {
    // Modo/Escala
    mode: ModalScale                // 'major', 'minor', 'dorian', 'phrygian', etc.
    scalePattern?: number[]         // [0,2,4,5,7,9,11] para override custom

    // Tempo y Métrica
    tempo: number                   // BPM (40-200)
    timeSignature: [number, number] // [4, 4] = 4/4, [3, 4] = 3/4, [7, 8] = 7/8

    // Rango de Tonalidad
    rootRange: [number, number]     // [48, 60] = C3 a C4 (rango de tónica)

    // Características Armónicas
    harmonic: HarmonicStyle

    // Características Melódicas
    melodic: MelodicStyle

    // Características Rítmicas
    rhythmic: RhythmicStyle
}

// Estilo Armónico
export interface HarmonicStyle {
    // Tipo de progresión preferida
    progressionType: 'tonal' | 'modal' | 'chromatic' | 'atonal' | 'quartal'

    // Complejidad de acordes
    chordComplexity: 'triads' | 'seventh' | 'extended' | 'clusters'

    // Densidad armónica (acordes por compás)
    density: number                 // 0.25 = 1 acorde cada 4 compases, 2 = 2 por compás

    // Preferencia de inversiones
    inversionProbability: number    // 0-1 (0 = root position, 1 = siempre invertido)

    // Disonancia permitida
    dissonanceLevel: number         // 0-1 (0 = consonante, 1 = máxima tensión)

    // Modulación entre secciones
    modulationStrategy: 'none' | 'relative' | 'parallel' | 'chromatic' | 'modal'
}

// Estilo Melódico
export interface MelodicStyle {
    // Rango melódico (en octavas sobre la raíz)
    range: [number, number]         // [0, 2] = 2 octavas desde root

    // Contorno preferido
    contourPreference: 'ascending' | 'descending' | 'arched' | 'wave' | 'random'

    // Densidad de notas
    noteDensity: number             // 0-1 (0 = espaciado, 1 = muy denso)

    // Uso de silencios
    restProbability: number         // 0-1 (probabilidad de silencios)

    // Ornamentación
    ornamentation: 'none' | 'minimal' | 'moderate' | 'heavy'

    // Repetición de motivos
    motifRepetition: number         // 0-1 (0 = siempre nuevo, 1 = muy repetitivo)
}

// Estilo Rítmico
export interface RhythmicStyle {
    // División rítmica base
    baseDivision: number            // 4 = cuartos, 8 = octavos, 16 = dieciseisavos

    // Complejidad rítmica
    complexity: 'simple' | 'moderate' | 'complex' | 'polyrhythmic'

    // Swing/Groove
    swing: number                   // 0-1 (0 = straight, 1 = heavy swing)

    // Síncopa
    syncopation: number             // 0-1 (0 = on-beat, 1 = máxima síncopa)

    // Densidad de capas rítmicas
    layerDensity: number            // 1-5 (cantidad de capas percusivas)
}

// Configuración de Capas
export interface LayerConfiguration {
    melody: LayerConfig | false     // false = sin melodía
    harmony: LayerConfig | false
    bass: LayerConfig | false
    rhythm: LayerConfig | false
    pad: LayerConfig | false        // Capa atmosférica
    lead: LayerConfig | false       // Lead adicional
}

// Config de una capa individual
export interface LayerConfig {
    enabled: boolean

    // Rango MIDI
    octave: number                  // 3 = C3-B3, 4 = C4-B4
    range?: [number, number]        // Override de rango específico

    // Dinámica
    velocity: number                // 0-127 (volumen base)
    velocityVariation: number       // 0-1 (cuánto varía la velocity)

    // Articulación
    articulation: 'staccato' | 'legato' | 'normal'
    noteDuration: number            // Multiplicador de duración (0.5 = mitad, 2 = doble)

    // Peso en la mezcla
    mixWeight: number               // 0-1 (importancia relativa)

    // MIDI channel/instrument
    channel?: number                // 0-15 (para multi-channel MIDI)
    program?: number                // 0-127 (program change para GM)
}

// 🎨 SCHERZO SÓNICO - Fase 4.1: Instrumento Dinámico
// 🥁 FASE 5.2: Extendido para soportar 'drumkit' (MIDI → sample mapping)
export interface InstrumentSelection {
    key: string                                    // 'melody/pluck/MAX' o 'rhythm/hard-kick1' o 'dubchill-kit-1'
    type: 'multisample' | 'oneshot' | 'drumkit'   // Tipo de sample (carpeta vs archivo vs drum kit)
    samples?: Record<number, string>               // Solo para drumkit: { 36: 'rhythm/hard-kick1', 38: 'rhythm/snare-reverb' }
}

// 🎸 FASE 5.9: PALETA SÓNICA DETERMINISTA
// Naturaleza del instrumento en la composición
export type InstrumentRole = 'harmony' | 'melody' | 'rhythm' | 'bass';

// Vibe global de la canción (decidido por seed al inicio)
export type VibeType = 'chill' | 'dubchill';

// Paleta completa de instrumentos para una canción (creada una vez al inicio)
export interface SonicPalette {
    vibe: VibeType                              // Mood global de la canción
    
    // IDENTIDAD ESTÁTICA (elegidos una vez, no cambian)
    harmonyInstrument: InstrumentSelection      // Piano, strings, etc. - se queda toda la canción
    melodyInstrument: InstrumentSelection       // Lead synth/pluck - se queda toda la canción
    
    // ENERGÍA DINÁMICA (cambian según intensidad de sección)
    rhythmPalette: InstrumentSelection[]        // Pool para rhythm (chill o dubchill según vibe)
    bassPalette: InstrumentSelection[]          // Pool para bass (chill o dubchill según vibe)
}

// 🎨 SCHERZO SÓNICO - Fase 4.1: Configuración de Instrumentos por Layer
// 🎸 FASE 5.9: Refactorizado con 8 pools separados (harmony/melody/rhythm/bass × chill/dubchill)
// 🎸 FASE 6.0 - FRENTE #A: Extendido con melodicLayerPools y layerStrategies para AND logic multicapa
export interface InstrumentConfiguration {
    // IDENTIDAD ESTÁTICA - Pools para elegir al inicio (no dependen de intensity)
    harmony_chill: InstrumentSelection[]       // Piano, strings ambientales
    harmony_dubchill: InstrumentSelection[]    // Strings oscuras, synth pads densos
    melody_chill: InstrumentSelection[]        // Plucks suaves, leads etéreos
    melody_dubchill: InstrumentSelection[]     // Leads agresivos, synths distorsionados
    
    // ENERGÍA DINÁMICA - Pools para elegir según intensity de sección
    bass_chill: InstrumentSelection[]          // Sub-bass sutiles (intensity < 0.7)
    bass_dubchill: InstrumentSelection[]       // Synth-bass rugidos (intensity >= 0.7)
    rhythm_chill: InstrumentSelection[]        // Soft kicks/hats (intensity < 0.7)
    rhythm_dubchill: InstrumentSelection[]     // Hard kicks/glitches (intensity >= 0.7)
    
    // LEGACY (mantener para retrocompatibilidad temporal)
    pad: InstrumentSelection[]
}

// 🎸 FASE 6.0 - FRENTE #A: Pools Temáticos para Multicapa
// Organiza instrumentos melódicos en categorías para selección simultánea
export interface MelodicLayerPools {
    strings: InstrumentSelection[]    // Strings (atmósfera sostenida)
    plucks: InstrumentSelection[]     // Plucks (melodía percusiva)
    vocals: InstrumentSelection[]     // Vocal chops (humanidad + emoción)
    leads: InstrumentSelection[]      // Synth leads (energía + protagonismo)
}

// 🎸 FASE 6.0 - FRENTE #A: Estrategia de Capas por Vibe
// Define cuántas capas y qué pools usar según vibe (chill vs dubchill)
export interface LayerStrategy {
    minLayers: number                 // Mínimo de capas simultáneas (2-3)
    maxLayers: number                 // Máximo de capas simultáneas (3-4)
    pools: string[]                   // Pools a usar (['strings', 'plucks', 'vocals'])
    weights: number[]                 // Peso de cada pool ([0.4, 0.3, 0.3] = preferencia strings)
}

// 🎨 SCHERZO SÓNICO - Fase 4.1: Configuración de Instrumentos por Layer
// 🎸 FASE 5.9: Refactorizado con 8 pools separados (harmony/melody/rhythm/bass × chill/dubchill)

// Perfil de Textura
export interface TextureProfile {
    // Densidad global
    density: 'sparse' | 'medium' | 'dense' | 'ultra-dense'

    // Espaciado vertical (rango de alturas simultáneas)
    verticalSpacing: number         // 0-1 (0 = cerrado, 1 = amplio)

    // Capas activas simultáneas
    activeLayersRange: [number, number]  // [2, 4] = entre 2 y 4 capas activas

    // Transparencia (silencios/espacios)
    transparency: number            // 0-1 (0 = continuo, 1 = muy espaciado)
}

// Comportamiento Temporal
export interface TemporalBehavior {
    // Evolución de tempo
    tempoEvolution: 'static' | 'accelerando' | 'ritardando' | 'rubato'
    tempoVariation: number          // 0-1 (cantidad de variación)

    // Evolución de intensidad
    intensityArc: 'flat' | 'crescendo' | 'diminuendo' | 'wave' | 'dramatic'

    // Fade in/out
    fadeIn: number                  // Segundos
    fadeOut: number                 // Segundos

    // Loopable
    loopable: boolean               // Si true, final conecta con inicio
}

// Resolved Style (resultado de resolver preset)
export interface ResolvedStyle {
    preset: StylePreset
    effectiveParams: any // TODO: definir
}

