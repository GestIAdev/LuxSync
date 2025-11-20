/**
 * 🎸 SEEDED RANDOM - RNG DETERMINISTICO
 * 100% reproducible, 0% Math.random()
 */

export class SeededRandom {
    private seed: number
    
    constructor(seed: number) {
        this.seed = seed
    }
    
    /**
     * Generar siguiente número (0-1)
     * Algoritmo: Mulberry32
     */
    next(): number {
        let t = this.seed += 0x6D2B79F5
        t = Math.imul(t ^ t >>> 15, t | 1)
        t ^= t + Math.imul(t ^ t >>> 7, t | 61)
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
    
    /**
     * Número entero en rango [min, max]
     */
    nextInt(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min
    }
    
    /**
     * Elemento aleatorio de array
     */
    choice<T>(array: T[]): T {
        return array[this.nextInt(0, array.length - 1)]
    }
    
    /**
     * Shuffle array (Fisher-Yates)
     */
    shuffle<T>(array: T[]): T[] {
        const result = [...array]
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i)
            ;[result[i], result[j]] = [result[j], result[i]]
        }
        return result
    }

    /**
     * 🎸 FASE 6.0 - FRENTE #A: Número en rango [min, max)
     * Similar a nextInt() pero para rangos flotantes
     */
    range(min: number, max: number): number {
        return Math.floor(this.next() * (max - min)) + min
    }

    /**
     * 🎸 FASE 6.0 - FRENTE #A: Selección ponderada (weighted choice)
     * Elige un elemento del array usando pesos (weights)
     * @param array - Array de elementos
     * @param weights - Array de pesos (debe sumar ~1.0, pero se normaliza internamente)
     * @returns Elemento seleccionado
     */
    weightedChoice<T>(array: T[], weights: number[]): T {
        if (array.length === 0) throw new Error('Array vacío en weightedChoice')
        if (array.length !== weights.length) throw new Error('Array y weights deben tener mismo tamaño')

        // Normalizar weights (por si no suman 1.0)
        const sum = weights.reduce((a, b) => a + b, 0)
        const normalized = weights.map(w => w / sum)

        // Generar número random 0-1
        const rand = this.next()

        // Acumular pesos hasta superar rand
        let cumulative = 0
        for (let i = 0; i < normalized.length; i++) {
            cumulative += normalized[i]
            if (rand < cumulative) {
                return array[i]
            }
        }

        // Fallback (no debería llegar aquí, pero por si rounding errors)
        return array[array.length - 1]
    }
}

