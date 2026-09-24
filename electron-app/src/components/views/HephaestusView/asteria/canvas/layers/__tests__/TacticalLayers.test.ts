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
  nodeLabelFontPx,
  resolveGlyphType,
} from '../NodeLayer'
import type { WorldTransform } from '../../useWorldTransform'
import type { NodeAtlas } from '../../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../../core/aether/types'
import type { FixtureV2 } from '../../../../../../../core/stage/ShowFileV2'
import type { ColorPlane, PlaneField } from '../../../model/fieldEngine'
import type {
  HephPreviewData,
  PreviewFixtureState,
} from '../../../../useHephPreview'

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
    /** 🜨 8198: (fillStyle, globalAlpha) en el momento de cada fill. */
    fills: [] as { style: string; alpha: number }[],
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
    fill: () => {
      calls.fill++
      calls.fills.push({ style: ctx.fillStyle, alpha: ctx.globalAlpha })
    },
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

  test('etiquetas de zoom: fuente semidinámica clampeada [12,24]', () => {
    const atlas = mkAtlas([entry('fx-a:cell', 'fx-a', 0, 0)])
    const { ctx } = fakeCtx()
    const tClose = { ...T, cam: { ...T.cam, zoom: 120 } } as WorldTransform
    drawNodeLayer(ctx, tClose, atlas, getDeviceMeta([]))
    // zoom 120 → round(10 + 4.8) = 15 px
    expect(ctx.font).toBe('15px monospace')
  })

  test('nodeLabelFontPx: suelo 12, crece con zoom, techo 24', () => {
    expect(nodeLabelFontPx(40)).toBe(12)   // 11.6 → suelo
    expect(nodeLabelFontPx(200)).toBe(18)  // crece suave
    expect(nodeLabelFontPx(500)).toBe(24)  // techo — jamás grotesca
  })

  test('hover tag: 14px monospace absoluto', () => {
    const atlas = mkAtlas([entry('fx-a:petal-l', 'fx-a', 0, 0)])
    const { ctx } = fakeCtx()
    drawHoverTag(ctx, T, atlas, new Set(['fx-a:petal-l']))
    expect(ctx.font).toBe('14px monospace')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8173-M1 — una sola etiqueta por aparato
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WAVE 8173 — label overlap fix', () => {
  const T_CLOSE = { ...T, cam: { ...T.cam, zoom: 120 } } as WorldTransform

  test('celdas del mismo aparato → UNA etiqueta (dedupe por deviceId)', () => {
    const atlas = mkAtlas([
      { ...entry('mv:pan', 'mv', -0.07, 0), customLabel: 'Pan' },
      { ...entry('mv:tilt', 'mv', 0.07, 0), customLabel: 'Main Intensity' },
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T_CLOSE, atlas, getDeviceMeta([]))
    // Dos celdas a 14cm en el mismo cluster → una sola fillText
    expect(calls.texts).toHaveLength(1)
    expect(calls.texts[0]).toBe('Pan') // sin meta de padre → customLabel de celda
  })

  test('8174-M2: el nombre del PADRE pisa el customLabel de la celda', () => {
    // El bug reportado: el Tungsten imprimía "Wash Color" (celda) en
    // vez del nombre del aparato. Prioridad: padre → celda.
    const atlas = mkAtlas([
      { ...entry('tw:wash', 'tw', -0.07, 0), customLabel: 'Wash Color' },
      { ...entry('tw:impact', 'tw', 0.07, 0), customLabel: 'Main Intensity' },
    ])
    const meta = getDeviceMeta([
      { ...fx('tw', 'effect'), name: 'Fan Tungsten' } as FixtureV2,
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T_CLOSE, atlas, meta)
    expect(calls.texts).toEqual(['Fan Tungsten'])
  })

  test('aparatos distintos → una etiqueta cada uno', () => {
    const atlas = mkAtlas([
      entry('a:dim', 'a', -1, 0),
      entry('b:dim', 'b', 1, 0),
    ])
    const meta = getDeviceMeta([
      fx('a', 'par'), fx('b', 'par'),
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T_CLOSE, atlas, meta)
    expect(calls.texts).toHaveLength(2)
  })

  test('sin customLabel cae al name/model del fixture, luego cellSuffix', () => {
    const atlas = mkAtlas([entry('x:cell', 'x', 0, 0)])
    const meta = getDeviceMeta([
      { ...fx('x', 'par'), name: 'Tungsten Fan 01' } as FixtureV2,
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T_CLOSE, atlas, meta)
    expect(calls.texts).toEqual(['Tungsten Fan 01'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8172-M2 — Fan matcher robusto
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WAVE 8172 — Fan Tungsten matcher', () => {
  const fxFull = (
    id: string, type: string, name = '', model = '',
    channels?: Array<{ index: number; name: string; type: string; is16bit: boolean }>,
  ): FixtureV2 =>
    ({
      id, type, name, model, channels,
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    }) as unknown as FixtureV2

  test("type 'fan' explícito → hélice", () => {
    expect(resolveGlyphType(fxFull('f1', 'fan'))).toBe('fan')
  })

  test("'Fan Tungsten' con type 'effect' → hélice por nombre", () => {
    expect(
      resolveGlyphType(fxFull('f2', 'effect', 'Fan Tungsten 01')),
    ).toBe('fan')
    // case-insensitive + model también cuenta
    expect(
      resolveGlyphType(fxFull('f3', 'generic', '', 'ADJ iFan 32')),
    ).toBe('fan')
  })

  test('canal de motor continuo (rotation/spin) → hélice heurística', () => {
    const fx = fxFull('f4', 'effect', 'Blower 9000', '', [
      { index: 0, name: 'Blade Rotation', type: 'range', is16bit: false },
    ])
    expect(resolveGlyphType(fx)).toBe('fan')
  })

  test('WAVE 8173-M2: el nombre MANDA — mover/PAR con "fan" en name → hélice', () => {
    // El escudo de tipos explícitos se rompe SOLO por el nombre:
    // el operador llama a su aparato "Fan …" → quiere ver aspas.
    expect(
      resolveGlyphType(fxFull('m1', 'moving-head', 'Fantasy Spot')),
    ).toBe('fan')
    expect(resolveGlyphType(fxFull('p1', 'par', 'Fanny Wash'))).toBe('fan')
    // …pero sin 'fan' en el nombre, el tipo explícito sigue intacto
    expect(resolveGlyphType(fxFull('m2', 'moving-head', 'Spot 250'))).toBe(
      'moving-head',
    )
    expect(resolveGlyphType(fxFull('p2', 'par', 'Wash Left'))).toBe('par')
  })

  test('canal "Fan Speed" en un PAR explícito NO rompe el anillo', () => {
    // La heurística de canal queda BAJO los tipos explícitos: un PAR
    // con ventilador de refrigeración no se convierte en hélice.
    const fx = fxFull('p3', 'par', 'Wash Left', '', [
      { index: 0, name: 'Fan Speed', type: 'range', is16bit: false },
    ])
    expect(resolveGlyphType(fx)).toBe('par')
  })

  test('render: "Fan Tungsten" (type effect) dibuja aspas; mover limpio = diamante', () => {
    const atlas = mkAtlas([
      entry('mv:pan', 'mv', -1, 0),
      entry('tw:air', 'tw', 1, 0),
    ])
    const meta = getDeviceMeta([
      fxFull('mv', 'moving-head', 'Spot 250'),     // nombre limpio → diamante
      fxFull('tw', 'effect', 'Fan Tungsten'),      // effect + 'fan' → hélice
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T, atlas, meta)
    expect(calls.lineTo).toBe(3) // solo el diamante del mover
    expect(calls.arc).toBe(4)    // 3 aspas + hub del ventilador
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8174 — Composite Fixture Resolution (parent-aware)
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WAVE 8174 — Tungsten compuesto (parent-aware heuristics)', () => {
  const fxFull = (
    id: string, type: string, name = '', model = '', profileId = '',
  ): FixtureV2 =>
    ({
      id, type, name, model, profileId,
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    }) as unknown as FixtureV2

  test("'Tungsten' sin 'fan' en el nombre → hélice (paridad Hyperion)", () => {
    // El clasificador de Hyperion (useFixtureData 7761.5) matchea
    // 'fan' O 'tungsten' — el aparato real puede llamarse "Tungsten #3"
    expect(resolveGlyphType(fxFull('t1', 'effect', 'Tungsten #3'))).toBe('fan')
    expect(resolveGlyphType(fxFull('t2', 'effect', 'Washer Tungsten'))).toBe('fan')
    // Por model/profileId también (definición 'fan_tungsten'/'tungsten')
    expect(resolveGlyphType(fxFull('t3', 'effect', '', 'tungsten_rgb'))).toBe('fan')
    expect(resolveGlyphType(fxFull('t4', 'blinder', '', '', 'fan_tungsten'))).toBe('fan')
  })

  test("celda 'Wash Color' de un Tungsten hereda la hélice del padre", () => {
    // La celda nunca se evalúa: meta resuelve por deviceId → padre.
    const atlas = mkAtlas([
      entry('tung-1:wash', 'tung-1', -1, 0),
      entry('tung-1:petal-l', 'tung-1', -0.9, 0),
      entry('par-1:dim', 'par-1', 1, 0),
    ])
    const meta = getDeviceMeta([
      fxFull('tung-1', 'effect', 'Tungsten'),
      fxFull('par-1', 'par', 'LED Par'),
    ])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T, atlas, meta)
    // 2 celdas Tungsten = 2 hélices (8 arcs) + PAR (2 anillos + punto = 3)
    expect(calls.arc).toBe(11)
    expect(calls.lineTo).toBe(0)
  })

  test('fallback por deviceId: fixture ausente + id "tungsten-1" → hélice', () => {
    const atlas = mkAtlas([entry('tungsten-1:wash', 'tungsten-1', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(ctx, T, atlas, getDeviceMeta([])) // fixture no resuelve
    expect(calls.arc).toBe(4) // 3 aspas + hub
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 8198 — TRUE-BLACK: el tinte latente obedece a la intensidad real
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WAVE 8198/8199 — NodeLayer true-black (tinte × intensidad)', () => {
  /** ColorPlane de 2 nodos: ambos con cobertura plena, rojo/verde lineal. */
  const mkColorPlane = (): ColorPlane => ({
    delayMs: new Float32Array(2),
    gain: new Float32Array([1, 1]),
    mask: new Uint8Array([1, 1]),
    owner: new Uint16Array(2),
    rgb: new Float32Array([1, 0, 0, 0, 1, 0]),
    alpha: new Float32Array([0.8, 0.8]),
  })
  const mkIntensity = (
    mask: readonly number[],
    gain: readonly number[],
  ): PlaneField => ({
    delayMs: new Float32Array(mask.length),
    gain: new Float32Array(gain),
    mask: new Uint8Array(mask),
  })
  const hasTintFill = (calls: { fills: { style: string }[] }): boolean =>
    calls.fills.some((f) => f.style.startsWith('rgb('))
  const tintAlpha = (calls: { fills: { style: string; alpha: number }[] }): number =>
    calls.fills.find((f) => f.style.startsWith('rgb('))!.alpha

  test('intensidad mask=1 gain=1 → disco de tinte con alpha pleno (0.8·0.85)', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [1]),
    )
    expect(hasTintFill(calls)).toBe(true)
    expect(tintAlpha(calls)).toBeCloseTo(0.8 * 0.85, 6)
  })

  test('gain=0 → SIN disco: el nodo queda en estado apagado táctico', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [0]),
    )
    expect(hasTintFill(calls)).toBe(false)
    expect(calls.arc).toBe(3) // el glifo (chasis) sigue dibujándose
  })

  test('nodo fuera de la máscara de intensidad → 0 fotones → negro', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([0], [1]),
    )
    expect(hasTintFill(calls)).toBe(false)
  })

  test('gain=0.5 → Visual Alpha = Latent × Intensity (0.8·0.5·0.85)', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [0.5]),
    )
    expect(hasTintFill(calls)).toBe(true)
    expect(tintAlpha(calls)).toBeCloseTo(0.8 * 0.5 * 0.85, 6)
  })

  test('sin plano de intensidad → tinte pleno (legado pre-8198)', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), null,
    )
    expect(hasTintFill(calls)).toBe(true)
    expect(tintAlpha(calls)).toBeCloseTo(0.8 * 0.85, 6)
  })

  test('dos nodos: solo el que emite muestra tinte', () => {
    const atlas = mkAtlas([
      entry('fx-a:dim', 'fx-a', -1, 0),
      entry('fx-b:dim', 'fx-b', 1, 0),
    ])
    const meta = getDeviceMeta([fx('fx-a', 'par'), fx('fx-b', 'par')])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, meta,
      mkColorPlane(), mkIntensity([1, 1], [1, 0]),
    )
    // Un solo fill 'rgb(' — el nodo apagado no tira disco
    expect(calls.fills.filter((f) => f.style.startsWith('rgb('))).toHaveLength(1)
  })

  // ── 8199: el valor TEMPORAL del preview manda sobre el gain estático ──
  const mkPreview = (
    ...fixtures: Array<{ fixtureId: string; dimmer: number }>
  ): HephPreviewData => ({
    playheadMs: 0,
    progress: 0,
    frameCount: 0,
    history: [],
    fixtures: fixtures.map((f) => f as PreviewFixtureState),
  })

  test('8199 REGRESIÓN: envolvente en valle (dimmer=0) → negro aunque gain estático=1', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [1]), // gain espacial 1.0 — engañaba
      mkPreview({ fixtureId: 'fx-a', dimmer: 0 }),
    )
    expect(hasTintFill(calls)).toBe(false)
    expect(calls.arc).toBe(3) // chasis intacto
  })

  test('8199: dimmer=255 → tinte pleno aunque gain estático=0', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [0]),
      mkPreview({ fixtureId: 'fx-a', dimmer: 255 }),
    )
    expect(hasTintFill(calls)).toBe(true)
    expect(tintAlpha(calls)).toBeCloseTo(0.8 * 0.85, 6)
  })

  test('8199: dimmer=128 → Visual Alpha = Latent × (128/255)', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [1]),
      mkPreview({ fixtureId: 'fx-a', dimmer: 128 }),
    )
    expect(tintAlpha(calls)).toBeCloseTo(0.8 * (128 / 255) * 0.85, 6)
  })

  test('8199: preview activo pero fixture ausente → 0 fotones → negro', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [1]),
      mkPreview({ fixtureId: 'fx-OTHER', dimmer: 255 }),
    )
    expect(hasTintFill(calls)).toBe(false)
  })

  test('8199: preview sin fixtures → cae al gain estático del plano', () => {
    const atlas = mkAtlas([entry('fx-a:dim', 'fx-a', 0, 0)])
    const { ctx, calls } = fakeCtx()
    drawNodeLayer(
      ctx, T, atlas, getDeviceMeta([fx('fx-a', 'par')]),
      mkColorPlane(), mkIntensity([1], [0.5]),
      mkPreview(), // fixtures vacío → fallback 8198
    )
    expect(tintAlpha(calls)).toBeCloseTo(0.8 * 0.5 * 0.85, 6)
  })
})

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
