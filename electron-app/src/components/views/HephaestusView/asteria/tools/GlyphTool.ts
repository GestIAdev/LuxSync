/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GLYPH TOOL — T5 (WAVE 8050) + 8160 (M3): EL TIPÓGRAFO
 *
 * El operador "escribe" sobre el escenario usando los focos como píxeles
 * (blueprint §T5). La fuente bitmap 5×7, el raster y la legibilidad viven
 * en `model/glyphRaster.ts` — la tool solo captura la geometría.
 *
 *   CON SELECCIÓN (lazo/polígono/línea…):
 *     el Bounding Box de los nodeIds seleccionados escala y centra la
 *     fuente — la máscara queda EXACTAMENTE la selección libre (un foco
 *     dentro del bbox pero fuera de la selección jamás recibe tinta).
 *     El clic solo dispara; el arrastre no mueve la geometría.
 *
 *   SIN SELECCIÓN:
 *     DOWN  → ancla el CENTRO del rect del glifo
 *     DRAG  → la distancia al ancla fija `scaleM` (alto del texto, m)
 *     máscara = todo el rig.
 *
 *   ALT al soltar → channel 'delay' (el texto BARRE el rig a 1 m/s —
 *           Vía Λ/MCC). Por defecto channel 'gain' (imagen quieta).
 *
 * El texto vive en el gesto (`g.text`) — se edita no destructivamente
 * desde el inspector del stack. Threshold/antialias igual.
 *
 * @module HephaestusView/asteria/tools/GlyphTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import type { GlyphGesture } from '../model/AsteriaProject'
import { rasterizeText, GLYPH_ROWS } from '../model/glyphRaster'

/** Texto por defecto — editable después en el inspector del gesto. */
export const GLYPH_DEFAULT_TEXT = 'LUX'
/** Alto mínimo del glifo (m) — por debajo ni la fuente 5×7 cabe. */
const MIN_SCALE_M = 0.7
/** Alto por defecto al hacer clic sin arrastrar (m). */
const CLICK_SCALE_M = 1.4
/** Umbral de "click" — menos drag que esto = click plano. */
const CLICK_DIST_M = 0.05

let _glyphSeq = 0

interface GlyphTransform {
  x: number
  z: number
  scaleM: number
}

/**
 * 🜨 WAVE 8160 (M3): bounding box de la SELECCIÓN → transform del glifo.
 * La fuente se encaja dentro: alto = scaleM (7 filas), ancho =
 * cols·scaleM/7 → scaleM = min(altoBBox, anchoBBox·7/cols).
 * Devuelve null sin selección o sin nodos posicionados en ella.
 */
function fitSelectionTransform(
  ctx: AsteriaToolContext,
  text: string,
): GlyphTransform | null {
  const sel = ctx.selection()
  if (sel.size === 0) return null
  const atlas = ctx.atlas()
  if (!atlas) return null

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  let any = false
  for (const id of sel) {
    const pos = atlas.byNodeId.get(id)?.position
    if (!pos) continue
    any = true
    if (pos.x < minX) minX = pos.x
    if (pos.x > maxX) maxX = pos.x
    if (pos.z < minZ) minZ = pos.z
    if (pos.z > maxZ) maxZ = pos.z
  }
  if (!any) return null

  const bmp = rasterizeText(text)
  const bboxW = maxX - minX
  const bboxD = maxZ - minZ
  // Alto que encaja el ancho del texto en el bbox; si el bbox es una
  // línea (d≈0) la altura la fija el ancho disponible.
  const fitByWidth = bboxW > 1e-6 ? (bboxW * GLYPH_ROWS) / bmp.cols : CLICK_SCALE_M
  const fitByDepth = bboxD > 1e-6 ? bboxD : CLICK_SCALE_M
  const scaleM = Math.max(MIN_SCALE_M, Math.min(fitByWidth, fitByDepth))
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, scaleM }
}

