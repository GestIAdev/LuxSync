/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GLYPH TOOL — T5 (WAVE 8050): EL TIPÓGRAFO
 *
 * El operador "escribe" sobre el escenario usando los focos como píxeles
 * (blueprint §T5). La fuente bitmap 5×7, el raster y la legibilidad viven
 * en `model/glyphRaster.ts` — la tool solo captura el rect del mundo.
 *
 *   DOWN  → ancla el CENTRO del rect del glifo
 *   DRAG  → la distancia al ancla fija `scaleM` (alto del texto, m)
 *   UP    → commit `kind:'glyph'` — máscara = selección committed,
 *           o todo el rig si no hay selección
 *
 *   ALT al soltar → channel 'delay' (el texto BARRE el rig a 1 m/s —
 *           Vía Λ). Por defecto channel 'gain' (imagen quieta — Vía B).
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

/** Texto por defecto — editable después en el inspector del gesto. */
export const GLYPH_DEFAULT_TEXT = 'LUX'
/** Alto mínimo del glifo (m) — por debajo ni la fuente 5×7 cabe. */
const MIN_SCALE_M = 0.7
/** Alto por defecto al hacer clic sin arrastrar (m). */
const CLICK_SCALE_M = 1.4
/** Umbral de "click" — menos drag que esto = click plano. */
const CLICK_DIST_M = 0.05

let _glyphSeq = 0

export function createGlyphTool(): AsteriaTool {
  let dragging = false
  let anchor = { x: 0, z: 0 }

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
      gesturePreview.glyph = {
        x: anchor.x, z: anchor.z, scaleM: CLICK_SCALE_M,
        rotDeg: 0, text: GLYPH_DEFAULT_TEXT, channel: 'gain',
      }
    },

    onPointerMove(sx, sy, e, ctx) {
      if (!dragging || !gesturePreview.glyph) return
      const p = toWorld(ctx, sx, sy)
      const scaleM = Math.max(
        MIN_SCALE_M,
        Math.hypot(p.x - anchor.x, p.z - anchor.z),
      )
      gesturePreview.glyph = {
        x: anchor.x, z: anchor.z, scaleM, rotDeg: 0,
        text: GLYPH_DEFAULT_TEXT,
        channel: e.altKey ? 'delay' : 'gain',
      }
    },

    onPointerUp(sx, sy, e, ctx) {
      if (!dragging) return
      const p = toWorld(ctx, sx, sy)
      const dist = Math.hypot(p.x - anchor.x, p.z - anchor.z)
      const scaleM =
        dist < CLICK_DIST_M ? CLICK_SCALE_M : Math.max(MIN_SCALE_M, dist)

      const sel = ctx.selection()
      const atlas = ctx.atlas()
      const maskIds =
        sel.size > 0 ? [...sel] : (atlas?.entries.map((en) => en.nodeId) ?? [])
      if (maskIds.length === 0) { dragging = false; return }

      const gesture: GlyphGesture = {
        kind: 'glyph',
        id: `glyph-${++_glyphSeq}`,
        mask: { nodeIds: maskIds },
        op: 'replace',
        text: GLYPH_DEFAULT_TEXT,
        transform: { x: anchor.x, z: anchor.z, scaleM, rotDeg: 0 },
        channel: e.altKey ? 'delay' : 'gain',
        antialias: true,
      }
      ctx.addGesture(gesture)
      dragging = false
      clearGesturePreview()
    },

    cancel() {
      dragging = false
      clearGesturePreview()
    },
  }
}

/** Instancia por defecto registrada en el toolbox. */
export const GlyphTool = createGlyphTool()
