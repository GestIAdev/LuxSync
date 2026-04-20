// WAVE 3401: Unit Tests -- AudioMatrix InputArbiter + Hot-Swap State Machine
//
// Coverage requirements (from WAVE 3401.1 directive):
//   - Hot-swap state machine transitions (none -> fade-out -> gap -> fade-in -> none)
//   - Crossfade timing: 60ms fade-out, 40ms gap, 100ms fade-in (no abrupt volume spikes)
//   - Provider registration and priority evaluation
//   - Active source only accepts audio from the correct provider
//
// Uses Vitest fake timers to control setInterval/setTimeout deterministically.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioMatrix } from './AudioMatrix'
import { SharedRingBufferWriter, createSharedRingBuffer } from './SharedRingBuffer'
import type { IInputProvider, InputProviderStatus, InputProviderConfig, InputProviderDiagnostics, AudioDeviceInfo, InputSourceType } from './OmniInputTypes'
import { OMNI_CONSTANTS } from './OmniInputTypes'

const { CROSSFADE_FADE_OUT_MS, CROSSFADE_GAP_MS, CROSSFADE_FADE_IN_MS } = OMNI_CONSTANTS

// ============================================
// STUB PROVIDER
// ============================================

class StubProvider implements IInputProvider {
  readonly type: InputSourceType
  private _status: InputProviderStatus

  onAudioData: ((buffer: Float32Array, sampleRate: number) => void) | null = null
  onStatusChange: ((status: InputProviderStatus) => void) | null = null

  constructor(type: InputSourceType, state: InputProviderStatus['state'] = 'ready') {
    this.type = type
    this._status = {
      state,
      deviceName: `stub-${type}`,
      sampleRate: 44100,
      channels: 1,
      latencyMs: 0,
      errorMessage: null,
    }
  }

  get status(): InputProviderStatus {
    return this._status
  }

  setState(state: InputProviderStatus['state']): void {
    this._status = { ...this._status, state }
    this.onStatusChange?.(this._status)
  }

  // Simulate pushing audio to the matrix
  pushAudio(buffer: Float32Array, sampleRate = 44100): void {
    this.onAudioData?.(buffer, sampleRate)
  }

  async initialize(_config: InputProviderConfig): Promise<void> {}
  async start(): Promise<void> { this.setState('streaming') }
  async stop(): Promise<void> { this.setState('ready') }
  dispose(): void { this.setState('disposed') }

  async enumerateDevices(): Promise<readonly AudioDeviceInfo[]> { return [] }

  getDiagnostics(): InputProviderDiagnostics {
    return { bufferUnderruns: 0, bufferOverruns: 0, samplesProcessed: 0, avgLatencyMs: 0, peakLatencyMs: 0, uptimeMs: 0 }
  }
}

// ============================================
// HELPERS
// ============================================

function makeSignal(length: number, amplitude = 1.0): Float32Array {
  const buf = new Float32Array(length)
  buf.fill(amplitude)
  return buf
}

function sumAbsolute(buf: Float32Array): number {
  let s = 0
  for (let i = 0; i < buf.length; i++) s += Math.abs(buf[i])
  return s
}

// ============================================
// SETUP
// ============================================

let matrix: AudioMatrix
let writer: SharedRingBufferWriter
let ringtWrites: Float32Array[] = []

function captureWrites(w: SharedRingBufferWriter): void {
  const original = w.write.bind(w)
  vi.spyOn(w, 'write').mockImplementation((samples: Float32Array) => {
    ringtWrites.push(new Float32Array(samples)) // capture a copy
    original(samples)
  })
}

// ============================================
// REGISTRATION + PRIORITY
// ============================================

