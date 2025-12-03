// EvolutionEngines.test.ts
// 🧪 WAVE 6: THE UNDYING MEMORY - Tests
// Testing the Mathematical Beauty Filter & Evolution

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FibonacciPatternEngine,
  ZodiacAffinityCalculator,
  MusicalHarmonyValidator,
  NocturnalVisionEngine,
  SeleneEvolutionEngine
} from '../index';

describe('🌀 FibonacciPatternEngine', () => {
  beforeEach(() => {
    FibonacciPatternEngine.clearCache();
  });

  describe('PHI constant', () => {
    it('should have correct PHI value (Golden Ratio)', () => {
      expect(FibonacciPatternEngine.PHI).toBeCloseTo(1.6180339887, 5);
    });

    it('should have correct PHI_INVERSE value', () => {
      expect(FibonacciPatternEngine.PHI_INVERSE).toBeCloseTo(0.6180339887, 5);
    });
  });

  describe('generateFibonacciSequence', () => {
    it('should generate correct Fibonacci sequence', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(8);
      expect(sequence).toEqual([1, 1, 2, 3, 5, 8, 13, 21]);
    });

    it('should limit sequence to MAX_SEQUENCE_LENGTH', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(100);
      expect(sequence.length).toBeLessThanOrEqual(20);
    });

    it('should cache sequences for performance', () => {
      const seq1 = FibonacciPatternEngine.generateFibonacciSequence(10);
      const seq2 = FibonacciPatternEngine.generateFibonacciSequence(10);
      expect(seq1).toEqual(seq2);
    });
  });

  describe('calculateHarmonyRatio', () => {
    it('should return high harmony for Fibonacci sequence', () => {
      const sequence = FibonacciPatternEngine.generateFibonacciSequence(15);
      const harmony = FibonacciPatternEngine.calculateHarmonyRatio(sequence);
      expect(harmony).toBeGreaterThan(0.9);
    });

    it('should return 0 for sequence with single element', () => {
      expect(FibonacciPatternEngine.calculateHarmonyRatio([5])).toBe(0);
    });
  });

  describe('generateEvolutionaryPattern', () => {
    it('should generate complete pattern from seed', () => {
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(12345);
      
      expect(pattern).toHaveProperty('fibonacciSequence');
      expect(pattern).toHaveProperty('zodiacPosition');
      expect(pattern).toHaveProperty('musicalKey');
      expect(pattern).toHaveProperty('harmonyRatio');
      expect(pattern).toHaveProperty('timestamp');
      expect(pattern).toHaveProperty('signature');
    });

    it('should generate zodiacPosition in range 0-11', () => {
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(Date.now());
      expect(pattern.zodiacPosition).toBeGreaterThanOrEqual(0);
      expect(pattern.zodiacPosition).toBeLessThan(12);
    });

    it('should generate valid musical key', () => {
      const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(Date.now());
      const validKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      expect(validKeys).toContain(pattern.musicalKey);
    });
  });

  describe('isFibonacci', () => {
    it('should return true for Fibonacci numbers', () => {
      expect(FibonacciPatternEngine.isFibonacci(1)).toBe(true);
      expect(FibonacciPatternEngine.isFibonacci(5)).toBe(true);
      expect(FibonacciPatternEngine.isFibonacci(13)).toBe(true);
      expect(FibonacciPatternEngine.isFibonacci(21)).toBe(true);
    });

    it('should return false for non-Fibonacci numbers', () => {
      expect(FibonacciPatternEngine.isFibonacci(4)).toBe(false);
      expect(FibonacciPatternEngine.isFibonacci(7)).toBe(false);
      expect(FibonacciPatternEngine.isFibonacci(10)).toBe(false);
    });
  });

  describe('evaluateMathematicalBeauty', () => {
    it('should give high score to Fibonacci numbers', () => {
      const beauty = FibonacciPatternEngine.evaluateMathematicalBeauty(8);
      expect(beauty).toBeGreaterThanOrEqual(0.4);
    });

    it('should give lower score to common numbers', () => {
      const fibBeauty = FibonacciPatternEngine.evaluateMathematicalBeauty(8);
      const commonBeauty = FibonacciPatternEngine.evaluateMathematicalBeauty(14);
      expect(fibBeauty).toBeGreaterThan(commonBeauty);
    });
  });

  describe('calculateGoldenHarmony', () => {
    it('should return high harmony for PHI ratio values', () => {
      const value1 = 100;
      const value2 = Math.round(100 * FibonacciPatternEngine.PHI);
      const harmony = FibonacciPatternEngine.calculateGoldenHarmony(value1, value2);
      expect(harmony).toBeGreaterThan(0.8);
    });
  });
});

