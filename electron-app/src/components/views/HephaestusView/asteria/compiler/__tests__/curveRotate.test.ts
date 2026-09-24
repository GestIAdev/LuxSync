/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 ASTERIA — curveRotate tests (WAVE 8040 · MCC)
 *
 * Property tests obligatorios del blueprint §8.5-1:
 *   1. rot(C, 0) === C — byte a byte (misma referencia devuelta).
 *   2. |rot(C,d)(τ) − C((τ−d) mod D)| < 1e-6 evaluado con el
 *      (🜨 8197: d es RETARDO real — lag, nunca avance).
 *      `CurveEvaluator` DE PRODUCCIÓN — no una reimplementación.
 *
 * Más tests de costura: segmento partido en τ=0/τ=D, wrap D→0 con
 * discontinuidad, degradación bezier→linear SOLO en la costura (D-2).
 *
 * @module asteria/compiler/__tests__/curveRotate
 * @version WAVE 8040
 */

import { describe, test, expect } from 'vitest'
import { rotateCurveCyclic } from '../curveRotate'
import { CurveEvaluator } from '../../../../../../core/hephaestus/CurveEvaluator'
import type { HephCurve, HephKeyframe, HephInterpolation } from '../../../../../../core/hephaestus/types'

const D = 1000

type KfSpec = [timeMs: number, value: number, interp?: HephInterpolation, handles?: [number, number, number, number]]

function numCurve(kfs: KfSpec[]): HephCurve {
  return {
    paramId: 'intensity',
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0,
    keyframes: kfs.map(([timeMs, value, interpolation = 'linear', bezierHandles]) => ({
      timeMs, value, interpolation,
      ...(bezierHandles ? { bezierHandles } : {}),
    })),
    mode: 'absolute',
  }
}

/** Evaluación con el evaluator de producción (instancia fresca por llamada). */
function evalNum(curve: HephCurve, t: number): number {
  const ev = new CurveEvaluator(new Map([[curve.paramId, curve]]), D)
  return ev.getValue(curve.paramId, t)
}

/** Barrido de paridad: rot(τ) ≈ C((τ−d) mod D) en los τ dados (lag). */
function expectParity(src: HephCurve, rot: HephCurve, d: number, taus: number[], eps = 1e-6): void {
  for (const tau of taus) {
    const expected = evalNum(src, ((tau - d) % D + D) % D)
    const actual = evalNum(rot, tau)
    expect(Math.abs(actual - expected), `τ=${tau}`).toBeLessThan(eps)
  }
}

const SWEEP = [0, 25, 100, 250, 499.5, 500, 650, 700, 800, 900, 999, 1000]

describe('🧬 rotateCurveCyclic — invariantes', () => {

  test('INVARIANTE: rot(C, 0) === C — misma referencia, byte a byte', () => {
    const c = numCurve([[0, 0], [500, 1], [1000, 0]])
    const r = rotateCurveCyclic(c, 0, D)
    expect(r).toBe(c)
    expect(JSON.stringify(r)).toBe(JSON.stringify(c))
  })

  test('delay múltiplo de D normaliza a 0 → misma referencia', () => {
    const c = numCurve([[0, 0], [500, 1]])
    expect(rotateCurveCyclic(c, 3000, D)).toBe(c)
  })

  test('curva constante (1 kf) → no-op, misma referencia', () => {
    const c = numCurve([[0, 0.7]])
    expect(rotateCurveCyclic(c, 400, D)).toBe(c)
  })

  test('curva vacía / duración degenerada → misma referencia', () => {
    const empty = numCurve([])
    expect(rotateCurveCyclic(empty, 100, D)).toBe(empty)
    const c = numCurve([[0, 0], [500, 1]])
    expect(rotateCurveCyclic(c, 100, 0)).toBe(c)
  })
})

describe('🧬 rotateCurveCyclic — paridad rot(C,d)(τ) = C((τ−d) mod D)', () => {

  test('curva linear: paridad < 1e-6 en barrido completo (varios delays)', () => {
    const c = numCurve([[0, 0], [500, 1], [1000, 0]])
    for (const d of [1, 250, 333.7, 500, 999]) {
      const rot = rotateCurveCyclic(c, d, D)
      expectParity(c, rot, d, SWEEP)
    }
  })

  test('curva con discontinuidad de wrap (C(D) ≠ C(0)): el salto se reproduce', () => {
    // Último kf en 400 → cola constante 0.9; cabeza constante 0.2 → salto en D→0.
    const c = numCurve([[0, 0.2], [400, 0.9]])
    const rot = rotateCurveCyclic(c, 600, D)
    expectParity(c, rot, 600, SWEEP)
  })

  test('hold: paridad exacta (sub-segmentos hold son constantes)', () => {
    const c = numCurve([[0, 0.1, 'hold'], [300, 0.9, 'hold'], [700, 0.4, 'hold'], [1000, 0.1]])
    const rot = rotateCurveCyclic(c, 450, D)
    expectParity(c, rot, 450, SWEEP)
  })

  test('delay negativo normaliza correctamente', () => {
    const c = numCurve([[0, 0], [500, 1], [1000, 0]])
    const rot = rotateCurveCyclic(c, -250, D) // ≡ d = 750
    expectParity(c, rot, -250, SWEEP)
  })
})

