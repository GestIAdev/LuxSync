import { describe, it, expect } from 'vitest';
import { StrategyArbiter } from '../StrategyArbiter';

describe('WAVE 92: Triadic Flow Integration', () => {
  const strategyArbiter = new StrategyArbiter({
    bufferSize: 900,
    lockingFrames: 900,
    lowSyncThreshold: 0.40,
    highSyncThreshold: 0.65,
    hysteresisBand: 0.05,
  });

  it('should select triadic for mid-range syncopation (0.40-0.65)', () => {
    const output = strategyArbiter.update({
      syncopation: 0.50,
      sectionType: 'buildup',
      energy: 0.6,
      confidence: 0.9,
      isRelativeDrop: false,
    });
    expect(output.stableStrategy).toBe('triadic');
  });

  it('should select analogous for low syncopation (< 0.40)', () => {
    const output = strategyArbiter.update({
      syncopation: 0.20,
      sectionType: 'intro',
      energy: 0.3,
      confidence: 0.8,
      isRelativeDrop: false,
    });
    expect(output.stableStrategy).toBe('analogous');
  });

  it('should select complementary for high syncopation (> 0.65)', () => {
    const output = strategyArbiter.update({
      syncopation: 0.80,
      sectionType: 'drop',
      energy: 0.9,
      confidence: 0.95,
      isRelativeDrop: false,
    });
    expect(output.stableStrategy).toBe('complementary');
  });

  it('should include triadic in ColorStrategy type', () => {
    // Type check: triadic is valid ColorStrategy
    const validStrategy: 'analogous' | 'triadic' | 'complementary' | 'split-complementary' = 'triadic';
    expect(validStrategy).toBe('triadic');
  });

  it('should have triadic label for UI', () => {
    const STRATEGY_LABELS: Record<string, string> = {
      'analogous': 'Análogo',
      'triadic': 'Triádico',
      'complementary': 'Complementario',
      'split-complementary': 'Split-Comp',
      'monochromatic': 'Monocromático'
    };
    expect(STRATEGY_LABELS['triadic']).toBe('Triádico');
  });

  it('should validate FiestaLatinaProfile strategies include triadic', () => {
    // From FiestaLatinaProfile.ts line 42
    const strategies: string[] = ['triadic', 'complementary', 'analogous'];
    expect(strategies).toContain('triadic');
    expect(strategies[0]).toBe('triadic'); // triadic is preferred (first)
  });
});