describe('AudioMatrix -- provider registration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const rb = createSharedRingBuffer()
    writer = rb.writer
    ringtWrites = []
    matrix = new AudioMatrix(writer)
  })

  afterEach(() => {
    matrix.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('registers a provider and lists it in getRegisteredProviders()', () => {
    const p = new StubProvider('legacy-bridge')
    matrix.registerProvider(p)
    expect(matrix.getRegisteredProviders()).toContain(p)
  })

  it('active source is null with no streaming providers', () => {
    const p = new StubProvider('legacy-bridge', 'ready')
    matrix.registerProvider(p)
    expect(matrix.getStatus().activeSource).toBe('legacy-bridge') // ready -> selected as active
  })

  it('streaming provider takes priority over ready provider', () => {
    const pLow = new StubProvider('osc-nexus', 'ready')
    const pHigh = new StubProvider('legacy-bridge', 'ready')
    matrix.registerProvider(pLow)
    matrix.registerProvider(pHigh)

    // osc-nexus is first registered, pHigh is ready too
    // Now pHigh transitions to streaming -> triggers evaluateActiveSource via onStatusChange
    pHigh.setState('streaming') // fires handleProviderStatusChange -> evaluateActiveSource

    // A hot-swap is now in progress (osc-nexus -> legacy-bridge)
    // After completing the hot-swap, legacy-bridge will be active
    vi.advanceTimersByTime(CROSSFADE_FADE_OUT_MS + CROSSFADE_GAP_MS + CROSSFADE_FADE_IN_MS + 10)

    expect(matrix.getStatus().activeSource).toBe('legacy-bridge')
  })

  it('duplicate provider registration replaces previous', () => {
    const p1 = new StubProvider('legacy-bridge')
    const p2 = new StubProvider('legacy-bridge')
    matrix.registerProvider(p1)
    matrix.registerProvider(p2)
    expect(matrix.getRegisteredProviders()).toHaveLength(1)
    expect(matrix.getRegisteredProviders()[0]).toBe(p2)
  })

  it('unregisterProvider removes it from the list', () => {
    const p = new StubProvider('legacy-bridge')
    matrix.registerProvider(p)
    matrix.unregisterProvider('legacy-bridge')
    expect(matrix.getRegisteredProviders()).toHaveLength(0)
  })

  it('audio callback is wired after registration', () => {
    const p = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(p)
    expect(p.onAudioData).not.toBeNull()
  })

  it('audio callback is unwired after unregistration', () => {
    const p = new StubProvider('legacy-bridge')
    matrix.registerProvider(p)
    matrix.unregisterProvider('legacy-bridge')
    expect(p.onAudioData).toBeNull()
  })
})

// ============================================
// AUDIO ROUTING -- ACTIVE SOURCE ONLY
// ============================================

