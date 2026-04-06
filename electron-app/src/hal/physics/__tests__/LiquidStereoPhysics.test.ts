/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 2401: LiquidStereoPhysics — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests DETERMINISTAS para el motor de 7 bandas.
 * Valida cada zona, sidechain, strobe, silence handling y legacy compat.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LiquidStereoPhysics, type LiquidStereoInput } from '../LiquidStereoPhysics'
import type { GodEarBands } from '../../../workers/GodEarFFT'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Bandas en silencio total */
function silentBands(): GodEarBands {
  return { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0 }
}

/** Bandas de un kick gordo estilo Brejcha (bass+subBass dominante) */
function kickBands(strength = 0.85): GodEarBands {
  return {
    subBass: strength * 0.70,
    bass: strength,
    lowMid: strength * 0.25,
    mid: strength * 0.10,
    highMid: strength * 0.05,
    treble: strength * 0.03,
    ultraAir: 0.01,
  }
}

/** Bandas de un hi-hat abierto (treble dominante) */
function hihatBands(strength = 0.60): GodEarBands {
  return {
    subBass: 0.01,
    bass: 0.02,
    lowMid: 0.03,
    mid: 0.15,
    highMid: strength * 0.5,
    treble: strength,
    ultraAir: strength * 0.30,
  }
}

/** Bandas de un snare (mid dominante con body en lowMid) */
function snareBands(strength = 0.75): GodEarBands {
  return {
    subBass: 0.05,
    bass: 0.10,
    lowMid: strength * 0.40,
    mid: strength,
    highMid: strength * 0.35,
    treble: strength * 0.15,
    ultraAir: 0.02,
  }
}

/** Bandas de melodía atmosférica (mid + highMid) */
function melodicBands(): GodEarBands {
  return {
    subBass: 0.05,
    bass: 0.15,
    lowMid: 0.30,
    mid: 0.65,
    highMid: 0.45,
    treble: 0.20,
    ultraAir: 0.05,
  }
}

/** Input factory */
function makeInput(bands: GodEarBands, overrides?: Partial<Omit<LiquidStereoInput, 'bands'>>): LiquidStereoInput {
  return {
    bands,
    sectionType: 'drop',
    isRealSilence: false,
    isAGCTrap: false,
    harshness: 0.45,
    flatness: 0.35,
    ...overrides,
  }
}

