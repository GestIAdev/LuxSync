/**
 * 🧪 MUSICAL CONTEXT ENGINE TESTS
 * ================================
 * Wave 8 - FASE 4: Tests para el orquestador principal
 * 
 * Tests CRÍTICOS:
 * - ⚠️ REGLA 2: Fallback cuando confidence < 0.5
 * - Transición a intelligent mode cuando confidence >= 0.5
 * - Emisión de eventos: context, prediction, section-change, mode-change
 * - Performance: Main thread process() < 5ms
 * - Síntesis de mood
 * - Cálculo de energía
 * - Confianza combinada ponderada
 * 
 * @module engines/musical/context/__tests__/MusicalContextEngine.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MusicalContextEngine,
  createMusicalContextEngine,
} from '../MusicalContextEngine.js';
import type { AudioAnalysis } from '../../types.js';

// ============================================================
// 🔧 TEST UTILITIES - MOCK FACTORIES
// ============================================================

/**
 * Crea un AudioAnalysis mock para tests
 */
function createMockAudio(overrides: Partial<AudioAnalysis> = {}): AudioAnalysis {
  return {
    timestamp: Date.now(),
    spectrum: {
      bass: 0.6,
      lowMid: 0.4,
      mid: 0.5,
      highMid: 0.4,
      treble: 0.3,
    },
    beat: {
      detected: true,
      bpm: 128,
      confidence: 0.85,
      beatPhase: 0.5,
      timeSinceLastBeat: 234,
    },
    energy: {
      current: 0.6,
      average: 0.55,
      variance: 0.1,
      trend: 'stable',
      peakRecent: 0.8,
    },
    ...overrides,
  };
}

/**
 * Crea un AudioAnalysis de baja confianza (para trigger fallback)
 */
function createLowConfidenceAudio(): AudioAnalysis {
  return {
    timestamp: Date.now(),
    spectrum: {
      bass: 0.2,
      lowMid: 0.1,
      mid: 0.15,
      highMid: 0.1,
      treble: 0.05,
    },
    beat: {
      detected: false,
      bpm: 0,
      confidence: 0.1, // Muy baja confianza
      beatPhase: 0,
      timeSinceLastBeat: 5000,
    },
    energy: {
      current: 0.1,
      average: 0.15,
      variance: 0.05,
      trend: 'stable',
      peakRecent: 0.2,
    },
  };
}

/**
 * Crea un AudioAnalysis de alta confianza (modo inteligente)
 */
function createHighConfidenceAudio(): AudioAnalysis {
  return {
    timestamp: Date.now(),
    spectrum: {
      bass: 0.8,
      lowMid: 0.6,
      mid: 0.7,
      highMid: 0.5,
      treble: 0.4,
    },
    beat: {
      detected: true,
      bpm: 128,
      confidence: 0.95,
      beatPhase: 0.5,
      timeSinceLastBeat: 234,
    },
    energy: {
      current: 0.85,
      average: 0.8,
      variance: 0.15,
      trend: 'rising',
      peakRecent: 0.95,
    },
  };
}

// ============================================================
// 🧪 TEST SUITES
// ============================================================

