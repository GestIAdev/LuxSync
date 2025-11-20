// fibonacci-pattern-engine.ts
// 🔥 FIBONACCI PATTERN ENGINE - EL VERSO LIBRE MATEMÁTICO
// 🎯 "Los números de Fibonacci son la poesía secreta del universo evolutivo"
// ⚡ Arquitecto: PunkGrok + Radwulf

import { EvolutionaryPattern } from '../interfaces/evolutionary-engine-interfaces.js';

/**
 * 🌀 MOTOR DE PATRONES FIBONACCI
 * Genera secuencias fibonacci deterministas para evolución creativa
 */
export class FibonacciPatternEngine {
  private static readonly PHI = (1 + Math.sqrt(5)) / 2; // Número áureo
  private static readonly FIB_CACHE = new Map<number, number[]>();
  private static readonly HARMONY_CACHE = new Map<string, number>();

  /**
   * Genera secuencia fibonacci hasta el límite especificado
   * @param limit - Límite superior para la secuencia
   * @returns Array de números fibonacci
   */
  static generateFibonacciSequence(limit: number): number[] {
    if (limit <= 0) return [0];
    if (limit === 1) return [0, 1, 1]; // Incluir el segundo 1 para límite = 1

    const cacheKey = limit;
    if (this.FIB_CACHE.has(cacheKey)) {
      return this.FIB_CACHE.get(cacheKey)!;
    }

    const sequence: number[] = [0, 1];
    let a = 0, b = 1;

    while (true) {
      const next = a + b;
      if (next > limit) break;
      sequence.push(next);
      a = b;
      b = next;
    }

    this.FIB_CACHE.set(cacheKey, sequence);
    return sequence;
  }

  /**
   * Calcula ratio de armonía basado en proporción áurea
   * @param sequence - Secuencia fibonacci
   * @returns Ratio de armonía (0-1)
   */
  static calculateHarmonyRatio(sequence: number[]): number {
    if (sequence.length < 3) return 0;

    const cacheKey = sequence.join(',');
    if (this.HARMONY_CACHE.has(cacheKey)) {
      return this.HARMONY_CACHE.get(cacheKey)!;
    }

    // Calcular proporciones áureas consecutivas
    let harmonySum = 0;
    let count = 0;

    for (let i = 2; i < sequence.length; i++) {
      const ratio = sequence[i] / sequence[i - 1];
      const harmony = 1 - Math.abs(ratio - this.PHI) / this.PHI;
      harmonySum += harmony;
      count++;
    }

    const averageHarmony = count > 0 ? harmonySum / count : 0;
    this.HARMONY_CACHE.set(cacheKey, averageHarmony);
    return averageHarmony;
  }

  /**
   * Valida convergencia de secuencia fibonacci
   * @param sequence - Secuencia a validar
   * @returns true si converge correctamente
   */
  static validateConvergence(sequence: number[]): boolean {
    if (sequence.length < 3) return false;

    for (let i = 2; i < sequence.length; i++) {
      if (sequence[i] !== sequence[i - 1] + sequence[i - 2]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Genera patrón evolutivo completo basado en fibonacci
   * @param timestamp - Timestamp base para el patrón
   * @returns EvolutionaryPattern completo
   */
  static generateEvolutionaryPattern(timestamp: number): EvolutionaryPattern {
    // 🔥 FIX: Preservar decimales del seed para máxima variación
    // No usar floor() ni divisiones que maten la entropía
    const normalizedSeed = Math.abs(timestamp);
    
    // Usar seed directamente para componentes (no solo para límite)
    const limit = (normalizedSeed % 89) + 5; // Fibonacci 89, límite 5-94 para variedad
    const fibonacciSequence = this.generateFibonacciSequence(Math.floor(limit));
    
    // Calcular harmony usando seed directo (no promediado por secuencia)
    const harmonyRatio = (normalizedSeed % 1) * 0.5 + 0.3; // 0.3-0.8 range

    // Calcular posición zodiacal usando seed directo (no suma de secuencia)
    const zodiacPosition = Math.floor((normalizedSeed * 7) % 12); // 0-11 zodiac positions

    // Calcular clave musical basada en armonía
    const musicalKey = this.calculateMusicalKey(harmonyRatio);

    return {
      fibonacciSequence,
      zodiacPosition,
      musicalKey,
      harmonyRatio,
      timestamp
    };
  }

  /**
   * Calcula clave musical basada en ratio de armonía
   * @param harmonyRatio - Ratio de armonía (0-1)
   * @returns Clave musical (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
   * SSE-FIX-ALL: Fixed to only generate valid keys (no 'Fb', 'Cb', etc.)
   */
  static calculateMusicalKey(harmonyRatio: number): string {
    // ✅ VALID KEYS ONLY - matches PatternSanityChecker.VALID_KEYS
    const validKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Mapear ratio a índice determinista (0-11)
    const keyIndex = Math.floor(harmonyRatio * validKeys.length) % validKeys.length;

    return validKeys[keyIndex];
  }

  /**
   * Limpia el cache de secuencias fibonacci
   */
  static clearCache(): void {
    this.FIB_CACHE.clear();
    this.HARMONY_CACHE.clear();
  }

  /**
   * Obtiene estadísticas del cache
   * @returns Estadísticas de uso del cache
   */
  static getCacheStats(): { fibCacheSize: number; harmonyCacheSize: number } {
    return {
      fibCacheSize: this.FIB_CACHE.size,
      harmonyCacheSize: this.HARMONY_CACHE.size
    };
  }
}

