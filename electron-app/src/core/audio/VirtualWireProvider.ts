// WAVE 3402: VIRTUAL WIRE PROVIDER
//
// IInputProvider for Virtual Audio Cable devices:
// - Windows: VB-Cable, Voicemeeter, Virtual Audio Cable
// - macOS: BlackHole, Soundflower, Loopback
// - Linux: JACK loopback ports
//
// Uses the native C++ addon (NativeAudioBridge) for exclusive-mode capture
// bypassing system DSP. Falls back gracefully when native addon unavailable.
//
// Audio pipeline:
//   Native Capture → Polyphase Resampler (if needed) → onAudioData → AudioMatrix

import type {
  IInputProvider,
  InputSourceType,
  InputProviderStatus,
  InputProviderConfig,
  InputProviderDiagnostics,
  AudioDeviceInfo,
} from './OmniInputTypes'

import { getNativeAudioBridge, type CaptureHandle, type NativeAudioDeviceInfo } from './NativeAudioBridge'
import { getResampler, type PolyphaseResampler } from './PolyphaseResampler'
import { OMNI_CONSTANTS } from './OmniInputTypes'

export class VirtualWireProvider implements IInputProvider {
  readonly type: InputSourceType = 'virtual-wire'

  private _status: InputProviderStatus = {
    state: 'uninitialized',
    deviceName: null,
    sampleRate: OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE,
    channels: OMNI_CONSTANTS.DEFAULT_CHANNELS,
    latencyMs: 0,
    errorMessage: null,
  }

  // Callbacks wired by AudioMatrix
  onAudioData: ((buffer: Float32Array, sampleRate: number) => void) | null = null
  onStatusChange: ((status: InputProviderStatus) => void) | null = null

  // Native capture
  private captureHandle: CaptureHandle | null = null
  private resampler: PolyphaseResampler | null = null
  private resampleBuffer: Float32Array | null = null

  // Config
  private config: InputProviderConfig = {}
  private selectedDeviceId: string | null = null

  // Telemetry
  private samplesProcessed = 0
  private bufferUnderruns = 0
  private bufferOverruns = 0
  private startTime = 0
  private peakLatencyMs = 0
  private totalLatencyMs = 0
  private callbackCount = 0

  // Device hot-plug handler
  private deviceChangeHandler: (() => void) | null = null

  get status(): InputProviderStatus {
    return this._status
  }

  async initialize(config: InputProviderConfig): Promise<void> {
    this.config = config

    const bridge = getNativeAudioBridge()
    if (!bridge.available) {
      this.updateStatus({
        state: 'error',
        deviceName: null,
        sampleRate: OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE,
        channels: OMNI_CONSTANTS.DEFAULT_CHANNELS,
        latencyMs: 0,
        errorMessage: `Native addon not available: ${bridge.loadError}`,
      })
      return
    }

    // Auto-detect virtual wire device if no deviceId specified
    if (config.deviceId) {
      this.selectedDeviceId = config.deviceId
    } else {
      const loopbackDevice = this.findLoopbackDevice()
      if (loopbackDevice) {
        this.selectedDeviceId = loopbackDevice.id
      }
    }

    const deviceName = this.selectedDeviceId
      ? this.getDeviceName(this.selectedDeviceId)
      : null

    this.updateStatus({
      state: 'ready',
      deviceName: deviceName ?? 'No virtual wire device found',
      sampleRate: config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE,
      channels: config.channelSelection ?? OMNI_CONSTANTS.DEFAULT_CHANNELS,
      latencyMs: 0,
      errorMessage: this.selectedDeviceId ? null : 'No VB-Cable/BlackHole detected',
    })

    // Register for hot-plug events
    this.deviceChangeHandler = () => this.handleDeviceChange()
    bridge.onDeviceChange(this.deviceChangeHandler)
  }

  async start(): Promise<void> {
    if (this._status.state !== 'ready') return
    if (!this.selectedDeviceId) {
      this.updateStatus({
        ...this._status,
        state: 'error',
        errorMessage: 'No virtual wire device selected',
      })
      return
    }

    const bridge = getNativeAudioBridge()
    if (!bridge.available) return

    const targetRate = this.config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE
    const channels = this.config.channelSelection ?? OMNI_CONSTANTS.DEFAULT_CHANNELS

    this.captureHandle = bridge.startCapture(
      {
        deviceId: this.selectedDeviceId,
        sampleRate: targetRate,
        channels,
        bufferSizeFrames: 256,
        exclusiveMode: this.config.exclusiveMode ?? true,
      },
      (data, frameCount, ch, sampleRate) => {
        this.handleAudioData(data, frameCount, ch, sampleRate)
      }
    )

    if (!this.captureHandle) {
      this.updateStatus({
        ...this._status,
        state: 'error',
        errorMessage: 'Failed to start native capture',
      })
      return
    }

    this.startTime = Date.now()
    this.updateStatus({
      ...this._status,
      state: 'streaming',
    })
  }

