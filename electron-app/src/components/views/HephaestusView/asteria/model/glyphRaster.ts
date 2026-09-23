/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GLYPH RASTER — WAVE 8050 · T5: LA TIPOGRAFÍA DEL RIG
 *
 * Blueprint §T5: texto con fuente bitmap 5×7 EMBEBIDA (cero dependencias
 * nuevas) rasterizado a un bitmap 2D y muestreado por nodo según su
 * posición espacial dentro del rect del glifo (transform mundo→glifo).
 *
 *   text ──► rasterizeText ──► bitmap {cols, rows=7}
 *   nodo (x,z) ──► mundo→glifo (translate/rot/scale) ──► coverage ∈ [0,1]
 *
 *   channel 'gain'  → el glifo es imagen quieta (Vía B / Λ-Frozen)
 *   channel 'delay' → el glifo barre el rig (Vía Λ): delay = distancia
 *                     local-X desde el borde izquierdo · 1000 ms/m
 *
 * LEGIBILIDAD (Gate 8050): la fuente necesita 7 filas y 5·N−1 columnas
 * resueltas — `measureGlyphLegibility` cuenta cuántas filas/columnas del
 * bitmap caen sobre nodos reales. Si falta alguna → GLYPH_UNREADABLE:
 * "Resolución insuficiente para texto legible". Nunca silencioso.
 *
 * FUENTE: formato clásico 5×7 — cada carácter = 5 bytes column-major,
 * bit j (LSB→MSB) = fila j (j=0 fila superior). Charset: A-Z, 0-9 y
 * puntuación básica. Minúsculas se mapean a mayúsculas.
 *
 * Puro TypeScript — sin canvas, sin DOM: testeable en node y reusable
 * por fieldEngine (patch-time; los buffers viven en el engine).
 *
 * @module HephaestusView/asteria/model/glyphRaster
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { GlyphGesture } from './AsteriaProject'
import type { NodeAtlas } from '../store/useAsteriaStore'

// ═══════════════════════════════════════════════════════════════════════════
// FUENTE 5×7 EMBEBIDA — column-major, LSB = fila 0 (superior)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Caracteres del set — cada entrada son 5 columnas column-major.
 * CONVENCIÓN: bit j ↔ fila j, fila 0 = SUPERIOR del glifo.
 * (Verificado glifo a glifo: 'L' = barra inferior, '7' = barra superior.)
 */
const F5X7: Record<string, readonly number[]> = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  D: [0x7f, 0x41, 0x41, 0x41, 0x3e],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  G: [0x3e, 0x41, 0x49, 0x49, 0x38],
  H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00],
  J: [0x30, 0x70, 0x40, 0x40, 0x3f],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41],
  L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x04, 0x02, 0x7f],
  N: [0x7f, 0x06, 0x08, 0x30, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x4e],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x62, 0x49, 0x49, 0x49, 0x31],
  T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x7f, 0x20, 0x18, 0x20, 0x7f],
  X: [0x41, 0x22, 0x1c, 0x22, 0x41],
  Y: [0x01, 0x02, 0x7c, 0x02, 0x01],
  Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  '0': [0x3e, 0x51, 0x49, 0x45, 0x3e],
  '1': [0x00, 0x42, 0x7f, 0x40, 0x00],
  '2': [0x42, 0x61, 0x51, 0x49, 0x47],
  '3': [0x41, 0x49, 0x49, 0x49, 0x36],
  '4': [0x08, 0x0c, 0x0a, 0x09, 0x7f],
  '5': [0x4f, 0x49, 0x49, 0x49, 0x39],
  '6': [0x3e, 0x49, 0x49, 0x49, 0x30],
  '7': [0x01, 0x01, 0x79, 0x05, 0x03],
  '8': [0x36, 0x49, 0x49, 0x49, 0x36],
  '9': [0x06, 0x49, 0x49, 0x49, 0x3e],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  ',': [0x00, 0x40, 0x60, 0x00, 0x00],
  ':': [0x00, 0x36, 0x36, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  '!': [0x00, 0x00, 0x5f, 0x00, 0x00],
  '?': [0x02, 0x01, 0x51, 0x09, 0x06],
  "'": [0x00, 0x00, 0x03, 0x00, 0x00],
}

/** Columnas por carácter + 1 columna de tracking entre letras. */
export const GLYPH_COLS_PER_CHAR = 6
export const GLYPH_ROWS = 7

// ═══════════════════════════════════════════════════════════════════════════
// BITMAP — texto → malla 2D
// ═══════════════════════════════════════════════════════════════════════════

export interface GlyphBitmap {
  /** Columnas totales del bitmap (chars·6 − 1 de tracking final). */
  readonly cols: number
  /** Filas — siempre 7. */
  readonly rows: number
  /** Píxeles row-major: data[row*cols + col] ∈ {0,1}. */
  readonly data: Uint8Array
}

