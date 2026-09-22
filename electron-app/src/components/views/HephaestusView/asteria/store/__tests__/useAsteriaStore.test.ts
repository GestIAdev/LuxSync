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
})
