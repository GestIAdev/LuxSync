/**
 * 🜨 WAVE 8050 — Tests del rasterizador de glifos (T5)
 *
 * Cubre: fuente 5×7 (rasterización exacta por píxel), transform
 * mundo→glifo (traslación/escala/rotación), cobertura dura/antialias/
 * threshold, y la legibilidad efectiva (Gate 8050: "LUX" legible en un
 * rig ≥24 nodos, aviso honesto por debajo).
 */

import { describe, test, expect } from 'vitest'
import {
  rasterizeText,
  glyphRectMeters,
  worldToGlyphCell,
  glyphCoverageHard,
  glyphCoverageAA,
  sampleGlyphCoverage,
  measureGlyphLegibility,
  GLYPH_ROWS,
} from '../glyphRaster'
import type { GlyphGesture } from '../AsteriaProject'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function glyph(text: string, over: Partial<GlyphGesture> = {}): GlyphGesture {
  return {
    kind: 'glyph',
    id: 'g1',
    mask: { nodeIds: [] },
    op: 'replace',
    text,
    transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
    channel: 'gain',
    antialias: false,
    ...over,
  }
}

/** Gesto de test con máscara = todo el atlas (legibilidad real). */
function glyphAll(
  text: string, atlas: NodeAtlas, over: Partial<GlyphGesture> = {},
): GlyphGesture {
  return glyph(text, {
    mask: { nodeIds: atlas.entries.map((e) => e.nodeId) },
    ...over,
  })
}

function entry(nodeId: string, x: number, z: number): NodeAtlasEntry {
  return {
    nodeId,
    deviceId: nodeId.split(':')[0],
    cellSuffix: nodeId,
    family: 'IMPACT',
    zoneId: 'front',
    position: { x, y: 3, z },
    role: 'cell',
  }
}

function gridAtlas(
  x0: number, x1: number, z0: number, z1: number, step: number,
): NodeAtlas {
  const entries: NodeAtlasEntry[] = []
  let i = 0
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    for (let z = z0; z <= z1 + 1e-9; z += step) {
      entries.push(entry(`fx-${i}:cell`, +x.toFixed(4), +z.toFixed(4)))
      i++
    }
  }
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

