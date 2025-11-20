/**
 * 🎵 AUDIO SIMULATOR ADAPTER
 * 
 * Adapts AudioSimulator to work with AudioToMetricsAdapter interface
 * Perfect for testing without microphone hardware
 * 
 * @date 2025-11-20
 * @author LuxSync Team
 */

import { AudioSimulator } from '../../audio/AudioSimulator.js';
import type { SystemMetrics } from './AudioToMetricsAdapter.js';

export class AudioSimulatorAdapter {
  private simulator: AudioSimulator;
  private ready: boolean = false;

  constructor(bpm: number = 128) {
    this.simulator = new AudioSimulator(bpm);
    console.log(`🎵 AudioSimulatorAdapter created (${bpm} BPM)`);
  }

  /**
   * Initialize (immediate, no async needed)
   */
  async initialize(): Promise<void> {
    this.ready = true;
    console.log('🎵 AudioSimulatorAdapter initialized');
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Capture metrics from simulated audio
   */
  async captureMetrics(): Promise<SystemMetrics> {
    if (!this.ready) {
      throw new Error('AudioSimulatorAdapter not initialized');
    }

    // Get synthetic audio frame
    const frame = await this.simulator.getFrame();

    // Map to SystemMetrics (same as AudioToMetricsAdapter)
    // Ensure all values are valid numbers (0-1 for cpu/memory, 0-100 for latency)
    const cpu = isNaN(frame.bass) ? 0.5 : Math.max(0, Math.min(1, frame.bass));
    const memory = isNaN(frame.mid) ? 0.5 : Math.max(0, Math.min(1, frame.mid));
    const treble = isNaN(frame.treble) ? 0.5 : Math.max(0, Math.min(1, frame.treble));
    const latency = (1 - treble) * 100; // Treble → Latency (inverted)

    return {
      cpu,
      memory,
      latency,
      timestamp: frame.timestamp || Date.now()
    };
  }

  /**
   * Change BPM of simulation
   */
  setBPM(bpm: number): void {
    this.simulator.setBPM(bpm);
    console.log(`🎵 BPM changed to ${bpm}`);
  }

  /**
   * Reset simulator
   */
  reset(): void {
    this.simulator.reset();
    console.log('🎵 AudioSimulator reset');
  }

  /**
   * Destroy adapter
   */
  async destroy(): Promise<void> {
    this.ready = false;
    console.log('🎵 AudioSimulatorAdapter destroyed');
  }

  /**
   * List available devices (returns empty for simulator)
   */
  async listDevices(): Promise<MediaDeviceInfo[]> {
    return [];
  }
}