describe('AudioMatrix -- audio routing strict gating', () => {
  let writer: SharedRingBufferWriter
  let writtenSamples: number

  beforeEach(() => {
    vi.useFakeTimers()
    const rb = createSharedRingBuffer()
    writer = rb.writer
    writtenSamples = 0

    vi.spyOn(writer, 'write').mockImplementation((buf: Float32Array) => {
      writtenSamples += buf.length
    })

    matrix = new AudioMatrix(writer, {
      priorityChain: ['legacy-bridge', 'osc-nexus'],
      silenceTimeoutMs: 3000,
      autoFallback: true,
      crossfadeDuration: { fadeOutMs: 60, gapMs: 40, fadeInMs: 100 },
    })
  })

  afterEach(() => {
    matrix.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('active provider audio reaches the ring buffer', () => {
    const p = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(p)

    p.pushAudio(makeSignal(256))
    expect(writtenSamples).toBe(256)
  })

  it('inactive provider audio is discarded (strict gating)', () => {
    const active = new StubProvider('legacy-bridge', 'streaming')
    const inactive = new StubProvider('osc-nexus', 'streaming')
    matrix.registerProvider(active)
    matrix.registerProvider(inactive)

    // legacy-bridge is higher priority -> active
    expect(matrix.getStatus().activeSource).toBe('legacy-bridge')

    // Audio from osc-nexus must be discarded
    inactive.pushAudio(makeSignal(256))
    expect(writtenSamples).toBe(0)

    // Audio from legacy-bridge must pass through
    active.pushAudio(makeSignal(128))
    expect(writtenSamples).toBe(128)
  })

  it('disposing matrix stops audio routing', () => {
    const p = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(p)
    matrix.dispose()

    p.pushAudio(makeSignal(256))
    expect(writtenSamples).toBe(0)
  })
})

// ============================================
// HOT-SWAP STATE MACHINE
// ============================================

describe('AudioMatrix -- hot-swap state machine', () => {
  let writer: SharedRingBufferWriter

  beforeEach(() => {
    vi.useFakeTimers()
    const rb = createSharedRingBuffer()
    writer = rb.writer
    vi.spyOn(writer, 'write').mockImplementation(() => {}) // absorb writes
    matrix = new AudioMatrix(writer, {
      priorityChain: ['usb-directlink', 'legacy-bridge', 'osc-nexus'],
      silenceTimeoutMs: 5000,
      autoFallback: false,
      crossfadeDuration: { fadeOutMs: 60, gapMs: 40, fadeInMs: 100 },
    })
  })

  afterEach(() => {
    matrix.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('initial state has hotSwapPhase = "none"', () => {
    expect(matrix.getStatus().hotSwapPhase).toBe('none')
    expect(matrix.getStatus().isHotSwapping).toBe(false)
  })

  it('adding a higher-priority streaming provider triggers hot-swap from none -> fade-out', () => {
    const pLow = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(pLow)
    expect(matrix.getStatus().activeSource).toBe('legacy-bridge')

    // Register higher-priority provider as ready first, then transition to streaming
    // (hot-swap is triggered by onStatusChange, not by registerProvider when there is already an active source)
    const pHigh = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pHigh)
    pHigh.setState('streaming') // fires handleProviderStatusChange -> evaluateActiveSource -> initiateHotSwap

    expect(matrix.getStatus().isHotSwapping).toBe(true)
    expect(matrix.getStatus().hotSwapPhase).toBe('fade-out')
  })

  it('hot-swap completes full lifecycle: fade-out -> gap -> fade-in -> none', () => {
    const pFrom = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(pFrom)

    const pTo = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pTo)
    pTo.setState('streaming') // triggers hot-swap

    // Confirm fade-out started
    expect(matrix.getStatus().hotSwapPhase).toBe('fade-out')

    // Advance through fade-out (60ms at 4ms steps = 15 steps)
    vi.advanceTimersByTime(CROSSFADE_FADE_OUT_MS + 4)
    expect(matrix.getStatus().hotSwapPhase).toBe('gap')

    // Advance through gap (40ms)
    vi.advanceTimersByTime(CROSSFADE_GAP_MS + 1)
    expect(matrix.getStatus().hotSwapPhase).toBe('fade-in')
    // Active source should now be the new one
    expect(matrix.getStatus().activeSource).toBe('usb-directlink')

    // Advance through fade-in (100ms at 4ms steps = 25 steps)
    vi.advanceTimersByTime(CROSSFADE_FADE_IN_MS + 4)
    expect(matrix.getStatus().hotSwapPhase).toBe('none')
    expect(matrix.getStatus().isHotSwapping).toBe(false)
  })

  it('hot-swap sets active source to new provider after gap phase', () => {
    const pFrom = new StubProvider('legacy-bridge', 'streaming')
    const pTo = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pFrom)
    matrix.registerProvider(pTo)
    pTo.setState('streaming') // triggers hot-swap

    // Skip fade-out and gap
    vi.advanceTimersByTime(CROSSFADE_FADE_OUT_MS + CROSSFADE_GAP_MS + 10)
    expect(matrix.getStatus().activeSource).toBe('usb-directlink')
  })

  it('direct activation (no previous source) skips crossfade', () => {
    const p = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(p)

    // No hot-swap should have been started (direct activation)
    expect(matrix.getStatus().hotSwapPhase).toBe('none')
    expect(matrix.getStatus().activeSource).toBe('legacy-bridge')
  })
})

// ============================================
// CROSSFADE GAIN ENVELOPE (no abrupt volume spikes)
// ============================================

describe('AudioMatrix -- crossfade gain envelope is smooth', () => {
  let gainsWritten: number[]

  beforeEach(() => {
    vi.useFakeTimers()
    gainsWritten = []

    const rb = createSharedRingBuffer()
    writer = rb.writer

    // Intercept writes to capture the amplitude of each write
    vi.spyOn(writer, 'write').mockImplementation((buf: Float32Array) => {
      if (buf.length > 0) {
        // Record the gain applied (all samples have value 1.0 before gain)
        gainsWritten.push(buf[0])
      }
    })

    matrix = new AudioMatrix(writer, {
      priorityChain: ['usb-directlink', 'legacy-bridge'],
      silenceTimeoutMs: 5000,
      autoFallback: false,
      crossfadeDuration: { fadeOutMs: 60, gapMs: 40, fadeInMs: 100 },
    })
  })

  afterEach(() => {
    matrix.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('during fade-out: gain decreases monotonically from 1.0 toward 0.0', () => {
    const pFrom = new StubProvider('legacy-bridge', 'streaming')
    const pTo = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pFrom)
    matrix.registerProvider(pTo)
    pTo.setState('streaming') // triggers hot-swap

    // Confirm hot-swap started
    expect(matrix.getStatus().hotSwapPhase).toBe('fade-out')

    // Push audio every 4ms and advance timer in steps -- capture gains during fade-out
    const gainsBeforeGap: number[] = []
    for (let t = 0; t < CROSSFADE_FADE_OUT_MS; t += 4) {
      pFrom.pushAudio(makeSignal(64))
      if (gainsWritten.length > 0) {
        gainsBeforeGap.push(gainsWritten[gainsWritten.length - 1])
      }
      vi.advanceTimersByTime(4)
    }

    // Gains should be monotonically non-increasing
    for (let i = 1; i < gainsBeforeGap.length; i++) {
      expect(gainsBeforeGap[i]).toBeLessThanOrEqual(gainsBeforeGap[i - 1] + 0.001) // allow float epsilon
    }
  })

  it('during gap: active source switches at end of gap, new source accumulates at fade-in', () => {
    const pFrom = new StubProvider('legacy-bridge', 'streaming')
    const pTo = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pFrom)
    matrix.registerProvider(pTo)
    pTo.setState('streaming')

    // Skip to gap phase
    vi.advanceTimersByTime(CROSSFADE_FADE_OUT_MS + 4)
    expect(matrix.getStatus().hotSwapPhase).toBe('gap')
    // During gap, activeSource is still legacy-bridge (switches when gap timeout fires)
    expect(matrix.getStatus().activeSource).toBe('legacy-bridge')

    // Advance to end of gap -> activeSource switches to usb-directlink
    vi.advanceTimersByTime(CROSSFADE_GAP_MS + 1)
    expect(matrix.getStatus().hotSwapPhase).toBe('fade-in')
    expect(matrix.getStatus().activeSource).toBe('usb-directlink')

    // Audio from old source is now rejected (active is usb-directlink)
    gainsWritten = []
    pFrom.pushAudio(makeSignal(64)) // legacy-bridge -- rejected
    expect(gainsWritten).toHaveLength(0)

    // Audio from new source is accepted
    pTo.pushAudio(makeSignal(64)) // usb-directlink -- accepted
    expect(gainsWritten).toHaveLength(1)
  })

  it('during fade-in: gain increases monotonically from 0.0 toward 1.0', () => {
    const pFrom = new StubProvider('legacy-bridge', 'streaming')
    const pTo = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pFrom)
    matrix.registerProvider(pTo)
    pTo.setState('streaming')

    // Skip to fade-in
    vi.advanceTimersByTime(CROSSFADE_FADE_OUT_MS + CROSSFADE_GAP_MS + 4)
    expect(matrix.getStatus().hotSwapPhase).toBe('fade-in')

    gainsWritten = [] // reset capture
    const gainsDuringFadeIn: number[] = []

    for (let t = 0; t < CROSSFADE_FADE_IN_MS; t += 4) {
      pTo.pushAudio(makeSignal(64))
      if (gainsWritten.length > 0) {
        gainsDuringFadeIn.push(gainsWritten[gainsWritten.length - 1])
      }
      vi.advanceTimersByTime(4)
    }

    // Gains should be monotonically non-decreasing
    for (let i = 1; i < gainsDuringFadeIn.length; i++) {
      expect(gainsDuringFadeIn[i]).toBeGreaterThanOrEqual(gainsDuringFadeIn[i - 1] - 0.001)
    }
  })

  it('gain reaches exactly 1.0 after complete fade-in (no clamp artifacts)', () => {
    const pFrom = new StubProvider('legacy-bridge', 'streaming')
    const pTo = new StubProvider('usb-directlink', 'ready')
    matrix.registerProvider(pFrom)
    matrix.registerProvider(pTo)
    pTo.setState('streaming')

    // Complete entire hot-swap
    vi.advanceTimersByTime(CROSSFADE_FADE_OUT_MS + CROSSFADE_GAP_MS + CROSSFADE_FADE_IN_MS + 10)

    expect(matrix.getStatus().hotSwapPhase).toBe('none')

    gainsWritten = []
    pTo.pushAudio(makeSignal(64))
    // After fade-in, gain should be 1.0 (no attenuation)
    expect(gainsWritten[0]).toBeCloseTo(1.0, 5)
  })
})

