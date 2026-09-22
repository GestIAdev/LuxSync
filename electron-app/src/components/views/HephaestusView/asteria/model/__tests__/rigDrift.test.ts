/**
 * 🜨 WAVE 8050 — Tests del Rig Drift (M3)
 *
 * Cubre: detección por huella (missing/unassigned desde la pila),
 * remapeo por proximidad XZ con consumo único y desempate por suffix,
 * descarte de huérfanos, y el sello de posiciones que habilita el remap.
 */

import { describe, test, expect } from 'vitest'
import {
  computeRigDrift,
  remapByProximity,
  discardOrphans,
  sealRig,
  stackNodeIds,
} from '../rigDrift'
import { computeRigFingerprint } from '../rigFingerprint'
import { createDefaultProject } from '../AsteriaProject'
import type { AsteriaProject, Gesture } from '../AsteriaProject'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'

function entry(nodeId: string, x?: number, z?: number): NodeAtlasEntry {
  return {
    nodeId,
    deviceId: nodeId.split(':')[0],
    cellSuffix: nodeId.includes(':') ? nodeId.slice(nodeId.indexOf(':') + 1) : nodeId,
    family: 'IMPACT',
    zoneId: 'front',
    position: x !== undefined && z !== undefined ? { x, y: 0, z } : undefined,
    role: 'cell',
  }
}

function atlasOf(...es: NodeAtlasEntry[]): NodeAtlas {
  return { entries: es, byNodeId: new Map(es.map((e) => [e.nodeId, e])) }
}

/** Proyecto cuya pila referencia `ids` y con huella/posiciones selladas
 *  sobre `oldAtlas` (el rig ORIGINAL, antes del drift). */