describe('🧬 rotateCurveCyclic — estructura de costura', () => {

  test('inserta keyframe en τ=0 con valor C(D−d) y terminal en τ=D', () => {
    const c = numCurve([[0, 0], [500, 1], [1000, 0]])
    const rot = rotateCurveCyclic(c, 250, D)

    // 🜨 8197: rot(0) = C(−250 mod 1000) = C(750) = 0.5 (triángulo simétrico)
    expect(rot.keyframes[0].timeMs).toBe(0)
    expect(rot.keyframes[0].value).toBeCloseTo(0.5, 6)
    const last = rot.keyframes[rot.keyframes.length - 1]
    expect(last.timeMs).toBe(D)
    expect(last.value).toBeCloseTo(0.5, 6)
  })

  test('keyframes estrictamente ordenados y dentro de [0, D]', () => {
    const c = numCurve([[0, 0.3], [200, 0.8], [600, 0.1], [1000, 0.3]])
    const rot = rotateCurveCyclic(c, 350, D)
    for (let i = 1; i < rot.keyframes.length; i++) {
      expect(rot.keyframes[i].timeMs).toBeGreaterThanOrEqual(rot.keyframes[i - 1].timeMs)
    }
    expect(rot.keyframes[0].timeMs).toBe(0)
    expect(rot.keyframes[rot.keyframes.length - 1].timeMs).toBe(D)
  })

  test('keyframe fuente aterrizando exactamente en D−d → no duplica en τ=0', () => {
    const c = numCurve([[0, 0], [250, 1], [1000, 0]])
    // 🜨 8197: delay 750 → avance equivalente 250 → el kf en s=250 cae en τ=0.
    const rot = rotateCurveCyclic(c, 750, D)
    const atZero = rot.keyframes.filter(k => k.timeMs === 0)
    expect(atZero).toHaveLength(1)
    expect(atZero[0].value).toBe(1) // es el kf fuente, no un interpolado
  })

  test('D-2: bezier en el segmento partido → solo la costura degrada a linear', () => {
    const handles: [number, number, number, number] = [0.42, 0, 0.58, 1]
    const c = numCurve([
      [0, 0, 'bezier', handles],
      [500, 1, 'bezier', handles],
      [1000, 0],
    ])
    const rot = rotateCurveCyclic(c, 250, D)

    // 🜨 8197: d̂ = D−250 = 750 → el segmento partido es (kf1 → kf2):
    // su interp 'bezier' degrada a 'linear' en ambas piezas de la costura.
    // kf@0 (seam derecho) debe ser 'linear'.
    expect(rot.keyframes[0].interpolation).toBe('linear')
    // El clon de kf1 (pieza izquierda, penúltimo antes de T@D) también 'linear'.
    expect(rot.keyframes[rot.keyframes.length - 2].interpolation).toBe('linear')
    // El segmento NO partido (kf0 → kf1) conserva bezier + handles intactos
    // (el clon de kf2 cae en la costura de wrap → 'hold': no cuenta).
    const preserved = rot.keyframes.find(
      k => k.interpolation === 'bezier' && k.bezierHandles !== undefined,
    )
    expect(preserved).toBeDefined()
    expect(preserved!.bezierHandles).toEqual(handles)
  })

  test('paridad bezier en la región NO-costura (<1e-6), aproximada en la costura', () => {
    const handles: [number, number, number, number] = [0.42, 0, 0.58, 1]
    const c = numCurve([
      [0, 0],
      [500, 1, 'bezier', handles],
      [1000, 0, 'bezier', handles],
    ])
    const d = 250
    const rot = rotateCurveCyclic(c, d, D)
    // 🜨 8197: d̂=750 parte el segmento bezier fuente (500→1000). La región
    // τ ∈ (250, 750) ↔ fuente (0, 500) es el segmento NO partido — pero su
    // interp fuente aquí es 'linear' → paridad exacta igualmente.
    expectParity(c, rot, d, [300, 400, 500, 600, 700])
    // Costura en τ=0: rot(0) = C(750) — valor exacto del punto de corte.
    expect(evalNum(rot, 0)).toBeCloseTo(evalNum(c, 750), 6)
  })

  test('no muta la curva fuente', () => {
    const c = numCurve([[0, 0], [500, 1, 'bezier', [0.4, 0, 0.6, 1]], [1000, 0]])
    const snapshot = JSON.stringify(c)
    rotateCurveCyclic(c, 300, D)
    expect(JSON.stringify(c)).toBe(snapshot)
  })

  test('preserva metadata de curva (paramId, valueType, range, mode, defaultValue)', () => {
    const c = numCurve([[0, 0], [500, 1]])
    const rot = rotateCurveCyclic(c, 100, D)
    expect(rot.paramId).toBe('intensity')
    expect(rot.valueType).toBe('number')
    expect(rot.range).toEqual([0, 1])
    expect(rot.mode).toBe('absolute')
    expect(rot.defaultValue).toBe(0)
  })

  test('curva sin kf en 0 (cabeza clamp) — la costura wrap reproduce la meseta', () => {
    // s_0 = 200 > 0: fuente clamp a 0.4 para t ∈ [0, 200).
    const c = numCurve([[200, 0.4], [800, 0.9]])
    const d = 500
    const rot = rotateCurveCyclic(c, d, D)
    // τ* = 500: a la derecha debe valer C(0) = 0.4 (head-clamp)
    expect(evalNum(rot, 600)).toBeCloseTo(0.4, 6)
    expectParity(c, rot, d, [0, 100, 490, 510, 600, 800, 999])
  })
})
