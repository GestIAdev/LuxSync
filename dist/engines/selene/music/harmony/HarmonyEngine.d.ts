/**
 * 🎸 HARMONY ENGINE
 * Motor de armonía para generar progresiones y acordes
 */
import { MIDINote } from '../core/interfaces.js';
import { Section } from '../structure/SongStructure.js';
export interface HarmonyOptions {
    seed: number;
    section: Section;
    key: number;
    mode: string;
    complexity: number;
    voiceLeadingStrategy: 'smooth' | 'contrary' | 'parallel' | 'oblique' | 'free';
    totalLoad?: number;
}
/**
 * Motor de armonía principal
 */
export declare class HarmonyEngine {
    private random;
    constructor(seed?: number);
    /**
     * Generar secuencia de acordes
     * @param options Opciones de generación (incluye section completa)
     * @returns Secuencia de acordes MIDI
     */
    generateChordSequence(options: HarmonyOptions): MIDINote[][];
    /**
     * Seleccionar progresión según modo y complejidad
     */
    private selectProgression;
    /**
     * Seleccionar género según modo y complejidad
     */
    private selectGenreForMode;
    private adaptProgressionToKey;
    /**
     * Construir secuencia de acordes MIDI con ajuste de densidad
     * ✅ REFACTORIZADO: Recibe section completa, respeta section.duration
     */
    private buildChordSequence;
    /**
     * Generar acompañamiento armónico
     * @param chordSequence Secuencia de acordes
     * @param style Estilo ('block', 'arpeggio', 'broken')
     * @returns Notas de acompañamiento
     */
    generateAccompaniment(chordSequence: MIDINote[][], style?: 'block' | 'arpeggio' | 'broken'): MIDINote[];
    /**
     * Generar acordes bloque (todos juntos)
     */
    private generateBlockChords;
    /**
     * Generar arpegios
     */
    private generateArpeggios;
    /**
     * Generar acordes rotos
     */
    private generateBrokenChords;
    /**
     * Modificar complejidad de una secuencia
     * @param sequence Secuencia original
     * @param targetComplexity Complejidad objetivo (0-1)
     * @returns Secuencia modificada
     */
    modifyComplexity(sequence: MIDINote[][], targetComplexity: number): MIDINote[][];
}
//# sourceMappingURL=HarmonyEngine.d.ts.map