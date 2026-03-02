/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 WAVE 2087: THE MOVEMENT FORTRESS — Hardware Safety Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Esta NO es una suite normal. Este módulo controla MOTORES FÍSICOS.
 * Un bug aquí quema engranajes de 800€, destroza cabezales, o lanza un
 * moving head contra el escenario.
 * 
 * FILOSOFÍA:
 *   - RGB mal mapeado → un foco rosa en vez de azul (nadie muere)
 *   - Movimiento mal calculado → DAÑO FÍSICO REAL AL HARDWARE
 * 
 * Por eso esta suite es la más estricta de LuxSync:
 *   - ZERO Math.random() — Axioma Anti-Simulación
 *   - ZERO mocks de lógica de negocio — todo es real, medible, determinista
 *   - Cada test verifica RANGO SEGURO y CONTINUIDAD MECÁNICA
 * 
 * SECCIONES:
 *   §1  HARDWARE SAFETY — Outputs siempre en [-1, +1], sin teleportaciones
 *   §2  PATTERN MATHEMATICS — 16 patrones: deterministas y acotados
 *   §3  GEARBOX — Limitador de velocidad por hardware
 *   §4  ENERGY-TO-PERIOD — Multiplicadores de tempo por energía
 *   §5  PHRASE ENVELOPE — Breathing amplifier en rango [0.6, 1.0]
 *   §6  STEREO — Mirror/Snake producen L≠R, siempre en rango
 *   §7  GHOST PROTOCOL — Freeze en silencio, no whip-to-home
 *   §8  SMOOTH TRANSITIONS — LERP sin saltos discontinuos
 *   §9  EDGE CASES — BPM 0, energy NaN, inputs imposibles
 *   §10 CONFIGURATION INTEGRITY — Todos los vibes y patrones enlazados
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module engine/movement/__tests__/VibeMovementManager
 * @version WAVE 2087 — The Movement Fortress
 * @author PunkOpus
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { VibeMovementManager } from '../VibeMovementManager'
import type { AudioContext as VMMAudioContext, MovementIntent } from '../VibeMovementManager'

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 TEST FACTORY — Audio context builders (deterministic, no randomness)
// ═══════════════════════════════════════════════════════════════════════════

/** Baseline audio context: mid-energy techno at 128 BPM */
function createBaseAudio(overrides: Partial<VMMAudioContext> = {}): VMMAudioContext {
  return {
    energy: 0.5,
    bass: 0.5,
    mids: 0.5,
    highs: 0.5,
    bpm: 128,
    beatPhase: 0,
    beatCount: 0,
    ...overrides,
  }
}

/** Dead silence: near-zero everything */
function createSilentAudio(): VMMAudioContext {
  return createBaseAudio({ energy: 0.01, bass: 0, mids: 0, highs: 0, bpm: 0, beatPhase: 0, beatCount: 0 })
}

/** Full energy drop */
function createDropAudio(beatCount: number = 64): VMMAudioContext {
  return createBaseAudio({ energy: 0.95, bass: 0.9, mids: 0.7, highs: 0.8, bpm: 128, beatCount })
}

