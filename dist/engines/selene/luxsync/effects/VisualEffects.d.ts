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
    speed: number;
    intensity: number;
    direction?: 'forward' | 'backward' | 'outward' | 'inward';
}
export interface FixtureModifier {
    fixtureIndex: number;
    dimmerMultiplier: number;
    colorShift?: number;
    delay?: number;
}
/**
 * Visual Effects Engine
 */
export declare class VisualEffects {
    private currentEffect;
    private frameCounter;
    private lastEffectTime;
    constructor();
    /**
     * Set current effect mode
     */
    setEffect(config: Partial<EffectConfig>): void;
    /**
     * Get current effect
     */
    getEffect(): EffectConfig;
    /**
     * Apply effect to fixtures
     * Returns array of modifiers (one per fixture)
     */
    applyEffect(fixtureCount: number, audioMetrics?: {
        bass: number;
        mid: number;
        treble: number;
    }): FixtureModifier[];
    /**
     * CHASE PATTERN: Fixtures light up in sequence
     * Classic "running light" effect
     */
    private chasePattern;
    /**
     * WAVE PATTERN: Color wave traveling across fixtures
     * Creates smooth gradient movement
     */
    private wavePattern;
    /**
     * STROBE PATTERN: Fast flashing on bass drops
     * Club-style strobe effect
     */
    private strobePattern;
    /**
     * PULSE PATTERN: All fixtures pulse together
     * Synchronized breathing effect
     */
    private pulsePattern;
    /**
     * SPARKLE PATTERN: Random fixtures twinkle
     * Stars in the night effect
     */
    private sparklePattern;
    /**
     * Reset effect state
     */
    reset(): void;
    /**
     * Get effect stats for debugging
     */
    getStats(): {
        currentEffect: EffectMode;
        frameCounter: number;
        speed: number;
        intensity: number;
    };
}
//# sourceMappingURL=VisualEffects.d.ts.map