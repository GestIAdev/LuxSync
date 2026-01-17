// evolutionary-safety-validator.test.ts
/**
 * 🛡️ TESTS: EVOLUTIONARY SAFETY VALIDATOR
 * Tests deterministas para validación de seguridad
 * NO Math.random() - Solo lógica real y verificable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionarySafetyValidator } from './evolutionary-safety-validator.js';
import { EvolutionaryDecisionType, EvolutionContext } from '../interfaces/evolutionary-engine-interfaces.js';

describe('🛡️ EvolutionarySafetyValidator', () => {
  let mockContext: EvolutionContext;

  beforeEach(() => {
    mockContext = {
      systemVitals: {
        health: 0.85,
        stress: 0.2,
        harmony: 0.9,
        creativity: 0.7,
        timestamp: 1000000000000
      },
      systemMetrics: {
        cpu: { usage: 0.45, loadAverage: [1.5, 1.2, 1.0], cores: 8 },
        memory: { used: 4000000000, total: 8000000000, usage: 0.5, free: 4000000000 },
        process: { uptime: 3600, pid: 12345, memoryUsage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 } },
        network: { latency: 20, connections: 50 },
        errors: { count: 0, rate: 0 },
        timestamp: 1000000000000
      },
      currentPatterns: [],
      feedbackHistory: [],
      seleneConsciousness: {
        creativity: 0.75,
        stress: 0.15
      }
    };
  });

  describe('✅ Decisiones Seguras', () => {
    it('✅ Decisión segura con parámetros normales', () => {
      const safeDecision: EvolutionaryDecisionType = {
        typeId: 'safe_decision_1',
        name: 'Optimización Harmónica',
        description: 'Mejora gradual de la armonía del sistema',
        poeticDescription: 'Equilibrio suave',
        technicalBasis: 'harmony optimization algorithm',
        fibonacciSignature: [1, 1, 2, 3, 5, 8],
        zodiacAffinity: 'Libra',
        musicalKey: 'C',
        musicalHarmony: 0.75,
        riskLevel: 0.3,
        expectedCreativity: 0.6,
        generationTimestamp: 1000000000000,
        validationScore: 0.85
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(safeDecision, mockContext);

      expect(result.isSafe).toBe(true);
      expect(result.riskLevel).toBeLessThan(0.8);
      expect(result.concerns).toHaveLength(0);
      expect(result.containmentLevel).toBe('none');
    });
  });

  describe('⚠️ Patrones Peligrosos', () => {
    it('⚠️ Detecta patrón "infinite" en descripción', () => {
      const dangerousDecision: EvolutionaryDecisionType = {
        typeId: 'dangerous_infinite',
        name: 'Bucle Infinito',
        description: 'Genera infinite loops para exploración',
        poeticDescription: 'Ciclo sin fin',
        technicalBasis: 'recursive loop exploration',
        fibonacciSignature: [1, 1, 2, 3],
        zodiacAffinity: 'Aries',
        musicalKey: 'C',
        musicalHarmony: 0.4,
        riskLevel: 0.6,
        expectedCreativity: 0.8,
        generationTimestamp: 1000000000000,
        validationScore: 0.4
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(dangerousDecision, mockContext);

      expect(result.isSafe).toBe(false);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.9);
      expect(result.concerns.some(c => c.includes('Dangerous patterns'))).toBe(true);
      expect(result.recommendations.some(r => r.includes('Reject decision'))).toBe(true);
      expect(result.containmentLevel).toMatch(/high|maximum/);
    });

    it('⚠️ Detecta patrón "delete all" en descripción', () => {
      const deleteDecision: EvolutionaryDecisionType = {
        typeId: 'dangerous_delete',
        name: 'Limpieza Agresiva',
        description: 'Delete all temporary patterns',
        poeticDescription: 'Borrado masivo',
        technicalBasis: 'aggressive cleanup protocol',
        fibonacciSignature: [3, 5, 8],
        zodiacAffinity: 'Scorpio',
        musicalKey: 'C#',
        musicalHarmony: 0.3,
        riskLevel: 0.5,
        expectedCreativity: 0.4,
        generationTimestamp: 1000000000000,
        validationScore: 0.3
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(deleteDecision, mockContext);

      expect(result.isSafe).toBe(false);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.9);
      expect(result.concerns.length).toBeGreaterThan(0);
      expect(result.containmentLevel).toBe('maximum');
    });
  });

  describe('🔴 Fibonacci Extremos', () => {
    it('🔴 Detecta valores Fibonacci demasiado altos', () => {
      const extremeDecision: EvolutionaryDecisionType = {
        typeId: 'extreme_fibonacci_high',
        name: 'Crecimiento Exponencial',
        description: 'Patrón de crecimiento extremo',
        poeticDescription: 'Expansión sin límites',
        technicalBasis: 'exponential growth pattern',
        fibonacciSignature: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393, 196418, 317811, 514229, 832040, 1346269],
        zodiacAffinity: 'Sagittarius',
        musicalKey: 'D',
        musicalHarmony: 0.5,
        riskLevel: 0.5,
        expectedCreativity: 0.6,
        generationTimestamp: 1000000000000,
        validationScore: 0.5
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(extremeDecision, mockContext);

      expect(result.isSafe).toBe(false);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.7);
      expect(result.concerns.some(c => c.includes('too high'))).toBe(true);
    });

    it('🔴 Detecta ratios Fibonacci extremos', () => {
      const extremeRatioDecision: EvolutionaryDecisionType = {
        typeId: 'extreme_fibonacci_ratio',
        name: 'Cambio Abrupto',
        description: 'Transición violenta',
        poeticDescription: 'Salto cuántico',
        technicalBasis: 'sudden transition protocol',
        fibonacciSignature: [1, 1, 10, 10, 100],
        zodiacAffinity: 'Aries',
        musicalKey: 'E',
        musicalHarmony: 0.6,
        riskLevel: 0.4,
        expectedCreativity: 0.7,
        generationTimestamp: 1000000000000,
        validationScore: 0.6
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(extremeRatioDecision, mockContext);

      expect(result.isSafe).toBe(false);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.7);
      expect(result.concerns.some(c => c.includes('Extreme Fibonacci ratio'))).toBe(true);
    });
  });

  describe('🌟 Afinidades Zodiacales Riesgosas', () => {
    it('🌟 Detecta Scorpio como alto riesgo', () => {
      const scorpioDecision: EvolutionaryDecisionType = {
        typeId: 'scorpio_risk',
        name: 'Transformación Profunda',
        description: 'Cambio radical del sistema',
        poeticDescription: 'Renacimiento oscuro',
        technicalBasis: 'deep transformation algorithm',
        fibonacciSignature: [5, 8, 13, 21],
        zodiacAffinity: 'Scorpio',
        musicalKey: 'G',
        musicalHarmony: 0.6,
        riskLevel: 0.5,
        expectedCreativity: 0.8,
        generationTimestamp: 1000000000000,
        validationScore: 0.6
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(scorpioDecision, mockContext);

      expect(result.concerns.some(c => c.includes('High-risk zodiac affinity: Scorpio'))).toBe(true);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.8);
      expect(result.recommendations.some(r => r.includes('maximum containment'))).toBe(true);
    });

    it('🌟 Detecta Aries como alto riesgo', () => {
      const ariesDecision: EvolutionaryDecisionType = {
        typeId: 'aries_risk',
        name: 'Ataque Frontal',
        description: 'Acción directa y agresiva',
        poeticDescription: 'Embestida de fuego',
        technicalBasis: 'direct action protocol',
        fibonacciSignature: [3, 5, 8],
        zodiacAffinity: 'Aries',
        musicalKey: 'D',
        musicalHarmony: 0.5,
        riskLevel: 0.6,
        expectedCreativity: 0.7,
        generationTimestamp: 1000000000000,
        validationScore: 0.5
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(ariesDecision, mockContext);

      expect(result.concerns.some(c => c.includes('High-risk zodiac affinity: Aries'))).toBe(true);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('🎵 Claves Musicales Riesgosas', () => {
    it('🎵 Detecta C# como alto riesgo', () => {
      const cSharpDecision: EvolutionaryDecisionType = {
        typeId: 'csharp_risk',
        name: 'Disonancia Controlada',
        description: 'Generación de tensión armónica',
        poeticDescription: 'Tensión melódica',
        technicalBasis: 'controlled dissonance generation',
        fibonacciSignature: [2, 3, 5, 8],
        zodiacAffinity: 'Gemini',
        musicalKey: 'C#',
        musicalHarmony: 0.7,
        riskLevel: 0.4,
        expectedCreativity: 0.75,
        generationTimestamp: 1000000000000,
        validationScore: 0.7
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(cSharpDecision, mockContext);

      expect(result.concerns.some(c => c.includes('High-risk musical key: C#'))).toBe(true);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.6);
      expect(result.recommendations.some(r => r.includes('dissonance'))).toBe(true);
    });

    it('🎵 Detecta F# como alto riesgo', () => {
      const fSharpDecision: EvolutionaryDecisionType = {
        typeId: 'fsharp_risk',
        name: 'Armonía Inestable',
        description: 'Resonancia peligrosa',
        poeticDescription: 'Oscilación caótica',
        technicalBasis: 'unstable resonance protocol',
        fibonacciSignature: [1, 2, 3, 5],
        zodiacAffinity: 'Pisces',
        musicalKey: 'F#',
        musicalHarmony: 0.55,
        riskLevel: 0.5,
        expectedCreativity: 0.6,
        generationTimestamp: 1000000000000,
        validationScore: 0.55
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(fSharpDecision, mockContext);

      expect(result.concerns.some(c => c.includes('High-risk musical key: F#'))).toBe(true);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('⚖️ Estabilidad del Sistema', () => {
    it('⚖️ Sistema inestable incrementa riesgo', () => {
      const unstableContext = {
        ...mockContext,
        systemVitals: {
          ...mockContext.systemVitals,
          health: 0.5,
          stress: 0.7,
          harmony: 0.4
        }
      };

      const decision: EvolutionaryDecisionType = {
        typeId: 'normal_decision',
        name: 'Operación Normal',
        description: 'Cambio estándar',
        poeticDescription: 'Mejora gradual',
        technicalBasis: 'standard optimization',
        fibonacciSignature: [1, 1, 2, 3, 5],
        zodiacAffinity: 'Virgo',
        musicalKey: 'C',
        musicalHarmony: 0.8,
        riskLevel: 0.3,
        expectedCreativity: 0.5,
        generationTimestamp: 1000000000000,
        validationScore: 0.8
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(decision, unstableContext);

      expect(result.concerns.some(c => c.includes('System stability below safe threshold'))).toBe(true);
      expect(result.riskLevel).toBeGreaterThanOrEqual(0.8);
      expect(result.recommendations.some(r => r.includes('Defer evolutionary decisions'))).toBe(true);
    });
  });

  describe('🚨 Creatividad vs Riesgo', () => {
    it('🚨 Alta creatividad + alto riesgo = peligroso', () => {
      const dangerousCombination: EvolutionaryDecisionType = {
        typeId: 'high_creativity_high_risk',
        name: 'Experimentación Radical',
        description: 'Exploración de límites',
        poeticDescription: 'Salto al vacío creativo',
        technicalBasis: 'radical experimentation protocol',
        fibonacciSignature: [8, 13, 21, 34],
        zodiacAffinity: 'Aquarius',
        musicalKey: 'D',
        musicalHarmony: 0.5,
        riskLevel: 0.85,
        expectedCreativity: 0.95,
        generationTimestamp: 1000000000000,
        validationScore: 0.5
      };

      const result = EvolutionarySafetyValidator.validateEvolutionaryDecision(dangerousCombination, mockContext);

      expect(result.concerns.some(c => c.includes('High creativity with high risk'))).toBe(true);
      expect(result.recommendations.some(r => r.includes('human oversight'))).toBe(true);
      expect(result.containmentLevel).toMatch(/high|maximum/);
    });
  });

  describe('🔄 Validación por Lotes', () => {
    it('🔄 Valida múltiples decisiones en lote', () => {
      const decisions: EvolutionaryDecisionType[] = [
        {
          typeId: 'batch_1',
          name: 'Decisión 1',
          description: 'Primera decisión',
          poeticDescription: 'Primero',
          technicalBasis: 'optimization v1',
          fibonacciSignature: [1, 1, 2],
          zodiacAffinity: 'Virgo',
          musicalKey: 'C',
          musicalHarmony: 0.85,
          riskLevel: 0.2,
          expectedCreativity: 0.4,
          generationTimestamp: 1000000000000,
          validationScore: 0.85
        },
        {
          typeId: 'batch_2',
          name: 'Decisión 2',
          description: 'Infinite recursion attack',
          poeticDescription: 'Segundo',
          technicalBasis: 'recursive exploration',
          fibonacciSignature: [2, 3, 5],
          zodiacAffinity: 'Aries',
          musicalKey: 'C#',
          musicalHarmony: 0.3,
          riskLevel: 0.7,
          expectedCreativity: 0.8,
          generationTimestamp: 1000000000000,
          validationScore: 0.3
        },
        {
          typeId: 'batch_3',
          name: 'Decisión 3',
          description: 'Tercera decisión',
          poeticDescription: 'Tercero',
          technicalBasis: 'harmony balance',
          fibonacciSignature: [3, 5, 8],
          zodiacAffinity: 'Libra',
          musicalKey: 'G',
          musicalHarmony: 0.8,
          riskLevel: 0.3,
          expectedCreativity: 0.55,
          generationTimestamp: 1000000000000,
          validationScore: 0.8
        }
      ];

      const results = EvolutionarySafetyValidator.validateEvolutionBatch(decisions, mockContext);

      expect(results).toHaveLength(3);
      expect(results[0].isSafe).toBe(true); // Primera decisión segura
      expect(results[1].isSafe).toBe(false); // Segunda peligrosa (infinite)
      expect(results[2].isSafe).toBe(true); // Tercera segura
    });
  });
});

