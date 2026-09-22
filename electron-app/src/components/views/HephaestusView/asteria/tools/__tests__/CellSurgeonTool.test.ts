/**
 * 🜨 WAVE 8040B — Tests del Cell Surgeon (T7)
 *
 * Verifica: expansión por doble clic, selección exclusiva por celda,
 * arrastre dentro del aparato, copia de patrón a otro fixture del mismo
 * perfil, modo degradado MCC-Z (agrupación por zona) y cierre honesto.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import {
  createCellSurgeonTool,
  deviceCells,
  isCompoundDevice,
  deviceBounds,
  mapCellPattern,
  zoneGroup,
} from '../CellSurgeonTool'
import { clearGesturePreview } from '../ToolRegistry'
import type { AsteriaToolContext } from '../ToolRegistry'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { WorldTransform } from '../../canvas/useWorldTransform'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES — 2 Tungsten compuestos (petal-l/r + wash) + 1 PAR simple
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFORM: WorldTransform = {
  cam: { panX: 0, panY: 0, zoom: 40 },
  canvasW: 800,
  canvasH: 600,
} as WorldTransform

function cell(
  nodeId: string,
  deviceId: string,
  suffix: string,
  x: number,
  z: number,
  zone = 'front',
): NodeAtlasEntry {
  return {
    nodeId,
    deviceId,
    cellSuffix: suffix,
    family: 'IMPACT',
    zoneId: zone,
    position: { x, y: 0, z },
    role: 'cell',
  }
}

function makeAtlas(): NodeAtlas {
  const entries = [
    cell('fx-a:petal-l', 'fx-a', 'petal-l', 0, 0),
    cell('fx-a:petal-r', 'fx-a', 'petal-r', 0.15, 0),
    cell('fx-a:wash', 'fx-a', 'wash', 0, 0.1),
    cell('fx-b:petal-l', 'fx-b', 'petal-l', 3, 0, 'back'),
    cell('fx-b:petal-r', 'fx-b', 'petal-r', 3.15, 0, 'back'),
    cell('fx-b:wash', 'fx-b', 'wash', 3, 0.1, 'back'),
    cell('fx-c:impact', 'fx-c', 'impact', 6, 0),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

interface FakeCtx {
  ctx: AsteriaToolContext
  /** Getter — setSelection reemplaza la referencia del Set. */
  selection: () => ReadonlySet<string>
  surgeonCalls: (string | null)[]
  fitCalls: unknown[][]
}

function fakeCtx(atlas: NodeAtlas): FakeCtx {
  let sel = new Set<string>()
  const state: FakeCtx = {
    selection: () => sel,
    surgeonCalls: [],
    fitCalls: [],
    ctx: null as unknown as AsteriaToolContext,
  }
  state.ctx = {
    transform: () => TRANSFORM,
    atlas: () => atlas,
    setSelection: (ids, additive) => {
      const next = additive ? new Set(sel) : new Set<string>()
      for (const id of ids) next.add(id)
      sel = next
    },
    setHover: () => {},
    previewSelection: () => {},
    selection: () => sel,
    addGesture: () => {},
    setSurgeonDevice: (d) => { state.surgeonCalls.push(d) },
    fitRect: (...a) => { state.fitCalls.push(a) },
  }
  return state
}

const ev = (shiftKey = false) =>
  ({ shiftKey, altKey: false, button: 0 }) as unknown as PointerEvent
