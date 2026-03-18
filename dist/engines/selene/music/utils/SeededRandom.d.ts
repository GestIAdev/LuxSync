/**
 * 🎸 SEEDED RANDOM - RNG DETERMINISTICO
 * 100% reproducible, 0% Math.random()
 */
export declare class SeededRandom {
    private seed;
    constructor(seed: number);
    /**
     * Generar siguiente número (0-1)
     * Algoritmo: Mulberry32
     */
    next(): number;
    /**
     * Número entero en rango [min, max]
     */
    nextInt(min: number, max: number): number;
    /**
     * Elemento aleatorio de array
     */
    choice<T>(array: T[]): T;
    /**
     * Shuffle array (Fisher-Yates)
     */
    shuffle<T>(array: T[]): T[];
    /**
     * 🎸 FASE 6.0 - FRENTE #A: Número en rango [min, max)
     * Similar a nextInt() pero para rangos flotantes
     */
    range(min: number, max: number): number;
    /**
     * 🎸 FASE 6.0 - FRENTE #A: Selección ponderada (weighted choice)
     * Elige un elemento del array usando pesos (weights)
     * @param array - Array de elementos
     * @param weights - Array de pesos (debe sumar ~1.0, pero se normaliza internamente)
     * @returns Elemento seleccionado
     */
    weightedChoice<T>(array: T[], weights: number[]): T;
}
//# sourceMappingURL=SeededRandom.d.ts.map