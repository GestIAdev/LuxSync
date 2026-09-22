/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 SELECT TOOL — WAVE 8020: CLIC + MARQUEE RECTANGULAR
 *
 * - Clic sobre un nodo: lo selecciona (Shift = añadir a la selección).
 * - Clic sobre vacío + drag: marquee rectangular clásico — selecciona los
 *   nodos cuyo centro cae dentro del rectángulo en METROS del mundo.
 * - El marquee se dibuja vía gesturePreview.marquee (GestureLayer).
 *
 * @module HephaestusView/asteria/tools/SelectTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nearestNodeToScreen, nodesInWorldRect } from './selection'

/** Umbral de arrastre en px — debajo es clic, encima es marquee. */
const DRAG_THRESHOLD_PX = 4
/** Radio de pick en px de pantalla. */
const PICK_RADIUS_PX = 10

let _startX = 0
let _startY = 0
let _marqueeActive = false
let _additive = false
let _hitOnDown: string | null = null

export const SelectTool: AsteriaTool = {
  id: 'select',
  label: 'Select',
  icon: '⬚',
  cursor: 'default',
  hotkey: 'v',

  onPointerDown(sx, sy, e, ctx) {
    _startX = sx
    _startY = sy
    _marqueeActive = false
    _additive = e.shiftKey === true
    _hitOnDown = nearestNodeToScreen(ctx.atlas(), ctx.transform(), sx, sy, PICK_RADIUS_PX)
  },

  onPointerMove(sx, sy, _e, ctx) {
    const dx = sx - _startX
    const dy = sy - _startY
    if (!_marqueeActive && dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      return
    }
    _marqueeActive = true

    // Esquinas del mundo — el rect vive en metros (estable bajo la cámara)
    const t = ctx.transform()
    const a = {
      x: (_startX - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
      z: (_startY - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
    }
    const b = {
      x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
      z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
    }
    gesturePreview.marquee = {
      x0: Math.min(a.x, b.x),
      z0: Math.min(a.z, b.z),
      x1: Math.max(a.x, b.x),
      z1: Math.max(a.z, b.z),
    }

    // Preview en vivo: qué caerá dentro del rect
    const found = nodesInWorldRect(
      ctx.atlas(),
      gesturePreview.marquee.x0, gesturePreview.marquee.z0,
      gesturePreview.marquee.x1, gesturePreview.marquee.z1,
      new Set<string>(),
    )
    ctx.previewSelection(found)
  },

  onPointerUp(_sx, _sy, _e, ctx) {
    if (_marqueeActive && gesturePreview.marquee) {
      const m = gesturePreview.marquee
      const found = nodesInWorldRect(ctx.atlas(), m.x0, m.z0, m.x1, m.z1, new Set<string>())
      ctx.setSelection(found, _additive)
    } else if (_hitOnDown) {
      ctx.setSelection([_hitOnDown], _additive)
    } else if (!_additive) {
      // Clic en vacío sin shift → limpia selección
      ctx.setSelection([], false)
    }
    clearGesturePreview()
    _marqueeActive = false
    _hitOnDown = null
  },

  cancel() {
    clearGesturePreview()
    _marqueeActive = false
    _hitOnDown = null
  },
}