export function createGlyphTool(): AsteriaTool {
  let dragging = false
  let anchor = { x: 0, z: 0 }
  /** Fit por selección capturado en pointerdown (null = modo drag libre). */
  let selFit: GlyphTransform | null = null

  const toWorld = (ctx: AsteriaToolContext, sx: number, sy: number) => {
    const t = ctx.transform()
    return {
      x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
      z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
    }
  }

  return {
    id: 'glyph',
    label: 'Glyph Stamper',
    icon: 'A',
    cursor: 'crosshair',
    hotkey: 'g',

    onPointerDown(sx, sy, _e, ctx) {
      dragging = true
      anchor = toWorld(ctx, sx, sy)
      // 🜨 8160-M3: con selección libre el preview ya muestra el bbox
      // real que recibirá el texto — el operador ve el encaje exacto.
      selFit = fitSelectionTransform(ctx, GLYPH_DEFAULT_TEXT)
      const base = selFit ?? { x: anchor.x, z: anchor.z, scaleM: CLICK_SCALE_M }
      gesturePreview.glyph = {
        x: base.x, z: base.z, scaleM: base.scaleM,
        rotDeg: 0, text: GLYPH_DEFAULT_TEXT, channel: 'gain',
      }
    },

    onPointerMove(sx, sy, e, ctx) {
      if (!dragging || !gesturePreview.glyph) return
      const channel = e.altKey ? 'delay' : 'gain'
      if (selFit) {
        // Selección libre: el drag no mueve la geometría — solo el canal.
        gesturePreview.glyph = {
          x: selFit.x, z: selFit.z, scaleM: selFit.scaleM,
          rotDeg: 0, text: GLYPH_DEFAULT_TEXT, channel,
        }
        return
      }
      const p = toWorld(ctx, sx, sy)
      const scaleM = Math.max(
        MIN_SCALE_M,
        Math.hypot(p.x - anchor.x, p.z - anchor.z),
      )
      gesturePreview.glyph = {
        x: anchor.x, z: anchor.z, scaleM, rotDeg: 0,
        text: GLYPH_DEFAULT_TEXT,
        channel,
      }
    },

    onPointerUp(sx, sy, e, ctx) {
      if (!dragging) return
      dragging = false

      const sel = ctx.selection()
      const atlas = ctx.atlas()
      const maskIds =
        sel.size > 0 ? [...sel] : (atlas?.entries.map((en) => en.nodeId) ?? [])
      if (maskIds.length === 0) { clearGesturePreview(); return }

      // 🜨 8160-M3: transform = bbox de la selección (o geometría del
      // drag cuando no hay selección). La máscara NUNCA se re-deriva —
      // es exactamente la selección del operador.
      let transform: { x: number; z: number; scaleM: number; rotDeg: number }
      if (selFit) {
        transform = { ...selFit, rotDeg: 0 }
      } else {
        const p = toWorld(ctx, sx, sy)
        const dist = Math.hypot(p.x - anchor.x, p.z - anchor.z)
        const scaleM =
          dist < CLICK_DIST_M ? CLICK_SCALE_M : Math.max(MIN_SCALE_M, dist)
        transform = { x: anchor.x, z: anchor.z, scaleM, rotDeg: 0 }
      }

      const gesture: GlyphGesture = {
        kind: 'glyph',
        id: `glyph-${++_glyphSeq}`,
        mask: { nodeIds: maskIds },
        op: 'replace',
        text: GLYPH_DEFAULT_TEXT,
        transform,
        channel: e.altKey ? 'delay' : 'gain',
        antialias: true,
        // 🜨 8196 — Phantom Gain: multiplicador de capa explícito.
        gain: 1,
      }
      ctx.addGesture(gesture)
      selFit = null
      clearGesturePreview()
    },

    cancel() {
      dragging = false
      selFit = null
      clearGesturePreview()
    },
  }
}

/** Instancia por defecto registrada en el toolbox. */
export const GlyphTool = createGlyphTool()
