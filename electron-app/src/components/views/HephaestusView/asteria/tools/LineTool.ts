/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 LINE TOOL — WAVE 8150-F4: SELECCIÓN POR SEGMENTO
 *
 * Arrastrar dibuja un segmento en METROS del mundo: los nodos a menos de
 * `halfWidthM` de la línea entran a la selección EN VIVO mientras el
 * trazo crece. Al soltar, la selección queda committed
 * (Shift = añadir a la existente).
 *
 * El gesto del "slicer" humano: una fila de pars, una diagonal del
 * grid — un solo trazo los recoge todos sin la caja del marquee.
 *
 * @module HephaestusView/asteria/tools/LineTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nodesNearWorldSegment } from './selection'

/**
 * Media anchura de la banda de selección (m). 0.5m ≈ el paso típico
 * entre celdas de un rig medio — suficiente para recoger la fila sin
 * enganchar la fila vecina.
 */
const LINE_HALF_WIDTH_M = 0.5

let _dragging = false
let _additive = false

function toWorld(sx: number, sy: number, ctx: AsteriaToolContext): { x: number; z: number } {
  const t = ctx.transform()
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

export const LineTool: AsteriaTool = {
  id: 'line',
  label: 'Line',
  icon: '╱',
  cursor: 'crosshair',
  hotkey: 'b',

  onPointerDown(sx, sy, e, ctx) {
    _dragging = true
    _additive = e.shiftKey === true
    const w = toWorld(sx, sy, ctx)
    gesturePreview.line = {
      ax: w.x, az: w.z, bx: w.x, bz: w.z, halfWidthM: LINE_HALF_WIDTH_M,
    }
  },

  onPointerMove(sx, sy, _e, ctx) {
    const g = gesturePreview.line
    if (!_dragging || !g) return
    const w = toWorld(sx, sy, ctx)
    g.bx = w.x
    g.bz = w.z
    ctx.previewSelection(
      nodesNearWorldSegment(
        ctx.atlas(), g.ax, g.az, g.bx, g.bz, g.halfWidthM, new Set<string>(),
      ),
    )
  },

  onPointerUp(_sx, _sy, _e, ctx) {
    const g = gesturePreview.line
    if (_dragging && g) {
      const found = nodesNearWorldSegment(
        ctx.atlas(), g.ax, g.az, g.bx, g.bz, g.halfWidthM, new Set<string>(),
      )
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
