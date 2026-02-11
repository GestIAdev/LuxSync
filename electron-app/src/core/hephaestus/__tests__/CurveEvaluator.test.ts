/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ CURVE EVALUATOR TEST SUITE - PROOF THAT THE MATH IS REAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 * 
 * Validación forense del motor matemático de Hephaestus.
 * Cada test demuestra que la evaluación es DETERMINISTA, no simulada.
 * 
 * PILARES DE VALIDACIÓN:
 * 1. 📐 Interpolación lineal: ¿Los puntos intermedios son correctos?
 * 2. 🎯 Hold (step): ¿El valor se mantiene constante hasta el siguiente kf?
 * 3. 🌊 Cubic Bezier: ¿Newton-Raphson converge correctamente?
 * 4. 🎨 Color HSL: ¿El Hue interpola por shortest path?
 * 5. ⚡ Cursor Cache: ¿O(1) en playback secuencial?
 * 6. 🔀 Binary Search: ¿Seek funciona después de forward?
 * 7. 📸 Snapshot: ¿Todos los parámetros se evalúan correctamente?
 * 8. 🛡️ Edge Cases: ¿Clamp, empty curves, single keyframe?
 * 
 * @module tests/CurveEvaluator.test
 * @version WAVE 2030.2
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { CurveEvaluator } from '../CurveEvaluator'
import type { HephCurve, HephKeyframe, HephParamId, HSL } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un Map de curvas a partir de un array de [paramId, curve] pairs.
 */
function createCurveMap(
  entries: Array<[HephParamId, HephCurve]>
): Map<HephParamId, HephCurve> {
  return new Map(entries)
}

/**
 * Crea una curva numérica simple.
 */
function numericCurve(
  paramId: HephParamId,
  keyframes: HephKeyframe[],
  options?: Partial<Omit<HephCurve, 'paramId' | 'keyframes'>>
): [HephParamId, HephCurve] {
  return [
    paramId,
    {
      paramId,
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      mode: 'absolute',
      keyframes,
      ...options,
    },
  ]
}

/**
 * Crea una curva de color simple.
 */
