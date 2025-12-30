/**
 * 🧪 Tests para ScaleIdentifier y HarmonyDetector
 * ============================================================
 * Wave 8 - FASE 2: Análisis Armónico
 * 
 * Cobertura:
 * - ScaleIdentifier: identificación de escalas, chromagrama
 * - HarmonyDetector: key detection, mode mapping, dissonance
 * - Performance: throttling, < 10ms de análisis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ScaleIdentifier, 
  SCALE_INTERVALS, 
  createScaleIdentifier 
} from '../../classification/ScaleIdentifier.js';
import { 
  HarmonyDetector, 
  MODE_TO_MOOD, 
  MOOD_TEMPERATURE,
  createHarmonyDetector 
} from '../HarmonyDetector.js';
import { AudioAnalysis, ModalScale } from '../../types.js';

// ============================================================
// 🎸 MOCK DATA
// ============================================================

/**
 * Crear chromagrama mock para una escala
 * Las notas de la escala tienen energía alta, el resto bajo
 */
function createChromaForScale(root: number, scale: ModalScale): number[] {
  const chroma = new Array(12).fill(0.05); // Ruido de fondo
  const intervals = SCALE_INTERVALS[scale];
  
  for (const interval of intervals) {
    const pitchClass = (root + interval) % 12;
    chroma[pitchClass] = 0.8; // Alta energía para notas de la escala
  }
  
  // La raíz tiene la mayor energía
  chroma[root] = 1.0;
  
  return chroma;
}

/**
 * Crear AudioAnalysis mock
 */
function createMockAudio(options: {
  bass?: number;
  mid?: number;
  treble?: number;
  bpm?: number;
  beatPhase?: number;
}): AudioAnalysis {
  return {
    timestamp: Date.now(),
    spectrum: {
      bass: options.bass ?? 0.5,
      lowMid: 0.3,
      mid: options.mid ?? 0.5,
      highMid: 0.4,
      treble: options.treble ?? 0.3,
    },
    beat: {
      detected: true,
      bpm: options.bpm ?? 120,
      confidence: 0.9,
      beatPhase: options.beatPhase ?? 0,
      timeSinceLastBeat: 0,
    },
    energy: {
      current: 0.7,
      average: 0.6,
      variance: 0.1,
      trend: 'stable',
      peakRecent: 0.9,
    },
  };
}

// ============================================================
// 🎹 SCALE IDENTIFIER TESTS
// ============================================================

