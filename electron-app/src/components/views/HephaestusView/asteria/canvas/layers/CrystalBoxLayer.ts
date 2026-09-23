/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 CRYSTAL BOX LAYER — WAVE 8170 (M1): LÍMITES DEL MUNDO FÍSICO + REGLAS
 *
 * El Crystal Box es el volumen físico del show (ShowFileV2.stage:
 * {width, depth, height, gridSize} en METROS, origen centrado:
 * x∈[-w/2,+w/2], z∈[-d/2,+d/2]). Esta capa lo hace visible en Asteria:
 *
 *   drawCrystalBox — sombreado del "fuera de mundo" (4 bandas alrededor
 *     del rect del box) + perímetro con acento + placa de dimensiones.
 *     Se dibuja ENTRE grid y nodos: un fixture fuera del box sigue
 *     viéndose (el operador debe saber que está mal colocado).
 *
 *   drawRulers — reglas CAD screen-fixed (top = X, left = Z) con ticks
 *     métricos adaptativos (paso ×5 como el grid), etiquetas cada
 *     ~48 px, énfasis cian en el eje 0 y violeta en los bordes del box.
 *     Se dibuja AL FINAL del pipeline — son cromo, no contenido.
 *
 * FUNCIONES PURAS: el stage llega por parámetro (el RAF lee
 * useStageStore.getState().stage — referencia estable, zero React cost).
 *
 * @module HephaestusView/asteria/canvas/layers/CrystalBoxLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import { visibleWorldRect } from '../useWorldTransform'
import type { StageDimensions } from '../../../../../../core/stage/ShowFileV2'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fallback cuando el show aún no ha cargado dimensiones — idénticas al
 * default warehouse de createEmptyShowFile (WAVE 7609): 25×12×8 m.
 */
export const FALLBACK_STAGE: StageDimensions = {
  width: 25,
  depth: 12,
  height: 8,
  gridSize: 0.25,
}

const RULER_PX = 20
const COLOR_BAND = 'rgba(9, 9, 16, 0.82)'
const COLOR_BAND_EDGE = 'rgba(123, 92, 255, 0.28)'
const COLOR_TICK_MINOR = 'rgba(160, 150, 220, 0.30)'
const COLOR_TICK_MAJOR = 'rgba(160, 150, 220, 0.65)'
const COLOR_LABEL = 'rgba(230, 235, 255, 0.55)'
const COLOR_ZERO = 'rgba(79, 216, 232, 0.95)'
const COLOR_BOX_EDGE = 'rgba(123, 92, 255, 0.85)'
const COLOR_OUTSIDE = 'rgba(2, 2, 7, 0.42)'
const COLOR_BOX_LINE = 'rgba(123, 92, 255, 0.50)'
const COLOR_BOX_LABEL = 'rgba(123, 92, 255, 0.60)'

/** Espaciado mínimo entre etiquetas de regla (px de pantalla). */
const LABEL_MIN_PX = 48
/** Subdivisión de ticks: 5 ticks por etiqueta (métrico puro). */
const TICKS_PER_LABEL = 5
/** Ticks solo si separados ≥ esto en px. */
const TICK_MIN_PX = 7

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Rect del Crystal Box proyectado a píxeles de pantalla. */
function boxScreenRect(
  t: WorldTransform, stage: StageDimensions,
): { x0: number; y0: number; x1: number; y1: number } {
  const { canvasW, canvasH, cam } = t
  return {
    x0: (-stage.width / 2 - cam.panX) * cam.zoom + canvasW / 2,
    x1: (stage.width / 2 - cam.panX) * cam.zoom + canvasW / 2,
    y0: (-stage.depth / 2 - cam.panY) * cam.zoom + canvasH / 2,
    y1: (stage.depth / 2 - cam.panY) * cam.zoom + canvasH / 2,
  }
}

/** Etiqueta métrica sin ruido de coma flotante (-12.5, -5, 0, 5…). */
const fmtM = (v: number): string => String(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(2))

// ─────────────────────────────────────────────────────────────────────────────
// CRYSTAL BOX — sombreado exterior + perímetro
// ─────────────────────────────────────────────────────────────────────────────