const dblEv = () => ({ button: 0 }) as unknown as MouseEvent

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('✜ CellSurgeonTool (T7 — WAVE 8040B)', () => {
  beforeEach(() => clearGesturePreview())

  test('helpers puros: cells/bounds/compound/pattern/zone', () => {
    const atlas = makeAtlas()
    expect(deviceCells(atlas, 'fx-a').map((e) => e.nodeId)).toEqual([
      'fx-a:petal-l', 'fx-a:petal-r', 'fx-a:wash',
    ])
    expect(isCompoundDevice(atlas, 'fx-a')).toBe(true)
    expect(isCompoundDevice(atlas, 'fx-c')).toBe(false)
    const b = deviceBounds(atlas, 'fx-a')!
    expect(b.cx).toBeCloseTo(0.075, 5)
    expect(b.d).toBeCloseTo(0.5, 5)
    // patrón petal-l+wash de fx-a → mismos sufijos en fx-b
    expect(
      mapCellPattern(atlas, ['fx-a:petal-l', 'fx-a:wash'], 'fx-b'),
    ).toEqual(['fx-b:petal-l', 'fx-b:wash'])
    expect(zoneGroup(atlas, 'back')).toEqual([
      'fx-b:petal-l', 'fx-b:petal-r', 'fx-b:wash',
    ])
  })

  test('doble clic abre cirugía: expande, selecciona celdas, encuadra', () => {
    const tool = createCellSurgeonTool()
    const atlas = makeAtlas()
    const { ctx, selection, surgeonCalls, fitCalls } = fakeCtx(atlas)

    tool.onDoubleClick!(400, 300, dblEv(), ctx) // mundo (0,0) = petal-l de fx-a

    expect(surgeonCalls).toEqual(['fx-a'])
    expect([...selection()].sort()).toEqual([
      'fx-a:petal-l', 'fx-a:petal-r', 'fx-a:wash',
    ])
    expect(fitCalls).toHaveLength(1)
  })

  test('clic en celda del aparato abierto → selección exclusiva', () => {
    const tool = createCellSurgeonTool()
    const atlas = makeAtlas()
    const { ctx, selection } = fakeCtx(atlas)

    tool.onDoubleClick!(400, 300, dblEv(), ctx)
    // clic en petal-r (0.15 m → +6 px)
    tool.onPointerDown!(406, 300, ev(), ctx)
    expect([...selection()]).toEqual(['fx-a:petal-r'])
    // Shift+clic en wash (0,0.1 → 400,304) → añade dentro del aparato
    tool.onPointerDown!(400, 304, ev(true), ctx)
    expect([...selection()].sort()).toEqual(['fx-a:petal-r', 'fx-a:wash'])
  })

  test('clic en nodo de OTRO device se ignora (máscara exclusiva)', () => {
    const tool = createCellSurgeonTool()
    const atlas = makeAtlas()
    const { ctx, selection } = fakeCtx(atlas)

    tool.onDoubleClick!(400, 300, dblEv(), ctx)
    tool.onPointerDown!(406, 300, ev(), ctx) // petal-r
    tool.onPointerDown!(520, 300, ev(), ctx) // petal-l de fx-b — fuera
    expect([...selection()]).toEqual(['fx-a:petal-r']) // intacto
  })

  test('doble clic en otro fixture pega el patrón celular', () => {
    const tool = createCellSurgeonTool()
    const atlas = makeAtlas()
    const { ctx, selection, surgeonCalls } = fakeCtx(atlas)

    tool.onDoubleClick!(400, 300, dblEv(), ctx)   // abre fx-a
    tool.onPointerDown!(400, 300, ev(), ctx)      // selecciona petal-l
    tool.onPointerDown!(400, 304, ev(true), ctx)  // + wash
    expect([...selection()].sort()).toEqual(['fx-a:petal-l', 'fx-a:wash'])

    tool.onDoubleClick!(520, 300, dblEv(), ctx)   // sobre fx-b → paste
    expect([...selection()].sort()).toEqual(['fx-b:petal-l', 'fx-b:wash'])
    expect(surgeonCalls[surgeonCalls.length - 1]).toBe('fx-b')
  })

  test('MCC-Z (sin Δ): la celda agrupa por zoneId, nunca por celda sola', () => {
    const tool = createCellSurgeonTool({ mccCellAvailable: false })
    const atlas = makeAtlas()
    const { ctx, selection } = fakeCtx(atlas)

    tool.onDoubleClick!(400, 300, dblEv(), ctx) // abre fx-a
    tool.onPointerDown!(406, 300, ev(), ctx)    // petal-r (zone 'front')
    // MCC-Z → TODOS los nodos de la zona 'front' — incluido fx-c:impact
    // (la clase de zona es global al rig, no por aparato — §4.4)
    expect([...selection()].sort()).toEqual([
      'fx-a:petal-l', 'fx-a:petal-r', 'fx-a:wash', 'fx-c:impact',
    ])
  })

  test('doble clic en el device abierto cierra la cirugía', () => {
    const tool = createCellSurgeonTool()
    const atlas = makeAtlas()
    const { ctx, surgeonCalls } = fakeCtx(atlas)

    tool.onDoubleClick!(400, 300, dblEv(), ctx) // abre fx-a
    tool.onDoubleClick!(400, 300, dblEv(), ctx) // cierra
    expect(surgeonCalls).toEqual(['fx-a', null])
  })

  test('doble clic en fixture NO compuesto no abre cirugía', () => {
    const tool = createCellSurgeonTool()
    const atlas = makeAtlas()
    const { ctx, surgeonCalls } = fakeCtx(atlas)

    tool.onDoubleClick!(640, 300, dblEv(), ctx) // fx-c:impact (simple)
    expect(surgeonCalls).toEqual([])
  })
})
