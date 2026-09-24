/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 SLICER TOOL — T6 (WAVE 8182): LA MANDOLINA DEL RIG
 *
 * Herramienta huérfana del blueprint §7 — el SliceGesture ya evalúa en
 * el fieldEngine (buckets por eje, simetrías, shuffle) pero no tenía UI.
 *
 * Su gesto en el canvas es analítico, no pictórico: el operador dibuja
 * un RECTÁNGULO de selección; al soltar, los nodos dentro del rect se
 * convierten en la máscara del gesto. Click sin arrastre → selección
 * viva → todo el rig (fallback de `commitMaskIds`).
 *
 * Los parámetros (axis, buckets, spanMs, symmetry, shuffleSeed) nacen
 * con defaults sanos y se editan en el Gesture Inspector — donde el
 * operador afina el rebanado con preview live.
 *
 * @module HephaestusView/asteria/tools/SlicerTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nodesInWorldRect, commitMaskIds } from './selection'
import type { SliceGesture } from '../model/AsteriaProject'

let _sliceSeq = 0
let _dragging = false
const _found = new Set<string>()

const toWorld = (ctx: AsteriaToolContext, sx: number, sy: number) => {
  const t = ctx.transform()
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

export const SlicerTool: AsteriaTool = {
  id: 'slicer',
  label: 'Slicer',
  icon: '⋮',
  cursor: 'crosshair',
  hotkey: 's',

  onPointerDown(sx, sy, _e, ctx) {
    _dragging = true
    const p = toWorld(ctx, sx, sy)
    gesturePreview.marquee = { x0: p.x, z0: p.z, x1: p.x, z1: p.z }
    ctx.previewSelection([])
  },

  onPointerMove(sx, sy, _e, ctx) {
    const m = gesturePreview.marquee
    if (!_dragging || !m) return
    const p = toWorld(ctx, sx, sy)
    m.x1 = p.x
    m.z1 = p.z
    _found.clear()
    nodesInWorldRect(
      ctx.atlas(),
      Math.min(m.x0, m.x1), Math.min(m.z0, m.z1),
      Math.max(m.x0, m.x1), Math.max(m.z0, m.z1),
      _found,
    )
    ctx.previewSelection(_found)
  },

  onPointerUp(_sx, _sy, _e, ctx) {
    if (!_dragging) return
    _dragging = false
    const m = gesturePreview.marquee
    _found.clear()
    if (m) {
      nodesInWorldRect(
        ctx.atlas(),
        Math.min(m.x0, m.x1), Math.min(m.z0, m.z1),
        Math.max(m.x0, m.x1), Math.max(m.z0, m.z1),
        _found,
      )
    }
    const maskIds = commitMaskIds(ctx, _found)
    if (maskIds.length === 0) { clearGesturePreview(); return }

    const gesture: SliceGesture = {
      kind: 'slice',
      id: `slice-${++_sliceSeq}`,
      mask: { nodeIds: maskIds },
      op: 'replace',
      axis: 'x',
      buckets: 4,
      spanMs: 500,
      symmetry: 'linear',
      // 🜨 8196 — Phantom Gain: la capa nace dueña de su amplitud (el
      // inspector muestra 100% — el gesto lo declara explícitamente).
      gain: 1,
    }
    ctx.addGesture(gesture)
    clearGesturePreview()
  },

  cancel() {
    _dragging = false
    clearGesturePreview()
  },
}
