// pattern-sanity-checker.test.ts
/**
 * 🔍 TESTS: PATTERN SANITY CHECKER
 * Tests deterministas para verificación de cordura de patrones
 * NO Math.random() - Solo lógica real y verificable
 */

import { describe, it, expect } from 'vitest';
import { PatternSanityChecker } from './pattern-sanity-checker.js';
import { EvolutionaryPattern } from '../interfaces/evolutionary-engine-interfaces.js';

describe('🔍 PatternSanityChecker', () => {
  describe('✅ Patrones Sanos', () => {
    it('✅ Patrón válido pasa todas las verificaciones', () => {
      const validPattern: EvolutionaryPattern = {
        fibonacciSequence: [1, 1, 2, 3, 5, 8, 13],
        zodiacPosition: 5,
        musicalKey: 'G',
        harmonyRatio: 0.618,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(validPattern);

      expect(result.isSane).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.severity).toBe('low');
    });
  });

  describe('🔴 Fibonacci Extremos', () => {
    it('🔴 Detecta valores Fibonacci mayores a 1M', () => {
      const extremePattern: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269, 2178309], // Último > 1M
        zodiacPosition: 3,
        musicalKey: 'D',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(extremePattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('exceeds maximum'))).toBe(true);
      expect(result.severity).toMatch(/high|critical/);
    });

    it('🔴 Detecta valores Fibonacci menores a -1M', () => {
      const negativePattern: EvolutionaryPattern = {
        fibonacciSequence: [-1500000, -987, -610, -377],
        zodiacPosition: 8,
        musicalKey: 'A',
        harmonyRatio: 0.4,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(negativePattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('below minimum'))).toBe(true);
      expect(result.severity).toMatch(/high|critical/);
    });

    it('🔴 Detecta valores NaN en Fibonacci', () => {
      const nanPattern: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, NaN, 5, 8],
        zodiacPosition: 2,
        musicalKey: 'E',
        harmonyRatio: 0.618,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(nanPattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('not a valid number'))).toBe(true);
    });

    it('🔴 Detecta valores Infinity en Fibonacci', () => {
      const infinityPattern: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3, Infinity, 13],
        zodiacPosition: 7,
        musicalKey: 'F',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(infinityPattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('non-finite'))).toBe(true);
      expect(result.severity).toBe('critical');
    });

    it('🔴 Detecta secuencia vacía', () => {
      const emptyPattern: EvolutionaryPattern = {
        fibonacciSequence: [],
        zodiacPosition: 0,
        musicalKey: 'C',
        harmonyRatio: 0.618,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(emptyPattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('empty'))).toBe(true);
    });
  });

  describe('📊 Ratios Fibonacci', () => {
    it('📊 Detecta ratio extremo >5.0', () => {
      const extremeRatioPattern: EvolutionaryPattern = {
        fibonacciSequence: [1, 1, 10, 10, 100], // Ratios: 10/1=10, 100/10=10
        zodiacPosition: 4,
        musicalKey: 'G#',
        harmonyRatio: 0.6,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(extremeRatioPattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('exceeds maximum change'))).toBe(true);
      expect(result.severity).toMatch(/medium|high/);
    });

    it('📊 Detecta ratio extremo <0.2', () => {
      const lowRatioPattern: EvolutionaryPattern = {
        fibonacciSequence: [100, 100, 10, 10, 1], // Ratios: 10/100=0.1, 1/10=0.1
        zodiacPosition: 6,
        musicalKey: 'B',
        harmonyRatio: 0.45,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(lowRatioPattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('below minimum change'))).toBe(true);
    });

    it('📊 Detecta división por cero', () => {
      const zeroPattern: EvolutionaryPattern = {
        fibonacciSequence: [5, 3, 0, 8, 13], // División por 0 en posición 2
        zodiacPosition: 1,
        musicalKey: 'D',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(zeroPattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('Division by zero'))).toBe(true);
    });
  });

  describe('🌟 Posición Zodiacal', () => {
    it('🌟 Acepta posiciones válidas [0-11]', () => {
      for (let position = 0; position < 12; position++) {
        const pattern: EvolutionaryPattern = {
          fibonacciSequence: [1, 1, 2, 3],
          zodiacPosition: position,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: 1000000000000
        };

        const result = PatternSanityChecker.checkPatternSanity(pattern);
        expect(result.issues.filter(i => i.includes('Zodiac position'))).toHaveLength(0);
      }
    });

    it('🌟 Detecta posición negativa', () => {
      const negativeZodiac: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: -1,
        musicalKey: 'E',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(negativeZodiac);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('out of range'))).toBe(true);
    });

    it('🌟 Detecta posición >= 12', () => {
      const highZodiac: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 12,
        musicalKey: 'F',
        harmonyRatio: 0.618,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(highZodiac);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('out of range'))).toBe(true);
    });

    it('🌟 Detecta NaN en posición zodiacal', () => {
      const nanZodiac: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: NaN,
        musicalKey: 'G',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(nanZodiac);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('not a valid number'))).toBe(true);
    });
  });

  describe('🎵 Clave Musical', () => {
    it('🎵 Acepta todas las claves válidas', () => {
      const validKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      validKeys.forEach(key => {
        const pattern: EvolutionaryPattern = {
          fibonacciSequence: [1, 1, 2],
          zodiacPosition: 0,
          musicalKey: key,
          harmonyRatio: 0.618,
          timestamp: 1000000000000
        };

        const result = PatternSanityChecker.checkPatternSanity(pattern);
        expect(result.issues.filter(i => i.includes('Invalid musical key'))).toHaveLength(0);
      });
    });

    it('🎵 Detecta clave musical inválida', () => {
      const invalidKey: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 5,
        musicalKey: 'Z',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(invalidKey);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('Invalid musical key'))).toBe(true);
    });

    it('🎵 Detecta clave musical null', () => {
      const nullKey: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 3,
        musicalKey: null as any,
        harmonyRatio: 0.618,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(nullKey);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('null'))).toBe(true);
    });

    it('🎵 Acepta claves en minúsculas', () => {
      const lowerKey: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 2,
        musicalKey: 'c#',
        harmonyRatio: 0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(lowerKey);

      expect(result.issues.filter(i => i.includes('Invalid musical key'))).toHaveLength(0);
    });
  });

  describe('🎭 Harmony Ratio', () => {
    it('🎭 Acepta ratios válidos [0-1]', () => {
      const validRatios = [0, 0.25, 0.5, 0.618, 0.75, 1];

      validRatios.forEach(ratio => {
        const pattern: EvolutionaryPattern = {
          fibonacciSequence: [1, 1, 2],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: ratio,
          timestamp: 1000000000000
        };

        const result = PatternSanityChecker.checkPatternSanity(pattern);
        expect(result.issues.filter(i => i.includes('Harmony ratio'))).toHaveLength(0);
      });
    });

    it('🎭 Detecta ratio negativo', () => {
      const negativeRatio: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 4,
        musicalKey: 'E',
        harmonyRatio: -0.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(negativeRatio);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('out of range'))).toBe(true);
    });

    it('🎭 Detecta ratio > 1', () => {
      const highRatio: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 7,
        musicalKey: 'G',
        harmonyRatio: 1.5,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(highRatio);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('out of range'))).toBe(true);
    });

    it('🎭 Detecta NaN en ratio', () => {
      const nanRatio: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3],
        zodiacPosition: 1,
        musicalKey: 'D',
        harmonyRatio: NaN,
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(nanRatio);

      expect(result.isSane).toBe(false);
      expect(result.issues.some(i => i.includes('not a valid number'))).toBe(true);
    });
  });

  describe('📈 Niveles de Severidad', () => {
    it('📈 Multiple issues aumentan severidad', () => {
      const multiIssuePattern: EvolutionaryPattern = {
        fibonacciSequence: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269], // > 1M
        zodiacPosition: -1, // Inválido
        musicalKey: 'X', // Inválido
        harmonyRatio: 1.5, // Fuera de rango
        timestamp: 1000000000000
      };

      const result = PatternSanityChecker.checkPatternSanity(multiIssuePattern);

      expect(result.isSane).toBe(false);
      expect(result.issues.length).toBeGreaterThan(2);
      expect(result.severity).toMatch(/medium|high|critical/);
    });
  });

  describe('🔄 Validación por Lotes', () => {
    it('🔄 Valida múltiples patrones en lote', () => {
      const patterns: EvolutionaryPattern[] = [
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: 1000000000000
        },
        {
          fibonacciSequence: [1, 2, NaN, 5], // NaN inválido
          zodiacPosition: 5,
          musicalKey: 'G',
          harmonyRatio: 0.5,
          timestamp: 1000000000001
        },
        {
          fibonacciSequence: [1, 2, 3],
          zodiacPosition: 15, // Fuera de rango
          musicalKey: 'D',
          harmonyRatio: 0.7,
          timestamp: 1000000000002
        }
      ];

      const results = PatternSanityChecker.checkPatternBatch(patterns);

      expect(results).toHaveLength(3);
      expect(results[0].isSane).toBe(true);
      expect(results[1].isSane).toBe(false);
      expect(results[2].isSane).toBe(false);
    });
  });
});

