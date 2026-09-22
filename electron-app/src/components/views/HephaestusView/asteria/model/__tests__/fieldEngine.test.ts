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
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 8,
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([1, 0, 1, 0])
    // La matemática de la onda es P3 — los valores siguen en identidad
    expect(Array.from(snap.delayMs)).toEqual([0, 0, 0, 0])
  })

  test('manual: su cobertura son sus entries (valores en P3)', () => {
    const stack: Gesture[] = [
      {
        kind: 'manual', id: 'm1',
        entries: [{ nodeId: 'fx-1:color' }, { nodeId: 'fx-3:impact' }],
      },
    ]
    const snap = evaluateStack(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([0, 1, 0, 1])
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