export function drawCrystalBox(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  stage: StageDimensions | null,
): void {
  const s = stage ?? FALLBACK_STAGE
  const { canvasW, canvasH } = t
  const b = boxScreenRect(t, s)

  // ── "Fuera de mundo": cuatro bandas oscuras alrededor del rect ──
  ctx.fillStyle = COLOR_OUTSIDE
  if (b.y0 > 0) ctx.fillRect(0, 0, canvasW, Math.min(b.y0, canvasH))
  if (b.y1 < canvasH) ctx.fillRect(0, Math.max(b.y1, 0), canvasW, canvasH - Math.max(b.y1, 0))
  const midY0 = Math.max(0, b.y0)
  const midY1 = Math.min(canvasH, b.y1)
  if (b.x0 > 0) ctx.fillRect(0, midY0, Math.min(b.x0, canvasW), midY1 - midY0)
  if (b.x1 < canvasW) ctx.fillRect(Math.max(b.x1, 0), midY0, canvasW - Math.max(b.x1, 0), midY1 - midY0)

  // ── Perímetro del box ──
  ctx.strokeStyle = COLOR_BOX_LINE
  ctx.lineWidth = 1.5
  ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)

  // Esquinas reforzadas (ticks CAD de 8 px)
  ctx.strokeStyle = COLOR_BOX_EDGE
  ctx.lineWidth = 2
  const c = 8
  ctx.beginPath()
  for (const [cx, cy, dx, dy] of [
    [b.x0, b.y0, 1, 1], [b.x1, b.y0, -1, 1],
    [b.x1, b.y1, -1, -1], [b.x0, b.y1, 1, -1],
  ] as const) {
    ctx.moveTo(cx + dx * c, cy)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx, cy + dy * c)
  }
  ctx.stroke()

  // ── Placa de dimensiones (esquina superior-izq del box) ──
  if (b.x0 > -200 && b.x0 < canvasW && b.y0 > -20 && b.y0 < canvasH - 16) {
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = COLOR_BOX_LABEL
    ctx.fillText(
      `CRYSTAL BOX ${fmtM(s.width)}×${fmtM(s.depth)}×${fmtM(s.height)}m`,
      Math.max(b.x0, 2) + 6,
      Math.max(b.y0, 12) - 4,
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULERS — reglas CAD screen-fixed (top = X, left = Z)
// ─────────────────────────────────────────────────────────────────────────────

export function drawRulers(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  stage: StageDimensions | null,
): void {
  const s = stage ?? FALLBACK_STAGE
  const { canvasW, canvasH, cam } = t
  const { minX, minZ, maxX, maxZ } = visibleWorldRect(t)
  const halfW = canvasW / 2
  const halfH = canvasH / 2

  // Paso de etiqueta adaptativo: 1m → 5m → 25m… hasta ~48 px de separación
  let labelStep = 1
  while (labelStep * cam.zoom < LABEL_MIN_PX) labelStep *= 5
  const tickStep = labelStep / TICKS_PER_LABEL
  const drawTicks = tickStep * cam.zoom >= TICK_MIN_PX

  // ── Bandas ──
  ctx.fillStyle = COLOR_BAND
  ctx.fillRect(0, 0, canvasW, RULER_PX)
  ctx.fillRect(0, 0, RULER_PX, canvasH)
  ctx.strokeStyle = COLOR_BAND_EDGE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, RULER_PX + 0.5)
  ctx.lineTo(canvasW, RULER_PX + 0.5)
  ctx.moveTo(RULER_PX + 0.5, 0)
  ctx.lineTo(RULER_PX + 0.5, canvasH)
  ctx.stroke()
  // Esquina de unión
  ctx.fillStyle = '#07070c'
  ctx.fillRect(0, 0, RULER_PX, RULER_PX)

  ctx.font = '9px monospace'
  ctx.textBaseline = 'alphabetic'

  const boxHalfW = s.width / 2
  const boxHalfD = s.depth / 2

  /**
   * Un eje de regla: ticks + etiquetas sobre el rango visible.
   * `toScreen` proyecta metros → px; `isX` decide orientación.
   */
  const drawAxis = (
    lo: number, hi: number, boxHalf: number, isX: boolean,
  ): void => {
    // Ticks menores
    if (drawTicks) {
      ctx.strokeStyle = COLOR_TICK_MINOR
      ctx.lineWidth = 1
      ctx.beginPath()
      const start = Math.ceil(lo / tickStep) * tickStep
      for (let m = start; m <= hi + 1e-9; m += tickStep) {
        // Los que caen en etiqueta los dibuja el pase mayor
        if (Math.abs(m - Math.round(m / labelStep) * labelStep) < 1e-9) continue
        const p = isX
          ? (m - cam.panX) * cam.zoom + halfW
          : (m - cam.panY) * cam.zoom + halfH
        if (isX) { ctx.moveTo(p, RULER_PX - 4); ctx.lineTo(p, RULER_PX) }
        else { ctx.moveTo(RULER_PX - 4, p); ctx.lineTo(RULER_PX, p) }
      }
      ctx.stroke()
    }

    // Ticks mayores + etiquetas
    ctx.textAlign = 'center'
    const start = Math.ceil(lo / labelStep) * labelStep
    for (let m = start; m <= hi + 1e-9; m += labelStep) {
      const p = isX
        ? (m - cam.panX) * cam.zoom + halfW
        : (m - cam.panY) * cam.zoom + halfH
      const isZero = Math.abs(m) < 1e-9
      const isEdge = Math.abs(Math.abs(m) - boxHalf) < 1e-9
      ctx.strokeStyle = isZero ? COLOR_ZERO : isEdge ? COLOR_BOX_EDGE : COLOR_TICK_MAJOR
      ctx.lineWidth = isZero || isEdge ? 1.6 : 1
      ctx.beginPath()
      const len = isZero || isEdge ? 11 : 7
      if (isX) { ctx.moveTo(p, RULER_PX - len); ctx.lineTo(p, RULER_PX) }
      else { ctx.moveTo(RULER_PX - len, p); ctx.lineTo(RULER_PX, p) }
      ctx.stroke()

      ctx.fillStyle = isZero ? COLOR_ZERO : COLOR_LABEL
      if (isX) ctx.fillText(fmtM(m), p, RULER_PX - 12)
      else {
        // Eje Z: etiqueta rotada 90° para no desbordar la banda
        ctx.save()
        ctx.translate(RULER_PX - 12, p)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText(fmtM(m), 0, 3)
        ctx.restore()
      }
    }
  }

  drawAxis(minX, maxX, boxHalfW, true)
  drawAxis(minZ, maxZ, boxHalfD, false)
}
