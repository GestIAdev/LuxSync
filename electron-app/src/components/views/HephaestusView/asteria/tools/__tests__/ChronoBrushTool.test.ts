/**
 * 🜨 WAVE 8040B — Tests del Chrono-Brush (T3)
 *
 * Verifica: captura {x,z,tMs} en metros+ms, tempo real vs arcLength,
 * máscara = selección (o atlas completo), commit al Gesture Stack.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createChronoBrushTool } from '../ChronoBrushTool'
import { gesturePreview, clearGesturePreview } from '../ToolRegistry'
import type { AsteriaToolContext } from '../ToolRegistry'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { ChronoGesture, Gesture } from '../../model/AsteriaProject'
import type { WorldTransform } from '../../canvas/useWorldTransform'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFORM: WorldTransform = {
  cam: { panX: 0, panY: 0, zoom: 40 },
  canvasW: 800,
  canvasH: 600,
} as WorldTransform

function entry(nodeId: string, deviceId: string, x = 0, z = 0): NodeAtlasEntry {
  return {
    nodeId,
    deviceId,
    cellSuffix: nodeId.slice(nodeId.indexOf(':') + 1),
    family: 'IMPACT',
    zoneId: 'front',
    position: { x, y: 0, z },
    role: 'cell',
  }
}

function makeAtlas(): NodeAtlas {
  const entries = [
    entry('fx-a:petal-l', 'fx-a', 0, 0),
    entry('fx-a:petal-r', 'fx-a', 0.15, 0),
    entry('fx-b:impact', 'fx-b', 2, 0),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

function fakeCtx(
  atlas: NodeAtlas,
  selection: ReadonlySet<string> = new Set(),
): { ctx: AsteriaToolContext; gestures: Gesture[]; selections: string[][] } {
  const gestures: Gesture[] = []
  const selections: string[][] = []
  return {
    ctx: {
      transform: () => TRANSFORM,
      atlas: () => atlas,
      setSelection: (ids) => { selections.push([...ids]) },
      setHover: () => {},
      previewSelection: () => {},
      selection: () => selection,
      addGesture: (g) => { gestures.push(g) },
      setSurgeonDevice: () => {},
      fitRect: () => {},
    },
    gestures,
    selections,
  }
}

const fakeEvent = (altKey = false, shiftKey = false) =>
  ({ altKey, shiftKey, button: 0 }) as unknown as PointerEvent

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('✎ ChronoBrushTool (T3 — WAVE 8040B)', () => {
  beforeEach(() => clearGesturePreview())

  test('captura {x,z,tMs} con tempo real y commitea gesto chrono', () => {
    let clock = 0
    const tool = createChronoBrushTool({ now: () => clock })
    const atlas = makeAtlas()
    const { ctx, gestures } = fakeCtx(atlas)

    tool.onPointerDown!(400, 300, fakeEvent(), ctx) // mundo (0,0)
    clock = 200
    tool.onPointerMove!(440, 300, fakeEvent(), ctx) // mundo (1,0)
    clock = 900
    tool.onPointerUp!(480, 300, fakeEvent(), ctx)   // mundo (2,0)

    expect(gestures).toHaveLength(1)
    const g = gestures[0] as ChronoGesture
    expect(g.kind).toBe('chrono')
    expect(g.captureRealTime).toBe(true)
    expect(g.radiusM).toBeCloseTo(0.8, 5)
    expect(g.stroke).toHaveLength(3)
    expect(g.stroke[0]).toEqual({ x: 0, z: 0, tMs: 0 })
    expect(g.stroke[1]).toEqual({ x: 1, z: 0, tMs: 200 })
    expect(g.stroke[2]).toEqual({ x: 2, z: 0, tMs: 900 })
    // Sin selección → máscara = todo el atlas
    expect(g.mask.nodeIds).toHaveLength(3)
  })

  test('Alt al iniciar → captureRealTime=false (modo arcLength)', () => {
    let clock = 0
    const tool = createChronoBrushTool({ now: () => clock })
    const { ctx, gestures } = fakeCtx(makeAtlas())

    tool.onPointerDown!(400, 300, fakeEvent(true), ctx)
    clock = 100
    tool.onPointerMove!(480, 300, fakeEvent(true), ctx)
    clock = 200
    tool.onPointerUp!(520, 300, fakeEvent(true), ctx)

    expect(gestures).toHaveLength(1)
    expect((gestures[0] as ChronoGesture).captureRealTime).toBe(false)
  })

  test('máscara = selección committed si existe', () => {
    let clock = 0
    const tool = createChronoBrushTool({ now: () => clock })
    const atlas = makeAtlas()
    const sel = new Set(['fx-a:petal-l'])
    const { ctx, gestures } = fakeCtx(atlas, sel)

    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    clock = 50
    tool.onPointerMove!(440, 300, fakeEvent(), ctx)
    clock = 100
    tool.onPointerUp!(480, 300, fakeEvent(), ctx)

    expect((gestures[0] as ChronoGesture).mask.nodeIds).toEqual([
      'fx-a:petal-l',
    ])
  })

  test('clic sin arrastre no crea gesto (trazo de 1 punto)', () => {
    const tool = createChronoBrushTool({ now: () => 0 })
    const { ctx, gestures } = fakeCtx(makeAtlas())
    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    tool.onPointerUp!(400, 300, fakeEvent(), ctx)
    expect(gestures).toHaveLength(0)
  })

  test('preview del trazo vive en gesturePreview durante el drag', () => {
    let clock = 0
    const tool = createChronoBrushTool({ now: () => clock })
    const { ctx } = fakeCtx(makeAtlas())

    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    clock = 100
    tool.onPointerMove!(440, 300, fakeEvent(), ctx)
    expect(gesturePreview.chrono).not.toBeNull()
    expect(gesturePreview.chrono!.pts).toEqual([0, 0, 1, 0])
    expect(gesturePreview.chrono!.radiusM).toBeCloseTo(0.8, 5)

    clock = 200
    tool.onPointerUp!(480, 300, fakeEvent(), ctx)
    expect(gesturePreview.chrono).toBeNull() // preview muere al soltar
  })
})