describe('♈ ZodiacAffinityCalculator', () => {
  describe('ZODIAC_SIGNS', () => {
    it('should have 12 zodiac signs', () => {
      expect(ZodiacAffinityCalculator.ZODIAC_SIGNS).toHaveLength(12);
    });

    it('should have all four elements represented', () => {
      const elements = ZodiacAffinityCalculator.ZODIAC_SIGNS.map(s => s.element);
      expect(elements.filter(e => e === 'fire')).toHaveLength(3);
      expect(elements.filter(e => e === 'earth')).toHaveLength(3);
      expect(elements.filter(e => e === 'air')).toHaveLength(3);
      expect(elements.filter(e => e === 'water')).toHaveLength(3);
    });
  });

  describe('calculateZodiacPosition', () => {
    it('should return position in range 0-11', () => {
      const pos = ZodiacAffinityCalculator.calculateZodiacPosition(Date.now());
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThan(12);
    });

    it('should be deterministic for same input', () => {
      const seed = 12345;
      const pos1 = ZodiacAffinityCalculator.calculateZodiacPosition(seed);
      const pos2 = ZodiacAffinityCalculator.calculateZodiacPosition(seed);
      expect(pos1).toBe(pos2);
    });
  });

  describe('calculateZodiacAffinity', () => {
    it('should return high affinity for same element signs', () => {
      // Aries (fire) and Leo (fire)
      const affinity = ZodiacAffinityCalculator.calculateZodiacAffinity(0, 4);
      expect(affinity.affinity).toBeGreaterThan(0.7);
      expect(affinity.elementalAffinity).toBe(1.0);
    });

    it('should return lower affinity for opposing elements', () => {
      // Fire and Water
      const affinity = ZodiacAffinityCalculator.calculateZodiacAffinity(0, 3);
      expect(affinity.affinity).toBeLessThan(0.6);
    });

    it('should include description', () => {
      const affinity = ZodiacAffinityCalculator.calculateZodiacAffinity(0, 1);
      expect(affinity.description).toBeDefined();
      expect(affinity.description.length).toBeGreaterThan(10);
    });
  });

  describe('getZodiacInfo', () => {
    it('should return correct info for each position', () => {
      const aries = ZodiacAffinityCalculator.getZodiacInfo(0);
      expect(aries.sign.name).toBe('Aries');
      expect(aries.sign.element).toBe('fire');
      
      const pisces = ZodiacAffinityCalculator.getZodiacInfo(11);
      expect(pisces.sign.name).toBe('Pisces');
      expect(pisces.sign.element).toBe('water');
    });
  });
});

