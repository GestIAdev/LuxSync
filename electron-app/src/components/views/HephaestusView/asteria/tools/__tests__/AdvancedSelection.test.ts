/**
 * 🜨 WAVE 8150-F4 — Tests de selección avanzada + ghosting de capa.
 *
 * nodesNearWorldSegment (query pura), PolygonTool (vértices + cierre),
 * LineTool (banda de segmento), gestureGhostIds (resolver por kind +
 * caché por identidad).
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { PolygonTool } from '../PolygonTool'
import { LineTool } from '../LineTool'
import { gesturePreview, clearGesturePreview } from '../ToolRegistry'
import { nodesNearWorldSegment } from '../selection'
import { gestureGhostIds, gestureGhostColor } from '../../model/gestureGhost'
import type { AsteriaToolContext } from '../ToolRegistry'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { Gesture } from '../../model/AsteriaProject'
import type { WorldTransform } from '../../canvas/useWorldTransform'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFORM: WorldTransform = {
  cam: { panX: 0, panY: 0, zoom: 40 },
  canvasW: 800,
  canvasH: 600,
} as WorldTransform

function entry(nodeId: string, x: number, z: number): NodeAtlasEntry {
  return {
    nodeId,
    deviceId: nodeId.split(':')[0],
    cellSuffix: nodeId.slice(nodeId.indexOf(':') + 1),
    family: 'IMPACT',
    zoneId: 'front',
    position: { x, y: 0, z },
    role: 'cell',
  }
}

/** Rig de prueba: fila horizontal en z=0 + outliers. */
function makeAtlas(): NodeAtlas {
  const entries = [
    entry('n0:cell', -2, 0),
    entry('n1:cell', -1, 0),
    entry('n2:cell', 0, 0),
    entry('n3:cell', 1, 0),
    entry('n4:cell', 2, 0),
    entry('far:cell', 0, 5),   // fuera de la banda
    entry('up:cell', 0, -1.2), // fuera del triángulo del test
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

function fakeCtx(atlas: NodeAtlas): {
  ctx: AsteriaToolContext
  selections: { ids: string[]; additive: boolean }[]
} {
  const selections: { ids: string[]; additive: boolean }[] = []
  return {
    ctx: {
      transform: () => TRANSFORM,
      atlas: () => atlas,
      setSelection: (ids, additive) => {
        selections.push({ ids: [...ids], additive })
      },
      setHover: () => {},
      previewSelection: () => {},
      selection: () => new Set(),
      addGesture: () => {},
      setSurgeonDevice: () => {},
      fitRect: () => {},
    },
    selections,
  }
}

const fakeEvent = (shiftKey = false) =>
  ({ shiftKey, button: 0 }) as unknown as PointerEvent

const keyEvent = (key: string) =>
  ({ key, preventDefault: () => {} }) as unknown as KeyboardEvent

/** Pantalla (px) → el transform centrado: mundo(x,z) = ((sx-400)/40, (sy-300)/40). */
const scr = (x: number, z: number) => [400 + x * 40, 300 + z * 40] as const

// ─────────────────────────────────────────────────────────────────────────────
// nodesNearWorldSegment
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 nodesNearWorldSegment (WAVE 8150-F4)', () => {
  test('nodos sobre el segmento dentro de halfWidth entran', () => {
    const out = nodesNearWorldSegment(
      makeAtlas(), -2, 0, 2, 0, 0.5, new Set<string>(),
    )
    expect([...out].sort()).toEqual(['n0:cell', 'n1:cell', 'n2:cell', 'n3:cell', 'n4:cell'])
  })

  test('el extremo del segmento hace clamp — no es una recta infinita', () => {
    const out = nodesNearWorldSegment(
      makeAtlas(), 0, 0, 0.5, 0, 0.5, new Set<string>(),
    )
    // n3 (x=1) está a 0.5 del extremo (0.5,0) → dentro del cap redondo
    expect(out.has('n3:cell')).toBe(true)
    // n4 (x=2) a 1.5 → fuera
    expect(out.has('n4:cell')).toBe(false)
    // n0 (x=-2) fuera del cap izquierdo
    expect(out.has('n0:cell')).toBe(false)
  })

  test('segmento degenerado = pick radial en el punto', () => {
    const out = nodesNearWorldSegment(
      makeAtlas(), 1, 0, 1, 0, 0.4, new Set<string>(),
    )
    expect([...out]).toEqual(['n3:cell'])
  })

  test('atlas null → set vacío; nodos sin position se ignoran', () => {
    expect(
      nodesNearWorldSegment(null, 0, 0, 1, 1, 0.5, new Set<string>()).size,
    ).toBe(0)
    const ghost = {
      ...entry('ghost:cell', 0, 0),
      position: undefined as unknown as { x: number; y: number; z: number },
    }
    const base = makeAtlas()
    const atlas: NodeAtlas = {
      entries: [...base.entries, ghost],
      byNodeId: new Map([...base.entries, ghost].map((e) => [e.nodeId, e])),
    }
    const out = nodesNearWorldSegment(atlas, -3, 0, 3, 0, 0.5, new Set<string>())
    expect(out.has('ghost:cell')).toBe(false)
    expect(out.size).toBe(5) // solo la fila real
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PolygonTool
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 PolygonTool (WAVE 8150-F4)', () => {
  beforeEach(() => {
    PolygonTool.cancel?.()
    clearGesturePreview()
  })

  // Triángulo (-2.5,-1),(2.5,-1),(0,1.5): a z=0 los bordes cruzan en
  // x=±1.5 → encierra n1/n2/n3; n0(±2) y n4 quedan fuera.
  const TRI: readonly (readonly [number, number])[] = [
    [-2.5, -1], [2.5, -1], [0, 1.5],
  ]

  test('clics acumulan vértices; doble clic cierra y selecciona el interior', () => {
    const { ctx, selections } = fakeCtx(makeAtlas())
    PolygonTool.onPointerDown!(...scr(...TRI[0]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[1]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[2]), fakeEvent(), ctx)
    expect(gesturePreview.polygon?.pts).toHaveLength(6)
    // Doble clic: el segundo pointerdown deduplica su vértice fantasma
    PolygonTool.onPointerDown!(...scr(...TRI[2]), fakeEvent(), ctx)
    PolygonTool.onDoubleClick!(...scr(...TRI[2]), {} as MouseEvent, ctx)
    expect(gesturePreview.polygon).toBeNull()
    expect(selections).toHaveLength(1)
    expect(selections[0].ids.sort()).toEqual(['n1:cell', 'n2:cell', 'n3:cell'])
    expect(selections[0].additive).toBe(false)
  })

  test('Enter cierra el polígono igual que el doble clic', () => {
    const { ctx, selections } = fakeCtx(makeAtlas())
    PolygonTool.onPointerDown!(...scr(...TRI[0]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[1]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[2]), fakeEvent(), ctx)
    PolygonTool.onKeyDown!(keyEvent('Enter'), ctx)
    expect(selections).toHaveLength(1)
    expect(selections[0].ids).toContain('n2:cell')
  })

  test('Escape cancela sin commitear; <3 vértices no commitea', () => {
    const { ctx, selections } = fakeCtx(makeAtlas())
    PolygonTool.onPointerDown!(...scr(...TRI[0]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[1]), fakeEvent(), ctx)
    PolygonTool.onKeyDown!(keyEvent('Escape'), ctx)
    expect(gesturePreview.polygon).toBeNull()
    // Enter con solo 2 vértices → no commit
    PolygonTool.onPointerDown!(...scr(...TRI[0]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[1]), fakeEvent(), ctx)
    PolygonTool.onKeyDown!(keyEvent('Enter'), ctx)
    expect(selections).toHaveLength(0)
  })

  test('Shift en el primer clic = selección aditiva', () => {
    const { ctx, selections } = fakeCtx(makeAtlas())
    PolygonTool.onPointerDown!(...scr(...TRI[0]), fakeEvent(true), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[1]), fakeEvent(), ctx)
    PolygonTool.onPointerDown!(...scr(...TRI[2]), fakeEvent(), ctx)
    PolygonTool.onKeyDown!(keyEvent('Enter'), ctx)
    expect(selections[0].additive).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LineTool
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 LineTool (WAVE 8150-F4)', () => {
  beforeEach(() => clearGesturePreview())

  test('drag dibuja el segmento y commitea la banda', () => {
    const { ctx, selections } = fakeCtx(makeAtlas())
    LineTool.onPointerDown!(...scr(-2.5, 0), fakeEvent(), ctx)
    LineTool.onPointerMove!(...scr(2.5, 0), fakeEvent(), ctx)
    LineTool.onPointerUp!(...scr(2.5, 0), fakeEvent(), ctx)
    expect(selections).toHaveLength(1)
    // Toda la fila z=0 dentro de 0.5m; far/up fuera
    expect(selections[0].ids.sort()).toEqual([
      'n0:cell', 'n1:cell', 'n2:cell', 'n3:cell', 'n4:cell',
    ])
  })

  test('diagonal solo recoge los nodos bajo el trazo', () => {
    const { ctx, selections } = fakeCtx(makeAtlas())
    LineTool.onPointerDown!(...scr(-1.2, -0.4), fakeEvent(), ctx)
    LineTool.onPointerMove!(...scr(0.4, 0.4), fakeEvent(), ctx)
    LineTool.onPointerUp!(...scr(0.4, 0.4), fakeEvent(), ctx)
    const ids = selections[0].ids
    expect(ids).toContain('n1:cell')
    expect(ids).toContain('n2:cell')
    expect(ids).not.toContain('n4:cell')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// gestureGhostIds — resolver de targets por kind + caché por identidad
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 gestureGhostIds — ghosting de capa (WAVE 8150-F4)', () => {
  const atlas = makeAtlas()

  const waveG = (nodeIds: string[]): Gesture => ({
    kind: 'wave', id: 'w', op: 'replace',
    mask: { nodeIds }, emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 8,
  })

  test('wave/slice/noise → mask.nodeIds', () => {
    const ids = gestureGhostIds(waveG(['n0:cell', 'n2:cell']), atlas)
    expect([...ids].sort()).toEqual(['n0:cell', 'n2:cell'])
  })

  test('base → TODO el rig (la capa fondo no lleva máscara)', () => {
    const base: Gesture = { kind: 'base', id: 'base', delayMs: 0, gain: 1 }
    const ids = gestureGhostIds(base, atlas)
    expect(ids.size).toBe(atlas.entries.length)
  })

  test('manual → entries[].nodeId', () => {
    const manual: Gesture = {
      kind: 'manual', id: 'm',
      entries: [{ nodeId: 'n3:cell' }, { nodeId: 'far:cell', gain: 0.5 }],
    }
    expect([...gestureGhostIds(manual, atlas)].sort()).toEqual([
      'far:cell', 'n3:cell',
    ])
  })

  test('caché por identidad: mismo gesto → mismo Set; patch → recompute', () => {
    const g = waveG(['n0:cell'])
    const a = gestureGhostIds(g, atlas)
    const b = gestureGhostIds(g, atlas)
    expect(b).toBe(a) // instancia cacheada
    const g2 = { ...g, mask: { nodeIds: ['n1:cell'] } }
    const c = gestureGhostIds(g2, atlas)
    expect(c).not.toBe(a)
    expect([...c]).toEqual(['n1:cell'])
  })

  test('color por kind — paleta distinta por gesto', () => {
    expect(gestureGhostColor({ kind: 'base', id: 'b', delayMs: 0, gain: 1 })).toEqual([230, 225, 255])
    expect(gestureGhostColor(waveG([]))).toEqual([92, 225, 255])
  })
})
