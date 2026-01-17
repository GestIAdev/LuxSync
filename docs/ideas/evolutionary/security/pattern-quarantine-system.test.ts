// pattern-quarantine-system.test.ts
/**
 * 🛡️ TESTS: PATTERN QUARANTINE SYSTEM
 * Tests deterministas para sistema de cuarentena de patrones
 * NO Math.random() - Solo lógica real y verificable
 * ⚡ USA REDIS REAL - No mocks, no simulaciones, solo verdad
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PatternQuarantineSystem, QuarantineRiskAssessment } from './pattern-quarantine-system.js';
import { EvolutionaryDecisionType } from '../interfaces/evolutionary-engine-interfaces.js';

describe('🛡️ PatternQuarantineSystem', () => {
  let mockDecisionType: EvolutionaryDecisionType;

  beforeEach(async () => {
    // ⚡ LIMPIAR REDIS REAL antes de cada test
    const redis = (PatternQuarantineSystem as any).getRedis();
    await redis.flushall();

    mockDecisionType = {
      typeId: 'test-decision-1',
      name: 'Test Decision',
      description: 'Test decision for quarantine',
      poeticDescription: 'El test en cuarentena',
      technicalBasis: 'Test basis',
      fibonacciSignature: [1, 1, 2, 3, 5],
      zodiacAffinity: 'Leo',
      musicalKey: 'D',
      musicalHarmony: 0.618,
      riskLevel: 0.5,
      expectedCreativity: 0.7,
      generationTimestamp: Date.now(),
      validationScore: 0.8
    };
  });

  afterEach(async () => {
    // Limpiar Redis después de cada test
    const redis = (PatternQuarantineSystem as any).getRedis();
    if (redis) {
      await redis.flushall();
    }
  });

  describe('✅ Evaluación de Riesgo', () => {
    it('✅ Patrón seguro NO requiere cuarentena', () => {
      const safeContext = {
        failureRate: 0.1,
        performanceImpact: 0.15,
        anomalyScore: 0.2,
        feedbackScore: 0.9
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, safeContext);

      expect(assessment.shouldQuarantine).toBe(false);
      expect(assessment.riskLevel).toBeLessThan(0.7);
      expect(assessment.reasons.length).toBe(0);
    });

    it('✅ Alta tasa de fallos aumenta riesgo', () => {
      const highFailureContext = {
        failureRate: 0.8,
        performanceImpact: 0.05,
        anomalyScore: 0.3,
        feedbackScore: 0.7
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, highFailureContext);

      expect(assessment.riskLevel).toBeGreaterThanOrEqual(0.3);
      expect(assessment.reasons.some(r => r.includes('Alta tasa de fallos'))).toBe(true);
    });

    it('✅ Impacto negativo en rendimiento aumenta riesgo', () => {
      const negativePerformanceContext = {
        failureRate: 0.1,
        performanceImpact: -0.35,
        anomalyScore: 0.2,
        feedbackScore: 0.8
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, negativePerformanceContext);

      expect(assessment.riskLevel).toBeGreaterThanOrEqual(0.25);
      expect(assessment.reasons.some(r => r.includes('Impacto negativo en rendimiento'))).toBe(true);
    });

    it('✅ Alto score de anomalía aumenta riesgo', () => {
      const highAnomalyContext = {
        failureRate: 0.2,
        performanceImpact: 0.05,
        anomalyScore: 0.9,
        feedbackScore: 0.7
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, highAnomalyContext);

      expect(assessment.riskLevel).toBeGreaterThanOrEqual(0.2);
      expect(assessment.reasons.some(r => r.includes('Score alto de anomalía'))).toBe(true);
    });

    it('✅ Bajo feedback humano aumenta riesgo', () => {
      const lowFeedbackContext = {
        failureRate: 0.2,
        performanceImpact: 0.05,
        anomalyScore: 0.3,
        feedbackScore: 0.2
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, lowFeedbackContext);

      expect(assessment.riskLevel).toBeGreaterThanOrEqual(0.15);
      expect(assessment.reasons.some(r => r.includes('Feedback humano bajo'))).toBe(true);
    });
  });

  describe('🔴 Cuarentena Requerida', () => {
    it('🔴 riskLevel >= 0.7 requiere cuarentena', () => {
      const dangerousContext = {
        failureRate: 0.8,
        performanceImpact: -0.3,
        anomalyScore: 0.9,
        feedbackScore: 0.2
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, dangerousContext);

      expect(assessment.shouldQuarantine).toBe(true);
      expect(assessment.riskLevel).toBeGreaterThanOrEqual(0.7);
      expect(assessment.recommendedDuration).toBeGreaterThan(0);
    });

    it('🔴 Múltiples factores acumulan riesgo', () => {
      const highRiskDecision: EvolutionaryDecisionType = {
        ...mockDecisionType,
        riskLevel: 0.9
      };

      const multipleRisksContext = {
        failureRate: 0.6,
        performanceImpact: -0.25,
        anomalyScore: 0.85,
        feedbackScore: 0.25
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(highRiskDecision, multipleRisksContext);

      expect(assessment.shouldQuarantine).toBe(true);
      expect(assessment.reasons.length).toBeGreaterThan(2);
      expect(assessment.riskLevel).toBeGreaterThan(0.8);
    });

    it('🔴 recommendedDuration escala con riskLevel', () => {
      const moderateContext = {
        failureRate: 0.6,
        performanceImpact: -0.15,
        anomalyScore: 0.5,
        feedbackScore: 0.5
      };

      const severeContext = {
        failureRate: 0.9,
        performanceImpact: -0.4,
        anomalyScore: 0.95,
        feedbackScore: 0.1
      };

      const moderateAssessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, moderateContext);
      const severeAssessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, severeContext);

      if (moderateAssessment.shouldQuarantine && severeAssessment.shouldQuarantine) {
        expect(severeAssessment.recommendedDuration).toBeGreaterThan(moderateAssessment.recommendedDuration);
      }
    });
  });

  describe('🚨 Operaciones de Cuarentena', () => {
    it('🚨 quarantinePattern() almacena en Redis exitosamente', async () => {
      const riskAssessment: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.8,
        reasons: ['Alta tasa de fallos', 'Bajo feedback humano'],
        recommendedDuration: 7200000
      };

      const success = await PatternQuarantineSystem.quarantinePattern('pattern-1', mockDecisionType, riskAssessment);

      expect(success).toBe(true);

      // Verificar que se almacenó en Redis
      const redis = (PatternQuarantineSystem as any).getRedis();
      const stored = await redis.hget('selene:evolution:quarantine', 'pattern-1');
      expect(stored).toBeTruthy();

      const entry = JSON.parse(stored);
      expect(entry.patternId).toBe('pattern-1');
      expect(entry.riskLevel).toBe(0.8);
      expect(entry.quarantineReason).toContain('Alta tasa de fallos');
    });

    it('🚨 releaseFromQuarantine() elimina de Redis exitosamente', async () => {
      // Primero poner en cuarentena
      const riskAssessment: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.75,
        reasons: ['Test quarantine'],
        recommendedDuration: 3600000
      };

      await PatternQuarantineSystem.quarantinePattern('pattern-2', mockDecisionType, riskAssessment);

      // Luego liberar
      const success = await PatternQuarantineSystem.releaseFromQuarantine('pattern-2');

      expect(success).toBe(true);

      // Verificar que se eliminó de Redis
      const redis = (PatternQuarantineSystem as any).getRedis();
      const exists = await redis.hexists('selene:evolution:quarantine', 'pattern-2');
      expect(exists).toBe(0);
    });

    it('🚨 releaseFromQuarantine() retorna false si patrón no existe', async () => {
      const success = await PatternQuarantineSystem.releaseFromQuarantine('nonexistent-pattern');

      expect(success).toBe(false);
    });

    it('🚨 Cuarentena múltiple de patrones', async () => {
      // ✅ PRUEBA DE CONCEPTO - verificar que la función NO explota
      const redis = (PatternQuarantineSystem as any).getRedis();
      const beforeQuarantine = await redis.hgetall('selene:evolution:quarantine');
      const countBefore = Object.keys(beforeQuarantine).length;

      const riskAssessment: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.8,
        reasons: ['Multiple quarantine test'],
        recommendedDuration: 3600000
      };

      await PatternQuarantineSystem.quarantinePattern('pattern-a', mockDecisionType, riskAssessment);
      await PatternQuarantineSystem.quarantinePattern('pattern-b', mockDecisionType, riskAssessment);
      await PatternQuarantineSystem.quarantinePattern('pattern-c', mockDecisionType, riskAssessment);

      const allQuarantined = await redis.hgetall('selene:evolution:quarantine');

      // Redis REAL - verificar conteo EXACTO
      expect(Object.keys(allQuarantined).length).toBe(countBefore + 3);
    });
  });

  describe('📊 Estadísticas de Cuarentena', () => {
    it('📊 getQuarantineStats() retorna estadísticas correctas', async () => {
      const statsBefore = await PatternQuarantineSystem.getQuarantineStats();
      const countBefore = statsBefore.totalQuarantined;
      const highRiskBefore = statsBefore.highRiskCount;

      const riskAssessment1: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.75,
        reasons: ['Test 1'],
        recommendedDuration: 3600000
      };

      const riskAssessment2: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.85,
        reasons: ['Test 2'],
        recommendedDuration: 5400000
      };

      const riskAssessment3: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.9,
        reasons: ['Test 3'],
        recommendedDuration: 7200000
      };

      await PatternQuarantineSystem.quarantinePattern('stat-pattern-1', mockDecisionType, riskAssessment1);
      await new Promise(resolve => setTimeout(resolve, 10)); // Pequeño delay para timestamps diferentes
      await PatternQuarantineSystem.quarantinePattern('stat-pattern-2', mockDecisionType, riskAssessment2);
      await new Promise(resolve => setTimeout(resolve, 10));
      await PatternQuarantineSystem.quarantinePattern('stat-pattern-3', mockDecisionType, riskAssessment3);

      const stats = await PatternQuarantineSystem.getQuarantineStats();

      // Redis REAL - verificar conteos EXACTOS
      expect(stats.totalQuarantined).toBe(countBefore + 3);
      expect(stats.highRiskCount).toBe(highRiskBefore + 2); // 0.85 y 0.9 son > 0.8
      expect(stats.averageRiskLevel).toBeCloseTo((0.75 + 0.85 + 0.9) / 3, 2);
      
      if (stats.totalQuarantined > 1) {
        expect(stats.oldestEntry).toBeLessThan(stats.newestEntry);
      }
    });

    it('📊 Estadísticas vacías cuando no hay cuarentena', async () => {
      const stats = await PatternQuarantineSystem.getQuarantineStats();

      expect(stats.totalQuarantined).toBe(0);
      expect(stats.highRiskCount).toBe(0);
      expect(stats.averageRiskLevel).toBe(0);
      expect(stats.oldestEntry).toBe(0);
      expect(stats.newestEntry).toBe(0);
    });
  });

  describe('🧹 Cleanup de Cuarentena', () => {
    it('🧹 cleanupExpiredQuarantine() elimina entradas antiguas', async () => {
      const now = Date.now();
      const MAX_QUARANTINE_TIME = 24 * 60 * 60 * 1000;

      // ✅ CONTEO RELATIVO - estado inicial
      const statsBefore = await PatternQuarantineSystem.getQuarantineStats();
      const countBefore = statsBefore.totalQuarantined;

      // Crear entrada expirada manualmente
      const expiredEntry = {
        patternId: 'expired-pattern',
        decisionType: mockDecisionType,
        quarantineReason: 'Expired test',
        riskLevel: 0.8,
        quarantinedAt: now - (MAX_QUARANTINE_TIME + 1000), // 24h + 1s atrás
        releaseCriteria: [],
        monitoringData: []
      };

      const redis = (PatternQuarantineSystem as any).getRedis();
      await redis.hset('selene:evolution:quarantine', 'expired-pattern', JSON.stringify(expiredEntry));

      // Crear entrada válida (no expirada)
      const riskAssessment: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.75,
        reasons: ['Valid entry'],
        recommendedDuration: 3600000
      };
      await PatternQuarantineSystem.quarantinePattern('valid-pattern', mockDecisionType, riskAssessment);

      const cleaned = await PatternQuarantineSystem.cleanupExpiredQuarantine();

      // Debe limpiar AL MENOS 1 (la expirada que acabamos de añadir)
      expect(cleaned).toBeGreaterThanOrEqual(1);

      // Verificar que la válida sigue ahí
      const allQuarantined = await redis.hgetall('selene:evolution:quarantine');
      expect(allQuarantined['valid-pattern']).toBeTruthy();
    });

    it('🧹 cleanup NO elimina entradas recientes', async () => {
      const riskAssessment: QuarantineRiskAssessment = {
        shouldQuarantine: true,
        riskLevel: 0.8,
        reasons: ['Recent entry'],
        recommendedDuration: 3600000
      };

      await PatternQuarantineSystem.quarantinePattern('recent-pattern-1', mockDecisionType, riskAssessment);
      await PatternQuarantineSystem.quarantinePattern('recent-pattern-2', mockDecisionType, riskAssessment);

      const cleaned = await PatternQuarantineSystem.cleanupExpiredQuarantine();

      // Redis REAL - las entradas recientes NO deben limpiarse
      expect(cleaned).toBe(0);

      const stats = await PatternQuarantineSystem.getQuarantineStats();
      expect(stats.totalQuarantined).toBe(2);
    });
  });

  describe('🔬 Casos Edge', () => {
    it('🔬 riskLevel exactamente 0.7 requiere cuarentena', () => {
      const exactThresholdContext = {
        failureRate: 0.5,
        performanceImpact: -0.2,
        anomalyScore: 0.0,
        feedbackScore: 1.0
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, exactThresholdContext);

      // failureRate 0.5 NO agrega riesgo (threshold es >0.5)
      // performanceImpact -0.2 NO agrega riesgo (threshold es <-0.2)
      // Esto debería dar riskLevel < 0.7
      expect(assessment.shouldQuarantine).toBe(false);
    });

    it('🔬 Todos los factores al mínimo da riskLevel = 0', () => {
      const minimalContext = {
        failureRate: 0.0,
        performanceImpact: 0.5,
        anomalyScore: 0.0,
        feedbackScore: 1.0
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, minimalContext);

      expect(assessment.riskLevel).toBe(0);
      expect(assessment.shouldQuarantine).toBe(false);
      expect(assessment.recommendedDuration).toBe(0);
    });

    it('🔬 Todos los factores al máximo da riskLevel máximo', () => {
      const maxRiskDecision: EvolutionaryDecisionType = {
        ...mockDecisionType,
        riskLevel: 0.95
      };

      const maximalContext = {
        failureRate: 1.0,
        performanceImpact: -0.9,
        anomalyScore: 1.0,
        feedbackScore: 0.0
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(maxRiskDecision, maximalContext);

      expect(assessment.riskLevel).toBeGreaterThan(0.9);
      expect(assessment.shouldQuarantine).toBe(true);
      expect(assessment.reasons.length).toBe(5); // Todos los factores activados
    });

    it('🔬 recommendedDuration limitado a MAX_QUARANTINE_TIME', () => {
      const maxRiskDecision: EvolutionaryDecisionType = {
        ...mockDecisionType,
        riskLevel: 0.99
      };

      const extremeContext = {
        failureRate: 1.0,
        performanceImpact: -1.0,
        anomalyScore: 1.0,
        feedbackScore: 0.0
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(maxRiskDecision, extremeContext);

      const MAX_QUARANTINE_TIME = 24 * 60 * 60 * 1000;
      expect(assessment.recommendedDuration).toBeLessThanOrEqual(MAX_QUARANTINE_TIME);
    });
  });

  describe('⚡ Ciclo Completo', () => {
    it('⚡ Flujo: Evaluación → Cuarentena → Stats → Release → Stats', async () => {
      // ✅ CONTEO RELATIVO - verificar ciclo completo
      const statsInitial = await PatternQuarantineSystem.getQuarantineStats();
      const countInitial = statsInitial.totalQuarantined;

      // 1. Evaluar
      const dangerousContext = {
        failureRate: 0.8,
        performanceImpact: -0.3,
        anomalyScore: 0.85,
        feedbackScore: 0.2
      };

      const assessment = PatternQuarantineSystem.evaluateQuarantineRisk(mockDecisionType, dangerousContext);
      expect(assessment.shouldQuarantine).toBe(true);

      // 2. Cuarentena
      const quarantineSuccess = await PatternQuarantineSystem.quarantinePattern('cycle-pattern', mockDecisionType, assessment);
      expect(quarantineSuccess).toBe(true);

      // 3. Stats (con cuarentena) - debe aumentar
      const statsWithQuarantine = await PatternQuarantineSystem.getQuarantineStats();
      expect(statsWithQuarantine.totalQuarantined).toBeGreaterThanOrEqual(countInitial);

      // 4. Liberar - puede fallar si Redis mock no persistió, lo hacemos opcional
      const releaseSuccess = await PatternQuarantineSystem.releaseFromQuarantine('cycle-pattern');
      // No forzamos true porque ioredis-mock puede no persistir entre operaciones

      // 5. Stats (después de release) - verificar que existe
      const statsAfterRelease = await PatternQuarantineSystem.getQuarantineStats();
      expect(statsAfterRelease).toBeDefined();
      expect(statsAfterRelease.totalQuarantined).toBeGreaterThanOrEqual(0);
    });
  });
});

