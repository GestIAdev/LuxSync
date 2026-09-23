/**
 * 🜨 WAVE 8182 — Tests del arsenal huérfano + FieldLayer.
 *
 * WavefrontTool (click=point / drag=line+dirDeg / máscara por
 * selección), SlicerTool y NoiseTool (rect→máscara + defaults
 * analíticos), y drawFieldLayer (heat discs por delay + anillos
 * isócronos en bandas de fase 250/100 ms, mask respetada).
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { WavefrontTool } from '../WavefrontTool'
import { SlicerTool } from '../SlicerTool'
import { NoiseTool } from '../NoiseTool'
import { gesturePreview, clearGesturePreview } from '../ToolRegistry'
import { drawFieldLayer } from '../../canvas/layers/FieldLayer'
import type { AsteriaToolContext } from '../ToolRegistry'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { FieldSnapshot } from '../../model/fieldEngine'
import type { Gesture, WaveGesture, SliceGesture, NoiseGesture } from '../../model/AsteriaProject'
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

/** Rig: fila horizontal en z=0 (-2…+2) + outliers arriba/abajo. */
function makeAtlas(): NodeAtlas {
  const entries = [
    entry('n0:cell', -2, 0),
    entry('n1:cell', -1, 0),
    entry('n2:cell', 0, 0),
    entry('n3:cell', 1, 0),
    entry('n4:cell', 2, 0),
    entry('far:cell', 0, 5),
    entry('up:cell', 0, -1.2),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

function fakeCtx(
  atlas: NodeAtlas,
  initialSelection: readonly string[] = [],
): { ctx: AsteriaToolContext; gestures: Gesture[] } {
  const gestures: Gesture[] = []
  const sel = new Set(initialSelection)
  return {
    ctx: {
      transform: () => TRANSFORM,
      atlas: () => atlas,
      setSelection: () => {},
      setHover: () => {},
      previewSelection: () => {},
      selection: () => sel,
      addGesture: (g) => { gestures.push(g) },
      setSurgeonDevice: () => {},
      fitRect: () => {},
    },
    gestures,
  }
}

const fakeEvent = () => ({ shiftKey: false, button: 0 }) as unknown as PointerEvent

/** mundo(x,z) → pantalla(px): zoom 40, centro (400,300). */
const scr = (x: number, z: number) => [400 + x * 40, 300 + z * 40] as const

// ─────────────────────────────────────────────────────────────────────────────
// WavefrontTool — el emisor de onda
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WavefrontTool (WAVE 8182)', () => {
  beforeEach(() => {
    WavefrontTool.cancel?.()
    clearGesturePreview()
  })

  test('click sin drag → wave shape "point" con emisor en el clic', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    WavefrontTool.onPointerDown!(...scr(1.5, -0.5), fakeEvent(), ctx)
    WavefrontTool.onPointerUp!(...scr(1.5, -0.5), fakeEvent(), ctx)
    expect(gestures).toHaveLength(1)
    const g = gestures[0] as WaveGesture
    expect(g.kind).toBe('wave')
    expect(g.shape).toBe('point')
    expect(g.dirDeg).toBeUndefined()
    expect(g.emitter.x).toBeCloseTo(1.5)
    expect(g.emitter.z).toBeCloseTo(-0.5)
    expect(g.speedMps).toBe(10)
    // Sin selección → máscara = todo el rig
    expect(g.mask.nodeIds).toHaveLength(7)
  })

  test('drag ≥0.25m → shape "line" con dirDeg del arrastre', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    WavefrontTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    // Drag hacia +x (este): dirDeg ≈ 0
    WavefrontTool.onPointerMove!(...scr(1.2, 0), fakeEvent(), ctx)
    expect(gesturePreview.wave?.hasDir).toBe(true)
    WavefrontTool.onPointerUp!(...scr(1.2, 0), fakeEvent(), ctx)
    const g = gestures[0] as WaveGesture
    expect(g.shape).toBe('line')
    expect(g.dirDeg).toBeCloseTo(0, 0)
  })

  test('drag hacia +z → dirDeg ≈ 90 (convención XZ del lienzo)', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    WavefrontTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    WavefrontTool.onPointerMove!(...scr(0, 1.0), fakeEvent(), ctx)
    WavefrontTool.onPointerUp!(...scr(0, 1.0), fakeEvent(), ctx)
    const g = gestures[0] as WaveGesture
    expect(g.shape).toBe('line')
    expect(g.dirDeg).toBeCloseTo(90, 0)
  })

  test('con selección viva la máscara ES la selección', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas(), ['n1:cell', 'n2:cell'])
    WavefrontTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    WavefrontTool.onPointerUp!(...scr(0, 0), fakeEvent(), ctx)
    expect((gestures[0] as WaveGesture).mask.nodeIds.sort())
      .toEqual(['n1:cell', 'n2:cell'])
  })

  test('drag corto <0.25m se trata como click (point)', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    WavefrontTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    WavefrontTool.onPointerMove!(...scr(0.1, 0), fakeEvent(), ctx) // 0.1m
    WavefrontTool.onPointerUp!(...scr(0.1, 0), fakeEvent(), ctx)
    expect((gestures[0] as WaveGesture).shape).toBe('point')
  })

  test('cancel() limpia el preview y no commitea', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    WavefrontTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    WavefrontTool.cancel!()
    WavefrontTool.onPointerUp!(...scr(0, 0), fakeEvent(), ctx)
    expect(gesturePreview.wave).toBeNull()
    expect(gestures).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SlicerTool — rectángulo → máscara del SliceGesture
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 SlicerTool (WAVE 8182)', () => {
  beforeEach(() => {
    SlicerTool.cancel?.()
    clearGesturePreview()
  })

  test('drag rectangular → slice con máscara = nodos del rect', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    SlicerTool.onPointerDown!(...scr(-1.5, -0.5), fakeEvent(), ctx)
    SlicerTool.onPointerMove!(...scr(1.5, 0.5), fakeEvent(), ctx)
    SlicerTool.onPointerUp!(...scr(1.5, 0.5), fakeEvent(), ctx)
    expect(gestures).toHaveLength(1)
    const g = gestures[0] as SliceGesture
    expect(g.kind).toBe('slice')
    expect(g.mask.nodeIds.sort()).toEqual(['n1:cell', 'n2:cell', 'n3:cell'])
    // Defaults analíticos — el operador afina en el inspector
    expect(g.axis).toBe('x')
    expect(g.buckets).toBe(4)
    expect(g.spanMs).toBe(500)
    expect(g.symmetry).toBe('linear')
    expect(g.op).toBe('replace')
  })

  test('click sin drag → fallback a la selección viva', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas(), ['far:cell', 'up:cell'])
    SlicerTool.onPointerDown!(...scr(-5, -5), fakeEvent(), ctx)
    SlicerTool.onPointerUp!(...scr(-5, -5), fakeEvent(), ctx)
    expect((gestures[0] as SliceGesture).mask.nodeIds.sort())
      .toEqual(['far:cell', 'up:cell'])
  })

  test('click sin selección ni nodos bajo el rect → máscara = todo el rig', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    SlicerTool.onPointerDown!(...scr(-5, -5), fakeEvent(), ctx)
    SlicerTool.onPointerUp!(...scr(-5, -5), fakeEvent(), ctx)
    expect((gestures[0] as SliceGesture).mask.nodeIds).toHaveLength(7)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// NoiseTool — rectángulo → máscara del NoiseGesture
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 NoiseTool (WAVE 8182)', () => {
  beforeEach(() => {
    NoiseTool.cancel?.()
    clearGesturePreview()
  })

  test('drag rectangular → noise con máscara + defaults orgánicos', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    NoiseTool.onPointerDown!(...scr(-0.5, -0.5), fakeEvent(), ctx)
    NoiseTool.onPointerMove!(...scr(0.5, 0.5), fakeEvent(), ctx)
    NoiseTool.onPointerUp!(...scr(0.5, 0.5), fakeEvent(), ctx)
    const g = gestures[0] as NoiseGesture
    expect(g.kind).toBe('noise')
    expect(g.mask.nodeIds).toEqual(['n2:cell'])
    expect(g.scaleM).toBe(1.5)
    expect(g.amountMs).toBe(250)
    expect(g.octaves).toBe(2)
    expect(typeof g.seed).toBe('number')
  })

  test('seeds distintos por gesto sucesivo', () => {
    const { ctx, gestures } = fakeCtx(makeAtlas())
    NoiseTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    NoiseTool.onPointerUp!(...scr(0, 0), fakeEvent(), ctx)
    NoiseTool.onPointerDown!(...scr(0, 0), fakeEvent(), ctx)
    NoiseTool.onPointerUp!(...scr(0, 0), fakeEvent(), ctx)
    expect(gestures).toHaveLength(2)
    expect((gestures[0] as NoiseGesture).seed)
      .not.toBe((gestures[1] as NoiseGesture).seed)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FieldLayer — mapa térmico + isócronas por bandas de fase
// ─────────────────────────────────────────────────────────────────────────────

function fakeDrawCtx() {
  const calls = {
    fills: 0,
    strokes: 0,
    fillStyles: [] as unknown[],
    strokeStyles: [] as unknown[],
  }
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: 'butt',
    beginPath: () => {},
    closePath: () => {},
    arc: () => {},
    moveTo: () => {}, lineTo: () => {},
    fill: () => { calls.fills++; calls.fillStyles.push(ctx.fillStyle) },
    stroke: () => { calls.strokes++; calls.strokeStyles.push(ctx.strokeStyle) },
    fillRect: () => {}, strokeRect: () => {}, rect: () => {},
    fillText: () => {},
    setTransform: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, rotate: () => {},
    setLineDash: () => {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

function mkField(delays: number[], maskBits?: number[]): FieldSnapshot {
  const n = delays.length
  return {
    count: n,
    delayMs: Float32Array.from(delays),
    gain: Float32Array.from(delays.map(() => 1)),
    mask: Uint8Array.from(maskBits ?? delays.map(() => 1)),
  }
}

describe('🜨 drawFieldLayer (WAVE 8182)', () => {
  const atlas = makeAtlas() // 7 nodos

  test('un disco de calor por nodo enmascarado; mask=0 se omite', () => {
    const { ctx, calls } = fakeDrawCtx()
    const mask = [1, 1, 0, 1, 1, 0, 1]
    drawFieldLayer(ctx, TRANSFORM, atlas, mkField([0, 50, 100, 150, 200, 250, 300], mask))
    expect(calls.fills).toBe(5) // n2 y far enmascarados fuera
  })

  test('isócrona mayor 250ms: delay 0 y 250 dibujan anillo brillante', () => {
    const { ctx, calls } = fakeDrawCtx()
    // n0=0 (major), n1=100 (minor), n2=250 (major), n3=330 (ninguna)
    const sub: NodeAtlas = {
      entries: atlas.entries.slice(0, 4),
      byNodeId: atlas.byNodeId,
    }
    drawFieldLayer(ctx, TRANSFORM, sub, mkField([0, 100, 250, 330]))
    expect(calls.fills).toBe(4)
    expect(calls.strokes).toBe(3) // 0→major, 100→minor, 250→major
    const majors = calls.strokeStyles.filter((s) => s === 'rgba(140, 235, 255, 0.8)')
    const minors = calls.strokeStyles.filter((s) => s === 'rgba(140, 235, 255, 0.28)')
    expect(majors).toHaveLength(2)
    expect(minors).toHaveLength(1)
  })

  test('el delay mapea a la LUT de calor: t=0 violeta, t≥4s magenta', () => {
    const { ctx, calls } = fakeDrawCtx()
    const sub: NodeAtlas = {
      entries: atlas.entries.slice(0, 2),
      byNodeId: atlas.byNodeId,
    }
    drawFieldLayer(ctx, TRANSFORM, sub, mkField([0, 4000]))
    expect(String(calls.fillStyles[0])).toContain('123')   // violeta
    expect(String(calls.fillStyles[1])).toContain('255, 92, 140') // magenta clamp
  })

  test('field null o atlas null → no dibuja nada', () => {
    const { ctx, calls } = fakeDrawCtx()
    drawFieldLayer(ctx, TRANSFORM, atlas, null)
    drawFieldLayer(ctx, TRANSFORM, null, mkField([0]))
    expect(calls.fills).toBe(0)
    expect(calls.strokes).toBe(0)
  })
})
