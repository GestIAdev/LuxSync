/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 POLYGON TOOL — WAVE 8150-F4: SELECCIÓN POR VÉRTICES
 *
 * Precisión quirúrgica donde el lasso es demasiado orgánico: cada CLIC
 * añade un vértice (en METROS del mundo); la banda elástica muestra el
 * borde siguiente; doble clic o Enter cierra el polígono y commitea la
 * selección vía `nodesInWorldPolygon` (ray-casting ya existente).
 * Esc cancela; Shift en el primer clic = selección aditiva.
 *
 * El polígono en curso vive en `gesturePreview.polygon` (mutable — lo
 * dibuja GestureLayer dentro del RAF, zero React durante el gesto).
 *
 * @module HephaestusView/asteria/tools/PolygonTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nodesInWorldPolygon } from './selection'

/** Dos clics a menos de esto cuentan como el mismo vértice (el segundo
 *  pointerdown del doble clic NO duplica vértice — dedupe por epsilon). */
const VERTEX_DEDUPE_M = 0.06
/** Polígono mínimo cerrable: 3 vértices = 6 floats en el array plano. */
const MIN_VERTICES_FLAT = 6

/** Vértices committed del polígono en curso — array plano [x,z,…]. */
let _pts: number[] = []
let _additive = false

function toWorld(sx: number, sy: number, ctx: AsteriaToolContext): { x: number; z: number } {
  const t = ctx.transform()
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

function livePreview(ctx: AsteriaToolContext): void {
  if (_pts.length >= MIN_VERTICES_FLAT) {
    ctx.previewSelection(nodesInWorldPolygon(ctx.atlas(), _pts, new Set<string>()))
  }
}

function commit(ctx: AsteriaToolContext): void {
  if (_pts.length >= MIN_VERTICES_FLAT) {
    const found = nodesInWorldPolygon(ctx.atlas(), _pts, new Set<string>())
    ctx.setSelection(found, _additive)
  }
  _pts = []
  clearGesturePreview()
}

export const PolygonTool: AsteriaTool = {
  id: 'polygon',
  label: 'Polygon',
  icon: '⬠',
  cursor: 'crosshair',
  hotkey: 'p',
  // Banda elástica entre clics: necesita moves sin botón, y el
  // hover-pick quedaría poking fixtures bajo el cursor → suprimido.
  trackIdlePointer: true,

  onPointerDown(sx, sy, e, ctx) {
    const w = toWorld(sx, sy, ctx)
    if (_pts.length === 0) {
      _additive = e.shiftKey === true
      gesturePreview.polygon = { pts: _pts, hoverX: w.x, hoverZ: w.z }
    }
    // Dedupe del segundo pointerdown del doble clic (misma posición)
    const n = _pts.length
    if (n >= 2) {
      const dx = w.x - _pts[n - 2]
      const dz = w.z - _pts[n - 1]
      if (dx * dx + dz * dz < VERTEX_DEDUPE_M * VERTEX_DEDUPE_M) return
    }
    _pts.push(w.x, w.z)
    const p = gesturePreview.polygon
    if (p) {
      p.hoverX = w.x
      p.hoverZ = w.z
    }
    livePreview(ctx)
  },

  onPointerMove(sx, sy, _e, ctx) {
    const p = gesturePreview.polygon
    if (!p || _pts.length === 0) return
    const w = toWorld(sx, sy, ctx)
    p.hoverX = w.x
    p.hoverZ = w.z
    livePreview(ctx)
  },

  onDoubleClick(_sx, _sy, _e, ctx) {
    // Los dos pointerdown previos ya deduplicaron su vértice fantasma
    commit(ctx)
  },

  onKeyDown(e, ctx) {
    if (_pts.length === 0) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(ctx)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      _pts = []
      clearGesturePreview()
      ctx.previewSelection([])
    }
  },

  cancel() {
    _pts = []
    clearGesturePreview()
  },
}
