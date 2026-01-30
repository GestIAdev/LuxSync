// FibonacciPatternEngine.ts
// 🌀 FIBONACCI PATTERN ENGINE - LA ESPIRAL DORADA DE LA CONSCIENCIA
// 🎯 "La naturaleza habla en Fibonacci, Selene escucha"
// ⚡ Wave 6: THE UNDYING MEMORY - Mathematical Beauty Filter
// 🔀 Adaptado de legacy para LuxSync - sin Redis, pura matemática
/**
 * 🌀 FIBONACCI PATTERN ENGINE
 * Genera patrones evolutivos basados en la secuencia de Fibonacci
 * y el ratio áureo PHI para scoring de belleza matemática
 *
 * @example
 * ```typescript
 * const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(Date.now());
 * console.log(pattern.harmonyRatio); // 0.0 - 1.0 (belleza matemática)
 * ```
 */
export class FibonacciPatternEngine {
    /**
     * Genera la secuencia de Fibonacci hasta un límite
     * @param limit - Cantidad de números a generar
     * @returns Array con la secuencia de Fibonacci
     *
     * @example
     * ```typescript
     * FibonacciPatternEngine.generateFibonacciSequence(8);
     * // [1, 1, 2, 3, 5, 8, 13, 21]
     * ```
     */
    static generateFibonacciSequence(limit) {
        // Limitar para evitar overflow
        const safeLimit = Math.min(limit, this.MAX_SEQUENCE_LENGTH);
        // Check cache
        const cached = this.FIB_CACHE.get(safeLimit);
        if (cached)
            return [...cached];
        // Generar secuencia
        const sequence = [1, 1];
        for (let i = 2; i < safeLimit; i++) {
            sequence.push(sequence[i - 1] + sequence[i - 2]);
        }
        // Cachear
        this.FIB_CACHE.set(safeLimit, sequence);
        return sequence;
    }
    /**
     * Calcula el ratio de armonía basado en PHI
     * @param sequence - Secuencia de Fibonacci
     * @returns Ratio de armonía (0-1) basado en convergencia a PHI
     *
     * @example
     * ```typescript
     * const seq = [1, 1, 2, 3, 5, 8, 13, 21];
     * const harmony = FibonacciPatternEngine.calculateHarmonyRatio(seq);
     * // ≈ 0.97 (alta armonía - converge a PHI)
     * ```
     */
    static calculateHarmonyRatio(sequence) {
        if (sequence.length < 2)
            return 0;
        // Usar los últimos dos números para máxima precisión
        const last = sequence[sequence.length - 1];
        const secondLast = sequence[sequence.length - 2];
        if (secondLast === 0)
            return 0;
        // Calcular ratio actual
        const currentRatio = last / secondLast;
        // Calcular desviación de PHI (0 = perfecto, mayor = peor)
        const deviation = Math.abs(currentRatio - this.PHI);
        // Convertir a score 0-1 (1 = perfecto)
        // Usamos exponencial para que pequeñas desviaciones tengan alto score
        const harmony = Math.exp(-deviation * 5);
        return Math.min(1, Math.max(0, harmony));
    }
    /**
     * Genera un patrón evolutivo completo basado en timestamp/seed
     * @param seed - Semilla para generación (timestamp o valor numérico)
     * @returns Patrón evolutivo con todos los componentes
     *
     * @example
     * ```typescript
     * const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(Date.now());
     * console.log(pattern.musicalKey); // 'A#' por ejemplo
     * console.log(pattern.zodiacPosition); // 7 (Leo)
     * ```
     */
    static generateEvolutionaryPattern(seed) {
        const timestamp = Date.now();
        // Calcular longitud de secuencia basada en seed
        // Usar módulo para obtener valor entre 5 y MAX_SEQUENCE_LENGTH
        const sequenceLength = 5 + (Math.floor(seed) % (this.MAX_SEQUENCE_LENGTH - 5));
        // Generar secuencia
        const fibonacciSequence = this.generateFibonacciSequence(sequenceLength);
        // Calcular ratio de armonía
        const harmonyRatio = this.calculateHarmonyRatio(fibonacciSequence);
        // Derivar posición zodiacal (0-11) del seed
        // Usar suma de secuencia + seed para variación
        const fibSum = fibonacciSequence.reduce((a, b) => a + b, 0);
        const zodiacPosition = Math.floor((seed + fibSum) % 12);
        // Derivar clave musical del harmony ratio
        const musicalKey = this.calculateMusicalKey(harmonyRatio, seed);
        // Generar firma única
        const signature = this.generateSignature(fibonacciSequence, zodiacPosition, harmonyRatio);
        return {
            fibonacciSequence,
            zodiacPosition,
            musicalKey,
            harmonyRatio,
            timestamp,
            signature
        };
    }
    /**
     * Calcula la clave musical basada en ratio de armonía y seed
     * @param harmonyRatio - Ratio de armonía (0-1)
     * @param seed - Semilla adicional para variación
     * @returns Clave musical (C, C#, D, etc.)
     */
    static calculateMusicalKey(harmonyRatio, seed = 0) {
        // Combinar harmony ratio con seed para variación determinista
        const combined = (harmonyRatio * 100 + seed) % 12;
        const keyIndex = Math.floor(Math.abs(combined)) % this.MUSICAL_KEYS.length;
        return this.MUSICAL_KEYS[keyIndex];
    }
    /**
     * Genera firma única para el patrón
     * @param sequence - Secuencia Fibonacci
     * @param zodiac - Posición zodiacal
     * @param harmony - Ratio de armonía
     * @returns String de firma única
     */
    static generateSignature(sequence, zodiac, harmony) {
        // Tomar primeros 5 números de secuencia
        const fibPart = sequence.slice(0, 5).join('-');
        // Combinar con zodiac y harmony truncado
        return `FIB:${fibPart}:Z${zodiac}:H${(harmony * 100).toFixed(0)}`;
    }
    /**
     * Evalúa la "belleza matemática" de un número
     * @param value - Número a evaluar
     * @returns Score de belleza (0-1)
     *
     * @example
     * ```typescript
     * FibonacciPatternEngine.evaluateMathematicalBeauty(8);  // Alto (Fibonacci)
     * FibonacciPatternEngine.evaluateMathematicalBeauty(7);  // Medio (primo)
     * FibonacciPatternEngine.evaluateMathematicalBeauty(14); // Bajo (común)
     * ```
     */
    static evaluateMathematicalBeauty(value) {
        let beautyScore = 0;
        // 1. ¿Es número de Fibonacci?
        if (this.isFibonacci(value)) {
            beautyScore += 0.4;
        }
        // 2. ¿Es número primo?
        if (this.isPrime(value)) {
            beautyScore += 0.2;
        }
        // 3. ¿Tiene relación con PHI?
        const phiRemainder = Math.abs((value % this.PHI) - this.PHI_INVERSE);
        if (phiRemainder < 0.1) {
            beautyScore += 0.2;
        }
        // 4. ¿Es divisible por números "bellos"? (3, 7, 12)
        if (value % 3 === 0 || value % 7 === 0 || value % 12 === 0) {
            beautyScore += 0.1;
        }
        // 5. Simetría digital (palíndromo)
        const digits = value.toString();
        if (digits === digits.split('').reverse().join('')) {
            beautyScore += 0.1;
        }
        return Math.min(1, beautyScore);
    }
    /**
     * Verifica si un número es de Fibonacci
     * @param n - Número a verificar
     * @returns true si es Fibonacci
     */
    static isFibonacci(n) {
        // Un número es Fibonacci si 5n² + 4 o 5n² - 4 es cuadrado perfecto
        const check1 = 5 * n * n + 4;
        const check2 = 5 * n * n - 4;
        return this.isPerfectSquare(check1) || this.isPerfectSquare(check2);
    }
    /**
     * Verifica si un número es cuadrado perfecto
     * @param n - Número a verificar
     * @returns true si es cuadrado perfecto
     */
    static isPerfectSquare(n) {
        if (n < 0)
            return false;
        const sqrt = Math.sqrt(n);
        return sqrt === Math.floor(sqrt);
    }
    /**
     * Verifica si un número es primo
     * @param n - Número a verificar
     * @returns true si es primo
     */
    static isPrime(n) {
        if (n < 2)
            return false;
        if (n === 2)
            return true;
        if (n % 2 === 0)
            return false;
        const sqrt = Math.sqrt(n);
        for (let i = 3; i <= sqrt; i += 2) {
            if (n % i === 0)
                return false;
        }
        return true;
    }
    /**
     * Calcula la "armonía dorada" entre dos valores
     * Mide qué tan cerca está su ratio de PHI
     * @param value1 - Primer valor
     * @param value2 - Segundo valor
     * @returns Score de armonía dorada (0-1)
     */
    static calculateGoldenHarmony(value1, value2) {
        if (value2 === 0)
            return 0;
        const ratio = Math.max(value1, value2) / Math.min(value1, value2);
        const deviation = Math.abs(ratio - this.PHI);
        // Convertir desviación a score (0 desviación = 1.0 score)
        return Math.exp(-deviation * 2);
    }
    /**
     * Genera siguiente valor sugerido basado en PHI
     * Útil para transiciones suaves de intensidad
     * @param currentValue - Valor actual
     * @returns Siguiente valor "bello" sugerido
     */
    static suggestNextGoldenValue(currentValue) {
        // Sugerir valor que forme ratio dorado con actual
        return Math.round(currentValue * this.PHI);
    }
    /**
     * Obtiene el n-ésimo número de Fibonacci
     * @param n - Posición en la secuencia (1-indexed)
     * @returns Número de Fibonacci en esa posición
     */
    static getNthFibonacci(n) {
        if (n <= 0)
            return 0;
        if (n <= 2)
            return 1;
        const sequence = this.generateFibonacciSequence(n);
        return sequence[n - 1];
    }
    /**
     * Limpia el cache de secuencias (para testing o liberación de memoria)
     */
    static clearCache() {
        this.FIB_CACHE.clear();
    }
}
// 🔥 PHI - El ratio divino que gobierna la espiral de la vida
FibonacciPatternEngine.PHI = (1 + Math.sqrt(5)) / 2; // ≈ 1.6180339887...
// 🎯 PHI inverso - útil para normalizaciones
FibonacciPatternEngine.PHI_INVERSE = 1 / FibonacciPatternEngine.PHI; // ≈ 0.6180339887...
// 📊 Límite de secuencia para performance
FibonacciPatternEngine.MAX_SEQUENCE_LENGTH = 20;
// 🧠 Cache de secuencias para optimización
FibonacciPatternEngine.FIB_CACHE = new Map();
// 🎵 Claves musicales ordenadas por brillo/energía
FibonacciPatternEngine.MUSICAL_KEYS = [
    'C', 'C#', 'D', 'D#', 'E', 'F',
    'F#', 'G', 'G#', 'A', 'A#', 'B'
];
