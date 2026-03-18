/**
 * 🎸 VOICE LEADING
 * Algoritmos para conducción de voces suave entre acordes
 */
import { MIDINote } from '../core/interfaces.js';
export type VoiceLeadingStrategy = 'smooth' | 'contrary' | 'parallel' | 'oblique' | 'free';
/**
 * Algoritmo de conducción de voces
 */
export declare class VoiceLeading {
    /**
     * Minimizar movimiento de voces entre dos acordes
     * @param fromChord Acorde origen
     * @param toChord Acorde destino
     * @param strategy Estrategia de conducción
     * @returns Nuevo acorde con voces reordenadas
     */
    static minimizeVoiceMovement(fromChord: MIDINote[], toChord: MIDINote[], strategy?: VoiceLeadingStrategy): MIDINote[];
    /**
     * Conducción suave: minimizar movimiento total
     */
    private static applySmoothVoiceLeading;
    /**
     * Conducción contraria: movimiento opuesto
     */
    private static applyContraryVoiceLeading;
    /**
     * Conducción paralela: mantener intervalos
     */
    private static applyParallelVoiceLeading;
    /**
     * Conducción oblicua: algunas voces se mueven, otras permanecen
     */
    private static applyObliqueVoiceLeading;
    /**
     * Calcular el costo total de movimiento entre acordes
     * @param fromChord Acorde origen
     * @param toChord Acorde destino
     * @returns Costo total (menor = mejor conducción)
     */
    static calculateMovementCost(fromChord: MIDINote[], toChord: MIDINote[]): number;
    /**
     * Optimizar secuencia de acordes usando conducción de voces
     * @param chords Secuencia de acordes
     * @param strategy Estrategia a aplicar
     * @returns Secuencia optimizada
     */
    static optimizeChordSequence(chords: MIDINote[][], strategy?: VoiceLeadingStrategy): MIDINote[][];
}
//# sourceMappingURL=VoiceLeading.d.ts.map