/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 WAVEFRONT TOOL — T4 (WAVE 8182): EL EMISOR DE ONDA
 *
 * La herramienta huérfana del blueprint §7 — el WaveGesture llevaba
 * implementado en el motor desde el principio pero nadie podía crearlo.
 *
 *   CLICK        → emisor puntual: shape 'point', frente radial que
 *                  expande desde el punto clicado (delay = dist/v).
 *   DRAG ≥ 0.25m → frente dirigido: shape 'line', el arrastre fija
 *                  dirDeg — el plano de onda barre en esa dirección.
 *
 * Máscara = selección actual (si hay) o TODO el rig — mismo contrato
 * que GlyphTool: la herramienta solo coloca la geometría, el operador
 * decide el alcance con la selección libre.
 *
 * speedMps nace en 10 m/s — se edita después en el Gesture Inspector
 * (junto a falloffM, shape y el resto de parámetros del gesto).
 *
 * El preview (emisor + flecha de dirección) vive en `gesturePreview.wave`
 * — GestureLayer lo dibuja dentro del RAF sin tocar React.
 *
 * @module HephaestusView/asteria/tools/WavefrontTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import type { WaveGesture } from '../model/AsteriaProject'

/** Velocidad inicial del frente — editable en el inspector. */
export const WAVEFRONT_DEFAULT_SPEED_MPS = 10
/** Drag mínimo (m) para que el gesto sea 'line' en vez de 'point'. */
const DIR_MIN_M = 0.25

let _waveSeq = 0
let _dragging = false
let _anchorX = 0
let _anchorZ = 0
let _hasDir = false
let _dirDeg = 0

const toWorld = (ctx: AsteriaToolContext, sx: number, sy: number) => {
  const t = ctx.transform()
  return {
    x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
    z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
  }
}

/** Máscara del commit: selección viva → si vacía, todo el atlas. */
function commitMask(ctx: AsteriaToolContext): string[] {
  const sel = ctx.selection()
  if (sel.size > 0) return [...sel]
  const atlas = ctx.atlas()
  return atlas ? atlas.entries.map((en) => en.nodeId) : []
}

export const WavefrontTool: AsteriaTool = {
  id: 'wavefront',
  label: 'Wavefront',
  icon: '〰',
  cursor: 'crosshair',
  hotkey: 'w',

  onPointerDown(sx, sy, _e, ctx) {
    _dragging = true
    _hasDir = false
    _dirDeg = 0
    const p = toWorld(ctx, sx, sy)
    _anchorX = p.x
    _anchorZ = p.z
    gesturePreview.wave = { x: p.x, z: p.z, dirDeg: 0, hasDir: false }
    // Ghost de la máscara que recibirá el frente — feedback inmediato
    ctx.previewSelection(commitMask(ctx))
  },

  onPointerMove(sx, sy, _e, ctx) {
    if (!_dragging || !gesturePreview.wave) return
    const p = toWorld(ctx, sx, sy)
    const dx = p.x - _anchorX
    const dz = p.z - _anchorZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist >= DIR_MIN_M) {
      _hasDir = true
      _dirDeg = (Math.atan2(dz, dx) * 180) / Math.PI
    } else {
      _hasDir = false
    }
    gesturePreview.wave = {
      x: _anchorX, z: _anchorZ, dirDeg: _dirDeg, hasDir: _hasDir,
    }
  },

  onPointerUp(_sx, _sy, _e, ctx) {
    if (!_dragging) return
    _dragging = false
    const maskIds = commitMask(ctx)
    if (maskIds.length === 0) { clearGesturePreview(); return }

    const gesture: WaveGesture = {
      kind: 'wave',
      id: `wave-${++_waveSeq}`,
      mask: { nodeIds: maskIds },
      op: 'replace',
      emitter: { x: _anchorX, z: _anchorZ },
      shape: _hasDir ? 'line' : 'point',
      dirDeg: _hasDir ? _dirDeg : undefined,
      speedMps: WAVEFRONT_DEFAULT_SPEED_MPS,
    }
    ctx.addGesture(gesture)
    clearGesturePreview()
  },

  cancel() {
    _dragging = false
    clearGesturePreview()
  },
}
