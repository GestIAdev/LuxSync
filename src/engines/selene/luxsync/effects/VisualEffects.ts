/**
 * 🎨 VISUAL EFFECTS LIBRARY
 * 
 * Collection of dynamic lighting effects for LuxSync
 * Chase patterns, waves, strobes, and more!
 * 
 * @date 2025-11-20
 * @author LuxSync Team - For the boss demo! 🚀
 */

export type EffectMode = 'none' | 'chase' | 'wave' | 'strobe' | 'pulse' | 'sparkle';

export interface EffectConfig {
  mode: EffectMode;
  speed: number;        // 0-1 (0 = slow, 1 = fast)
  intensity: number;    // 0-1 (0 = subtle, 1 = intense)
  direction?: 'forward' | 'backward' | 'outward' | 'inward';
}

export interface FixtureModifier {
  fixtureIndex: number;
  dimmerMultiplier: number;  // Multiply dimmer by this (0-2)
  colorShift?: number;        // Hue shift in degrees (0-360)
  delay?: number;             // Delay in ms before applying
}

/**
 * Visual Effects Engine
 */
export class VisualEffects {
  private currentEffect: EffectConfig = { mode: 'none', speed: 0.5, intensity: 0.5 };
  private frameCounter: number = 0;
  private lastEffectTime: number = 0;

  constructor() {
    console.log('🎨 Visual Effects Engine initialized');
  }

  /**
   * Set current effect mode
   */
  setEffect(config: Partial<EffectConfig>): void {
    this.currentEffect = {
      ...this.currentEffect,
      ...config
    };
    this.frameCounter = 0;
    console.log(`🎨 Effect changed to: ${this.currentEffect.mode}`);
  }

  /**
   * Get current effect
   */
  getEffect(): EffectConfig {
    return { ...this.currentEffect };
  }

  /**
   * Apply effect to fixtures
   * Returns array of modifiers (one per fixture)
   */
  applyEffect(fixtureCount: number, audioMetrics?: { bass: number; mid: number; treble: number }): FixtureModifier[] {
    this.frameCounter++;

    switch (this.currentEffect.mode) {
      case 'chase':
        return this.chasePattern(fixtureCount);
      
      case 'wave':
        return this.wavePattern(fixtureCount);
      
      case 'strobe':
        return this.strobePattern(fixtureCount, audioMetrics);
      
      case 'pulse':
        return this.pulsePattern(fixtureCount, audioMetrics);
      
      case 'sparkle':
        return this.sparklePattern(fixtureCount);
      
      default:
        // No effect - return neutral modifiers
        return Array(fixtureCount).fill(null).map((_, i) => ({
          fixtureIndex: i,
          dimmerMultiplier: 1.0
        }));
    }
  }

  /**
   * CHASE PATTERN: Fixtures light up in sequence
   * Classic "running light" effect
   */
  private chasePattern(fixtureCount: number): FixtureModifier[] {
    const speed = this.currentEffect.speed * 10; // 0-10 frames per step
    const step = Math.floor(this.frameCounter / (11 - speed)); // Faster = less frames
    const activeFixture = step % fixtureCount;

    return Array(fixtureCount).fill(null).map((_, i) => {
      const isActive = i === activeFixture;
      const isPrevious = i === (activeFixture - 1 + fixtureCount) % fixtureCount;
      const isPrevious2 = i === (activeFixture - 2 + fixtureCount) % fixtureCount;

      let dimmer = 0.1; // Base dim
      if (isActive) dimmer = 1.0 + this.currentEffect.intensity; // Active bright
      else if (isPrevious) dimmer = 0.5 + this.currentEffect.intensity * 0.5; // Trail
      else if (isPrevious2) dimmer = 0.2 + this.currentEffect.intensity * 0.2; // Faint trail

      return {
        fixtureIndex: i,
        dimmerMultiplier: dimmer
      };
    });
  }

