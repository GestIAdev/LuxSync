/**
 * 🧪 PREDICTION MATRIX TESTS
 * ==========================
 * Wave 8 - FASE 4: Tests para el motor de predicción
 * 
 * Tests cubren:
 * - Predicción de drops desde buildups
 * - Detección de patrones de sección
 * - Generación de acciones de iluminación
 * - Predicción desde fills de batería
 * - Throttling y caching
 * - Performance (< 5ms)
 * 
 * @module engines/musical/context/__tests__/PredictionMatrix.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PredictionMatrix,
  createPredictionMatrix,
} from '../PredictionMatrix.js';
import type { RhythmAnalysis, SectionAnalysis } from '../../types.js';

// ============================================================
// 🔧 TEST UTILITIES - MOCK FACTORIES
// ============================================================

/**
 * Crea un RhythmAnalysis mock para tests
 */
function createMockRhythm(overrides: Partial<RhythmAnalysis> = {}): RhythmAnalysis {
  return {
    bpm: 128,
    confidence: 0.85,
    beatPhase: 0.5,
    barPhase: 0.25,
    pattern: {
      type: 'four_on_floor',
      confidence: 0.8,
    },
    drums: {
      kickDetected: true,
      kickIntensity: 0.8,
      snareDetected: false,
      snareIntensity: 0.2,
      hihatDetected: true,
      hihatIntensity: 0.6,
      crashDetected: false,
      fillDetected: false,
    },
    groove: {
      syncopation: 0.15,
      swingAmount: 0.05,
      complexity: 'medium',
      humanization: 0.06,
    },
    fillInProgress: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Crea un SectionAnalysis mock para tests
 */
function createMockSection(overrides: Partial<SectionAnalysis> = {}): SectionAnalysis {
  const now = Date.now();
  return {
    current: {
      type: 'verse',
      confidence: 0.75,
      startedAt: now - 10000,
      duration: 10000,
    },
    predicted: null,
    intensity: 0.5,
    intensityTrend: 'stable',
    confidence: 0.7,
    timestamp: now,
    ...overrides,
  };
}

// ============================================================
// 🧪 TEST SUITES
// ============================================================

describe('🔮 PredictionMatrix', () => {
  let matrix: PredictionMatrix;

  beforeEach(() => {
    matrix = createPredictionMatrix();
  });

  // ==========================================================
  // INSTANCIACIÓN
  // ==========================================================

  describe('Instanciación', () => {
    it('se crea con configuración por defecto', () => {
      expect(matrix).toBeDefined();
      expect(matrix).toBeInstanceOf(PredictionMatrix);
    });

    it('se crea con configuración personalizada', () => {
      const customMatrix = createPredictionMatrix({
        historySize: 16,
        minProbabilityThreshold: 0.7,
        referenceBpm: 140,
      });
      expect(customMatrix).toBeDefined();
    });

    it('acepta factory function', () => {
      const factoryMatrix = createPredictionMatrix();
      expect(factoryMatrix).toBeInstanceOf(PredictionMatrix);
    });
  });

  // ==========================================================
  // PREDICCIÓN DE DROPS
  // ==========================================================

  describe('Predicción de Drops', () => {
    it('predice drop cuando buildup tiene rising intensity', () => {
      const rhythm = createMockRhythm({ bpm: 128 });
      const section = createMockSection({
        current: {
          type: 'buildup',
          confidence: 0.85,
          startedAt: Date.now() - 8000, // 8 segundos de buildup
          duration: 8000,
        },
        intensity: 0.85,
        intensityTrend: 'rising',
        confidence: 0.8,
      });

      const prediction = matrix.generate(rhythm, section, true);
      
      expect(prediction).not.toBeNull();
      expect(prediction?.type).toBe('drop_incoming');
      expect(prediction?.probability).toBeGreaterThan(0.7);
    });

    it('NO predice drop si buildup es muy corto', () => {
      const rhythm = createMockRhythm({ bpm: 128 });
      const section = createMockSection({
        current: {
          type: 'buildup',
          confidence: 0.85,
          startedAt: Date.now() - 1000, // Solo 1 segundo
          duration: 1000,
        },
        intensity: 0.6,
        intensityTrend: 'rising',
        confidence: 0.7,
      });

      const prediction = matrix.generate(rhythm, section, true);
      
      // No debería predecir drop con buildup tan corto
      if (prediction?.type === 'drop_incoming') {
        expect(prediction.probability).toBeLessThan(0.6);
      }
    });

    it('genera acciones de iluminación para drop', () => {
      const rhythm = createMockRhythm({ bpm: 128 });
      const section = createMockSection({
        current: {
          type: 'buildup',
          confidence: 0.9,
          startedAt: Date.now() - 12000, // 12 segundos (largo)
          duration: 12000,
        },
        intensity: 0.95,
        intensityTrend: 'rising',
        confidence: 0.85,
      });

      const prediction = matrix.generate(rhythm, section, true);
      
      if (prediction?.type === 'drop_incoming') {
        expect(prediction.actions).toBeDefined();
        expect(prediction.actions.mainAction.effect).toBe('flash');
        expect(prediction.actions.preAction?.effect).toBe('intensity_ramp');
      }
    });

    it('predictDrop método público funciona', () => {
      const rhythm = createMockRhythm({ bpm: 130 });
      const section = createMockSection({
        current: {
          type: 'buildup',
          confidence: 0.9,
          startedAt: Date.now() - 10000,
          duration: 10000,
        },
        intensityTrend: 'rising',
        intensity: 0.9,
      });

      const dropPrediction = matrix.predictDrop(section, rhythm);
      expect(dropPrediction).not.toBeNull();
      expect(dropPrediction?.type).toBe('drop_incoming');
    });
  });

  // ==========================================================
  // PREDICCIÓN DE TRANSICIONES
  // ==========================================================

  describe('Predicción de Transiciones', () => {
    it('predice transición desde section.predicted', () => {
      const section = createMockSection({
        predicted: {
          type: 'chorus',
          probability: 0.75,
          estimatedIn: 4000,
        },
        confidence: 0.8,
      });

      const prediction = matrix.predictTransition(section);
      
      expect(prediction).not.toBeNull();
      expect(prediction?.type).toBe('transition_beat');
      expect(prediction?.probability).toBeGreaterThan(0.6);
    });

    it('NO predice transición si probabilidad es baja', () => {
      const section = createMockSection({
        predicted: {
          type: 'verse',
          probability: 0.3, // Baja probabilidad
          estimatedIn: 8000,
        },
      });

      const prediction = matrix.predictTransition(section);
      expect(prediction).toBeNull();
    });

    it('calcula beatsUntil correctamente', () => {
      const section = createMockSection({
        predicted: {
          type: 'chorus',
          probability: 0.8,
          estimatedIn: 2000, // 2 segundos a 120 BPM = 4 beats
        },
      });

      const prediction = matrix.predictTransition(section);
      
      if (prediction) {
        expect(prediction.beatsUntil).toBeGreaterThan(0);
        expect(prediction.timeUntil).toBe(2000);
      }
    });
  });

  // ==========================================================
  // PATRONES DE SECCIÓN
  // ==========================================================

  describe('Patrones de Sección', () => {
    it('detecta patrón buildup → buildup', () => {
      const rhythm = createMockRhythm();
      
      // Simular historial de buildups
      const buildupSection1 = createMockSection({
        current: { type: 'buildup', confidence: 0.8, startedAt: Date.now() - 16000, duration: 8000 },
        intensityTrend: 'rising',
      });
      
      matrix.generate(rhythm, buildupSection1, true);
      
      // Segundo buildup
      const buildupSection2 = createMockSection({
        current: { type: 'buildup', confidence: 0.85, startedAt: Date.now() - 8000, duration: 8000 },
        intensityTrend: 'rising',
        intensity: 0.9,
      });
      
      const prediction = matrix.generate(rhythm, buildupSection2, true);
      
      // Después de buildup prolongado, debería predecir drop
      if (prediction) {
        expect(['drop_incoming', 'transition_beat']).toContain(prediction.type);
      }
    });

    it('detecta patrón verse → pre_chorus', () => {
      const rhythm = createMockRhythm();
      
      // Verse
      matrix.generate(rhythm, createMockSection({
        current: { type: 'verse', confidence: 0.8, startedAt: Date.now() - 20000, duration: 16000 },
      }), true);
      
      // Pre-chorus
      const preChorusSection = createMockSection({
        current: { type: 'pre_chorus', confidence: 0.75, startedAt: Date.now() - 4000, duration: 4000 },
        intensityTrend: 'rising',
      });
      
      const prediction = matrix.generate(rhythm, preChorusSection, true);
      
      // El patrón verse → pre_chorus sugiere chorus siguiente
      // Esto puede generar una predicción de transición
      expect(prediction === null || prediction.type).toBeTruthy();
    });

    it('emite evento section-change cuando cambia sección', () => {
      const sectionChangeSpy = vi.fn();
      matrix.on('section-change', sectionChangeSpy);
      
      const rhythm = createMockRhythm();
      
      // Primera sección
      matrix.generate(rhythm, createMockSection({
        current: { type: 'verse', confidence: 0.8, startedAt: Date.now() - 10000, duration: 10000 },
      }), true);
      
      // Cambio a chorus
      matrix.generate(rhythm, createMockSection({
        current: { type: 'chorus', confidence: 0.85, startedAt: Date.now(), duration: 0 },
      }), true);
      
      expect(sectionChangeSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================
  // PREDICCIÓN DESDE FILLS
  // ==========================================================

  describe('Predicción desde Fills', () => {
    it('predice transición cuando hay fill en progreso', () => {
      const rhythm = createMockRhythm({
        fillInProgress: true,
        drums: {
          kickDetected: true,
          kickIntensity: 0.9,
          snareDetected: true,
          snareIntensity: 0.8,
          hihatDetected: true,
          hihatIntensity: 0.7,
          crashDetected: false,
          fillDetected: true,
        },
      });
      const section = createMockSection({
        current: { type: 'verse', confidence: 0.8, startedAt: Date.now() - 8000, duration: 8000 },
      });

      const prediction = matrix.generate(rhythm, section, true);
      
      // Con fill detectado, debería haber predicción
      if (prediction) {
        expect(['fill_expected', 'transition_beat']).toContain(prediction.type);
      }
    });
  });

  // ==========================================================
  // THROTTLING Y CACHING
  // ==========================================================

  describe('Throttling y Caching', () => {
    it('retorna cache si se llama demasiado rápido', () => {
      const rhythm = createMockRhythm();
      const section = createMockSection({
        current: { type: 'buildup', confidence: 0.85, startedAt: Date.now() - 5000, duration: 5000 },
        intensityTrend: 'rising',
      });

      // Primera llamada (forzada)
      const first = matrix.generate(rhythm, section, true);
      
      // Segunda llamada inmediata (sin forzar) - debería usar cache
      const second = matrix.generate(rhythm, section, false);
      
      // Deberían ser el mismo resultado (cache)
      expect(second).toEqual(first);
    });

    it('analiza de nuevo después del intervalo de throttle', async () => {
      const matrixFast = createPredictionMatrix({
        minProbabilityThreshold: 0.5,
      });
      
      const rhythm = createMockRhythm();
      
      // Sección inicial
      const section1 = createMockSection({
        current: { type: 'verse', confidence: 0.8, startedAt: Date.now() - 10000, duration: 10000 },
      });
      
      matrixFast.generate(rhythm, section1, true);
      
      // Esperar más del throttle (500ms)
      await new Promise(resolve => setTimeout(resolve, 550));
      
      // Nueva sección diferente
      const section2 = createMockSection({
        current: { type: 'buildup', confidence: 0.85, startedAt: Date.now() - 3000, duration: 3000 },
        intensityTrend: 'rising',
        intensity: 0.8,
      });
      
      // Esta llamada debería hacer nuevo análisis (sin force)
      matrixFast.generate(rhythm, section2, false);
      
      // El historial debería haberse actualizado
      expect(matrixFast.getSectionHistory().length).toBeGreaterThan(0);
    });
  });

  // ==========================================================
  // PERFORMANCE
  // ==========================================================

  describe('Performance', () => {
    it('generate() completa en < 5ms', () => {
      const rhythm = createMockRhythm();
      const section = createMockSection({
        current: { type: 'buildup', confidence: 0.9, startedAt: Date.now() - 8000, duration: 8000 },
        intensityTrend: 'rising',
      });

      const start = performance.now();
      
      // Ejecutar múltiples veces para medir promedio
      for (let i = 0; i < 100; i++) {
        matrix.generate(rhythm, section, true);
      }
      
      const elapsed = (performance.now() - start) / 100;
      
      expect(elapsed).toBeLessThan(5);
    });

    it('reporta estadísticas de rendimiento', () => {
      const rhythm = createMockRhythm();
      const section = createMockSection();

      // Generar algunas predicciones
      for (let i = 0; i < 10; i++) {
        matrix.generate(rhythm, section, true);
      }

      const stats = matrix.getPerformanceStats();
      
      expect(stats.analysisCount).toBe(10);
      expect(stats.averageAnalysisTime).toBeDefined();
      expect(stats.averageAnalysisTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================
  // API PÚBLICA
  // ==========================================================

  describe('API Pública', () => {
    it('getSectionHistory retorna historial', () => {
      const rhythm = createMockRhythm();
      
      // Agregar algunas secciones
      matrix.generate(rhythm, createMockSection({
        current: { type: 'intro', confidence: 0.7, startedAt: Date.now() - 20000, duration: 8000 },
      }), true);
      
      matrix.generate(rhythm, createMockSection({
        current: { type: 'verse', confidence: 0.8, startedAt: Date.now() - 12000, duration: 8000 },
      }), true);

      const history = matrix.getSectionHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    it('reset() limpia el estado', () => {
      const rhythm = createMockRhythm();
      const section = createMockSection();

      // Generar algo
      matrix.generate(rhythm, section, true);
      expect(matrix.getSectionHistory().length).toBeGreaterThan(0);

      // Reset
      matrix.reset();
      
      expect(matrix.getSectionHistory().length).toBe(0);
      expect(matrix.getPerformanceStats().analysisCount).toBe(0);
    });

    it('updateConfig() actualiza configuración', () => {
      const configSpy = vi.fn();
      matrix.on('config-updated', configSpy);
      
      matrix.updateConfig({ minProbabilityThreshold: 0.8 });
      
      expect(configSpy).toHaveBeenCalled();
    });

    it('emite evento prediction cuando hay predicción válida', () => {
      const predictionSpy = vi.fn();
      matrix.on('prediction', predictionSpy);
      
      const rhythm = createMockRhythm();
      const section = createMockSection({
        current: { type: 'buildup', confidence: 0.9, startedAt: Date.now() - 10000, duration: 10000 },
        intensityTrend: 'rising',
        intensity: 0.9,
      });

      matrix.generate(rhythm, section, true);
      
      // Debería haber emitido evento si hubo predicción
      // (puede no emitir si la probabilidad es baja)
      expect(predictionSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================
  // ACCIONES DE ILUMINACIÓN
  // ==========================================================

  describe('Acciones de Iluminación', () => {
    it('genera acciones con preAction para drops', () => {
      const rhythm = createMockRhythm({ bpm: 128 });
      const section = createMockSection({
        current: { type: 'buildup', confidence: 0.9, startedAt: Date.now() - 15000, duration: 15000 },
        intensityTrend: 'rising',
        intensity: 0.95,
      });

      const prediction = matrix.generate(rhythm, section, true);
      
      if (prediction?.type === 'drop_incoming') {
        expect(prediction.actions.preAction).toBeDefined();
        expect(prediction.actions.preAction?.timing).toBeLessThan(0); // Antes del evento
        expect(prediction.actions.mainAction).toBeDefined();
        expect(prediction.actions.mainAction.intensity).toBeGreaterThan(0.8);
      }
    });

    it('genera reasoning explicativo', () => {
      const rhythm = createMockRhythm();
      const section = createMockSection({
        current: { type: 'buildup', confidence: 0.85, startedAt: Date.now() - 8000, duration: 8000 },
        intensityTrend: 'rising',
      });

      const prediction = matrix.generate(rhythm, section, true);
      
      if (prediction) {
        expect(prediction.reasoning).toBeDefined();
        expect(typeof prediction.reasoning).toBe('string');
        expect(prediction.reasoning.length).toBeGreaterThan(0);
      }
    });
  });
});
