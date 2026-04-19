// WAVE 3401: LEGACY BRIDGE PROVIDER
//
// Wraps the existing Electron IPC audio pipeline (lux:audio-buffer) as an
// IInputProvider for the Omni-Input Matrix. This is the backward-compatible
// bridge that keeps the current useAudioCapture.ts → IPC → TitanOrchestrator
// pipeline working as a first-class provider.
//
// When LegacyBridge is the active source, audio still enters through the
// renderer's Web Audio API and crosses the IPC boundary via Uint8Array.
// The difference: instead of postMessage to BETA Worker, the buffer goes
// through AudioMatrix → SharedRingBuffer → BETA Worker (zero-copy).
//
// This provider is always available as the fallback of last resort.

import type {
  IInputProvider,
  InputSourceType,
  InputProviderStatus,
  InputProviderConfig,
  InputProviderDiagnostics,
  AudioDeviceInfo,
} from './OmniInputTypes'

export class LegacyBridgeProvider implements IInputProvider {
  readonly type: InputSourceType = 'legacy-bridge'

  private _status: InputProviderStatus = {
    state: 'uninitialized',
    deviceName: null,
    sampleRate: 44100,
    channels: 1,
    latencyMs: 0,
    errorMessage: null,
  }

  // Callbacks wired by AudioMatrix
  onAudioData: ((buffer: Float32Array, sampleRate: number) => void) | null = null
  onStatusChange: ((status: InputProviderStatus) => void) | null = null

  // Telemetry
  private samplesProcessed = 0
  private bufferCount = 0
  private startTime = 0
  private peakLatencyMs = 0
  private totalLatencyMs = 0

  get status(): InputProviderStatus {
    return this._status
  }

  async initialize(_config: InputProviderConfig): Promise<void> {
    this.updateStatus({
      state: 'ready',
      deviceName: 'Electron IPC (useAudioCapture)',
      sampleRate: 44100,
      channels: 1,
      latencyMs: 0,
      errorMessage: null,
    })
  }

  async start(): Promise<void> {
    this.startTime = Date.now()
    this.updateStatus({
      ...this._status,
      state: 'streaming',
    })
  }

  async stop(): Promise<void> {
    this.updateStatus({
      ...this._status,
      state: 'ready',
    })
  }

  dispose(): void {
    this.onAudioData = null
    this.onStatusChange = null
    this.updateStatus({
      ...this._status,
      state: 'disposed',
    })
  }

  /**
   * Called by the IPC handler (IPCHandlers.ts) when a lux:audio-buffer arrives.
   * This replaces the direct trinity.feedAudioBuffer(buffer) call.
   */
  feedFromIPC(buffer: Float32Array): void {
    if (this._status.state !== 'streaming') return

    this.samplesProcessed += buffer.length
    this.bufferCount++

    if (this.onAudioData) {
      this.onAudioData(buffer, this._status.sampleRate)
    }
  }

  async enumerateDevices(): Promise<readonly AudioDeviceInfo[]> {
    // Legacy bridge uses whatever the renderer's Web Audio API is capturing.
    // Device enumeration happens on the renderer side, not here.
    return [{
      id: 'legacy-ipc',
      name: 'Electron IPC (Web Audio API)',
      sampleRate: 44100,
      channels: 1,
      isDefault: true,
    }]
  }

  getDiagnostics(): InputProviderDiagnostics {
    const uptimeMs = this.startTime > 0 ? Date.now() - this.startTime : 0
    return {
      bufferUnderruns: 0,
      bufferOverruns: 0,
      samplesProcessed: this.samplesProcessed,
      avgLatencyMs: this.bufferCount > 0 ? this.totalLatencyMs / this.bufferCount : 0,
      peakLatencyMs: this.peakLatencyMs,
      uptimeMs,
    }
  }

  private updateStatus(newStatus: InputProviderStatus): void {
    this._status = newStatus
    if (this.onStatusChange) {
      this.onStatusChange(newStatus)
    }
  }
}
