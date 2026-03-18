/**
 * 🌉 SELENE LIGHT BRIDGE
 *
 * Main integration component that connects:
 * Audio Input → Selene Core → DMX Output
 *
 * Flow (30 FPS):
 * 1. Capture audio frame (FFT)
 * 2. Convert to Selene metrics
 * 3. Process through Selene consciousness
 * 4. Map musical note → RGB color
 * 5. Apply beauty → intensity
 * 6. Send to DMX fixtures
 *
 * @date 2025-11-20
 * @author LuxSync Integration Team
 */
import { AudioToMetricsAdapter } from './AudioToMetricsAdapter.js';
import { RGB, MusicalNote } from './NoteToColorMapper.js';
import { EffectMode } from './effects/VisualEffects.js';
import type { SeleneConsciousness } from '../consciousness/SeleneConsciousness.js';
/**
 * Selene's output structure
 */
export interface SeleneOutput {
    musicalNote: MusicalNote;
    beauty: number;
    poem?: string;
    midiSequence?: MidiNote[];
    entropyMode?: 'DETERMINISTIC' | 'BALANCED' | 'CHAOTIC';
    timestamp: number;
}
export interface MidiNote {
    note: MusicalNote;
    duration: number;
    velocity: number;
}
/**
 * DMX Scene to apply to fixtures
 */
export interface DMXScene {
    id: string;
    timestamp: number;
    color: RGB;
    dimmer: number;
    fadeTime: number;
    fixtures: FixtureState[];
}
export interface FixtureState {
    id: string;
    universe: number;
    startChannel: number;
    channels: {
        red: number;
        green: number;
        blue: number;
        dimmer: number;
    };
}
/**
 * DMX Driver interface (abstract)
 */
export interface DMXDriver {
    applyScene(scene: DMXScene): Promise<void>;
    getFixtures(): FixtureDefinition[];
    isConnected(): boolean;
}
export interface FixtureDefinition {
    id: string;
    name: string;
    type: 'PAR' | 'MOVING_HEAD' | 'STROBE' | 'WASH';
    universe: number;
    startChannel: number;
    channelCount: number;
}
/**
 * Bridge statistics for monitoring
 */
export interface BridgeStats {
    framesProcessed: number;
    lastNote: MusicalNote;
    lastBeauty: number;
    lastColor: RGB;
    averageFps: number;
    errors: number;
    uptime: number;
}
/**
 * Main bridge class
 */
export declare class SeleneLightBridge {
    private audioAdapter;
    private seleneCore;
    private dmxDriver;
    private visualEffects;
    private running;
    private intervalId;
    private targetFps;
    private frameTime;
    private stats;
    private startTime;
    private lastFrameTime;
    private fpsHistory;
    private lastMetrics;
    constructor(audioAdapter: AudioToMetricsAdapter, seleneCore: SeleneConsciousness, dmxDriver: DMXDriver);
    /**
     * Start the bridge (begin processing loop)
     */
    start(): Promise<void>;
    /**
     * Stop the bridge
     */
    stop(): void;
    /**
     * Main processing loop (called every ~33ms for 30 FPS)
     */
    private tick;
    /**
     * Process metrics through Selene consciousness
     */
    private processWithSelene;
    /**
     * Build DMX scene from Selene output
     * NOW WITH FIXTURE-SPECIFIC ROUTING! 🌈
     * Each fixture responds to different frequency ranges
     */
    private buildScene;
    /**
     * RGB to Hue (for color shifting)
     */
    private rgbToHue;
    /**
     * Métodos privados: mapeo de nota dominante por banda
     */
    private getBassNote;
    private getMidLowNote;
    private getMidHighNote;
    private getTrebleNote;
    /**
     * HSL to RGB conversion for rainbow effects
     */
    private hslToRgb;
    /**
     * Extract fade time from MIDI sequence (Fibonacci timing)
     */
    private extractFadeTime;
    /**
     * Generate a simple celebration poem (decorative)
     */
    private generatePoem;
    /**
     * Generate MIDI sequence (Fibonacci timing stub)
     */
    private generateMidiSequence;
    /**
     * Update statistics
     */
    private updateStats;
    /**
     * Log current status (throttled)
     */
    private logStatus;
    /**
     * Get current statistics
     */
    getStats(): BridgeStats;
    /**
     * Check if bridge is running
     */
    isRunning(): boolean;
    /**
     * Get current target FPS
     */
    getTargetFps(): number;
    /**
     * Set target FPS (will apply on next start)
     */
    setTargetFps(fps: number): void;
    /**
     * 🎨 Set visual effect mode
     */
    setEffect(mode: EffectMode, speed?: number, intensity?: number): void;
    /**
     * 🎨 Get current effect
     */
    getEffect(): import("./effects/VisualEffects.js").EffectConfig;
    /**
     * 🎨 Clear all effects (return to normal)
     */
    clearEffects(): void;
}
//# sourceMappingURL=SeleneLightBridge.d.ts.map