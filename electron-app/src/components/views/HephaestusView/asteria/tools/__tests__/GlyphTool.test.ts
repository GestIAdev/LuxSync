/**
 * 🜨 WAVE 8050 — Tests del Glyph Stamper (T5)
 *
 * Verifica: drag = centro + scaleM del rect, click = tamaño por defecto,
 * canal gain/delay (Alt), máscara = selección o atlas, preview en vivo.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createGlyphTool, GLYPH_DEFAULT_TEXT } from '../GlyphTool'
import { gesturePreview, clearGesturePreview } from '../ToolRegistry'
import type { AsteriaToolContext } from '../ToolRegistry'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { GlyphGesture, Gesture } from '../../model/AsteriaProject'
import type { WorldTransform } from '../../canvas/useWorldTransform'

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
): { ctx: AsteriaToolContext; gestures: Gesture[] } {
  const gestures: Gesture[] = []
  return {
    ctx: {
      transform: () => TRANSFORM,
      atlas: () => atlas,
      setSelection: () => {},
      setHover: () => {},
      previewSelection: () => {},
      selection: () => selection,
      addGesture: (g) => { gestures.push(g) },
      setSurgeonDevice: () => {},
      fitRect: () => {},
    },
    gestures,
  }
}

const fakeEvent = (altKey = false, shiftKey = false, buttons = 1) =>
  ({ altKey, shiftKey, buttons, button: 0 }) as unknown as PointerEvent

describe('A GlyphTool (T5 — WAVE 8050)', () => {
  beforeEach(() => clearGesturePreview())

  test('drag = centro del ancla + scaleM por distancia; commit glyph', () => {
    const tool = createGlyphTool()
    const atlas = makeAtlas()
    const { ctx, gestures } = fakeCtx(atlas)

    tool.onPointerDown!(400, 300, fakeEvent(), ctx)      // mundo (0,0)
    tool.onPointerMove!(456, 300, fakeEvent(), ctx)      // +1.4 m
    tool.onPointerUp!(456, 300, fakeEvent(), ctx)

    expect(gestures).toHaveLength(1)
    const g = gestures[0] as GlyphGesture
    expect(g.kind).toBe('glyph')
    expect(g.text).toBe(GLYPH_DEFAULT_TEXT)
    expect(g.transform.x).toBeCloseTo(0, 5)
    expect(g.transform.z).toBeCloseTo(0, 5)
    expect(g.transform.scaleM).toBeCloseTo(1.4, 5)
    expect(g.channel).toBe('gain')
    expect(g.antialias).toBe(true)
    // Sin selección → máscara = todo el atlas
    expect(g.mask.nodeIds).toHaveLength(3)
  })

  test('click sin arrastre → scaleM por defecto 1.4 m', () => {
    const tool = createGlyphTool()
    const { ctx, gestures } = fakeCtx(makeAtlas())
    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    tool.onPointerUp!(400, 300, fakeEvent(), ctx)
    const g = gestures[0] as GlyphGesture
    expect(g.transform.scaleM).toBeCloseTo(1.4, 5)
  })

  test('Alt al soltar → channel delay (el texto barre el rig)', () => {
    const tool = createGlyphTool()
    const { ctx, gestures } = fakeCtx(makeAtlas())
    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    tool.onPointerUp!(400, 300, fakeEvent(true), ctx)
    expect((gestures[0] as GlyphGesture).channel).toBe('delay')
  })

  test('máscara = selección committed si existe', () => {
    const tool = createGlyphTool()
    const atlas = makeAtlas()
    const sel = new Set(['fx-a:petal-l', 'fx-a:petal-r'])
    const { ctx, gestures } = fakeCtx(atlas, sel)
    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    tool.onPointerUp!(400, 300, fakeEvent(), ctx)
    expect((gestures[0] as GlyphGesture).mask.nodeIds).toEqual([
      'fx-a:petal-l', 'fx-a:petal-r',
    ])
  })

  test('preview del rect vive en gesturePreview durante el drag', () => {
    const tool = createGlyphTool()
    const { ctx } = fakeCtx(makeAtlas())
    tool.onPointerDown!(400, 300, fakeEvent(), ctx)
    expect(gesturePreview.glyph).not.toBeNull()
    tool.onPointerMove!(456, 300, fakeEvent(), ctx)
    expect(gesturePreview.glyph!.scaleM).toBeCloseTo(1.4, 5)
    tool.onPointerUp!(456, 300, fakeEvent(), ctx)
    expect(gesturePreview.glyph).toBeNull()
  })
})
