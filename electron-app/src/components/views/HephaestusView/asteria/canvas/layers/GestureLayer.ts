/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GESTURE LAYER — WAVE 8020: TINTA DEL GESTO + ANILLOS DE SELECCIÓN
 *
 * Capa superior del pipeline. Dibuja:
 *   - El gesto EN CURSO leyendo `gesturePreview` (mutable, zero React):
 *     marquee rectangular, trazo del lasso, círculo del radial.
 *   - Anillos de SELECCIÓN committed (sólidos) y de PREVIEW fantasma
 *     (punteados, medio alpha) sobre los nodos.
 *   - Anillo de HOVER (acento brillante) — lo que el Poke va a tocar.
 *
 * Todo se lee por referencia estable dentro del RAF — esta capa jamás
 * toca React.
 *
 * @module HephaestusView/asteria/canvas/layers/GestureLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import { gesturePreview } from '../../tools/ToolRegistry'
import { nodeGlyphRadiusPx } from './NodeLayer'
import { rasterizeText, glyphRectMeters, GLYPH_ROWS } from '../../model/glyphRaster'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

const COLOR_GESTURE = 'rgba(123, 92, 255, 0.9)'
const COLOR_GESTURE_FILL = 'rgba(123, 92, 255, 0.08)'
const COLOR_SELECTED = 'rgba(230, 225, 255, 0.95)'
const COLOR_PREVIEW = 'rgba(123, 92, 255, 0.55)'
const COLOR_HOVER = 'rgba(255, 255, 255, 0.9)'
const CULL_MARGIN_PX = 16

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Anillo sobre cada nodo del set que tenga posición. */
function drawNodeRings(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas,
  nodeIds: ReadonlySet<string>,
  radius: number,
  dashed: boolean,
): void {
  if (nodeIds.size === 0) return
  const { canvasW, canvasH, cam } = t
  const halfW = canvasW / 2
  const halfH = canvasH / 2

  if (dashed) ctx.setLineDash([3, 3])
  ctx.beginPath()
  for (const id of nodeIds) {
    const entry = atlas.byNodeId.get(id)
    const pos = entry?.position
    if (!pos) continue
    const sx = (pos.x - cam.panX) * cam.zoom + halfW
    const sy = (pos.z - cam.panY) * cam.zoom + halfH
    if (
      sx < -CULL_MARGIN_PX || sx > canvasW + CULL_MARGIN_PX ||
      sy < -CULL_MARGIN_PX || sy > canvasH + CULL_MARGIN_PX
    ) {
      continue
    }
    ctx.moveTo(sx + radius, sy)
    ctx.arc(sx, sy, radius, 0, Math.PI * 2)
  }
  ctx.stroke()
  if (dashed) ctx.setLineDash([])
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────

export function drawGestureLayer(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas | null,
  selection: ReadonlySet<string>,
  preview: ReadonlySet<string>,
  hover: ReadonlySet<string>,
  /** 🜨 8150-F4: ghosting de capa — nodos dominados por el gesto
   *  seleccionado en el stack + su color por kind. */
  ghostIds?: ReadonlySet<string> | null,
  ghostRGB?: readonly [number, number, number] | null,
): void {
  const { cam, canvasW, canvasH } = t
  const halfW = canvasW / 2
  const halfH = canvasH / 2
  const toSX = (wx: number) => (wx - cam.panX) * cam.zoom + halfW
  const toSY = (wz: number) => (wz - cam.panY) * cam.zoom + halfH

  // ── Gesto en curso ────────────────────────────────────────────────────
  ctx.strokeStyle = COLOR_GESTURE
  ctx.fillStyle = COLOR_GESTURE_FILL
  ctx.lineWidth = 1.2

  if (gesturePreview.marquee) {
    const m = gesturePreview.marquee
    const x = toSX(m.x0)
    const y = toSY(m.z0)
    const w = (m.x1 - m.x0) * cam.zoom
    const h = (m.z1 - m.z0) * cam.zoom
    ctx.fillRect(x, y, w, h)
    ctx.strokeRect(x, y, w, h)
  }

  if (gesturePreview.lasso && gesturePreview.lasso.length >= 4) {
    const pts = gesturePreview.lasso
    ctx.beginPath()
    ctx.moveTo(toSX(pts[0]), toSY(pts[1]))
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo(toSX(pts[i]), toSY(pts[i + 1]))
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  if (gesturePreview.radial) {
    const g = gesturePreview.radial
    const rPx = g.r * cam.zoom
    ctx.beginPath()
    ctx.arc(toSX(g.cx), toSY(g.cz), Math.max(rPx, 2), 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // Regla del radio en metros — el operador VE la unidad real
    ctx.fillStyle = 'rgba(230, 225, 255, 0.75)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${g.r.toFixed(2)} m`, toSX(g.cx), toSY(g.cz) - Math.max(rPx, 2) - 6)
    ctx.fillStyle = COLOR_GESTURE_FILL
  }

  // 🜨 WAVE 8040B (T3): trazo del Chrono-Brush — polilínea + radio del
  // pincel en el último punto (el operador ve el ancho de cobertura).
  const ch = gesturePreview.chrono
  if (ch && ch.pts.length >= 4) {
    ctx.beginPath()
    ctx.moveTo(toSX(ch.pts[0]), toSY(ch.pts[1]))
    for (let i = 2; i < ch.pts.length; i += 2) {
      ctx.lineTo(toSX(ch.pts[i]), toSY(ch.pts[i + 1]))
    }
    ctx.stroke()
    const lx = ch.pts[ch.pts.length - 2]
    const lz = ch.pts[ch.pts.length - 1]
    const rPx = ch.radiusM * cam.zoom
    ctx.beginPath()
    ctx.arc(toSX(lx), toSY(lz), Math.max(rPx, 3), 0, Math.PI * 2)
    ctx.stroke()
  }

  // 🜨 WAVE 8050 (T5): rect del Glyph Stamper — el operador ve el área
  // del texto (ancho real del bitmap × alto scaleM) + el canal destino.
  const gl = gesturePreview.glyph
  if (gl) {
    const bmp = rasterizeText(gl.text)
    const { widthM } = glyphRectMeters(bmp, gl.scaleM)
    const cx = toSX(gl.x)
    const cy = toSY(gl.z)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((gl.rotDeg * Math.PI) / 180)
    const w = widthM * cam.zoom
    const h = gl.scaleM * cam.zoom
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    // Retícula 5×7: las filas de la fuente — la unidad de legibilidad
    ctx.setLineDash([2, 4])
    ctx.strokeStyle = 'rgba(123, 92, 255, 0.4)'
    const cellPx = h / GLYPH_ROWS
    ctx.beginPath()
    for (let r = 1; r < GLYPH_ROWS; r++) {
      ctx.moveTo(-w / 2, -h / 2 + r * cellPx)
      ctx.lineTo(w / 2, -h / 2 + r * cellPx)
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = COLOR_GESTURE
    ctx.fillStyle = 'rgba(230, 225, 255, 0.85)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(
      `"${gl.text}" · ${gl.channel.toUpperCase()}`,
      0, -h / 2 - 6,
    )
    ctx.fillStyle = COLOR_GESTURE_FILL
    ctx.restore()
  }

  // 🜨 WAVE 8150-F4: POLYGON — polilínea committed + banda elástica al
  // cursor + cierre punteado al origen (≥3 vértices) + puntos de vértice.
  const pg = gesturePreview.polygon
  if (pg && pg.pts.length >= 2) {
    const pts = pg.pts
    ctx.beginPath()
    ctx.moveTo(toSX(pts[0]), toSY(pts[1]))
    for (let i = 2; i < pts.length; i += 2) {
      ctx.lineTo(toSX(pts[i]), toSY(pts[i + 1]))
    }
    ctx.stroke()
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    const lx = toSX(pts[pts.length - 2])
    const ly = toSY(pts[pts.length - 1])
    ctx.moveTo(lx, ly)
    ctx.lineTo(toSX(pg.hoverX), toSY(pg.hoverZ))
    if (pts.length >= 6) {
      ctx.lineTo(toSX(pts[0]), toSY(pts[1]))
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = COLOR_GESTURE
    for (let i = 0; i < pts.length; i += 2) {
      ctx.beginPath()
      ctx.arc(toSX(pts[i]), toSY(pts[i + 1]), 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = COLOR_GESTURE_FILL
  }

  // 🜨 WAVE 8150-F4: LINE — banda translúcida (la cobertura real del
  // segmento) + eje brillante. El operador ve la anchura honesta.
  const ln = gesturePreview.line
  if (ln) {
    const ax = toSX(ln.ax)
    const ay = toSY(ln.az)
    const bx = toSX(ln.bx)
    const by = toSY(ln.bz)
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(ln.halfWidthM * cam.zoom * 2, 2)
    ctx.strokeStyle = 'rgba(123, 92, 255, 0.18)'
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.lineWidth = 1.2
    ctx.strokeStyle = COLOR_GESTURE
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.lineCap = 'butt'
  }

  // 🜨 WAVE 8182: WAVEFRONT — emisor anclado (crosshair + núcleo) y,
  // si el drag fijó dirección, flecha del frente + etiqueta de grados.
  const wv = gesturePreview.wave
  if (wv) {
    const ex = toSX(wv.x)
    const ey = toSY(wv.z)
    // crosshair del emisor
    ctx.strokeStyle = 'rgba(92, 225, 255, 0.95)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(ex, ey, 6, 0, Math.PI * 2)
    ctx.moveTo(ex - 10, ey)
    ctx.lineTo(ex + 10, ey)
    ctx.moveTo(ex, ey - 10)
    ctx.lineTo(ex, ey + 10)
    ctx.stroke()
    if (wv.hasDir) {
      const rad = (wv.dirDeg * Math.PI) / 180
      const ax = Math.cos(rad)
      const ay = Math.sin(rad)
      const LEN = 34
      const tx = ex + ax * LEN
      const ty = ey + ay * LEN
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(tx, ty)
      ctx.moveTo(tx - ax * 7 - ay * 5, ty - ay * 7 + ax * 5)
      ctx.lineTo(tx, ty)
      ctx.lineTo(tx - ax * 7 + ay * 5, ty - ay * 7 - ax * 5)
      ctx.stroke()
      ctx.fillStyle = 'rgba(140, 235, 255, 0.8)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(wv.dirDeg)}°`, tx + ax * 14, ty + ay * 14 + 3)
      ctx.fillStyle = COLOR_GESTURE_FILL
    }
    ctx.strokeStyle = COLOR_GESTURE
    ctx.lineWidth = 1.2
  }

  if (!atlas) return

  // ── 🜨 WAVE 8150-F4: GHOSTING DE CAPA — halo + anillo brillante del
  // color del kind sobre los nodos dominados por el gesto seleccionado.
  // Bajo los anillos de selección: el ghost informa, no manda.
  // 🜨 WAVE 8171 (M1): los anillos orbitan FUERA del glifo a cualquier
  // zoom — mismo radio base escalado que NodeLayer.
  const gr = nodeGlyphRadiusPx(t.cam.zoom)
  if (ghostIds && ghostIds.size > 0 && ghostRGB) {
    const [r0, g0, b0] = ghostRGB
    ctx.strokeStyle = `rgba(${r0}, ${g0}, ${b0}, 0.22)`
    ctx.lineWidth = 3
    drawNodeRings(ctx, t, atlas, ghostIds, gr + 7, false)
    ctx.strokeStyle = `rgba(${r0}, ${g0}, ${b0}, 0.9)`
    ctx.lineWidth = 1.4
    drawNodeRings(ctx, t, atlas, ghostIds, gr + 5.5, false)
  }

  // ── Anillos de estado sobre los nodos ─────────────────────────────────
  ctx.lineWidth = 1.3
  ctx.strokeStyle = COLOR_PREVIEW
  drawNodeRings(ctx, t, atlas, preview, gr + 3, true)

  ctx.strokeStyle = COLOR_SELECTED
  ctx.lineWidth = 1.6
  drawNodeRings(ctx, t, atlas, selection, gr + 3.5, false)

  ctx.strokeStyle = COLOR_HOVER
  ctx.lineWidth = 1.8
  drawNodeRings(ctx, t, atlas, hover, gr + 4.5, false)
}
