/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 NODE LAYER — WAVE 8010-P2: GLIFOS DEL NODE ATLAS
 *
 * Dibuja un indicador por cada NodeAtlasEntry con position definida,
 * proyectando (x, z) del mundo → píxeles. El eje Y se ignora por D-3.
 * Entradas sin position se saltan silenciosamente (nodos sin placement
 * espacial — no se fabrican coordenadas).
 *
 * Cada celda/pétalo sintético del atlas tiene su propia posición (anillo
 * de 15 cm generado en SpatialRegistrar) — por eso esta capa itera NODOS,
 * no fixtures: el multicelular se ve como constelación alrededor del
 * centro del aparato.
 *
 * FUNCIÓN PURA: recibe el atlas por parámetro (referencia estable leída
 * del store por el RAF — zero React cost) + el transform. Culling por
 * viewport para no dibujar fuera de pantalla.
 *
 * @module HephaestusView/asteria/canvas/layers/NodeLayer
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { WorldTransform } from '../useWorldTransform'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import { NodeFamily } from '../../../../../../core/aether/types'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Acento por familia de nodo — legibilidad del dominio de cada celda. */
const FAMILY_COLORS: Record<string, string> = {
  [NodeFamily.COLOR]: '#c084fc',      // violeta claro — dominio cromático
  [NodeFamily.IMPACT]: '#ffb347',     // ámbar — intensidad/strobo
  [NodeFamily.KINETIC]: '#4fd8e8',    // cian — movimiento
  [NodeFamily.BEAM]: '#e8ecff',       // blanco frío — conformación de haz
  [NodeFamily.ATMOSPHERE]: '#7ddb8a', // verde — atmósfera
}
const FAMILY_FALLBACK = '#9aa3b5'

/** Margen de culling en px — un glifo a ≤8px del borde aún puede verse. */
const CULL_MARGIN_PX = 12

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────

export function drawNodeLayer(
  ctx: CanvasRenderingContext2D,
  t: WorldTransform,
  atlas: NodeAtlas | null,
): void {
  if (!atlas) return

  const { canvasW, canvasH, cam } = t
  const halfW = canvasW / 2
  const halfH = canvasH / 2
  const entries = atlas.entries

  // Etiquetas solo con zoom cercano — a vista de conjunto ensucian
  const drawLabels = cam.zoom >= 90
  if (drawLabels) {
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const pos = entry.position
    if (!pos) continue

    const sx = (pos.x - cam.panX) * cam.zoom + halfW
    const sy = (pos.z - cam.panY) * cam.zoom + halfH

    // Culling de viewport
    if (
      sx < -CULL_MARGIN_PX || sx > canvasW + CULL_MARGIN_PX ||
      sy < -CULL_MARGIN_PX || sy > canvasH + CULL_MARGIN_PX
    ) {
      continue
    }

    const color = FAMILY_COLORS[entry.family] ?? FAMILY_FALLBACK

    // Anillo exterior + núcleo — el "glifo" del nodo
    ctx.strokeStyle = color
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(sx, sy, 1.8, 0, Math.PI * 2)
    ctx.fill()

    if (drawLabels) {
      ctx.fillStyle = 'rgba(230, 235, 255, 0.55)'
      ctx.fillText(entry.customLabel ?? entry.cellSuffix, sx, sy - 7)
    }
  }
}
