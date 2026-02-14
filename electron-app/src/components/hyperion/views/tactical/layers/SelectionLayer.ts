/**
 * ☀️ HYPERION — Selection Layer
 * 
 * Capa de selección visual: rings de selección, hover rings, lasso.
 * Estética neon con animaciones CSS-driven.
 * 
 * @module components/hyperion/views/tactical/layers/SelectionLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import type { TacticalFixture } from '../types'
import { HYPERION } from '../../../shared/NeonPalette'

// ═══════════════════════════════════════════════════════════════════════════
// SELECTION VISUAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const SELECTION_CONFIG = {
  /** Selection ring radius multiplier (relative to fixture base radius) */
  RING_RADIUS: 1.8,
  /** Selection ring line width */
  RING_WIDTH: 2,
  /** Hover ring radius multiplier */
  HOVER_RADIUS: 1.5,
  /** Hover ring line width */
  HOVER_WIDTH: 1.5,
  /** Lasso fill alpha */
  LASSO_FILL_ALPHA: 0.08,
  /** Lasso stroke alpha */
  LASSO_STROKE_ALPHA: 0.4,
  /** Lasso stroke width */
  LASSO_WIDTH: 1.5,
  /** Corner bracket size (for selected fixtures) */
  BRACKET_SIZE: 6,
  /** Bracket line width */
  BRACKET_WIDTH: 1.5,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// SELECTION LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render selection visuals.
 */
export function renderSelectionLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fixtures: TacticalFixture[],
  baseRadius: number,
  options: {
    /** Set of selected fixture IDs */
    selectedIds: Set<string>
    /** Currently hovered fixture ID */
    hoveredId: string | null
    /** Lasso bounds (if active) */
    lassoBounds: { startX: number; startY: number; endX: number; endY: number } | null
    /** Animation phase (0-1, for animated effects) */
    animationPhase?: number
  }
): void {
  const { selectedIds, hoveredId, lassoBounds, animationPhase = 0 } = options
  const { RING_RADIUS, RING_WIDTH, HOVER_RADIUS, HOVER_WIDTH, BRACKET_SIZE, BRACKET_WIDTH } = SELECTION_CONFIG

  // ── HOVER RING ──────────────────────────────────────────────────────────
  
  if (hoveredId && !selectedIds.has(hoveredId)) {
    const fixture = fixtures.find(f => f.id === hoveredId)
    if (fixture) {
      const fx = fixture.x * width
      const fy = fixture.y * height
      const hoverRadius = baseRadius * HOVER_RADIUS

      ctx.beginPath()
      ctx.arc(fx, fy, hoverRadius, 0, Math.PI * 2)
      ctx.strokeStyle = HYPERION.neon.magenta
      ctx.lineWidth = HOVER_WIDTH
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // ── SELECTION RINGS ─────────────────────────────────────────────────────
  
  for (const fixture of fixtures) {
    if (!selectedIds.has(fixture.id)) continue

    const fx = fixture.x * width
    const fy = fixture.y * height
    const ringRadius = baseRadius * RING_RADIUS

    // Cyan selection ring
    ctx.beginPath()
    ctx.arc(fx, fy, ringRadius, 0, Math.PI * 2)
    ctx.strokeStyle = HYPERION.neon.cyan
    ctx.lineWidth = RING_WIDTH
    ctx.stroke()

    // Corner brackets (targeting reticle style)
    drawTargetingBrackets(ctx, fx, fy, ringRadius + 4, BRACKET_SIZE, BRACKET_WIDTH)
  }

  // ── LASSO SELECTION BOX ─────────────────────────────────────────────────
  
  if (lassoBounds) {
    const { startX, startY, endX, endY } = lassoBounds
    const lx = Math.min(startX, endX) * width
    const ly = Math.min(startY, endY) * height
    const lw = Math.abs(endX - startX) * width
    const lh = Math.abs(endY - startY) * height

    // Fill
    ctx.fillStyle = `rgba(0, 240, 255, ${SELECTION_CONFIG.LASSO_FILL_ALPHA})`
    ctx.fillRect(lx, ly, lw, lh)

    // Stroke (animated dash)
    ctx.strokeStyle = `rgba(0, 240, 255, ${SELECTION_CONFIG.LASSO_STROKE_ALPHA})`
    ctx.lineWidth = SELECTION_CONFIG.LASSO_WIDTH
    ctx.setLineDash([6, 4])
    ctx.lineDashOffset = -animationPhase * 20
    ctx.strokeRect(lx, ly, lw, lh)
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
  }
}

/**
 * Draw targeting brackets around a fixture (military HUD style).
 */
function drawTargetingBrackets(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  bracketSize: number,
  lineWidth: number
): void {
  ctx.strokeStyle = HYPERION.neon.cyan
  ctx.lineWidth = lineWidth

  const corners = [
    { x: cx - radius, y: cy - radius, dx: 1, dy: 1 },   // Top-left
    { x: cx + radius, y: cy - radius, dx: -1, dy: 1 },  // Top-right
    { x: cx - radius, y: cy + radius, dx: 1, dy: -1 },  // Bottom-left
    { x: cx + radius, y: cy + radius, dx: -1, dy: -1 }, // Bottom-right
  ]

  for (const corner of corners) {
    ctx.beginPath()
    // Horizontal bracket arm
    ctx.moveTo(corner.x, corner.y)
    ctx.lineTo(corner.x + bracketSize * corner.dx, corner.y)
    // Vertical bracket arm
    ctx.moveTo(corner.x, corner.y)
    ctx.lineTo(corner.x, corner.y + bracketSize * corner.dy)
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { SELECTION_CONFIG }
