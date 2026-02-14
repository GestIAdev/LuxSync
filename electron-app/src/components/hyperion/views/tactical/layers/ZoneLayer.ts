/**
 * ☀️ HYPERION — Zone Layer
 * 
 * Capa de etiquetas de zona: Labels flotantes que identifican cada sección.
 * Colores de ZONE_COLORS, posicionamiento de ZONE_LAYOUT_2D.
 * 
 * @module components/hyperion/views/tactical/layers/ZoneLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import { 
  ZONE_COLORS, 
  ZONE_LAYOUT_2D, 
  ZONE_LABELS,
  type CanonicalZone,
  CANONICAL_ZONES 
} from '../../../shared/ZoneLayoutEngine'
import { HYPERION } from '../../../shared/NeonPalette'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE LABEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const ZONE_LABEL_CONFIG = {
  /** Font family for zone labels */
  FONT_FAMILY: HYPERION.font.display,
  /** Font size in pixels */
  FONT_SIZE: 10,
  /** Label padding (horizontal) */
  PADDING_X: 8,
  /** Label padding (vertical) */
  PADDING_Y: 4,
  /** Background alpha */
  BG_ALPHA: 0.75,
  /** Border radius */
  BORDER_RADIUS: 2,
  /** Y offset from zone center (negative = above) */
  Y_OFFSET: -15,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// ZONE LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render zone labels as floating badges.
 * 
 * Each label shows:
 * - Zone name (e.g., "FRONT", "MOVER Ⓛ")
 * - Zone color as background tint
 * - Positioned at zone's visual center
 */
export function renderZoneLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: {
    /** Zones to render (default: all) */
    zones?: CanonicalZone[]
    /** Show zone count badges */
    showCounts?: boolean
    /** Fixture counts per zone */
    zoneCounts?: Map<CanonicalZone, number>
    /** Opacity multiplier */
    opacity?: number
  }
): void {
  const {
    zones = CANONICAL_ZONES.filter(z => z !== 'unassigned'),
    showCounts = false,
    zoneCounts = new Map(),
    opacity = 1.0,
  } = options ?? {}

  const { FONT_FAMILY, FONT_SIZE, PADDING_X, PADDING_Y, BG_ALPHA, BORDER_RADIUS, Y_OFFSET } = ZONE_LABEL_CONFIG

  ctx.font = `700 ${FONT_SIZE}px ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const zone of zones) {
    const layout = ZONE_LAYOUT_2D[zone]
    const color = ZONE_COLORS[zone]
    const label = ZONE_LABELS[zone] || layout.label

    // Calculate center position
    let x: number
    let y: number

    if (layout.fixedX !== undefined) {
      // Vertical zone (movers) — use fixed X
      x = layout.fixedX * width
      y = layout.y * height + Y_OFFSET
    } else {
      // Horizontal zone — use center of xRange
      const [xMin, xMax] = layout.xRange
      x = ((xMin + xMax) / 2) * width
      y = layout.y * height + Y_OFFSET
    }

    // Build label text
    const count = zoneCounts.get(zone) ?? 0
    const text = showCounts && count > 0 ? `${label} (${count})` : label

    // Measure text
    const metrics = ctx.measureText(text)
    const textWidth = metrics.width
    const textHeight = FONT_SIZE

    // Draw background pill
    const bgX = x - textWidth / 2 - PADDING_X
    const bgY = y - textHeight / 2 - PADDING_Y
    const bgW = textWidth + PADDING_X * 2
    const bgH = textHeight + PADDING_Y * 2

    // Parse zone color for background
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)

    // Background with zone color tint
    ctx.fillStyle = `rgba(${Math.floor(r * 0.2)}, ${Math.floor(g * 0.2)}, ${Math.floor(b * 0.2)}, ${BG_ALPHA * opacity})`
    roundRect(ctx, bgX, bgY, bgW, bgH, BORDER_RADIUS)
    ctx.fill()

    // Border with zone color
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * opacity})`
    ctx.lineWidth = 1
    roundRect(ctx, bgX, bgY, bgW, bgH, BORDER_RADIUS)
    ctx.stroke()

    // Text with zone color
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`
    ctx.fillText(text, x, y)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER — Rounded Rectangle
// ═══════════════════════════════════════════════════════════════════════════

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { ZONE_LABEL_CONFIG }
