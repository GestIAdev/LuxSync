/**
 * 🎮 DMX SIMULATOR DRIVER
 *
 * Visual browser-based DMX simulator (no hardware needed)
 * Perfect for demos, testing, and development
 *
 * Features:
 * - Real-time fixture visualization
 * - Color preview with intensity
 * - Stats panel (FPS, scenes, timing)
 * - Works completely offline
 * - Portable (pen drive ready!)
 *
 * @date 2025-11-20
 * @author LuxSync Team
 */
import type { DMXDriver, DMXScene, FixtureDefinition } from '../SeleneLightBridge.js';
export interface SimulatorConfig {
    canvasId?: string;
    width?: number;
    height?: number;
    fixtureCount?: number;
    fixtureSize?: number;
    showStats?: boolean;
    showLabels?: boolean;
    fadeSmoothing?: number;
}
export interface SimulatorStats {
    scenesApplied: number;
    lastUpdateTime: number;
    averageFadeTime: number;
    currentScene: DMXScene | null;
    isConnected: boolean;
}
/**
 * DMX Simulator Driver
 */
export declare class SimulatorDriver implements DMXDriver {
    private canvas;
    private ctx;
    private config;
    private fixtures;
    private stats;
    private animationFrameId;
    private connected;
    constructor(config?: SimulatorConfig);
    /**
     * Initialize the simulator (find or create canvas)
     */
    initialize(): Promise<void>;
    /**
     * Create virtual fixtures in a nice layout
     */
    private createVirtualFixtures;
    /**
     * Apply DMX scene to virtual fixtures
     */
    applyScene(scene: DMXScene): Promise<void>;
    /**
     * Get fixture definitions
     */
    getFixtures(): FixtureDefinition[];
    /**
     * Check if simulator is connected
     */
    isConnected(): boolean;
    /**
     * Start the render loop (smooth animations)
     */
    private startRenderLoop;
    /**
     * Stop the render loop
     */
    private stopRenderLoop;
    /**
     * Main render function (called every frame)
     */
    private render;
    /**
     * Draw statistics panel
     */
    private drawStatsPanel;
    /**
     * Get current statistics
     */
    getStats(): SimulatorStats;
    /**
     * Disconnect simulator
     */
    disconnect(): void;
    /**
     * Clear all fixtures (blackout)
     */
    blackout(): void;
    /**
     * Test pattern (RGB cycle)
     */
    testPattern(): Promise<void>;
}
//# sourceMappingURL=SimulatorDriver.d.ts.map