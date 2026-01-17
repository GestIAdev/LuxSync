// fibonacci-pattern-engine.test.ts
// 🧪 TESTS UNITARIOS - FIBONACCI PATTERN ENGINE
// 🎯 "Los tests son el martillo que forja la confianza en el código"
// ⚡ Ejecutor: PunkClaude | Arquitecto: Radwulf

import { describe, it, expect, beforeEach } from 'vitest';
import { FibonacciPatternEngine } from './fibonacci-pattern-engine.js';

describe('🌀 FibonacciPatternEngine - Tests Unitarios', () => {
  beforeEach(() => {
    // Limpiar caches antes de cada test
    (FibonacciPatternEngine as any).FIB_CACHE.clear();
    (FibonacciPatternEngine as any).HARMONY_CACHE.clear();
  });

  describe('generateFibonacciSequence()', () => {
    it('✅ Genera secuencia correcta para límite 0', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(0);
      expect(sequence).toEqual([0]);
    });

    it('✅ Genera secuencia correcta para límite 1', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(1);
      expect(sequence).toEqual([0, 1, 1]);
    });

    it('✅ Genera secuencia fibonacci correcta hasta límite 100', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(100);
      const expected = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
      expect(sequence).toEqual(expected);
    });

    it('✅ Genera secuencia fibonacci correcta hasta límite 1000', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(1000);
      expect(sequence).toContain(0);
      expect(sequence).toContain(1);
      expect(sequence).toContain(987); // Último fibonacci antes de 1000
      expect(sequence).not.toContain(1597); // Siguiente fibonacci después de 1000
    });

    it('✅ DETERMINISMO: Misma secuencia para mismo límite (llamadas múltiples)', () => {
      const seq1 = FibonacciPatternEngine.generateFibonacciSequence(500);
      const seq2 = FibonacciPatternEngine.generateFibonacciSequence(500);
      const seq3 = FibonacciPatternEngine.generateFibonacciSequence(500);
      
      expect(seq1).toEqual(seq2);
      expect(seq2).toEqual(seq3);
    });

    it('✅ Cache funciona correctamente', () => {
      // Primera llamada - calcular
      const seq1 = FibonacciPatternEngine.generateFibonacciSequence(200);
      
      // Segunda llamada - desde cache (debería ser instantánea)
      const start = performance.now();
      const seq2 = FibonacciPatternEngine.generateFibonacciSequence(200);
      const duration = performance.now() - start;
      
      expect(seq1).toEqual(seq2);
      expect(duration).toBeLessThan(1); // Cache retrieval < 1ms
    });

    it('🛡️ CASO BORDE: Límite negativo devuelve [0]', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(-50);
      expect(sequence).toEqual([0]);
    });

    it('🛡️ CASO BORDE: Límite muy grande (10000) no crashea', () => {
      expect(() => {
        FibonacciPatternEngine.generateFibonacciSequence(10000);
      }).not.toThrow();
    });
  });

  describe('calculateHarmonyRatio()', () => {
    it('✅ Retorna 0 para secuencias muy cortas (< 3 elementos)', () => {
      expect(FibonacciPatternEngine.calculateHarmonyRatio([0])).toBe(0);
      expect(FibonacciPatternEngine.calculateHarmonyRatio([0, 1])).toBe(0);
    });

    it('✅ Calcula armonía correcta para secuencia fibonacci clásica', () => {
      const sequence = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34];
      const harmony = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      
      // La secuencia fibonacci converge a PHI, así que harmony debería ser alto
      expect(harmony).toBeGreaterThan(0.8);
      expect(harmony).toBeLessThanOrEqual(1.0);
    });

    it('✅ DETERMINISMO: Misma armonía para misma secuencia', () => {
      const sequence = [0, 1, 1, 2, 3, 5, 8, 13];
      const harmony1 = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      const harmony2 = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      const harmony3 = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      
      expect(harmony1).toBe(harmony2);
      expect(harmony2).toBe(harmony3);
    });

    it('✅ Cache funciona correctamente para calculateHarmonyRatio', () => {
      const sequence = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
      
      // Primera llamada - calcular
      const harmony1 = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      
      // Segunda llamada - desde cache
      const start = performance.now();
      const harmony2 = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      const duration = performance.now() - start;
      
      expect(harmony1).toBe(harmony2);
      expect(duration).toBeLessThan(1); // Cache retrieval < 1ms
    });

    it('🛡️ CASO BORDE: Secuencia vacía no crashea', () => {
      expect(() => {
        FibonacciPatternEngine.calculateHarmonyRatio([]);
      }).not.toThrow();
    });

    it('🛡️ CASO BORDE: Secuencia con valores negativos no crashea', () => {
      const sequence = [-5, -3, -2, 0, 2, 3, 5];
      expect(() => {
        FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      }).not.toThrow();
    });

    it('✅ Secuencia NO-fibonacci tiene menor armonía', () => {
      const fibSequence = [0, 1, 1, 2, 3, 5, 8, 13, 21];
      const nonFibSequence = [0, 2, 4, 6, 8, 10, 12, 14, 16]; // Progresión aritmética
      
      const fibHarmony = FibonacciPatternEngine.calculateHarmonyRatio(fibSequence);
      const nonFibHarmony = FibonacciPatternEngine.calculateHarmonyRatio(nonFibSequence);
      
      expect(fibHarmony).toBeGreaterThan(nonFibHarmony);
    });
  });

  describe('validateConvergence()', () => {
    it('✅ Valida correctamente secuencia fibonacci legítima', () => {
      const validSequence = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
      expect(FibonacciPatternEngine.validateConvergence(validSequence)).toBe(true);
    });

    it('✅ Rechaza secuencia NO-fibonacci', () => {
      const invalidSequence = [0, 1, 2, 4, 8, 16, 32]; // Potencias de 2
      expect(FibonacciPatternEngine.validateConvergence(invalidSequence)).toBe(false);
    });

    it('✅ Rechaza secuencias muy cortas (< 3 elementos)', () => {
      expect(FibonacciPatternEngine.validateConvergence([0])).toBe(false);
      expect(FibonacciPatternEngine.validateConvergence([0, 1])).toBe(false);
    });

    it('✅ Valida mínima secuencia fibonacci válida [0, 1, 1]', () => {
      expect(FibonacciPatternEngine.validateConvergence([0, 1, 1])).toBe(true);
    });

    it('🛡️ CASO BORDE: Secuencia con error en medio es detectada', () => {
      const sequenceWithError = [0, 1, 1, 2, 3, 6, 8, 13]; // 6 debería ser 5
      expect(FibonacciPatternEngine.validateConvergence(sequenceWithError)).toBe(false);
    });

    it('🛡️ CASO BORDE: Secuencia vacía retorna false', () => {
      expect(FibonacciPatternEngine.validateConvergence([])).toBe(false);
    });

    it('✅ DETERMINISMO: Mismo resultado para misma validación', () => {
      const sequence = [0, 1, 1, 2, 3, 5, 8, 13];
      const result1 = FibonacciPatternEngine.validateConvergence(sequence);
      const result2 = FibonacciPatternEngine.validateConvergence(sequence);
      const result3 = FibonacciPatternEngine.validateConvergence(sequence);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('generateEvolutionaryPattern()', () => {
    it('✅ Genera patrón evolutivo completo con timestamp', () => {
      const timestamp = 1729612800000; // Timestamp fijo
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(timestamp);
      
      expect(pattern).toBeDefined();
      expect(pattern.fibonacciSequence).toBeDefined();
      expect(Array.isArray(pattern.fibonacciSequence)).toBe(true);
      expect(pattern.fibonacciSequence.length).toBeGreaterThan(0);
    });

    it('✅ DETERMINISMO: Mismo timestamp genera mismo patrón', () => {
      const timestamp = 1234567890000;
      const pattern1 = FibonacciPatternEngine.generateEvolutionaryPattern(timestamp);
      const pattern2 = FibonacciPatternEngine.generateEvolutionaryPattern(timestamp);
      
      expect(pattern1).toEqual(pattern2);
    });

    it('✅ Diferentes timestamps generan patrones diferentes', () => {
      const pattern1 = FibonacciPatternEngine.generateEvolutionaryPattern(1000000000000);
      const pattern2 = FibonacciPatternEngine.generateEvolutionaryPattern(2000000000000);
      
      // Las secuencias deberían ser diferentes
      expect(pattern1.fibonacciSequence).not.toEqual(pattern2.fibonacciSequence);
    });

    it('✅ Patrón generado tiene ratio de armonía válido (0-1)', () => {
      const timestamp = Date.now();
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(timestamp);
      
      // Calcular harmony del pattern generado
      const harmony = FibonacciPatternEngine.calculateHarmonyRatio(pattern.fibonacciSequence);
      expect(harmony).toBeGreaterThanOrEqual(0);
      expect(harmony).toBeLessThanOrEqual(1);
    });

    it('✅ Secuencia generada es válida fibonacci', () => {
      const timestamp = Date.now();
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(timestamp);
      
      const isValid = FibonacciPatternEngine.validateConvergence(pattern.fibonacciSequence);
      expect(isValid).toBe(true);
    });

    it('🛡️ CASO BORDE: Timestamp negativo no crashea', () => {
      expect(() => {
        FibonacciPatternEngine.generateEvolutionaryPattern(-1000000);
      }).not.toThrow();
    });

    it('🛡️ CASO BORDE: Timestamp 0 no crashea', () => {
      expect(() => {
        FibonacciPatternEngine.generateEvolutionaryPattern(0);
      }).not.toThrow();
    });

    it('🛡️ CASO BORDE: Timestamp muy grande no crashea', () => {
      expect(() => {
        FibonacciPatternEngine.generateEvolutionaryPattern(9999999999999);
      }).not.toThrow();
    });
  });

  describe('🔥 PERFORMANCE & CACHING', () => {
    it('⚡ Generación de secuencia es rápida (< 10ms para limit 1000)', () => {
      const start = performance.now();
      FibonacciPatternEngine.generateFibonacciSequence(1000);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10);
    });

    it('⚡ Cache acelera retrieval (10x más rápido)', () => {
      // Primera llamada sin cache
      const start1 = performance.now();
      FibonacciPatternEngine.generateFibonacciSequence(5000);
      const duration1 = performance.now() - start1;
      
      // Segunda llamada con cache
      const start2 = performance.now();
      FibonacciPatternEngine.generateFibonacciSequence(5000);
      const duration2 = performance.now() - start2;
      
      expect(duration2).toBeLessThan(duration1 / 10); // Al menos 10x más rápido
    });

    it('⚡ calculateHarmonyRatio es rápido (< 5ms para 100 elementos)', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(10000);
      
      const start = performance.now();
      FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(5);
    });
  });

  describe('🧬 INTEGRACIÓN CON EVOLUTIONARY PATTERN', () => {
    it('✅ Patrón generado tiene todas las propiedades requeridas', () => {
      const timestamp = Date.now();
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(timestamp);
      
      // Verificar propiedades obligatorias
      expect(pattern).toHaveProperty('fibonacciSequence');
      expect(pattern.fibonacciSequence.length).toBeGreaterThan(0);
      
      // La secuencia debe ser fibonacci válida
      const isValid = FibonacciPatternEngine.validateConvergence(pattern.fibonacciSequence);
      expect(isValid).toBe(true);
    });

    it('✅ Múltiples patrones en ráfaga mantienen determinismo', () => {
      const timestamps = [1000, 2000, 3000, 4000, 5000];
      const patterns1 = timestamps.map(ts => FibonacciPatternEngine.generateEvolutionaryPattern(ts));
      const patterns2 = timestamps.map(ts => FibonacciPatternEngine.generateEvolutionaryPattern(ts));
      
      expect(patterns1).toEqual(patterns2);
    });
  });
});

