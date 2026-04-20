// WAVE 3401: AUDIO MATRIX -- Central Input Bus + InputArbiter + Hot-Swap
//
// The AudioMatrix is the single convergence point for all audio sources.
// It manages providers, enforces priority, handles hot-swap transitions,
// and writes PCM data into the SharedRingBuffer for BETA Worker consumption.
//
// Architecture:
//   [Provider A] ──┐
//   [Provider B] ──┼──> AudioMatrix (InputArbiter) ──> SharedRingBuffer ──> BETA Worker
//   [Provider C] ──┘
//
// Hot-Swap Protocol (200ms total):
//   Fase 1: FADE-OUT (60ms) -- attenuate outgoing source linearly to 0
//   Fase 2: GAP (40ms) -- silence, 1 frame, GodEar AGC holds
//   Fase 3: FADE-IN (100ms) -- ramp new source from 0 to 1
//
// Overflow policy: latest data wins (producer never blocks)
// Silence detection: if active provider is silent for 3s, auto-fallback to next in chain

import {
  type IAudioMatrix,
  type IInputProvider,
  type InputSourceType,
  type InputArbiterConfig,
  type AudioMatrixStatus,
  type InputProviderStatus,
  type HotSwapPhase,
  OMNI_CONSTANTS,
} from './OmniInputTypes'
import { SharedRingBufferWriter } from './SharedRingBuffer'

const {
  CROSSFADE_FADE_OUT_MS,
  CROSSFADE_GAP_MS,
  CROSSFADE_FADE_IN_MS,
  SILENCE_TIMEOUT_MS,
  DEFAULT_SAMPLE_RATE,
} = OMNI_CONSTANTS

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_ARBITER_CONFIG: InputArbiterConfig = {
  priorityChain: ['usb-directlink', 'virtual-wire', 'legacy-bridge', 'osc-nexus'],
  silenceTimeoutMs: SILENCE_TIMEOUT_MS,
  autoFallback: true,
  crossfadeDuration: {
    fadeOutMs: CROSSFADE_FADE_OUT_MS,
    gapMs: CROSSFADE_GAP_MS,
    fadeInMs: CROSSFADE_FADE_IN_MS,
  },
}

// ============================================
// AUDIO MATRIX IMPLEMENTATION
// ============================================

export class AudioMatrix implements IAudioMatrix {
  private readonly ringWriter: SharedRingBufferWriter
  private readonly providers = new Map<InputSourceType, IInputProvider>()
  private activeSource: InputSourceType | null = null
  private forcedSource: InputSourceType | null = null
  private config: InputArbiterConfig
  private disposed = false

  // Hot-swap state machine
  private hotSwapPhase: HotSwapPhase = 'none'
  private hotSwapTarget: InputSourceType | null = null
  private hotSwapTimer: ReturnType<typeof setTimeout> | null = null

  // Crossfade gain envelope (0.0 - 1.0)
  private crossfadeGain = 1.0
  private crossfadeStep = 0
  private crossfadeFrameInterval: ReturnType<typeof setInterval> | null = null

  // Silence detection
  private lastAudioTimestamp = 0
  private silenceCheckInterval: ReturnType<typeof setInterval> | null = null

  // Telemetry
  private totalSamplesWritten = 0

  // Pre-allocated crossfade scratch buffer (avoids GC in hot path)
  private readonly scratchBuffer = new Float32Array(8192)

  constructor(ringWriter: SharedRingBufferWriter, config?: Partial<InputArbiterConfig>) {
    this.ringWriter = ringWriter
    this.config = { ...DEFAULT_ARBITER_CONFIG, ...config }

    // Silence detection monitor -- check every 500ms
    this.silenceCheckInterval = setInterval(() => this.checkSilence(), 500)
  }

  // ============================================
  // PROVIDER REGISTRATION
  // ============================================

  registerProvider(provider: IInputProvider): void {
    if (this.disposed) return

    const type = provider.type
    if (this.providers.has(type)) {
      console.warn(`[AudioMatrix] Provider ${type} already registered, replacing`)
      this.unregisterProvider(type)
    }

    // Wire the provider's audio callback to our ingestion pipeline
    provider.onAudioData = (buffer: Float32Array, sampleRate: number) => {
      this.ingestAudio(type, buffer, sampleRate)
    }

    provider.onStatusChange = (status: InputProviderStatus) => {
      this.handleProviderStatusChange(type, status)
    }

    this.providers.set(type, provider)
    console.log(`[AudioMatrix] WAVE 3401: Provider registered: ${type}`)

    // If no active source, try to activate this one
    if (!this.activeSource) {
      this.evaluateActiveSource()
    }
  }

  unregisterProvider(type: InputSourceType): void {
    const provider = this.providers.get(type)
    if (!provider) return

    provider.onAudioData = null
    provider.onStatusChange = null
    this.providers.delete(type)

    if (this.activeSource === type) {
      this.activeSource = null
      this.evaluateActiveSource()
    }

    console.log(`[AudioMatrix] Provider unregistered: ${type}`)
  }