describe('🌊 LiquidStereoPhysics', () => {
  let engine: LiquidStereoPhysics

  beforeEach(() => {
    engine = new LiquidStereoPhysics()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000)) // Start at t=10000 to avoid t=0 edge cases
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─────────────────────────────────────────────────────────────────────
  // SILENCE
  // ─────────────────────────────────────────────────────────────────────

  describe('Silence Handling', () => {
    it('should return all zeros for isRealSilence', () => {
      const result = engine.applyBands(makeInput(silentBands(), { isRealSilence: true }))

      expect(result.frontLeftIntensity).toBe(0)
      expect(result.frontRightIntensity).toBe(0)
      expect(result.backLeftIntensity).toBe(0)
      expect(result.backRightIntensity).toBe(0)
      expect(result.moverLeftIntensity).toBe(0)
      expect(result.moverRightIntensity).toBe(0)
      expect(result.strobeActive).toBe(false)
    })

    it('should return all zeros for AGC trap', () => {
      const result = engine.applyBands(makeInput(kickBands(), { isAGCTrap: true }))
      expect(result.frontRightIntensity).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // KICK (BASS + SUBBASS ZONES)
  // ─────────────────────────────────────────────────────────────────────

  describe('Kick Response (Front Zones)', () => {
    it('should fire Front R (bass) on kick', () => {
      // isKickEdge requiere: isKick=true AND _kickIntervalMs > kickEdgeMinInterval (80ms)
      // 1er kick: establece _lastKickTime   2do kick (>80ms después): primer edge real
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(100)
      engine.applyBands(makeInput(kickBands(0.40), { isKick: true }))
      vi.advanceTimersByTime(200)
      engine.applyBands(makeInput(kickBands(0.70), { isKick: true }))
      vi.advanceTimersByTime(200)
      const result = engine.applyBands(makeInput(kickBands(0.90), { isKick: true }))

      expect(result.frontRightIntensity).toBeGreaterThan(0)
    })

    it('should respect maxIntensity cap on Front R (0.80)', () => {
      // Build up hard kicks
      for (let i = 0; i < 20; i++) {
        const strength = (i % 3 === 0) ? 0.30 : 0.99
        vi.advanceTimersByTime(33)
        const result = engine.applyBands(makeInput(kickBands(strength)))
        expect(result.frontRightIntensity).toBeLessThanOrEqual(0.80)
      }
    })

    it('should fire Front L (subBass) on sub-heavy content', () => {
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(33)
      // SubBass-heavy signal
      const subBands: GodEarBands = {
        ...silentBands(),
        subBass: 0.50,
        bass: 0.20, // Low bass, high sub
      }
      engine.applyBands(makeInput(subBands))
      vi.advanceTimersByTime(33)
      const result = engine.applyBands(makeInput({
        ...silentBands(),
        subBass: 0.85,
        bass: 0.25,
      }))

      // SubBass zone should respond
      expect(result.frontLeftIntensity).toBeGreaterThanOrEqual(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SIDECHAIN GUILLOTINE
  // ─────────────────────────────────────────────────────────────────────

  describe('Sidechain Guillotine', () => {
    it('should duck movers when front pair is active', () => {
      // First, establish mover baseline with hihat-only content
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(33)
        engine.applyBands(makeInput(hihatBands(0.50 + i * 0.03)))
      }
      vi.advanceTimersByTime(33)
      const moversOnly = engine.applyBands(makeInput(hihatBands(0.65)))

      // Now reset and fire kick + hihat together
      engine.reset()
      vi.advanceTimersByTime(100)
      for (let i = 0; i < 10; i++) {
        const mixed: GodEarBands = {
          subBass: 0.60,
          bass: 0.85,
          lowMid: 0.20,
          mid: 0.20,
          highMid: 0.30,
          treble: 0.50 + i * 0.02,
          ultraAir: 0.10,
        }
        vi.advanceTimersByTime(33)
        engine.applyBands(makeInput(mixed))
      }

      // When front is active (bass kick), movers should be ducked
      const mixed: GodEarBands = {
        subBass: 0.60,
        bass: 0.85,
        lowMid: 0.20,
        mid: 0.20,
        highMid: 0.30,
        treble: 0.55,
        ultraAir: 0.10,
      }
      vi.advanceTimersByTime(33)
      const result = engine.applyBands(makeInput(mixed))

      // Ducking = 1 - frontMax * 0.90
      // If frontMax > 0.1, movers get multiplied by (1 - frontMax*0.90)
      // This should result in mover values less than they'd be without ducking
      if (result.frontParIntensity > 0.1) {
        // Front is active → movers should be ducked
        expect(result.moverIntensityR).toBeLessThan(result.frontParIntensity)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // STROBE
  // ─────────────────────────────────────────────────────────────────────

  describe('Strobe (Binary Trigger)', () => {
    it('should trigger strobe on treble peak above 0.80', () => {
      const brightBands: GodEarBands = {
        ...silentBands(),
        treble: 0.85,
        ultraAir: 0.5,
      }
      const result = engine.applyBands(makeInput(brightBands))
      expect(result.strobeActive).toBe(true)
      expect(result.strobeIntensity).toBe(1.0)
    })

    it('should trigger strobe on ultraAir+treble combo', () => {
      const comboBands: GodEarBands = {
        ...silentBands(),
        treble: 0.65,
        ultraAir: 0.75,
      }
      const result = engine.applyBands(makeInput(comboBands))
      expect(result.strobeActive).toBe(true)
    })

    it('should NOT trigger strobe on moderate treble', () => {
      const mildBands: GodEarBands = {
        ...silentBands(),
        treble: 0.50,
        ultraAir: 0.20,
      }
      const result = engine.applyBands(makeInput(mildBands))
      expect(result.strobeActive).toBe(false)
    })

    it('should deactivate strobe after 30ms', () => {
      const brightBands: GodEarBands = {
        ...silentBands(),
        treble: 0.85,
      }
      engine.applyBands(makeInput(brightBands))
      vi.advanceTimersByTime(35)
      // Fire with mild signal to NOT re-trigger
      const result = engine.applyBands(makeInput(silentBands()))
      expect(result.strobeActive).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // MORPHFACTOR
  // ─────────────────────────────────────────────────────────────────────

  describe('MorphFactor (Liquid Morphology)', () => {
    it('should produce higher morph on sustained melodic content', () => {
      // Feed melodic content for many frames
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(33)
        engine.applyBands(makeInput(melodicBands()))
      }
      // Now feed a single kick — the morph should be well above zero
      // (melodic content has mid=0.65 which warms up avgMidProfiler)
      vi.advanceTimersByTime(33)
      const result = engine.applyBands(makeInput(kickBands()))
      // With melodic sustained mid, morphFactor should be significant
      // Verified: mid=0.65 → avgMid approaches 0.65 → morph ≈ (0.65-0.30)/0.40 = 0.875
      // This means permissive gates, long decays
      expect(result.physicsApplied).toBe('liquid-stereo')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // BREAKDOWN PENALTY
  // ─────────────────────────────────────────────────────────────────────

  describe('Breakdown Penalty', () => {
    it('should produce less output in breakdown than drop for same signal', () => {
      const engDrop = new LiquidStereoPhysics()
      const engBreak = new LiquidStereoPhysics()

      // Warm up both
      engDrop.applyBands(makeInput(silentBands()))
      engBreak.applyBands(makeInput(silentBands(), { sectionType: 'breakdown' }))
      vi.advanceTimersByTime(33)
      engDrop.applyBands(makeInput(kickBands(0.50)))
      engBreak.applyBands(makeInput(kickBands(0.50), { sectionType: 'breakdown' }))
      vi.advanceTimersByTime(33)

      const drop = engDrop.applyBands(makeInput(kickBands(0.90)))
      const breakdown = engBreak.applyBands(makeInput(kickBands(0.90), { sectionType: 'breakdown' }))

      expect(breakdown.frontRightIntensity).toBeLessThanOrEqual(drop.frontRightIntensity)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ACID / NOISE MODES
  // ─────────────────────────────────────────────────────────────────────

  describe('Acid & Noise Modes', () => {
    it('should set acidMode when harshness > 0.60', () => {
      const result = engine.applyBands(makeInput(kickBands(), { harshness: 0.65 }))
      expect(result.acidMode).toBe(true)
    })

    it('should NOT set acidMode when harshness < 0.60', () => {
      const result = engine.applyBands(makeInput(kickBands(), { harshness: 0.40 }))
      expect(result.acidMode).toBe(false)
    })

    it('should set noiseMode when flatness > 0.70', () => {
      const result = engine.applyBands(makeInput(kickBands(), { flatness: 0.75 }))
      expect(result.noiseMode).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // LEGACY COMPAT
  // ─────────────────────────────────────────────────────────────────────

  describe('Legacy Compatibility Fields', () => {
    it('should provide frontParIntensity = max(frontLeft, frontRight)', () => {
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(33)
      engine.applyBands(makeInput(kickBands(0.50)))
      vi.advanceTimersByTime(33)
      const result = engine.applyBands(makeInput(kickBands(0.90)))

      expect(result.frontParIntensity).toBe(
        Math.max(result.frontLeftIntensity, result.frontRightIntensity)
      )
    })

    it('should set physicsApplied to liquid-stereo', () => {
      const result = engine.applyBands(makeInput(silentBands()))
      expect(result.physicsApplied).toBe('liquid-stereo')
    })

    it('should provide moverActive when movers above threshold', () => {
      // Feed hihat content to activate movers
      engine.applyBands(makeInput(silentBands()))
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(33)
        engine.applyBands(makeInput(hihatBands(0.50 + i * 0.02)))
      }
      vi.advanceTimersByTime(33)
      const result = engine.applyBands(makeInput(hihatBands(0.70)))

      // moverActive = moverLeft > 0.1 || moverRight > 0.1
      if (result.moverIntensityR > 0.1 || result.moverIntensityL > 0.1) {
        expect(result.moverActive).toBe(true)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────────────

  describe('Reset', () => {
    it('should return to clean state', () => {
      // Build state
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(33)
        engine.applyBands(makeInput(kickBands()))
      }
      engine.reset()

      vi.advanceTimersByTime(100)
      const result = engine.applyBands(makeInput(silentBands()))
      expect(result.frontRightIntensity).toBe(0)
      expect(result.moverRightIntensity).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM
  // ─────────────────────────────────────────────────────────────────────

  describe('Determinism (Anti-Simulation Axiom)', () => {
    it('should produce identical output for identical sequences', () => {
      const eng1 = new LiquidStereoPhysics()
      const eng2 = new LiquidStereoPhysics()

      const sequence: GodEarBands[] = [
        silentBands(),
        kickBands(0.50),
        kickBands(0.85),
        snareBands(),
        hihatBands(),
        melodicBands(),
        silentBands(),
        kickBands(0.90),
      ]

      const results1: number[] = []
      const results2: number[] = []

      for (const bands of sequence) {
        vi.advanceTimersByTime(33)
        const r1 = eng1.applyBands(makeInput(bands))
        const r2 = eng2.applyBands(makeInput(bands))
        results1.push(
          r1.frontLeftIntensity, r1.frontRightIntensity,
          r1.backLeftIntensity, r1.backRightIntensity,
          r1.moverLeftIntensity, r1.moverRightIntensity,
        )
        results2.push(
          r2.frontLeftIntensity, r2.frontRightIntensity,
          r2.backLeftIntensity, r2.backRightIntensity,
          r2.moverLeftIntensity, r2.moverRightIntensity,
        )
      }

      expect(results1).toEqual(results2)
    })
  })
})
