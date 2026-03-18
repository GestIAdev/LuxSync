/**
 * 🎸 CHORD BUILDER
 * Constructor de acordes con todas las cualidades musicales
 */
import { ChordQuality } from '../core/types.js';
import { MIDINote } from '../core/interfaces.js';
/**
 * Builder para construir acordes con diferentes cualidades
 */
export declare class ChordBuilder {
    /**
     * Construir acorde básico
     * @param root Nota fundamental relativa (0-11, donde C=0)
     * @param quality Calidad del acorde
     * @param complexity Complejidad (0-1) para extensiones
     * @param random Instancia de SeededRandom para determinismo
     * @returns Array de notas MIDI con pitch relativo
     */
    static buildChord(root: number, quality: ChordQuality, complexity?: number, random?: any): MIDINote[];
    /**
     * Construir acorde con inversiones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde
     * @param inversion Número de inversión (0 = fundamental, 1 = primera inversión, etc.)
     * @returns Array de notas MIDI ordenadas por inversión
     */
    static buildChordWithInversion(root: number, quality: ChordQuality, inversion?: number): MIDINote[];
    /**
     * Construir acorde con extensiones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde base
     * @param extensions Extensiones a agregar (7, 9, 11, 13, etc.)
     * @returns Array de notas MIDI con extensiones
     */
    static buildExtendedChord(root: number, quality: ChordQuality, extensions?: number[]): MIDINote[];
    /**
     * Construir acorde con alteraciones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde base
     * @param alterations Alteraciones a aplicar (ej: {9: -1} para ♭9)
     * @returns Array de notas MIDI con alteraciones
     */
    static buildAlteredChord(root: number, quality: ChordQuality, alterations?: Record<number, number>): MIDINote[];
    /**
     * Construir acorde completo con todas las opciones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde base
     * @param options Opciones avanzadas
     * @returns Array de notas MIDI
     */
    static buildComplexChord(root: number, quality: ChordQuality, options?: {
        extensions?: number[];
        alterations?: Record<number, number>;
        inversion?: number;
        octave?: number;
    }): MIDINote[];
    /**
     * Obtener nombre del acorde
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde
     * @param extensions Extensiones
     * @param alterations Alteraciones
     * @returns Nombre del acorde
     */
    static getChordName(root: number, quality: ChordQuality, extensions?: number[], alterations?: Record<number, number>): string;
}
//# sourceMappingURL=ChordBuilder.d.ts.map