  async stop(): Promise<void> {
    if (this.captureHandle) {
      this.captureHandle.stop()
      this.captureHandle = null
    }

    this.resampler?.reset()
    this.resampler = null
    this.resampleBuffer = null

    this.updateStatus({
      ...this._status,
      state: 'ready',
    })
  }

  dispose(): void {
    this.stop()

    // Remove device change listener
    if (this.deviceChangeHandler) {
      getNativeAudioBridge().offDeviceChange(this.deviceChangeHandler)
      this.deviceChangeHandler = null
    }

    this.onAudioData = null
    this.onStatusChange = null
    this.updateStatus({
      ...this._status,
      state: 'disposed',
    })
  }

  async enumerateDevices(): Promise<readonly AudioDeviceInfo[]> {
    const bridge = getNativeAudioBridge()
    if (!bridge.available) return []

    return bridge.enumerateDevices().filter(d => d.isLoopback)
  }

  getDiagnostics(): InputProviderDiagnostics {
    const uptimeMs = this.startTime > 0 ? Date.now() - this.startTime : 0
    return {
      bufferUnderruns: this.bufferUnderruns,
      bufferOverruns: this.bufferOverruns,
      samplesProcessed: this.samplesProcessed,
      avgLatencyMs: this.callbackCount > 0 ? this.totalLatencyMs / this.callbackCount : 0,
      peakLatencyMs: this.peakLatencyMs,
      uptimeMs,
    }
  }

  // ============================================
  // PRIVATE
  // ============================================

  private handleAudioData(
    data: Float32Array,
    frameCount: number,
    _channels: number,
    sampleRate: number
  ): void {
    if (this._status.state !== 'streaming' || !this.onAudioData) return

    const targetRate = this.config.sampleRate ?? OMNI_CONSTANTS.DEFAULT_SAMPLE_RATE

    // Mono downmix if needed (take first channel)
    let monoData: Float32Array
    if (_channels > 1) {
      monoData = new Float32Array(frameCount)
      for (let i = 0; i < frameCount; i++) {
        monoData[i] = data[i * _channels] // First channel only
      }
    } else {
      monoData = data.subarray(0, frameCount)
    }

    // Resample if source rate differs from target
    let outputData: Float32Array
    let outputRate: number

    if (sampleRate !== targetRate) {
      // Lazy-init resampler (only when rate actually differs)
      if (!this.resampler || this.resampler.inputRate !== sampleRate) {
        this.resampler = getResampler(sampleRate, targetRate)
        this.resampleBuffer = null
      }

      if (this.resampler) {
        const outLen = this.resampler.getOutputLength(monoData.length)
        if (!this.resampleBuffer || this.resampleBuffer.length < outLen) {
          this.resampleBuffer = new Float32Array(outLen + 64) // +64 safety margin
        }
        const written = this.resampler.process(monoData, this.resampleBuffer)
        outputData = this.resampleBuffer.subarray(0, written)
        outputRate = targetRate
      } else {
        outputData = monoData
        outputRate = sampleRate
      }
    } else {
      outputData = monoData
      outputRate = sampleRate
    }

    this.samplesProcessed += outputData.length
    this.callbackCount++
    this.onAudioData(outputData, outputRate)
  }

  private findLoopbackDevice(): NativeAudioDeviceInfo | null {
    const bridge = getNativeAudioBridge()
    if (!bridge.available) return null

    const devices = bridge.enumerateDevices()
    // Prefer VB-Cable/BlackHole, then any loopback
    return devices.find(d => d.isLoopback && d.isDefault) ??
           devices.find(d => d.isLoopback) ??
           null
  }

  private getDeviceName(deviceId: string): string | null {
    const bridge = getNativeAudioBridge()
    if (!bridge.available) return null

    const device = bridge.enumerateDevices().find(d => d.id === deviceId)
    return device?.name ?? null
  }

  private handleDeviceChange(): void {
    // Re-check if our selected device is still available
    if (this._status.state === 'streaming' && this.selectedDeviceId) {
      const bridge = getNativeAudioBridge()
      const devices = bridge.enumerateDevices()
      const stillExists = devices.some(d => d.id === this.selectedDeviceId)

      if (!stillExists) {
        // Device unplugged — stop and report error
        this.stop()
        this.updateStatus({
          ...this._status,
          state: 'error',
          errorMessage: 'Virtual wire device disconnected',
        })
      }
    }
  }

  private updateStatus(newStatus: InputProviderStatus): void {
    this._status = newStatus
    if (this.onStatusChange) {
      this.onStatusChange(newStatus)
    }
  }
}