  // ============================================
  // AUDIO INGESTION (HOT PATH)
  // ============================================

  private ingestAudio(source: InputSourceType, buffer: Float32Array, _sampleRate: number): void {
    if (this.disposed) return

    // Only accept data from the active source (or forced source).
    // WAVE 3403.1: If the forced source is in error/disposed state, fall back
    // to the best streaming provider in the priority chain so audio is never
    // silenced by a provider that cannot stream (e.g. VirtualWire without
    // native addon).
    let effectiveSource: InputSourceType | null = this.forcedSource
    if (this.forcedSource) {
      const forcedProvider = this.providers.get(this.forcedSource)
      if (
        !forcedProvider ||
        forcedProvider.status.state === 'error' ||
        forcedProvider.status.state === 'disposed'
      ) {
        // Forced source is unavailable — fall back to the best streaming provider
        effectiveSource = null
        for (const type of this.config.priorityChain) {
          const p = this.providers.get(type)
          if (p && (p.status.state === 'streaming' || p.status.state === 'ready')) {
            effectiveSource = type
            break
          }
        }
      }
    } else {
      effectiveSource = this.activeSource
    }

    if (source !== effectiveSource) return

    this.lastAudioTimestamp = Date.now()
    this.totalSamplesWritten += buffer.length

    // Apply crossfade gain during hot-swap transitions
    if (this.crossfadeGain < 1.0) {
      const len = Math.min(buffer.length, this.scratchBuffer.length)
      const gain = this.crossfadeGain
      for (let i = 0; i < len; i++) {
        this.scratchBuffer[i] = buffer[i] * gain
      }
      this.ringWriter.write(this.scratchBuffer.subarray(0, len))
    } else {
      this.ringWriter.write(buffer)
    }
  }

  // ============================================
  // SOURCE EVALUATION (PRIORITY CHAIN)
  // ============================================

  private evaluateActiveSource(): void {
    if (this.forcedSource) {
      this.activeSource = this.forcedSource
      return
    }

    // Walk priority chain, pick first streaming provider
    for (const type of this.config.priorityChain) {
      const provider = this.providers.get(type)
      if (provider && provider.status.state === 'streaming') {
        if (this.activeSource !== type) {
          this.initiateHotSwap(type)
        }
        return
      }
    }

    // Walk priority chain, pick first ready provider
    for (const type of this.config.priorityChain) {
      const provider = this.providers.get(type)
      if (provider && provider.status.state === 'ready') {
        this.activeSource = type
        console.log(`[AudioMatrix] Active source set to: ${type} (ready, not yet streaming)`)
        return
      }
    }

    // Nothing available
    if (this.activeSource) {
      console.warn('[AudioMatrix] No providers available, going silent')
      this.activeSource = null
    }
  }

  // ============================================
  // HOT-SWAP STATE MACHINE
  // ============================================

  private initiateHotSwap(newSource: InputSourceType): void {
    if (this.hotSwapPhase !== 'none') {
      // Already in a hot-swap, queue the new target
      this.hotSwapTarget = newSource
      return
    }

    if (!this.activeSource) {
      // No current source -- direct activation, no crossfade needed
      this.activeSource = newSource
      this.crossfadeGain = 1.0
      console.log(`[AudioMatrix] WAVE 3401: Direct activation: ${newSource}`)
      return
    }

    console.log(`[AudioMatrix] WAVE 3401: Hot-swap initiated: ${this.activeSource} -> ${newSource}`)

    this.hotSwapTarget = newSource
    this.startFadeOut()
  }

  private startFadeOut(): void {
    this.hotSwapPhase = 'fade-out'
    const durationMs = this.config.crossfadeDuration.fadeOutMs
    const steps = Math.max(1, Math.floor(durationMs / 4))  // ~4ms per step (250Hz envelope)
    const gainDecrement = 1.0 / steps
    let step = 0

    this.crossfadeGain = 1.0
    this.crossfadeFrameInterval = setInterval(() => {
      step++
      this.crossfadeGain = Math.max(0, 1.0 - gainDecrement * step)

      if (step >= steps) {
        this.clearCrossfadeInterval()
        this.startGap()
      }
    }, 4)
  }

  private startGap(): void {
    this.hotSwapPhase = 'gap'
    this.crossfadeGain = 0

    this.hotSwapTimer = setTimeout(() => {
      this.hotSwapTimer = null
      // Switch active source
      this.activeSource = this.hotSwapTarget
      this.startFadeIn()
    }, this.config.crossfadeDuration.gapMs)
  }

