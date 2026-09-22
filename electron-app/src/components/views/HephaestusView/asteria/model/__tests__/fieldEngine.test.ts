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

  test('kind sin implementar: resuelve máscara de cobertura, sin tocar valores', () => {
    const stack: Gesture[] = [
      {
        kind: 'noise', id: 'n1', op: 'replace', seed: 7, scaleM: 1,
        amountMs: 50, octaves: 2,
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([1, 0, 1, 0])
    // La matemática del noise llega después — los valores siguen en identidad
    expect(Array.from(snap.delayMs)).toEqual([0, 0, 0, 0])
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
