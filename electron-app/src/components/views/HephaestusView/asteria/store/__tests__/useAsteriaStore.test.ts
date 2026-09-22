/**
 * 🜨 WAVE 8030-P3 — Tests del estado del documento Asteria en el store.
 * Gesture Stack: proyecto por defecto, mutaciones de pila, sello de
 * rigFingerprint al llegar el atlas.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { useAsteriaStore, type NodeAtlas } from '../useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { Gesture, WaveGesture } from '../../model/AsteriaProject'
import { createDefaultProject } from '../../model/AsteriaProject'
import { sealRig } from '../../model/rigDrift'

function mkAtlas(nodeIds: string[]): NodeAtlas {
  const entries = nodeIds.map(
    (nodeId): NodeAtlasEntry => ({
      nodeId,
      deviceId: nodeId.split(':')[0],
      cellSuffix: nodeId,
      family: 'IMPACT',
      zoneId: 'front',
      position: { x: 0, y: 0, z: 0 },
      role: 'cell',
    }),
  )
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

const wave = (id: string): WaveGesture => ({
  kind: 'wave', id, op: 'replace',
  mask: { nodeIds: [] }, emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 8,
})

describe('🜨 AsteriaStore — Gesture Stack (WAVE 8030-P3)', () => {
  beforeEach(() => {
    useAsteriaStore.setState({
      project: createDefaultProject(),
      nodeAtlas: null,
      selectedGestureId: null,
    })
  })

  test('proyecto por defecto: pila con un único gesto base identidad', () => {
    const { project } = useAsteriaStore.getState()
    expect(project.version).toBe(1)
    expect(project.stack).toHaveLength(1)
    expect(project.stack[0]).toEqual({
      kind: 'base', id: 'base', delayMs: 0, gain: 1,
    })
    expect(project.strategy).toBe('auto')
    expect(project.cohortBudget).toBe(16)
  })

  test('addGesture empuja a la cima (final del array)', () => {
    useAsteriaStore.getState().addGesture(wave('w1'))
    const { stack } = useAsteriaStore.getState().project
    expect(stack.map((g) => g.id)).toEqual(['base', 'w1'])
  })

  test('updateGesture aplica patch paramétrico sin tocar otros gestos', () => {
    useAsteriaStore.getState().addGesture(wave('w1'))
    useAsteriaStore.getState().updateGesture('base', { delayMs: 40 })
    const { stack } = useAsteriaStore.getState().project
    expect(stack[0]).toMatchObject({ kind: 'base', delayMs: 40 })
    expect(stack[1]).toMatchObject({ kind: 'wave', id: 'w1' })
    // id desconocido → no-op
    const before = useAsteriaStore.getState().project
    useAsteriaStore.getState().updateGesture('ghost', { delayMs: 9 })
    expect(useAsteriaStore.getState().project.stack).toEqual(before.stack)
  })

  test('removeGesture retira por id', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1'))
    s.addGesture(wave('w2'))
    useAsteriaStore.getState().removeGesture('w1')
    expect(
      useAsteriaStore.getState().project.stack.map((g) => g.id),
    ).toEqual(['base', 'w2'])
  })

  test('moveGesture reordena con clamp', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1'))
    s.addGesture(wave('w2'))
    useAsteriaStore.getState().moveGesture('w2', 0)
    expect(
      useAsteriaStore.getState().project.stack.map((g) => g.id),
    ).toEqual(['w2', 'base', 'w1'])
    // Fuera de rango → clamp al tope
    useAsteriaStore.getState().moveGesture('w2', 99)
    expect(
      useAsteriaStore.getState().project.stack.map((g) => g.id),
    ).toEqual(['base', 'w1', 'w2'])
  })

  test('setNodeAtlas sella rigFingerprint en proyecto nuevo', () => {
    useAsteriaStore.getState().setNodeAtlas(mkAtlas(['fx-1:impact', 'fx-2:color']))
    const fp = useAsteriaStore.getState().project.rigFingerprint
    expect(fp).toMatch(/^sha1:[0-9a-f]{40}$/)
    // Segundo setNodeAtlas con OTRO rig → la huella sellada NO cambia
    useAsteriaStore.getState().setNodeAtlas(mkAtlas(['fx-9:impact']))
    expect(useAsteriaStore.getState().project.rigFingerprint).toBe(fp)
  })

  test('setNodeAtlas NO pisa la huella de un proyecto cargado', () => {
    const loaded = { ...createDefaultProject('sha1:loadedrig') }
    useAsteriaStore.getState().setProject(loaded)
    useAsteriaStore.getState().setNodeAtlas(mkAtlas(['fx-1:impact']))
    expect(useAsteriaStore.getState().project.rigFingerprint).toBe('sha1:loadedrig')
  })

  test('resetProject sella con el atlas actual si existe', () => {
    useAsteriaStore.getState().setNodeAtlas(mkAtlas(['fx-1:impact']))
    useAsteriaStore.getState().resetProject()
    const { project } = useAsteriaStore.getState()
    expect(project.stack).toHaveLength(1)
    expect(project.rigFingerprint).toMatch(/^sha1:[0-9a-f]{40}$/)
  })

  test('mutaciones devuelven nueva referencia de project y stack', () => {
    const before = useAsteriaStore.getState().project
    useAsteriaStore.getState().addGesture(wave('w1'))
    const after = useAsteriaStore.getState().project
    expect(after).not.toBe(before)
    expect(after.stack).not.toBe(before.stack)
  })

  test('8055: addGesture selecciona la capa nueva; removeGesture la limpia', () => {
    useAsteriaStore.getState().addGesture(wave('w1'))
    expect(useAsteriaStore.getState().selectedGestureId).toBe('w1')
    useAsteriaStore.getState().removeGesture('w1')
    expect(useAsteriaStore.getState().selectedGestureId).toBeNull()
  })

  test('8055: resetProject limpia la selección de capa', () => {
    useAsteriaStore.getState().setSelectedGesture('base')
    expect(useAsteriaStore.getState().selectedGestureId).toBe('base')
    useAsteriaStore.getState().resetProject()
    expect(useAsteriaStore.getState().selectedGestureId).toBeNull()
  })

  test('8070-M2: setTargetParams muta el proyecto; [] se rechaza', () => {
    const s = useAsteriaStore.getState()
    s.setTargetParams(['intensity', 'pan'])
    expect(useAsteriaStore.getState().project.targetParams).toEqual([
      'intensity', 'pan',
    ])
    const before = useAsteriaStore.getState().project
    s.setTargetParams([]) // el campo siempre apunta a algo — no-op
    expect(useAsteriaStore.getState().project).toBe(before)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8050 (M3): RIG DRIFT — sello de posiciones, detección y acciones
// ─────────────────────────────────────────────────────────────────────────────

/** Atlas con posiciones XZ distintas (para el remap por proximidad). */
function mkAtlasPos(pairs: [string, number, number][]): NodeAtlas {
  const entries = pairs.map(
    ([nodeId, x, z]): NodeAtlasEntry => ({
      nodeId,
      deviceId: nodeId.split(':')[0],
      cellSuffix: nodeId.includes(':')
        ? nodeId.slice(nodeId.indexOf(':') + 1)
        : nodeId,
      family: 'IMPACT',
      zoneId: 'front',
      position: { x, y: 0, z },
      role: 'cell',
    }),
  )
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

/** Proyecto "de otra sesión": sellado sobre oldRig, pila que usa `ids`. */
function foreignProject(oldRig: NodeAtlas, ids: readonly string[]) {
  return {
    ...createDefaultProject(),
    ...sealRig(oldRig),
    stack: [
      { kind: 'base' as const, id: 'base', delayMs: 0, gain: 1 },
      {
        kind: 'wave' as const, id: 'w1', op: 'replace' as const,
        mask: { nodeIds: ids }, emitter: { x: 0, z: 0 },
        shape: 'point' as const, speedMps: 8,
      },
    ],
  }
}

describe('🜨 AsteriaStore — Rig Drift (WAVE 8050-M3)', () => {
  const oldRig = mkAtlasPos([['fx-a:impact', 0, 0], ['fx-b:impact', 1, 0]])

  beforeEach(() => {
    useAsteriaStore.setState({
      project: createDefaultProject(),
      nodeAtlas: null,
      rigDrift: null,
      driftReadOnly: false,
      lastCompileReport: null,
    })
  })

  test('setNodeAtlas sella nodePositions junto a la huella', () => {
    useAsteriaStore.getState().setNodeAtlas(
      mkAtlasPos([['fx-a:impact', 3, -2]]),
    )
    const p = useAsteriaStore.getState().project
    expect(p.nodePositions?.['fx-a:impact']).toEqual({ x: 3, z: -2 })
  })

  test('setProject con huella ajena + atlas nuevo → rigDrift poblado', () => {
    const s = useAsteriaStore.getState()
    // Orden real: atlas del rig NUEVO ya llegó, luego se carga el proyecto
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0], ['fx-c:impact', 1.1, 0]]))
    s.setProject(foreignProject(oldRig, ['fx-a:impact', 'fx-b:impact']))
    const st = useAsteriaStore.getState()
    expect(st.rigDrift).not.toBeNull()
    expect(st.rigDrift!.missing).toEqual(['fx-b:impact'])
    expect(st.rigDrift!.unassigned).toEqual(['fx-c:impact'])
  })

  test('resolveDriftRemap: el nodo perdido hereda al nuevo más cercano', () => {
    const s = useAsteriaStore.getState()
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0], ['fx-c:impact', 1.1, 0]]))
    s.setProject(foreignProject(oldRig, ['fx-a:impact', 'fx-b:impact']))
    useAsteriaStore.getState().resolveDriftRemap()
    const st = useAsteriaStore.getState()
    expect(st.rigDrift).toBeNull()
    const w = st.project.stack.find((g) => g.id === 'w1')
    expect((w as WaveGesture).mask.nodeIds).toEqual([
      'fx-a:impact', 'fx-c:impact',
    ])
    // La huella se reselló al rig nuevo → futuro setNodeAtlas no repite drift
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0], ['fx-c:impact', 1.1, 0]]))
    expect(useAsteriaStore.getState().rigDrift).toBeNull()
  })

  test('resolveDriftDiscard: los huérfanos salen de la pila', () => {
    const s = useAsteriaStore.getState()
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0]]))
    s.setProject(foreignProject(oldRig, ['fx-a:impact', 'fx-b:impact']))
    useAsteriaStore.getState().resolveDriftDiscard()
    const st = useAsteriaStore.getState()
    expect(st.rigDrift).toBeNull()
    const w = st.project.stack.find((g) => g.id === 'w1')
    expect((w as WaveGesture).mask.nodeIds).toEqual(['fx-a:impact'])
  })

  test('solo lectura: las mutaciones del stack son no-op', () => {
    const s = useAsteriaStore.getState()
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0]]))
    s.setProject(foreignProject(oldRig, ['fx-b:impact']))
    useAsteriaStore.getState().setDriftReadOnly(true)
    const frozen = useAsteriaStore.getState().project
    useAsteriaStore.getState().addGesture(wave('w2'))
    useAsteriaStore.getState().removeGesture('w1')
    useAsteriaStore.getState().updateGesture('base', { gain: 0.1 })
    useAsteriaStore.getState().moveGesture('w1', 0)
    expect(useAsteriaStore.getState().project).toBe(frozen)
    // Y el drift sigue sin resolver (la decisión fue solo lectura)
    expect(useAsteriaStore.getState().rigDrift).not.toBeNull()
  })

  test('solo lectura sobrevive a un refresh del atlas mientras el drift persista', () => {
    const s = useAsteriaStore.getState()
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0]]))
    s.setProject(foreignProject(oldRig, ['fx-b:impact']))
    useAsteriaStore.getState().setDriftReadOnly(true)
    // Re-fetch del atlas (mismo rig nuevo, referencia nueva)
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0]]))
    const st = useAsteriaStore.getState()
    expect(st.driftReadOnly).toBe(true)
    expect(st.rigDrift).not.toBeNull()
  })

  test('8070-M1: documento nuevo sin asteria → unlock + reset limpia todo', () => {
    // Simula el path del hook: proyecto ajeno con drift + solo lectura
    const s = useAsteriaStore.getState()
    s.setNodeAtlas(mkAtlasPos([['fx-a:impact', 0, 0]]))
    s.setProject(foreignProject(oldRig, ['fx-b:impact']))
    s.setDriftReadOnly(true)
    // El hook hace setDriftReadOnly(false) + resetProject()
    s.setDriftReadOnly(false)
    s.resetProject()
    const st = useAsteriaStore.getState()
    expect(st.project.stack).toHaveLength(1)
    expect(st.project.stack[0].kind).toBe('base')
    expect(st.rigDrift).toBeNull()
    expect(st.driftReadOnly).toBe(false)
    // Resellada al rig vivo — la huella describe el atlas actual
    expect(st.project.rigFingerprint).toMatch(/^sha1:/)
    expect(st.project.nodePositions?.['fx-a:impact']).toEqual({ x: 0, z: 0 })
  })
})