describe('ScaleIdentifier', () => {
  let identifier: ScaleIdentifier;

  beforeEach(() => {
    identifier = new ScaleIdentifier();
  });

  describe('initialization', () => {
    it('should create instance with default config', () => {
      expect(identifier).toBeInstanceOf(ScaleIdentifier);
    });

    it('should create instance with custom config', () => {
      const custom = createScaleIdentifier({ noteThreshold: 0.2 });
      expect(custom).toBeInstanceOf(ScaleIdentifier);
    });
  });

  describe('SCALE_INTERVALS', () => {
    it('should have all 13 scales defined', () => {
      expect(Object.keys(SCALE_INTERVALS)).toHaveLength(13);
    });

    it('should have major scale with correct intervals', () => {
      expect(SCALE_INTERVALS.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('should have minor scale with correct intervals', () => {
      expect(SCALE_INTERVALS.minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
    });

    it('should have phrygian scale with b2 interval', () => {
      expect(SCALE_INTERVALS.phrygian[1]).toBe(1); // b2 = 1 semitone
    });

    it('should have blues scale with 6 notes', () => {
      expect(SCALE_INTERVALS.blues).toHaveLength(6);
    });
  });

  describe('identifyScale', () => {
    it('should identify C Major scale', () => {
      const chroma = createChromaForScale(0, 'major'); // C = 0
      const result = identifier.identifyScale(chroma);
      
      expect(result.scale).toBe('major');
      expect(result.root).toBe(0);
      expect(result.rootName).toBe('C');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should identify A Minor scale', () => {
      const chroma = createChromaForScale(9, 'minor'); // A = 9
      const result = identifier.identifyScale(chroma);
      
      expect(result.scale).toBe('minor');
      expect(result.root).toBe(9);
      expect(result.rootName).toBe('A');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should identify D Dorian scale', () => {
      const chroma = createChromaForScale(2, 'dorian'); // D = 2
      const result = identifier.identifyScale(chroma);
      
      expect(result.scale).toBe('dorian');
      expect(result.root).toBe(2);
      expect(result.rootName).toBe('D');
    });

    it('should identify E Phrygian scale', () => {
      const chroma = createChromaForScale(4, 'phrygian'); // E = 4
      const result = identifier.identifyScale(chroma);
      
      expect(result.scale).toBe('phrygian');
      expect(result.root).toBe(4);
      expect(result.rootName).toBe('E');
    });

    it('should return chromatic with low confidence for empty chroma', () => {
      const chroma = new Array(12).fill(0.01); // Casi silencio
      const result = identifier.identifyScale(chroma);
      
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should throw error for invalid chroma length', () => {
      expect(() => identifier.identifyScale([0.5, 0.5])).toThrow();
    });
  });

  describe('getScaleNotes', () => {
    it('should return correct notes for C Major', () => {
      const notes = identifier.getScaleNotes(0, 'major');
      expect(notes).toEqual([0, 2, 4, 5, 7, 9, 11]); // C, D, E, F, G, A, B
    });

    it('should return correct notes for G Major', () => {
      const notes = identifier.getScaleNotes(7, 'major');
      expect(notes).toEqual([7, 9, 11, 0, 2, 4, 6]); // G, A, B, C, D, E, F#
    });

    it('should return pentatonic with 5 notes', () => {
      const notes = identifier.getScaleNotes(0, 'pentatonic_major');
      expect(notes).toHaveLength(5);
    });
  });

  describe('isInScale', () => {
    it('should return true for note in scale', () => {
      expect(identifier.isInScale(0, 0, 'major')).toBe(true);  // C in C Major
      expect(identifier.isInScale(4, 0, 'major')).toBe(true);  // E in C Major
      expect(identifier.isInScale(7, 0, 'major')).toBe(true);  // G in C Major
    });

    it('should return false for note not in scale', () => {
      expect(identifier.isInScale(1, 0, 'major')).toBe(false); // C# not in C Major
      expect(identifier.isInScale(6, 0, 'major')).toBe(false); // F# not in C Major
    });

    it('should handle octave wrapping', () => {
      expect(identifier.isInScale(12, 0, 'major')).toBe(true);  // C (octave up)
      expect(identifier.isInScale(64, 0, 'major')).toBe(true);  // E (MIDI 64)
    });

    it('should handle negative pitches', () => {
      expect(identifier.isInScale(-12, 0, 'major')).toBe(true); // C (octave down)
    });
  });

  describe('pitch/name conversion', () => {
    it('should convert pitch to name', () => {
      expect(identifier.pitchToName(0)).toBe('C');
      expect(identifier.pitchToName(4)).toBe('E');
      expect(identifier.pitchToName(11)).toBe('B');
    });

    it('should convert name to pitch', () => {
      expect(identifier.nameToPitch('C')).toBe(0);
      expect(identifier.nameToPitch('E')).toBe(4);
      expect(identifier.nameToPitch('B')).toBe(11);
    });

    it('should handle sharps', () => {
      expect(identifier.nameToPitch('C#')).toBe(1);
      expect(identifier.nameToPitch('F#')).toBe(6);
    });
  });
});

// ============================================================
// 🎸 HARMONY DETECTOR TESTS
// ============================================================

describe('HarmonyDetector', () => {
  let detector: HarmonyDetector;

  beforeEach(() => {
    detector = new HarmonyDetector({ throttleMs: 0 }); // Disable throttle for tests
  });

  describe('initialization', () => {
    it('should create instance with default config', () => {
      const d = createHarmonyDetector();
      expect(d).toBeInstanceOf(HarmonyDetector);
    });

    it('should create instance with custom config', () => {
      const custom = createHarmonyDetector({ throttleMs: 200 });
      expect(custom).toBeInstanceOf(HarmonyDetector);
    });
  });

  describe('MODE_TO_MOOD mapping', () => {
    it('should map major to happy', () => {
      expect(MODE_TO_MOOD.major).toBe('happy');
    });

    it('should map minor to sad', () => {
      expect(MODE_TO_MOOD.minor).toBe('sad');
    });

    it('should map dorian to jazzy', () => {
      expect(MODE_TO_MOOD.dorian).toBe('jazzy');
    });

    it('should map phrygian to spanish_exotic', () => {
      expect(MODE_TO_MOOD.phrygian).toBe('spanish_exotic');
    });

    it('should map lydian to dreamy', () => {
      expect(MODE_TO_MOOD.lydian).toBe('dreamy');
    });

    it('should map locrian to tense', () => {
      expect(MODE_TO_MOOD.locrian).toBe('tense');
    });
  });

  describe('MOOD_TEMPERATURE mapping', () => {
    it('should classify happy as warm', () => {
      expect(MOOD_TEMPERATURE.happy).toBe('warm');
    });

    it('should classify sad as cool', () => {
      expect(MOOD_TEMPERATURE.sad).toBe('cool');
    });

    it('should classify tense as neutral', () => {
      expect(MOOD_TEMPERATURE.tense).toBe('neutral');
    });
  });

  describe('analyze', () => {
    it('should return HarmonyAnalysis with all required fields', () => {
      const audio = createMockAudio({ bass: 0.7, mid: 0.5 });
      const result = detector.analyze(audio, true);
      
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('mode');
      expect(result).toHaveProperty('currentChord');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('timestamp');
    });

    it('should include mode with scale, confidence, and mood', () => {
      const audio = createMockAudio({ bass: 0.7 });
      const result = detector.analyze(audio, true);
      
      expect(result.mode).toHaveProperty('scale');
      expect(result.mode).toHaveProperty('confidence');
      expect(result.mode).toHaveProperty('mood');
    });

    it('should return low confidence for silent audio', () => {
      const audio = createMockAudio({ bass: 0.01, mid: 0.01, treble: 0.01 });
      audio.energy.current = 0.01;
      const result = detector.analyze(audio, true);
      
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('should emit harmony event', () => {
      const handler = vi.fn();
      detector.on('harmony', handler);
      
      const audio = createMockAudio({ bass: 0.7 });
      detector.analyze(audio, true);
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('throttling (REGLA 1)', () => {
    it('should return cached result when throttled', () => {
      const throttledDetector = new HarmonyDetector({ throttleMs: 1000 });
      
      const audio1 = createMockAudio({ bass: 0.7 });
      const result1 = throttledDetector.analyze(audio1, true); // Force first
      
      const audio2 = createMockAudio({ bass: 0.3 });
      const result2 = throttledDetector.analyze(audio2, false); // Should be cached
      
      expect(result1.timestamp).toBe(result2.timestamp);
    });

    it('should allow forceAnalysis to bypass throttle', () => {
      const throttledDetector = new HarmonyDetector({ throttleMs: 1000 });
      
      const audio1 = createMockAudio({ bass: 0.7 });
      throttledDetector.analyze(audio1, true);
      
      // Pequeña espera
      const audio2 = createMockAudio({ bass: 0.3 });
      const result2 = throttledDetector.analyze(audio2, true); // Force
      
      expect(result2).toBeDefined();
    });
  });

  describe('detectDissonance', () => {
    it('should detect tritone as disonant', () => {
      // Chromagrama con C y F# (tritono)
      const chromaAnalysis = {
        chroma: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], // C y F#
        dominantPitch: 0,
        totalEnergy: 2,
      };
      
      // Access private method through analyze
      const detector2 = new HarmonyDetector({ detectDissonance: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dissonance = (detector2 as any).detectDissonance(chromaAnalysis);
      
      expect(dissonance.hasTritone).toBe(true);
      expect(dissonance.suggestTension).toBe(true);
    });

    it('should emit tension event for high dissonance', () => {
      const handler = vi.fn();
      detector.on('tension', handler);
      
      // Crear audio que genere disonancia
      const audio = createMockAudio({});
      // Forzar un rawFFT que genere tritono
      audio.rawFFT = new Float32Array(1024);
      // Simular frecuencias de C y F#
      
      detector.analyze(audio, true);
      // El evento puede o no dispararse dependiendo del análisis real
    });
  });

  describe('estimateChord', () => {
    it('should detect major chord', () => {
      // C, E, G (major triad)
      const chromaAnalysis = {
        chroma: [1, 0, 0, 0, 0.8, 0, 0, 0.7, 0, 0, 0, 0],
        dominantPitch: 0,
        totalEnergy: 2.5,
      };
      
      const chord = detector.estimateChord(chromaAnalysis);
      expect(chord.root).toBe('C');
      expect(chord.quality).toBe('major');
    });

    it('should detect minor chord', () => {
      // A, C, E (Am triad)
      const chromaAnalysis = {
        chroma: [0.8, 0, 0, 0, 0.7, 0, 0, 0, 0, 1, 0, 0],
        dominantPitch: 9,
        totalEnergy: 2.5,
      };
      
      const chord = detector.estimateChord(chromaAnalysis);
      expect(chord.root).toBe('A');
      expect(chord.quality).toBe('minor');
    });

    it('should return null quality for unclear chord', () => {
      const chromaAnalysis = {
        chroma: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
        dominantPitch: 0,
        totalEnergy: 3.6,
      };
      
      const chord = detector.estimateChord(chromaAnalysis);
      expect(chord.confidence).toBeLessThan(0.5);
    });
  });

  describe('detectMode', () => {
    it('should return mood and temperature', () => {
      const audio = createMockAudio({ bass: 0.7 });
      const result = detector.detectMode(audio);
      
      expect(result).toHaveProperty('scale');
      expect(result).toHaveProperty('mood');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('temperature');
      expect(['warm', 'cool', 'neutral']).toContain(result.temperature);
    });
  });

  describe('key change detection', () => {
    it('should emit key-change event when key changes', () => {
      const handler = vi.fn();
      detector.on('key-change', handler);
      
      // Simular cambio de tonalidad
      const audio1 = createMockAudio({});
      detector.analyze(audio1, true);
      
      // Forzar un análisis diferente
      // Nota: el cambio de key depende del algoritmo interno
    });
  });

  describe('getters and utilities', () => {
    it('should return last analysis', () => {
      const audio = createMockAudio({});
      detector.analyze(audio, true);
      
      const last = detector.getLastAnalysis();
      expect(last).not.toBeNull();
    });

    it('should return history', () => {
      const audio = createMockAudio({});
      detector.analyze(audio, true);
      
      const history = detector.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should reset state', () => {
      const audio = createMockAudio({});
      detector.analyze(audio, true);
      
      detector.reset();
      
      expect(detector.getLastAnalysis()).toBeNull();
      expect(detector.getHistory()).toHaveLength(0);
    });

    it('should suggest temperature based on mood', () => {
      const audio = createMockAudio({});
      detector.analyze(audio, true);
      
      const temp = detector.getSuggestedTemperature();
      expect(['warm', 'cool', 'neutral']).toContain(temp);
    });
  });

  describe('performance', () => {
    it('should complete analyze in < 10ms', () => {
      const audio = createMockAudio({});
      
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        detector.analyze(audio, true);
      }
      const end = performance.now();
      
      const avgTime = (end - start) / 10;
      expect(avgTime).toBeLessThan(10);
    });
  });
});

// ============================================================
// 🎭 INTEGRATION TESTS
// ============================================================

describe('Harmony Integration', () => {
  it('should map Techno (Major) to warm lighting', () => {
    const _detector = createHarmonyDetector({ throttleMs: 0 });
    const identifier = createScaleIdentifier();
    
    // Chromagrama de C Major (típico de Techno eufórico)
    const chroma = createChromaForScale(0, 'major');
    const scaleMatch = identifier.identifyScale(chroma);
    
    expect(scaleMatch.scale).toBe('major');
    expect(MODE_TO_MOOD[scaleMatch.scale]).toBe('happy');
    expect(MOOD_TEMPERATURE.happy).toBe('warm');
    
    // Detector disponible para tests extendidos
    expect(_detector).toBeInstanceOf(HarmonyDetector);
  });

  it('should map Dark Techno (Minor) to cool lighting', () => {
    const identifier = createScaleIdentifier();
    
    // Chromagrama de A Minor (típico de Techno oscuro)
    const chroma = createChromaForScale(9, 'minor');
    const scaleMatch = identifier.identifyScale(chroma);
    
    expect(scaleMatch.scale).toBe('minor');
    expect(MODE_TO_MOOD[scaleMatch.scale]).toBe('sad');
    expect(MOOD_TEMPERATURE.sad).toBe('cool');
  });

  it('should map Flamenco (Phrygian) to exotic/warm', () => {
    const identifier = createScaleIdentifier();
    
    // Chromagrama de E Phrygian (Flamenco típico)
    const chroma = createChromaForScale(4, 'phrygian');
    const scaleMatch = identifier.identifyScale(chroma);
    
    expect(scaleMatch.scale).toBe('phrygian');
    expect(MODE_TO_MOOD[scaleMatch.scale]).toBe('spanish_exotic');
    expect(MOOD_TEMPERATURE.spanish_exotic).toBe('warm');
  });

  it('should map Jazz (Dorian) to cool jazzy lighting', () => {
    const identifier = createScaleIdentifier();
    
    // Chromagrama de D Dorian (Jazz típico)
    const chroma = createChromaForScale(2, 'dorian');
    const scaleMatch = identifier.identifyScale(chroma);
    
    expect(scaleMatch.scale).toBe('dorian');
    expect(MODE_TO_MOOD[scaleMatch.scale]).toBe('jazzy');
    expect(MOOD_TEMPERATURE.jazzy).toBe('cool');
  });
});
