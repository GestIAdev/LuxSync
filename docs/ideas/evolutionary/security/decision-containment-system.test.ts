// decision-containment-system.test.ts
/**
 * 🏰 TESTS: DECISION CONTAINMENT SYSTEM
 * Tests deterministas para sistema de contención
 * NO Math.random() - Solo lógica real y verificable
 */

import { describe, it, expect, vi } from 'vitest';
import { DecisionContainmentSystem } from './decision-containment-system.js';
import { EvolutionarySuggestion } from '../interfaces/evolutionary-engine-interfaces.js';

describe('🏰 DecisionContainmentSystem', () => {
  const createMockSuggestion = (targetComponent: string, suggestionId: string = 'test-001'): EvolutionarySuggestion => ({
    id: suggestionId,
    targetComponent,
    changeType: 'parameter',
    oldValue: 0.5,
    newValue: 0.7,
    expectedImprovement: 0.15,
    riskLevel: 0.3,
    poeticDescription: 'Test poetic description',
    technicalDescription: 'Test technical description',
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

  describe('🔓 Contención: NONE', () => {
    it('🔓 Sin contención no aplica acciones', () => {
      const suggestion = createMockSuggestion('consensus-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'none');

      expect(result.contained).toBe(false);
      expect(result.containmentActions).toContain('No containment applied');
      expect(result.rollbackPlan).toHaveLength(0);
      expect(result.monitoringLevel).toBe('none');
    });
  });

  describe('🟡 Contención: LOW', () => {
    it('🟡 Contención baja aplica rate limiting y logging', () => {
      const suggestion = createMockSuggestion('memory-pool');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'low');

      expect(result.contained).toBe(true);
      expect(result.containmentActions).toContain('Apply rate limiting to decision application');
      expect(result.containmentActions).toContain('Log decision execution for review');
      expect(result.rollbackPlan.length).toBeGreaterThan(0);
      expect(result.monitoringLevel).toBe('basic');
    });
  });

  describe('🟠 Contención: MEDIUM', () => {
    it('🟠 Contención media requiere aprobación humana', () => {
      const suggestion = createMockSuggestion('creative-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'medium');

      expect(result.contained).toBe(true);
      expect(result.containmentActions).toContain('Require human approval for application');
      expect(result.containmentActions).toContain('Isolate decision execution in sandbox');
      expect(result.rollbackPlan).toContain('Automatic rollback if system stability < 80%');
      expect(result.monitoringLevel).toBe('enhanced');
    });

    it('🟠 Memory-pool con medium tiene límite 50%', () => {
      const suggestion = createMockSuggestion('memory-pool');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'medium');

      expect(result.containmentActions.some(a => a.includes('50%'))).toBe(true);
      expect(result.rollbackPlan.some(p => p.includes('Free allocated memory'))).toBe(true);
    });
  });

  describe('🔴 Contención: HIGH', () => {
    it('🔴 Contención alta requiere aprobación dual', () => {
      const suggestion = createMockSuggestion('consensus-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'high');

      expect(result.contained).toBe(true);
      expect(result.containmentActions).toContain('Require dual human approval');
      expect(result.containmentActions).toContain('Execute in isolated environment');
      expect(result.containmentActions).toContain('Disable parallel decision execution');
      expect(result.rollbackPlan).toContain('Immediate rollback on any error');
      expect(result.monitoringLevel).toBe('intensive');
    });

    it('🔴 Consensus-engine con high desactiva voting', () => {
      const suggestion = createMockSuggestion('consensus-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'high');

      expect(result.containmentActions.some(a => a.includes('Disable consensus voting'))).toBe(true);
      expect(result.rollbackPlan.some(p => p.includes('Restore consensus engine'))).toBe(true);
    });

    it('🔴 Creative-engine con high se desactiva temporalmente', () => {
      const suggestion = createMockSuggestion('creative-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'high');

      expect(result.containmentActions.some(a => a.includes('Disable creative engine'))).toBe(true);
      expect(result.rollbackPlan.some(p => p.includes('Restart creative engine'))).toBe(true);
    });
  });

  describe('⛔ Contención: MAXIMUM', () => {
    it('⛔ Contención máxima bloquea ejecución completamente', () => {
      const suggestion = createMockSuggestion('harmony-system');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'maximum');

      expect(result.contained).toBe(true);
      expect(result.containmentActions).toContain('Block decision execution completely');
      expect(result.containmentActions).toContain('Flag for human review only');
      expect(result.containmentActions).toContain('Quarantine related patterns');
      expect(result.rollbackPlan).toContain('Full system rollback to last stable state');
      expect(result.rollbackPlan).toContain('Disable evolutionary engine temporarily');
      expect(result.monitoringLevel).toBe('intensive');
    });
  });

  describe('🎯 Contención por Componente', () => {
    it('🎯 Harmony-system aplica dampening filters', () => {
      const suggestion = createMockSuggestion('harmony-system');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'medium');

      expect(result.containmentActions.some(a => a.includes('harmony dampening'))).toBe(true);
      expect(result.rollbackPlan.some(p => p.includes('Remove harmony filters'))).toBe(true);
    });

    it('🎯 Componente desconocido recibe contención genérica', () => {
      const suggestion = createMockSuggestion('unknown-component');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'medium');

      expect(result.containmentActions.some(a => a.includes('generic containment'))).toBe(true);
      expect(result.rollbackPlan.some(p => p.includes('Revert changes'))).toBe(true);
    });
  });

  describe('✅ Verificación de Contención', () => {
    it('✅ Verifica contención activa', () => {
      const suggestion = createMockSuggestion('creative-engine');
      const containment = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'high');

      const verified = DecisionContainmentSystem.verifyContainment(suggestion, containment);

      expect(verified).toBe(true);
    });

    it('✅ Verifica contención inactiva', () => {
      const suggestion = createMockSuggestion('memory-pool');
      const containment = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'none');

      const verified = DecisionContainmentSystem.verifyContainment(suggestion, containment);

      expect(verified).toBe(false);
    });
  });

  describe('🔄 Ejecución de Rollback', () => {
    it('🔄 Ejecuta rollback exitosamente', async () => {
      const suggestion = createMockSuggestion('consensus-engine');
      const rollbackPlan = [
        'Revert decision if performance impact > 5%',
        'Automatic rollback if system stability < 80%'
      ];

      const success = await DecisionContainmentSystem.executeContainmentRollback(suggestion, rollbackPlan);

      expect(success).toBe(true);
    });

    it('🔄 Rollback procesa múltiples acciones', async () => {
      const suggestion = createMockSuggestion('harmony-system');
      const rollbackPlan = [
        'Immediate rollback on any error',
        'Revert if system metrics degrade > 20%',
        'Isolate affected components',
        'Full system rollback to last stable state'
      ];

      const success = await DecisionContainmentSystem.executeContainmentRollback(suggestion, rollbackPlan);

      expect(success).toBe(true);
    });

    it('🔄 Rollback vacío completa inmediatamente', async () => {
      const suggestion = createMockSuggestion('memory-pool');
      const rollbackPlan: string[] = [];

      const success = await DecisionContainmentSystem.executeContainmentRollback(suggestion, rollbackPlan);

      expect(success).toBe(true);
    });
  });

  describe('📊 Niveles de Monitoreo', () => {
    it('📊 None no requiere monitoreo', () => {
      const suggestion = createMockSuggestion('creative-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'none');

      expect(result.monitoringLevel).toBe('none');
    });

    it('📊 Low requiere monitoreo básico', () => {
      const suggestion = createMockSuggestion('consensus-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'low');

      expect(result.monitoringLevel).toBe('basic');
    });

    it('📊 Medium requiere monitoreo enhanced', () => {
      const suggestion = createMockSuggestion('harmony-system');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'medium');

      expect(result.monitoringLevel).toBe('enhanced');
    });

    it('📊 High y Maximum requieren monitoreo intensivo', () => {
      const suggestion1 = createMockSuggestion('memory-pool');
      const result1 = DecisionContainmentSystem.containEvolutionaryDecision(suggestion1, 'high');

      const suggestion2 = createMockSuggestion('creative-engine');
      const result2 = DecisionContainmentSystem.containEvolutionaryDecision(suggestion2, 'maximum');

      expect(result1.monitoringLevel).toBe('intensive');
      expect(result2.monitoringLevel).toBe('intensive');
    });
  });

  describe('🔥 Contención Específica por Target', () => {
    it('🔥 Creative-engine con LOW aplica throttling', () => {
      const suggestion = createMockSuggestion('creative-engine');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'low');

      expect(result.containmentActions.some(a => a.includes('Throttle creative generation rate'))).toBe(true);
    });

    it('🔥 Memory-pool no tiene acciones específicas en LOW', () => {
      const suggestion = createMockSuggestion('memory-pool');
      const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'low');

      // Solo acciones genéricas de LOW, no específicas del componente
      expect(result.containmentActions.filter(a => a.includes('memory')).length).toBe(0);
    });

    it('🔥 Todos los componentes reciben contención genérica en NONE', () => {
      const components = ['consensus-engine', 'memory-pool', 'creative-engine', 'harmony-system', 'unknown'];

      components.forEach(component => {
        const suggestion = createMockSuggestion(component);
        const result = DecisionContainmentSystem.containEvolutionaryDecision(suggestion, 'none');

        expect(result.contained).toBe(false);
        expect(result.containmentActions).toContain('No containment applied');
      });
    });
  });
});