  /**
   * WAVE PATTERN: Color wave traveling across fixtures
   * Creates smooth gradient movement
   */
  private wavePattern(fixtureCount: number): FixtureModifier[] {
    const speed = this.currentEffect.speed * 0.1; // Wave speed
    const wavePosition = (this.frameCounter * speed) % fixtureCount;

    return Array(fixtureCount).fill(null).map((_, i) => {
      // Distance from wave peak
      const distance = Math.abs(i - wavePosition);
      const wrappedDistance = Math.min(distance, fixtureCount - distance);
      
      // Gaussian-like wave shape
      const waveHeight = Math.exp(-wrappedDistance / 2);
      const dimmer = 0.2 + waveHeight * (0.8 + this.currentEffect.intensity * 0.5);

      // Color shift based on position in wave
      const colorShift = (wrappedDistance * 30) % 360;

      return {
        fixtureIndex: i,
        dimmerMultiplier: dimmer,
        colorShift: colorShift
      };
    });
  }

  /**
   * STROBE PATTERN: Fast flashing on bass drops
   * Club-style strobe effect
   */
  private strobePattern(fixtureCount: number, audioMetrics?: { bass: number; mid: number; treble: number }): FixtureModifier[] {
    const bass = audioMetrics?.bass || 0.5;
    
    // Only strobe on significant bass
    if (bass < 0.6) {
      return Array(fixtureCount).fill(null).map((_, i) => ({
        fixtureIndex: i,
        dimmerMultiplier: 1.0
      }));
    }

    // Strobe frequency based on intensity
    const strobeFreq = 4 + this.currentEffect.intensity * 6; // 4-10 frames
    const isOn = Math.floor(this.frameCounter / strobeFreq) % 2 === 0;

    return Array(fixtureCount).fill(null).map((_, i) => ({
      fixtureIndex: i,
      dimmerMultiplier: isOn ? 1.5 + bass * 0.5 : 0.1 // Full bright or very dim
    }));
  }

  /**
   * PULSE PATTERN: All fixtures pulse together
   * Synchronized breathing effect
   */
  private pulsePattern(fixtureCount: number, audioMetrics?: { bass: number; mid: number; treble: number }): FixtureModifier[] {
    const bass = audioMetrics?.bass || 0.5;
    const speed = this.currentEffect.speed * 0.1;
    
    // Sine wave pulse
    const pulse = Math.sin(this.frameCounter * speed) * 0.5 + 0.5; // 0-1
    const dimmer = 0.3 + pulse * (0.7 + this.currentEffect.intensity * 0.5);
    
    // Intensity boost on bass
    const bassBoost = bass > 0.7 ? bass * 0.3 : 0;

    return Array(fixtureCount).fill(null).map((_, i) => ({
      fixtureIndex: i,
      dimmerMultiplier: dimmer + bassBoost
    }));
  }

  /**
   * SPARKLE PATTERN: Random fixtures twinkle
   * Stars in the night effect
   */
  private sparklePattern(fixtureCount: number): FixtureModifier[] {
    return Array(fixtureCount).fill(null).map((_, i) => {
      // Random sparkle chance
      const sparkleChance = this.currentEffect.intensity * 0.1; // 0-10%
      const isSparkle = Math.random() < sparkleChance;
      
      const dimmer = isSparkle 
        ? 1.5 + Math.random() * 0.5  // Bright sparkle
        : 0.5 + Math.random() * 0.3; // Normal dim

      return {
        fixtureIndex: i,
        dimmerMultiplier: dimmer
      };
    });
  }

  /**
   * Reset effect state
   */
  reset(): void {
    this.frameCounter = 0;
    this.lastEffectTime = 0;
    console.log('🎨 Effects reset');
  }

  /**
   * Get effect stats for debugging
   */
  getStats() {
    return {
      currentEffect: this.currentEffect.mode,
      frameCounter: this.frameCounter,
      speed: this.currentEffect.speed,
      intensity: this.currentEffect.intensity
    };
  }
}
