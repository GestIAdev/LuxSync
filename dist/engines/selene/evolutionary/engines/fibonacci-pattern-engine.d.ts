import { EvolutionaryPattern } from '../interfaces/evolutionary-engine-interfaces.js';
/**
 * 🌀 MOTOR DE PATRONES FIBONACCI
 * Genera secuencias fibonacci deterministas para evolución creativa
 */
export declare class FibonacciPatternEngine {
    private static readonly PHI;
    private static readonly FIB_CACHE;
    private static readonly HARMONY_CACHE;
    /**
     * Genera secuencia fibonacci hasta el límite especificado
     * @param limit - Límite superior para la secuencia
     * @returns Array de números fibonacci
     */
    static generateFibonacciSequence(limit: number): number[];
    /**
     * Calcula ratio de armonía basado en proporción áurea
     * @param sequence - Secuencia fibonacci
     * @returns Ratio de armonía (0-1)
     */
    static calculateHarmonyRatio(sequence: number[]): number;
    /**
     * Valida convergencia de secuencia fibonacci
     * @param sequence - Secuencia a validar
     * @returns true si converge correctamente
     */
    static validateConvergence(sequence: number[]): boolean;
    /**
     * Genera patrón evolutivo completo basado en fibonacci
     * @param timestamp - Timestamp base para el patrón
     * @returns EvolutionaryPattern completo
     */
    static generateEvolutionaryPattern(timestamp: number): EvolutionaryPattern;
    /**
     * Calcula clave musical basada en ratio de armonía
     * @param harmonyRatio - Ratio de armonía (0-1)
     * @returns Clave musical (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
     * SSE-FIX-ALL: Fixed to only generate valid keys (no 'Fb', 'Cb', etc.)
     */
    static calculateMusicalKey(harmonyRatio: number): string;
    /**
     * Limpia el cache de secuencias fibonacci
     */
    static clearCache(): void;
    /**
     * Obtiene estadísticas del cache
     * @returns Estadísticas de uso del cache
     */
    static getCacheStats(): {
        fibCacheSize: number;
        harmonyCacheSize: number;
    };
}
//# sourceMappingURL=fibonacci-pattern-engine.d.ts.map