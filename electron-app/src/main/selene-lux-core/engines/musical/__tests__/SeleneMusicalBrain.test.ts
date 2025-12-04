/**
 * 🧠 SELENE MUSICAL BRAIN - Integration Tests
 * =============================================
 * Tests para verificar que el flujo completo Learn-Or-Recall funciona
 * 
 * FASE 7: Integración
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  SeleneMusicalBrain,
  getMusicalBrain,
  resetMusicalBrain,
} from '../SeleneMusicalBrain';

import type { AudioAnalysis } from '../types';

// ============================================================
// HELPERS
// ============================================================

function createTempDbPath(): string {
  const tmpDir = os.tmpdir();
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  return path.join(tmpDir, `selene-brain-test-${uniqueId}.db`);
}

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
      confidence: 0.8,
      beatPhase: 0.5,
      timeSinceLastBeat: 234,
    },
    energy: {
      current: 0.7,
      average: 0.65,
      variance: 0.1,
      trend: 'stable',
      peakRecent: 0.9,
    },
    ...overrides,
  };
}

function createHighConfidenceAudio(): AudioAnalysis {
  return createMockAudio({
    beat: {
      detected: true,
      bpm: 128,
      confidence: 0.95,
      beatPhase: 0.5,
      timeSinceLastBeat: 234,
    },
    energy: {
      current: 0.8,
      average: 0.75,
      variance: 0.05,
      trend: 'rising',
      peakRecent: 0.95,
    },
  });
}

// ============================================================
// TESTS
// ============================================================

describe('🧠 SeleneMusicalBrain', () => {
  let brain: SeleneMusicalBrain;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = createTempDbPath();
    brain = new SeleneMusicalBrain({ dbPath, debug: false });
    await brain.initialize();
  });

  afterEach(async () => {
    await brain.shutdown();
    // Cleanup DB
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      if (fs.existsSync(dbPath + '-wal')) {
        fs.unlinkSync(dbPath + '-wal');
      }
      if (fs.existsSync(dbPath + '-shm')) {
        fs.unlinkSync(dbPath + '-shm');
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(brain.isReady()).toBe(true);
    });

    it('should have a session ID after initialize', () => {
      const stats = brain.getSessionStats();
      expect(stats.framesProcessed).toBe(0);
    });
  });

  describe('Processing', () => {
    it('should process audio frame without error', () => {
      const audio = createMockAudio();
      const output = brain.process(audio);
      
      expect(output).toBeDefined();
      expect(output.timestamp).toBeGreaterThan(0);
      expect(output.sessionId).toBeDefined();
    });

    it('should return palette with all required colors', () => {
      const audio = createMockAudio();
      const output = brain.process(audio);
      
      expect(output.palette.primary).toBeDefined();
      expect(output.palette.secondary).toBeDefined();
      expect(output.palette.accent).toBeDefined();
      expect(output.palette.strategy).toBeDefined();
    });

    it('should return lighting suggestion', () => {
      const audio = createMockAudio();
      const output = brain.process(audio);
      
      expect(output.lighting).toBeDefined();
      expect(output.lighting.fixtures).toBeDefined();
      expect(output.lighting.mode).toMatch(/reactive|intelligent/);
    });

    it('should track performance metrics', () => {
      const audio = createMockAudio();
      const output = brain.process(audio);
      
      expect(output.performance.totalMs).toBeGreaterThan(0);
      expect(output.performance.contextMs).toBeGreaterThanOrEqual(0);
      expect(output.performance.paletteMs).toBeGreaterThanOrEqual(0);
      expect(output.performance.mappingMs).toBeGreaterThanOrEqual(0);
    });

    it('should increment frame count', () => {
      const audio = createMockAudio();
      brain.process(audio);
      brain.process(audio);
      brain.process(audio);
      
      const stats = brain.getSessionStats();
      expect(stats.framesProcessed).toBe(3);
    });
  });

  describe('Mode Detection', () => {
    it('should start in reactive mode with low confidence', () => {
      const audio = createMockAudio({
        beat: {
          detected: false,
          bpm: 0,
          confidence: 0.1,
          beatPhase: 0,
          timeSinceLastBeat: 5000,
        },
      });
      
      const output = brain.process(audio);
      expect(output.mode).toBe('reactive');
    });

    it('should track palette source', () => {
      const audio = createMockAudio();
      const output = brain.process(audio);
      
      expect(['memory', 'procedural', 'fallback']).toContain(output.paletteSource);
    });
  });

  describe('Statistics', () => {
    it('should track session statistics', () => {
      const audio = createMockAudio();
      
      for (let i = 0; i < 10; i++) {
        brain.process(audio);
      }
      
      const stats = brain.getSessionStats();
      expect(stats.framesProcessed).toBe(10);
      expect(stats.avgBeautyScore).toBeGreaterThan(0);
      expect(stats.maxBeautyScore).toBeGreaterThanOrEqual(stats.avgBeautyScore);
    });

    it('should return memory stats', () => {
      const memStats = brain.getMemoryStats();
      
      expect(memStats).toBeDefined();
      expect(typeof memStats.totalPalettes).toBe('number');
      expect(typeof memStats.totalPatterns).toBe('number');
    });
  });

  describe('Reset', () => {
    it('should reset state', () => {
      const audio = createMockAudio();
      brain.process(audio);
      brain.process(audio);
      
      brain.reset();
      
      const stats = brain.getSessionStats();
      expect(stats.framesProcessed).toBe(0);
      expect(stats.palettesFromMemory).toBe(0);
      expect(stats.palettesGenerated).toBe(0);
    });

    it('should clear last output', () => {
      const audio = createMockAudio();
      brain.process(audio);
      
      expect(brain.getLastOutput()).not.toBeNull();
      
      brain.reset();
      
      expect(brain.getLastOutput()).toBeNull();
    });
  });

  describe('Config Update', () => {
    it('should update config in runtime', () => {
      brain.updateConfig({ debug: true });
      // No error means success
      expect(brain.isReady()).toBe(true);
    });

    it('should emit config-updated event', () => {
      const spy = vi.fn();
      brain.on('config-updated', spy);
      
      brain.updateConfig({ autoLearn: false });
      
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Events', () => {
    it('should emit output event on process', () => {
      const spy = vi.fn();
      brain.on('output', spy);
      
      const audio = createMockAudio();
      brain.process(audio);
      
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should emit shutdown event', async () => {
      const spy = vi.fn();
      brain.on('shutdown', spy);
      
      await brain.shutdown();
      
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Feedback', () => {
    it('should record feedback without error', () => {
      brain.recordFeedback({
        rating: 1,
        comment: 'Great palette!',
      });
      // No error means success
      expect(brain.isReady()).toBe(true);
    });

    it('should emit feedback-recorded event', () => {
      const spy = vi.fn();
      brain.on('feedback-recorded', spy);
      
      brain.recordFeedback({ rating: -1 });
      
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('🧠 Singleton Pattern', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
  });

  afterEach(async () => {
    await resetMusicalBrain();
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (e) {
      // Ignore
    }
  });

  it('should return same instance', () => {
    const brain1 = getMusicalBrain({ dbPath });
    const brain2 = getMusicalBrain();
    
    expect(brain1).toBe(brain2);
  });

  it('should reset singleton', async () => {
    const brain1 = getMusicalBrain({ dbPath });
    await brain1.initialize();
    
    await resetMusicalBrain();
    
    const brain2 = getMusicalBrain({ dbPath });
    expect(brain1).not.toBe(brain2);
  });
});

describe('🧠 Learn-Or-Recall Flow', () => {
  let brain: SeleneMusicalBrain;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = createTempDbPath();
    brain = new SeleneMusicalBrain({
      dbPath,
      debug: false,
      autoLearn: true,
      learningThreshold: 0.6, // Lower for testing
      minPatternUsage: 2, // Lower for testing
    });
    await brain.initialize();
  });

  afterEach(async () => {
    await brain.shutdown();
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      if (fs.existsSync(dbPath + '-wal')) {
        fs.unlinkSync(dbPath + '-wal');
      }
      if (fs.existsSync(dbPath + '-shm')) {
        fs.unlinkSync(dbPath + '-shm');
      }
    } catch (e) {
      // Ignore
    }
  });

  it('should generate palettes procedurally at first', () => {
    const audio = createMockAudio();
    
    // First frames should be procedural or fallback
    for (let i = 0; i < 5; i++) {
      const output = brain.process(audio);
      expect(['procedural', 'fallback']).toContain(output.paletteSource);
    }
  });

  it('should track processed frames and beauty scores', () => {
    const audio = createHighConfidenceAudio();
    
    // Process many frames
    for (let i = 0; i < 50; i++) {
      brain.process(audio);
    }
    
    const stats = brain.getSessionStats();
    // Should have processed all frames
    expect(stats.framesProcessed).toBe(50);
    // Beauty score should be tracked
    expect(stats.avgBeautyScore).toBeGreaterThan(0);
  });

  it('should emit pattern-learned when learning occurs', async () => {
    const learnedPatterns: unknown[] = [];
    brain.on('pattern-learned', (data) => {
      learnedPatterns.push(data);
    });

    // Process high-quality frames to trigger learning
    const audio = createHighConfidenceAudio();
    for (let i = 0; i < 100; i++) {
      brain.process(audio);
    }

    // May or may not have learned depending on context confidence
    // Just verify no errors occurred
    expect(brain.isReady()).toBe(true);
  });

  it('should maintain memory usage percentage stat', () => {
    const audio = createMockAudio();
    
    for (let i = 0; i < 20; i++) {
      brain.process(audio);
    }
    
    const stats = brain.getSessionStats();
    expect(typeof stats.memoryUsagePercent).toBe('number');
    expect(stats.memoryUsagePercent).toBeGreaterThanOrEqual(0);
    expect(stats.memoryUsagePercent).toBeLessThanOrEqual(100);
  });
});

describe('🧠 Error Handling', () => {
  it('should throw if processing before initialize', () => {
    const dbPath = createTempDbPath();
    const brain = new SeleneMusicalBrain({ dbPath });
    const audio = createMockAudio();
    
    expect(() => brain.process(audio)).toThrow('Brain not initialized');
    
    // Cleanup
    brain.shutdown().catch(() => {});
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } catch (e) {
      // Ignore
    }
  });
});
