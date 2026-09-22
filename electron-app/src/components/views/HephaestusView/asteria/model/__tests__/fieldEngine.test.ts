/**
 * 🜨 WAVE 8030-P2 — Tests del FieldEngine (motor de campos de Asteria)
 *
 * Cubre: buffers pre-asignados e in-place (zero-alloc), reset a la
 * identidad por evaluate, escritura del gesto `base`, resolución de
 * máscaras para kinds no implementados, tolerancia a nodeIds huérfanos.
 */

import { describe, test, expect } from 'vitest'
import { createFieldEngine, evaluateStack } from '../fieldEngine'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { Gesture } from '../AsteriaProject'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function entry(nodeId: string, x?: number, z?: number): NodeAtlasEntry {
  return {
    nodeId,
    deviceId: nodeId.split(':')[0],
    cellSuffix: nodeId.includes(':') ? nodeId.slice(nodeId.indexOf(':') + 1) : nodeId,
    family: 'IMPACT',
    zoneId: 'front',
    position: x !== undefined && z !== undefined ? { x, y: 3, z } : undefined,
    role: 'cell',
  }
}

function makeAtlas(): NodeAtlas {
  const entries = [
    entry('fx-1:impact', -2, -1),
    entry('fx-1:color', -2, -1),
    entry('fx-2:petal-l:impact', 1.5, 2),
    entry('fx-3:impact'), // sin posición — el motor debe tolerarlo
  ]
  const byNodeId = new Map(entries.map((e) => [e.nodeId, e]))
  return { entries, byNodeId }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 FieldEngine — WAVE 8030-P2', () => {
  test('identidad: pila vacía → delay 0, gain 1, mask 0', () => {
    const snap = evaluateStack([], makeAtlas())
    expect(snap.count).toBe(4)
    expect(Array.from(snap.delayMs)).toEqual([0, 0, 0, 0])
    expect(Array.from(snap.gain)).toEqual([1, 1, 1, 1])
    expect(Array.from(snap.mask)).toEqual([0, 0, 0, 0])
  })

  test('base: escribe delay/gain uniforme y cubre todos los nodos', () => {
    const stack: Gesture[] = [{ kind: 'base', id: 'b1', delayMs: 120, gain: 0.5 }]
    const snap = evaluateStack(stack, makeAtlas())
    expect(Array.from(snap.delayMs)).toEqual([120, 120, 120, 120])
    expect(Array.from(snap.gain)).toEqual([0.5, 0.5, 0.5, 0.5])
    expect(Array.from(snap.mask)).toEqual([1, 1, 1, 1])
  })

  test('glyph (WAVE 8050): nodos fuera del rect del texto no se cubren', () => {
    // 'LX' en (0,0) scaleM=1 → rect ≈ 1.57×1 m centrado; fx-1 (-2,-1) y
    // fx-2 (1.5,2) quedan fuera → cobertura 0 → máscara 0.
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'LX',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        transform: { x: 0, z: 0, scaleM: 1, rotDeg: 0 },
        channel: 'gain', antialias: true,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([0, 0, 0, 0])
    expect(Array.from(snap.delayMs)).toEqual([0, 0, 0, 0])
  })

  // ── GLYPH (§T5/WAVE 8050): cobertura → gain / barrido → delay ──

  test('glyph gain: la cobertura del píxel escribe gain; fuera → sin cubrir', () => {
    // Atlas: a en (0,0) → celda (2,3) del tallo de 'I'; b en (-0.4,0)
    // → celda (0,3) vacía. 'I' scaleM=1.4 → celda 0.2 m.
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0), entry('b:cell', -0.4, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell', 'b:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'gain', antialias: false,
      },
    ]
    const snap = evaluateStack(stack, atlas)
    expect(snap.gain[0]).toBe(1)      // sobre el tallo
    expect(snap.gain[1]).toBe(1)      // fuera → identidad (no pisado)
    expect(Array.from(snap.mask)).toEqual([1, 0])
    expect(snap.delayMs[0]).toBe(0)   // canal gain no toca delay
  })

  test('glyph delay: barrido — delay = u·celda·1000 ms (1 m/s)', () => {
    // a en x=0 → u=2.5 celdas → 0.5 m desde el borde → 500 ms
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'delay', antialias: false,
      },
    ]
    const snap = evaluateStack(stack, atlas)
    expect(snap.delayMs[0]).toBeCloseTo(500, 3)
    expect(snap.gain[0]).toBe(1) // canal delay no toca gain
    expect(snap.mask[0]).toBe(1)
  })

  // ── WAVE (§5.2/T4): delay = dist/speed·1000 ──

  test('wave point: delay = dist euclídea / speedMps · 1000', () => {
    // fx-1 en (-2,-1), fx-2 en (1.5,2); emisor en (0,0), 10 m/s
    // dist(fx-1) = √5 ≈ 2.2361 m → 223.6 ms ; dist(fx-2) = 2.5 m → 250 ms
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[0]).toBeCloseTo(Math.sqrt(5) * 100, 3)
    expect(snap.delayMs[2]).toBeCloseTo(250, 3)
    expect(snap.mask[3]).toBe(0) // fx-3 sin posición: sin cobertura
    // Sin falloffM → gain no tocado (identidad)
    expect(snap.gain[0]).toBe(1)
  })

  test('wave falloffM: gain = max(0, 1 - dist/falloffM)', () => {
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // dist = 2.5 m
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10, falloffM: 5,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.gain[2]).toBeCloseTo(0.5, 4) // 1 - 2.5/5
  })

  test('wave line: proyección sobre dirDeg; detrás del plano → 0', () => {
    // dir 0° = +X. fx-2 en x=1.5 → dist 1.5 → 150 ms a 10 m/s.
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'line', dirDeg: 0, speedMps: 10,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[2]).toBeCloseTo(150, 3)
    expect(snap.delayMs[0]).toBe(0) // fx-1 en x=-2: detrás del frente
  })

  test('wave huygens: min(dist) a cualquier emisor', () => {
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // en (1.5, 2)
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
        huygens: [{ x: 1.5, z: 0 }], // a 2 m del nodo vs 2.5 m del primario
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[2]).toBeCloseTo(200, 3)
  })

  // ── CHRONO (§5.2/T3): tMs del punto más cercano ≤ radiusM ──

  test('chrono captureRealTime: delay = tMs del punto más cercano', () => {
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact'] },
        stroke: [
          { x: -2, z: -1, tMs: 0 },     // justo sobre fx-1
          { x: 1.5, z: 2.2, tMs: 800 }, // cerca de fx-2 (0.2 m)
        ],
        captureRealTime: true,
        radiusM: 0.5,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(0)
    expect(snap.delayMs[2]).toBe(800)
    expect(snap.mask[2]).toBe(1)
  })

  test('chrono: nodo fuera del radio no recibe cobertura ni delay', () => {
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // en (1.5, 2)
        stroke: [{ x: 10, z: 10, tMs: 500 }],
        captureRealTime: true,
        radiusM: 0.5,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.mask[2]).toBe(0)
    expect(snap.delayMs[2]).toBe(0)
  })

  test('chrono arcLength: reparametriza a velocidad constante', () => {
    // Trazo: (0,0)→(3,0) t=0ms, (3,0)→(4,0) t=900ms.
    // Real: pt1 t=900. Arc: arcLen total=4m, pt1 a 3m → 3/4·900=675ms.
    const atlas: NodeAtlas = (() => {
      const e = [entry('fx-a:impact', 3, 0.1)]
      return { entries: e, byNodeId: new Map(e.map((x) => [x.nodeId, x])) }
    })()
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-a:impact'] },
        stroke: [
          { x: 0, z: 0, tMs: 0 },
          { x: 3, z: 0, tMs: 900 },
          { x: 4, z: 0, tMs: 1000 },
        ],
        captureRealTime: false,
        radiusM: 0.5,
      },
    ]
    const snap = evaluateStack(stack, atlas)
    expect(snap.delayMs[0]).toBeCloseTo(750, 1) // 3/4 de 1000 ms
  })

  // ── MANUAL: entries directas ──

  test('manual: escribe delay/gain por entry, respeta canal parcial', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 10, gain: 0.5 },
      {
        kind: 'manual', id: 'm1',
        entries: [
          { nodeId: 'fx-1:impact', delayMs: 999 },              // solo delay
          { nodeId: 'fx-1:color', gain: 0.25 },                 // solo gain
          { nodeId: 'fx-2:petal-l:impact', delayMs: 5, gain: 2 },
        ],
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(999)
    expect(snap.gain[0]).toBe(0.5)    // gain intacto (canal delay only)
    expect(snap.delayMs[1]).toBe(10)  // delay intacto (canal gain only)
    expect(snap.gain[1]).toBe(0.25)
    expect(snap.delayMs[2]).toBe(5)
    expect(snap.gain[2]).toBe(2)
    // fx-3 no listado en manual: conserva los valores del base
    expect(snap.delayMs[3]).toBe(10)
    expect(snap.gain[3]).toBe(0.5)
  })

  test('blend ops: wave con op=add suma sobre el delay del base', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 100, gain: 1 },
      {
        kind: 'wave', id: 'w1', op: 'add',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // dist 2.5 m a 10 m/s
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[2]).toBeCloseTo(350, 3) // 100 + 250
  })

  // ── SLICE (§5.2): bucketing por eje + simetría + shuffle ──

  test('slice x linear: normaliza min/max → cuantiza → delay = ub·span', () => {
    // fx-1 x=-2 (min), fx-2 x=1.5 (max). buckets=2 → fx-1 → 0, fx-2 → span.
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'x',
        buckets: 2, spanMs: 1000, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact'] },
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(0)
    expect(snap.delayMs[1]).toBe(0)
    expect(snap.delayMs[2]).toBe(1000)
    expect(snap.mask[3]).toBe(0) // sin posición: eje espacial no lo cubre
  })

  test('slice dmx: orden de patch, cubre nodos SIN posición', () => {
    // eje no-espacial: fx-3 (índice 3, sin position) también se rebana
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
        buckets: 4, spanMs: 900, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact', 'fx-3:impact'] },
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(0)         // idx 0 → bucket 0
    expect(snap.delayMs[3]).toBe(900)       // idx 3 → bucket 3 → ub 1
    expect(snap.mask[3]).toBe(1)
  })

  test('slice zone: cubos por ordinal de zoneId', () => {
    const e = [
      entry('fx-1:impact', -2, -1),
      { ...entry('fx-2:impact', 1.5, 2), zoneId: 'back' },
    ]
    const atlas: NodeAtlas = { entries: e, byNodeId: new Map(e.map((x) => [x.nodeId, x])) }
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'zone',
        buckets: 2, spanMs: 500, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:impact'] },
      },
    ]
    const snap = evaluateStack(stack, atlas)
    expect(snap.delayMs[0]).toBe(0)    // 'front' → ordinal 0
    expect(snap.delayMs[1]).toBe(500)  // 'back'  → ordinal 1
  })

  test('slice center-out: cubo central = delay 0, extremos = span', () => {
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
        buckets: 3, spanMs: 500, symmetry: 'center-out',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact'] },
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    // idx 0→b0(ub 0→|−1|=1→500) · idx1→b1(ub .5→0→0) · idx2→b2(ub 1→1→500)
    expect(snap.delayMs[0]).toBe(500)
    expect(snap.delayMs[1]).toBe(0)
    expect(snap.delayMs[2]).toBe(500)
  })

  test('slice shuffleSeed: determinista y dentro de [0, span]', () => {
    const mk = (): Gesture => ({
      kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
      buckets: 4, spanMs: 600, symmetry: 'linear', shuffleSeed: 42,
      mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact', 'fx-3:impact'] },
    })
    const a = evaluateStack([mk()], makeAtlas())
    const delays1 = Array.from(a.delayMs)
    const b = evaluateStack([mk()], makeAtlas())
    expect(Array.from(b.delayMs)).toEqual(delays1) // determinismo
    for (const d of delays1) {
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(600)
    }
  })

  // ── NOISE (§5.2): fBm por posición → delay orgánico ──

  test('noise: determinista por (seed, posición), acotado a [0, amountMs]', () => {
    const mk = (seed: number): Gesture => ({
      kind: 'noise', id: 'n1', op: 'replace', seed, scaleM: 1.5,
      amountMs: 120, octaves: 2,
      mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact', 'fx-3:impact'] },
    })
    const s1 = evaluateStack([mk(7)], makeAtlas())
    const first = Array.from(s1.delayMs)
    const s2 = evaluateStack([mk(7)], makeAtlas())
    expect(Array.from(s2.delayMs)).toEqual(first) // determinismo
    for (let i = 0; i < 3; i++) {
      expect(s1.delayMs[i]).toBeGreaterThanOrEqual(0)
      expect(s1.delayMs[i]).toBeLessThanOrEqual(120)
      expect(s1.mask[i]).toBe(1)
    }
    expect(s1.mask[3]).toBe(0) // sin posición → sin ruido
    // Seed distinta → campo distinto (al menos un nodo difiere)
    const s3 = evaluateStack([mk(99)], makeAtlas())
    expect(
      first.some((d, i) => d !== s3.delayMs[i]),
    ).toBe(true)
  })

  test('nodeIds huérfanos en máscara se ignoran (rig drift)', () => {
    const stack: Gesture[] = [
      {
        kind: 'noise', id: 'n1', op: 'add', seed: 7, scaleM: 1, amountMs: 50, octaves: 2,
        mask: { nodeIds: ['fx-1:impact', 'fx-ghost:impact', 'fx-99:nada'] },
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([1, 0, 0, 0])
  })

  test('zero-alloc: evaluate() devuelve SIEMPRE la misma referencia de buffers', () => {
    const engine = createFieldEngine(makeAtlas())
    const s1 = engine.evaluate([])
    const s2 = engine.evaluate([{ kind: 'base', id: 'b', delayMs: 5, gain: 2 }])
    expect(s1).toBe(s2)
    expect(s1.delayMs).toBe(s2.delayMs)
    // Y el buffer anterior refleja el nuevo estado (in-place)
    expect(s1.delayMs[0]).toBe(5)
  })

  test('reset entre evaluates: un gesto retirado libera su cobertura', () => {
    const engine = createFieldEngine(makeAtlas())
    engine.evaluate([{ kind: 'base', id: 'b', delayMs: 10, gain: 1 }])
    const snap = engine.evaluate([])
    expect(Array.from(snap.mask)).toEqual([0, 0, 0, 0])
    expect(Array.from(snap.delayMs)).toEqual([0, 0, 0, 0])
  })

  test('indexOf: lookup O(1) nodeId→índice', () => {
    const engine = createFieldEngine(makeAtlas())
    expect(engine.indexOf('fx-2:petal-l:impact')).toBe(2)
    expect(engine.indexOf('fx-ghost:x')).toBe(-1)
  })
})
