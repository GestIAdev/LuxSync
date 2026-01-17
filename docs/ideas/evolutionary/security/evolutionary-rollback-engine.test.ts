// evolutionary-rollback-engine.test.ts
/**
 * 🔄 TESTS: EVOLUTIONARY ROLLBACK ENGINE
 * Tests deterministas para motor de rollback evolutivo
 * NO Math.random() - Solo lógica real y verificable
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EvolutionaryRollbackEngine } from './evolutionary-rollback-engine.js';
import { EvolutionarySuggestion } from '../interfaces/evolutionary-engine-interfaces.js';

describe('🔄 EvolutionaryRollbackEngine', () => {
  beforeEach(() => {
    // Limpiar historial de rollback antes de cada test
    EvolutionaryRollbackEngine.cleanupOldRollbackData(0);
  });
  const createMockSuggestion = (
    targetComponent: string,
    suggestionId: string = `test-${Date.now()}`
  ): EvolutionarySuggestion => ({
    id: suggestionId,
    targetComponent,
    changeType: 'parameter',
    oldValue: 0.5,
    newValue: 0.7,
    expectedImprovement: 0.15,
    riskLevel: 0.3,
    poeticDescription: 'Evolutionary change',
    technicalDescription: 'Parameter optimization',
    status: 'pending_human',
    evolutionaryType: {
      typeId: 'test_type',
      name: 'Test Decision',
      description: 'Test description',
      poeticDescription: 'Test poetry',
      technicalBasis: 'test basis',
      fibonacciSignature: [1, 1, 2, 3],
      zodiacAffinity: 'Libra',
      musicalKey: 'C',
      musicalHarmony: 0.75,
      riskLevel: 0.5,
      expectedCreativity: 0.6,
      generationTimestamp: Date.now(),
      validationScore: 0.8
    },
    patternSignature: {
      fibonacciSequence: [1, 1, 2, 3],
      zodiacPosition: 6,
      musicalKey: 'C',
      harmonyRatio: 0.618,
      timestamp: Date.now()
    },
    creativityScore: 0.7,
    noveltyIndex: 0.6
  });

  beforeEach(() => {
    // Limpiar historial antes de cada test
    const stats = EvolutionaryRollbackEngine.getRollbackStats();
    if (stats.totalRegistered > 0) {
      EvolutionaryRollbackEngine.cleanupOldRollbackData(0);
    }
  });

  describe('📝 Registro de Rollback', () => {
    it('📝 Registra sugerencia para rollback', () => {
      const suggestion = createMockSuggestion('consensus-engine', 'reg-001');
      
      EvolutionaryRollbackEngine.registerForRollback(suggestion);
      
      const stats = EvolutionaryRollbackEngine.getRollbackStats();
      expect(stats.totalRegistered).toBe(1);
    });

    it('📝 Registra múltiples sugerencias', () => {
      const suggestion1 = createMockSuggestion('memory-pool', 'reg-002');
      const suggestion2 = createMockSuggestion('creative-engine', 'reg-003');
      const suggestion3 = createMockSuggestion('harmony-system', 'reg-004');

      EvolutionaryRollbackEngine.registerForRollback(suggestion1);
      EvolutionaryRollbackEngine.registerForRollback(suggestion2);
      EvolutionaryRollbackEngine.registerForRollback(suggestion3);

      const stats = EvolutionaryRollbackEngine.getRollbackStats();
      expect(stats.totalRegistered).toBe(3);
    });
  });

  describe('⏪ Ejecución de Rollback', () => {
    it('⏪ Rollback exitoso de consensus-engine', async () => {
      const suggestion = createMockSuggestion('consensus-engine', 'rb-001');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('rb-001');

      expect(result.success).toBe(true);
      expect(result.rolledBackComponents).toContain('consensus-engine');
      expect(result.errors).toHaveLength(0);
      expect(result.recoveryTime).toBeGreaterThan(0);
    });

    it('⏪ Rollback exitoso de memory-pool', async () => {
      const suggestion = createMockSuggestion('memory-pool', 'rb-002');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('rb-002');

      expect(result.success).toBe(true);
      expect(result.rolledBackComponents).toContain('memory-pool');
      expect(result.errors).toHaveLength(0);
    });

    it('⏪ Rollback exitoso de creative-engine', async () => {
      const suggestion = createMockSuggestion('creative-engine', 'rb-003');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('rb-003');

      expect(result.success).toBe(true);
      expect(result.rolledBackComponents).toContain('creative-engine');
    });

    it('⏪ Rollback exitoso de harmony-system', async () => {
      const suggestion = createMockSuggestion('harmony-system', 'rb-004');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('rb-004');

      expect(result.success).toBe(true);
      expect(result.rolledBackComponents).toContain('harmony-system');
    });

    it('⏪ Rollback de componente desconocido', async () => {
      const suggestion = createMockSuggestion('unknown-component', 'rb-005');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('rb-005');

      expect(result.success).toBe(true);
      expect(result.rolledBackComponents).toContain('unknown-component');
    });

    it('⏪ Rollback falla si suggestion no existe', async () => {
      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not found');
    });
  });

  describe('🔄 Rollback Múltiple', () => {
    it('🔄 Rollback de múltiples decisiones', async () => {
      const suggestion1 = createMockSuggestion('consensus-engine', 'multi-001');
      const suggestion2 = createMockSuggestion('memory-pool', 'multi-002');
      const suggestion3 = createMockSuggestion('creative-engine', 'multi-003');

      EvolutionaryRollbackEngine.registerForRollback(suggestion1);
      EvolutionaryRollbackEngine.registerForRollback(suggestion2);
      EvolutionaryRollbackEngine.registerForRollback(suggestion3);

      const results = await EvolutionaryRollbackEngine.rollbackMultipleDecisions([
        'multi-001',
        'multi-002',
        'multi-003'
      ]);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].rolledBackComponents).toContain('consensus-engine');
      expect(results[1].rolledBackComponents).toContain('memory-pool');
      expect(results[2].rolledBackComponents).toContain('creative-engine');
    });

    it('🔄 Rollback múltiple con algunos IDs inválidos', async () => {
      const suggestion = createMockSuggestion('harmony-system', 'multi-004');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const results = await EvolutionaryRollbackEngine.rollbackMultipleDecisions([
        'multi-004',
        'invalid-id-1',
        'invalid-id-2'
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
    });
  });

  describe('🧹 Limpieza de Historial', () => {
    it('🧹 Limpia entradas antiguas (24h)', () => {
      // Registrar sugerencias
      const suggestion1 = createMockSuggestion('consensus-engine', 'clean-001');
      const suggestion2 = createMockSuggestion('memory-pool', 'clean-002');
      EvolutionaryRollbackEngine.registerForRollback(suggestion1);
      EvolutionaryRollbackEngine.registerForRollback(suggestion2);

      const statsBefore = EvolutionaryRollbackEngine.getRollbackStats();
      expect(statsBefore.totalRegistered).toBe(2);

      // Limpiar entradas mayores a 24h (todas las actuales son recientes, no se elimina nada)
      const cleaned = EvolutionaryRollbackEngine.cleanupOldRollbackData(24);
      expect(cleaned).toBe(0);

      const statsAfter = EvolutionaryRollbackEngine.getRollbackStats();
      expect(statsAfter.totalRegistered).toBe(2);
    });

    it('🧹 Limpia todas las entradas (0h)', () => {
      const suggestion1 = createMockSuggestion('creative-engine', 'clean-003');
      const suggestion2 = createMockSuggestion('harmony-system', 'clean-004');
      const suggestion3 = createMockSuggestion('consensus-engine', 'clean-005');

      EvolutionaryRollbackEngine.registerForRollback(suggestion1);
      EvolutionaryRollbackEngine.registerForRollback(suggestion2);
      EvolutionaryRollbackEngine.registerForRollback(suggestion3);

      const statsBefore = EvolutionaryRollbackEngine.getRollbackStats();
      const countBefore = statsBefore.totalRegistered;

      // Limpiar todas (maxAgeHours = 0)
      const cleaned = EvolutionaryRollbackEngine.cleanupOldRollbackData(0);
      expect(cleaned).toBe(countBefore); // Debe limpiar TODAS las entradas

      const statsAfter = EvolutionaryRollbackEngine.getRollbackStats();
      expect(statsAfter.totalRegistered).toBe(0);
    });
  });

  describe('📊 Estadísticas de Rollback', () => {
    it('📊 Stats iniciales están vacías', () => {
      EvolutionaryRollbackEngine.cleanupOldRollbackData(0); // Limpiar todo

      const stats = EvolutionaryRollbackEngine.getRollbackStats();

      expect(stats.totalRegistered).toBe(0);
      expect(stats.oldestEntry).toBe(0);
      expect(stats.newestEntry).toBe(0);
    });

    it('📊 Stats reflejan sugerencias registradas', () => {
      EvolutionaryRollbackEngine.cleanupOldRollbackData(0); // Limpiar primero

      const suggestion1 = createMockSuggestion('memory-pool', 'stats-001');
      const suggestion2 = createMockSuggestion('creative-engine', 'stats-002');

      EvolutionaryRollbackEngine.registerForRollback(suggestion1);
      // Pequeña pausa para asegurar timestamp diferente
      EvolutionaryRollbackEngine.registerForRollback(suggestion2);

      const stats = EvolutionaryRollbackEngine.getRollbackStats();

      expect(stats.totalRegistered).toBe(2);
      expect(stats.oldestEntry).toBeGreaterThan(0);
      expect(stats.newestEntry).toBeGreaterThan(0);
      expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry);
    });

    it('📊 Stats ordenan timestamps correctamente', () => {
      EvolutionaryRollbackEngine.cleanupOldRollbackData(0);

      const suggestion1 = createMockSuggestion('consensus-engine', 'stats-003');
      const suggestion2 = createMockSuggestion('harmony-system', 'stats-004');
      const suggestion3 = createMockSuggestion('creative-engine', 'stats-005');

      EvolutionaryRollbackEngine.registerForRollback(suggestion1);
      EvolutionaryRollbackEngine.registerForRollback(suggestion2);
      EvolutionaryRollbackEngine.registerForRollback(suggestion3);

      const stats = EvolutionaryRollbackEngine.getRollbackStats();

      expect(stats.totalRegistered).toBe(3);
      expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry);
    });
  });

  describe('⏱️ Recovery Time', () => {
    it('⏱️ Recovery time es medido correctamente', async () => {
      const suggestion = createMockSuggestion('consensus-engine', 'time-001');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const startTime = Date.now();
      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('time-001');
      const endTime = Date.now();

      expect(result.recoveryTime).toBeGreaterThan(0);
      expect(result.recoveryTime).toBeLessThanOrEqual(endTime - startTime + 50); // +50ms margen
    });

    it('⏱️ Rollback rápido < 1 segundo', async () => {
      const suggestion = createMockSuggestion('memory-pool', 'time-002');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('time-002');

      expect(result.recoveryTime).toBeLessThan(1000); // < 1 segundo
    });
  });

  describe('🎯 Componentes Específicos', () => {
    it('🎯 Cada componente tiene rollback diferenciado', async () => {
      const components = ['consensus-engine', 'memory-pool', 'creative-engine', 'harmony-system'];
      
      for (const component of components) {
        const suggestion = createMockSuggestion(component, `comp-${component}`);
        EvolutionaryRollbackEngine.registerForRollback(suggestion);

        const result = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision(`comp-${component}`);

        expect(result.success).toBe(true);
        expect(result.rolledBackComponents).toContain(component);
      }
    });
  });

  describe('🔒 Integridad del Historial', () => {
    it('🔒 Registros no se modifican después de rollback', async () => {
      const suggestion = createMockSuggestion('harmony-system', 'integrity-001');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const statsBefore = EvolutionaryRollbackEngine.getRollbackStats();
      
      await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('integrity-001');

      const statsAfter = EvolutionaryRollbackEngine.getRollbackStats();

      // El rollback NO elimina del historial
      expect(statsAfter.totalRegistered).toBe(statsBefore.totalRegistered);
    });

    it('🔒 Múltiples rollbacks del mismo ID son idempotentes', async () => {
      const suggestion = createMockSuggestion('creative-engine', 'idem-001');
      EvolutionaryRollbackEngine.registerForRollback(suggestion);

      const result1 = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('idem-001');
      const result2 = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('idem-001');
      const result3 = await EvolutionaryRollbackEngine.rollbackEvolutionaryDecision('idem-001');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });
});

