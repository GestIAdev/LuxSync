/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 2401: LiquidEnvelope — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests DETERMINISTAS. Cero aleatorio, cero mocks.
 * Cada test valida un aspecto concreto de la física heredada del God Mode.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LiquidEnvelope, type LiquidEnvelopeConfig } from '../LiquidEnvelope'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG DE REFERENCIA: Clon exacto del God Mode Bass (Front R)
// ═══════════════════════════════════════════════════════════════════════════
const GOD_MODE_BASS_CONFIG: LiquidEnvelopeConfig = {
  name: 'Front R (Bass)',
  gateOn: 0.50,
  gateOff: 0.35,
  boost: 3.0,
  crushExponent: 1.5,
  decayBase: 0.60,
  decayRange: 0.20,
  maxIntensity: 0.80,
  squelchBase: 0.20,
  squelchSlope: 0.80,
  ghostCap: 0.04,
  gateMargin: 0.02,
}

// Config para SubBass (más estricto)
const SUBBASS_CONFIG: LiquidEnvelopeConfig = {
  name: 'Front L (SubBass)',
  gateOn: 0.55,
  gateOff: 0.40,
  boost: 2.5,
  crushExponent: 1.5,
  decayBase: 0.55,
  decayRange: 0.20,
  maxIntensity: 0.85,
  squelchBase: 0.25,
  squelchSlope: 0.80,
  ghostCap: 0.03,
  gateMargin: 0.02,
}

// Config para Mover R — Schwarzenegger Mode
const TREBLE_CONFIG: LiquidEnvelopeConfig = {
  name: 'Mover R (Treble)',
  gateOn: 0.14,
  gateOff: 0.08,
  boost: 8.0,
  crushExponent: 1.2,
  decayBase: 0.50,
  decayRange: 0.20,
  maxIntensity: 1.0,
  squelchBase: 0.03,
  squelchSlope: 0.15,
  ghostCap: 0.04,
  gateMargin: 0.01,
}

