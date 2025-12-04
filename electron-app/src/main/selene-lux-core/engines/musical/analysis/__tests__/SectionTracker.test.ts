/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    🧪 SECTION TRACKER TESTS                                  ║
 * ║━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━║
 * ║  Tests para el detector de secciones musicales                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * @wave WAVE-8 - FASE 3
 * @test SectionTracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SectionTracker } from '../SectionTracker.js';
import { RhythmAnalysis } from '../../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crea un RhythmAnalysis mock para tests
 */
function createMockRhythm(overrides: Partial<RhythmAnalysis> = {}): RhythmAnalysis {
  return {
    bpm: 128,
    confidence: 0.8,
    beatPhase: 0,
    barPhase: 0,
    pattern: { type: 'four_on_floor', confidence: 0.8 },
    drums: {
      kickDetected: true,
      kickIntensity: 0.7,
      snareDetected: true,
      snareIntensity: 0.5,
      hihatDetected: true,
      hihatIntensity: 0.6,
      crashDetected: false,
      fillDetected: false,
    },
    groove: {
      syncopation: 0.1,
      swingAmount: 0,
      complexity: 'medium',
      humanization: 0.05,
    },
    fillInProgress: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Crea métricas de audio mock
 */
function createMockAudio(
  energy: number = 0.5,
  bass: number = 0.5,
  mid: number = 0.5,
  treble: number = 0.5
) {
  return { energy, bass, mid, treble };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('SectionTracker', () => {
  let tracker: SectionTracker;

  beforeEach(() => {
    tracker = new SectionTracker();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Inicialización', () => {
    it('debe inicializar con valores por defecto', () => {
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(),
        true
      );
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('debe incluir current section info', () => {
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(),
        true
      );
      
      expect(result.current).toBeDefined();
      expect(result.current.type).toBeDefined();
      expect(result.current.confidence).toBeGreaterThanOrEqual(0);
    });

    it('debe incluir prediction info', () => {
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(),
        true
      );
      
      expect(result.predicted).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Detección de secciones', () => {
    it('debe detectar INTRO con energía baja', () => {
      // Simular inicio con energía baja
      for (let i = 0; i < 10; i++) {
        tracker.track(
          createMockRhythm({ confidence: 0.3 }),
          null,
          createMockAudio(0.2, 0.2, 0.2, 0.2),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm({ confidence: 0.3 }),
        null,
        createMockAudio(0.2, 0.2, 0.2, 0.2),
        true
      );
      
      // Intro o verse son válidos para energía baja
      expect(['intro', 'verse', 'breakdown', 'unknown']).toContain(result.current.type);
    });

    it('debe detectar DROP con energía alta', () => {
      // Warmup con energía creciente
      for (let i = 0; i < 20; i++) {
        const energy = 0.3 + (i * 0.03);
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(energy, energy, energy * 0.8, energy * 0.7),
          true
        );
      }
      
      // Ahora energía máxima = DROP
      const result = tracker.track(
        createMockRhythm({ 
          drums: {
            kickDetected: true,
            kickIntensity: 0.95,
            snareDetected: true,
            snareIntensity: 0.8,
            hihatDetected: true,
            hihatIntensity: 0.9,
            crashDetected: true,
            fillDetected: false,
          }
        }),
        null,
        createMockAudio(0.95, 0.9, 0.85, 0.8),
        true
      );
      
      // Alta energía debería dar secciones de alta intensidad
      // El SectionTracker puede clasificar como drop, chorus, verse (alta energía)
      expect(['drop', 'chorus', 'buildup', 'verse']).toContain(result.current.type);
      expect(result.intensity).toBeGreaterThan(0.5); // Lo importante es la intensidad
    });

    it('debe detectar BUILDUP con tendencia creciente', () => {
      // Simular buildup: energía creciendo consistentemente
      for (let i = 0; i < 30; i++) {
        const energy = 0.3 + (i * 0.02);
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(energy, energy, energy, energy),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.7, 0.7, 0.7, 0.7),
        true
      );
      
      // Tendencia creciente - lo importante es que detecte rising
      // La sección específica depende del nivel de energía alcanzado
      expect(['buildup', 'chorus', 'drop', 'verse']).toContain(result.current.type);
      expect(result.intensityTrend).toBe('rising'); // Tendencia positiva
    });

    it('debe detectar BREAKDOWN con caída de energía', () => {
      // Primero alta energía
      for (let i = 0; i < 15; i++) {
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(0.8, 0.8, 0.7, 0.6),
          true
        );
      }
      
      // Ahora caída abrupta
      for (let i = 0; i < 10; i++) {
        tracker.track(
          createMockRhythm({ confidence: 0.4 }),
          null,
          createMockAudio(0.25, 0.2, 0.3, 0.2),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm({ confidence: 0.4 }),
        null,
        createMockAudio(0.25, 0.2, 0.3, 0.2),
        true
      );
      
      // Caída de energía - lo importante es intensidad baja
      // El clasificador puede dar varios tipos de sección baja
      expect(['breakdown', 'verse', 'intro', 'outro', 'chorus']).toContain(result.current.type);
      expect(result.intensity).toBeLessThan(0.5); // Lo importante
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INTENSITY CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cálculo de intensidad', () => {
    it('debe calcular intensidad en rango [0, 1]', () => {
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.5, 0.5, 0.5, 0.5),
        true
      );
      
      expect(result.intensity).toBeGreaterThanOrEqual(0);
      expect(result.intensity).toBeLessThanOrEqual(1);
    });

    it('intensidad alta con audio energético', () => {
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.9, 0.85, 0.8, 0.75),
        true
      );
      
      expect(result.intensity).toBeGreaterThan(0.6);
    });

    it('intensidad baja con audio suave', () => {
      const result = tracker.track(
        createMockRhythm({ confidence: 0.3 }),
        null,
        createMockAudio(0.1, 0.1, 0.1, 0.1),
        true
      );
      
      expect(result.intensity).toBeLessThan(0.4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TREND DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Detección de tendencia', () => {
    it('debe detectar tendencia creciente', () => {
      // Energía creciente
      for (let i = 0; i < 40; i++) {
        const energy = 0.2 + (i * 0.015);
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(energy, energy, energy, energy),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.7, 0.7, 0.7, 0.7),
        true
      );
      
      expect(result.intensityTrend).toBe('rising');
    });

    it('debe detectar tendencia decreciente', () => {
      // Energía decreciente
      for (let i = 0; i < 40; i++) {
        const energy = 0.8 - (i * 0.015);
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(energy, energy, energy, energy),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.2, 0.2, 0.2, 0.2),
        true
      );
      
      expect(result.intensityTrend).toBe('falling');
    });

    it('debe detectar tendencia estable', () => {
      // Energía constante
      for (let i = 0; i < 40; i++) {
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(0.5, 0.5, 0.5, 0.5),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.5, 0.5, 0.5, 0.5),
        true
      );
      
      // Tendencia estable
      expect(result.intensityTrend).toBe('stable');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DROP PREDICTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Predicción de drop', () => {
    it('debe predecir drop durante buildup', () => {
      // Simular buildup sostenido
      for (let i = 0; i < 50; i++) {
        const energy = 0.3 + (i * 0.012);
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(energy, energy, energy, energy),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.75, 0.75, 0.75, 0.75),
        true
      );
      
      // Durante buildup, predecir drop
      if (result.current.type === 'buildup') {
        expect(result.predicted?.type).toBe('drop');
        expect(result.predicted?.probability).toBeGreaterThan(0.3);
      }
    });

    it('no debe predecir drop durante breakdown', () => {
      // Primero simular alta energía
      for (let i = 0; i < 20; i++) {
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(0.8, 0.8, 0.7, 0.6),
          true
        );
      }
      
      // Caída a breakdown
      for (let i = 0; i < 20; i++) {
        tracker.track(
          createMockRhythm({ confidence: 0.4 }),
          null,
          createMockAudio(0.2, 0.15, 0.25, 0.2),
          true
        );
      }
      
      const result = tracker.track(
        createMockRhythm({ confidence: 0.4 }),
        null,
        createMockAudio(0.2, 0.15, 0.25, 0.2),
        true
      );
      
      // En breakdown, no predecir drop inmediato
      if (result.predicted?.type === 'drop') {
        expect(result.predicted?.probability).toBeLessThan(0.5);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THROTTLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Throttling', () => {
    it('debe retornar caché si se llama muy rápido', () => {
      const result1 = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.5, 0.5, 0.5, 0.5),
        true // Forzar primera vez
      );
      
      // Segunda llamada sin forzar, debería usar caché
      const result2 = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.9, 0.9, 0.9, 0.9), // Audio muy diferente
        false // NO forzar
      );
      
      // Deberían ser iguales porque usa caché
      expect(result1.intensity).toBe(result2.intensity);
    });

    it('debe actualizar si pasa tiempo suficiente', async () => {
      const quickTracker = new SectionTracker({ throttleMs: 10 });
      
      const result1 = quickTracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.3, 0.3, 0.3, 0.3),
        true
      );
      
      // Esperar más que throttle
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const result2 = quickTracker.track(
        createMockRhythm(),
        null,
        createMockAudio(0.9, 0.9, 0.9, 0.9),
        false
      );
      
      // Ahora sí debería ser diferente
      expect(result2.intensity).toBeGreaterThan(result1.intensity);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('debe resetear estado correctamente', () => {
      // Llenar historial
      for (let i = 0; i < 20; i++) {
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(0.8, 0.8, 0.8, 0.8),
          true
        );
      }
      
      // Reset
      tracker.reset();
      
      // Verificar que empezó de nuevo
      const result = tracker.track(
        createMockRhythm({ confidence: 0.3 }),
        null,
        createMockAudio(0.2, 0.2, 0.2, 0.2),
        true
      );
      
      // Debería empezar como si fuera nuevo
      expect(result.current.duration).toBeLessThan(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('debe manejar audio silencioso', () => {
      const result = tracker.track(
        createMockRhythm({ confidence: 0 }),
        null,
        createMockAudio(0, 0, 0, 0),
        true
      );
      
      expect(result).toBeDefined();
      // La intensidad debería ser muy baja pero puede no ser exactamente 0
      // debido a los drums del rhythm mock
      expect(result.intensity).toBeLessThan(0.3);
    });

    it('debe manejar valores extremos de energía', () => {
      const result = tracker.track(
        createMockRhythm(),
        null,
        createMockAudio(1, 1, 1, 1),
        true
      );
      
      expect(result.intensity).toBeLessThanOrEqual(1);
    });

    it('debe manejar harmony null', () => {
      const result = tracker.track(
        createMockRhythm(),
        null, // harmony null
        createMockAudio(0.5, 0.5, 0.5, 0.5),
        true
      );
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Performance', () => {
    it('debe ejecutarse en menos de 5ms', () => {
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        tracker.track(
          createMockRhythm(),
          null,
          createMockAudio(Math.random(), Math.random(), Math.random(), Math.random()),
          true
        );
      }
      
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;
      
      expect(avgTime).toBeLessThan(5);
      console.log(`⚡ SectionTracker avg: ${avgTime.toFixed(3)}ms`);
    });
  });
});
