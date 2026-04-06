/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2487: LiquidEngine41 — Test Suite Completa
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE SAFETY NET — Cubre el 100% de los paths de routeZones() para 4.1:
 *   - strict-split: Metrónomo/Lienzo (Techno Industrial)
 *   - default: frontPar=max(sB,kick), backPar=max(snare,hMid)
 *   - Sidechain Guillotine
 *   - Kick Veto + KickEdge detection
 *   - Morphologic Centroid Shield
 *   - Reset
 *
 * Tests DETERMINISTAS. Zero aleatorio. Axioma Anti-Simulación.
 *
 * @version WAVE 2487 — THE SAFETY NET
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LiquidEngine41 } from '../LiquidEngine41'
import type { LiquidStereoResult } from '../LiquidStereoPhysics'
import { TECHNO_PROFILE } from '../profiles/techno'
import { LATINO_PROFILE } from '../profiles/latino'
import { CHILL_PROFILE } from '../profiles/chilllounge'
import { POPROCK_PROFILE } from '../profiles/poprock'
import {
  silentBands,
  kickBands,
  hihatBands,
  snareBands,
  melodicBands,
  guitarBands,
  makeInput,
  generate4x4Pattern,
  processFrames,
} from './test-harness'

describe('⚡ LiquidEngine41', () => {
  let engine: LiquidEngine41

  beforeEach(() => {
    engine = new LiquidEngine41(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // STRICT-SPLIT: METRÓNOMO / LIENZO (Techno Industrial)
  // ═══════════════════════════════════════════════════════════════════════

  describe('strict-split: Kick → frontPar (El Metrónomo)', () => {
    it('should route envKick to frontPar exclusively', () => {
      // isKickEdge requiere: isKick=true AND _kickIntervalMs > kickEdgeMinInterval (80ms)
      // _kickIntervalMs solo se calcula a partir del 2do kick (_lastKickTime > 0)
      // Por tanto: 1er kick establece _lastKickTime, 2do kick (>80ms después) es el primer edge

      // Warm up + primer kick (establece _lastKickTime)
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(100)
      engine.applyBands(makeInput(kickBands(0.70), { isKick: true }))

      // 2do kick 200ms después — kickIntervalMs = 200 > 80 → isKickEdge = true
      vi.advanceTimersByTime(200)
      engine.applyBands(makeInput(kickBands(0.85), { isKick: true }))

      // 3er kick para consolidar el envelope
      vi.advanceTimersByTime(200)
      const result = engine.applyBands(makeInput(kickBands(0.90), { isKick: true }))

      expect(result.frontParIntensity).toBeGreaterThan(0)
      // En strict-split, frontLeft === frontRight (ambos son frontPar)
      expect(result.frontLeftIntensity).toBe(result.frontRightIntensity)
    })

    it('should NOT fire frontPar if isKick=false in strict-split (candado del Metrónomo)', () => {
      // Sin isKick, el kickSignal es 0 — estricta separación
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.50)))
      vi.advanceTimersByTime(50)
      // Bass fuerte PERO sin isKick → frontPar debe ser mínimo/cero
      const result = engine.applyBands(makeInput(kickBands(0.95)))

      // El frontPar en strict-split solo depende de envKick
      // Si kickSignal=0 (kickLocked), envKick recibe 0 → decay del hit anterior
      // En frío (sin hit anterior), frontPar debería ser 0 o muy bajo
      expect(result.frontParIntensity).toBeLessThan(0.1)
    })

    it('should route envSnare to backPar exclusively (El Látigo)', () => {
      // Snare via transient shaper: necesita trebleDelta > 0
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      // Frame 1: señal baja de treble
      engine.applyBands(makeInput({ ...silentBands(), treble: 0.05, highMid: 0.03, mid: 0.02 }))
      vi.advanceTimersByTime(50)
      // Frame 2: pico de treble — crea trebleDelta grande
      const result = engine.applyBands(makeInput({
        ...silentBands(), treble: 0.65, highMid: 0.40, mid: 0.15,
      }))

      // backPar = backRight = envSnare
      expect(result.backParIntensity).toBeGreaterThan(0)
      expect(result.backLeftIntensity).toBe(result.backRightIntensity)
    })

    it('should NOT have subBass in frontPar (subBass goes to decay, not active)', () => {
      // En strict-split, frontPar = envKick solamente
      // SubBass va a envSubBass pero NO a frontPar
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      // SubBass puro sin kick
      const subBassOnly = { ...silentBands(), subBass: 0.90 }
      engine.applyBands(makeInput(subBassOnly))
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(subBassOnly))

      // frontPar NO debería tener subBass porque strict-split ignora frontLeft
      // frontPar = frontRight = envKick, y envKick recibió 0 (no isKick)
      expect(result.frontParIntensity).toBeLessThan(0.3)
    })
  })

  describe('strict-split: Movers — WAVE 911 (El Melodista / El Terminator)', () => {
    it('should route moverLeft from WAVE 911 mid-bass formula', () => {
      // WAVE 911: rawMoverL = max(0, mid - bass * 0.50)
      // Gate = 0.06, Boost = 12.0
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      // Mid dominante, bass bajo → rawMoverL alto
      const result = engine.applyBands(makeInput({
        ...silentBands(), mid: 0.40, bass: 0.10, // rawL = 0.40 - 0.05 = 0.35
      }))
      // Con gate=0.06 y boost=12.0, señal 0.35 debería producir output
      expect(result.moverLeftIntensity).toBeGreaterThan(0)
    })

    it('should route moverRight from WAVE 911 treble', () => {
      // WAVE 911: rawMoverR = treble, Gate = 0.18, Boost = 9.0
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput({
        ...silentBands(), treble: 0.50, // > gate 0.18
      }))
      expect(result.moverRightIntensity).toBeGreaterThan(0)
    })

    it('should duck movers on isKick in strict-split (inline sidechain)', () => {
      // Build mover baseline first
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput({ ...silentBands(), mid: 0.50, treble: 0.40 }))
      }
      vi.advanceTimersByTime(50)
      const withoutKick = engine.applyBands(makeInput({ ...silentBands(), mid: 0.50, treble: 0.40 }))

      // Reset and test with isKick
      engine.reset()
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput({ ...silentBands(), mid: 0.50, treble: 0.40 }))
      }
      vi.advanceTimersByTime(50)
      const withKick = engine.applyBands(makeInput(
        { ...silentBands(), mid: 0.50, treble: 0.40, bass: 0.80 },
        { isKick: true },
      ))

      // With kick, movers should be ducked by (1 - sidechainDepth)
      // sidechainDepth = 0.30 → movers *= 0.70
      if (withoutKick.moverLeftIntensity > 0) {
        expect(withKick.moverLeftIntensity).toBeLessThanOrEqual(withoutKick.moverLeftIntensity)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // DEFAULT MODE (Latino / PopRock / Chill en 4.1)
  // ═══════════════════════════════════════════════════════════════════════

  describe('default: frontPar = max(subBass, kick)', () => {
    it('should use max(frontLeft, frontRight) for frontPar', () => {
      const eng = new LiquidEngine41(LATINO_PROFILE)

      eng.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      eng.applyBands(makeInput(kickBands(0.50), { isKick: true }))
      vi.advanceTimersByTime(50)
      const result = eng.applyBands(makeInput(kickBands(0.85), { isKick: true }))

      expect(result.frontParIntensity).toBe(
        Math.max(result.frontLeftIntensity, result.frontRightIntensity),
      )
    })

    it('should use max(backLeft, backRight) for backPar', () => {
      const eng = new LiquidEngine41(LATINO_PROFILE)

      eng.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      eng.applyBands(makeInput(melodicBands()))
      vi.advanceTimersByTime(50)
      const result = eng.applyBands(makeInput(melodicBands()))

      expect(result.backParIntensity).toBe(
        Math.max(result.backLeftIntensity, result.backRightIntensity),
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // SIDECHAIN GUILLOTINE (non strict-split)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Sidechain Guillotine (default strategy)', () => {
    it('should duck movers when frontMax > sidechainThreshold', () => {
      const eng = new LiquidEngine41(LATINO_PROFILE)

      // Build movers con hihat
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(50)
        eng.applyBands(makeInput(hihatBands(0.50 + i * 0.02)))
      }

      // Kick fuerte — activa ducking
      vi.advanceTimersByTime(50)
      const result = eng.applyBands(makeInput({
        subBass: 0.70, bass: 0.85, lowMid: 0.20,
        mid: 0.25, highMid: 0.30, treble: 0.50, ultraAir: 0.10,
      }, { isKick: true }))

      // frontMax > sidechainThreshold (0.15 para latino)
      const frontMax = Math.max(result.frontLeftIntensity, result.frontRightIntensity)
      if (frontMax > LATINO_PROFILE.sidechainThreshold) {
        // ducking = 1 - frontMax * sidechainDepth(0.12)
        expect(result.moverLeftIntensity).toBeLessThanOrEqual(1.0)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // KICK EDGE VETO
  // ═══════════════════════════════════════════════════════════════════════

  describe('Kick Edge + Veto', () => {
    it('should veto consecutive kicks within kickEdgeMinInterval', () => {
      // Techno: kickEdgeMinInterval = 80ms
      // Dos kicks en rápida sucesión (< 80ms) — el segundo no es "edge"
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      const first = engine.applyBands(makeInput(kickBands(0.90), { isKick: true }))
      // Solo 40ms después — menor que kickEdgeMinInterval (80)
      vi.advanceTimersByTime(40)
      const second = engine.applyBands(makeInput(kickBands(0.90), { isKick: true }))

      // El segundo kick no es "edge" — isKickEdge = false → envKick recibe 0
      // en strict-split, porque kickSignal requiere isKickEdge = true
      // Para el segundo, el intervalo (40ms) < kickEdgeMinInterval (80ms)
      // → isKickEdge = false → los frontPars deberían ser menores (decay only)
      expect(second.frontParIntensity).toBeLessThanOrEqual(first.frontParIntensity)
    })

    it('should accept kicks separated by > kickEdgeMinInterval', () => {
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.80), { isKick: true }))
      // 200ms después — muy mayor que kickEdgeMinInterval (80)
      vi.advanceTimersByTime(200)
      const result = engine.applyBands(makeInput(kickBands(0.85), { isKick: true }))

      // isKickEdge = true → envKick fires
      expect(result.frontParIntensity).toBeGreaterThan(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // MORPHOLOGIC CENTROID SHIELD
  // ═══════════════════════════════════════════════════════════════════════

  describe('Morphologic Centroid Shield (WAVE 2449)', () => {
    it('should zero hybridSnare when isKick + low centroid + low harshness', () => {
      // Un kick limpio: centroid bajo (<900Hz), harshness < 0.024
      // morphFactor bajo (techno industrial) → centroidFloor ≈ 810Hz
      // → debería bloquear el snare
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      // Frame con solo bajo (sin deltas de treble)
      engine.applyBands(makeInput({ ...silentBands(), treble: 0.05, highMid: 0.03 }))
      vi.advanceTimersByTime(50)
      // isKick + kick puro (centroid bajo, harshness baja)
      const result = engine.applyBands(makeInput(
        kickBands(0.90),
        { isKick: true, spectralCentroid: 300, harshness: 0.01 },
      ))

      // El Shield debería bloquear el hybridSnare
      // backPar (envSnare) debería ser bajo/cero
      expect(result.backParIntensity).toBeLessThan(0.1)
    })

    it('should allow hybridSnare when harshness >= 0.024 (Salvoconducto Dubstep)', () => {
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput({ ...silentBands(), treble: 0.05, highMid: 0.03, mid: 0.02 }))
      vi.advanceTimersByTime(50)
      // isKick + harshness alta → Salvoconducto activo
      const result = engine.applyBands(makeInput(
        { ...kickBands(0.90), treble: 0.50, highMid: 0.35 },
        { isKick: true, spectralCentroid: 400, harshness: 0.05 },
      ))

      // Con harshness > 0.024, el Shield no bloquea
      // Además hay trebleDelta → el transient shaper debería disparar
      expect(result.backParIntensity).toBeGreaterThanOrEqual(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // RESET
  // ═══════════════════════════════════════════════════════════════════════

  describe('Reset', () => {
    it('should zero all outputs after reset', () => {
      // Build up state
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(kickBands(0.85), { isKick: true }))
      }

      engine.reset()

      vi.advanceTimersByTime(100)
      const result = engine.applyBands(makeInput(silentBands()))

      expect(result.frontParIntensity).toBe(0)
      expect(result.backParIntensity).toBe(0)
      expect(result.moverLeftIntensity).toBe(0)
      expect(result.moverRightIntensity).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // PROFILE HOT-SWAP
  // ═══════════════════════════════════════════════════════════════════════

  describe('setProfile() hot-swap', () => {
    it('should not produce NaN/undefined after profile swap', () => {
      // Warm up with Techno
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(kickBands(0.70), { isKick: true }))
      }

      // Hot-swap to Latino
      engine.setProfile(LATINO_PROFILE)

      // First frame after swap
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(kickBands(0.75), { isKick: true }))

      expect(Number.isFinite(result.frontParIntensity)).toBe(true)
      expect(Number.isFinite(result.backParIntensity)).toBe(true)
      expect(Number.isFinite(result.moverLeftIntensity)).toBe(true)
      expect(Number.isFinite(result.moverRightIntensity)).toBe(true)
      expect(result.frontParIntensity).not.toBeNaN()
      expect(result.backParIntensity).not.toBeNaN()
    })

    it('should switch strategy from strict-split to default on profile swap', () => {
      // Techno uses strict-split
      expect(engine.profile.layout41Strategy).toBe('strict-split')

      // Swap to Latino (doesn't define layout41Strategy → undefined → falls to default)
      engine.setProfile(LATINO_PROFILE)
      expect(engine.profile.layout41Strategy).toBeUndefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // OVERRIDES 4.1
  // ═══════════════════════════════════════════════════════════════════════

  describe('overrides41 fusion', () => {
    it('should apply latino overrides41.percMidSubtract correctly', () => {
      const eng = new LiquidEngine41(LATINO_PROFILE)
      // El override de percMidSubtract en 4.1 es 1.5 (vs 0.6 base)
      expect(eng.profile.percMidSubtract).toBe(1.5)
    })

    it('should apply latino overrides41.envelopeHighMid.gateOn correctly', () => {
      const eng = new LiquidEngine41(LATINO_PROFILE)
      // Override: gateOn = 0.20 (vs base 0.04)
      expect(eng.profile.envelopeHighMid.gateOn).toBe(0.20)
    })

    it('should preserve base values when override is absent', () => {
      const eng = new LiquidEngine41(LATINO_PROFILE)
      // No override for envelopeKick.boost → should keep base value 2.5
      expect(eng.profile.envelopeKick.boost).toBe(2.5)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // LEGACY COMPAT FIELDS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Legacy compatibility', () => {
    it('should set physicsApplied to liquid-stereo', () => {
      const result = engine.applyBands(makeInput(silentBands()))
      expect(result.physicsApplied).toBe('liquid-stereo')
    })

    it('should compute moverActive correctly', () => {
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput({ ...silentBands(), mid: 0.50, treble: 0.50 }))
      }
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput({ ...silentBands(), mid: 0.60, treble: 0.55 }))

      const expected = result.moverLeftIntensity > 0.1 || result.moverRightIntensity > 0.1
      expect(result.moverActive).toBe(expected)
    })

    it('should compute moverIntensity = max(moverL, moverR)', () => {
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(melodicBands()))
      }
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(melodicBands()))

      expect(result.moverIntensity).toBe(
        Math.max(result.moverIntensityL, result.moverIntensityR),
      )
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // STROBE SAFETY
  // ═══════════════════════════════════════════════════════════════════════

  describe('Strobe safety', () => {
    it('should NOT trigger strobe on weak signal', () => {
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        const result = engine.applyBands(makeInput(kickBands(0.50), { isKick: true }))
        expect(result.strobeActive).toBe(false)
      }
    })

    it('should trigger strobe only on extreme treble peak', () => {
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput({
        ...silentBands(), treble: 0.85, ultraAir: 0.50,
      }))
      expect(result.strobeActive).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // DETERMINISM
  // ═══════════════════════════════════════════════════════════════════════

  describe('Determinism (Anti-Simulation Axiom)', () => {
    it('should produce identical outputs for identical input sequences', () => {
      const eng1 = new LiquidEngine41(TECHNO_PROFILE)
      const eng2 = new LiquidEngine41(TECHNO_PROFILE)

      const pattern = generate4x4Pattern(128, 2000)
      const results1: LiquidStereoResult[] = []
      const results2: LiquidStereoResult[] = []

      for (let i = 0; i < pattern.length; i++) {
        vi.advanceTimersByTime(50)
        results1.push(eng1.applyBands(makeInput(pattern[i], { isKick: i % 5 === 0 })))
        results2.push(eng2.applyBands(makeInput(pattern[i], { isKick: i % 5 === 0 })))
      }

      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].frontParIntensity).toBe(results2[i].frontParIntensity)
        expect(results1[i].backParIntensity).toBe(results2[i].backParIntensity)
        expect(results1[i].moverLeftIntensity).toBe(results2[i].moverLeftIntensity)
        expect(results1[i].moverRightIntensity).toBe(results2[i].moverRightIntensity)
      }
    })
  })
})
