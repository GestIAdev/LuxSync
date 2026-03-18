/**
 * 🎼 VALIDADOR DE ARMONÍA MUSICAL
 * Valida y genera armonías musicales deterministas para evolución creativa
 */
export declare class MusicalHarmonyValidator {
    private static readonly MUSICAL_SCALES;
    private static readonly HARMONY_WEIGHTS;
    private static readonly KEY_EMOTIONS;
    /**
     * Valida armonía musical de una clave y escala
     * @param key - Clave musical (C, D, E, F, G, A, B + sostenidos)
     * @param scale - Tipo de escala
     * @returns Nivel de armonía (0-1)
     */
    static validateMusicalHarmony(key: string, scale: keyof typeof MusicalHarmonyValidator.MUSICAL_SCALES): number;
    /**
     * Obtiene peso armónico de un intervalo
     * @param interval - Intervalo en semitonos (0-11)
     * @returns Peso armónico (0-1)
     */
    private static getHarmonyWeight;
    /**
     * Convierte secuencia Fibonacci a intervalos musicales [0-11]
     * @param fibSequence - Secuencia de números Fibonacci
     * @returns Array de intervalos musicales (0-11)
     */
    static convertFibonacciToMusicalIntervals(fibSequence: number[]): number[];
    /**
     * Calcula nivel de disonancia para una escala [0-1]
     * @param scale - Nombre de la escala musical
     * @returns Nivel de disonancia (0 = consonante, 1 = muy disonante)
     */
    static calculateDissonance(scale: string): number;
    /**
     * Calcula resonancia emocional [0-1]
     * @param key - Clave musical
     * @param scale - Nombre de la escala
     * @returns Nivel de resonancia (0 = baja, 1 = alta)
     */
    static calculateResonance(key: string, scale: string): number;
    /**
     * Genera descripción poética de la armonía
     * @param key - Clave musical
     * @param scale - Nombre de la escala
     * @param harmony - Nivel de armonía (0-1)
     * @returns Descripción poética
     */
    static generateHarmonyDescription(key: string, scale: string, harmony: number): string;
    /**
     * Genera descripción musical poética
     * @param key - Clave musical
     * @param scale - Tipo de escala
     * @param harmony - Nivel de armonía
     * @returns Descripción poética
     */
    static generateMusicalDescription(key: string, scale: string, harmony: number): string;
    /**
     * Valida progresión armónica
     * @param keys - Array de claves musicales
     * @returns true si la progresión es armónica
     */
    static validateHarmonyProgression(keys: string[]): boolean;
    /**
     * Calcula armonía de una clave individual
     * @param key - Clave musical
     * @returns Nivel de armonía (0-1)
     */
    private static calculateKeyHarmony;
    /**
     * Calcula armonía de transición entre claves
     * @param key1 - Primera clave
     * @param key2 - Segunda clave
     * @returns Armonía de transición (0-1)
     */
    private static calculateKeyTransition;
    /**
     * Obtiene índice numérico de una clave
     * @param key - Clave musical
     * @returns Índice (0-11)
     */
    private static getKeyIndex;
    /**
     * Genera clave musical basada en ratio de armonía
     * @param harmonyRatio - Ratio de armonía (0-1)
     * @returns Clave musical
     */
    static generateMusicalKey(harmonyRatio: number): string;
    /**
     * Obtiene todas las escalas disponibles
     * @returns Array de nombres de escalas
     */
    static getAvailableScales(): string[];
    /**
     * Obtiene todas las claves disponibles
     * @returns Array de claves musicales
     */
    static getAvailableKeys(): string[];
}
//# sourceMappingURL=musical-harmony-validator.d.ts.map