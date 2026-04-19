// WAVE 3402: Native Audio Bridge
//
// TypeScript wrapper around the native C++ addon (luxsync_audio).
// Provides a clean async interface for device enumeration, capture,
// and hot-plug detection. Handles native module loading with graceful
// fallback when the addon isn't compiled.
//
// This bridge is consumed by VirtualWireProvider and USBDirectLinkProvider.

import type { AudioDeviceInfo } from './OmniInputTypes'

// ============================================
// Native Module Types (mirror C++ exports)
// ============================================

interface NativeDeviceInfo {
  id: string
  name: string
  sampleRate: number
  channels: number
  isDefault: boolean
  isLoopback: boolean
  isExclusiveCapable: boolean
  driver: string
  sampleRates: number[]
}

interface NativeCaptureConfig {
  deviceId: string
  sampleRate: number
  channels: number
  bufferSizeFrames: number
  exclusiveMode: boolean
}

type NativeAudioCallback = (
  data: Float32Array,
  frameCount: number,
  channels: number,
  sampleRate: number
) => void

interface NativeAddon {
  enumerateDevices(): NativeDeviceInfo[]
  onDeviceChange(callback: () => void): void
  startCapture(config: NativeCaptureConfig, callback: NativeAudioCallback): number
  stopCapture(handle: number): void
}

// ============================================
// Extended AudioDeviceInfo with native fields
// ============================================

export interface NativeAudioDeviceInfo extends AudioDeviceInfo {
  readonly isLoopback: boolean
  readonly isExclusiveCapable: boolean
  readonly driver: 'wasapi' | 'coreaudio' | 'jack' | 'alsa'
  readonly sampleRates: readonly number[]
}

// ============================================
// Capture handle for managing active streams
// ============================================

export interface CaptureHandle {
  readonly id: number
  readonly deviceId: string
  readonly sampleRate: number
  readonly exclusiveMode: boolean
  stop(): void
}

// ============================================
// NativeAudioBridge
// ============================================

export class NativeAudioBridge {
  private addon: NativeAddon | null = null
  private activeCaptures = new Map<number, CaptureHandle>()
  private deviceChangeListeners = new Set<() => void>()
  private _available = false
  private _loadError: string | null = null

  constructor() {
    this.loadNativeAddon()
  }

  /**
   * Whether the native addon is available and loaded
   */
  get available(): boolean {
    return this._available
  }

  /**
   * Error message if native addon failed to load
   */
  get loadError(): string | null {
    return this._loadError
  }

  /**
   * Enumerate all audio input devices (physical + virtual/loopback)
   */
  enumerateDevices(): NativeAudioDeviceInfo[] {
    if (!this.addon) return []

    const nativeDevices = this.addon.enumerateDevices()
    return nativeDevices.map((dev): NativeAudioDeviceInfo => ({
      id: dev.id,
      name: dev.name,
      sampleRate: dev.sampleRate,
      channels: dev.channels,
      isDefault: dev.isDefault,
      isLoopback: dev.isLoopback,
      isExclusiveCapable: dev.isExclusiveCapable,
      driver: dev.driver as NativeAudioDeviceInfo['driver'],
      sampleRates: Object.freeze([...dev.sampleRates]),
    }))
  }

  /**
   * Start audio capture from a device.
   *
   * @param config  Capture configuration
   * @param onData  Callback receiving Float32Array audio chunks
   * @returns CaptureHandle for stopping the capture, or null if unavailable
   */
  startCapture(
    config: NativeCaptureConfig,
    onData: NativeAudioCallback
  ): CaptureHandle | null {
    if (!this.addon) return null

    const handle = this.addon.startCapture(config, onData)

    const captureHandle: CaptureHandle = {
      id: handle,
      deviceId: config.deviceId,
      sampleRate: config.sampleRate,
      exclusiveMode: config.exclusiveMode,
      stop: () => {
        this.stopCapture(handle)
      },
    }

    this.activeCaptures.set(handle, captureHandle)
    return captureHandle
  }

  /**
   * Stop a specific capture stream
   */
  stopCapture(handle: number): void {
    if (!this.addon) return
    this.addon.stopCapture(handle)
    this.activeCaptures.delete(handle)
  }

  /**
   * Stop all active captures
   */
  stopAll(): void {
    for (const [handle] of this.activeCaptures) {
      this.stopCapture(handle)
    }
  }

  /**
   * Register for device topology change notifications (hot-plug/unplug)
   */
  onDeviceChange(listener: () => void): void {
    this.deviceChangeListeners.add(listener)
    this.ensureDeviceWatcher()
  }

  /**
   * Remove a device change listener
   */
  offDeviceChange(listener: () => void): void {
    this.deviceChangeListeners.delete(listener)
  }

  /**
   * Get count of active capture streams
   */
  get activeCaptureCount(): number {
    return this.activeCaptures.size
  }

  /**
   * Dispose — stop all captures and cleanup
   */
  dispose(): void {
    this.stopAll()
    this.deviceChangeListeners.clear()
    this.addon = null
    this._available = false
  }

  // ============================================
  // PRIVATE
  // ============================================

  private loadNativeAddon(): void {
    try {
      // The native addon is built by node-gyp and placed in build/Release/
      // In production, electron-builder unpacks it via asar.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bindings = require('bindings')
      this.addon = bindings('luxsync_audio') as NativeAddon
      this._available = true
      this._loadError = null
    } catch (err) {
      this.addon = null
      this._available = false
      this._loadError = err instanceof Error ? err.message : String(err)
      console.warn(
        '[NativeAudioBridge] Native addon not available — ' +
        'providers requiring native access will be disabled. ' +
        `Error: ${this._loadError}`
      )
    }
  }

  private deviceWatcherActive = false

  private ensureDeviceWatcher(): void {
    if (this.deviceWatcherActive || !this.addon) return

    this.addon.onDeviceChange(() => {
      for (const listener of this.deviceChangeListeners) {
        listener()
      }
    })

    this.deviceWatcherActive = true
  }
}

// ============================================
// Singleton instance
// ============================================

let _instance: NativeAudioBridge | null = null

export function getNativeAudioBridge(): NativeAudioBridge {
  if (!_instance) {
    _instance = new NativeAudioBridge()
  }
  return _instance
}