function projectOn(
  oldAtlas: NodeAtlas,
  ids: readonly string[],
  extra: Gesture[] = [],
): AsteriaProject {
  return {
    ...createDefaultProject(),
    ...sealRig(oldAtlas),
    stack: [
      { kind: 'base', id: 'base', delayMs: 0, gain: 1 },
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ids },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
      ...extra,
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 rigDrift — detección', () => {
  const oldRig = atlasOf(
    entry('fx-a:impact', 0, 0), entry('fx-b:impact', 1, 0),
    entry('fx-c:impact', 2, 0),
  )

  test('misma huella → sin drift', () => {
    const p = projectOn(oldRig, ['fx-a:impact', 'fx-b:impact'])
    expect(computeRigDrift(p, oldRig)).toBeNull()
  })

  test('huella vacía (proyecto nuevo) → sin drift aunque el atlas difiera', () => {
    const p = createDefaultProject()
    expect(computeRigDrift(p, atlasOf(entry('x:impact', 0, 0)))).toBeNull()
  })

  test('drift: cuenta nodos de la pila perdidos + nodos nuevos sin asignar', () => {
    const p = projectOn(oldRig, ['fx-a:impact', 'fx-b:impact', 'fx-c:impact'])
    // El rig nuevo pierde fx-b y añade fx-d
    const newRig = atlasOf(
      entry('fx-a:impact', 0, 0), entry('fx-c:impact', 2, 0),
      entry('fx-d:impact', 1.1, 0),
    )
    const d = computeRigDrift(p, newRig)!
    expect(d).not.toBeNull()
    expect(d.missing).toEqual(['fx-b:impact'])
    expect(d.unassigned).toEqual(['fx-d:impact'])
  })

  test('los nodos no referenciados por la pila no cuentan como perdidos', () => {
    // La pila solo usa fx-a — fx-b/fx-c desaparecen pero no eran de la pila
    const p = projectOn(oldRig, ['fx-a:impact'])
    const newRig = atlasOf(entry('fx-a:impact', 0, 0))
    const d = computeRigDrift(p, newRig)!
    expect(d).not.toBeNull() // huella difiere → drift reportado
    expect(d.missing).toEqual([])
    expect(d.unassigned).toEqual([])
  })

  test('stackNodeIds incluye máscaras y entries manual', () => {
    const p = projectOn(oldRig, ['fx-a:impact'], [
      {
        kind: 'manual', id: 'm1',
        entries: [
          { nodeId: 'fx-c:impact', delayMs: 10 },
          { nodeId: 'fx-a:impact', gain: 0.5 }, // dedupe
        ],
      },
    ])
    expect(stackNodeIds(p)).toEqual(['fx-a:impact', 'fx-c:impact'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 rigDrift — remapear por proximidad', () => {
  const oldRig = atlasOf(
    entry('fx-a:petal-l', 0, 0), entry('fx-b:petal-l', 1, 0),
  )

  test('el perdido hereda al nuevo más cercano; el nuevo sale de unassigned', () => {
    const p = projectOn(oldRig, ['fx-a:petal-l', 'fx-b:petal-l'])
    // fx-b se reemplazó por fx-b2 a 0.1 m de su posición original
    const newRig = atlasOf(
      entry('fx-a:petal-l', 0, 0), entry('fx-b2:petal-l', 1.1, 0),
    )
    const d = computeRigDrift(p, newRig)!
    const r = remapByProximity(p, newRig, d)
    expect(r.remapped.get('fx-b:petal-l')).toBe('fx-b2:petal-l')
    expect(r.unmappable).toEqual([])
    const wave = r.project.stack.find((g) => g.id === 'w1')
    expect((wave as { mask: { nodeIds: string[] } }).mask.nodeIds)
      .toEqual(['fx-a:petal-l', 'fx-b2:petal-l'])
    // Huella resellada → el drift queda resuelto
    expect(computeRigDrift(r.project, newRig)).toBeNull()
    expect(r.project.rigFingerprint).toBe(
      computeRigFingerprint(newRig.entries.map((e) => e.nodeId)),
    )
  })

  test('cada nodo nuevo se consume una vez; sufijo idéntico gana a distancia', () => {
    // Dos perdidos (wash + petal) en posiciones cercanas; dos nuevos
    // equidistantes pero con sufijos distintos → el sufijo desempata.
    const oldR = atlasOf(
      entry('f1:wash', 5, 0), entry('f1:petal', 5, 0.2),
    )
    const p = projectOn(oldR, ['f1:wash', 'f1:petal'])
    const newR = atlasOf(
      entry('f2:petal', 5.1, 0),   // a 0.1 m del wash viejo
      entry('f2:wash', 5.1, 0.2),  // a 0.1 m del petal viejo
    )
    const d = computeRigDrift(p, newR)!
    const r = remapByProximity(p, newR, d)
    expect(r.remapped.get('f1:wash')).toBe('f2:wash')
    expect(r.remapped.get('f1:petal')).toBe('f2:petal')
  })

  test('sin posición sellada → unmappable honesto, id se conserva', () => {
    const p = projectOn(oldRig, ['fx-a:petal-l', 'fx-b:petal-l'])
    // Proyecto sin nodePositions (vintage) — el remap no puede medir
    const vintage: AsteriaProject = { ...p, nodePositions: undefined }
    const newRig = atlasOf(
      entry('fx-a:petal-l', 0, 0), entry('fx-z:petal-l', 9, 9),
    )
    const d = computeRigDrift(vintage, newRig)!
    const r = remapByProximity(vintage, newRig, d)
    expect(r.unmappable).toEqual(['fx-b:petal-l'])
    const wave = r.project.stack.find((g) => g.id === 'w1')
    expect((wave as { mask: { nodeIds: string[] } }).mask.nodeIds)
      .toContain('fx-b:petal-l') // conservado, no borrado en silencio
  })
})

describe('🜨 rigDrift — descartar huérfanos', () => {
  test('los ids muertos salen de máscaras y entries; huella resellada', () => {
    const oldRig = atlasOf(
      entry('fx-a:impact', 0, 0), entry('fx-b:impact', 1, 0),
    )
    const p = projectOn(oldRig, ['fx-a:impact', 'fx-b:impact'], [
      {
        kind: 'manual', id: 'm1',
        entries: [
          { nodeId: 'fx-b:impact', delayMs: 5 },
          { nodeId: 'fx-a:impact', gain: 0.8 },
        ],
      },
    ])
    const newRig = atlasOf(entry('fx-a:impact', 0, 0))
    const d = computeRigDrift(p, newRig)!
    const next = discardOrphans(p, newRig, d)
    const wave = next.stack.find((g) => g.id === 'w1')
    expect((wave as { mask: { nodeIds: string[] } }).mask.nodeIds)
      .toEqual(['fx-a:impact'])
    const manual = next.stack.find((g) => g.id === 'm1')
    expect(
      (manual as { entries: { nodeId: string }[] }).entries.map((e) => e.nodeId),
    ).toEqual(['fx-a:impact'])
    expect(computeRigDrift(next, newRig)).toBeNull()
  })
})