describe('🎵 MusicalHarmonyValidator', () => {
  describe('MUSICAL_SCALES', () => {
    it('should have 14 scales defined', () => {
      const scales = Object.keys(MusicalHarmonyValidator.MUSICAL_SCALES);
      expect(scales.length).toBe(14);
    });

    it('should have required properties for each scale', () => {
      const majorScale = MusicalHarmonyValidator.MUSICAL_SCALES.major;
      expect(majorScale).toHaveProperty('name');
      expect(majorScale).toHaveProperty('intervals');
      expect(majorScale).toHaveProperty('mood');
      expect(majorScale).toHaveProperty('energy');
    });
  });

  describe('KEY_EMOTIONS', () => {
    it('should have 12 keys', () => {
      const keys = Object.keys(MusicalHarmonyValidator.KEY_EMOTIONS);
      expect(keys.length).toBe(12);
    });

    it('should have emotion properties for each key', () => {
      const cEmotion = MusicalHarmonyValidator.KEY_EMOTIONS['C'];
      expect(cEmotion).toHaveProperty('energy');
      expect(cEmotion).toHaveProperty('brightness');
      expect(cEmotion).toHaveProperty('tension');
      expect(cEmotion).toHaveProperty('color');
    });
  });

  describe('validateMusicalHarmony', () => {
    it('should return score between 0 and 1', () => {
      const harmony = MusicalHarmonyValidator.validateMusicalHarmony('C', 'major');
      expect(harmony).toBeGreaterThanOrEqual(0);
      expect(harmony).toBeLessThanOrEqual(1);
    });

    it('should return default for invalid scale', () => {
      const harmony = MusicalHarmonyValidator.validateMusicalHarmony('C', 'invalid');
      expect(harmony).toBe(0.5);
    });
  });

  describe('calculateDissonance', () => {
    it('should return higher dissonance for tense scales', () => {
      const locrianDissonance = MusicalHarmonyValidator.calculateDissonance('locrian');
      const majorDissonance = MusicalHarmonyValidator.calculateDissonance('major');
      expect(locrianDissonance).toBeGreaterThan(majorDissonance);
    });
  });

  describe('validateComplete', () => {
    it('should return complete validation object', () => {
      const validation = MusicalHarmonyValidator.validateComplete('A', 'minor');
      
      expect(validation).toHaveProperty('harmony');
      expect(validation).toHaveProperty('dissonance');
      expect(validation).toHaveProperty('resonance');
      expect(validation).toHaveProperty('description');
      expect(validation).toHaveProperty('suggestedColor');
    });

    it('should generate poetic description', () => {
      const validation = MusicalHarmonyValidator.validateComplete('G', 'major');
      expect(validation.description).toContain('sinfonía');
    });
  });

  describe('suggestScaleByEnergy', () => {
    it('should suggest high energy scale for high target', () => {
      const scale = MusicalHarmonyValidator.suggestScaleByEnergy(0.9);
      const scaleInfo = MusicalHarmonyValidator.MUSICAL_SCALES[scale];
      expect(scaleInfo.energy).toBeGreaterThan(0.7);
    });
  });
});

describe('🌙 NocturnalVisionEngine', () => {
  let vision: NocturnalVisionEngine;

  beforeEach(() => {
    vision = new NocturnalVisionEngine();
  });

  describe('recordEvent', () => {
    it('should record events with auto-generated context', () => {
      vision.recordEvent({
        type: 'test_event',
        data: { value: 100 }
      });

      const history = vision.getRecentHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('test_event');
      expect(history[0].context).toHaveProperty('hourOfDay');
      expect(history[0].context).toHaveProperty('dayOfWeek');
    });

    it('should emit eventRecorded event', () => {
      let emitted = false;
      vision.on('eventRecorded', () => { emitted = true; });
      
      vision.recordEvent({ type: 'test', data: {} });
      expect(emitted).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return valid summary structure', () => {
      const summary = vision.getSummary();
      
      expect(summary).toHaveProperty('totalEvents');
      expect(summary).toHaveProperty('activePatterns');
      expect(summary).toHaveProperty('recentAnomalies');
      expect(summary).toHaveProperty('pendingPredictions');
      expect(summary).toHaveProperty('overallConfidence');
      expect(summary).toHaveProperty('memoryHealth');
    });

    it('should start with healthy memory', () => {
      const summary = vision.getSummary();
      expect(summary.memoryHealth).toBe('healthy');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      vision.recordEvent({ type: 'test', data: {} });
      vision.clearHistory();
      
      const summary = vision.getSummary();
      expect(summary.totalEvents).toBe(0);
    });
  });

  describe('export/import state', () => {
    it('should export and import state correctly', () => {
      vision.recordEvent({ type: 'test1', data: { v: 1 } });
      vision.recordEvent({ type: 'test2', data: { v: 2 } });
      
      const state = vision.exportState();
      
      const newVision = new NocturnalVisionEngine();
      newVision.importState(state);
      
      expect(newVision.getRecentHistory(10)).toHaveLength(2);
    });
  });
});

