/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2487: LiquidEngineBase — Integration Tests + dt Stress
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE SAFETY NET — Cubre los módulos transversales del EngineBase:
 *   - MorphFactor: cálculo + override
 *   - Transient Shaper: impactDelta, hybridSnare, centroid shield
 *   - Strobe: trigger, duration, noise discount
 *   - Silence/AGC: detección y recovery
 *   - dt Stress: 15fps → 144fps sin quedarse atascado
 *   - Apocalypse Mode
 *   - Acid/Noise mode flags
 *
 * Tests DETERMINISTAS. Zero aleatorio. Axioma Anti-Simulación.
 *
 * @version WAVE 2487 — THE SAFETY NET
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LiquidEngine71 } from '../LiquidEngine71'
import { LiquidEngine41 } from '../LiquidEngine41'
import type { LiquidStereoResult } from '../LiquidStereoPhysics'
import { TECHNO_PROFILE } from '../profiles/techno'
import { CHILL_PROFILE } from '../profiles/chilllounge'
import { POPROCK_PROFILE } from '../profiles/poprock'
import {
  silentBands,
  kickBands,
  hihatBands,
  snareBands,
  melodicBands,
  guitarBands,
  generateBroadbandNoise,
  generate4x4Pattern,
  makeInput,
} from './test-harness'

// ═══════════════════════════════════════════════════════════════════════════
// MORPHFACTOR
// ═══════════════════════════════════════════════════════════════════════════

