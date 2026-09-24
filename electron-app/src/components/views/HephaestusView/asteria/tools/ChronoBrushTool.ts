/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 CHRONO-BRUSH — WAVE 8040B · T3 (`✎`): PINTAS EL ORDEN DEL ENCENDIDO
 *
 * La herramienta insignia (blueprint §5.3): el operador arrastra sobre el
 * lienzo y Asteria GRABA el trazo con sus timestamps reales. Al soltar se
 * commitea un gesto `kind:'chrono'` al Gesture Stack — el fieldEngine
 * asigna a cada nodo a ≤ radiusM el `tMs` del punto más cercano: el tempo
 * del arrastre ES la coreografía.
 *
 *   arrastre lento → retardos separados → chase lento
 *   arrastre rápido → retardos juntos   → casi simultáneo
 *
 * MODOS (flag del gesto — el engine resuelve la matemática):
 *   - captureRealTime=true  (default): tempo humano capturado.
 *   - captureRealTime=false (Alt al iniciar): arcLength — el engine
 *     reparametriza a velocidad constante ("el dibujo manda, el tempo no").
 *
 * El gesto es NO destructivo: escala/inversión/suavizado/quantize-a-beat
 * se editan después en el inspector (updateGesture), nunca horneados aquí.
 *
 * Máscara: la selección committed si existe; si no, todo el atlas —
 * pintar sin selección significa "todo el rig".
 *
 * @module HephaestusView/asteria/tools/ChronoBrushTool
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { AsteriaTool, AsteriaToolContext } from './ToolRegistry'
import { gesturePreview, clearGesturePreview } from './ToolRegistry'
import type { ChronoGesture } from '../model/AsteriaProject'

/** Radio por defecto del pincel en metros (editable luego en el inspector). */
export const CHRONO_DEFAULT_RADIUS_M = 0.8
/** Paso mínimo entre muestras del trazo (m) — evita densidad inútil. */
const MIN_SAMPLE_DIST_M = 0.03

export interface ChronoBrushDeps {
  /** Reloj inyectable para tests (default performance.now). */
  now?: () => number
  /** Radio del pincel en metros. */
  radiusM?: number
}

let _strokeSeq = 0

/**
 * Factoría de la herramienta — deps inyectables para test (reloj falso).
 * El registro usa `ChronoBrushTool` (instancia por defecto).
 */
export function createChronoBrushTool(deps: ChronoBrushDeps = {}): AsteriaTool {
  const now = deps.now ?? (() => performance.now())
  const radiusM = deps.radiusM ?? CHRONO_DEFAULT_RADIUS_M

  let dragging = false
  let arcLength = false
  let t0 = 0
  let stroke: { x: number; z: number; tMs: number }[] = []
  let previewPts: number[] = []

  const toWorld = (ctx: AsteriaToolContext, sx: number, sy: number) => {
    const t = ctx.transform()
    return {
      x: (sx - t.canvasW / 2) / t.cam.zoom + t.cam.panX,
      z: (sy - t.canvasH / 2) / t.cam.zoom + t.cam.panY,
    }
  }

  const reset = () => {
    dragging = false
    stroke = []
    previewPts = []
    clearGesturePreview()
  }

  return {
    id: 'chrono',
    label: 'Chrono-Brush',
    icon: '✎',
    cursor: 'crosshair',
    hotkey: 'c',

    onPointerDown(sx, sy, e, ctx) {
      dragging = true
      arcLength = e.altKey === true // Alt = arcLength (tempo aplanado)
      t0 = now()
      const p = toWorld(ctx, sx, sy)
      stroke = [{ x: p.x, z: p.z, tMs: 0 }]
      previewPts = [p.x, p.z]
      gesturePreview.chrono = { pts: previewPts, radiusM }
    },

    onPointerMove(sx, sy, _e, ctx) {
      if (!dragging) return
      const p = toWorld(ctx, sx, sy)
      const last = stroke[stroke.length - 1]
      const dx = p.x - last.x
      const dz = p.z - last.z
      if (dx * dx + dz * dz < MIN_SAMPLE_DIST_M * MIN_SAMPLE_DIST_M) return
      stroke.push({ x: p.x, z: p.z, tMs: Math.max(0, now() - t0) })
      previewPts.push(p.x, p.z)
    },

    onPointerUp(sx, sy, _e, ctx) {
      if (!dragging) return
      const p = toWorld(ctx, sx, sy)
      const last = stroke[stroke.length - 1]
      const dx = p.x - last.x
      const dz = p.z - last.z
      if (dx * dx + dz * dz >= MIN_SAMPLE_DIST_M * MIN_SAMPLE_DIST_M) {
        stroke.push({ x: p.x, z: p.z, tMs: Math.max(0, now() - t0) })
      }

      // Commit solo si el trazo tiene recorrido — un clic sin arrastre no
      // crea gesto (un punto solo no enciende nada por tempo).
      if (stroke.length >= 2) {
        const sel = ctx.selection()
        const atlas = ctx.atlas()
        const maskIds =
          sel.size > 0
            ? [...sel]
            : (atlas?.entries.map((e) => e.nodeId) ?? [])
        const gesture: ChronoGesture = {
          kind: 'chrono',
          id: `chrono-${++_strokeSeq}`,
          mask: { nodeIds: maskIds },
          op: 'replace',
          stroke,
          captureRealTime: !arcLength,
          radiusM,
          // 🜨 8196 — Phantom Gain: la capa nace dueña de su amplitud.
          gain: 1,
        }
        ctx.addGesture(gesture)
      }
      reset()
    },

    cancel() {
      reset()
    },
  }
}

/** Instancia por defecto registrada en el toolbox. */
export const ChronoBrushTool = createChronoBrushTool()
