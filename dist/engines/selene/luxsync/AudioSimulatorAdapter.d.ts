/**
 * 🎵 AUDIO SIMULATOR ADAPTER
 *
 * Adapts AudioSimulator to work with AudioToMetricsAdapter interface
 * Perfect for testing without microphone hardware
 *
 * @date 2025-11-20
 * @author LuxSync Team
 */
import type { SystemMetrics } from './AudioToMetricsAdapter.js';
export declare class AudioSimulatorAdapter {
    private simulator;
    private ready;
    constructor(bpm?: number);
    /**
     * Initialize (immediate, no async needed)
     */
    initialize(): Promise<void>;
    /**
     * Check if ready
     */
    isReady(): boolean;
    /**
     * Capture metrics from simulated audio
     */
    captureMetrics(): Promise<SystemMetrics>; /**
   * Change BPM of simulation
   */
    setBPM(bpm: number): void;
    /**
     * Reset simulator
     */
    reset(): void;
    /**
     * Destroy adapter
     */
    destroy(): Promise<void>;
    /**
     * List available devices (returns empty for simulator)
     */
    listDevices(): Promise<MediaDeviceInfo[]>;
}
//# sourceMappingURL=AudioSimulatorAdapter.d.ts.map