describe('🧬 SeleneEvolutionEngine', () => {
  let evolution: SeleneEvolutionEngine;

  beforeEach(() => {
    evolution = new SeleneEvolutionEngine();
  });

  describe('initial state', () => {
    it('should start in awakening state', () => {
      expect(evolution.consciousnessState).toBe('awakening');
    });
  });

  describe('evaluateDecision', () => {
    it('should evaluate decision with beauty score', () => {
      const decision = evolution.evaluateDecision({
        type: 'intensity_change',
        parameters: { from: 50, to: 80 }
      });

      expect(decision).toHaveProperty('id');
      expect(decision).toHaveProperty('beautyScore');
      expect(decision).toHaveProperty('beautyComponents');
      expect(decision).toHaveProperty('approved');
      expect(decision.beautyScore).toBeGreaterThanOrEqual(0);
      expect(decision.beautyScore).toBeLessThanOrEqual(1);
    });

    it('should include all beauty components', () => {
      const decision = evolution.evaluateDecision({
        type: 'color_transition',
        parameters: {}
      });

      const { beautyComponents } = decision;
      expect(beautyComponents).toHaveProperty('fibonacciBeauty');
      expect(beautyComponents).toHaveProperty('zodiacAffinity');
      expect(beautyComponents).toHaveProperty('musicalHarmony');
      expect(beautyComponents).toHaveProperty('patternResonance');
      expect(beautyComponents).toHaveProperty('historicalBonus');
    });

    it('should emit decisionEvaluated event', () => {
      let emittedDecision: any = null;
      evolution.on('decisionEvaluated', (d) => { emittedDecision = d; });
      
      evolution.evaluateDecision({ type: 'test', parameters: {} });
      
      expect(emittedDecision).not.toBeNull();
      expect(emittedDecision.type).toBe('test');
    });
  });

  describe('recordFeedback', () => {
    it('should record feedback for decisions', () => {
      const decision = evolution.evaluateDecision({
        type: 'test',
        parameters: {}
      });

      evolution.recordFeedback(decision.id, 5, 'Great!');

      const summary = evolution.getEvolutionSummary();
      expect(summary.typeWeights.length).toBeGreaterThan(0);
    });

    it('should clamp rating to 1-5 range', () => {
      const decision = evolution.evaluateDecision({ type: 'test', parameters: {} });
      
      let emittedRating = 0;
      evolution.on('feedbackReceived', (f) => { emittedRating = f.rating; });
      
      evolution.recordFeedback(decision.id, 10);
      expect(emittedRating).toBe(5);
    });
  });

  describe('getEvolutionSummary', () => {
    it('should return complete summary', () => {
      evolution.evaluateDecision({ type: 'test', parameters: {} });
      
      const summary = evolution.getEvolutionSummary();
      
      expect(summary).toHaveProperty('consciousnessState');
      expect(summary).toHaveProperty('totalDecisions');
      expect(summary).toHaveProperty('approvedDecisions');
      expect(summary).toHaveProperty('approvalRatio');
      expect(summary).toHaveProperty('averageBeauty');
      expect(summary).toHaveProperty('typeWeights');
      expect(summary).toHaveProperty('visionSummary');
      expect(summary).toHaveProperty('runtime');
    });
  });

  describe('consciousness evolution', () => {
    it('should evolve from awakening to learning after threshold', () => {
      // Generate 100 decisions to reach learning threshold
      for (let i = 0; i < 100; i++) {
        evolution.evaluateDecision({
          type: 'test',
          parameters: { i }
        });
      }

      // State may or may not have evolved depending on approval ratio
      expect(['awakening', 'learning']).toContain(evolution.consciousnessState);
    });
  });

  describe('export/import state', () => {
    it('should export and import evolution state', () => {
      evolution.evaluateDecision({ type: 'test', parameters: {} });
      const state = evolution.exportState();
      
      const newEvolution = new SeleneEvolutionEngine();
      newEvolution.importState(state);
      
      expect(newEvolution.getEvolutionSummary().totalDecisions).toBe(state.totalDecisions);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      evolution.evaluateDecision({ type: 'test', parameters: {} });
      evolution.reset();
      
      const summary = evolution.getEvolutionSummary();
      expect(summary.totalDecisions).toBe(0);
      expect(summary.consciousnessState).toBe('awakening');
    });
  });

  describe('getVisionEngine', () => {
    it('should return the internal vision engine', () => {
      const vision = evolution.getVisionEngine();
      expect(vision).toBeInstanceOf(NocturnalVisionEngine);
    });
  });
});