/**
 * Rasteriza `text` a un bitmap binario. Caracteres fuera del charset se
 * dibujan como '?' (el operador VE que algo falló — nunca silencio).
 */
export function rasterizeText(text: string, out?: Uint8Array): GlyphBitmap {
  // Array.from = code points (no rompe pares surrogate — un emoji es UN
  // glifo desconocido → '?', no dos basuras)
  const chars = Array.from(text.toUpperCase())
  const cols = Math.max(1, chars.length * GLYPH_COLS_PER_CHAR - 1)
  const rows = GLYPH_ROWS
  const data = out && out.length >= rows * cols ? out : new Uint8Array(rows * cols)
  data.fill(0, 0, rows * cols)

  for (let ci = 0; ci < chars.length; ci++) {
    const glyph = F5X7[chars[ci]] ?? F5X7['?']
    const x0 = ci * GLYPH_COLS_PER_CHAR
    for (let c = 0; c < 5; c++) {
      const colBits = glyph[c]
      for (let r = 0; r < rows; r++) {
        if (colBits & (1 << r)) data[r * cols + x0 + c] = 1
      }
    }
  }
  return { cols, rows, data }
}

// ═══════════════════════════════════════════════════════════════════════════
// GEOMETRÍA — mundo → glifo
// ═══════════════════════════════════════════════════════════════════════════

/** Medidas del rect del glifo en metros para un bitmap dado. */
export function glyphRectMeters(
  bitmap: GlyphBitmap,
  scaleM: number,
): { widthM: number; heightM: number } {
  const cell = scaleM / GLYPH_ROWS
  return { widthM: bitmap.cols * cell, heightM: scaleM }
}

/**
 * Transforma un punto del mundo a coordenadas de CELDA del bitmap.
 * El rect del glifo va centrado en `transform.x/z`, alto = scaleM,
 * rotado `rotDeg` alrededor de su centro.
 * Devuelve {u, v} en unidades de celda: u∈[0,cols], v∈[0,7] dentro.
 */
export function worldToGlyphCell(
  x: number,
  z: number,
  g: GlyphGesture,
  bitmap: GlyphBitmap,
): { u: number; v: number } {
  const { widthM } = glyphRectMeters(bitmap, g.transform.scaleM)
  const rad = (-g.transform.rotDeg * Math.PI) / 180
  const dx = x - g.transform.x
  const dz = z - g.transform.z
  const lx = dx * Math.cos(rad) - dz * Math.sin(rad)
  const lz = dx * Math.sin(rad) + dz * Math.cos(rad)
  const cell = g.transform.scaleM / GLYPH_ROWS
  return {
    u: (lx + widthM / 2) / cell,
    v: (lz + g.transform.scaleM / 2) / cell,
  }
}

/** Cobertura binaria: ¿el punto cae sobre un píxel encendido? */
export function glyphCoverageHard(
  u: number,
  v: number,
  bitmap: GlyphBitmap,
): number {
  const c = Math.floor(u)
  const r = Math.floor(v)
  if (c < 0 || c >= bitmap.cols || r < 0 || r >= bitmap.rows) return 0
  return bitmap.data[r * bitmap.cols + c]
}

/**
 * Cobertura con antialias — bilinear sobre la celda fraccionaria.
 * Los nodos son puntos: el valor interpola el brillo del bitmap
 * (un nodo entre dos píxeles recibe el promedio ponderado).
 */