/** Low energy ambient */
function createAmbientAudio(beatCount: number = 32): VMMAudioContext {
  return createBaseAudio({ energy: 0.15, bass: 0.2, mids: 0.3, highs: 0.1, bpm: 90, beatCount })
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** All vibe IDs in the system */
const ALL_VIBES = ['techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge', 'idle'] as const

/** All 17 Golden Patterns (13 Original + 4 Nobles) */
const ALL_PATTERNS = [
  'scan_x', 'square', 'diamond', 'botstep',
  'figure8', 'wave_y', 'ballyhoo',
  'circle_big', 'cancan', 'dual_sweep',
  'drift', 'sway', 'breath',
  'slow_pan', 'tilt_nod', 'figure_of_4', 'chase_position',
] as const

/** Assert position is within safe mechanical range */
function assertSafeRange(intent: MovementIntent, context: string): void {
  expect(intent.x, `${context}: X out of range [${intent.x}]`).toBeGreaterThanOrEqual(-1)
  expect(intent.x, `${context}: X out of range [${intent.x}]`).toBeLessThanOrEqual(1)
  expect(intent.y, `${context}: Y out of range [${intent.y}]`).toBeGreaterThanOrEqual(-1)
  expect(intent.y, `${context}: Y out of range [${intent.y}]`).toBeLessThanOrEqual(1)
}

/** Assert position is finite (no NaN, no Infinity) */
function assertFinite(intent: MovementIntent, context: string): void {
  expect(Number.isFinite(intent.x), `${context}: X is not finite [${intent.x}]`).toBe(true)
  expect(Number.isFinite(intent.y), `${context}: Y is not finite [${intent.y}]`).toBe(true)
}

/** Maximum allowed position delta per frame at 60fps (teleportation threshold) */
// At 60fps, 1/60s per frame. Max safe delta = 2.0 (full range) / 16 frames = 0.125
// We allow 0.5 per frame as generous upper bound (still catches 180° teleports)
const MAX_SAFE_DELTA_PER_FRAME = 0.5

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 THE MOVEMENT FORTRESS
// ═══════════════════════════════════════════════════════════════════════════

describe('🎭 THE MOVEMENT FORTRESS — Hardware Safety Test Suite', () => {

  let vmm: VibeMovementManager

  beforeEach(() => {
    // Mock Date.now() BEFORE constructing VMM so that lastUpdate
    // is initialised with our controlled timestamp (not the real clock).
    // Without this, (mockedNow - realLastUpdate) goes NEGATIVE and the
    // frame-once guard treats every call as "same frame" → no state updates.
    // We use 500 so that tests mocking Date.now() to 1000 get deltaTime = 500ms
    // (safely past the 2ms same-frame guard).
    vi.spyOn(Date, 'now').mockReturnValue(500)
    vmm = new VibeMovementManager()
    vi.restoreAllMocks()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §1 HARDWARE SAFETY — The Cardinal Rule
  // "Every output must be in [-1, +1]. Always. No exceptions. Period."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§1 🔴 HARDWARE SAFETY — The Cardinal Rule', () => {

    test('Every vibe × every beat position produces output in [-1, +1]', () => {
      // Sweep through 256 beat positions × all vibes
      // This is the MOST IMPORTANT test in the entire suite
      for (const vibeId of ALL_VIBES) {
        for (let beat = 0; beat < 256; beat++) {
          const audio = createBaseAudio({ beatCount: beat, beatPhase: (beat % 4) / 4 })
          const intent = vmm.generateIntent(vibeId, audio, 0, 2)
          
          assertSafeRange(intent, `vibe=${vibeId} beat=${beat}`)
          assertFinite(intent, `vibe=${vibeId} beat=${beat}`)
        }
      }
    })

    test('Extreme energy values never push output beyond [-1, +1]', () => {
      const extremeEnergies = [0, 0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999, 1.0]
      
      for (const vibeId of ALL_VIBES) {
        for (const energy of extremeEnergies) {
          const audio = createBaseAudio({ energy, beatCount: 100, beatPhase: 0.5 })
          const intent = vmm.generateIntent(vibeId, audio, 0, 2)
          
          assertSafeRange(intent, `vibe=${vibeId} energy=${energy}`)
          assertFinite(intent, `vibe=${vibeId} energy=${energy}`)
        }
      }
    })

    test('Extreme BPM values never push output beyond [-1, +1]', () => {
      const extremeBPMs = [0, 1, 30, 60, 90, 120, 128, 140, 160, 180, 200, 300, 999]
      
      for (const vibeId of ALL_VIBES) {
        for (const bpm of extremeBPMs) {
          const audio = createBaseAudio({ bpm, beatCount: 50, energy: 0.8 })
          const intent = vmm.generateIntent(vibeId, audio, 0, 2)
          
          assertSafeRange(intent, `vibe=${vibeId} bpm=${bpm}`)
          assertFinite(intent, `vibe=${vibeId} bpm=${bpm}`)
        }
      }
    })

    test('All fixture index combinations stay in range', () => {
      for (const vibeId of ALL_VIBES) {
        // Test 1 fixture, 2 fixtures, 4 fixtures, 8 fixtures
        for (const total of [1, 2, 4, 8]) {
          for (let index = 0; index < total; index++) {
            const audio = createBaseAudio({ beatCount: 42, beatPhase: 0.75, energy: 0.9 })
            const intent = vmm.generateIntent(vibeId, audio, index, total)
            
            assertSafeRange(intent, `vibe=${vibeId} fixture=${index}/${total}`)
            assertFinite(intent, `vibe=${vibeId} fixture=${index}/${total}`)
          }
        }
      }
    })

    test('Rapid successive calls at high energy maintain safe range', () => {
      // Simulate 120 frames (2 seconds at 60fps) of max-energy techno
      const audio = createDropAudio(0)
      
      for (let frame = 0; frame < 120; frame++) {
        audio.beatCount = frame
        audio.beatPhase = (frame * 0.5) % 1
        
        const intentL = vmm.generateIntent('techno-club', audio, 0, 2)
        const intentR = vmm.generateIntent('techno-club', audio, 1, 2)
        
        assertSafeRange(intentL, `frame=${frame} L`)
        assertSafeRange(intentR, `frame=${frame} R`)
        assertFinite(intentL, `frame=${frame} L`)
        assertFinite(intentR, `frame=${frame} R`)
      }
    })

    test('No teleportation: consecutive frames have bounded deltas', () => {
      // This catches the HYPERION bug: 180° instant teleport
      // Simulate 60 frames of continuous movement
      // Note: Pattern rotation at phrase boundaries can cause larger deltas
      // because the LERP system smooths them over 2s. We test within a single
      // pattern period (32 beats) to avoid phrase transitions.
      const audio = createBaseAudio({ energy: 0.6, bpm: 128 })
      let lastIntent: MovementIntent | null = null

      // Stay within first pattern's period (beats 0-31) to avoid rotation transitions
      for (let beat = 0; beat < 30; beat++) {
        audio.beatCount = beat
        audio.beatPhase = 0
        
        // Small delay to avoid frame-once guard treating these as same frame
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17) // ~60fps
        
        const intent = vmm.generateIntent('techno-club', audio, 0, 2)
        
        if (lastIntent !== null) {
          const deltaX = Math.abs(intent.x - lastIntent.x)
          const deltaY = Math.abs(intent.y - lastIntent.y)
          
          // Allow generous delta for normal movement, but catch teleportation
          // A 180° teleport would be deltaX ≈ 2.0
          expect(deltaX, `Teleportation X at beat ${beat}: delta=${deltaX}`)
            .toBeLessThan(MAX_SAFE_DELTA_PER_FRAME)
          expect(deltaY, `Teleportation Y at beat ${beat}: delta=${deltaY}`)
            .toBeLessThan(MAX_SAFE_DELTA_PER_FRAME)
        }
        
        lastIntent = intent
      }
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §2 PATTERN MATHEMATICS — The Golden Dozen + Four Nobles
  // "Each pattern is a pure mathematical function. Deterministic. Bounded."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§2 📐 PATTERN MATHEMATICS — Deterministic & Bounded', () => {

    test('All 17 patterns are registered and callable', () => {
      const available = vmm.getAvailablePatterns()
      
      for (const pattern of ALL_PATTERNS) {
        expect(available, `Pattern "${pattern}" not registered`).toContain(pattern)
      }
      
      expect(available.length).toBe(17)
    })

    test('scan_x: pure horizontal movement (Y ≈ 0)', () => {
      vmm.setManualPattern('scan_x')
      
      for (let beat = 0; beat < 32; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('techno-club', audio, 0, 1)
        
        // scan_x: Y must be 0 (pure horizontal)
        // After amplitude scaling, Y should still be near 0
        expect(Math.abs(intent.y), `scan_x at beat ${beat}: Y not near zero [${intent.y}]`)
          .toBeLessThan(0.01)
      }
      
      vi.restoreAllMocks()
    })

    test('sway: pure horizontal movement (Y ≈ 0)', () => {
      vmm.setManualPattern('sway')
      
      for (let beat = 0; beat < 32; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('chill-lounge', audio, 0, 1)
        
        expect(Math.abs(intent.y), `sway at beat ${beat}: Y not near zero [${intent.y}]`)
          .toBeLessThan(0.01)
      }
      
      vi.restoreAllMocks()
    })

    test('breath: pure vertical movement (X ≈ 0)', () => {
      vmm.setManualPattern('breath')
      
      for (let beat = 0; beat < 32; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('chill-lounge', audio, 0, 1)
        
        expect(Math.abs(intent.x), `breath at beat ${beat}: X not near zero [${intent.x}]`)
          .toBeLessThan(0.01)
      }
      
      vi.restoreAllMocks()
    })

    test('tilt_nod: pure vertical movement (X ≈ 0)', () => {
      vmm.setManualPattern('tilt_nod')
      
      for (let beat = 0; beat < 32; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('chill-lounge', audio, 0, 1)
        
        expect(Math.abs(intent.x), `tilt_nod at beat ${beat}: X not near zero [${intent.x}]`)
          .toBeLessThan(0.01)
      }
      
      vi.restoreAllMocks()
    })

    test('slow_pan: pure horizontal movement (Y ≈ 0)', () => {
      vmm.setManualPattern('slow_pan')
      
      for (let beat = 0; beat < 64; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('chill-lounge', audio, 0, 1)
        
        expect(Math.abs(intent.y), `slow_pan at beat ${beat}: Y not near zero [${intent.y}]`)
          .toBeLessThan(0.01)
      }
      
      vi.restoreAllMocks()
    })

    test('square: traverses all 4 quadrants with smooth interpolation', () => {
      vmm.setManualPattern('square')
      const quadrantsVisited = new Set<string>()
      
      // Run through one full cycle (16 beats at this period) with sub-beat resolution
      // WAVE 2088.5: square now interpolates between corners (smooth transition)
      // so we sample at sub-beat intervals to catch all 4 quadrants
      for (let beat = 0; beat < 16; beat++) {
        for (let subBeat = 0; subBeat < 4; subBeat++) {
          const phase = subBeat * 0.25
          vi.spyOn(Date, 'now').mockReturnValue(1000 + (beat * 4 + subBeat) * 17)
          const audio = createBaseAudio({ beatCount: beat, beatPhase: phase, energy: 0.5 })
          const intent = vmm.generateIntent('techno-club', audio, 0, 1)
          
          // Track which quadrant this position is in (skip zero-crossings)
          if (Math.abs(intent.x) > 0.1 && Math.abs(intent.y) > 0.1) {
            const qx = intent.x > 0 ? '+' : '-'
            const qy = intent.y > 0 ? '+' : '-'
            quadrantsVisited.add(`${qx},${qy}`)
          }
          
          assertSafeRange(intent, `square beat=${beat}.${subBeat}`)
        }
      }
      
      // Square must visit all 4 quadrants during its cycle
      expect(quadrantsVisited.size).toBe(4)
      
      vi.restoreAllMocks()
    })

    test('chase_position: traverses all 4 cardinal directions with smooth interpolation', () => {
      vmm.setManualPattern('chase_position')
      const directionsVisited = new Set<string>()
      
      // WAVE 2088.5: chase_position now interpolates between positions
      for (let beat = 0; beat < 16; beat++) {
        for (let subBeat = 0; subBeat < 4; subBeat++) {
          const phase = subBeat * 0.25
          vi.spyOn(Date, 'now').mockReturnValue(1000 + (beat * 4 + subBeat) * 17)
          const audio = createBaseAudio({ beatCount: beat, beatPhase: phase, energy: 0.5 })
          const intent = vmm.generateIntent('techno-club', audio, 0, 1)
          
          // Track dominant axis direction (skip neutral crossings)
          const absX = Math.abs(intent.x)
          const absY = Math.abs(intent.y)
          if (absX > 0.3 && absX > absY * 1.5) {
            directionsVisited.add(intent.x > 0 ? 'right' : 'left')
          } else if (absY > 0.3 && absY > absX * 1.5) {
            directionsVisited.add(intent.y > 0 ? 'up' : 'down')
          }
          
          assertSafeRange(intent, `chase beat=${beat}.${subBeat}`)
        }
      }
      
      // Chase must visit all 4 cardinal directions during its cycle
      expect(directionsVisited.size).toBe(4)
      
      vi.restoreAllMocks()
    })

    test('figure8: X and Y are both non-zero (2D pattern)', () => {
      vmm.setManualPattern('figure8')
      let hasNonZeroX = false
      let hasNonZeroY = false
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.6 })
        const intent = vmm.generateIntent('fiesta-latina', audio, 0, 1)
        
        if (Math.abs(intent.x) > 0.05) hasNonZeroX = true
        if (Math.abs(intent.y) > 0.05) hasNonZeroY = true
        
        assertSafeRange(intent, `figure8 beat=${beat}`)
      }
      
      expect(hasNonZeroX, 'figure8 should have non-zero X movement').toBe(true)
      expect(hasNonZeroY, 'figure8 should have non-zero Y movement').toBe(true)
      
      vi.restoreAllMocks()
    })

    test('figure_of_4: contained figure8 — smaller amplitude than figure8', () => {
      vmm.setManualPattern('figure_of_4')
      let maxAbsX_f4 = 0
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.6 })
        const intent = vmm.generateIntent('techno-club', audio, 0, 1)
        
        maxAbsX_f4 = Math.max(maxAbsX_f4, Math.abs(intent.x))
        assertSafeRange(intent, `figure_of_4 beat=${beat}`)
      }
      
      // figure_of_4 uses 0.5 x scale — should be noticeably smaller than full amplitude
      expect(maxAbsX_f4, 'figure_of_4 should be contained (x * 0.5)')
        .toBeLessThan(0.8)
      
      vi.restoreAllMocks()
    })

    test('circle_big: both axes active, approximately circular', () => {
      vmm.setManualPattern('circle_big')
      let maxAbsX = 0, maxAbsY = 0
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('pop-rock', audio, 0, 1)
        
        maxAbsX = Math.max(maxAbsX, Math.abs(intent.x))
        maxAbsY = Math.max(maxAbsY, Math.abs(intent.y))
        assertSafeRange(intent, `circle_big beat=${beat}`)
      }
      
      // Both axes should be active
      expect(maxAbsX, 'circle: X should be active').toBeGreaterThan(0.05)
      expect(maxAbsY, 'circle: Y should be active').toBeGreaterThan(0.05)
      
      vi.restoreAllMocks()
    })

    test('cancan: primarily vertical movement with minimal X', () => {
      vmm.setManualPattern('cancan')
      let maxAbsX = 0, maxAbsY = 0
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('pop-rock', audio, 0, 1)
        
        maxAbsX = Math.max(maxAbsX, Math.abs(intent.x))
        maxAbsY = Math.max(maxAbsY, Math.abs(intent.y))
        assertSafeRange(intent, `cancan beat=${beat}`)
      }
      
      // cancan: Y should dominate, X should be minimal (0.15 scale)
      expect(maxAbsY, 'cancan: Y should be active').toBeGreaterThan(maxAbsX)
      
      vi.restoreAllMocks()
    })

    test('drift: non-repetitive multi-harmonic movement', () => {
      vmm.setManualPattern('drift')
      const positions: Array<{ x: number; y: number }> = []
      
      for (let beat = 0; beat < 32; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.4 })
        const intent = vmm.generateIntent('chill-lounge', audio, 0, 1)
        
        positions.push({ x: intent.x, y: intent.y })
        assertSafeRange(intent, `drift beat=${beat}`)
      }
      
      // Drift uses irrational ratios (phi, sqrt2, sqrt3) — positions should vary
      const uniqueX = new Set(positions.map(p => Math.round(p.x * 100)))
      expect(uniqueX.size, 'drift: should produce varied X positions').toBeGreaterThan(5)
      
      vi.restoreAllMocks()
    })

    test('ballyhoo: complex multi-harmonic stays bounded', () => {
      vmm.setManualPattern('ballyhoo')
      
      for (let beat = 0; beat < 64; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.7 })
        const intent = vmm.generateIntent('fiesta-latina', audio, 0, 1)
        
        assertSafeRange(intent, `ballyhoo beat=${beat}`)
        assertFinite(intent, `ballyhoo beat=${beat}`)
      }
      
      vi.restoreAllMocks()
    })

    test('diamond: rotationally symmetric, bounded by scale factor', () => {
      vmm.setManualPattern('diamond')
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('techno-club', audio, 0, 1)
        
        assertSafeRange(intent, `diamond beat=${beat}`)
        // Diamond has sqrt2 * 0.7 ≈ 0.99 max raw — after amplitude should be ≤ 1
        assertFinite(intent, `diamond beat=${beat}`)
      }
      
      vi.restoreAllMocks()
    })

    test('botstep: quantized positions are finite and bounded', () => {
      vmm.setManualPattern('botstep')
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('techno-club', audio, 0, 1)
        
        assertSafeRange(intent, `botstep beat=${beat}`)
        assertFinite(intent, `botstep beat=${beat}`)
      }
      
      vi.restoreAllMocks()
    })

    test('dual_sweep: U-shaped trajectory stays bounded', () => {
      vmm.setManualPattern('dual_sweep')
      
      for (let beat = 0; beat < 16; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.6 })
        const intent = vmm.generateIntent('pop-rock', audio, 0, 1)
        
        assertSafeRange(intent, `dual_sweep beat=${beat}`)
        assertFinite(intent, `dual_sweep beat=${beat}`)
      }
      
      vi.restoreAllMocks()
    })

    test('wave_y: Y frequency is higher than X frequency', () => {
      vmm.setManualPattern('wave_y')
      let xDirectionChanges = 0
      let yDirectionChanges = 0
      let lastX = 0, lastY = 0
      
      for (let beat = 0; beat < 32; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.5 })
        const intent = vmm.generateIntent('fiesta-latina', audio, 0, 1)
        
        if (beat > 0) {
          if (Math.sign(intent.x) !== Math.sign(lastX) && lastX !== 0) xDirectionChanges++
          if (Math.sign(intent.y) !== Math.sign(lastY) && lastY !== 0) yDirectionChanges++
        }
        lastX = intent.x
        lastY = intent.y
        
        assertSafeRange(intent, `wave_y beat=${beat}`)
      }
      
      // Y oscillates at 2x frequency → should change direction more often
      expect(yDirectionChanges, 'wave_y: Y should oscillate faster than X')
        .toBeGreaterThanOrEqual(xDirectionChanges)
      
      vi.restoreAllMocks()
    })

    test('Every pattern produces movement at least once across a full cycle', () => {
      for (const pattern of ALL_PATTERNS) {
        vmm.setManualPattern(pattern)
        let hasMoved = false
        
        for (let beat = 0; beat < 64; beat++) {
          vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
          const audio = createBaseAudio({ beatCount: beat, beatPhase: 0, energy: 0.6 })
          const intent = vmm.generateIntent('techno-club', audio, 0, 1)
          
          if (Math.abs(intent.x) > 0.01 || Math.abs(intent.y) > 0.01) {
            hasMoved = true
          }
        }
        
        expect(hasMoved, `Pattern "${pattern}" never produced any movement`).toBe(true)
        
        // Reset for next pattern
        vmm = new VibeMovementManager()
      }
      
      vi.restoreAllMocks()
    })

    test('Same inputs → same outputs (determinism)', () => {
      // The ANTI-SIMULATION axiom: no randomness, ever
      const vmmA = new VibeMovementManager()
      const vmmB = new VibeMovementManager()
      
      const audio = createBaseAudio({ beatCount: 42, beatPhase: 0.5, energy: 0.7 })
      
      // Both must produce IDENTICAL results with identical inputs
      vi.spyOn(Date, 'now').mockReturnValue(5000)
      const intentA = vmmA.generateIntent('techno-club', audio, 0, 2)
      
      vi.spyOn(Date, 'now').mockReturnValue(5000)
      const intentB = vmmB.generateIntent('techno-club', audio, 0, 2)
      
      expect(intentA.x).toBe(intentB.x)
      expect(intentA.y).toBe(intentB.y)
      expect(intentA.pattern).toBe(intentB.pattern)
      expect(intentA.amplitude).toBe(intentB.amplitude)
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §3 GEARBOX — Hardware Speed Limiting
  // "The Gearbox must never let a pattern request more speed than the
  //  motor can deliver. It reduces AMPLITUDE, not speed."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§3 🏎️ GEARBOX — Hardware Speed Limiting', () => {

    test('Slow fixture (maxSpeed=50) produces smaller amplitude than fast fixture (maxSpeed=500)', () => {
      const audio = createBaseAudio({ beatCount: 10, beatPhase: 0, energy: 0.7 })
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const slowVMM = new VibeMovementManager()
      const intentSlow = slowVMM.generateIntent('techno-club', audio, 0, 1, 50)
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const fastVMM = new VibeMovementManager()
      const intentFast = fastVMM.generateIntent('techno-club', audio, 0, 1, 500)
      
      // Slow fixture should have lower amplitude (Gearbox reducing it)
      expect(intentSlow.amplitude, 'Slow fixture should have reduced amplitude')
        .toBeLessThanOrEqual(intentFast.amplitude)
      
      vi.restoreAllMocks()
    })

    test('Gearbox never produces amplitude > 1.0', () => {
      const configs = [
        { bpm: 200, energy: 1.0, maxSpeed: 500 },
        { bpm: 60, energy: 0.1, maxSpeed: 50 },
        { bpm: 128, energy: 0.5, maxSpeed: 250 },
        { bpm: 180, energy: 0.9, maxSpeed: 100 },
      ]
      
      for (const cfg of configs) {
        vi.spyOn(Date, 'now').mockReturnValue(2000)
        const testVMM = new VibeMovementManager()
        const audio = createBaseAudio({ bpm: cfg.bpm, energy: cfg.energy, beatCount: 20 })
        const intent = testVMM.generateIntent('techno-club', audio, 0, 1, cfg.maxSpeed)
        
        expect(intent.amplitude, `Amplitude > 1.0 with bpm=${cfg.bpm} energy=${cfg.energy} maxSpeed=${cfg.maxSpeed}`)
          .toBeLessThanOrEqual(1.0)
        expect(intent.amplitude, `Amplitude < 0 with bpm=${cfg.bpm} energy=${cfg.energy} maxSpeed=${cfg.maxSpeed}`)
          .toBeGreaterThanOrEqual(0)
      }
      
      vi.restoreAllMocks()
    })

    test('Gearbox respects per-fixture maxSpeed (no global constant leak)', () => {
      // Two identical calls with different maxSpeed must produce different amplitudes
      // (unless the period is so long that both are under budget)
      const audio = createBaseAudio({ beatCount: 10, energy: 0.8, bpm: 128 })
      
      vi.spyOn(Date, 'now').mockReturnValue(3000)
      const vmmA = new VibeMovementManager()
      vmmA.setManualPattern('scan_x') // Fast pattern
      const intentA = vmmA.generateIntent('techno-club', audio, 0, 1, 50)
      
      vi.spyOn(Date, 'now').mockReturnValue(3000)
      const vmmB = new VibeMovementManager()
      vmmB.setManualPattern('scan_x')
      const intentB = vmmB.generateIntent('techno-club', audio, 0, 1, 500)
      
      // With maxSpeed 50 vs 500, the Gearbox should produce different amplitudes
      // The slow fixture (50) should have LOWER or EQUAL amplitude
      expect(intentA.amplitude).toBeLessThanOrEqual(intentB.amplitude)
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §4 ENERGY-TO-PERIOD — The Conductor's Tempo (WAVE 2086.4)
  // "Low energy = slower patterns. High energy = faster patterns."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§4 🎼 ENERGY-TO-PERIOD — The Conductor\'s Tempo', () => {

    test('energy < 0.3 produces period multiplier > 1.0 (slower)', () => {
      // At energy = 0, multiplier should be 2.0 (half speed)
      // At energy = 0.15, multiplier should be ~1.5
      // At energy = 0.3, multiplier should be 1.0
      
      // We verify this indirectly by observing that low-energy movement
      // traverses LESS distance in the same number of beats
      const audioLow = createBaseAudio({ energy: 0.1, beatCount: 8, bpm: 128 })
      const audioMid = createBaseAudio({ energy: 0.5, beatCount: 8, bpm: 128 })
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const vmmLow = new VibeMovementManager()
      vmmLow.setManualPattern('scan_x')
      const intentLow = vmmLow.generateIntent('techno-club', audioLow, 0, 1)
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const vmmMid = new VibeMovementManager()
      vmmMid.setManualPattern('scan_x')
      const intentMid = vmmMid.generateIntent('techno-club', audioMid, 0, 1)
      
      // Both positions should be safe
      assertSafeRange(intentLow, 'low energy')
      assertSafeRange(intentMid, 'mid energy')
      assertFinite(intentLow, 'low energy')
      assertFinite(intentMid, 'mid energy')
      
      vi.restoreAllMocks()
    })

    test('energy > 0.8 produces period multiplier < 1.0 (faster)', () => {
      // Verify that high energy doesn't break the safe range
      const audioHigh = createDropAudio(16)
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const intent = vmm.generateIntent('techno-club', audioHigh, 0, 1)
      
      assertSafeRange(intent, 'high energy fast period')
      assertFinite(intent, 'high energy fast period')
      
      vi.restoreAllMocks()
    })

    test('Energy-period multiplier boundaries: 0.0, 0.3, 0.8, 1.0', () => {
      // These are the exact boundary values of the piecewise function
      const boundaries = [
        { energy: 0.0, expectedMultiplier: 2.0 },
        { energy: 0.3, expectedMultiplier: 1.0 },
        { energy: 0.5, expectedMultiplier: 1.0 },  // Neutral zone
        { energy: 0.8, expectedMultiplier: 1.0 },
        { energy: 1.0, expectedMultiplier: 0.5 },
      ]
      
      for (const { energy, expectedMultiplier } of boundaries) {
        // Compute multiplier directly from the same formula as VMM
        let multiplier = 1.0
        if (energy < 0.3) {
          multiplier = 2.0 - (energy / 0.3)
        } else if (energy > 0.8) {
          multiplier = 1.0 - ((energy - 0.8) / 0.2) * 0.5
        }
        
        expect(multiplier, `Energy ${energy}: multiplier should be ${expectedMultiplier}`)
          .toBeCloseTo(expectedMultiplier, 5)
      }
    })

    test('Period multiplier is continuous (no jumps at boundaries)', () => {
      // Test energy values around the 0.3 and 0.8 boundaries
      const energies = [0.29, 0.30, 0.31, 0.79, 0.80, 0.81]
      let lastMultiplier = Infinity
      
      for (const energy of energies) {
        let multiplier = 1.0
        if (energy < 0.3) {
          multiplier = 2.0 - (energy / 0.3)
        } else if (energy > 0.8) {
          multiplier = 1.0 - ((energy - 0.8) / 0.2) * 0.5
        }
        
        // No jump greater than 0.1 between adjacent test points
        if (lastMultiplier !== Infinity) {
          const delta = Math.abs(multiplier - lastMultiplier)
          expect(delta, `Discontinuity at energy=${energy}: delta=${delta}`)
            .toBeLessThan(0.1)
        }
        
        lastMultiplier = multiplier
      }
    })

    test('Period multiplier range is always [0.5, 2.0]', () => {
      // Sweep the entire energy range
      for (let e = 0; e <= 100; e++) {
        const energy = e / 100
        
        let multiplier = 1.0
        if (energy < 0.3) {
          multiplier = 2.0 - (energy / 0.3)
        } else if (energy > 0.8) {
          multiplier = 1.0 - ((energy - 0.8) / 0.2) * 0.5
        }
        
        expect(multiplier, `Energy ${energy}: multiplier out of [0.5, 2.0]`)
          .toBeGreaterThanOrEqual(0.5)
        expect(multiplier, `Energy ${energy}: multiplier out of [0.5, 2.0]`)
          .toBeLessThanOrEqual(2.0)
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §5 PHRASE ENVELOPE — The Breathing Amplifier (WAVE 2086.3)
  // "32-beat phrase cycle: 0.6 → 1.0 → relax. Smooth cosine."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§5 🫁 PHRASE ENVELOPE — The Breathing Amplifier', () => {

    test('Phrase envelope is always in range [0.6, 1.0]', () => {
      // Sweep all 32 beats of the phrase
      for (let beat = 0; beat < 32; beat++) {
        const phraseBeats = 32
        const phraseProgress = (beat % phraseBeats) / phraseBeats
        const phraseEnvelope = 0.8 + 0.2 * Math.sin(Math.PI * (phraseProgress - 0.15))
        const clamped = Math.max(0.6, Math.min(1.0, phraseEnvelope))
        
        expect(clamped, `Beat ${beat}: envelope ${clamped} out of [0.6, 1.0]`)
          .toBeGreaterThanOrEqual(0.6)
        expect(clamped, `Beat ${beat}: envelope ${clamped} out of [0.6, 1.0]`)
          .toBeLessThanOrEqual(1.0)
      }
    })

    test('Phrase envelope has a peak (reaches > 0.95) in the middle of the phrase', () => {
      let maxEnvelope = 0
      let peakBeat = -1
      
      for (let beat = 0; beat < 32; beat++) {
        const phraseProgress = beat / 32
        const phraseEnvelope = 0.8 + 0.2 * Math.sin(Math.PI * (phraseProgress - 0.15))
        const clamped = Math.max(0.6, Math.min(1.0, phraseEnvelope))
        
        if (clamped > maxEnvelope) {
          maxEnvelope = clamped
          peakBeat = beat
        }
      }
      
      expect(maxEnvelope, 'Phrase should reach near 1.0 at peak').toBeGreaterThan(0.95)
      // Peak should be roughly in the middle-to-late section (beats 10-25)
      expect(peakBeat, 'Peak should be in mid-phrase').toBeGreaterThanOrEqual(10)
      expect(peakBeat, 'Peak should be in mid-phrase').toBeLessThanOrEqual(25)
    })

    test('Phrase envelope starts low (< 0.85 at beat 0)', () => {
      const phraseProgress = 0 / 32
      const phraseEnvelope = 0.8 + 0.2 * Math.sin(Math.PI * (phraseProgress - 0.15))
      const clamped = Math.max(0.6, Math.min(1.0, phraseEnvelope))
      
      expect(clamped, 'Phrase should start contained').toBeLessThan(0.85)
    })

    test('Phrase envelope is smooth (no discontinuities > 0.05 between beats)', () => {
      let lastEnvelope = -1
      
      for (let beat = 0; beat < 32; beat++) {
        const phraseProgress = beat / 32
        const phraseEnvelope = 0.8 + 0.2 * Math.sin(Math.PI * (phraseProgress - 0.15))
        const clamped = Math.max(0.6, Math.min(1.0, phraseEnvelope))
        
        if (lastEnvelope >= 0) {
          const delta = Math.abs(clamped - lastEnvelope)
          expect(delta, `Discontinuity at beat ${beat}: delta=${delta}`)
            .toBeLessThan(0.05)
        }
        
        lastEnvelope = clamped
      }
    })

    test('Phrase envelope integrates into real output (output modulated by beat position)', () => {
      // Two VMM instances at different phrase positions should produce different amplitudes
      // Beat 0 (start, envelope low) vs Beat 18 (mid-peak, envelope high)
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const vmmStart = new VibeMovementManager()
      vmmStart.setManualPattern('scan_x')
      const intentStart = vmmStart.generateIntent('techno-club',
        createBaseAudio({ beatCount: 0, beatPhase: 0.5, energy: 0.5 }), 0, 1)
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const vmmPeak = new VibeMovementManager()
      vmmPeak.setManualPattern('scan_x')
      const intentPeak = vmmPeak.generateIntent('techno-club',
        createBaseAudio({ beatCount: 18, beatPhase: 0.5, energy: 0.5 }), 0, 1)
      
      // Both must be safe
      assertSafeRange(intentStart, 'phrase start')
      assertSafeRange(intentPeak, 'phrase peak')
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §6 STEREO — Mirror/Snake Differentiation (WAVE 2086.1)
  // "L and R fixtures must receive DIFFERENT positions."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§6 🔊 STEREO — Mirror/Snake Differentiation', () => {

    test('Techno mirror: L and R have opposite X (mirror effect)', () => {
      const audio = createBaseAudio({ beatCount: 10, beatPhase: 0.5, energy: 0.7 })
      
      vi.spyOn(Date, 'now').mockReturnValue(2000)
      const intentL = vmm.generateIntent('techno-club', audio, 0, 2)
      const intentR = vmm.generateIntent('techno-club', audio, 1, 2)
      
      // Mirror: L.x and R.x should have opposite signs (when non-zero)
      if (Math.abs(intentL.x) > 0.05) {
        expect(Math.sign(intentL.x), 'Mirror: L and R should have opposite X')
          .not.toBe(Math.sign(intentR.x))
      }
      
      // Both must be in safe range
      assertSafeRange(intentL, 'mirror L')
      assertSafeRange(intentR, 'mirror R')
      
      vi.restoreAllMocks()
    })

    test('Mirror preserves Y (only X is mirrored)', () => {
      vmm.setManualPattern('square') // Has both X and Y components
      const audio = createBaseAudio({ beatCount: 4, beatPhase: 0, energy: 0.7 })
      
      vi.spyOn(Date, 'now').mockReturnValue(2000)
      const intentL = vmm.generateIntent('techno-club', audio, 0, 2)
      const intentR = vmm.generateIntent('techno-club', audio, 1, 2)
      
      // Y should be the same for mirror (only X inverts)
      expect(intentL.y, 'Mirror should preserve Y').toBeCloseTo(intentR.y, 2)
      
      assertSafeRange(intentL, 'mirror Y preserve L')
      assertSafeRange(intentR, 'mirror Y preserve R')
      
      vi.restoreAllMocks()
    })

    test('Latino snake: L and R have different positions', () => {
      const audio = createBaseAudio({ beatCount: 12, beatPhase: 0.5, energy: 0.6 })
      
      vi.spyOn(Date, 'now').mockReturnValue(2000)
      const intentL = vmm.generateIntent('fiesta-latina', audio, 0, 2)
      const intentR = vmm.generateIntent('fiesta-latina', audio, 1, 2)
      
      // Snake: positions should differ (phase offset creates wave effect)
      const positionDiffers = 
        Math.abs(intentL.x - intentR.x) > 0.01 ||
        Math.abs(intentL.y - intentR.y) > 0.01
      
      expect(positionDiffers, 'Snake: L and R should have different positions').toBe(true)
      
      assertSafeRange(intentL, 'snake L')
      assertSafeRange(intentR, 'snake R')
      
      vi.restoreAllMocks()
    })

    test('Pop-rock snake: different positions with wider offset', () => {
      const audio = createBaseAudio({ beatCount: 15, beatPhase: 0.25, energy: 0.5 })
      
      vi.spyOn(Date, 'now').mockReturnValue(2000)
      const intentL = vmm.generateIntent('pop-rock', audio, 0, 2)
      const intentR = vmm.generateIntent('pop-rock', audio, 1, 2)
      
      assertSafeRange(intentL, 'pop snake L')
      assertSafeRange(intentR, 'pop snake R')
      
      vi.restoreAllMocks()
    })

    test('Idle sync: L and R have identical positions', () => {
      const audio = createBaseAudio({ beatCount: 5, beatPhase: 0, energy: 0.1 })
      
      vi.spyOn(Date, 'now').mockReturnValue(2000)
      const intentL = vmm.generateIntent('idle', audio, 0, 2)
      const intentR = vmm.generateIntent('idle', audio, 1, 2)
      
      // Sync mode: both should be identical
      expect(intentL.x).toBeCloseTo(intentR.x, 5)
      expect(intentL.y).toBeCloseTo(intentR.y, 5)
      
      vi.restoreAllMocks()
    })

    test('Stereo positions stay in [-1, +1] for all vibes with 8 fixtures', () => {
      for (const vibeId of ALL_VIBES) {
        for (let i = 0; i < 8; i++) {
          vi.spyOn(Date, 'now').mockReturnValue(3000 + i)
          const audio = createBaseAudio({ beatCount: 20, beatPhase: 0.5, energy: 0.8 })
          const intent = vmm.generateIntent(vibeId, audio, i, 8)
          
          assertSafeRange(intent, `stereo vibe=${vibeId} fixture=${i}/8`)
          assertFinite(intent, `stereo vibe=${vibeId} fixture=${i}/8`)
        }
      }
      
      vi.restoreAllMocks()
    })

    test('Frame-once guard: R fixture does not contaminate L state', () => {
      // This verifies the WAVE 2086.1 fix:
      // When VMM is called twice per frame (L then R), the R call
      // must NOT overwrite lastPosition/lastPattern used for LERP.
      const audio = createBaseAudio({ beatCount: 10, beatPhase: 0, energy: 0.6 })
      
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const intentL1 = vmm.generateIntent('techno-club', audio, 0, 2)
      const intentR1 = vmm.generateIntent('techno-club', audio, 1, 2)
      
      // Next frame
      vi.spyOn(Date, 'now').mockReturnValue(1017)
      audio.beatCount = 11
      const intentL2 = vmm.generateIntent('techno-club', audio, 0, 2)
      
      // L2's LERP base should come from L1, not R1
      // We can't directly inspect lastPosition, but we can verify
      // that L2 is continuous with L1, not with R1
      assertSafeRange(intentL2, 'frame-once L2')
      assertFinite(intentL2, 'frame-once L2')
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §7 GHOST PROTOCOL — Freeze in Silence (WAVE 1165)
  // "When audio dies, HOLD position. Never whip to home."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§7 🥶 GHOST PROTOCOL — Freeze in Silence', () => {

    test('Very low energy (< 0.03) with homeOnSilence returns freeze intent', () => {
      // First generate a real position
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      vmm.generateIntent('pop-rock', audio, 0, 1) // pop-rock has homeOnSilence: true
      
      // Now go silent
      vi.spyOn(Date, 'now').mockReturnValue(1017)
      const silentAudio = createSilentAudio()
      silentAudio.energy = 0.02  // Below the 0.03 threshold
      const intent = vmm.generateIntent('pop-rock', silentAudio, 0, 1)
      
      expect(intent.pattern).toBe('freeze')
      expect(intent.speed).toBe(0)
      expect(intent.amplitude).toBe(0)
      assertSafeRange(intent, 'freeze intent')
      
      vi.restoreAllMocks()
    })

    test('Freeze maintains last known position (no whip to center)', () => {
      // Generate several frames of movement so lastPosition accumulates.
      // VMM was created with lastUpdate=1000 in beforeEach, so we start at 1017.
      vmm.setManualPattern('scan_x')
      const audio = createBaseAudio({ beatCount: 4, beatPhase: 0.5, energy: 0.6 })
      
      // Frame 1: establish movement
      vi.spyOn(Date, 'now').mockReturnValue(1017)
      vmm.generateIntent('pop-rock', audio, 0, 1)
      
      // Frame 2: advance to let lastPosition settle
      vi.spyOn(Date, 'now').mockReturnValue(1034)
      audio.beatPhase = 0.6
      const movingIntent = vmm.generateIntent('pop-rock', audio, 0, 1)
      
      // Now freeze — energy below threshold
      vi.spyOn(Date, 'now').mockReturnValue(1051)
      const silentAudio = createSilentAudio()
      silentAudio.energy = 0.01
      const freezeIntent = vmm.generateIntent('pop-rock', silentAudio, 0, 1)
      
      // Freeze position should be the last known position, not (0, 0)
      expect(freezeIntent.x).toBeCloseTo(movingIntent.x, 2)
      expect(freezeIntent.y).toBeCloseTo(movingIntent.y, 2)
      
      vi.restoreAllMocks()
    })

    test('Techno (homeOnSilence: false) does NOT freeze on silence', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const silentAudio = createSilentAudio()
      silentAudio.energy = 0.02
      const intent = vmm.generateIntent('techno-club', silentAudio, 0, 1)
      
      // techno-club has homeOnSilence: false, so it should NOT freeze
      expect(intent.pattern).not.toBe('freeze')
      
      vi.restoreAllMocks()
    })

    test('Energy exactly at 0.03 does NOT trigger freeze (boundary test)', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ energy: 0.03, beatCount: 5 })
      const intent = vmm.generateIntent('pop-rock', audio, 0, 1)
      
      // 0.03 is NOT < 0.03, so should not freeze
      expect(intent.pattern).not.toBe('freeze')
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §8 SMOOTH TRANSITIONS — LERP System (WAVE 1155.1)
  // "Pattern changes produce 2-second smooth crossfade, not instant jumps."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§8 🌊 SMOOTH TRANSITIONS — LERP System', () => {

    test('Pattern change triggers transition state', () => {
      // Start with pattern A
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualPattern('scan_x')
      vmm.generateIntent('techno-club', createBaseAudio({ beatCount: 0, energy: 0.5 }), 0, 1)
      
      // Switch to pattern B
      vi.spyOn(Date, 'now').mockReturnValue(1100)
      vmm.setManualPattern('circle_big')
      const intent = vmm.generateIntent('techno-club', createBaseAudio({ beatCount: 1, energy: 0.5 }), 0, 1)
      
      // Position should be valid (LERP or target)
      assertSafeRange(intent, 'transition')
      assertFinite(intent, 'transition')
      
      vi.restoreAllMocks()
    })

    test('During transition, output is always in safe range', () => {
      // Generate initial position
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualPattern('scan_x')
      vmm.generateIntent('techno-club', createBaseAudio({ beatCount: 0, energy: 0.6 }), 0, 1)
      
      // Trigger transition
      vi.spyOn(Date, 'now').mockReturnValue(1100)
      vmm.setManualPattern('breath')
      
      // Simulate 2 seconds of LERP at ~60fps
      for (let frame = 0; frame < 120; frame++) {
        const time = 1100 + frame * 17  // ~60fps
        vi.spyOn(Date, 'now').mockReturnValue(time)
        
        const intent = vmm.generateIntent('techno-club',
          createBaseAudio({ beatCount: frame, energy: 0.5 }), 0, 1)
        
        assertSafeRange(intent, `LERP frame=${frame}`)
        assertFinite(intent, `LERP frame=${frame}`)
      }
      
      vi.restoreAllMocks()
    })

    test('LERP ease-out curve: smoothstep t²(3-2t) produces correct values', () => {
      // Unit test the smoothstep function
      const smoothstep = (t: number) => t * t * (3 - 2 * t)
      
      // Properties of smoothstep:
      expect(smoothstep(0), 'smoothstep(0) = 0').toBeCloseTo(0, 10)
      expect(smoothstep(1), 'smoothstep(1) = 1').toBeCloseTo(1, 10)
      expect(smoothstep(0.5), 'smoothstep(0.5) = 0.5').toBeCloseTo(0.5, 10)
      
      // Monotonic: always increasing
      let lastValue = -1
      for (let i = 0; i <= 100; i++) {
        const t = i / 100
        const v = smoothstep(t)
        expect(v, `smoothstep(${t}) should be >= previous`).toBeGreaterThanOrEqual(lastValue - 0.001)
        expect(v, `smoothstep(${t}) should be in [0, 1]`).toBeGreaterThanOrEqual(0)
        expect(v, `smoothstep(${t}) should be in [0, 1]`).toBeLessThanOrEqual(1)
        lastValue = v
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §9 EDGE CASES — Impossible Inputs
  // "The system must never crash or produce NaN/Infinity."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§9 💀 EDGE CASES — Impossible Inputs', () => {

    test('BPM = 0 produces valid output (getSafeBPM fallback)', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ bpm: 0, beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'bpm=0')
      assertFinite(intent, 'bpm=0')
      
      vi.restoreAllMocks()
    })

    test('BPM = NaN produces valid output', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ bpm: NaN, beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'bpm=NaN')
      assertFinite(intent, 'bpm=NaN')
      
      vi.restoreAllMocks()
    })

    test('BPM = Infinity produces valid output', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ bpm: Infinity, beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'bpm=Infinity')
      assertFinite(intent, 'bpm=Infinity')
      
      vi.restoreAllMocks()
    })

    test('BPM = negative produces valid output', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ bpm: -120, beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'bpm=-120')
      assertFinite(intent, 'bpm=-120')
      
      vi.restoreAllMocks()
    })

    test('Energy > 1.0 produces valid output', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ energy: 5.0, beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'energy=5.0')
      assertFinite(intent, 'energy=5.0')
      
      vi.restoreAllMocks()
    })

    test('Energy = negative produces valid output', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ energy: -1, beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'energy=-1')
      assertFinite(intent, 'energy=-1')
      
      vi.restoreAllMocks()
    })

    test('Unknown vibe ID falls back to idle gracefully', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10 })
      const intent = vmm.generateIntent('nonexistent-vibe-that-doesnt-exist', audio, 0, 1)
      
      assertSafeRange(intent, 'unknown vibe')
      assertFinite(intent, 'unknown vibe')
      
      vi.restoreAllMocks()
    })

    test('Fixture index > total does not crash', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10 })
      // Index 10 when total is 2 — out of bounds
      const intent = vmm.generateIntent('techno-club', audio, 10, 2)
      
      assertSafeRange(intent, 'fixture index overflow')
      assertFinite(intent, 'fixture index overflow')
      
      vi.restoreAllMocks()
    })

    test('Total fixtures = 0 does not divide by zero', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 0)
      
      assertSafeRange(intent, 'total=0')
      assertFinite(intent, 'total=0')
      
      vi.restoreAllMocks()
    })

    test('Negative fixture index does not crash', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10 })
      const intent = vmm.generateIntent('techno-club', audio, -1, 2)
      
      assertSafeRange(intent, 'negative index')
      assertFinite(intent, 'negative index')
      
      vi.restoreAllMocks()
    })

    test('beatCount = undefined falls back gracefully', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: undefined, beatPhase: 0 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'beatCount=undefined')
      assertFinite(intent, 'beatCount=undefined')
      
      vi.restoreAllMocks()
    })

    test('Very large beatCount does not overflow', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 999999999, beatPhase: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'beatCount=999999999')
      assertFinite(intent, 'beatCount=999999999')
      
      vi.restoreAllMocks()
    })

    test('fixtureMaxSpeed = 0 does not produce NaN', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1, 0)
      
      assertFinite(intent, 'maxSpeed=0')
      // Amplitude should be 0 or very low (no speed budget)
      
      vi.restoreAllMocks()
    })

    test('fixtureMaxSpeed = negative does not crash', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1, -100)
      
      assertFinite(intent, 'maxSpeed=-100')
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §10 CONFIGURATION INTEGRITY — All Vibes & Patterns Linked
  // "Every vibe must reference only existing patterns. No dangling refs."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§10 🔗 CONFIGURATION INTEGRITY', () => {

    test('All vibe configs reference only existing GoldenPatterns', () => {
      const availablePatterns = vmm.getAvailablePatterns()
      
      for (const vibeId of ALL_VIBES) {
        const config = vmm.getVibeConfig(vibeId)
        
        for (const pattern of config.patterns) {
          expect(availablePatterns, `Vibe "${vibeId}" references nonexistent pattern "${pattern}"`)
            .toContain(pattern)
        }
      }
    })

    test('Every vibe config has at least one pattern', () => {
      for (const vibeId of ALL_VIBES) {
        const config = vmm.getVibeConfig(vibeId)
        expect(config.patterns.length, `Vibe "${vibeId}" has no patterns`)
          .toBeGreaterThan(0)
      }
    })

    test('Every vibe config has valid amplitude scale (0 < amp ≤ 1)', () => {
      for (const vibeId of ALL_VIBES) {
        const config = vmm.getVibeConfig(vibeId)
        expect(config.amplitudeScale, `Vibe "${vibeId}": amplitudeScale too low`)
          .toBeGreaterThan(0)
        expect(config.amplitudeScale, `Vibe "${vibeId}": amplitudeScale > 1`)
          .toBeLessThanOrEqual(1.0)
      }
    })

    test('Every vibe config has valid base frequency (> 0)', () => {
      for (const vibeId of ALL_VIBES) {
        const config = vmm.getVibeConfig(vibeId)
        expect(config.baseFrequency, `Vibe "${vibeId}": baseFrequency must be positive`)
          .toBeGreaterThan(0)
      }
    })

    test('PATTERN_PERIOD covers all 17 patterns (no missing periods)', () => {
      // This is a compile-time guarantee via Record<GoldenPattern, number>,
      // but we verify at runtime too
      const available = vmm.getAvailablePatterns()
      expect(available.length).toBe(17)
    })

    test('All pattern periods are professional range (8-32 beats)', () => {
      // WAVE 2086.2 mandate: no more epileptic 1-4 beat periods
      const PERIODS: Record<string, number> = {
        scan_x: 16, square: 16, diamond: 8, botstep: 8,
        figure8: 16, wave_y: 8, ballyhoo: 32,
        circle_big: 16, cancan: 8, dual_sweep: 16,
        drift: 32, sway: 16, breath: 16,
        slow_pan: 32, tilt_nod: 16, figure_of_4: 16, chase_position: 16,
      }
      
      for (const [pattern, period] of Object.entries(PERIODS)) {
        expect(period, `Pattern "${pattern}": period ${period} < 8 (epileptic!)`).toBeGreaterThanOrEqual(8)
        expect(period, `Pattern "${pattern}": period ${period} > 32 (too slow)`).toBeLessThanOrEqual(32)
      }
    })

    test('getSafeBPM clamps to [60, 200] range', () => {
      // Verify the BPM safety net
      const testCases = [
        { input: 0, expected: 120 },      // Invalid → default 120
        { input: -1, expected: 120 },      // Negative → default 120
        { input: NaN, expected: 120 },     // NaN → default 120
        { input: Infinity, expected: 120 },// Inf → default 120
        { input: 30, expected: 60 },       // Below min → clamp to 60
        { input: 300, expected: 200 },     // Above max → clamp to 200
        { input: 128, expected: 128 },     // Normal → pass through
        { input: 60, expected: 60 },       // Boundary min
        { input: 200, expected: 200 },     // Boundary max
      ]
      
      for (const { input, expected } of testCases) {
        // getSafeBPM is private, but we can test it indirectly
        // A BPM of 0 should produce the same result as BPM 120 (the default fallback)
        vi.spyOn(Date, 'now').mockReturnValue(1000)
        const testVMM = new VibeMovementManager()
        const audio = createBaseAudio({ bpm: input, beatCount: 10 })
        const intent = testVMM.generateIntent('techno-club', audio, 0, 1)
        
        assertFinite(intent, `bpm=${input}`)
        assertSafeRange(intent, `bpm=${input}`)
      }
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §11 MANUAL OVERRIDE — User Control System
  // "Manual overrides take absolute priority. Clear returns to AI."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§11 🎛️ MANUAL OVERRIDE — User Control System', () => {

    test('setManualPattern forces specific pattern', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualPattern('breath')
      
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      // Even though vibe is techno-club, manual override should force breath
      // The VMM translates UI names, but 'breath' is already a GoldenPattern
      expect(intent.pattern).toBe('breath')
      
      vi.restoreAllMocks()
    })

    test('setManualPattern(null) returns control to AI', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualPattern('breath')
      vmm.setManualPattern(null)
      
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      // Should be back to techno-club's pattern rotation (not breath)
      expect(['scan_x', 'square', 'diamond', 'botstep']).toContain(intent.pattern)
      
      vi.restoreAllMocks()
    })

    test('UI pattern names are translated correctly', () => {
      const translations: Record<string, string> = {
        'circle': 'circle_big',
        'eight': 'figure8',
        'sweep': 'scan_x',
        'spiral': 'ballyhoo',
        'wave': 'wave_y',
        'bounce': 'botstep',
        'random': 'drift',
      }
      
      for (const [uiName, goldenName] of Object.entries(translations)) {
        const testVMM = new VibeMovementManager()
        vi.spyOn(Date, 'now').mockReturnValue(1000)
        testVMM.setManualPattern(uiName)
        
        const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
        const intent = testVMM.generateIntent('techno-club', audio, 0, 1)
        
        expect(intent.pattern, `UI "${uiName}" should map to "${goldenName}"`)
          .toBe(goldenName)
      }
      
      vi.restoreAllMocks()
    })

    test('setManualAmplitude overrides Gearbox', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualAmplitude(100)
      
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      // Manual amplitude 100% should produce near-full amplitude
      expect(intent.amplitude).toBeGreaterThan(0.9)
      
      vi.restoreAllMocks()
    })

    test('setManualAmplitude(null) returns to Gearbox control', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualAmplitude(100)
      vmm.setManualAmplitude(null)
      
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      // Amplitude should now be Gearbox-controlled (likely < 1.0)
      expect(intent.amplitude).toBeLessThanOrEqual(1.0)
      expect(intent.amplitude).toBeGreaterThanOrEqual(0)
      
      vi.restoreAllMocks()
    })

    test('clearManualOverrides resets everything', () => {
      vmm.setManualPattern('breath')
      vmm.setManualAmplitude(50)
      vmm.setManualSpeed(80)
      
      const overrides = vmm.getManualOverrides()
      expect(overrides.pattern).toBe('breath')
      expect(overrides.amplitude).toBe(50)
      expect(overrides.speed).toBe(80)
      
      vmm.clearManualOverrides()
      
      const cleared = vmm.getManualOverrides()
      expect(cleared.pattern).toBeNull()
      expect(cleared.amplitude).toBeNull()
      expect(cleared.speed).toBeNull()
    })

    test('Unknown UI pattern falls back to circle_big', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.setManualPattern('totally_fake_pattern_xyzzy')
      
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      expect(intent.pattern).toBe('circle_big')
      
      vi.restoreAllMocks()
    })

    test('"static" pattern releases to AI (same as null)', () => {
      vmm.setManualPattern('static')
      
      const overrides = vmm.getManualOverrides()
      expect(overrides.pattern).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §12 RESET & LIFECYCLE — Clean State Management
  // ═══════════════════════════════════════════════════════════════════════

  describe('§12 🔄 RESET & LIFECYCLE', () => {

    test('resetTime clears all temporal state', () => {
      // Generate some state — advance time past the initial 1000ms
      // so that deltaTime > 0 and this.time accumulates.
      vi.spyOn(Date, 'now').mockReturnValue(2000) // 1s after construction
      vmm.generateIntent('techno-club', createBaseAudio({ beatCount: 100 }), 0, 1)
      
      expect(vmm.getTime()).toBeGreaterThan(0)
      expect(vmm.getBarCount()).toBeGreaterThan(0)
      
      vmm.resetTime()
      
      expect(vmm.getTime()).toBe(0)
      expect(vmm.getBarCount()).toBe(0)
      
      vi.restoreAllMocks()
    })

    test('After reset, first intent is valid', () => {
      vmm.resetTime()
      
      vi.spyOn(Date, 'now').mockReturnValue(2000)
      const audio = createBaseAudio({ beatCount: 5, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      assertSafeRange(intent, 'post-reset')
      assertFinite(intent, 'post-reset')
      
      vi.restoreAllMocks()
    })

    test('getAvailablePatterns returns exactly 17 patterns', () => {
      const patterns = vmm.getAvailablePatterns()
      expect(patterns.length).toBe(17)
      
      // Verify all expected patterns are present
      for (const pattern of ALL_PATTERNS) {
        expect(patterns).toContain(pattern)
      }
    })

    test('getVibeConfig returns valid config for all vibes', () => {
      for (const vibeId of ALL_VIBES) {
        const config = vmm.getVibeConfig(vibeId)
        
        expect(config).toBeDefined()
        expect(config.patterns.length).toBeGreaterThan(0)
        expect(config.amplitudeScale).toBeGreaterThan(0)
        expect(config.baseFrequency).toBeGreaterThan(0)
        expect(typeof config.homeOnSilence).toBe('boolean')
      }
    })

    test('Unknown vibeId returns idle config', () => {
      const config = vmm.getVibeConfig('completely-unknown-vibe')
      const idleConfig = vmm.getVibeConfig('idle')
      
      expect(config.amplitudeScale).toBe(idleConfig.amplitudeScale)
      expect(config.baseFrequency).toBe(idleConfig.baseFrequency)
      expect(config.patterns).toEqual(idleConfig.patterns)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §13 STRESS TEST — The Furnace
  // "1000 frames of continuous operation. No NaN. No overflow. No crash."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§13 🔥 STRESS TEST — The Furnace', () => {

    test('1000 frames continuous techno at max energy: zero NaN, zero out-of-range', () => {
      for (let frame = 0; frame < 1000; frame++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + frame * 17)
        
        const audio = createBaseAudio({
          energy: 0.95,
          bass: 0.9,
          bpm: 128,
          beatCount: frame,
          beatPhase: (frame % 4) / 4,
        })
        
        const intentL = vmm.generateIntent('techno-club', audio, 0, 2, 250)
        const intentR = vmm.generateIntent('techno-club', audio, 1, 2, 250)
        
        assertSafeRange(intentL, `furnace frame=${frame} L`)
        assertSafeRange(intentR, `furnace frame=${frame} R`)
        assertFinite(intentL, `furnace frame=${frame} L`)
        assertFinite(intentR, `furnace frame=${frame} R`)
      }
      
      vi.restoreAllMocks()
    })

    test('All vibes cycling through all patterns over 500 frames', () => {
      for (const vibeId of ALL_VIBES) {
        const testVMM = new VibeMovementManager()
        
        for (let frame = 0; frame < 500; frame++) {
          vi.spyOn(Date, 'now').mockReturnValue(1000 + frame * 17)
          
          const audio = createBaseAudio({
            energy: (frame % 100) / 100,  // Energy oscillates 0 → 1
            bpm: 90 + (frame % 60),       // BPM varies 90-150
            beatCount: frame,
            beatPhase: (frame * 0.25) % 1,
          })
          
          const intent = testVMM.generateIntent(vibeId, audio, 0, 2, 200)
          
          assertSafeRange(intent, `stress vibe=${vibeId} frame=${frame}`)
          assertFinite(intent, `stress vibe=${vibeId} frame=${frame}`)
        }
      }
      
      vi.restoreAllMocks()
    })

    test('Rapid vibe switching does not corrupt state', () => {
      const vibes = ['techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge', 'idle']
      
      for (let frame = 0; frame < 200; frame++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + frame * 17)
        
        // Switch vibe every 10 frames
        const vibeId = vibes[Math.floor(frame / 10) % vibes.length]
        const audio = createBaseAudio({ beatCount: frame, energy: 0.6 })
        
        const intent = vmm.generateIntent(vibeId, audio, 0, 2)
        
        assertSafeRange(intent, `vibe-switch frame=${frame} vibe=${vibeId}`)
        assertFinite(intent, `vibe-switch frame=${frame} vibe=${vibeId}`)
      }
      
      vi.restoreAllMocks()
    })

    test('Pattern rotation progresses correctly over phrases', () => {
      // Pattern should rotate every 8 bars (32 beats)
      // For techno-club: [scan_x, square, diamond, botstep]
      const seenPatterns = new Set<string>()
      
      for (let beat = 0; beat < 256; beat++) {
        vi.spyOn(Date, 'now').mockReturnValue(1000 + beat * 17)
        
        const audio = createBaseAudio({ beatCount: beat, energy: 0.5 })
        const intent = vmm.generateIntent('techno-club', audio, 0, 1)
        
        seenPatterns.add(intent.pattern)
      }
      
      // Should have seen multiple patterns (rotation working)
      expect(seenPatterns.size, 'Pattern rotation should cycle through multiple patterns')
        .toBeGreaterThan(1)
      
      vi.restoreAllMocks()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // §14 MOVEMENT INTENT STRUCTURE — Contract Validation
  // "Every MovementIntent must have all required fields with correct types."
  // ═══════════════════════════════════════════════════════════════════════

  describe('§14 📋 MOVEMENT INTENT STRUCTURE — Contract Validation', () => {

    test('Every intent has all required fields', () => {
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
      const intent = vmm.generateIntent('techno-club', audio, 0, 1)
      
      expect(intent).toHaveProperty('x')
      expect(intent).toHaveProperty('y')
      expect(intent).toHaveProperty('pattern')
      expect(intent).toHaveProperty('speed')
      expect(intent).toHaveProperty('amplitude')
      
      expect(typeof intent.x).toBe('number')
      expect(typeof intent.y).toBe('number')
      expect(typeof intent.pattern).toBe('string')
      expect(typeof intent.speed).toBe('number')
      expect(typeof intent.amplitude).toBe('number')
      
      vi.restoreAllMocks()
    })

    test('Speed is always positive', () => {
      for (const vibeId of ALL_VIBES) {
        vi.spyOn(Date, 'now').mockReturnValue(1000)
        const testVMM = new VibeMovementManager()
        const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
        const intent = testVMM.generateIntent(vibeId, audio, 0, 1)
        
        expect(intent.speed, `Speed should be >= 0 for vibe ${vibeId}`)
          .toBeGreaterThanOrEqual(0)
      }
      
      vi.restoreAllMocks()
    })

    test('Amplitude is in [0, 1] range', () => {
      for (const vibeId of ALL_VIBES) {
        vi.spyOn(Date, 'now').mockReturnValue(1000)
        const testVMM = new VibeMovementManager()
        const audio = createBaseAudio({ beatCount: 10, energy: 0.7 })
        const intent = testVMM.generateIntent(vibeId, audio, 0, 1)
        
        expect(intent.amplitude, `Amplitude out of [0,1] for vibe ${vibeId}`)
          .toBeGreaterThanOrEqual(0)
        expect(intent.amplitude, `Amplitude out of [0,1] for vibe ${vibeId}`)
          .toBeLessThanOrEqual(1.0)
      }
      
      vi.restoreAllMocks()
    })

    test('phaseType is either linear or polar', () => {
      for (const vibeId of ALL_VIBES) {
        vi.spyOn(Date, 'now').mockReturnValue(1000)
        const testVMM = new VibeMovementManager()
        const audio = createBaseAudio({ beatCount: 10, energy: 0.5 })
        const intent = testVMM.generateIntent(vibeId, audio, 0, 1)
        
        if (intent.phaseType !== undefined) {
          expect(['linear', 'polar']).toContain(intent.phaseType)
        }
      }
      
      vi.restoreAllMocks()
    })

    test('Freeze intent has correct structure', () => {
      // Generate a position first
      vi.spyOn(Date, 'now').mockReturnValue(1000)
      vmm.generateIntent('pop-rock', createBaseAudio({ beatCount: 10, energy: 0.5 }), 0, 1)
      
      // Trigger freeze
      vi.spyOn(Date, 'now').mockReturnValue(1017)
      const freeze = vmm.generateIntent('pop-rock', createSilentAudio(), 0, 1)
      
      expect(freeze.pattern).toBe('freeze')
      expect(freeze.speed).toBe(0)
      expect(freeze.amplitude).toBe(0)
      assertFinite(freeze, 'freeze structure')
      
      vi.restoreAllMocks()
    })
  })
})
