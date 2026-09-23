/**
 * 🜨 WAVE 8030-P3 — Tests del estado del documento Asteria en el store.
 * Gesture Stack: proyecto por defecto, mutaciones de pila, sello de
 * rigFingerprint al llegar el atlas.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
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
      past: [],
      future: [],
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

  // 🜨 WAVE 8184 (M1): el lienzo negro — la capa BASE es inmutable
  test('removeGesture sobre la capa BASE es no-op (lienzo negro protegido)', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1'))
    const before = useAsteriaStore.getState().project
    const pastLen = useAsteriaStore.getState().past.length
    useAsteriaStore.getState().removeGesture('base')
    const after = useAsteriaStore.getState()
    expect(after.project).toBe(before) // ni siquiera nueva referencia
    expect(after.project.stack.map((g) => g.id)).toEqual(['base', 'w1'])
    expect(after.past.length).toBe(pastLen) // sin paso de undo fantasma
  })

  test('la BASE sigue editable: updateGesture baja su gain a 0 (fondo negro)', () => {
    useAsteriaStore.getState().updateGesture('base', { gain: 0 })
    const base = useAsteriaStore.getState().project.stack[0]
    expect(base.kind === 'base' ? base.gain : -1).toBe(0)
  })

  test('setLutSource (WAVE 8184-M2): preset↔ride, undoable', () => {
    const s = useAsteriaStore.getState()
    expect(s.project.lutSource).toEqual({ kind: 'preset', name: 'default' })
    s.setLutSource({ kind: 'ride', trackId: 'forge-track-01' })
    expect(useAsteriaStore.getState().project.lutSource).toEqual({
      kind: 'ride', trackId: 'forge-track-01',
    })
    useAsteriaStore.getState().undo()
    expect(useAsteriaStore.getState().project.lutSource).toEqual({
      kind: 'preset', name: 'default',
    })
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
      past: [],
      future: [],
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

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8150-F3: UNDO/REDO LOCAL — historial por snapshots + coalescing
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 AsteriaStore — Undo/Redo local (WAVE 8150-F3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAsteriaStore.setState({
      project: createDefaultProject(),
      nodeAtlas: null,
      selectedGestureId: null,
      rigDrift: null,
      driftReadOnly: false,
      past: [],
      future: [],
    })
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  test('addGesture empuja historial; undo restaura; redo reaplica', () => {
    const s = useAsteriaStore.getState()
    const p0 = s.project
    s.addGesture(wave('w1'))
    expect(useAsteriaStore.getState().past).toHaveLength(1)
    expect(useAsteriaStore.getState().past[0]).toBe(p0)

    s.undo()
    const st = useAsteriaStore.getState()
    expect(st.project).toBe(p0)
    expect(st.past).toHaveLength(0)
    expect(st.future).toHaveLength(1)

    s.redo()
    const st2 = useAsteriaStore.getState()
    expect(st2.project.stack.map((g) => g.id)).toEqual(['base', 'w1'])
    expect(st2.past).toHaveLength(1)
    expect(st2.future).toHaveLength(0)
  })

  test('una mutación nueva invalida la rama de redo', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1'))
    s.undo()
    expect(useAsteriaStore.getState().future).toHaveLength(1)
    s.addGesture(wave('w2'))
    expect(useAsteriaStore.getState().future).toHaveLength(0)
    // redo ya no puede revivir w1
    s.redo()
    expect(useAsteriaStore.getState().project.stack.map((g) => g.id)).toEqual([
      'base', 'w2',
    ])
  })

  test('coalescing: un burst de updateGesture = UN paso de undo', () => {
    const s = useAsteriaStore.getState()
    const p0 = s.project
    // Simula arrastre de slider: 5 patches en <300ms
    for (let i = 1; i <= 5; i++) {
      s.updateGesture('base', { delayMs: i * 10 })
      vi.advanceTimersByTime(50)
    }
    expect(useAsteriaStore.getState().project.stack[0]).toMatchObject({
      delayMs: 50,
    })
    // El debounce aún no consolidó → past sigue vacío
    expect(useAsteriaStore.getState().past).toHaveLength(0)
    vi.advanceTimersByTime(300)
    const st = useAsteriaStore.getState()
    expect(st.past).toHaveLength(1)
    expect(st.past[0]).toBe(p0)
    // Undo → vuelve entero al estado pre-arrastre
    s.undo()
    expect(useAsteriaStore.getState().project).toBe(p0)
  })

  test('otra mutación creativa consolida el burst pendiente en orden', () => {
    const s = useAsteriaStore.getState()
    const p0 = s.project
    s.updateGesture('base', { delayMs: 99 })
    // addGesture llega a mitad del burst → el snapshot pre-burst entra
    // al historial AHORA (el drag queda fusionado al paso siguiente)
    s.addGesture(wave('w1'))
    expect(useAsteriaStore.getState().past).toHaveLength(1)
    expect(useAsteriaStore.getState().past[0]).toBe(p0)
    // Y el timer residual no duplica el paso
    vi.advanceTimersByTime(400)
    expect(useAsteriaStore.getState().past).toHaveLength(1)
  })

  test('undo a mitad de burst restaura el pre-arrastre directamente', () => {
    const s = useAsteriaStore.getState()
    const p0 = s.project
    s.updateGesture('base', { delayMs: 50 })
    s.updateGesture('base', { delayMs: 80 })
    // Ctrl+Z antes de que consolide el debounce
    s.undo()
    const st = useAsteriaStore.getState()
    expect(st.project).toBe(p0)
    expect(st.future).toHaveLength(1)
    // El timer muerto no contamina el historial después
    vi.advanceTimersByTime(400)
    expect(useAsteriaStore.getState().past).toHaveLength(0)
  })

  test('setProject es frontera de documento: el historial muere', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1'))
    s.addGesture(wave('w2'))
    expect(useAsteriaStore.getState().past).toHaveLength(2)
    s.setProject(createDefaultProject('sha1:other'))
    const st = useAsteriaStore.getState()
    expect(st.past).toHaveLength(0)
    expect(st.future).toHaveLength(0)
  })

  test('resetProject ES undoable (intervención creativa)', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1'))
    const withWave = useAsteriaStore.getState().project
    s.resetProject()
    expect(useAsteriaStore.getState().project.stack).toHaveLength(1)
    s.undo()
    expect(useAsteriaStore.getState().project).toBe(withWave)
  })

  test('sealRig/setNodeAtlas NO entran al historial (evento de sistema)', () => {
    useAsteriaStore.getState().setNodeAtlas(mkAtlas(['fx-1:impact']))
    expect(useAsteriaStore.getState().project.rigFingerprint).toMatch(/^sha1:/)
    expect(useAsteriaStore.getState().past).toHaveLength(0)
  })

  test('undo sanea selectedGestureId si el gesto no existe en el restore', () => {
    const s = useAsteriaStore.getState()
    s.addGesture(wave('w1')) // queda seleccionado
    expect(useAsteriaStore.getState().selectedGestureId).toBe('w1')
    s.undo() // restaura proyecto sin w1
    const st = useAsteriaStore.getState()
    expect(st.project.stack.some((g) => g.id === 'w1')).toBe(false)
    expect(st.selectedGestureId).toBeNull()
  })

  test('undo recomputa rigDrift contra el atlas vivo', () => {
    const s = useAsteriaStore.getState()
    const rig = mkAtlasPos([['fx-a:impact', 0, 0]])
    s.setNodeAtlas(rig)
    s.setProject(foreignProject(
      mkAtlasPos([['fx-a:impact', 0, 0], ['fx-b:impact', 1, 0]]),
      ['fx-a:impact', 'fx-b:impact'],
    ))
    expect(useAsteriaStore.getState().rigDrift).not.toBeNull()
    // Mutación con drift visible (sin readOnly) → undoable
    s.addGesture(wave('w2'))
    s.undo()
    // El restore re-corre computeRigDrift → el banner sigue coherente
    expect(useAsteriaStore.getState().rigDrift).not.toBeNull()
    expect(useAsteriaStore.getState().rigDrift!.missing).toEqual([
      'fx-b:impact',
    ])
  })

  test('historial capado a HISTORY_LIMIT (40)', () => {
    const s = useAsteriaStore.getState()
    for (let i = 0; i < 45; i++) s.addGesture(wave(`w${i}`))
    expect(useAsteriaStore.getState().past).toHaveLength(40)
    // Los más antiguos se descartan (los 5 primeros commits fuera)
    expect(
      useAsteriaStore.getState().past[0].stack.some((g) => g.id === 'w4'),
    ).toBe(true)
  })
})