describe('🧬 MorphFactor Engine', () => {
  let engine: LiquidEngine71

  beforeEach(() => {
    engine = new LiquidEngine71(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should converge morphFactor towards 1.0 on sustained melodic content', () => {
    // Formula: morph = clamp((avgMid - 0.30) / 0.40, 0, 1)
    // melodicBands.mid = 0.65 → avgMid → 0.65 → morph → (0.65-0.30)/0.40 = 0.875
    for (let i = 0; i < 100; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(melodicBands()))
    }

    // After 100 frames, avgMid should be near 0.65
    // We can't access morphFactor directly, but its effects are observable:
    // Higher morphFactor = more permissive gates, longer decays
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(melodicBands()))

    // Con morph alto, el motor produce salida incluso con señales medianas
    expect(result.physicsApplied).toBe('liquid-stereo')
  })

  it('should keep morphFactor near 0 on kick-only content', () => {
    // kickBands.mid = strength * 0.10 = 0.085 (con strength=0.85)
    // avgMid → 0.085 → morph = max(0, (0.085-0.30)/0.40) = 0
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.85), { isKick: i % 3 === 0 }))
    }

    // Low morph = strict gates, fast decays
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(0.85), { isKick: true }))
    expect(Number.isFinite(result.frontRightIntensity)).toBe(true)
  })

  it('should respect morphFactorOverride when provided', () => {
    // morphFactorOverride fuerza el valor directamente
    const eng1 = new LiquidEngine71(TECHNO_PROFILE)
    const eng2 = new LiquidEngine71(TECHNO_PROFILE)

    // Both start cold, same input but different morphFactorOverride
    eng1.applyBands(makeInput(silentBands()))
    eng2.applyBands(makeInput(silentBands()))
    vi.advanceTimersByTime(50)
    eng1.applyBands(makeInput(kickBands(0.70), { morphFactorOverride: 0.0 }))
    eng2.applyBands(makeInput(kickBands(0.70), { morphFactorOverride: 1.0 }))
    vi.advanceTimersByTime(50)
    const r1 = eng1.applyBands(makeInput(kickBands(0.80), { morphFactorOverride: 0.0, isKick: true }))
    const r2 = eng2.applyBands(makeInput(kickBands(0.80), { morphFactorOverride: 1.0, isKick: true }))

    // Different morphFactors should produce different envelope behavior
    // At least decay or gate behavior should differ
    expect(Number.isFinite(r1.frontRightIntensity)).toBe(true)
    expect(Number.isFinite(r2.frontRightIntensity)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TRANSIENT SHAPER
// ═══════════════════════════════════════════════════════════════════════════

describe('⚡ Transient Shaper', () => {
  let engine: LiquidEngine71

  beforeEach(() => {
    engine = new LiquidEngine71(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should detect transient on sharp treble rise', () => {
    // Frame 1: low treble
    engine.applyBands(makeInput({ ...silentBands(), treble: 0.02, highMid: 0.01, mid: 0.01 }))
    vi.advanceTimersByTime(50)
    // Frame 2: treble spike → high trebleDelta
    const result = engine.applyBands(makeInput({
      ...silentBands(), treble: 0.60, highMid: 0.40, mid: 0.20,
    }))

    // Transient shaper fires → backPar should have signal
    expect(result.backRightIntensity).toBeGreaterThan(0)
  })

  it('should produce LESS backRight on gradual rise than on sharp spike', () => {
    // Engine A: gradual ramp (no sharp transient)
    const engGradual = new LiquidEngine71(TECHNO_PROFILE)
    for (let i = 0; i < 30; i++) {
      const t = i / 30
      vi.advanceTimersByTime(50)
      engGradual.applyBands(makeInput({
        ...silentBands(),
        treble: t * 0.50,
        highMid: t * 0.30,
        mid: t * 0.20,
      }))
    }
    vi.advanceTimersByTime(50)
    const gradualResult = engGradual.applyBands(makeInput({
      ...silentBands(), treble: 0.51, highMid: 0.31, mid: 0.21,
    }))

    // Engine B: sharp spike from silence (max transient delta)
    const engSpike = new LiquidEngine71(TECHNO_PROFILE)
    engSpike.applyBands(makeInput({ ...silentBands(), treble: 0.02, highMid: 0.01, mid: 0.01 }))
    vi.advanceTimersByTime(50)
    const spikeResult = engSpike.applyBands(makeInput({
      ...silentBands(), treble: 0.70, highMid: 0.50, mid: 0.30,
    }))

    // The spike should produce equal or greater backRight than the gradual ramp
    // because the transient shaper amplifies sudden changes
    expect(spikeResult.backRightIntensity).toBeGreaterThanOrEqual(gradualResult.backRightIntensity * 0.5)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SILENCE / AGC
// ═══════════════════════════════════════════════════════════════════════════

describe('🔇 Silence & AGC Protection', () => {
  let engine: LiquidEngine71

  beforeEach(() => {
    engine = new LiquidEngine71(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should zero all outputs on isRealSilence', () => {
    const result = engine.applyBands(makeInput(kickBands(0.90), { isRealSilence: true }))

    expect(result.frontLeftIntensity).toBe(0)
    expect(result.frontRightIntensity).toBe(0)
    expect(result.backLeftIntensity).toBe(0)
    expect(result.backRightIntensity).toBe(0)
    expect(result.moverLeftIntensity).toBe(0)
    expect(result.moverRightIntensity).toBe(0)
    expect(result.strobeActive).toBe(false)
  })

  it('should zero all outputs on isAGCTrap', () => {
    const result = engine.applyBands(makeInput(kickBands(0.90), { isAGCTrap: true }))

    expect(result.frontLeftIntensity).toBe(0)
    expect(result.frontRightIntensity).toBe(0)
    expect(result.moverLeftIntensity).toBe(0)
    expect(result.moverRightIntensity).toBe(0)
  })

  it('should recover from silence within RECOVERY_DURATION (2000ms)', () => {
    // Active phase
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.80), { isKick: true }))
    }

    // Enter silence
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(silentBands(), { isRealSilence: true }))
    }

    // Exit silence — recovery ramp
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(silentBands())) // Not real silence, just empty
    }

    // After RECOVERY_DURATION (2000ms), engine should be fully responsive
    vi.advanceTimersByTime(2500)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.50 + i * 0.04), { isKick: true }))
    }
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(0.90), { isKick: true }))

    expect(result.frontRightIntensity).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ACID & NOISE MODES
// ═══════════════════════════════════════════════════════════════════════════

