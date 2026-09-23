/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 NOISE TOOL — T8 (WAVE 8182): EL DESORDEN ORGÁNICO
 *
 * Herramienta huérfana del blueprint §7 — el NoiseGesture ya muestrea
 * Perlin sobre la posición de cada nodo en el fieldEngine.
 *
 * Mismo gesto en canvas que Slicer: rectángulo → máscara de nodos;
 * click → selección viva → todo el rig. El ruido rompe la simetría
 * perfecta del chase — delay orgánico por nodo, no mecánico.
 *
 * Parámetros con defaults orgánicos (scaleM 1.5 = vórtices del tamaño
 * de un fixture, amountMs 250 = dispersión audible, 2 octavas) — todo
 * re-editable en el Gesture Inspector, incluido el seed.
 *
 * @module HephaestusView/asteria/tools/NoiseTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import { nodesInWorldRect, commitMaskIds } from './selection'
import type { NoiseGesture } from '../model/AsteriaProject'

let _noiseSeq = 0
let _dragging = false
const _found = new Set<string>()

const toWorld = (ctx: AsteriaToolContext, sx: number, sy: number) => {
  const t = ctx.transform()
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

export const NoiseTool: AsteriaTool = {
  id: 'noise',
  label: 'Noise Field',
  icon: '~',
  cursor: 'crosshair',
  hotkey: 'n',

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

    // Seed derivado del contador — determinista por gesto, distinto
    // entre gestos; el operador lo re-siembra desde el inspector.
    const seq = ++_noiseSeq
    const gesture: NoiseGesture = {
      kind: 'noise',
      id: `noise-${seq}`,
      mask: { nodeIds: maskIds },
      op: 'replace',
      seed: (seq * 7919) % 9973,
      scaleM: 1.5,
      amountMs: 250,
      octaves: 2,
    }
    ctx.addGesture(gesture)
    clearGesturePreview()
  },

  cancel() {
    _dragging = false
    clearGesturePreview()
  },
}