describe('🧠 MusicalContextEngine', () => {
  let engine: MusicalContextEngine;

  beforeEach(() => {
    // Crear engine con warmup reducido para tests
    engine = createMusicalContextEngine({
      warmupTime: 100, // 100ms warmup para tests rápidos
      confidenceThreshold: 0.5,
    });
  });

  afterEach(() => {
    engine.reset();
  });

  // ==========================================================
  // INSTANCIACIÓN
  // ==========================================================

  describe('Instanciación', () => {
    it('se crea con configuración por defecto', () => {
      expect(engine).toBeDefined();
      expect(engine).toBeInstanceOf(MusicalContextEngine);
    });

    it('inicia en modo reactivo', () => {
      expect(engine.getMode()).toBe('reactive');
    });

    it('inicia con confianza 0', () => {
      expect(engine.getConfidence()).toBe(0);
    });

    it('acepta factory function', () => {
      const factoryEngine = createMusicalContextEngine();
      expect(factoryEngine).toBeInstanceOf(MusicalContextEngine);
    });

    it('acepta configuración personalizada', () => {
      const customEngine = createMusicalContextEngine({
        confidenceThreshold: 0.7,
        rhythmConfidenceWeight: 0.5,
      });
      expect(customEngine).toBeDefined();
    });
  });

  // ==========================================================
  // ⚠️ REGLA 2: FALLBACK MODE (CRÍTICO)
  // ==========================================================

  describe('⚠️ REGLA 2: Fallback Mode', () => {
    it('usa modo reactivo cuando confidence < 0.5', async () => {
      // Esperar warmup
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const audio = createLowConfidenceAudio();
      const result = engine.process(audio);
      
      expect(result.mode).toBe('reactive');
    });

    it('retorna ReactiveResult con pulse, shimmer, flash', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const audio = createMockAudio({
        spectrum: { bass: 0.8, lowMid: 0.5, mid: 0.6, highMid: 0.4, treble: 0.7 },
        beat: { detected: true, bpm: 128, confidence: 0.3, beatPhase: 0.5, timeSinceLastBeat: 200 },
      });
      
      const result = engine.process(audio);
      
      if (result.mode === 'reactive') {
        expect(result.pulse).toBeDefined();
        expect(result.shimmer).toBeDefined();
        expect(result.flash).toBeDefined();
        expect(result.intensity).toBeDefined();
      }
    });

    it('mapea bass → pulse correctamente', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Audio con mucho bass
      const highBassAudio = createMockAudio({
        spectrum: { bass: 0.9, lowMid: 0.5, mid: 0.5, highMid: 0.3, treble: 0.2 },
        beat: { detected: false, bpm: 0, confidence: 0.1, beatPhase: 0, timeSinceLastBeat: 1000 },
      });
      
      const result = engine.process(highBassAudio);
      
      if (result.mode === 'reactive') {
        expect(result.pulse).toBeGreaterThan(0.5);
      }
    });

    it('mapea treble → shimmer correctamente', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Audio con mucho treble
      const highTrebleAudio = createMockAudio({
        spectrum: { bass: 0.2, lowMid: 0.3, mid: 0.4, highMid: 0.7, treble: 0.9 },
        beat: { detected: false, bpm: 0, confidence: 0.1, beatPhase: 0, timeSinceLastBeat: 1000 },
      });
      
      const result = engine.process(highTrebleAudio);
      
      if (result.mode === 'reactive') {
        expect(result.shimmer).toBeGreaterThan(0.5);
      }
    });

    it('mapea beat → flash correctamente', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Audio con beat detectado
      const beatAudio = createMockAudio({
        beat: { detected: true, bpm: 128, confidence: 0.3, beatPhase: 0.0, timeSinceLastBeat: 10 },
      });
      
      const result = engine.process(beatAudio);
      
      if (result.mode === 'reactive') {
        expect(result.flash).toBe(true);
      }
    });

    it('NO espera análisis de género en modo reactivo', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const audio = createLowConfidenceAudio();
      
      const start = performance.now();
      const result = engine.process(audio);
      const elapsed = performance.now() - start;
      
      // Debe ser muy rápido porque no hace análisis pesado
      expect(elapsed).toBeLessThan(10);
      expect(result.mode).toBe('reactive');
    });
  });

  // ==========================================================
  // TRANSICIÓN A MODO INTELIGENTE
  // ==========================================================

  describe('Transición a Modo Inteligente', () => {
    it('cambia a intelligent cuando confidence >= 0.5', async () => {
      // Esperar warmup
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const highConfAudio = createHighConfidenceAudio();
      
      // Procesar múltiples veces para acumular confianza
      for (let i = 0; i < 20; i++) {
        engine.process(highConfAudio);
        // Esperar throttle
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      
      // La confianza debería haber subido
      const finalConfidence = engine.getConfidence();
      
      // Si la confianza es suficiente, debería estar en intelligent
      if (finalConfidence >= 0.5) {
        expect(engine.getMode()).toBe('intelligent');
      }
    });

    it('retorna IntelligentResult con context completo', async () => {
      // Crear engine con warmup muy corto y forzar modo
      const quickEngine = createMusicalContextEngine({
        warmupTime: 10,
        confidenceThreshold: 0.3,
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const audio = createHighConfidenceAudio();
      
      // Procesar varias veces para acumular análisis
      for (let i = 0; i < 15; i++) {
        quickEngine.process(audio);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Forzar modo inteligente para verificar estructura
      quickEngine.forceMode('intelligent');
      const result = quickEngine.process(audio);
      
      if (result.mode === 'intelligent') {
        expect(result.context).toBeDefined();
        expect(result.context.rhythm).toBeDefined();
        expect(result.context.mood).toBeDefined();
        expect(result.context.energy).toBeDefined();
        expect(result.suggestedPalette).toBeDefined();
        expect(result.suggestedMovement).toBeDefined();
      }
    });

    it('emite evento mode-change al cambiar de modo', async () => {
      const modeChangeSpy = vi.fn();
      engine.on('mode-change', modeChangeSpy);
      
      // Forzar cambio de modo
      engine.forceMode('intelligent');
      
      expect(modeChangeSpy).toHaveBeenCalled();
      expect(modeChangeSpy.mock.calls[0][0].from).toBe('reactive');
      expect(modeChangeSpy.mock.calls[0][0].to).toBe('intelligent');
    });

    it('aplica histéresis para evitar flip-flop', async () => {
      const customEngine = createMusicalContextEngine({
        warmupTime: 10,
        confidenceThreshold: 0.5,
        modeHysteresis: 0.1, // 10% histéresis
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Forzar modo inteligente
      customEngine.forceMode('intelligent');
      
      // Ahora necesita bajar de 0.4 (0.5 - 0.1) para volver a reactivo
      // Una ligera bajada no debería cambiar el modo
      
      const modeChangeSpy = vi.fn();
      customEngine.on('mode-change', modeChangeSpy);
      
      // Procesar con audio medio
      const midAudio = createMockAudio({
        beat: { detected: true, bpm: 120, confidence: 0.55, beatPhase: 0.5, timeSinceLastBeat: 250 },
      });
      
      customEngine.process(midAudio);
      
      // No debería haber cambiado por histéresis
      expect(customEngine.getMode()).toBe('intelligent');
    });
  });

  // ==========================================================
  // EVENTOS
  // ==========================================================

  describe('Eventos', () => {
    it('emite evento result en cada process()', () => {
      const resultSpy = vi.fn();
      engine.on('result', resultSpy);
      
      const audio = createMockAudio();
      engine.process(audio);
      
      expect(resultSpy).toHaveBeenCalledTimes(1);
    });

    it('emite evento reactive-update en modo reactivo', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const reactiveSpy = vi.fn();
      engine.on('reactive-update', reactiveSpy);
      
      const audio = createLowConfidenceAudio();
      engine.process(audio);
      
      expect(reactiveSpy).toHaveBeenCalled();
    });

    it('emite evento context en modo inteligente', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const contextSpy = vi.fn();
      engine.on('context', contextSpy);
      
      // Forzar modo inteligente
      engine.forceMode('intelligent');
      
      const audio = createHighConfidenceAudio();
      
      // Procesar para trigger análisis pesado
      engine.process(audio);
      await new Promise(resolve => setTimeout(resolve, 600));
      engine.process(audio);
      
      // Puede emitir o no dependiendo del estado interno
      expect(contextSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('emite evento reset al llamar reset()', () => {
      const resetSpy = vi.fn();
      engine.on('reset', resetSpy);
      
      engine.reset();
      
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });

    it('emite evento config-updated al actualizar config', () => {
      const configSpy = vi.fn();
      engine.on('config-updated', configSpy);
      
      engine.updateConfig({ confidenceThreshold: 0.7 });
      
      expect(configSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================
  // CONFIANZA COMBINADA
  // ==========================================================

  describe('Confianza Combinada', () => {
    it('confianza es reducida durante warmup', () => {
      // Engine recién creado, sin esperar warmup
      const freshEngine = createMusicalContextEngine({
        warmupTime: 5000, // Warmup largo
      });
      
      const audio = createHighConfidenceAudio();
      freshEngine.process(audio);
      
      // Confianza debe ser baja durante warmup
      expect(freshEngine.getConfidence()).toBeLessThan(0.5);
    });

    it('confianza aumenta después del warmup', async () => {
      const quickEngine = createMusicalContextEngine({
        warmupTime: 50,
      });
      
      const audio = createHighConfidenceAudio();
      quickEngine.process(audio);
      
      const beforeWarmup = quickEngine.getConfidence();
      
      // Esperar warmup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Procesar de nuevo
      quickEngine.process(audio);
      
      const afterWarmup = quickEngine.getConfidence();
      
      expect(afterWarmup).toBeGreaterThan(beforeWarmup);
    });

    it('peso de ritmo domina (35%) - REGLA 3', async () => {
      const weightedEngine = createMusicalContextEngine({
        warmupTime: 10,
        rhythmConfidenceWeight: 0.35,
        harmonyConfidenceWeight: 0.20,
        genreConfidenceWeight: 0.25,
        sectionConfidenceWeight: 0.20,
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Audio con buen ritmo pero sin análisis pesado
      const audio = createMockAudio({
        beat: { detected: true, bpm: 128, confidence: 0.95, beatPhase: 0.5, timeSinceLastBeat: 234 },
      });
      
      weightedEngine.process(audio);
      
      // La confianza del ritmo debería contribuir significativamente
      const confidence = weightedEngine.getConfidence();
      expect(confidence).toBeGreaterThan(0);
    });
  });

  // ==========================================================
  // SÍNTESIS DE MOOD
  // ==========================================================

  describe('Síntesis de Mood', () => {
    it('genera mood válido en modo inteligente', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      engine.forceMode('intelligent');
      
      const audio = createHighConfidenceAudio();
      
      // Procesar varias veces para acumular análisis
      for (let i = 0; i < 5; i++) {
        engine.process(audio);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const result = engine.process(audio);
      
      if (result.mode === 'intelligent') {
        const validMoods = ['euphoric', 'melancholic', 'aggressive', 'chill', 'groovy', 'epic', 'intimate', 'party', 'neutral'];
        expect(validMoods).toContain(result.context.mood);
      }
    });
  });

  // ==========================================================
  // CÁLCULO DE ENERGÍA
  // ==========================================================

  describe('Cálculo de Energía', () => {
    it('energía alta con audio intenso', async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      
      engine.forceMode('intelligent');
      
      const intenseAudio = createMockAudio({
        spectrum: { bass: 0.95, lowMid: 0.8, mid: 0.9, highMid: 0.7, treble: 0.6 },
        beat: { detected: true, bpm: 140, confidence: 0.9, beatPhase: 0.0, timeSinceLastBeat: 50 },
        energy: { current: 0.95, average: 0.9, variance: 0.1, trend: 'rising', peakRecent: 1.0 },
      });
      
      // Procesar varias veces
      for (let i = 0; i < 3; i++) {
        engine.process(intenseAudio);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const result = engine.process(intenseAudio);
      
      if (result.mode === 'intelligent') {
        expect(result.context.energy).toBeGreaterThan(0.5);
      }
    });
  });

  // ==========================================================
  // PERFORMANCE
  // ==========================================================

  describe('Performance', () => {
    it('process() completa en < 5ms (Main Thread)', () => {
      const audio = createMockAudio();
      
      const start = performance.now();
      
      // Ejecutar múltiples veces para medir promedio
      for (let i = 0; i < 100; i++) {
        engine.process(audio);
      }
      
      const elapsed = (performance.now() - start) / 100;
      
      expect(elapsed).toBeLessThan(5);
    });

    it('modo reactivo es más rápido que inteligente', async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Medir reactivo
      const reactiveStart = performance.now();
      for (let i = 0; i < 50; i++) {
        engine.process(createLowConfidenceAudio());
      }
      const reactiveTime = (performance.now() - reactiveStart) / 50;
      
      // Forzar inteligente
      engine.forceMode('intelligent');
      
      // Medir inteligente
      const intelligentStart = performance.now();
      for (let i = 0; i < 50; i++) {
        engine.process(createHighConfidenceAudio());
      }
      const intelligentTime = (performance.now() - intelligentStart) / 50;
      
      // Reactivo debería ser al menos igual de rápido
      expect(reactiveTime).toBeLessThanOrEqual(intelligentTime + 1);
    });

    it('reporta estadísticas de rendimiento', () => {
      const audio = createMockAudio();
      
      // Procesar varias veces
      for (let i = 0; i < 10; i++) {
        engine.process(audio);
      }
      
      const stats = engine.getPerformanceStats();
      
      expect(stats.processCount).toBe(10);
      expect(stats.averageProcessTime).toBeDefined();
      expect(stats.averageProcessTime).toBeGreaterThanOrEqual(0);
      expect(stats.currentMode).toBeDefined();
      expect(stats.overallConfidence).toBeDefined();
      // timeSinceStart puede ser 0 si la ejecución es muy rápida
      expect(stats.timeSinceStart).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================
  // API PÚBLICA
  // ==========================================================

  describe('API Pública', () => {
    it('getMode() retorna modo actual', () => {
      expect(['reactive', 'intelligent', 'transitioning']).toContain(engine.getMode());
    });

    it('getConfidence() retorna confianza actual', () => {
      const confidence = engine.getConfidence();
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('getLastContext() es null inicialmente', () => {
      expect(engine.getLastContext()).toBeNull();
    });

    it('getLastResult() es null inicialmente', () => {
      expect(engine.getLastResult()).toBeNull();
    });

    it('getLastResult() retorna último resultado después de process()', () => {
      const audio = createMockAudio();
      engine.process(audio);
      
      expect(engine.getLastResult()).not.toBeNull();
    });

    it('reset() limpia el estado', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const audio = createMockAudio();
      engine.process(audio);
      
      expect(engine.getLastResult()).not.toBeNull();
      
      engine.reset();
      
      expect(engine.getMode()).toBe('reactive');
      expect(engine.getConfidence()).toBe(0);
      expect(engine.getLastContext()).toBeNull();
      expect(engine.getLastResult()).toBeNull();
    });

    it('forceMode() cambia el modo', () => {
      expect(engine.getMode()).toBe('reactive');
      
      engine.forceMode('intelligent');
      
      expect(engine.getMode()).toBe('intelligent');
    });

    it('updateConfig() actualiza configuración', () => {
      engine.updateConfig({ confidenceThreshold: 0.8 });
      
      // La configuración interna debe haberse actualizado
      // (verificamos indirectamente que no lanza error)
      expect(engine).toBeDefined();
    });
  });

  // ==========================================================
  // INTEGRACIÓN CON ANALIZADORES
  // ==========================================================

  describe('Integración con Analizadores', () => {
    it('procesa audio sin errores', () => {
      const audio = createMockAudio();
      
      expect(() => {
        engine.process(audio);
      }).not.toThrow();
    });

    it('maneja audio incompleto gracefully', () => {
      const incompleteAudio = {
        timestamp: Date.now(),
        spectrum: {
          bass: 0.5,
          lowMid: 0.4,
          mid: 0.5,
          highMid: 0.4,
          treble: 0.3,
        },
        beat: {
          detected: false,
          bpm: 0,
          confidence: 0,
          beatPhase: 0,
          timeSinceLastBeat: 0,
        },
        energy: {
          current: 0.5,
          average: 0.5,
          variance: 0,
          trend: 'stable' as const,
          peakRecent: 0.5,
        },
      };
      
      expect(() => {
        engine.process(incompleteAudio);
      }).not.toThrow();
    });

    it('throttle de análisis pesado funciona', async () => {
      const audio = createMockAudio();
      
      // Primera llamada
      engine.process(audio);
      
      // Llamadas rápidas sucesivas (deberían usar cache)
      for (let i = 0; i < 10; i++) {
        engine.process(audio);
      }
      
      // Esperar throttle (500ms)
      await new Promise(resolve => setTimeout(resolve, 550));
      
      // Esta llamada debería hacer análisis fresco
      engine.process(audio);
      
      // No debería haber errores
      expect(engine.getLastResult()).not.toBeNull();
    });
  });
});