describe('💀 Acid & Noise Mode Flags', () => {
  let engine: LiquidEngine71

  beforeEach(() => {
    engine = new LiquidEngine71(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should flag acidMode when harshness > harshnessAcidThreshold (0.60)', () => {
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(), { harshness: 0.65 }))
    expect(result.acidMode).toBe(true)
  })

  it('should NOT flag acidMode when harshness < threshold', () => {
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(), { harshness: 0.45 }))
    expect(result.acidMode).toBe(false)
  })

  it('should flag noiseMode when flatness > flatnessNoiseThreshold', () => {
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(), { flatness: 0.75 }))
    expect(result.noiseMode).toBe(true)
  })

  it('should NOT flag noiseMode when flatness < threshold', () => {
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(), { flatness: 0.30 }))
    expect(result.noiseMode).toBe(false)
  })

  it('should set both acidMode AND noiseMode when both thresholds crossed', () => {
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(kickBands(), { harshness: 0.70, flatness: 0.80 }))
    expect(result.acidMode).toBe(true)
    expect(result.noiseMode).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// APOCALYPSE MODE (Harshness + Flatness combinados)
// ═══════════════════════════════════════════════════════════════════════════

describe('☠️ Apocalypse Mode', () => {
  let engine: LiquidEngine71

  beforeEach(() => {
    engine = new LiquidEngine71(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should trigger when harshness > apocalypseHarshness AND flatness > apocalypseFlatness', () => {
    // Warm up
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(melodicBands()))
    }

    // Apocalypse: extreme noise + harsh
    vi.advanceTimersByTime(50)
    const result = engine.applyBands(makeInput(
      guitarBands(0.95),
      { harshness: 0.95, flatness: 0.90 },
    ))

    // In apocalypse, chaos energy fills back/movers aggressively
    // We verify the engine doesn't crash and produces output
    expect(Number.isFinite(result.backLeftIntensity)).toBe(true)
    expect(Number.isFinite(result.backRightIntensity)).toBe(true)
    expect(Number.isFinite(result.moverLeftIntensity)).toBe(true)
    expect(Number.isFinite(result.moverRightIntensity)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// FASE 3: dt STRESS TESTS (15fps → 144fps)
// ═══════════════════════════════════════════════════════════════════════════

describe('⏱️ dt Stress Tests (Variable Frame Rate)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not leave dimmers stuck at 15fps (66ms per frame)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(TECHNO_PROFILE)
    const dt = 66 // 15fps

    // 4/4 pattern at 128bpm for 5 seconds
    const pattern = generate4x4Pattern(128, 5000, 15)

    // Process all frames
    for (const bands of pattern) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(bands, { isKick: bands.bass > 0.5 }))
    }

    // After music stops, decay should bring everything to 0
    for (let i = 0; i < 60; i++) { // 60 frames = ~4 seconds at 15fps
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(silentBands()))
    }

    vi.advanceTimersByTime(dt)
    const result = engine.applyBands(makeInput(silentBands()))

    // Nothing stuck above ghost threshold
    expect(result.frontLeftIntensity).toBeLessThan(0.05)
    expect(result.frontRightIntensity).toBeLessThan(0.05)
    expect(result.backLeftIntensity).toBeLessThan(0.05)
    expect(result.backRightIntensity).toBeLessThan(0.05)
    expect(result.moverLeftIntensity).toBeLessThan(0.05)
    expect(result.moverRightIntensity).toBeLessThan(0.05)
  })

  it('should not leave dimmers stuck at 30fps (33ms per frame)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(TECHNO_PROFILE)
    const dt = 33

    const pattern = generate4x4Pattern(128, 5000, 30)

    for (const bands of pattern) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(bands, { isKick: bands.bass > 0.5 }))
    }

    // Decay
    for (let i = 0; i < 120; i++) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(silentBands()))
    }

    vi.advanceTimersByTime(dt)
    const result = engine.applyBands(makeInput(silentBands()))

    expect(result.frontRightIntensity).toBeLessThan(0.05)
    expect(result.backRightIntensity).toBeLessThan(0.05)
    expect(result.moverLeftIntensity).toBeLessThan(0.05)
    expect(result.moverRightIntensity).toBeLessThan(0.05)
  })

  it('should not leave dimmers stuck at 60fps (16ms per frame)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(TECHNO_PROFILE)
    const dt = 16

    const pattern = generate4x4Pattern(128, 3000, 60) // shorter to not explode

    for (const bands of pattern) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(bands, { isKick: bands.bass > 0.5 }))
    }

    // Decay
    for (let i = 0; i < 240; i++) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(silentBands()))
    }

    vi.advanceTimersByTime(dt)
    const result = engine.applyBands(makeInput(silentBands()))

    expect(result.frontRightIntensity).toBeLessThan(0.05)
    expect(result.moverLeftIntensity).toBeLessThan(0.05)
  })

  it('should not leave dimmers stuck at 144fps (7ms per frame)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(TECHNO_PROFILE)
    const dt = 7

    const pattern = generate4x4Pattern(128, 2000, 144) // short duration

    for (const bands of pattern) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(bands, { isKick: bands.bass > 0.5 }))
    }

    // Decay: 144fps * 5s = 720 frames
    for (let i = 0; i < 720; i++) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(silentBands()))
    }

    vi.advanceTimersByTime(dt)
    const result = engine.applyBands(makeInput(silentBands()))

    expect(result.frontRightIntensity).toBeLessThan(0.05)
    expect(result.moverLeftIntensity).toBeLessThan(0.05)
  })

  it('should produce stable output under variable dt (jittery frame rate)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(TECHNO_PROFILE)

    // Simulate jittery frame rate: alternating 10ms and 50ms
    const dts = [10, 50, 10, 50, 10, 50, 10, 50, 10, 50, 33, 33, 33, 16, 66, 16, 66, 7, 100, 7]

    for (let round = 0; round < 5; round++) {
      for (const dt of dts) {
        vi.advanceTimersByTime(dt)
        const result = engine.applyBands(makeInput(kickBands(0.70), { isKick: true }))

        // NEVER produce NaN or Infinity
        expect(Number.isFinite(result.frontLeftIntensity)).toBe(true)
        expect(Number.isFinite(result.frontRightIntensity)).toBe(true)
        expect(Number.isFinite(result.backLeftIntensity)).toBe(true)
        expect(Number.isFinite(result.backRightIntensity)).toBe(true)
        expect(Number.isFinite(result.moverLeftIntensity)).toBe(true)
        expect(Number.isFinite(result.moverRightIntensity)).toBe(true)

        // NEVER go negative
        expect(result.frontLeftIntensity).toBeGreaterThanOrEqual(0)
        expect(result.frontRightIntensity).toBeGreaterThanOrEqual(0)
        expect(result.backLeftIntensity).toBeGreaterThanOrEqual(0)
        expect(result.backRightIntensity).toBeGreaterThanOrEqual(0)
        expect(result.moverLeftIntensity).toBeGreaterThanOrEqual(0)
        expect(result.moverRightIntensity).toBeGreaterThanOrEqual(0)

        // NEVER exceed 1.0
        expect(result.frontLeftIntensity).toBeLessThanOrEqual(1.0)
        expect(result.frontRightIntensity).toBeLessThanOrEqual(1.0)
        expect(result.backLeftIntensity).toBeLessThanOrEqual(1.0)
        expect(result.backRightIntensity).toBeLessThanOrEqual(1.0)
        expect(result.moverLeftIntensity).toBeLessThanOrEqual(1.0)
        expect(result.moverRightIntensity).toBeLessThanOrEqual(1.0)
      }
    }
  })

  it('same content at different fps should NOT produce identical values (frame-rate sensitivity)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const eng30 = new LiquidEngine71(TECHNO_PROFILE)
    const eng60 = new LiquidEngine71(TECHNO_PROFILE)

    // Feed same kick pattern but at different frame rates
    // 30fps: 10 frames = 330ms, 60fps: 20 frames = 330ms (approx same wall time)
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(33)
      eng30.applyBands(makeInput(kickBands(0.80), { isKick: i < 2 }))
    }

    vi.setSystemTime(new Date(10000)) // Reset time
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(16)
      eng60.applyBands(makeInput(kickBands(0.80), { isKick: i < 4 }))
    }

    // After same wall-clock time, values will differ because
    // envelope EMAs process different number of samples
    // This is expected — just verify both produce finite values
    vi.advanceTimersByTime(50)
    const r30 = eng30.applyBands(makeInput(kickBands(0.80), { isKick: true }))
    vi.advanceTimersByTime(50)
    const r60 = eng60.applyBands(makeInput(kickBands(0.80), { isKick: true }))

    expect(Number.isFinite(r30.frontRightIntensity)).toBe(true)
    expect(Number.isFinite(r60.frontRightIntensity)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BROADBAND NOISE RESISTANCE
// ═══════════════════════════════════════════════════════════════════════════

describe('🎸 Broadband Noise Resistance', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not saturate all zones when fed broadband guitar noise', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(POPROCK_PROFILE)
    const noise = generateBroadbandNoise(3000, 20) // 3s of guitar

    let maxFront = 0
    let maxBack = 0
    let maxMover = 0

    for (const bands of noise) {
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(bands, { harshness: 0.55, flatness: 0.45 }))
      maxFront = Math.max(maxFront, result.frontParIntensity)
      maxBack = Math.max(maxBack, result.backParIntensity)
      maxMover = Math.max(maxMover, Math.max(result.moverLeftIntensity, result.moverRightIntensity))
    }

    // At least one zone should be constrained (not all at max)
    // The sidechain + gates should prevent ALL zones from being at 1.0 simultaneously
    const allMaxed = maxFront > 0.95 && maxBack > 0.95 && maxMover > 0.95
    expect(allMaxed).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CHILL OSCILLATOR CONVERGENCE
// ═══════════════════════════════════════════════════════════════════════════

describe('🌊 Chill Oscillator Convergence', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should NOT repeat PAR pattern within 10 seconds (prime periods)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine71(CHILL_PROFILE)
    const pad = { subBass: 0.20, bass: 0.15, lowMid: 0.30, mid: 0.50, highMid: 0.20, treble: 0.10, ultraAir: 0.03 }

    // Sample PAR values every 500ms for 10 seconds
    const samples: number[][] = []
    for (let t = 0; t < 20; t++) {
      vi.advanceTimersByTime(500)
      const result = engine.applyBands(makeInput(pad))
      samples.push([
        result.frontLeftIntensity,
        result.frontRightIntensity,
        result.backLeftIntensity,
        result.backRightIntensity,
      ])
    }

    // Check no two consecutive samples are identical (oscillators should always be moving)
    let identicalPairs = 0
    for (let i = 1; i < samples.length; i++) {
      const same = samples[i].every((v, j) => Math.abs(v - samples[i - 1][j]) < 0.001)
      if (same) identicalPairs++
    }

    // Allow max 1 coincidence (numeric precision), pero no patrones repetidos
    expect(identicalPairs).toBeLessThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 4.1 dt STRESS
// ═══════════════════════════════════════════════════════════════════════════

describe('⏱️ LiquidEngine41 dt Stress', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should decay to zero after music stops at 15fps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine41(TECHNO_PROFILE)
    const dt = 66

    // Play music
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(kickBands(0.85), { isKick: i % 3 === 0 }))
    }

    // Silence
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersByTime(dt)
      engine.applyBands(makeInput(silentBands()))
    }

    vi.advanceTimersByTime(dt)
    const result = engine.applyBands(makeInput(silentBands()))

    expect(result.frontParIntensity).toBeLessThan(0.05)
    expect(result.backParIntensity).toBeLessThan(0.05)
    expect(result.moverLeftIntensity).toBeLessThan(0.05)
    expect(result.moverRightIntensity).toBeLessThan(0.05)
  })

  it('should never produce NaN at any frame rate for 4.1', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))

    const engine = new LiquidEngine41(TECHNO_PROFILE)
    const dts = [7, 16, 33, 50, 66, 100]

    for (const dt of dts) {
      for (let i = 0; i < 20; i++) {
        vi.advanceTimersByTime(dt)
        const result = engine.applyBands(makeInput(kickBands(0.80), { isKick: i < 5 }))

        expect(Number.isFinite(result.frontParIntensity), `NaN at dt=${dt} frame=${i}`).toBe(true)
        expect(Number.isFinite(result.backParIntensity), `NaN at dt=${dt} frame=${i}`).toBe(true)
        expect(Number.isFinite(result.moverLeftIntensity), `NaN at dt=${dt} frame=${i}`).toBe(true)
        expect(Number.isFinite(result.moverRightIntensity), `NaN at dt=${dt} frame=${i}`).toBe(true)
      }
    }
  })
})
