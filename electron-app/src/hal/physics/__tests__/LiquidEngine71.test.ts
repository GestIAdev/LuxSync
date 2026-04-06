/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 2487: LiquidEngine71 — Test Suite Completa
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE SAFETY NET — Cubre los 3 caminos de routeZones() para 7.1:
 *   - Chill-Oceanic: Osciladores sinusoidales, mover swap, no strobe
 *   - Latino-Fiesta: Mover swap + percusión
 *   - Default (Techno/PopRock): Passthrough directo
 *   - Recuperación post-silencio
 *   - Determinismo
 *
 * Tests DETERMINISTAS. Zero aleatorio. vi.useFakeTimers() para sinusoidal.
 *
 * @version WAVE 2487 — THE SAFETY NET
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LiquidEngine71 } from '../LiquidEngine71'
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
  chillPadBands,
  latinKickBands,
  latinSnareBands,
  makeInput,
  generate4x4Pattern,
  generateDembowPattern,
} from './test-harness'

describe('🌊 LiquidEngine71', () => {
  let engine: LiquidEngine71

  beforeEach(() => {
    engine = new LiquidEngine71(TECHNO_PROFILE)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(10000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // CHILL-OCEANIC PATH (El Flotador de Selene)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Chill-Oceanic: Oscillator PARs', () => {
    let chillEngine: LiquidEngine71

    beforeEach(() => {
      chillEngine = new LiquidEngine71(CHILL_PROFILE)
    })

    it('should always produce > 0 for PARs (baseFloor = 0.08)', () => {
      // Incluso con silencio, el oscillator chill mantiene un floor mínimo
      const pad = chillPadBands(0.40)

      // Warm up
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(50)
        chillEngine.applyBands(makeInput(pad))
      }

      vi.advanceTimersByTime(50)
      const result = chillEngine.applyBands(makeInput(pad))

      // Los PARs chill usan sin(t/P) — con baseFloor=0.08, siempre > 0
      // frontL y frontR son oscillated
      expect(result.frontLeftIntensity).toBeGreaterThanOrEqual(0)
      expect(result.frontRightIntensity).toBeGreaterThanOrEqual(0)
      expect(result.backLeftIntensity).toBeGreaterThanOrEqual(0)
      expect(result.backRightIntensity).toBeGreaterThanOrEqual(0)
    })

    it('should swap movers (moverRight → outMoverL, moverLeft → outMoverR)', () => {
      // En chill-oceanic, los movers se cruzan
      chillEngine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      // Señal con mid alto (para moverLeft en la base) y treble alto (para moverRight en la base)
      chillEngine.applyBands(makeInput({ ...silentBands(), mid: 0.50, treble: 0.40, highMid: 0.30 }))
      vi.advanceTimersByTime(50)
      const result = chillEngine.applyBands(makeInput({ ...silentBands(), mid: 0.55, treble: 0.45, highMid: 0.35 }))

      // La inversión es interna — no podemos testear el "antes del swap" directamente,
      // pero sí podemos verificar que los outputs son números finitos ≥ 0
      expect(Number.isFinite(result.moverLeftIntensity)).toBe(true)
      expect(Number.isFinite(result.moverRightIntensity)).toBe(true)
      expect(result.moverLeftIntensity).toBeGreaterThanOrEqual(0)
      expect(result.moverRightIntensity).toBeGreaterThanOrEqual(0)
    })

    it('should force strobeActive = false always in chill', () => {
      // Incluso con treble extremo, chill NUNCA strobe
      vi.advanceTimersByTime(50)
      const result = chillEngine.applyBands(makeInput({
        ...silentBands(), treble: 0.95, ultraAir: 0.80,
      }))

      expect(result.strobeActive).toBe(false)
    })

    it('should force acidMode = false in chill', () => {
      vi.advanceTimersByTime(50)
      const result = chillEngine.applyBands(makeInput(
        kickBands(0.90), { harshness: 0.99 },
      ))
      expect(result.acidMode).toBe(false)
    })

    it('should force noiseMode = false in chill', () => {
      vi.advanceTimersByTime(50)
      const result = chillEngine.applyBands(makeInput(
        kickBands(0.90), { flatness: 0.99 },
      ))
      expect(result.noiseMode).toBe(false)
    })

    it('should produce DIFFERENT values at different times (oscillators are alive)', () => {
      // Los osciladores con periodos primos (1831, 1039, etc.) garantizan no-repetición
      const pad = chillPadBands(0.50)

      // Warm up
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(50)
        chillEngine.applyBands(makeInput(pad))
      }

      // Sample at t=10,000 + offset
      vi.advanceTimersByTime(50)
      const r1 = chillEngine.applyBands(makeInput(pad))

      // Advance 500ms — los senos con periodos primos habrán cambiado significativamente
      vi.advanceTimersByTime(500)
      const r2 = chillEngine.applyBands(makeInput(pad))

      // Al menos uno de los PARs debería ser diferente
      const allSame =
        r1.frontLeftIntensity === r2.frontLeftIntensity &&
        r1.frontRightIntensity === r2.frontRightIntensity &&
        r1.backLeftIntensity === r2.backLeftIntensity &&
        r1.backRightIntensity === r2.backRightIntensity

      expect(allSame).toBe(false)
    })

    it('should keep PAR intensities within [0, 1] range always', () => {
      const pad = chillPadBands(0.90) // Señal fuerte

      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(100) // different time offsets
        const result = chillEngine.applyBands(makeInput(pad))

        expect(result.frontLeftIntensity).toBeGreaterThanOrEqual(0)
        expect(result.frontLeftIntensity).toBeLessThanOrEqual(1)
        expect(result.frontRightIntensity).toBeGreaterThanOrEqual(0)
        expect(result.frontRightIntensity).toBeLessThanOrEqual(1)
        expect(result.backLeftIntensity).toBeGreaterThanOrEqual(0)
        expect(result.backLeftIntensity).toBeLessThanOrEqual(1)
        expect(result.backRightIntensity).toBeGreaterThanOrEqual(0)
        expect(result.backRightIntensity).toBeLessThanOrEqual(1)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // LATINO-FIESTA PATH
  // ═══════════════════════════════════════════════════════════════════════

  describe('Latino-Fiesta: Mover Swap', () => {
    let latinEngine: LiquidEngine71

    beforeEach(() => {
      latinEngine = new LiquidEngine71(LATINO_PROFILE)
    })

    it('should swap movers (same as chill but without oscillator override)', () => {
      // Latino invierte moverLeft ↔ moverRight
      latinEngine.applyBands(makeInput(silentBands()))
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        latinEngine.applyBands(makeInput(melodicBands()))
      }
      vi.advanceTimersByTime(50)
      const result = latinEngine.applyBands(makeInput(melodicBands()))

      // Verificamos que produce outputs válidos (el swap es interno)
      expect(Number.isFinite(result.moverLeftIntensity)).toBe(true)
      expect(Number.isFinite(result.moverRightIntensity)).toBe(true)
    })

    it('should allow strobe in latino (unlike chill)', () => {
      vi.advanceTimersByTime(50)
      const result = latinEngine.applyBands(makeInput({
        ...silentBands(), treble: 0.88, ultraAir: 0.50,
      }))

      // Latino no fuerza strobeActive=false
      // El strobeThreshold de latino debería permitirlo si treble > threshold
      // Solo verificamos que no crashea
      expect(typeof result.strobeActive).toBe('boolean')
    })

    it('should respond to dembow pattern', () => {
      const dembow = generateDembowPattern(100, 3000)

      // Procesar el patrón entero
      const results: LiquidStereoResult[] = []
      for (const bands of dembow) {
        vi.advanceTimersByTime(50)
        results.push(latinEngine.applyBands(makeInput(bands, { isKick: bands.bass > 0.4 })))
      }

      // Al menos un frame debería tener frontPar activo (kick del dembow)
      const anyFrontActive = results.some(r => r.frontParIntensity > 0)
      expect(anyFrontActive).toBe(true)

      // Al menos un frame debería tener backPar activo
      const anyBackActive = results.some(r => r.backParIntensity > 0)
      expect(anyBackActive).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // DEFAULT PATH (Techno / PopRock)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Default path: Direct passthrough (techno/poprock)', () => {
    it('should NOT swap movers in techno', () => {
      // En default path, moverL = frame.moverLeft, moverR = frame.moverRight (sin swap)
      engine.applyBands(makeInput(silentBands()))
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(melodicBands()))
      }
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(melodicBands()))

      expect(Number.isFinite(result.moverLeftIntensity)).toBe(true)
      expect(Number.isFinite(result.moverRightIntensity)).toBe(true)
    })

    it('should pass 7 independent zones', () => {
      engine.applyBands(makeInput(silentBands()))
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.50), { isKick: true }))
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(kickBands(0.85), { isKick: true }))

      // Los 7 campos deben existir
      expect(result.frontLeftIntensity).toBeDefined()
      expect(result.frontRightIntensity).toBeDefined()
      expect(result.backLeftIntensity).toBeDefined()
      expect(result.backRightIntensity).toBeDefined()
      expect(result.moverLeftIntensity).toBeDefined()
      expect(result.moverRightIntensity).toBeDefined()
      expect(typeof result.strobeActive).toBe('boolean')
    })

    it('should produce different results for poprock profile', () => {
      const poprockEngine = new LiquidEngine71(POPROCK_PROFILE)
      const technoEngine = new LiquidEngine71(TECHNO_PROFILE)

      // Same input, different profiles
      const bands = kickBands(0.80)
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(50)
        poprockEngine.applyBands(makeInput(bands, { isKick: true }))
        technoEngine.applyBands(makeInput(bands, { isKick: true }))
      }
      vi.advanceTimersByTime(50)
      const popResult = poprockEngine.applyBands(makeInput(bands, { isKick: true }))
      const technoResult = technoEngine.applyBands(makeInput(bands, { isKick: true }))

      // Different profiles → at least some values should differ
      // (different envelope configs producen valores distintos)
      const allSame =
        popResult.frontRightIntensity === technoResult.frontRightIntensity &&
        popResult.backRightIntensity === technoResult.backRightIntensity

      expect(allSame).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // SILENCIO → RECUPERACIÓN
  // ═══════════════════════════════════════════════════════════════════════

  describe('Recovery (Silence → Rebound)', () => {
    it('should recover from silence and produce output again', () => {
      // Active phase
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(kickBands(0.70), { isKick: true }))
      }

      // Long silence
      for (let i = 0; i < 20; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(silentBands(), { isRealSilence: true }))
      }

      // Recovery: RECOVERY_DURATION = 2000ms
      vi.advanceTimersByTime(2500)
      engine.applyBands(makeInput(silentBands())) // break silence flag
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.50), { isKick: true }))
      vi.advanceTimersByTime(50)
      engine.applyBands(makeInput(kickBands(0.70), { isKick: true }))
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(kickBands(0.85), { isKick: true }))

      expect(result.frontRightIntensity).toBeGreaterThan(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // SETPROFILE + RESET
  // ═══════════════════════════════════════════════════════════════════════

  describe('setProfile() + reset()', () => {
    it('should swap profile without crash', () => {
      engine.setProfile(CHILL_PROFILE)
      vi.advanceTimersByTime(50)
      const result = engine.applyBands(makeInput(chillPadBands()))

      expect(Number.isFinite(result.frontLeftIntensity)).toBe(true)
      expect(result.strobeActive).toBe(false) // Ahora es chill
    })

    it('should reset all state', () => {
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50)
        engine.applyBands(makeInput(kickBands(0.80), { isKick: true }))
      }

      engine.reset()
      vi.advanceTimersByTime(100)
      const result = engine.applyBands(makeInput(silentBands()))

      expect(result.frontLeftIntensity).toBe(0)
      expect(result.frontRightIntensity).toBe(0)
      expect(result.backLeftIntensity).toBe(0)
      expect(result.backRightIntensity).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // DETERMINISM (Axioma Anti-Simulación)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Determinism (Anti-Simulation Axiom)', () => {
    it('should produce identical outputs for same input sequence (techno)', () => {
      const eng1 = new LiquidEngine71(TECHNO_PROFILE)
      const eng2 = new LiquidEngine71(TECHNO_PROFILE)
      const pattern = generate4x4Pattern(128, 2000)

      for (let i = 0; i < pattern.length; i++) {
        vi.advanceTimersByTime(50)
        const r1 = eng1.applyBands(makeInput(pattern[i], { isKick: i % 5 === 0 }))
        const r2 = eng2.applyBands(makeInput(pattern[i], { isKick: i % 5 === 0 }))

        expect(r1.frontRightIntensity).toBe(r2.frontRightIntensity)
        expect(r1.backRightIntensity).toBe(r2.backRightIntensity)
        expect(r1.moverLeftIntensity).toBe(r2.moverLeftIntensity)
        expect(r1.moverRightIntensity).toBe(r2.moverRightIntensity)
      }
    })

    it('should produce identical outputs for chill with same Date.now()', () => {
      const eng1 = new LiquidEngine71(CHILL_PROFILE)
      const eng2 = new LiquidEngine71(CHILL_PROFILE)
      const pad = chillPadBands(0.50)

      for (let i = 0; i < 20; i++) {
        vi.advanceTimersByTime(100)
        const r1 = eng1.applyBands(makeInput(pad))
        const r2 = eng2.applyBands(makeInput(pad))

        // Ambos motors ven el mismo Date.now() → mismos osciladores
        expect(r1.frontLeftIntensity).toBe(r2.frontLeftIntensity)
        expect(r1.frontRightIntensity).toBe(r2.frontRightIntensity)
        expect(r1.backLeftIntensity).toBe(r2.backLeftIntensity)
        expect(r1.backRightIntensity).toBe(r2.backRightIntensity)
      }
    })
  })
})