  private startFadeIn(): void {
    this.hotSwapPhase = 'fade-in'
    const durationMs = this.config.crossfadeDuration.fadeInMs
    const steps = Math.max(1, Math.floor(durationMs / 4))
    const gainIncrement = 1.0 / steps
    let step = 0

    this.crossfadeGain = 0
    this.crossfadeFrameInterval = setInterval(() => {
      step++
      this.crossfadeGain = Math.min(1.0, gainIncrement * step)

      if (step >= steps) {
        this.clearCrossfadeInterval()
        this.crossfadeGain = 1.0
        this.completeHotSwap()
      }
    }, 4)
  }

  private completeHotSwap(): void {
    console.log(`[AudioMatrix] WAVE 3401: Hot-swap complete. Active: ${this.activeSource}`)
    this.hotSwapPhase = 'none'
    this.hotSwapTarget = null
  }

  private clearCrossfadeInterval(): void {
    if (this.crossfadeFrameInterval) {
      clearInterval(this.crossfadeFrameInterval)
      this.crossfadeFrameInterval = null
    }
  }

  // ============================================
  // SILENCE DETECTION + AUTO FALLBACK
  // ============================================

  private checkSilence(): void {
    if (!this.config.autoFallback) return
    if (!this.activeSource) return
    if (this.hotSwapPhase !== 'none') return

    const elapsed = Date.now() - this.lastAudioTimestamp
    if (this.lastAudioTimestamp > 0 && elapsed > this.config.silenceTimeoutMs) {
      console.warn(`[AudioMatrix] Silence detected on ${this.activeSource} (${elapsed}ms). Auto-fallback.`)

      // Find next provider in priority chain that is streaming
      for (const type of this.config.priorityChain) {
        if (type === this.activeSource) continue
        const provider = this.providers.get(type)
        if (provider && provider.status.state === 'streaming') {
          this.initiateHotSwap(type)
          return
        }
      }
    }
  }

  // ============================================
  // PROVIDER STATUS CHANGES
  // ============================================

  private handleProviderStatusChange(type: InputSourceType, status: InputProviderStatus): void {
    console.log(`[AudioMatrix] Provider ${type} status: ${status.state}`)

    if (status.state === 'streaming') {
      this.evaluateActiveSource()
    } else if (status.state === 'error' || status.state === 'disposed') {
      if (this.activeSource === type) {
        this.activeSource = null
        this.evaluateActiveSource()
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  getActiveProvider(): IInputProvider | null {
    if (!this.activeSource) return null
    return this.providers.get(this.activeSource) ?? null
  }

  getRegisteredProviders(): readonly IInputProvider[] {
    return Array.from(this.providers.values())
  }

  setPriorityChain(chain: readonly InputSourceType[]): void {
    this.config = { ...this.config, priorityChain: chain }
    console.log(`[AudioMatrix] Priority chain updated: ${chain.join(' > ')}`)
    this.evaluateActiveSource()
  }

  async forceSource(type: InputSourceType): Promise<void> {
    const provider = this.providers.get(type)
    if (!provider) {
      console.warn(`[AudioMatrix] Cannot force unknown source: ${type}`)
      return
    }

    // WAVE 3403.1: Warn early if provider is unavailable — audio will fall back
    // to the priority-chain active source (see ingestAudio). This is intentional:
    // we record the user's intent so releaseForce() works correctly later.
    if (provider.status.state === 'error' || provider.status.state === 'disposed') {
      console.warn(
        `[AudioMatrix] forceSource('${type}'): provider is ${provider.status.state}. ` +
        `Audio will fall back to active source until provider recovers.`
      )
    }

    this.forcedSource = type

    if (provider.status.state === 'ready') {
      await provider.start()
    }

    this.initiateHotSwap(type)
  }

  releaseForce(): void {
    this.forcedSource = null
    this.evaluateActiveSource()
  }

  getSharedBuffer(): SharedArrayBuffer {
    return this.ringWriter.buffer
  }

  getStatus(): AudioMatrixStatus {
    const providerMap = new Map<InputSourceType, InputProviderStatus>()
    for (const [type, provider] of this.providers) {
      providerMap.set(type, provider.status)
    }

    return {
      activeSource: this.activeSource,
      isHotSwapping: this.hotSwapPhase !== 'none',
      hotSwapPhase: this.hotSwapPhase,
      ringBufferFillLevel: this.ringWriter.fillLevel,
      sharedBufferReady: true,
      providers: providerMap,
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.clearCrossfadeInterval()

    if (this.hotSwapTimer) {
      clearTimeout(this.hotSwapTimer)
      this.hotSwapTimer = null
    }

    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval)
      this.silenceCheckInterval = null
    }

    for (const [type, provider] of this.providers) {
      provider.onAudioData = null
      provider.onStatusChange = null
      try {
        provider.dispose()
      } catch (e) {
        console.error(`[AudioMatrix] Error disposing provider ${type}:`, e)
      }
    }
    this.providers.clear()

    this.activeSource = null
    this.forcedSource = null

    console.log(`[AudioMatrix] WAVE 3401: Disposed. Total samples written: ${this.totalSamplesWritten}`)
  }
}