export function glyphCoverageAA(
  u: number,
  v: number,
  bitmap: GlyphBitmap,
): number {
  const uc = u - 0.5
  const vc = v - 0.5
  const x0 = Math.floor(uc)
  const y0 = Math.floor(vc)
  const fx = uc - x0
  const fy = vc - y0
  const at = (c: number, r: number): number =>
    c < 0 || c >= bitmap.cols || r < 0 || r >= bitmap.rows
      ? 0
      : bitmap.data[r * bitmap.cols + c]
  const a = at(x0, y0)
  const b = at(x0 + 1, y0)
  const c = at(x0, y0 + 1)
  const d = at(x0 + 1, y0 + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/**
 * Cobertura del nodo en el glifo [0,1]: antialias bilinear o muestreo
 * duro; `threshold` (si definido) convierte a meseta {0,1}.
 */
export function sampleGlyphCoverage(
  x: number,
  z: number,
  g: GlyphGesture,
  bitmap: GlyphBitmap,
): number {
  const { u, v } = worldToGlyphCell(x, z, g, bitmap)
  const cov = g.antialias
    ? glyphCoverageAA(u, v, bitmap)
    : glyphCoverageHard(u, v, bitmap)
  if (g.threshold !== undefined) return cov >= g.threshold ? 1 : 0
  return cov
}

/** ms de delay por metro de recorrido horizontal del barrido (1 m/s). */
export const GLYPH_DELAY_MS_PER_M = 1000

// ═══════════════════════════════════════════════════════════════════════════
// LEGIBILIDAD — resolución efectiva del rig bajo el glifo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🜨 WAVE 8160 (M2): tolerancia espacial al contar filas/columnas.
 * Un nodo a menos de esta distancia de un borde de celda cuenta para
 * AMBAS celdas vecinas — una matriz con nodos a medio paso del borde
 * ya no produce falsos "fila sin resolver". Alineado con el voxel de
 * 0.25 m del Crystal Box (_syncDerivedState snapea a esa rejilla).
 */
export const GLYPH_LEGIBILITY_TOLERANCE_M = 0.25

export interface GlyphLegibility {
  /** Nodos posicionados (y enmascarados) dentro del rect del glifo. */
  readonly nodesInRect: number
  /** De las 7 filas de la fuente, cuántas contienen al menos un nodo. */
  readonly rowsResolved: number
  /** De las `cols` del bitmap, cuántas contienen al menos un nodo. */
  readonly colsResolved: number
  /** Densidad — nodos por metro de alto del glifo (HUD §T5). */
  readonly nodesPerMeter: number
  /** true ⇔ las 7 filas Y todas las columnas con píxel están resueltas. */
  readonly legible: boolean
}

/**
 * Mide la legibilidad del gesto sobre el atlas: un texto 5×7 solo se lee
 * si cada fila Y cada columna encendida cae sobre al menos un nodo.
 * "LUX" legible exige el rig suficientemente denso bajo el glifo — por
 * debajo, el aviso honesto (Gate 8050 / GLYPH_UNREADABLE).
 */
export function measureGlyphLegibility(
  atlas: NodeAtlas | null,
  g: GlyphGesture,
): GlyphLegibility {
  const none: GlyphLegibility = {
    nodesInRect: 0, rowsResolved: 0, colsResolved: 0,
    nodesPerMeter: 0, legible: false,
  }
  if (!atlas || !g.text) return none
  const bitmap = rasterizeText(g.text)
  const { widthM } = glyphRectMeters(bitmap, g.transform.scaleM)

  // Columnas que realmente dibujan (tracking vacío no exige nodo)
  const litCols = new Uint8Array(bitmap.cols)
  for (let c = 0; c < bitmap.cols; c++) {
    for (let r = 0; r < bitmap.rows; r++) {
      if (bitmap.data[r * bitmap.cols + c]) { litCols[c] = 1; break }
    }
  }
  const rowsHit = new Uint8Array(bitmap.rows)
  const colsHit = new Uint8Array(bitmap.cols)
  const maskIds = g.mask?.nodeIds
  const maskSet = maskIds ? new Set(maskIds) : null

  // 🜨 WAVE 8160 (M2): ε espacial en unidades de celda — un nodo a
  // <0.25 m del borde cuenta para la celda vecina también (matrices
  // grandes: los nodos no caen centrados en cada celda de la fuente).
  const cellM = g.transform.scaleM > 0 ? g.transform.scaleM / bitmap.rows : 0
  const epsCell = cellM > 0 ? GLYPH_LEGIBILITY_TOLERANCE_M / cellM : 0

  /** Marca la banda de `w` + la vecina si queda a <ε del borde. */
  const markBand = (arr: Uint8Array, w: number, max: number): void => {
    // +ε fp: un nodo sobre el borde exacto de celda no debe caer en la
    // banda anterior por error de coma flotante (0.4/0.2 = 1.9999…)
    const i = Math.min(max - 1, Math.floor(w + 1e-6))
    arr[i] = 1
    if (epsCell <= 0) return
    const frac = w - Math.floor(w)
    // Independientes (no else-if): si ε ≥ celda el nodo queda a <ε de
    // AMBOS bordes → cuenta para las dos vecinas (simetría espacial).
    if (frac < epsCell && i > 0) arr[i - 1] = 1
    if (frac > 1 - epsCell && i < max - 1) arr[i + 1] = 1
  }

  let inRect = 0
  for (const e of atlas.entries) {
    if (!e.position) continue
    if (maskSet && !maskSet.has(e.nodeId)) continue
    const { u, v } = worldToGlyphCell(e.position.x, e.position.z, g, bitmap)
    if (u < 0 || u >= bitmap.cols || v < 0 || v >= bitmap.rows) continue
    inRect++
    markBand(rowsHit, v, bitmap.rows)
    markBand(colsHit, u, bitmap.cols)
  }

  let rowsResolved = 0
  for (let r = 0; r < bitmap.rows; r++) rowsResolved += rowsHit[r]
  let colsResolved = 0
  let litNeeded = 0
  for (let c = 0; c < bitmap.cols; c++) {
    if (!litCols[c]) continue
    litNeeded++
    colsResolved += colsHit[c]
  }

  return {
    nodesInRect: inRect,
    rowsResolved,
    colsResolved,
    nodesPerMeter: g.transform.scaleM > 0 ? inRect / g.transform.scaleM : 0,
    legible: rowsResolved === bitmap.rows && colsResolved === litNeeded,
  }
}
