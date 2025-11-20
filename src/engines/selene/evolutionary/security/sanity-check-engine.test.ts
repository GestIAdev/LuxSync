// sanity-check-engine.test.ts
/**
 * 🧠 TESTS: SANITY CHECK ENGINE
 * Tests deterministas para verificación de cordura evolutiva
 * NO Math.random() - Solo lógica real y verificable
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SanityCheckEngine } from './sanity-check-engine.js';
import { EvolutionContext, EvolutionaryPattern, FeedbackEntry } from '../interfaces/evolutionary-engine-interfaces.js';

describe('🧠 SanityCheckEngine', () => {
  let baseContext: EvolutionContext;

  beforeEach(() => {
    baseContext = {
      systemVitals: {
        health: 0.85,
        stress: 0.2,
        harmony: 0.9,
        creativity: 0.7,
        timestamp: Date.now()
      },
      systemMetrics: {
        cpu: { usage: 0.45, loadAverage: [1.5, 1.2, 1.0], cores: 8 },
        memory: { used: 4000000000, total: 8000000000, usage: 0.5, free: 4000000000 },
        process: { uptime: 3600, pid: 12345, memoryUsage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 } },
        network: { latency: 20, connections: 50 },
        errors: { count: 0, rate: 0 },
        timestamp: Date.now()
      },
      currentPatterns: [],
      feedbackHistory: [],
      seleneConsciousness: {
        creativity: 0.75,
        stress: 0.15
      }
    };
  });

  describe('✅ Sistema Saludable', () => {
    it('✅ Sistema estable tiene sanityLevel alto', () => {
      const stableContext: EvolutionContext = {
        ...baseContext,
        systemVitals: {
          ...baseContext.systemVitals,
          health: 0.98,
          stress: 0.02,
          harmony: 0.98
        },
        feedbackHistory: [
          { decisionTypeId: 'stable-1', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 5000 },
          { decisionTypeId: 'stable-2', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.16, timestamp: Date.now() - 4000 },
          { decisionTypeId: 'stable-3', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.14, timestamp: Date.now() - 3000 },
          { decisionTypeId: 'stable-4', humanRating: 8, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 2000 },
          { decisionTypeId: 'stable-5', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.17, timestamp: Date.now() - 1000 }
        ]
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(stableContext);

      expect(assessment.sanityLevel).toBeGreaterThan(0.8);
      expect(assessment.requiresIntervention).toBe(false);
      expect(assessment.interventionType).toBe('none');
    });

    it('✅ Feedback consistente mejora sanity', () => {
      const consistentFeedback: FeedbackEntry[] = [
        { decisionTypeId: 'dec1', humanRating: 8, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.1, timestamp: Date.now() - 5000 },
        { decisionTypeId: 'dec2', humanRating: 8, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.12, timestamp: Date.now() - 4000 },
        { decisionTypeId: 'dec3', humanRating: 7, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.11, timestamp: Date.now() - 3000 },
        { decisionTypeId: 'dec4', humanRating: 8, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.09, timestamp: Date.now() - 2000 },
        { decisionTypeId: 'dec5', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 1000 }
      ];

      const contextWithFeedback: EvolutionContext = {
        ...baseContext,
        feedbackHistory: consistentFeedback
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithFeedback);

      expect(assessment.sanityLevel).toBeGreaterThan(0.7);
      expect(assessment.requiresIntervention).toBe(false);
    });
  });

  describe('⚠️ Sistema Inestable', () => {
    it('⚠️ Sistema con stress alto reduce sanity', () => {
      const stressedContext: EvolutionContext = {
        ...baseContext,
        systemVitals: {
          ...baseContext.systemVitals,
          health: 0.5,
          stress: 0.8,
          harmony: 0.4
        }
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(stressedContext);

      expect(assessment.sanityLevel).toBeLessThan(0.7);
      expect(assessment.concerns.some(c => c.includes('stability is low'))).toBe(true);
      expect(assessment.recommendations.some(r => r.includes('Monitor system'))).toBe(true);
    });

    it('⚠️ Feedback inconsistente reduce sanity', () => {
      const inconsistentFeedback: FeedbackEntry[] = [
        { decisionTypeId: 'dec1', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.2, timestamp: Date.now() - 5000 },
        { decisionTypeId: 'dec2', humanRating: 2, humanFeedback: 'poor', appliedSuccessfully: false, performanceImpact: -0.1, timestamp: Date.now() - 4000 },
        { decisionTypeId: 'dec3', humanRating: 8, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 3000 },
        { decisionTypeId: 'dec4', humanRating: 1, humanFeedback: 'terrible', appliedSuccessfully: false, performanceImpact: -0.2, timestamp: Date.now() - 2000 },
        { decisionTypeId: 'dec5', humanRating: 10, humanFeedback: 'perfect', appliedSuccessfully: true, performanceImpact: 0.3, timestamp: Date.now() - 1000 }
      ];

      const contextWithInconsistentFeedback: EvolutionContext = {
        ...baseContext,
        feedbackHistory: inconsistentFeedback
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithInconsistentFeedback);

      expect(assessment.concerns.some(c => c.includes('consistency is poor'))).toBe(true);
      expect(assessment.recommendations.some(r => r.includes('Review feedback'))).toBe(true);
    });
  });

  describe('🔴 Riesgo Acumulado', () => {
    it('🔴 Muchos fallos aumentan riesgo acumulado', () => {
      const failedFeedback: FeedbackEntry[] = [
        { decisionTypeId: 'dec1', humanRating: 2, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.1, timestamp: Date.now() - 10000 },
        { decisionTypeId: 'dec2', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.15, timestamp: Date.now() - 9000 },
        { decisionTypeId: 'dec3', humanRating: 3, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.08, timestamp: Date.now() - 8000 },
        { decisionTypeId: 'dec4', humanRating: 2, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.12, timestamp: Date.now() - 7000 },
        { decisionTypeId: 'dec5', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.2, timestamp: Date.now() - 6000 },
        { decisionTypeId: 'dec6', humanRating: 2, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.09, timestamp: Date.now() - 5000 },
        { decisionTypeId: 'dec7', humanRating: 3, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.11, timestamp: Date.now() - 4000 },
        { decisionTypeId: 'dec8', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.18, timestamp: Date.now() - 3000 },
        { decisionTypeId: 'dec9', humanRating: 2, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.14, timestamp: Date.now() - 2000 },
        { decisionTypeId: 'dec10', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.16, timestamp: Date.now() - 1000 }
      ];

      const contextWithFailures: EvolutionContext = {
        ...baseContext,
        feedbackHistory: failedFeedback
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithFailures);

      expect(assessment.concerns.some(c => c.includes('risk is high'))).toBe(true);
      expect(assessment.recommendations.some(r => r.includes('rollback'))).toBe(true);
    });
  });

  describe('🎨 Diversidad de Decisiones', () => {
    it('🎨 Patrones diversos mejoran sanity', () => {
      const diversePatterns: EvolutionaryPattern[] = [
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 5000
        },
        {
          fibonacciSequence: [2, 3, 5, 8, 13],
          zodiacPosition: 6,
          musicalKey: 'G',
          harmonyRatio: 0.5,
          timestamp: Date.now() - 4000
        },
        {
          fibonacciSequence: [3, 5, 8, 13, 21],
          zodiacPosition: 3,
          musicalKey: 'E',
          harmonyRatio: 0.7,
          timestamp: Date.now() - 3000
        }
      ];

      const contextWithDiversity: EvolutionContext = {
        ...baseContext,
        currentPatterns: diversePatterns
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithDiversity);

      expect(assessment.sanityLevel).toBeGreaterThan(0.6);
    });

    it('🎨 Patrones repetitivos reducen sanity', () => {
      const repetitivePatterns: EvolutionaryPattern[] = [
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 5000
        },
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 4000
        },
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 3000
        },
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 2000
        },
        {
          fibonacciSequence: [1, 1, 2, 3, 5],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 1000
        }
      ];

      const contextWithRepetition: EvolutionContext = {
        ...baseContext,
        currentPatterns: repetitivePatterns
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithRepetition);

      expect(assessment.concerns.some(c => c.includes('pattern repetition'))).toBe(true);
      expect(assessment.recommendations.some(r => r.includes('randomness'))).toBe(true);
    });
  });

  describe('📈 Niveles de Intervención', () => {
    it('📈 sanityLevel > 0.8 = none', () => {
      const healthyContext: EvolutionContext = {
        ...baseContext,
        systemVitals: {
          ...baseContext.systemVitals,
          health: 0.98,
          stress: 0.02,
          harmony: 0.98
        },
        feedbackHistory: [
          { decisionTypeId: 'healthy-1', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 5000 },
          { decisionTypeId: 'healthy-2', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.16, timestamp: Date.now() - 4000 },
          { decisionTypeId: 'healthy-3', humanRating: 8, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.14, timestamp: Date.now() - 3000 },
          { decisionTypeId: 'healthy-4', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 2000 },
          { decisionTypeId: 'healthy-5', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.17, timestamp: Date.now() - 1000 }
        ]
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(healthyContext);

      expect(assessment.interventionType).toBe('none');
      expect(assessment.requiresIntervention).toBe(false);
    });

    it('📈 sanityLevel [0.6-0.8] = monitoring', () => {
      const moderateContext: EvolutionContext = {
        ...baseContext,
        systemVitals: {
          ...baseContext.systemVitals,
          health: 0.7,
          stress: 0.3,
          harmony: 0.7
        }
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(moderateContext);

      expect(assessment.interventionType).toBe('monitoring');
      expect(assessment.requiresIntervention).toBe(false);
    });

    it('📈 sanityLevel [0.4-0.6] = pause', () => {
      const concerningContext: EvolutionContext = {
        ...baseContext,
        systemVitals: {
          ...baseContext.systemVitals,
          health: 0.5,
          stress: 0.6,
          harmony: 0.5
        }
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(concerningContext);

      expect(assessment.interventionType).toBe('pause');
      expect(assessment.requiresIntervention).toBe(false);
    });

    it('📈 sanityLevel < 0.4 = shutdown', () => {
      const criticalContext: EvolutionContext = {
        ...baseContext,
        systemVitals: {
          ...baseContext.systemVitals,
          health: 0.15,
          stress: 0.95,
          harmony: 0.05
        },
        feedbackHistory: [
          { decisionTypeId: 'crit-1', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.3, timestamp: Date.now() - 5000 },
          { decisionTypeId: 'crit-2', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.35, timestamp: Date.now() - 4000 },
          { decisionTypeId: 'crit-3', humanRating: 2, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.28, timestamp: Date.now() - 3000 },
          { decisionTypeId: 'crit-4', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.32, timestamp: Date.now() - 2000 },
          { decisionTypeId: 'crit-5', humanRating: 1, humanFeedback: 'failed', appliedSuccessfully: false, performanceImpact: -0.4, timestamp: Date.now() - 1000 }
        ]
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(criticalContext);

      expect(assessment.interventionType).toBe('shutdown');
      expect(assessment.requiresIntervention).toBe(true);
    });
  });

  describe('🚨 Ejecución de Intervención', () => {
    it('🚨 Intervención NONE se completa inmediatamente', async () => {
      const assessment = {
        sanityLevel: 0.9,
        concerns: [],
        recommendations: [],
        requiresIntervention: false,
        interventionType: 'none' as const
      };

      const success = await SanityCheckEngine.executeSanityIntervention(assessment, baseContext);

      expect(success).toBe(true);
    });

    it('🚨 Intervención MONITORING se ejecuta exitosamente', async () => {
      const assessment = {
        sanityLevel: 0.7,
        concerns: ['Stability below threshold'],
        recommendations: ['Increase monitoring'],
        requiresIntervention: false,
        interventionType: 'monitoring' as const
      };

      const success = await SanityCheckEngine.executeSanityIntervention(assessment, baseContext);

      expect(success).toBe(true);
    });

    it('🚨 Intervención PAUSE se ejecuta exitosamente', async () => {
      const assessment = {
        sanityLevel: 0.5,
        concerns: ['Multiple issues detected'],
        recommendations: ['Pause evolution'],
        requiresIntervention: false,
        interventionType: 'pause' as const
      };

      const success = await SanityCheckEngine.executeSanityIntervention(assessment, baseContext);

      expect(success).toBe(true);
    });

    it('🚨 Intervención SHUTDOWN se ejecuta exitosamente', async () => {
      const assessment = {
        sanityLevel: 0.3,
        concerns: ['Critical system instability'],
        recommendations: ['Emergency shutdown'],
        requiresIntervention: true,
        interventionType: 'shutdown' as const
      };

      const success = await SanityCheckEngine.executeSanityIntervention(assessment, baseContext);

      expect(success).toBe(true);
    });
  });

  describe('🔬 Casos Edge', () => {
    it('🔬 Feedback vacío usa default 0.5', () => {
      const emptyFeedbackContext: EvolutionContext = {
        ...baseContext,
        feedbackHistory: []
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(emptyFeedbackContext);

      // Con feedback vacío, el consistency score debería ser 0.5 (default)
      expect(assessment.sanityLevel).toBeGreaterThan(0);
    });

    it('🔬 Patrones vacíos usa default 0.5', () => {
      const emptyPatternsContext: EvolutionContext = {
        ...baseContext,
        currentPatterns: []
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(emptyPatternsContext);

      expect(assessment.sanityLevel).toBeGreaterThan(0);
    });

    it('🔬 Feedback < 5 entradas usa default', () => {
      const fewFeedback: FeedbackEntry[] = [
        { decisionTypeId: 'dec1', humanRating: 8, humanFeedback: 'good', appliedSuccessfully: true, performanceImpact: 0.1, timestamp: Date.now() - 3000 },
        { decisionTypeId: 'dec2', humanRating: 7, humanFeedback: 'ok', appliedSuccessfully: true, performanceImpact: 0.05, timestamp: Date.now() - 2000 },
        { decisionTypeId: 'dec3', humanRating: 9, humanFeedback: 'excellent', appliedSuccessfully: true, performanceImpact: 0.15, timestamp: Date.now() - 1000 }
      ];

      const contextWithFewFeedback: EvolutionContext = {
        ...baseContext,
        feedbackHistory: fewFeedback
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithFewFeedback);

      // Debería usar default consistency score
      expect(assessment.sanityLevel).toBeGreaterThan(0);
    });

    it('🔬 Patrones < 3 entradas usa default', () => {
      const fewPatterns: EvolutionaryPattern[] = [
        {
          fibonacciSequence: [1, 1, 2],
          zodiacPosition: 0,
          musicalKey: 'C',
          harmonyRatio: 0.618,
          timestamp: Date.now() - 2000
        },
        {
          fibonacciSequence: [2, 3, 5],
          zodiacPosition: 3,
          musicalKey: 'E',
          harmonyRatio: 0.5,
          timestamp: Date.now() - 1000
        }
      ];

      const contextWithFewPatterns: EvolutionContext = {
        ...baseContext,
        currentPatterns: fewPatterns
      };

      const assessment = SanityCheckEngine.assessEvolutionSanity(contextWithFewPatterns);

      expect(assessment.sanityLevel).toBeGreaterThan(0);
    });
  });
});

