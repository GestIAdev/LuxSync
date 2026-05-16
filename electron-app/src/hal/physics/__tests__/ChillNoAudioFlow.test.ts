import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { chillAmbientEngine } from '../ChillAmbientEngine'
import { LiquidEngine71 } from '../LiquidEngine71'
import { CHILL_PROFILE } from '../profiles/chilllounge'
import { makeInput, silentBands } from './test-harness'
import { SeleneLux } from '../../../core/reactivity/SeleneLux'
import type { ColorPalette } from '../../../core/protocol/LightingIntent'

const BASE_PALETTE: ColorPalette = {
  primary: { h: 0.08, s: 0.9, l: 0.5 },
  secondary: { h: 0.12, s: 0.7, l: 0.45 },
  accent: { h: 0.15, s: 0.8, l: 0.55 },
  ambient: { h: 0.52, s: 0.25, l: 0.22 },
}

describe('WAVE 4845 - Chill no-audio flow diagnostics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    chillAmbientEngine.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('Stage A: ChillAmbientEngine must generate autonomous pulse without audio', () => {
    const a = chillAmbientEngine.tick()
    vi.advanceTimersByTime(30000)
    const b = chillAmbientEngine.tick()

    expect(Number.isFinite(a.morphFactor)).toBe(true)
    expect(Number.isFinite(a.dimmer)).toBe(true)
    expect(a.dimmer).toBeGreaterThan(0)
    expect(a.dimmer).toBeLessThan(1)

    expect(Number.isFinite(b.morphFactor)).toBe(true)
    expect(Number.isFinite(b.dimmer)).toBe(true)

    // If this fails, the cut is before L0: no autonomous oscillator output.
    expect(b.dimmer).not.toBe(a.dimmer)
  })

  it('Stage B: LiquidEngine chill profile must output light with silent bands', () => {
    const engine = new LiquidEngine71(CHILL_PROFILE)

    const morph = chillAmbientEngine.tick().morphFactor
    const result = engine.applyBands(
      makeInput(silentBands(), {
        isRealSilence: false,
        isAGCTrap: false,
        morphFactorOverride: morph,
      }),
    )

    const total =
      result.frontLeftIntensity +
      result.frontRightIntensity +
      result.backLeftIntensity +
      result.backRightIntensity +
      result.moverLeftIntensity +
      result.moverRightIntensity +
      result.ambientIntensity

    expect(Number.isFinite(total)).toBe(true)

    // If this fails, the cut is inside LiquidEngine chill rendering.
    expect(total).toBeGreaterThan(0.05)
  })

  it('Stage C: SeleneLux must survive invalid/no-audio metrics in chill vibe', () => {
    const selene = new SeleneLux({ debug: false })
    selene.setActiveProfile('chill-lounge')
    selene.setLiquidLayout('7.1')

    const out = selene.updateFromTitan(
      {
        activeVibe: 'chill-lounge',
        primaryHue: 42,
        stableKey: null,
        bpm: 0,
        section: 'verse',
      },
      BASE_PALETTE,
      {
        normalizedBass: Number.NaN,
        normalizedMid: Number.NaN,
        normalizedTreble: Number.NaN,
        avgNormEnergy: Number.NaN,
        subBass: undefined,
        lowMid: undefined,
        highMid: undefined,
        harshness: Number.NaN,
        spectralFlatness: Number.NaN,
        spectralCentroid: Number.NaN,
        clarity: Number.NaN,
        ultraAir: Number.NaN,
        kickDetected: false,
        snareDetected: false,
        hihatDetected: false,
      },
    )

    const z = out.zoneIntensities
    const sum =
      (z.front ?? 0) +
      (z.back ?? 0) +
      (z.mover ?? 0) +
      (z.frontL ?? 0) +
      (z.frontR ?? 0) +
      (z.backL ?? 0) +
      (z.backR ?? 0) +
      (z.moverL ?? 0) +
      (z.moverR ?? 0)

    expect(out.physicsApplied).toBe('liquid-stereo')
    expect(Number.isFinite(sum)).toBe(true)

    // If this fails, the cut is in SeleneLux/Titan handoff when audio is invalid.
    expect(sum).toBeGreaterThan(0.05)
    expect(out.dimmerOverride).not.toBeNull()
    expect((out.dimmerOverride ?? 0)).toBeGreaterThan(0)
  })
})
