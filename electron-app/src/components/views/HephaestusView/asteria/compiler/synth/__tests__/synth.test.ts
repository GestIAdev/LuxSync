/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA — synth tests (WAVE 8191 · Crux 3 — Arsenal de Síntesis)
 *
 * Gates del blueprint ASTERIA_CRUX_RESOLUTION §5:
 *   G-SYN-COMPAT — wrappers de compatibilidad generan curvas idénticas a
 *                  la V1 (byte a byte — las recetas duras se verifican
 *                  contra las constantes literales de la implementación
 *                  pre-refactor).
 *   G-SYN-SHAPE  — cada forma × duty ∈ {0.03, 0.5, 1}: keyframes ASC,
 *                  dentro de range, cierre C⁰ (exenta `square`), nº de
 *                  keyframes según la tabla §4.3 (con dedupe de puntos
 *                  idénticos en (t,v) documentado en envelopes.ts).
 *   G-SYN-ROT    — rotateCurveCyclic preserva las 8 formas: paridad
 *                  < 1e-6 con el CurveEvaluator de producción, salvo la
 *                  costura bezier de `sine` (D-2 aceptada).
 *
 * @module asteria/compiler/synth/__tests__/synth
 * @version WAVE 8191
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, test, expect } from 'vitest'
import { envelope, specKey, resolveSpec } from '../envelopes'
import { materialize } from '../materialize'
import { synthesizeLambdaPulse, synthesizeColorLut } from '../../lutSynth'
import { rotateCurveCyclic } from '../../curveRotate'
import { CurveEvaluator } from '../../../../../../../core/hephaestus/CurveEvaluator'
import type { SynthShape, SynthSpec } from '../SynthSpec'
import type { HephCurve } from '../../../../../../../core/hephaestus/types'
import { SYNTH_SHAPES } from '../SynthSpec'

const D = 4000

/** Evaluación con el evaluator DE PRODUCCIÓN (instancia fresca). */
function evalNum(curve: HephCurve, t: number): number {
  const ev = new CurveEvaluator(new Map([[curve.paramId, curve]]), D)
  return ev.getValue(curve.paramId, t)
}

// ═════════════════════════════════════════════════════════════════════════════
// G-SYN-COMPAT — los wrappers reproducen la V1 byte a byte
// ═════════════════════════════════════════════════════════════════════════════

