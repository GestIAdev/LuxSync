/**
 * 🎵 AUDIO TO METRICS ADAPTER
 *
 * Converts audio FFT analysis to Selene-compatible system metrics.
 * Maps frequency bands to CPU/Memory/Latency that Selene already understands.
 *
 * Mapping:
 * - Bass (20-250 Hz) → CPU (0.0-1.0)
 * - Mid (250-4000 Hz) → Memory (0.0-1.0)
 * - Treble (4000-20000 Hz) → Latency (0-100, inverted)
 *
 * @date 2025-11-20
 * @author LuxSync Integration Team
 */
export interface SystemMetrics {
    cpu: number;
    memory: number;
    latency: number;
    timestamp: number;
}
export interface FrequencyBands {
    bass: number;
    mid: number;
    treble: number;
}
export declare class AudioToMetricsAdapter {
    private audioContext;
    private analyser;
    private microphone;
    private dataArray;
    private fftSize;
    private sampleRate;
    private smoothingFactor;
    /**
     * Initialize audio capture from microphone or line-in
     */
    initialize(deviceId?: string): Promise<void>;
    /**
     * Capture current audio frame and convert to Selene metrics
     */
    captureMetrics(): SystemMetrics;
    /**
     * Extract energy in specific frequency bands
     */
    private extractFrequencyBands;
    /**
     * Calculate energy in a frequency band
     */
    private getBandEnergy;
    /**
     * Get detailed frequency analysis (for debugging/visualization)
     */
    getDetailedAnalysis(): {
        bands: FrequencyBands;
        spectrum: number[];
        peak: number;
        average: number;
    };
    /**
     * List available audio input devices
     */
    static listAudioDevices(): Promise<MediaDeviceInfo[]>;
    /**
     * Cleanup resources
     */
    destroy(): void;
    /**
     * Check if adapter is ready
     */
    isReady(): boolean;
}
//# sourceMappingURL=AudioToMetricsAdapter.d.ts.map