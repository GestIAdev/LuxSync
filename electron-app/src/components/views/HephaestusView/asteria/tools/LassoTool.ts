/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 LASSO TOOL — WAVE 8020: SELECCIÓN A MANO ALZADA
 *
 * Trazo libre en METROS del mundo: al soltar, los nodos cuyo centro cae
 * dentro del polígono quedan seleccionados (Shift = añadir).
 * Los puntos se muestrean con distancia mínima en metros para no inflar
 * el polígono (ni el ray-casting) con sub-píxeles.
 *
 * @module HephaestusView/asteria/tools/LassoTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nodesInWorldPolygon } from './selection'

/** Distancia mínima entre puntos del lasso, en metros del mundo. */
const MIN_POINT_DIST_M = 0.08

let _drawing = false
let _additive = false

function toWorld(sx: number, sy: number, ctx: AsteriaToolContext): { x: number; z: number } {
  const t = ctx.transform()
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

export const LassoTool: AsteriaTool = {
  id: 'lasso',
  label: 'Lasso',
  icon: '〰',
  cursor: 'crosshair',
  hotkey: 'l',

  onPointerDown(sx, sy, e, ctx) {
    _drawing = true
    _additive = e.shiftKey === true
    const w = toWorld(sx, sy, ctx)
    gesturePreview.lasso = [w.x, w.z]
  },

  onPointerMove(sx, sy, _e, ctx) {
    if (!_drawing || !gesturePreview.lasso) return
    const w = toWorld(sx, sy, ctx)
    const pts = gesturePreview.lasso
    const lastX = pts[pts.length - 2]
    const lastZ = pts[pts.length - 1]
    const dx = w.x - lastX
    const dz = w.z - lastZ
    if (dx * dx + dz * dz >= MIN_POINT_DIST_M * MIN_POINT_DIST_M) {
      pts.push(w.x, w.z)
      // Preview en vivo del contenido del lazo
      ctx.previewSelection(nodesInWorldPolygon(ctx.atlas(), pts, new Set<string>()))
    }
  },

  onPointerUp(_sx, _sy, _e, ctx) {
    if (_drawing && gesturePreview.lasso) {
      const found = nodesInWorldPolygon(ctx.atlas(), gesturePreview.lasso, new Set<string>())
      ctx.setSelection(found, _additive)
    }
    _drawing = false
    clearGesturePreview()
  },

  cancel() {
    _drawing = false
    clearGesturePreview()
  },
}
