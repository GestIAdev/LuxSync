/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 FEEDBACK LAYER — WAVE 8010-P2: LUZ REAL DEL RIG A 60 FPS
 *
 * El "mundo real respondiendo" del blueprint: por cada nodo del atlas,
 * busca su fixture en el transientStore (ghost store mutable a 44 Hz) por
 * `deviceId` y pinta un halo aditivo con el RGB REAL del aparato, escalado
 * por su dimmer. Las celdas de un mismo fixture comparten el color del
 * padre pero cada una brilla en SU posición — la constelación multicelular
 * se enciende pétalo a pétalo.
 *
 * DOGMA ZERO-REACT-COST:
 *   - Lee `getTransientFixture()` (Map O(1), store mutable fuera de React)
 *   - NADA de setState / suscripciones — el RAF consume directamente
 *   - El halo usa globalCompositeOperation 'lighter' (aditivo físico:
 *     halos solapados SUMAN luz, como hace el aire real)
 *
 * @module HephaestusView/asteria/canvas/layers/FeedbackLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import { getTransientFixture } from '../../../../../../stores/transientStore'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Radio base del halo en METROS (escala con el zoom, como el mundo). */
const HALO_RADIUS_M = 0.45
const HALO_MIN_PX = 9
const HALO_MAX_PX = 64
/** Margen de culling — el halo puede sobresalir aunque el centro salga. */
const CULL_MARGIN_PX = HALO_MAX_PX

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────

export function drawFeedbackLayer(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas | null,
): void {
  if (!atlas) return

  const { canvasW, canvasH, cam } = t
  const halfW = canvasW / 2
  const halfH = canvasH / 2
  const entries = atlas.entries

  const baseHaloPx = Math.min(
    HALO_MAX_PX,
    Math.max(HALO_MIN_PX, HALO_RADIUS_M * cam.zoom),
  )

  // Composición aditiva — la luz suma donde los halos se solapan
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const pos = entry.position
    if (!pos) continue

    const sx = (pos.x - cam.panX) * cam.zoom + halfW
    const sy = (pos.z - cam.panY) * cam.zoom + halfH
    if (
      sx < -CULL_MARGIN_PX || sx > canvasW + CULL_MARGIN_PX ||
      sy < -CULL_MARGIN_PX || sy > canvasH + CULL_MARGIN_PX
    ) {
      continue
    }

    // Match fixture-level: el transient indexa por deviceId (fixture),
    // no por nodeId (celda). Todas las celdas del mismo aparato comparten
    // su estado DMX — el nodo aporta la posición, el fixture la luz.
    const fx = getTransientFixture(entry.deviceId)
    if (!fx) continue

    const dimmer = typeof fx.dimmer === 'number' ? fx.dimmer : 0
    if (dimmer <= 0 || fx.active === false) continue

    const intensity = dimmer > 255 ? 1 : dimmer / 255
    const col = fx.color
    const r = typeof col?.r === 'number' ? col.r : 255
    const g = typeof col?.g === 'number' ? col.g : 255
    const b = typeof col?.b === 'number' ? col.b : 255

    // Halo radial — escala con intensidad (un dimmer bajo apenas respira)
    const haloPx = baseHaloPx * (0.45 + 0.55 * intensity)
    const alpha = 0.34 * intensity

    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloPx)
    grad.addColorStop(0, `rgba(${r | 0},${g | 0},${b | 0},${alpha})`)
    grad.addColorStop(0.55, `rgba(${r | 0},${g | 0},${b | 0},${alpha * 0.4})`)
    grad.addColorStop(1, `rgba(${r | 0},${g | 0},${b | 0},0)`)

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(sx, sy, haloPx, 0, Math.PI * 2)
    ctx.fill()

    // Núcleo caliente — el punto de emisión
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.75 * intensity})`
    ctx.beginPath()
    ctx.arc(sx, sy, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalCompositeOperation = 'source-over'
}