describe('G-SYN-COMPAT — wrappers ≡ V1', () => {
  test('synthesizeLambdaPulse: keyframes literales de la V1 (0/8/28/42/100 %)', () => {
    const c = synthesizeLambdaPulse('intensity', D)
    expect(c.paramId).toBe('intensity')
    expect(c.valueType).toBe('number')
    expect(c.range).toEqual([0, 1])
    expect(c.defaultValue).toBe(0)
    expect(c.mode).toBe('absolute')
    expect(c.keyframes).toEqual([
      { timeMs: 0, value: 0, interpolation: 'linear' },
      { timeMs: Math.round(D * 0.08), value: 1, interpolation: 'linear' },
      { timeMs: Math.round(D * 0.28), value: 1, interpolation: 'linear' },
      { timeMs: Math.round(D * 0.42), value: 0, interpolation: 'linear' },
      { timeMs: D, value: 0, interpolation: 'linear' },
    ])
  })

  test('synthesizeLambdaPulse: paridad literal en D exóticos (incl. boundary 0.42·D = x.5)', () => {
    for (const d of [1, 25, 75, 125, 999, 1000, 3333]) {
      const c = synthesizeLambdaPulse('zoom', d)
      expect(c.keyframes.map((k) => k.timeMs)).toEqual([
        0,
        Math.round(d * 0.08),
        Math.round(d * 0.28),
        Math.round(d * 0.42),
        Math.max(1, d),
      ])
    }
  })

  test('synthesizeColorLut: pulso monocromático V1 — H/S del target, L en geometría Λ', () => {
    const c = synthesizeColorLut(D, '#0080ff') // h=210, s=100, l=50
    expect(c.paramId).toBe('color')
    expect(c.valueType).toBe('color')
    expect(c.range).toEqual([0, 360])
    expect(c.defaultValue).toEqual({ h: 210, s: 100, l: 0 })
    expect(c.keyframes).toEqual([
      { timeMs: 0, value: { h: 210, s: 100, l: 0 }, interpolation: 'linear' },
      { timeMs: Math.round(D * 0.08), value: { h: 210, s: 100, l: 50 }, interpolation: 'linear' },
      { timeMs: Math.round(D * 0.28), value: { h: 210, s: 100, l: 50 }, interpolation: 'linear' },
      { timeMs: Math.round(D * 0.42), value: { h: 210, s: 100, l: 0 }, interpolation: 'linear' },
      { timeMs: D, value: { h: 210, s: 100, l: 0 }, interpolation: 'linear' },
    ])
  })

  test('envelope(pulse) es estable: misma referencia memoizada por specKey', () => {
    expect(envelope({ shape: 'pulse' })).toBe(envelope({ shape: 'pulse' }))
    expect(specKey({ shape: 'pulse' })).toBe(specKey({ shape: 'pulse', duty: 0.42 }))
    expect(specKey({ shape: 'pulse' })).not.toBe(specKey({ shape: 'pulse', duty: 0.5 }))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// G-SYN-SHAPE — verificación matemática de las 8 formas
// ═════════════════════════════════════════════════════════════════════════════

/** nº de keyframes esperado por (shape, duty) — tabla §4.3 con dedupe. */
const EXPECTED_KFS: Record<SynthShape, Record<string, number>> = {
  pulse: { '0.03': 5, '0.5': 5, '1': 4 },        // w=1: (1,0)≡(1,0) dedupe
  triangle: { '0.03': 4, '0.5': 4, '1': 3 },
  'ramp-up': { '0.03': 4, '0.5': 4, '1': 3 },    // w=1: (1,0)≡(1,0) dedupe
  'ramp-down': { '0.03': 4, '0.5': 4, '1': 3 },
  square: { '0.03': 3, '0.5': 3, '1': 2 },       // w=1: ON todo el ciclo
  sine: { '0.03': 4, '0.5': 4, '1': 3 },
  laser: { '0.03': 4, '0.5': 4, '1': 3 },
  hold: { '0.03': 1, '0.5': 1, '1': 1 },
}

describe('G-SYN-SHAPE — invariantes de las 8 formas', () => {
  for (const shape of SYNTH_SHAPES) {
    for (const duty of [0.03, 0.5, 1]) {
      test(`${shape} @ duty=${duty}: ASC · range · C⁰ · nº kf`, () => {
        const spec: SynthSpec = { shape, duty }
        const curve = materialize(envelope(spec), 'intensity', D)
        const kfs = curve.keyframes

        // nº de keyframes según tabla §4.3
        expect(kfs.length).toBe(EXPECTED_KFS[shape][String(duty)])

        // orden ASC no estricto + dentro de [0, D]
        for (let i = 0; i < kfs.length; i++) {
          expect(kfs[i].timeMs).toBeGreaterThanOrEqual(0)
          expect(kfs[i].timeMs).toBeLessThanOrEqual(D)
          const v = kfs[i].value
          expect(typeof v).toBe('number')
          expect(v as number).toBeGreaterThanOrEqual(0)
          expect(v as number).toBeLessThanOrEqual(1)
          if (i > 0) {
            expect(kfs[i].timeMs).toBeGreaterThanOrEqual(kfs[i - 1].timeMs)
          }
        }

        // Cierre C⁰: C(D) === C(0) — 'square' exenta (su salto ES el wrap)
        if (shape !== 'square') {
          expect(evalNum(curve, D)).toBeCloseTo(evalNum(curve, 0), 6)
        } else {
          expect(evalNum(curve, 0)).toBe(1)
          expect(evalNum(curve, D)).toBe(0)
        }
      })
    }
  }

  test('laser: flancos duros de ε=1 ms — subida en [0,1 ms], meseta, corte en w', () => {
    const curve = materialize(envelope({ shape: 'laser' }), 'intensity', D)
    // w = 0.04 → 160 ms. kfs: 0:0 hold · 1:1 hold · 160:0 hold · D:0
    expect(curve.keyframes.map((k) => k.timeMs)).toEqual([0, 1, 160, D])
    expect(evalNum(curve, 0)).toBe(0)
    expect(evalNum(curve, 1)).toBe(1)   // flanco duro superado
    expect(evalNum(curve, 80)).toBe(1)  // meseta
    expect(evalNum(curve, 160)).toBe(0) // corte
    expect(evalNum(curve, 161)).toBe(0)
  })

  test('ramp-up: sube lineal a w, caída dura de 1 ms', () => {
    const curve = materialize(envelope({ shape: 'ramp-up' }), 'intensity', D)
    // w=0.5 → kfs: 0:0 · 2000:1 hold · 2001:0 · D:0
    expect(curve.keyframes.map((k) => k.timeMs)).toEqual([0, 2000, 2001, D])
    expect(evalNum(curve, 1000)).toBeCloseTo(0.5, 6)
    expect(evalNum(curve, 2000)).toBe(1)
    expect(evalNum(curve, 2001)).toBe(0)
  })

  test('ramp-down: subida dura de 1 ms, caída lineal a w', () => {
    const curve = materialize(envelope({ shape: 'ramp-down' }), 'intensity', D)
    // kfs: 0:0 · 1:1 · 2000:0 · D:0
    expect(curve.keyframes.map((k) => k.timeMs)).toEqual([0, 1, 2000, D])
    expect(evalNum(curve, 1)).toBe(1)
    // punto medio exacto del segmento linear [1, 2000] → t=1000.5
    expect(evalNum(curve, 1000.5)).toBeCloseTo(0.5, 6)
  })

  test('square: meseta ON [0,w), OFF el resto — wrap discontinuo intencional', () => {
    const curve = materialize(envelope({ shape: 'square' }), 'intensity', D)
    expect(curve.keyframes.map((k) => k.timeMs)).toEqual([0, 2000, D])
    expect(evalNum(curve, 0)).toBe(1)
    expect(evalNum(curve, 1999)).toBe(1)
    expect(evalNum(curve, 2000)).toBe(0)
    expect(evalNum(curve, 3999)).toBe(0)
  })

  test('sine: campana bezier — C(0)=0, pico suave en w/2, simetría aproximada', () => {
    const curve = materialize(envelope({ shape: 'sine' }), 'intensity', D)
    expect(curve.keyframes[0].interpolation).toBe('bezier')
    expect(curve.keyframes[0].bezierHandles).toEqual([0.42, 0, 0.58, 1])
    expect(evalNum(curve, 0)).toBe(0)
    expect(evalNum(curve, 2000)).toBe(1)
    // simetría de la campana (ease-in-out es simétrica)
    expect(evalNum(curve, 1000)).toBeCloseTo(evalNum(curve, 3000), 6)
  })

  test('hold: constante — 1 keyframe, valor techo', () => {
    const curve = materialize(envelope({ shape: 'hold' }), 'intensity', D)
    expect(curve.keyframes).toHaveLength(1)
    expect(evalNum(curve, 0)).toBe(1)
    expect(evalNum(curve, D / 2)).toBe(1)
  })

  test('floor/ceil remapean la envolvente a [floor, ceil]', () => {
    const curve = materialize(
      envelope({ shape: 'triangle', floor: 0.2, ceil: 0.8 }),
      'intensity',
      D,
    )
    expect(evalNum(curve, 0)).toBeCloseTo(0.2, 6)
    expect(evalNum(curve, 1000)).toBeCloseTo(0.8, 6) // w/2 = 0.25·D
  })

  test('edge<1 ablanda el flanco duro (laser): sin shiftMs, rampa linear', () => {
    const hard = envelope({ shape: 'laser' })
    const soft = envelope({ shape: 'laser', edge: 0 })
    expect(hard.some((p) => p.shiftMs === 1)).toBe(true)
    expect(soft.every((p) => p.interp === 'linear')).toBe(true)
    expect(soft.every((p) => p.shiftMs === undefined)).toBe(true)
  })

  test('materialize color: la envolvente modula L, H/S constantes', () => {
    const curve = materialize(
      envelope({ shape: 'triangle' }),
      'color',
      D,
      { h: 120, s: 80, l: 60 },
    )
    expect(curve.valueType).toBe('color')
    const peak = curve.keyframes.find((k) => k.timeMs === 1000)!
    expect(peak.value).toEqual({ h: 120, s: 80, l: 60 })
    for (const kf of curve.keyframes) {
      const v = kf.value as { h: number; s: number; l: number }
      expect(v.h).toBe(120)
      expect(v.s).toBe(80)
      expect(v.l).toBeGreaterThanOrEqual(0)
      expect(v.l).toBeLessThanOrEqual(60)
    }
  })

  test('resolveSpec: defaults por forma + clamps (duty 0 → 0.01, floor>ceil swap)', () => {
    expect(resolveSpec({ shape: 'laser' }).duty).toBe(0.04)
    expect(resolveSpec({ shape: 'pulse' }).duty).toBe(0.42)
    expect(resolveSpec({ shape: 'pulse', duty: 0 }).duty).toBe(0.01)
    const swapped = resolveSpec({ shape: 'pulse', floor: 0.9, ceil: 0.2 })
    expect(swapped.floor).toBe(0.2)
    expect(swapped.ceil).toBe(0.9)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// G-SYN-ROT — rotación cíclica sobre las 8 formas
// ═════════════════════════════════════════════════════════════════════════════

const SWEEP = [0, 25, 100, 250, 499.5, 500, 650, 700, 800, 900, 999, 1000].map(
  (t) => (t * D) / 1000,
)

function expectParity(
  src: HephCurve,
  rot: HephCurve,
  d: number,
  taus: number[],
  eps = 1e-6,
): void {
  for (const tau of taus) {
    const expected = evalNum(src, ((tau - d) % D + D) % D)
    const actual = evalNum(rot, tau)
    expect(Math.abs(actual - expected), `τ=${tau}`).toBeLessThan(eps)
  }
}

describe('G-SYN-ROT — rotateCurveCyclic sobre las 8 formas', () => {
  for (const shape of SYNTH_SHAPES) {
    test(`${shape}: paridad rot(C,d)(τ) = C((τ−d) mod D)`, () => {
      const src = materialize(envelope({ shape }), 'intensity', D)
      if (shape === 'sine') {
        // D-2: la costura degrada bezier→linear — paridad exacta solo en
        // la región NO partida. 🜨 8197: d=1500 (retardo) corta en el
        // avance equivalente d̂=2500 → dentro del segundo segmento bezier
        // (2000→4000); el primero (0→2000) queda intacto.
        const d = 1500
        const rot = rotateCurveCyclic(src, d, D)
        // τ ∈ (1500, 3500) ↔ fuente (0, 2000) — segmento intacto
        expectParity(src, rot, d, [1600, 2000, 2500, 3000, 3400], 1e-6)
        // costura: aproximación linear, forma general preservada
        expectParity(src, rot, d, [0, 200, 400, 600, 1000, 1400, 3600, 3900], 0.35)
        return
      }
      for (const d of [1, 250, 777.7, 1500, 3999]) {
        const rot = rotateCurveCyclic(src, d, D)
        expectParity(src, rot, d, SWEEP)
      }
    })
  }

  test('las 8 formas rotadas conservan extremos (rot(0)=rot(D)=C(D−d) por construcción)', () => {
    for (const shape of SYNTH_SHAPES) {
      const src = materialize(envelope({ shape }), 'intensity', D)
      const rot = rotateCurveCyclic(src, 1370, D)
      expect(evalNum(rot, D)).toBeCloseTo(evalNum(rot, 0), 6)
    }
  })

  test('square rotada: la discontinuidad del wrap sobrevive como salto interior', () => {
    // 🜨 8197: retardo → el salto de bajada fuente en t=w=2000 cae en
    // τ = 2000+1370 = 3370 (la fuente llega 1370 ms tarde).
    const src = materialize(envelope({ shape: 'square' }), 'intensity', D)
    const rot = rotateCurveCyclic(src, 1370, D)
    expect(evalNum(rot, 3360)).toBeGreaterThan(0.9) // ON (fuente ~1990)
    expect(evalNum(rot, 3380)).toBeLessThan(0.1)    // OFF (fuente ~2010)
  })
})
