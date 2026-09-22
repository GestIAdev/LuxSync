/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 GRID LAYER — WAVE 8010-P2: CUADRÍCULA CUÁNTICA DEL CRYSTAL BOX
 *
 * Cuadrícula en METROS REALES sobre el plano XZ proyectado:
 *   - Subdivisiones tenues cada 0.25 m — el grid cuántico del Crystal Box
 *     (el tamaño de celda espacial del rig). Solo se dibujan cuando su
 *     separación en pantalla ≥ MINOR_MIN_PX (culling de densidad: a zoom
 *     lejano colapsarían en ruido sólido).
 *   - Líneas principales cada 1 m.
 *   - Ejes del origen X=0 y Z=0 resaltados con el acento Asteria.
 *   - Densidad adaptativa: si el paso principal baja de MAJOR_MIN_PX en
 *     pantalla, escala ×5 (5 m, 25 m…) — siempre potencias de 5 sobre la
 *     base métrica para que las etiquetas futuras sigan siendo redondas.
 *
 * FUNCIÓN PURA de dibujo: lee el WorldTransform pasado por el RAF (obtenido
 * vía getWorldTransform(), snapshot no reactivo). No toca React ni stores.
 *
 * @module HephaestusView/asteria/canvas/layers/GridLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { visibleWorldRect, type WorldTransform } from '../useWorldTransform'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Paso menor: el cuanto espacial del Crystal Box, en metros. */
const MINOR_STEP_M = 0.25
/** Paso mayor base, en metros. */
const MAJOR_STEP_M = 1
/** Si la subdivisión menor cae por debajo de esto en px, no se dibuja. */
const MINOR_MIN_PX = 5
/** Si el paso mayor cae por debajo de esto en px, escala ×5. */
const MAJOR_MIN_PX = 9

const COLOR_MINOR = 'rgba(123, 92, 255, 0.055)'
const COLOR_MAJOR = 'rgba(123, 92, 255, 0.16)'
const COLOR_AXIS = 'rgba(123, 92, 255, 0.75)'

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────

export function drawGridLayer(ctx: CanvasRenderingContext2D, t: WorldTransform): void {
  const { canvasW, canvasH, cam } = t
  const { minX, minZ, maxX, maxZ } = visibleWorldRect(t)

  // Paso mayor adaptativo: 1m → 5m → 25m… cuando el zoom aleja mucho
  let majorStep = MAJOR_STEP_M
  while (majorStep * cam.zoom < MAJOR_MIN_PX) majorStep *= 5

  const drawMinor = MINOR_STEP_M * cam.zoom >= MINOR_MIN_PX
  const halfW = canvasW / 2
  const halfH = canvasH / 2

  // ── Subdivisiones menores (0.25 m) ──
  if (drawMinor) {
    ctx.strokeStyle = COLOR_MINOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = Math.floor(minX / MINOR_STEP_M) * MINOR_STEP_M; x <= maxX; x += MINOR_STEP_M) {
      // Las líneas que coinciden con una mayor las pinta el pase principal
      if (Math.abs(x - Math.round(x / majorStep) * majorStep) < 1e-6) continue
      const sx = (x - cam.panX) * cam.zoom + halfW
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, canvasH)
    }
    for (let z = Math.floor(minZ / MINOR_STEP_M) * MINOR_STEP_M; z <= maxZ; z += MINOR_STEP_M) {
      if (Math.abs(z - Math.round(z / majorStep) * majorStep) < 1e-6) continue
      const sy = (z - cam.panY) * cam.zoom + halfH
      ctx.moveTo(0, sy)
      ctx.lineTo(canvasW, sy)
    }
    ctx.stroke()
  }

  // ── Líneas mayores (1 m, o el paso adaptado) ──
  ctx.strokeStyle = COLOR_MAJOR
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = Math.floor(minX / majorStep) * majorStep; x <= maxX; x += majorStep) {
    const sx = (x - cam.panX) * cam.zoom + halfW
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, canvasH)
  }
  for (let z = Math.floor(minZ / majorStep) * majorStep; z <= maxZ; z += majorStep) {
    const sy = (z - cam.panY) * cam.zoom + halfH
    ctx.moveTo(0, sy)
    ctx.lineTo(canvasW, sy)
  }
  ctx.stroke()

  // ── Ejes del origen (X=0, Z=0) ──
  ctx.strokeStyle = COLOR_AXIS
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const ox = (0 - cam.panX) * cam.zoom + halfW
  const oy = (0 - cam.panY) * cam.zoom + halfH
  if (ox >= 0 && ox <= canvasW) {
    ctx.moveTo(ox, 0)
    ctx.lineTo(ox, canvasH)
  }
  if (oy >= 0 && oy <= canvasH) {
    ctx.moveTo(0, oy)
    ctx.lineTo(canvasW, oy)
  }
  ctx.stroke()
}
