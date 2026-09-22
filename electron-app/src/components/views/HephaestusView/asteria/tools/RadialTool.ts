/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 RADIAL TOOL — WAVE 8020: SELECCIÓN POR RADIO EXPANSIVO
 *
 * Clic fija el centro del mundo; el drag expande un radio EN METROS —
 * los nodos dentro del círculo entran a la selección EN VIVO mientras el
 * radio crece o se encoge. Al soltar, la selección queda committed
 * (Shift = añadir a la existente).
 *
 * La forma más rápida de agarrar "ese círculo de pars" sin precisión
 * quirúrgica — el gesto natural del operador sobre un rig simétrico.
 *
 * @module HephaestusView/asteria/tools/RadialTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nodesInWorldRadius } from './selection'

let _dragging = false
let _additive = false

export const RadialTool: AsteriaTool = {
  id: 'radial',
  label: 'Radial',
  icon: '◎',
  cursor: 'cell',
  hotkey: 'r',

  onPointerDown(sx, sy, e, ctx) {
    _dragging = true
    _additive = e.shiftKey === true
    const t = ctx.transform()
    const cx = (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX
    const cz = (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY
    gesturePreview.radial = { cx, cz, r: 0 }

    // Selección inmediata del punto de clic (radio 0 = pick directo)
    ctx.previewSelection(nodesInWorldRadius(ctx.atlas(), cx, cz, 0.05, new Set<string>()))
  },

  onPointerMove(sx, sy, _e, ctx) {
    const g = gesturePreview.radial
    if (!_dragging || !g) return
    const t = ctx.transform()
    const wx = (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX
    const wz = (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY
    const dx = wx - g.cx
    const dz = wz - g.cz
    g.r = Math.sqrt(dx * dx + dz * dz)
    ctx.previewSelection(nodesInWorldRadius(ctx.atlas(), g.cx, g.cz, g.r, new Set<string>()))
  },

  onPointerUp(_sx, _sy, _e, ctx) {
    const g = gesturePreview.radial
    if (_dragging && g) {
      const found = nodesInWorldRadius(ctx.atlas(), g.cx, g.cz, g.r, new Set<string>())
      ctx.setSelection(found, _additive)
    }
    _dragging = false
    clearGesturePreview()
  },

  cancel() {
    _dragging = false
    clearGesturePreview()
  },
}
