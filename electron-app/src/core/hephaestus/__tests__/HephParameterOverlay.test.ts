/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS PARAMETER OVERLAY TEST SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 * 
 * Validación de que el overlay aplica curvas sobre EffectFrameOutput
 * correctamente sin mutar el original.
 * 
 * PILARES:
 * 1. 🛡️ Inmutabilidad: rawOutput NUNCA se modifica
 * 2. 📐 Absolute mode: curva reemplaza valor
 * 3. 🔀 Relative mode: curva multiplica valor
 * 4. ➕ Additive mode: curva suma al valor
 * 5. 🎨 Color overlay: HSL se inyecta correctamente
 * 6. 🎚️ Movement overlay: pan/tilt se mapean correctamente
 * 7. ⚡ Pass-through: parámetros sin curva no se alteran
 * 
 * @module tests/HephParameterOverlay.test
 * @version WAVE 2030.2
 */

import { describe, test, expect } from 'vitest'
import { HephParameterOverlay } from '../HephParameterOverlay'
import type { EffectFrameOutput } from '../../effects/types'
import type { HephAutomationClip, HephCurve, HephParamId, HSL } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un EffectFrameOutput mínimo para testing.
 */
function createRawOutput(overrides?: Partial<EffectFrameOutput>): EffectFrameOutput {
  return {
    effectId: 'test-effect-001',
    category: 'physical',
    phase: 'sustain',
    progress: 0.5,
    zones: ['all'],
    intensity: 0.8,
    dimmerOverride: 0.8,
    ...overrides,
  }
}

/**
 * Crea un HephAutomationClip mínimo para testing.
 */
function createClip(
  curves: Map<HephParamId, HephCurve>,
  durationMs: number = 1000
): HephAutomationClip {
  return {
    id: 'test-clip-001',
    name: 'Test Clip',
    author: 'PunkOpus',
    category: 'physical',
    tags: [],
    vibeCompat: [],
    zones: ['all'],
    mixBus: 'htp',
    priority: 50,
    durationMs,
    effectType: 'test',
    curves,
    staticParams: {},
  }
}

/**
 * Crea una curva numérica simple.
 */
