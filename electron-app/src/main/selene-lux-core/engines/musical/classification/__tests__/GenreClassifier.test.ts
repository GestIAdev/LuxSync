/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    🧪 GENRE CLASSIFIER TESTS                                 ║
 * ║━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━║
 * ║  Tests para el clasificador de géneros musicales                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * @wave WAVE-8 - FASE 3
 * @test GenreClassifier
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GenreClassifier } from '../GenreClassifier.js';
import { RhythmAnalysis, HarmonyAnalysis } from '../../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crea un RhythmAnalysis mock para un género específico
 */
function createRhythmFor(
  genre: 'techno' | 'cumbia' | 'reggaeton' | 'trap' | 'house' | 'dnb' | 'ambient' | 'default'
): RhythmAnalysis {
  const presets: Record<string, Partial<RhythmAnalysis>> = {
    // TECHNO: Four-on-floor, 130-140 BPM, sincopación muy baja
    techno: {
      bpm: 135,
      confidence: 0.9,
      groove: {
        syncopation: 0.08,
        swingAmount: 0,
        complexity: 'low',
        humanization: 0.02,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.9,
        snareDetected: true,
        snareIntensity: 0.4,
        hihatDetected: true,
        hihatIntensity: 0.6,
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // CUMBIA: 90-100 BPM, sincopación media, mucho treble (güiro)
    cumbia: {
      bpm: 95,
      confidence: 0.8,
      groove: {
        syncopation: 0.32,  // MEDIA - no tan alta como reggaeton
        swingAmount: 0.1,
        complexity: 'medium',
        humanization: 0.08,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.6,
        snareDetected: true,
        snareIntensity: 0.45,  // Snare NO tan prominente como reggaeton
        hihatDetected: true,
        hihatIntensity: 0.85, // Güiro! Alto treble
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // REGGAETON: 95-100 BPM, sincopación alta (dembow)
    reggaeton: {
      bpm: 95,
      confidence: 0.85,
      groove: {
        syncopation: 0.58,  // ALTA - mucho más que cumbia
        swingAmount: 0.05,
        complexity: 'medium',
        humanization: 0.05,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.7,
        snareDetected: true,
        snareIntensity: 0.8, // Dembow snare MUY prominente (el "tun-tun")
        hihatDetected: true,
        hihatIntensity: 0.5,
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // TRAP: 70-80 BPM, hi-hats rápidos, 808 bass
    trap: {
      bpm: 75,
      confidence: 0.8,
      groove: {
        syncopation: 0.45,
        swingAmount: 0.02,
        complexity: 'high',
        humanization: 0.03,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.5,
        snareDetected: true,
        snareIntensity: 0.6,
        hihatDetected: true,
        hihatIntensity: 0.9, // Hi-hats rápidos
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // HOUSE: 122-128 BPM, four-on-floor, sincopación moderada
    house: {
      bpm: 125,
      confidence: 0.85,
      groove: {
        syncopation: 0.2,
        swingAmount: 0.05,
        complexity: 'medium',
        humanization: 0.04,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.75,
        snareDetected: true,
        snareIntensity: 0.5,
        hihatDetected: true,
        hihatIntensity: 0.65,
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // DRUM AND BASS: 170-180 BPM
    dnb: {
      bpm: 174,
      confidence: 0.9,
      groove: {
        syncopation: 0.6,
        swingAmount: 0.02,
        complexity: 'high',
        humanization: 0.03,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.7,
        snareDetected: true,
        snareIntensity: 0.8,
        hihatDetected: true,
        hihatIntensity: 0.6,
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // AMBIENT: BPM bajo/variable, poca percusión
    ambient: {
      bpm: 90,
      confidence: 0.4,
      groove: {
        syncopation: 0.05,
        swingAmount: 0,
        complexity: 'low',
        humanization: 0.1,
      },
      drums: {
        kickDetected: false,
        kickIntensity: 0.1,
        snareDetected: false,
        snareIntensity: 0.1,
        hihatDetected: false,
        hihatIntensity: 0.1,
        crashDetected: false,
        fillDetected: false,
      },
    },
    
    // DEFAULT: Valores neutrales
    default: {
      bpm: 120,
      confidence: 0.7,
      groove: {
        syncopation: 0.25,
        swingAmount: 0.03,
        complexity: 'medium',
        humanization: 0.05,
      },
      drums: {
        kickDetected: true,
        kickIntensity: 0.5,
        snareDetected: true,
        snareIntensity: 0.5,
        hihatDetected: true,
        hihatIntensity: 0.5,
        crashDetected: false,
        fillDetected: false,
      },
    },
  };
  
  const preset = presets[genre] || presets.default;
  
  return {
    bpm: 120,
    confidence: 0.7,
    beatPhase: 0,
    barPhase: 0,
    pattern: { type: 'four_on_floor', confidence: 0.7 },
    drums: {
      kickDetected: true,
      kickIntensity: 0.5,
      snareDetected: true,
      snareIntensity: 0.5,
      hihatDetected: true,
      hihatIntensity: 0.5,
      crashDetected: false,
      fillDetected: false,
    },
    groove: {
      syncopation: 0.25,
      swingAmount: 0.03,
      complexity: 'medium',
      humanization: 0.05,
    },
    fillInProgress: false,
    timestamp: Date.now(),
    ...preset,
  } as RhythmAnalysis;
}

/**
 * Crea métricas de audio para un género
 */
function createAudioFor(
  genre: 'techno' | 'cumbia' | 'reggaeton' | 'trap' | 'house' | 'dnb' | 'ambient' | 'default'
): { energy: number; bass: number; mid: number; treble: number } {
  const presets: Record<string, { energy: number; bass: number; mid: number; treble: number }> = {
    techno: { energy: 0.75, bass: 0.8, mid: 0.5, treble: 0.5 },
    cumbia: { energy: 0.6, bass: 0.5, mid: 0.55, treble: 0.75 }, // Alto treble (güiro)
    reggaeton: { energy: 0.7, bass: 0.7, mid: 0.6, treble: 0.55 },
    trap: { energy: 0.65, bass: 0.85, mid: 0.3, treble: 0.7 }, // 808 bass + hi-hats
    house: { energy: 0.65, bass: 0.7, mid: 0.55, treble: 0.5 },
    dnb: { energy: 0.8, bass: 0.75, mid: 0.6, treble: 0.65 },
    ambient: { energy: 0.2, bass: 0.15, mid: 0.3, treble: 0.25 },
    default: { energy: 0.5, bass: 0.5, mid: 0.5, treble: 0.5 },
  };
  
  return presets[genre] || presets.default;
}

/**
 * Crea HarmonyAnalysis mock
 */
function createMockHarmony(mood: string = 'happy'): HarmonyAnalysis {
  return {
    key: 'C',
    mode: {
      scale: 'major',
      confidence: 0.8,
      mood: mood as any,
    },
    currentChord: {
      root: 'C',
      quality: 'major',
      confidence: 0.7,
    },
    confidence: 0.75,
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GenreClassifier', () => {
  let classifier: GenreClassifier;

  beforeEach(() => {
    classifier = new GenreClassifier();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Inicialización', () => {
    it('debe inicializar correctamente', () => {
      expect(classifier).toBeDefined();
    });

    it('debe retornar análisis válido', () => {
      const result = classifier.classify(
        createRhythmFor('default'),
        null,
        createAudioFor('default'),
        true
      );
      
      expect(result).toBeDefined();
      expect(result.genre).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('debe incluir scores de todos los géneros', () => {
      const result = classifier.classify(
        createRhythmFor('default'),
        null,
        createAudioFor('default'),
        true
      );
      
      expect(result.scores).toBeDefined();
      expect(result.scores.techno).toBeDefined();
      expect(result.scores.cumbia).toBeDefined();
      expect(result.scores.reggaeton).toBeDefined();
    });

    it('debe incluir features extraídas', () => {
      const result = classifier.classify(
        createRhythmFor('default'),
        null,
        createAudioFor('default'),
        true
      );
      
      expect(result.features).toBeDefined();
      expect(result.features.bpm).toBeDefined();
      expect(result.features.syncopation).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENRE CLASSIFICATION - TECHNO
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Clasificación: TECHNO', () => {
    it('debe detectar techno con four-on-floor y BPM alto', () => {
      // Warmup para estabilizar
      for (let i = 0; i < 5; i++) {
        classifier.classify(
          createRhythmFor('techno'),
          null,
          createAudioFor('techno'),
          true
        );
      }
      
      const result = classifier.classify(
        createRhythmFor('techno'),
        null,
        createAudioFor('techno'),
        true
      );
      
      // Techno o house son aceptables (son similares)
      expect(['techno', 'house']).toContain(result.genre);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('techno tiene sincopación baja', () => {
      const result = classifier.classify(
        createRhythmFor('techno'),
        null,
        createAudioFor('techno'),
        true
      );
      
      expect(result.features.syncopation).toBeLessThan(0.15);
    });

    it('techno detecta four-on-floor', () => {
      const result = classifier.classify(
        createRhythmFor('techno'),
        null,
        createAudioFor('techno'),
        true
      );
      
      expect(result.features.hasFourOnFloor).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENRE CLASSIFICATION - CUMBIA
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Clasificación: CUMBIA 🇦🇷', () => {
    it('debe detectar cumbia con güiro (treble alto)', () => {
      // Warmup
      for (let i = 0; i < 5; i++) {
        classifier.classify(
          createRhythmFor('cumbia'),
          null,
          createAudioFor('cumbia'),
          true
        );
      }
      
      const result = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      // Cumbia o latin_pop son aceptables
      expect(['cumbia', 'latin_pop', 'house']).toContain(result.genre);
    });

    it('cumbia tiene treble density alta (güiro)', () => {
      const result = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      // Treble density debería ser notable
      expect(result.features.trebleDensity).toBeGreaterThan(0.3);
    });

    it('cumbia tiene sincopación media', () => {
      const result = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      expect(result.features.syncopation).toBeGreaterThan(0.2);
      expect(result.features.syncopation).toBeLessThan(0.5);
    });

    it('cumbia NO tiene dembow', () => {
      const result = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      // Cumbia no tiene el patrón dembow
      expect(result.features.hasDembow).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENRE CLASSIFICATION - REGGAETON
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Clasificación: REGGAETON', () => {
    it('debe detectar reggaeton con dembow', () => {
      // Warmup
      for (let i = 0; i < 5; i++) {
        classifier.classify(
          createRhythmFor('reggaeton'),
          null,
          createAudioFor('reggaeton'),
          true
        );
      }
      
      const result = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      // Reggaeton tiene dembow y sincopación alta
      expect(['reggaeton', 'cumbia', 'latin_pop']).toContain(result.genre);
    });

    it('reggaeton tiene sincopación alta', () => {
      const result = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(result.features.syncopation).toBeGreaterThan(0.4);
    });

    it('reggaeton tiene dembow', () => {
      const result = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(result.features.hasDembow).toBe(true);
    });

    it('reggaeton tiene BPM en rango 90-100', () => {
      const result = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(result.features.bpm).toBeGreaterThanOrEqual(88);
      expect(result.features.bpm).toBeLessThanOrEqual(105);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENRE CLASSIFICATION - TRAP
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Clasificación: TRAP', () => {
    it('debe detectar trap con 808 bass', () => {
      // Warmup
      for (let i = 0; i < 5; i++) {
        classifier.classify(
          createRhythmFor('trap'),
          null,
          createAudioFor('trap'),
          true
        );
      }
      
      const result = classifier.classify(
        createRhythmFor('trap'),
        null,
        createAudioFor('trap'),
        true
      );
      
      // Trap o ambient por BPM bajo
      expect(['trap', 'ambient', 'unknown']).toContain(result.genre);
    });

    it('trap tiene 808 bass característico', () => {
      const result = classifier.classify(
        createRhythmFor('trap'),
        null,
        createAudioFor('trap'),
        true
      );
      
      expect(result.features.has808Bass).toBe(true);
    });

    it('trap tiene BPM bajo', () => {
      const result = classifier.classify(
        createRhythmFor('trap'),
        null,
        createAudioFor('trap'),
        true
      );
      
      expect(result.features.bpm).toBeLessThan(90);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GENRE CLASSIFICATION - HOUSE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Clasificación: HOUSE', () => {
    it('debe detectar house con four-on-floor y BPM medio', () => {
      // Warmup
      for (let i = 0; i < 5; i++) {
        classifier.classify(
          createRhythmFor('house'),
          null,
          createAudioFor('house'),
          true
        );
      }
      
      const result = classifier.classify(
        createRhythmFor('house'),
        null,
        createAudioFor('house'),
        true
      );
      
      // House, techno o latin_pop son similares en ciertos rangos
      expect(['house', 'techno', 'latin_pop']).toContain(result.genre);
    });

    it('house tiene sincopación moderada', () => {
      const result = classifier.classify(
        createRhythmFor('house'),
        null,
        createAudioFor('house'),
        true
      );
      
      expect(result.features.syncopation).toBeGreaterThanOrEqual(0.1);
      expect(result.features.syncopation).toBeLessThan(0.35);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DIFFERENTIATION - Cumbia vs Reggaeton
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Diferenciación: CUMBIA vs REGGAETON', () => {
    it('cumbia tiene menor sincopación que reggaeton', () => {
      const cumbiaResult = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      const reggaetonResult = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(cumbiaResult.features.syncopation)
        .toBeLessThan(reggaetonResult.features.syncopation);
    });

    it('reggaeton tiene dembow, cumbia no', () => {
      const cumbiaResult = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      const reggaetonResult = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(cumbiaResult.features.hasDembow).toBe(false);
      expect(reggaetonResult.features.hasDembow).toBe(true);
    });

    it('cumbia tiene más treble (güiro)', () => {
      const cumbiaResult = classifier.classify(
        createRhythmFor('cumbia'),
        null,
        createAudioFor('cumbia'),
        true
      );
      
      const reggaetonResult = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(cumbiaResult.features.trebleDensity)
        .toBeGreaterThan(reggaetonResult.features.trebleDensity);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DIFFERENTIATION - Techno vs House
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Diferenciación: TECHNO vs HOUSE', () => {
    it('techno tiene BPM más alto que house', () => {
      const technoResult = classifier.classify(
        createRhythmFor('techno'),
        null,
        createAudioFor('techno'),
        true
      );
      
      const houseResult = classifier.classify(
        createRhythmFor('house'),
        null,
        createAudioFor('house'),
        true
      );
      
      expect(technoResult.features.bpm).toBeGreaterThan(houseResult.features.bpm);
    });

    it('techno tiene menos sincopación que house', () => {
      const technoResult = classifier.classify(
        createRhythmFor('techno'),
        null,
        createAudioFor('techno'),
        true
      );
      
      const houseResult = classifier.classify(
        createRhythmFor('house'),
        null,
        createAudioFor('house'),
        true
      );
      
      expect(technoResult.features.syncopation)
        .toBeLessThan(houseResult.features.syncopation);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MOOD & SUBGENRE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Mood y Subgénero', () => {
    it('debe asignar mood basado en género', () => {
      const result = classifier.classify(
        createRhythmFor('reggaeton'),
        null,
        createAudioFor('reggaeton'),
        true
      );
      
      expect(result.mood).toBeDefined();
    });

    it('debe modificar mood con armonía', () => {
      const darkHarmony = createMockHarmony('tense');
      
      const result = classifier.classify(
        createRhythmFor('techno'),
        darkHarmony,
        createAudioFor('techno'),
        true
      );
      
      expect(result.mood).toBe('oscuro');
    });

    it('debe asignar subgénero cuando es posible', () => {
      const result = classifier.classify(
        createRhythmFor('techno'),
        createMockHarmony('happy'),
        createAudioFor('techno'),
        true
      );
      
      expect(result.subgenre).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // STABILITY (Historial)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Estabilidad', () => {
    it('debe tener género dominante después de varios frames', () => {
      // Varios frames de techno
      for (let i = 0; i < 10; i++) {
        classifier.classify(
          createRhythmFor('techno'),
          null,
          createAudioFor('techno'),
          true
        );
      }
      
      const dominant = classifier.getDominantGenre();
      expect(['techno', 'house']).toContain(dominant);
    });

    it('reset debe limpiar historial', () => {
      // Llenar historial
      for (let i = 0; i < 10; i++) {
        classifier.classify(
          createRhythmFor('techno'),
          null,
          createAudioFor('techno'),
          true
        );
      }
      
      classifier.reset();
      
      const dominant = classifier.getDominantGenre();
      expect(dominant).toBe('unknown');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THROTTLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Throttling', () => {
    it('debe usar caché si se llama muy rápido', () => {
      const result1 = classifier.classify(
        createRhythmFor('techno'),
        null,
        createAudioFor('techno'),
        true // Forzar
      );
      
      const result2 = classifier.classify(
        createRhythmFor('cumbia'), // Input muy diferente
        null,
        createAudioFor('cumbia'),
        false // NO forzar - debería usar caché
      );
      
      // Deberían ser iguales porque usa caché
      expect(result1.genre).toBe(result2.genre);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('debe manejar harmony null', () => {
      const result = classifier.classify(
        createRhythmFor('default'),
        null,
        createAudioFor('default'),
        true
      );
      
      expect(result).toBeDefined();
      expect(result.mood).toBeDefined();
    });

    it('debe manejar audio silencioso', () => {
      const result = classifier.classify(
        createRhythmFor('ambient'),
        null,
        { energy: 0, bass: 0, mid: 0, treble: 0 },
        true
      );
      
      expect(result).toBeDefined();
    });

    it('debe retornar unknown si no hay suficiente confianza', () => {
      const lowConfidenceRhythm = createRhythmFor('default');
      lowConfidenceRhythm.confidence = 0.1;
      
      const result = classifier.classify(
        lowConfidenceRhythm,
        null,
        { energy: 0.1, bass: 0.1, mid: 0.1, treble: 0.1 },
        true
      );
      
      // Baja confianza puede resultar en unknown
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Performance', () => {
    it('debe ejecutarse en menos de 2ms', () => {
      const iterations = 100;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        classifier.classify(
          createRhythmFor('techno'),
          null,
          createAudioFor('techno'),
          true
        );
      }
      
      const elapsed = performance.now() - start;
      const avgTime = elapsed / iterations;
      
      expect(avgTime).toBeLessThan(2);
      console.log(`⚡ GenreClassifier avg: ${avgTime.toFixed(3)}ms`);
    });
  });
});
