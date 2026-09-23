/**
 * 🜨 WAVE 8170 — Tests de CrystalBoxLayer + NodeLayer (iconografía Hyperion)
 *
 * Cubre: reglas métricas (labels + énfasis eje 0), sombreado fuera del
 * Crystal Box + perímetro, dispatch de glifo por FixtureV2.type,
 * conversión yaw (convención Erebus: dir=(cos,sin)), caché por
 * referencia de getDeviceMeta, y la etiqueta flotante de hover.
 */

import { describe, test, expect } from 'vitest'
import {
  drawCrystalBox,
  drawRulers,
  FALLBACK_STAGE,
} from '../CrystalBoxLayer'
import {
  drawNodeLayer,
  drawHoverTag,
  getDeviceMeta,
  nodeGlyphRadiusPx,
} from '../NodeLayer'
import type { WorldTransform } from '../../useWorldTransform'
import type { NodeAtlas } from '../../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../../core/aether/types'
import type { FixtureV2 } from '../../../../../../../core/stage/ShowFileV2'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const T: WorldTransform = {
  cam: { panX: 0, panY: 0, zoom: 40 },
  canvasW: 800,
  canvasH: 600,
} as WorldTransform

/** Stub de CanvasRenderingContext2D que cuenta primitivas. */
function fakeCtx() {
  const calls = {
    moveTo: 0, lineTo: 0, arc: 0, rect: 0,
    stroke: 0, fill: 0, fillRect: 0, strokeRect: 0,
    texts: [] as string[],
  }
  const ctx = {
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    globalAlpha: 1, lineCap: 'butt', textAlign: '', textBaseline: '',
    setTransform: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => { calls.moveTo++ },
    lineTo: () => { calls.lineTo++ },
    arc: () => { calls.arc++ },
    rect: () => { calls.rect++ },
    stroke: () => { calls.stroke++ },
    fill: () => { calls.fill++ },
    fillRect: () => { calls.fillRect++ },
    strokeRect: () => { calls.strokeRect++ },
    fillText: (s: string) => { calls.texts.push(s) },
    measureText: (s: string) => ({ width: s.length * 6 }),
    save: () => {}, restore: () => {}, translate: () => {},
    rotate: () => {}, clip: () => {},
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

function entry(nodeId: string, deviceId: string, x = 0, z = 0): NodeAtlasEntry {
  return {
    nodeId, deviceId,
    cellSuffix: nodeId.slice(nodeId.indexOf(':') + 1),
    family: 'IMPACT', zoneId: 'front',
    position: { x, y: 0, z }, role: 'cell',
  }
}

function mkAtlas(entries: NodeAtlasEntry[]): NodeAtlas {
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

function fx(id: string, type: string, yawDeg = 0): FixtureV2 {
  return {
    id, type, rotation: { pitch: 0, yaw: yawDeg, roll: 0 },
  } as unknown as FixtureV2
}

// ─────────────────────────────────────────────────────────────────────────────
// M1 — CRYSTAL BOX + RULERS
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 CrystalBoxLayer — límites del mundo físico (WAVE 8170-M1)', () => {
  test('sombrea el exterior + perímetro + placa de dimensiones', () => {
    const { ctx, calls } = fakeCtx()
    drawCrystalBox(ctx, T, FALLBACK_STAGE)
    expect(calls.strokeRect).toBe(1)               // perímetro del box
    expect(calls.fillRect).toBeGreaterThanOrEqual(2) // bandas exteriores
    expect(
      calls.texts.some((s) => s.startsWith('CRYSTAL BOX 25×12×8m')),
    ).toBe(true)
  })

  test('stage null → fallback 25×12×8 (default warehouse)', () => {
    const { ctx, calls } = fakeCtx()
    drawCrystalBox(ctx, T, null)
    expect(calls.strokeRect).toBe(1)
    expect(calls.texts.some((s) => s.includes('25×12×8'))).toBe(true)
  })

  test('box custom del show: la placa refleja sus dimensiones', () => {
    const { ctx, calls } = fakeCtx()
    drawCrystalBox(ctx, T, { width: 10, depth: 6, height: 5, gridSize: 0.25 })
    expect(calls.texts.some((s) => s.includes('10×6×5'))).toBe(true)
  })

  test('reglas: etiquetas métricas + banda screen-fixed', () => {
    const { ctx, calls } = fakeCtx()
    drawRulers(ctx, T, FALLBACK_STAGE)
    // zoom 40 → labelStep 5 m: etiquetas -10,-5,0,5,10 en X
    expect(calls.texts).toContain('0')
    expect(calls.texts).toContain('-5')
    expect(calls.texts).toContain('10')
    // Bandas top+left dibujadas
    expect(calls.fillRect).toBeGreaterThanOrEqual(2)
    expect(calls.stroke).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M2 — HYPERION GLYPHS
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 NodeLayer — iconografía Hyperion (WAVE 8170-M2)', () => {
  test('getDeviceMeta: deviceId → {type, yawRad}; cache por referencia', () => {
    const fixtures = [fx('fx-a', 'moving-head', 90), fx('fx-b', 'par')]
    const m1 = getDeviceMeta(fixtures)
    expect(m1.get('fx-a')).toEqual({
      type: 'moving-head', yawRad: Math.PI / 2,
    })
    // Misma referencia → MISMO Map (zero-alloc en el hot path)
    expect(getDeviceMeta(fixtures)).toBe(m1)
    // Nueva referencia → rebuild
    const m2 = getDeviceMeta([...fixtures])
    expect(m2).not.toBe(m1)
    expect(m2.get('fx-b')!.type).toBe('par')
  })

  test('dispatch por tipo: mover→diamante, fan→hélice, par→doble anillo', () => {
    const atlas = mkAtlas([
      entry('mv:pan', 'mv', -1, 0),
      entry('fn:air', 'fn', 0, 0),
      entry('pr:dim', 'pr', 1, 0),
    ])
    const meta = getDeviceMeta([
      fx('mv', 'moving-head'), fx('fn', 'fan'), fx('pr', 'par'),
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T, atlas, meta)
    // Hélice: 3 aspas + hub = 4 arcs; PAR: 2 anillos + punto de vida = 3
    // → 7 arcs totales
    expect(calls.arc).toBe(7)
    // Diamante: moveTo + 3 lineTo (4 vértices)
    expect(calls.lineTo).toBe(3)
  })

  test('láser → barra direccional + núcleo axial', () => {
    const atlas = mkAtlas([entry('lz:beam', 'lz', 0, 0)])
    const meta = getDeviceMeta([fx('lz', 'laser', 45)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T, atlas, meta)
    expect(calls.lineTo).toBe(4) // 3 lados de barra + línea del núcleo
    expect(calls.arc).toBe(0)
  })

  test('sin meta (fixture ausente del show) → doble anillo default', () => {
    const atlas = mkAtlas([entry('ghost:dim', 'ghost', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T, atlas, getDeviceMeta([]))
    expect(calls.arc).toBe(3) // 2 anillos + punto de vida
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8171 — screen-space scaling + paleta industrial + texto inmutable
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WAVE 8171 — Iconography Polish', () => {
  test('radio del glifo: suelo 7px, escala con metros, techo 22px', () => {
    // FIXTURE_R_M = 0.18 m → zoom 40 = 7.2 px (sobre el suelo)
    expect(nodeGlyphRadiusPx(40)).toBeCloseTo(7.2, 1)
    // zoom extremo-bajo → suelo, jamás colapsa a 1 px
    expect(nodeGlyphRadiusPx(4)).toBe(7)
    // zoom cercano → escala con el mundo
    expect(nodeGlyphRadiusPx(100)).toBeCloseTo(18, 1)
    // zoom microscópico → techo
    expect(nodeGlyphRadiusPx(500)).toBe(22)
  })

  test('etiquetas de zoom: fuente px fija (inmutable al mundo)', () => {
    const atlas = mkAtlas([entry('fx-a:cell', 'fx-a', 0, 0)])
    const { ctx } = fakeCtx()
    const tClose = { ...T, cam: { ...T.cam, zoom: 120 } } as WorldTransform
    drawNodeLayer(ctx, tClose, atlas, getDeviceMeta([]))
    expect(ctx.font).toBe('10px monospace')
  })

  test('hover tag: 12px monospace absoluto', () => {
    const atlas = mkAtlas([entry('fx-a:petal-l', 'fx-a', 0, 0)])
    const { ctx } = fakeCtx()
    drawHoverTag(ctx, T, atlas, new Set(['fx-a:petal-l']))
    expect(ctx.font).toBe('12px monospace')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M3 — HOVER TAG
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 NodeLayer — hover tag (WAVE 8170-M3)', () => {
  test('hover sobre un nodo → placa + etiqueta con ID corto', () => {
    const atlas = mkAtlas([entry('fx-a:petal-l', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawHoverTag(ctx, T, atlas, new Set(['fx-a:petal-l']))
    expect(calls.texts).toContain('petal-l')
    expect(calls.rect).toBe(1) // placa
  })

  test('sin hover → no dibuja nada', () => {
    const atlas = mkAtlas([entry('fx-a:petal-l', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawHoverTag(ctx, T, atlas, new Set())
    expect(calls.texts).toHaveLength(0)
    expect(calls.rect).toBe(0)
  })

  test('hover sobre id inexistente → silencio', () => {
    const atlas = mkAtlas([entry('fx-a:petal-l', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawHoverTag(ctx, T, atlas, new Set(['nope:x']))
    expect(calls.texts).toHaveLength(0)
  })
})