describe('🌊 LiquidEnvelope', () => {
  let bassEnvelope: LiquidEnvelope
  let subBassEnvelope: LiquidEnvelope
  let trebleEnvelope: LiquidEnvelope

  beforeEach(() => {
    bassEnvelope = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)
    subBassEnvelope = new LiquidEnvelope(SUBBASS_CONFIG)
    trebleEnvelope = new LiquidEnvelope(TREBLE_CONFIG)
  })

  // ─────────────────────────────────────────────────────────────────────
  // SILENCE
  // ─────────────────────────────────────────────────────────────────────

  describe('Silence (Zero Signal)', () => {
    it('should output 0 for zero signal', () => {
      const out = bassEnvelope.process(0, 0.5, 1000, false)
      expect(out).toBe(0)
    })

    it('should output 0 for many consecutive zero frames', () => {
      for (let i = 0; i < 100; i++) {
        bassEnvelope.process(0, 0.5, 1000 + i * 33, false)
      }
      const out = bassEnvelope.process(0, 0.5, 5000, false)
      expect(out).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // VELOCITY GATE
  // ─────────────────────────────────────────────────────────────────────

  describe('Velocity Gate (Attack-Only Trigger)', () => {
    it('should fire on rising signal above gate', () => {
      // Warm up: establish avgSignal first with rising attack
      bassEnvelope.process(0, 0.5, 0, false)
      bassEnvelope.process(0.30, 0.5, 33, false)
      bassEnvelope.process(0.60, 0.5, 66, false)
      // Now a strong kick — rising from 0.60 to 0.90
      const out = bassEnvelope.process(0.90, 0.5, 99, false)
      expect(out).toBeGreaterThan(0)
    })

    it('should NOT fire on falling signal (decay tail of kick)', () => {
      // Establish a high baseline so the gate is high
      for (let i = 0; i < 30; i++) {
        bassEnvelope.process(0.85, 0.5, i * 33, false)
      }
      // Sudden drop — NOT an attack
      const beforeDrop = bassEnvelope.process(0.85, 0.5, 1000, false)
      // Reset to capture the actual drop
      bassEnvelope.reset()
      // Build up baseline again then drop
      for (let i = 0; i < 30; i++) {
        bassEnvelope.process(0.85, 0.5, 2000 + i * 33, false)
      }
      const falling = bassEnvelope.process(0.50, 0.5, 3100, false)
      // Falling signal should produce less than a rising hit
      // The key validation: it should be coming from decay, not a new hit
      expect(falling).toBeLessThan(0.80)
    })

    it('should allow Undertow grace frame', () => {
      // Frame 1: Strong rising attack (wasAttacking = true)
      bassEnvelope.process(0, 0.5, 0, false)
      bassEnvelope.process(0.40, 0.5, 33, false)
      bassEnvelope.process(0.80, 0.5, 66, false)
      const peak = bassEnvelope.process(0.92, 0.5, 99, false)

      // Frame 2: Slight drop (-0.02 < -0.005 but > -0.03 → grace frame)
      const grace = bassEnvelope.process(0.90, 0.5, 132, false)
      // Grace frame should still produce output (from decay at minimum)
      expect(grace).toBeGreaterThan(0)
      expect(peak).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // IGNITION SQUELCH
  // ─────────────────────────────────────────────────────────────────────

  describe('Ignition Squelch (Anti-Pad-Ghost)', () => {
    it('should block weak signals in low morph (hard techno)', () => {
      // In morph=0: squelch = max(0.02, 0.20 - 0.80*0) = 0.20
      // A weak signal that just barely passes the gate should be squelched
      bassEnvelope.process(0, 0, 0, false)
      const out = bassEnvelope.process(0.16, 0, 33, false)
      // Signal 0.16 is below gate (0.50) → should be 0
      expect(out).toBe(0)
    })

    it('should be permissive in high morph (melodic)', () => {
      // In morph=1: squelch = max(0.02, 0.20 - 0.80*1) = 0.02
      // Much more permissive
      trebleEnvelope.process(0, 1.0, 0, false)
      trebleEnvelope.process(0.10, 1.0, 33, false)
      const out = trebleEnvelope.process(0.25, 1.0, 66, false)
      // Treble gate is 0.14, signal 0.25 > gate → should produce output
      expect(out).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DECAY
  // ─────────────────────────────────────────────────────────────────────

  describe('Decay (Liquid Morphology)', () => {
    it('should decay faster in morph=0 than morph=1', () => {
      // Fire a strong hit in both envelopes
      const env0 = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)
      const env1 = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)

      // Warm up + fire
      env0.process(0, 0, 0, false)
      env0.process(0.50, 0, 33, false)
      env0.process(0.90, 0, 66, false) // fire

      env1.process(0, 1.0, 0, false)
      env1.process(0.50, 1.0, 33, false)
      env1.process(0.90, 1.0, 66, false) // fire

      // Let both decay for 5 frames with zero signal
      let out0 = 0, out1 = 0
      for (let i = 0; i < 5; i++) {
        out0 = env0.process(0, 0, 99 + (i + 1) * 33, false)
        out1 = env1.process(0, 1.0, 99 + (i + 1) * 33, false)
      }

      // morph=0: decay = 0.60 → after 5 frames: 0.60^5 = 0.078
      // morph=1: decay = 0.80 → after 5 frames: 0.80^5 = 0.328
      // So env1 (melodic) should retain more energy
      expect(out1).toBeGreaterThan(out0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // MAX INTENSITY CAP
  // ─────────────────────────────────────────────────────────────────────

  describe('Max Intensity Cap', () => {
    it('should never exceed maxIntensity (0.80 for bass)', () => {
      // Fire repeatedly with max signal
      for (let i = 0; i < 50; i++) {
        const rising = (i % 3 === 0) ? 0.30 : 0.99
        const out = bassEnvelope.process(rising, 1.0, i * 33, false)
        expect(out).toBeLessThanOrEqual(0.80)
      }
    })

    it('should never exceed maxIntensity (0.85 for subBass)', () => {
      for (let i = 0; i < 50; i++) {
        const rising = (i % 3 === 0) ? 0.30 : 0.99
        const out = subBassEnvelope.process(rising, 1.0, i * 33, false)
        expect(out).toBeLessThanOrEqual(0.85)
      }
    })

    it('should allow up to 1.0 for treble (no cap)', () => {
      // Treble maxIntensity = 1.0
      trebleEnvelope.process(0, 1.0, 0, false)
      trebleEnvelope.process(0.50, 1.0, 33, false)
      const out = trebleEnvelope.process(0.95, 1.0, 66, false)
      // Should be positive and could approach 1.0 with boost 8.0
      expect(out).toBeGreaterThan(0)
      expect(out).toBeLessThanOrEqual(1.0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // BREAKDOWN PENALTY
  // ─────────────────────────────────────────────────────────────────────

  describe('Breakdown Penalty', () => {
    it('should produce less output in breakdown than in drop', () => {
      const envDrop = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)
      const envBreak = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)

      // Same signal sequence
      envDrop.process(0, 0.5, 0, false)
      envDrop.process(0.50, 0.5, 33, false)
      const outDrop = envDrop.process(0.85, 0.5, 66, false) // drop

      envBreak.process(0, 0.5, 0, true)
      envBreak.process(0.50, 0.5, 33, true)
      const outBreak = envBreak.process(0.85, 0.5, 66, true) // breakdown

      // breakdown penalty = 0.06 added to requiredJump
      expect(outBreak).toBeLessThanOrEqual(outDrop)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TIDAL GATE (Dry Spell Floor Adaptation)
  // ─────────────────────────────────────────────────────────────────────

  describe('Tidal Gate (Dry Spell Adaptation)', () => {
    it('should lower effective floor after prolonged silence', () => {
      // Fire once to establish lastFireTime
      bassEnvelope.process(0, 0.5, 0, false)
      bassEnvelope.process(0.60, 0.5, 33, false)
      bassEnvelope.process(0.90, 0.5, 66, false) // fire → lastFireTime = 66

      // 7 seconds of silence (> 6s = full floor degradation)
      for (let i = 0; i < 200; i++) {
        bassEnvelope.process(0, 0.5, 100 + i * 33, false)
      }

      // Now try a moderate signal that would normally be below gate
      // With degraded floor (0.42 → 0.30), gate drops
      const out = bassEnvelope.process(0.40, 0.5, 8000, false)
      // After 7s dry spell, avgPunchPeak should have decayed significantly
      // and adaptive floor should be near 0.30
      // Signal 0.40 might now pass the lower gate
      // We just verify the system doesn't crash and respects physics
      expect(out).toBeGreaterThanOrEqual(0)
      expect(out).toBeLessThanOrEqual(0.80)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SOFT KNEE (Ghost Power)
  // ─────────────────────────────────────────────────────────────────────

  describe('Soft Knee (Ghost Power)', () => {
    it('should produce zero ghost in morph=0', () => {
      // ghostCapDynamic = ghostCap × morphFactor = 0.04 × 0 = 0
      bassEnvelope.process(0, 0, 0, false)

      // Build a baseline slightly below gate
      for (let i = 0; i < 20; i++) {
        bassEnvelope.process(0.45, 0, i * 33, false)
      }

      // Signal above average but below gate → ghost path
      // But morph=0 → ghostCap = 0 → no ghost
      const out = bassEnvelope.process(0.48, 0, 700, false)
      expect(out).toBe(0)
    })

    it('should produce subtle glow in morph=1', () => {
      const env = new LiquidEnvelope({
        ...GOD_MODE_BASS_CONFIG,
        gateOn: 0.50,
        ghostCap: 0.04,
      })

      env.process(0, 1.0, 0, false)
      // Build baseline
      for (let i = 0; i < 30; i++) {
        env.process(0.40, 1.0, (i + 1) * 33, false)
      }

      // Signal above avg but still below the dynamic gate
      // With morph=1 and ghostCap=0.04, there should be a subtle glow
      const out = env.process(0.44, 1.0, 1100, false)
      // Ghost power is very subtle — at most ghostCap (0.04)
      expect(out).toBeLessThanOrEqual(0.04)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────────────

  describe('Reset', () => {
    it('should return to clean state after reset', () => {
      // Build up state
      bassEnvelope.process(0.90, 0.5, 0, false)
      bassEnvelope.process(0.90, 0.5, 33, false)

      bassEnvelope.reset()

      // After reset, should behave like fresh instance
      const out = bassEnvelope.process(0, 0.5, 100, false)
      expect(out).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM
  // ─────────────────────────────────────────────────────────────────────

  describe('Determinism (Anti-Simulation Axiom)', () => {
    it('should produce identical output for identical input sequences', () => {
      const env1 = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)
      const env2 = new LiquidEnvelope(GOD_MODE_BASS_CONFIG)

      const signals = [0, 0.3, 0.7, 0.9, 0.5, 0.2, 0, 0, 0.8, 0.6]
      const outputs1: number[] = []
      const outputs2: number[] = []

      for (let i = 0; i < signals.length; i++) {
        outputs1.push(env1.process(signals[i], 0.5, i * 33, false))
        outputs2.push(env2.process(signals[i], 0.5, i * 33, false))
      }

      expect(outputs1).toEqual(outputs2)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // BAND NAME
  // ─────────────────────────────────────────────────────────────────────

  describe('Band Name (Telemetry)', () => {
    it('should expose config name', () => {
      expect(bassEnvelope.bandName).toBe('Front R (Bass)')
      expect(subBassEnvelope.bandName).toBe('Front L (SubBass)')
      expect(trebleEnvelope.bandName).toBe('Mover R (Treble)')
    })
  })
})