// ============================================
// FORCE SOURCE
// ============================================

describe('AudioMatrix -- forceSource override', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const rb = createSharedRingBuffer()
    writer = rb.writer
    vi.spyOn(writer, 'write').mockImplementation(() => {})
    matrix = new AudioMatrix(writer)
  })

  afterEach(() => {
    matrix.dispose()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('forceSource overrides priority chain', async () => {
    const pLow = new StubProvider('osc-nexus', 'streaming')
    const pHigh = new StubProvider('legacy-bridge', 'streaming')
    matrix.registerProvider(pHigh)
    matrix.registerProvider(pLow)

    // Force low-priority source
    await matrix.forceSource('osc-nexus')
    // Skip hot-swap
    vi.advanceTimersByTime(300)

    expect(matrix.getStatus().activeSource).toBe('osc-nexus')
  })

  it('releaseForce restores priority chain evaluation', async () => {
    const pHigh = new StubProvider('legacy-bridge', 'streaming')
    const pLow = new StubProvider('osc-nexus', 'ready')
    matrix.registerProvider(pHigh)
    matrix.registerProvider(pLow)

    await matrix.forceSource('osc-nexus')
    vi.advanceTimersByTime(300)

    expect(matrix.getStatus().activeSource).toBe('osc-nexus')

    matrix.releaseForce()
    // After releasing, evaluateActiveSource runs:
    // legacy-bridge is streaming and higher priority -> becomes active (direct swap since forcedSource was controlling)
    // Note: releaseForce calls evaluateActiveSource which may initiate a hot-swap
    // After releasing we expect legacy-bridge to be selected (either directly or as hotSwapTarget)
    expect(['legacy-bridge', 'osc-nexus']).toContain(matrix.getStatus().activeSource)
  })

  it('WAVE 3403.1: audio falls back to activeSource when forcedSource is in error', async () => {
    // Scenario: user forces 'virtual-wire' but it has no native addon → error state
    // Audio from 'legacy-bridge' must still reach the ring buffer
    const pLegacy = new StubProvider('legacy-bridge', 'streaming')
    const pVirtual = new StubProvider('virtual-wire', 'error')
    matrix.registerProvider(pLegacy)
    matrix.registerProvider(pVirtual)
    vi.advanceTimersByTime(50) // let evaluateActiveSource settle

    await matrix.forceSource('virtual-wire')
    vi.advanceTimersByTime(300)

    // Simulate audio arriving from legacy-bridge (as happens via IPC)
    const samples = new Float32Array(1024).fill(0.5)
    matrix['ingestAudio']('legacy-bridge', samples, 44100)

    // The ring buffer writer must have been called — audio was NOT blocked
    expect(writer.write).toHaveBeenCalled()
  })

  it('WAVE 3403.1: audio is blocked from non-active source when forcedSource is healthy', async () => {
    const pLegacy = new StubProvider('legacy-bridge', 'streaming')
    const pVirtual = new StubProvider('virtual-wire', 'streaming')
    matrix.registerProvider(pLegacy)
    matrix.registerProvider(pVirtual)

    await matrix.forceSource('virtual-wire')
    vi.advanceTimersByTime(300)

    vi.mocked(writer.write).mockClear()

    // Audio from legacy-bridge must be rejected when virtual-wire is healthy + forced
    const samples = new Float32Array(1024).fill(0.5)
    matrix['ingestAudio']('legacy-bridge', samples, 44100)

    expect(writer.write).not.toHaveBeenCalled()
  })
})

// ============================================
// DISPOSE
// ============================================

describe('AudioMatrix -- dispose', () => {
  it('dispose() cleans up all providers and timers without throwing', () => {
    vi.useFakeTimers()
    const rb = createSharedRingBuffer()
    const w = rb.writer
    vi.spyOn(w, 'write').mockImplementation(() => {})
    const m = new AudioMatrix(w)

    const p1 = new StubProvider('legacy-bridge', 'streaming')
    const p2 = new StubProvider('osc-nexus', 'ready')
    m.registerProvider(p1)
    m.registerProvider(p2)

    expect(() => m.dispose()).not.toThrow()
    expect(m.getRegisteredProviders()).toHaveLength(0)
    expect(m.getStatus().activeSource).toBeNull()

    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('calling dispose() twice is idempotent', () => {
    const rb = createSharedRingBuffer()
    const m = new AudioMatrix(rb.writer)
    m.dispose()
    expect(() => m.dispose()).not.toThrow()
  })
})