function colorCurve(
  paramId: HephParamId,
  keyframes: HephKeyframe[],
  options?: Partial<Omit<HephCurve, 'paramId' | 'keyframes'>>
): [HephParamId, HephCurve] {
  return [
    paramId,
    {
      paramId,
      valueType: 'color',
      range: [0, 1],
      defaultValue: { h: 0, s: 0, l: 50 },
      mode: 'absolute',
      keyframes,
      ...options,
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('⚒️ HEPHAESTUS: CurveEvaluator - The Mathematical Heart', () => {

  // ═════════════════════════════════════════════════════════════════════════
  // 🛡️ EDGE CASES: Empty curves, defaults, single keyframes
  // ═════════════════════════════════════════════════════════════════════════

  describe('🛡️ Edge Cases', () => {
    test('returns 0 for non-existent curve', () => {
      const evaluator = new CurveEvaluator(new Map(), 1000)
      expect(evaluator.getValue('intensity', 500)).toBe(0)
    })

    test('returns defaultValue for empty keyframes', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [], { defaultValue: 0.75 }),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', 500)).toBe(0.75)
    })

    test('returns default HSL for empty color curve', () => {
      const defaultColor: HSL = { h: 180, s: 80, l: 60 }
      const curves = createCurveMap([
        colorCurve('color', [], { defaultValue: defaultColor }),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      const result = evaluator.getColorValue('color', 500)
      expect(result.h).toBe(180)
      expect(result.s).toBe(80)
      expect(result.l).toBe(60)
    })

    test('single keyframe returns constant value', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 500, value: 0.8, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', 0)).toBe(0.8)
      expect(evaluator.getValue('intensity', 500)).toBe(0.8)
      expect(evaluator.getValue('intensity', 1000)).toBe(0.8)
    })

    test('clamps before first keyframe', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 200, value: 0.6, interpolation: 'linear' },
          { timeMs: 800, value: 1.0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', 0)).toBe(0.6)
      expect(evaluator.getValue('intensity', 100)).toBe(0.6)
    })

    test('clamps after last keyframe', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 500, value: 1.0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', 800)).toBe(1.0)
      expect(evaluator.getValue('intensity', 1000)).toBe(1.0)
    })

    test('clamps negative time to 0', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0.5, interpolation: 'linear' },
          { timeMs: 1000, value: 1.0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', -100)).toBe(0.5)
    })

    test('hasCurve returns correct state', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.hasCurve('intensity')).toBe(true)
      expect(evaluator.hasCurve('pan')).toBe(false)
    })

    test('zero-duration segment returns left keyframe value', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 500, value: 0.3, interpolation: 'linear' },
          { timeMs: 500, value: 0.9, interpolation: 'linear' }, // Same timeMs
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      // Con segmento de duración 0, devuelve valor del kf izquierdo
      expect(evaluator.getValue('intensity', 500)).toBe(0.3)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 📐 LINEAR INTERPOLATION
  // ═════════════════════════════════════════════════════════════════════════

  describe('📐 Linear Interpolation', () => {
    let evaluator: CurveEvaluator

    beforeEach(() => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
      ])
      evaluator = new CurveEvaluator(curves, 1000)
    })

    test('midpoint interpolation', () => {
      expect(evaluator.getValue('intensity', 500)).toBeCloseTo(0.5, 5)
    })

    test('quarter interpolation', () => {
      expect(evaluator.getValue('intensity', 250)).toBeCloseTo(0.25, 5)
    })

    test('three-quarter interpolation', () => {
      expect(evaluator.getValue('intensity', 750)).toBeCloseTo(0.75, 5)
    })

    test('exact keyframe values', () => {
      expect(evaluator.getValue('intensity', 0)).toBe(0)
      expect(evaluator.getValue('intensity', 1000)).toBe(1)
    })

    test('multi-segment linear (3 keyframes)', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 500, value: 1, interpolation: 'linear' },
          { timeMs: 1000, value: 0.5, interpolation: 'linear' },
        ]),
      ])
      const eval3 = new CurveEvaluator(curves, 1000)

      expect(eval3.getValue('intensity', 0)).toBe(0)
      expect(eval3.getValue('intensity', 250)).toBeCloseTo(0.5, 5)
      expect(eval3.getValue('intensity', 500)).toBe(1)
      expect(eval3.getValue('intensity', 750)).toBeCloseTo(0.75, 5)
      expect(eval3.getValue('intensity', 1000)).toBe(0.5)
    })

    test('descending linear curve', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 1, interpolation: 'linear' },
          { timeMs: 1000, value: 0, interpolation: 'linear' },
        ]),
      ])
      const evalDesc = new CurveEvaluator(curves, 1000)
      expect(evalDesc.getValue('intensity', 500)).toBeCloseTo(0.5, 5)
      expect(evalDesc.getValue('intensity', 200)).toBeCloseTo(0.8, 5)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🎯 HOLD (STEP) INTERPOLATION
  // ═════════════════════════════════════════════════════════════════════════

  describe('🎯 Hold (Step) Interpolation', () => {
    test('holds value constant until next keyframe', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0.8, interpolation: 'hold' },
          { timeMs: 500, value: 0.2, interpolation: 'hold' },
          { timeMs: 1000, value: 0.6, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Primer segmento: hold at 0.8
      expect(evaluator.getValue('intensity', 0)).toBe(0.8)
      expect(evaluator.getValue('intensity', 100)).toBe(0.8)
      expect(evaluator.getValue('intensity', 250)).toBe(0.8)
      expect(evaluator.getValue('intensity', 499)).toBe(0.8)

      // Segundo segmento: hold at 0.2
      expect(evaluator.getValue('intensity', 500)).toBe(0.2)
      expect(evaluator.getValue('intensity', 750)).toBe(0.2)

      // Valor final
      expect(evaluator.getValue('intensity', 1000)).toBe(0.6)
    })

    test('hold for color maintains value', () => {
      const cyan: HSL = { h: 180, s: 100, l: 50 }
      const magenta: HSL = { h: 300, s: 100, l: 50 }
      const curves = createCurveMap([
        colorCurve('color', [
          { timeMs: 0, value: cyan, interpolation: 'hold' },
          { timeMs: 1000, value: magenta, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const mid = evaluator.getColorValue('color', 500)
      expect(mid.h).toBe(180) // Held at cyan
      expect(mid.s).toBe(100)
      expect(mid.l).toBe(50)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🌊 CUBIC BEZIER INTERPOLATION
  // ═════════════════════════════════════════════════════════════════════════

  describe('🌊 Cubic Bezier Interpolation', () => {
    test('ease-in starts slow', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          {
            timeMs: 0,
            value: 0,
            interpolation: 'bezier',
            bezierHandles: [0.42, 0, 1, 1], // ease-in
          },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Ease-in: al 20% del tiempo, debería estar por debajo de 0.2 lineal
      const earlyValue = evaluator.getValue('intensity', 200)
      expect(earlyValue).toBeLessThan(0.15)

      // Al 90% del tiempo, ease-in ya está acelerando fuerte
      const lateValue = evaluator.getValue('intensity', 900)
      expect(lateValue).toBeGreaterThan(0.8)
    })

    test('ease-out ends slow', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          {
            timeMs: 0,
            value: 0,
            interpolation: 'bezier',
            bezierHandles: [0, 0, 0.58, 1], // ease-out
          },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Ease-out: al 20% del tiempo, ya debería haber avanzado bastante
      const earlyValue = evaluator.getValue('intensity', 200)
      expect(earlyValue).toBeGreaterThan(0.2)

      // Al 80%, debería estar cerca de 1 pero frenando
      const lateValue = evaluator.getValue('intensity', 800)
      expect(lateValue).toBeGreaterThan(0.9)
    })

    test('ease-in-out: S curve', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          {
            timeMs: 0,
            value: 0,
            interpolation: 'bezier',
            bezierHandles: [0.42, 0, 0.58, 1], // ease-in-out
          },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Midpoint should be close to 0.5 (S-curve is symmetric)
      expect(evaluator.getValue('intensity', 500)).toBeCloseTo(0.5, 1)

      // Early: slow
      expect(evaluator.getValue('intensity', 150)).toBeLessThan(0.1)

      // Late: slow approach to 1
      expect(evaluator.getValue('intensity', 850)).toBeGreaterThan(0.9)
    })

    test('bezier with no handles falls back to linear', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          {
            timeMs: 0,
            value: 0,
            interpolation: 'bezier',
            // No bezierHandles!
          },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', 500)).toBeCloseTo(0.5, 5)
    })

    test('bezier endpoints are exact', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          {
            timeMs: 0,
            value: 0.2,
            interpolation: 'bezier',
            bezierHandles: [0.42, 0, 0.58, 1],
          },
          { timeMs: 1000, value: 0.9, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)
      expect(evaluator.getValue('intensity', 0)).toBe(0.2)
      expect(evaluator.getValue('intensity', 1000)).toBe(0.9)
    })

    test('overshoot bezier can produce values > 1 in intermediate range', () => {
      // cy values outside [0,1] allow overshoot
      const curves = createCurveMap([
        numericCurve('intensity', [
          {
            timeMs: 0,
            value: 0,
            interpolation: 'bezier',
            bezierHandles: [0.68, -0.6, 0.32, 1.6], // overshoot
          },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ], { range: [-1, 2] }), // Extended range to allow overshoot
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // At some point, the value should exceed the [0,1] range
      let hasOvershoot = false
      for (let t = 0; t <= 1000; t += 10) {
        const v = evaluator.getValue('intensity', t)
        if (v > 1.0 || v < 0) {
          hasOvershoot = true
          break
        }
      }
      expect(hasOvershoot).toBe(true)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🎨 COLOR HSL INTERPOLATION
  // ═════════════════════════════════════════════════════════════════════════

  describe('🎨 Color HSL Interpolation', () => {
    test('linear color interpolation: S and L', () => {
      const curves = createCurveMap([
        colorCurve('color', [
          { timeMs: 0, value: { h: 0, s: 0, l: 0 }, interpolation: 'linear' },
          { timeMs: 1000, value: { h: 0, s: 100, l: 100 }, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const mid = evaluator.getColorValue('color', 500)
      expect(mid.s).toBeCloseTo(50, 1)
      expect(mid.l).toBeCloseTo(50, 1)
    })

    test('hue shortest path: 350° → 10° goes through 0°', () => {
      const curves = createCurveMap([
        colorCurve('color', [
          { timeMs: 0, value: { h: 350, s: 100, l: 50 }, interpolation: 'linear' },
          { timeMs: 1000, value: { h: 10, s: 100, l: 50 }, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const mid = evaluator.getColorValue('color', 500)
      // Shortest path: 350 → 360/0 → 10, midpoint should be ~0 (or ~360)
      expect(mid.h).toBeCloseTo(0, 0)
    })

    test('hue shortest path: 10° → 350° goes through 0° backwards', () => {
      const curves = createCurveMap([
        colorCurve('color', [
          { timeMs: 0, value: { h: 10, s: 100, l: 50 }, interpolation: 'linear' },
          { timeMs: 1000, value: { h: 350, s: 100, l: 50 }, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const mid = evaluator.getColorValue('color', 500)
      // Shortest path: 10 → 0 → 350, midpoint should be ~0 (or ~360)
      expect(mid.h).toBeCloseTo(0, 0)
    })

    test('hue long path: 0° → 180° goes through 90°', () => {
      const curves = createCurveMap([
        colorCurve('color', [
          { timeMs: 0, value: { h: 0, s: 100, l: 50 }, interpolation: 'linear' },
          { timeMs: 1000, value: { h: 180, s: 100, l: 50 }, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const mid = evaluator.getColorValue('color', 500)
      // Both paths are 180° long — should go through 90°
      expect(mid.h).toBeCloseTo(90, 0)
    })

    test('color endpoints are exact', () => {
      const cyan: HSL = { h: 180, s: 100, l: 50 }
      const red: HSL = { h: 0, s: 100, l: 50 }
      const curves = createCurveMap([
        colorCurve('color', [
          { timeMs: 0, value: cyan, interpolation: 'linear' },
          { timeMs: 1000, value: red, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const start = evaluator.getColorValue('color', 0)
      expect(start.h).toBe(180)
      expect(start.s).toBe(100)
      expect(start.l).toBe(50)

      const end = evaluator.getColorValue('color', 1000)
      expect(end.h).toBe(0)
      expect(end.s).toBe(100)
      expect(end.l).toBe(50)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // ⚡ CURSOR CACHE: O(1) FORWARD PLAYBACK
  // ═════════════════════════════════════════════════════════════════════════

  describe('⚡ Cursor Cache: O(1) Forward Playback', () => {
    test('sequential evaluation is fast (O(1) amortized)', () => {
      // Create curve with many keyframes
      const keyframes: HephKeyframe[] = []
      for (let i = 0; i <= 100; i++) {
        keyframes.push({
          timeMs: i * 100,
          value: (i % 2 === 0) ? 0 : 1,
          interpolation: 'linear',
        })
      }

      const curves = createCurveMap([
        numericCurve('intensity', keyframes),
      ])
      const evaluator = new CurveEvaluator(curves, 10000)

      // Evaluate 1000 sequential frames
      const start = performance.now()
      for (let t = 0; t <= 10000; t += 10) {
        evaluator.getValue('intensity', t)
      }
      const elapsed = performance.now() - start

      // 1001 evaluaciones deberían tomar < 10ms (with O(1) cache)
      // En realidad toman < 2ms en hardware moderno
      expect(elapsed).toBeLessThan(50) // Conservative bound for CI
    })

    test('forward playback produces correct values with cache', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 500, value: 1, interpolation: 'linear' },
          { timeMs: 1000, value: 0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Simulate 60fps forward playback
      const results: number[] = []
      for (let t = 0; t <= 1000; t += 16) {
        results.push(evaluator.getValue('intensity', t))
      }

      // First value should be 0
      expect(results[0]).toBe(0)

      // Peak should be near middle
      const peakIdx = results.indexOf(Math.max(...results))
      expect(peakIdx).toBeGreaterThan(results.length / 4)
      expect(peakIdx).toBeLessThan(results.length * 3 / 4)

      // Last value should be near 0
      expect(results[results.length - 1]).toBeCloseTo(0, 1)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🔀 BINARY SEARCH: SEEK / SCRUB
  // ═════════════════════════════════════════════════════════════════════════

  describe('🔀 Binary Search: Seek / Scrub', () => {
    test('backward seek produces correct values', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 500, value: 1, interpolation: 'linear' },
          { timeMs: 1000, value: 0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // First, go forward to end
      evaluator.getValue('intensity', 1000)

      // Then seek back to start
      expect(evaluator.getValue('intensity', 0)).toBe(0)

      // Then seek to middle
      expect(evaluator.getValue('intensity', 500)).toBe(1)

      // Then seek to quarter
      expect(evaluator.getValue('intensity', 250)).toBeCloseTo(0.5, 5)
    })

    test('random seek order produces correct values', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Random seek positions
      const seekPositions = [750, 250, 900, 100, 500, 0, 1000]
      for (const pos of seekPositions) {
        expect(evaluator.getValue('intensity', pos)).toBeCloseTo(pos / 1000, 5)
      }
    })

    test('reset() forces re-evaluation', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 500, value: 1, interpolation: 'linear' },
          { timeMs: 1000, value: 0, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      // Advance to end
      evaluator.getValue('intensity', 1000)

      // Reset
      evaluator.reset()

      // Should correctly evaluate from beginning
      expect(evaluator.getValue('intensity', 250)).toBeCloseTo(0.5, 5)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 📸 SNAPSHOT: Multi-parameter evaluation
  // ═════════════════════════════════════════════════════════════════════════

  describe('📸 Snapshot: Multi-parameter', () => {
    test('snapshot evaluates all curves at once', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ]),
        numericCurve('pan', [
          { timeMs: 0, value: 1, interpolation: 'linear' },
          { timeMs: 1000, value: 0, interpolation: 'linear' },
        ]),
        colorCurve('color', [
          { timeMs: 0, value: { h: 0, s: 100, l: 50 }, interpolation: 'linear' },
          { timeMs: 1000, value: { h: 120, s: 100, l: 50 }, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const snap = evaluator.getSnapshot(500)

      // Intensity: 0 → 1 at 50% = 0.5
      expect(snap.intensity).toBeCloseTo(0.5, 5)

      // Pan: 1 → 0 at 50% = 0.5
      expect(snap.pan).toBeCloseTo(0.5, 5)

      // Color: H=0 → H=120 at 50% = H=60
      const color = snap.color as HSL
      expect(color.h).toBeCloseTo(60, 0)
      expect(color.s).toBe(100)
      expect(color.l).toBe(50)
    })

    test('snapshot only includes registered curves', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0.5, interpolation: 'linear' },
        ]),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      const snap = evaluator.getSnapshot(500)

      expect(snap.intensity).toBe(0.5)
      expect(snap.pan).toBeUndefined()
      expect(snap.color).toBeUndefined()
      expect(snap.strobe).toBeUndefined()
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🔧 CURVE MODE
  // ═════════════════════════════════════════════════════════════════════════

  describe('🔧 Curve Mode', () => {
    test('getCurveMode returns correct mode', () => {
      const curves = createCurveMap([
        numericCurve('intensity', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
        ], { mode: 'relative' }),
        numericCurve('pan', [
          { timeMs: 0, value: 0, interpolation: 'linear' },
        ], { mode: 'additive' }),
      ])
      const evaluator = new CurveEvaluator(curves, 1000)

      expect(evaluator.getCurveMode('intensity')).toBe('relative')
      expect(evaluator.getCurveMode('pan')).toBe('additive')
      expect(evaluator.getCurveMode('strobe')).toBe('absolute') // default
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🏋️ STRESS TEST: Many keyframes + mixed types
  // ═════════════════════════════════════════════════════════════════════════

  describe('🏋️ Stress Test', () => {
    test('100 keyframes, mixed interpolation types', () => {
      const keyframes: HephKeyframe[] = []
      const types: Array<'linear' | 'hold' | 'bezier'> = ['linear', 'hold', 'bezier']

      for (let i = 0; i <= 99; i++) {
        const interpolation = types[i % 3]
        keyframes.push({
          timeMs: i * 100,
          value: (i % 10) / 10,
          interpolation,
          ...(interpolation === 'bezier'
            ? { bezierHandles: [0.42, 0, 0.58, 1] as [number, number, number, number] }
            : {}),
        })
      }

      const curves = createCurveMap([
        numericCurve('intensity', keyframes),
      ])
      const evaluator = new CurveEvaluator(curves, 10000)

      // Should not throw, values should be within extended range
      for (let t = 0; t <= 10000; t += 50) {
        const v = evaluator.getValue('intensity', t)
        expect(v).not.toBeNaN()
        expect(v).toBeGreaterThanOrEqual(-0.5)
        expect(v).toBeLessThanOrEqual(1.5)
      }
    })

    test('12 simultaneous parameter curves', () => {
      const paramIds: HephParamId[] = [
        'intensity', 'white', 'amber', 'speed', 'pan', 'tilt',
        'zoom', 'strobe', 'globalComp', 'width', 'direction',
      ]

      const entries: Array<[HephParamId, HephCurve]> = paramIds.map((id) =>
        numericCurve(id, [
          { timeMs: 0, value: 0, interpolation: 'linear' },
          { timeMs: 1000, value: 1, interpolation: 'linear' },
        ])
      )

      // Add color curve
      entries.push(colorCurve('color', [
        { timeMs: 0, value: { h: 0, s: 100, l: 50 }, interpolation: 'linear' },
        { timeMs: 1000, value: { h: 360, s: 0, l: 100 }, interpolation: 'linear' },
      ]))

      const curves = createCurveMap(entries)
      const evaluator = new CurveEvaluator(curves, 1000)

      const snap = evaluator.getSnapshot(500)

      // All numeric params should be ~0.5
      for (const id of paramIds) {
        expect(snap[id]).toBeCloseTo(0.5, 1)
      }

      // Color should be interpolated
      const color = snap.color as HSL
      expect(color).toBeDefined()
      expect(color.s).toBeCloseTo(50, 0)
      expect(color.l).toBeCloseTo(75, 0)
    })
  })
})