function numCurve(
  paramId: HephParamId,
  v0: number,
  v1: number,
  mode: 'absolute' | 'relative' | 'additive' = 'absolute'
): [HephParamId, HephCurve] {
  return [
    paramId,
    {
      paramId,
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      mode,
      keyframes: [
        { timeMs: 0, value: v0, interpolation: 'linear' },
        { timeMs: 1000, value: v1, interpolation: 'linear' },
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('⚒️ HEPHAESTUS: HephParameterOverlay - The Invisible Hand', () => {

  // ═════════════════════════════════════════════════════════════════════════
  // 🛡️ IMMUTABILITY
  // ═════════════════════════════════════════════════════════════════════════

  describe('🛡️ Immutability', () => {
    test('apply does NOT mutate rawOutput', () => {
      const curves = new Map([numCurve('intensity', 0.5, 0.5)])
      const overlay = new HephParameterOverlay(createClip(curves))

      const rawOutput = createRawOutput({ dimmerOverride: 0.8, intensity: 0.8 })
      const originalDimmer = rawOutput.dimmerOverride

      overlay.apply(rawOutput, 500)

      expect(rawOutput.dimmerOverride).toBe(originalDimmer)
    })

    test('apply returns a new object', () => {
      const curves = new Map([numCurve('intensity', 0.5, 0.5)])
      const overlay = new HephParameterOverlay(createClip(curves))

      const rawOutput = createRawOutput()
      const result = overlay.apply(rawOutput, 500)

      expect(result).not.toBe(rawOutput)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 📐 ABSOLUTE MODE
  // ═════════════════════════════════════════════════════════════════════════

  describe('📐 Absolute Mode', () => {
    test('intensity curve replaces dimmer', () => {
      const curves = new Map([numCurve('intensity', 0, 1, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.8 })
      const result = overlay.apply(raw, 500)

      // At t=500, linear 0→1 = 0.5
      expect(result.dimmerOverride).toBeCloseTo(0.5, 2)
    })

    test('white curve replaces whiteOverride', () => {
      const curves = new Map([numCurve('white', 0, 1, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ whiteOverride: 0.2 })
      const result = overlay.apply(raw, 700)

      expect(result.whiteOverride).toBeCloseTo(0.7, 2)
    })

    test('strobe curve maps 0-1 to 0-18Hz', () => {
      const curves = new Map([numCurve('strobe', 1, 1, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput()
      const result = overlay.apply(raw, 500)

      expect(result.strobeRate).toBeCloseTo(18, 0)
    })

    test('globalComp curve replaces globalComposition', () => {
      const curves = new Map([numCurve('globalComp', 0, 1, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ globalComposition: 0.3 })
      const result = overlay.apply(raw, 500)

      expect(result.globalComposition).toBeCloseTo(0.5, 2)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🔀 RELATIVE MODE (MULTIPLY)
  // ═════════════════════════════════════════════════════════════════════════

  describe('🔀 Relative Mode (Multiply)', () => {
    test('relative intensity multiplies base dimmer', () => {
      const curves = new Map([numCurve('intensity', 0.5, 0.5, 'relative')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.8, intensity: 0.8 })
      const result = overlay.apply(raw, 500)

      // relative: 0.8 * 0.5 = 0.4
      expect(result.dimmerOverride).toBeCloseTo(0.4, 2)
    })

    test('relative with 1.0 passes through original value', () => {
      const curves = new Map([numCurve('intensity', 1.0, 1.0, 'relative')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.7, intensity: 0.7 })
      const result = overlay.apply(raw, 500)

      expect(result.dimmerOverride).toBeCloseTo(0.7, 2)
    })

    test('relative with 0.0 kills the signal', () => {
      const curves = new Map([numCurve('intensity', 0, 0, 'relative')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.9, intensity: 0.9 })
      const result = overlay.apply(raw, 500)

      expect(result.dimmerOverride).toBeCloseTo(0, 2)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // ➕ ADDITIVE MODE
  // ═════════════════════════════════════════════════════════════════════════

  describe('➕ Additive Mode', () => {
    test('additive intensity adds to base', () => {
      const curves = new Map([numCurve('intensity', 0.2, 0.2, 'additive')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.5, intensity: 0.5 })
      const result = overlay.apply(raw, 500)

      // additive: 0.5 + 0.2 = 0.7
      expect(result.dimmerOverride).toBeCloseTo(0.7, 2)
    })

    test('additive clamps to max 1.0', () => {
      const curves = new Map([numCurve('intensity', 0.5, 0.5, 'additive')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.8, intensity: 0.8 })
      const result = overlay.apply(raw, 500)

      // additive: 0.8 + 0.5 = 1.3 → clamped to 1.0
      expect(result.dimmerOverride).toBe(1.0)
    })

    test('additive clamps to min 0.0', () => {
      // Negative additive value (subtractive)
      const curves = new Map<HephParamId, HephCurve>([
        ['intensity', {
          paramId: 'intensity',
          valueType: 'number',
          range: [-1, 1],
          defaultValue: 0,
          mode: 'additive',
          keyframes: [
            { timeMs: 0, value: -0.5, interpolation: 'linear' },
            { timeMs: 1000, value: -0.5, interpolation: 'linear' },
          ],
        }],
      ])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ dimmerOverride: 0.3, intensity: 0.3 })
      const result = overlay.apply(raw, 500)

      // additive: 0.3 + (-0.5) = -0.2 → clamped to 0.0
      expect(result.dimmerOverride).toBe(0)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🎨 COLOR OVERLAY
  // ═════════════════════════════════════════════════════════════════════════

  describe('🎨 Color Overlay', () => {
    test('color curve injects HSL as colorOverride', () => {
      const cyan: HSL = { h: 180, s: 100, l: 50 }
      const magenta: HSL = { h: 300, s: 100, l: 50 }
      const curves = new Map<HephParamId, HephCurve>([
        ['color', {
          paramId: 'color',
          valueType: 'color',
          range: [0, 1],
          defaultValue: cyan,
          mode: 'absolute',
          keyframes: [
            { timeMs: 0, value: cyan, interpolation: 'linear' },
            { timeMs: 1000, value: magenta, interpolation: 'linear' },
          ],
        }],
      ])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({ colorOverride: { h: 0, s: 0, l: 0 } })
      const result = overlay.apply(raw, 500)

      // Midpoint between cyan(180) and magenta(300): should be ~240 (blue)
      expect(result.colorOverride).toBeDefined()
      expect(result.colorOverride!.h).toBeCloseTo(240, 0)
      expect(result.colorOverride!.s).toBe(100)
      expect(result.colorOverride!.l).toBe(50)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🎚️ MOVEMENT OVERLAY
  // ═════════════════════════════════════════════════════════════════════════

  describe('🎚️ Movement Overlay', () => {
    test('pan curve maps 0-1 to movement -1..1', () => {
      const curves = new Map([numCurve('pan', 0, 1, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput()
      
      // At t=0, pan=0 → movement.pan = 0*2-1 = -1
      const start = overlay.apply(raw, 0)
      expect(start.movement?.pan).toBeCloseTo(-1, 2)
      
      // At t=500, pan=0.5 → movement.pan = 0.5*2-1 = 0
      const mid = overlay.apply(raw, 500)
      expect(mid.movement?.pan).toBeCloseTo(0, 2)
      
      // At t=1000, pan=1 → movement.pan = 1*2-1 = 1
      const end = overlay.apply(raw, 1000)
      expect(end.movement?.pan).toBeCloseTo(1, 2)
    })

    test('tilt curve maps 0-1 to movement -1..1', () => {
      const curves = new Map([numCurve('tilt', 0.5, 0.5, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput()
      const result = overlay.apply(raw, 500)

      // tilt=0.5 → movement.tilt = 0.5*2-1 = 0 (center)
      expect(result.movement?.tilt).toBeCloseTo(0, 2)
    })

    test('movement overlay sets isAbsolute=true', () => {
      const curves = new Map([numCurve('pan', 0.5, 0.5, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput()
      const result = overlay.apply(raw, 500)

      expect(result.movement?.isAbsolute).toBe(true)
    })

    test('movement preserves existing movement properties', () => {
      const curves = new Map([numCurve('pan', 0.5, 0.5, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({
        movement: { tilt: 0.3, speed: 0.8, isAbsolute: false },
      })
      const result = overlay.apply(raw, 500)

      // Pan should be overridden
      expect(result.movement?.pan).toBeCloseTo(0, 2)
      // Tilt should be preserved from original
      expect(result.movement?.tilt).toBe(0.3)
      // Speed should be preserved
      expect(result.movement?.speed).toBe(0.8)
      // isAbsolute should be forced to true by overlay
      expect(result.movement?.isAbsolute).toBe(true)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // ⚡ PASS-THROUGH
  // ═════════════════════════════════════════════════════════════════════════

  describe('⚡ Pass-Through', () => {
    test('params without curves are not modified', () => {
      // Only intensity curve, nothing else
      const curves = new Map([numCurve('intensity', 0.5, 0.5, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({
        dimmerOverride: 0.8,
        colorOverride: { h: 120, s: 80, l: 60 },
        whiteOverride: 0.3,
        amberOverride: 0.2,
        strobeRate: 5,
        globalComposition: 0.7,
      })
      const result = overlay.apply(raw, 500)

      // Intensity should be overridden
      expect(result.dimmerOverride).toBeCloseTo(0.5, 2)

      // Everything else should be preserved
      expect(result.colorOverride).toEqual({ h: 120, s: 80, l: 60 })
      expect(result.whiteOverride).toBe(0.3)
      expect(result.amberOverride).toBe(0.2)
      expect(result.strobeRate).toBe(5)
      expect(result.globalComposition).toBe(0.7)
    })

    test('effectId and metadata are preserved', () => {
      const curves = new Map([numCurve('intensity', 0.5, 0.5, 'absolute')])
      const overlay = new HephParameterOverlay(createClip(curves))

      const raw = createRawOutput({
        effectId: 'my-special-effect',
        category: 'color',
        phase: 'decay',
        progress: 0.9,
        zones: ['front', 'movers'],
      })
      const result = overlay.apply(raw, 500)

      expect(result.effectId).toBe('my-special-effect')
      expect(result.category).toBe('color')
      expect(result.phase).toBe('decay')
      expect(result.progress).toBe(0.9)
      expect(result.zones).toEqual(['front', 'movers'])
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🏋️ MULTI-PARAM OVERLAY
  // ═════════════════════════════════════════════════════════════════════════

  describe('🏋️ Multi-Parameter Overlay', () => {
    test('multiple curves applied simultaneously', () => {
      const cyan: HSL = { h: 180, s: 100, l: 50 }
      const curves = new Map<HephParamId, HephCurve>([
        ...([numCurve('intensity', 0, 1, 'absolute')] as Array<[HephParamId, HephCurve]>),
        ...([numCurve('strobe', 0, 0.5, 'absolute')] as Array<[HephParamId, HephCurve]>),
        ...([numCurve('pan', 0, 1, 'absolute')] as Array<[HephParamId, HephCurve]>),
        ['color', {
          paramId: 'color' as HephParamId,
          valueType: 'color' as const,
          range: [0, 1] as [number, number],
          defaultValue: cyan,
          mode: 'absolute' as const,
          keyframes: [
            { timeMs: 0, value: cyan, interpolation: 'linear' as const },
            { timeMs: 1000, value: { h: 0, s: 100, l: 50 } as HSL, interpolation: 'linear' as const },
          ],
        }],
      ])

      const overlay = new HephParameterOverlay(createClip(curves))
      const raw = createRawOutput()
      const result = overlay.apply(raw, 500)

      // Intensity: 0→1 at 50% = 0.5
      expect(result.dimmerOverride).toBeCloseTo(0.5, 2)

      // Strobe: 0→0.5 at 50% = 0.25, mapped to Hz: 0.25 * 18 = 4.5
      expect(result.strobeRate).toBeCloseTo(4.5, 1)

      // Pan: 0→1 at 50% = 0.5, mapped to -1..1: 0
      expect(result.movement?.pan).toBeCloseTo(0, 1)

      // Color: cyan(180)→red(0) midpoint = 90 (or via shortest path)
      expect(result.colorOverride).toBeDefined()
    })
  })
})