// ─────────────────────────────────────────────────────────────────────────────
// RASTER — la fuente 5×7
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 glyphRaster — fuente 5×7', () => {
  test("rasterizeText('L'): barra izquierda + barra INFERIOR", () => {
    const bmp = rasterizeText('L')
    expect(bmp.cols).toBe(5)
    expect(bmp.rows).toBe(7)
    // Columna 0 encendida en las 7 filas
    for (let r = 0; r < 7; r++) expect(bmp.data[r * 5 + 0]).toBe(1)
    // Fila 6 (inferior) encendida en las 5 columnas
    for (let c = 0; c < 5; c++) expect(bmp.data[6 * 5 + c]).toBe(1)
    // Fila 0: solo la columna 0 (la barra es abajo, no arriba)
    expect(bmp.data[0 * 5 + 1]).toBe(0)
    expect(bmp.data[0 * 5 + 4]).toBe(0)
  })

  test("rasterizeText('7'): barra SUPERIOR + diagonal", () => {
    const bmp = rasterizeText('7')
    // Fila 0 completa
    for (let c = 0; c < 5; c++) expect(bmp.data[c]).toBe(1)
    // Fila 6: solo la columna del pie (col2) — el tallo llega abajo
    expect(bmp.data[6 * 5 + 2]).toBe(1)
    expect(bmp.data[6 * 5 + 0]).toBe(0)
  })

  test("'LUX' → 17 columnas (3 chars × 6 − tracking final), tracking vacío", () => {
    const bmp = rasterizeText('LUX')
    expect(bmp.cols).toBe(17)
    // Columna de tracking entre 'L' y 'U' (índice 5) vacía
    for (let r = 0; r < 7; r++) expect(bmp.data[r * 17 + 5]).toBe(0)
  })

  test('minúsculas se rasterizan como mayúsculas; desconocido → ?', () => {
    const lo = rasterizeText('lux')
    const hi = rasterizeText('LUX')
    expect(Array.from(lo.data)).toEqual(Array.from(hi.data))
    const unk = rasterizeText('?')
    const unk2 = rasterizeText('\u{1F600}') // emoji → '?'
    expect(Array.from(unk2.data)).toEqual(Array.from(unk.data))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORM + SAMPLING — mundo → celda del bitmap
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 glyphRaster — sampling por posición', () => {
  const L = rasterizeText('L') // 5×7, rect 1.0 × 1.4 m con scaleM=1.4

  test('nodo sobre el tallo de L → cov 1; fuera del trazo → 0', () => {
    const g = glyph('L')
    // x=-0.4,z=0 → u=0.5,v=3.5 → celda (0,3) → tallo de L
    expect(sampleGlyphCoverage(-0.4, 0, g, L)).toBe(1)
    // x=0.3,z=-0.5 → celda (4,1) → L vacío ahí
    expect(sampleGlyphCoverage(0.3, -0.5, g, L)).toBe(0)
    // Fuera del rect
    expect(sampleGlyphCoverage(-2, 0, g, L)).toBe(0)
  })

  test('transform: traslación mueve el glifo; escala cambia el rect', () => {
    const g = glyph('L', {
      transform: { x: 3, z: -1, scaleM: 0.7, rotDeg: 0 },
    })
    const { widthM } = glyphRectMeters(L, 0.7)
    expect(widthM).toBeCloseTo(0.5, 5)
    // Punto sobre el tallo: centro - width/2 + media celda
    const x = 3 - widthM / 2 + 0.05 // dentro de la col 0
    expect(sampleGlyphCoverage(x, -1, g, L)).toBe(1)
    // La misma coordenada sin trasladar habría caído fuera
    expect(sampleGlyphCoverage(x, -1, glyph('L'), L)).toBe(0)
  })

  test('rotación 90°: lo que era el tallo izquierdo pasa a la fila superior', () => {
    const g = glyph('L', {
      transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 90 },
    })
    // Con rot 90°, el punto que antes estaba en el tallo (izquierda del
    // rect) ahora mapea a coordenada de celda distinta: comprobamos que
    // el punto rotado (0, -0.4) — que en el frame local es el viejo
    // tallo — da cobertura.
    const cov = sampleGlyphCoverage(0, -0.4, g, L)
    expect(cov).toBe(1)
  })

  test('antialias: el borde de un píxel interpola cobertura fraccional', () => {
    const bmp = rasterizeText('I') // tallo central col2
    // u=2.8 → uc=2.3: 30% hacia col3 (apagada) → cov = 0.7
    const mid = glyphCoverageAA(2.8, 3.5, bmp)
    expect(mid).toBeCloseTo(0.7, 5)
    // Hard: la misma coordenada cae en col2 → 1
    expect(glyphCoverageHard(2.8, 3.5, bmp)).toBe(1)
  })

  test('threshold: meseta dura {0,1} por debajo del umbral', () => {
    const g = glyph('I', { antialias: true, threshold: 0.75 })
    const bmp = rasterizeText('I')
    // x=-0.1 → u=2.0: borde exacto col1/col2 → mezcla 0.5 < 0.75 → 0
    expect(sampleGlyphCoverage(-0.1, 0, g, bmp)).toBe(0)
    // x=0 → u=2.5 → centro del tallo → cov 1 ≥ 0.75 → 1
    expect(sampleGlyphCoverage(0, 0, g, bmp)).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// LEGIBILIDAD — Gate 8050
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 glyphRaster — legibilidad efectiva', () => {
  test("'LUX' sobre retícula densa (≥24 nodos) → legible", () => {
    // Rect: x ∈ [-1.7, 1.7], z ∈ [-0.7, 0.7] — grid de 0.2 m
    const atlas = gridAtlas(-1.7, 1.7, -0.7, 0.7, 0.2)
    const m = measureGlyphLegibility(atlas, glyphAll('LUX', atlas))
    expect(m.nodesInRect).toBeGreaterThanOrEqual(24)
    expect(m.rowsResolved).toBe(7)
    // 'LUX' enciende 15 de sus 17 columnas (2 de tracking vacías)
    expect(m.colsResolved).toBe(15)
    expect(m.legible).toBe(true)
    expect(m.nodesPerMeter).toBeGreaterThan(0)
  })

  test('rig disperso → NO legible (aviso honesto, Gate 8050)', () => {
    // Solo 4 nodos en el rect — imposible resolver 7 filas
    const atlas = {
      entries: [
        entry('a', -1, -0.5), entry('b', 1, -0.5),
        entry('c', -1, 0.5), entry('d', 1, 0.5),
      ],
      byNodeId: new Map(),
    }
    const m = measureGlyphLegibility(atlas, glyphAll('LUX', atlas))
    expect(m.legible).toBe(false)
    expect(m.rowsResolved).toBeLessThan(7)
  })

  test('nodos fuera del rect no cuentan; sin posición se ignoran', () => {
    const atlas = gridAtlas(-1.7, 1.7, -0.7, 0.7, 0.2)
    const extra = entry('far', 50, 50)
    const noPos: NodeAtlasEntry = { ...entry('np', 0, 0), position: undefined }
    const all = { entries: [...atlas.entries, extra, noPos], byNodeId: new Map() }
    const m = measureGlyphLegibility(all, glyphAll('LUX', all))
    expect(m.legible).toBe(true)
  })

  test('la máscara del gesto restringe qué nodos resuelven', () => {
    const atlas = gridAtlas(-1.7, 1.7, -0.7, 0.7, 0.2)
    const g = glyphAll('LUX', atlas, { mask: { nodeIds: ['fx-0:cell'] } })
    const m = measureGlyphLegibility(atlas, g)
    expect(m.nodesInRect).toBe(1)
    expect(m.legible).toBe(false)
  })
})
