/**
 * ☀️ HYPERION — Grid Layer
 * 
 * Capa de fondo: Cyberpunk tactical grid con cruces en intersecciones.
 * NO simulamos. Invocamos la estética del control de luz.
 * 
 * @module components/hyperion/views/tactical/layers/GridLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import { HYPERION } from '../../../shared/NeonPalette'

// ═══════════════════════════════════════════════════════════════════════════
// GRID CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const GRID_CONFIG = {
  /** Base cell size in CSS pixels */
  CELL_SIZE: 40,
  /** Lines per accent (thicker lines every N cells) */
  ACCENT_INTERVAL: 4,
  /** Cross marker size at accent intersections */
  CROSS_SIZE: 5,
  /** Stage line Y position (normalized 0-1) */
  STAGE_LINE_Y: 0.82,
  /** Truss line Y position (normalized 0-1) */
  TRUSS_LINE_Y: 0.15,
  /** Center stereo division line X position */
  STEREO_LINE_X: 0.5,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// GRID LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render the tactical cyberpunk grid.
 *
 * Visual Elements:
 * - Base grid lines (subtle cyan)
 * - Accent lines every 4 cells (brighter)
 * - Cross markers at accent intersections
 * - Front-of-stage line (magenta dashed)
 * - Truss line (cyan dashed)
 * - Stereo center division (purple subtle)
 *
 * 🩸 WAVE 7601: VIRTUAL CAMERA — the grid now draws across the entire
 * visible virtual viewport, not just the canvas dimensions. The viewport
 * bounds (in world space) are passed in, and the cell size is scaled by
 * zoom so cells appear consistent in world space regardless of zoom level.
 * 🩸 WAVE 7602: CENTERED ORIGIN — the grid is now drawn INSIDE the world-
 * space ctx transform. Cell size is in world units (no zoom scaling needed
 * — ctx.scale handles that). The viewport bounds limit drawing to visible
 * world space, preventing infinite line generation.
 */
export function renderGridLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: {
    /** Show stage/truss reference lines */
    showReferenceLines?: boolean
    /** Show stereo center division */
    showStereoDivision?: boolean
    /** Grid opacity multiplier (0-1) */
    opacity?: number
    /** 🩸 WAVE 7602: Visible world-space bounds (limits grid drawing) */
    viewport?: { left: number; top: number; right: number; bottom: number }
  }
): void {
  const {
    showReferenceLines = true,
    showStereoDivision = true,
    opacity = 1.0,
    viewport,
  } = options ?? {}

  const { CELL_SIZE, ACCENT_INTERVAL, CROSS_SIZE, STAGE_LINE_Y, TRUSS_LINE_Y, STEREO_LINE_X } = GRID_CONFIG

  // 🩸 WAVE 7602: Cell size is in WORLD units. ctx.scale(zoom) handles the
  // screen-space scaling, so cells appear consistent at any zoom level.
  const effectiveCellSize = CELL_SIZE
  const effectiveAccentStep = effectiveCellSize * ACCENT_INTERVAL
  const effectiveCrossSize = CROSS_SIZE

  // 🩸 WAVE 7602: Drawing bounds in world space. If viewport is provided,
  // draw only within the visible world bounds. Otherwise fall back to
  // canvas dimensions (legacy behavior, zoom=1).
  const drawLeft = viewport ? viewport.left : 0
  const drawTop = viewport ? viewport.top : 0
  const drawRight = viewport ? viewport.right : width
  const drawBottom = viewport ? viewport.bottom : height

  // Snap the starting positions to the grid so lines don't jitter on pan
  const startGridX = Math.floor(drawLeft / effectiveCellSize) * effectiveCellSize
  const startGridY = Math.floor(drawTop / effectiveCellSize) * effectiveCellSize

  // ── BASE GRID LINES ─────────────────────────────────────────────────────

  // Vertical lines
  for (let x = startGridX; x <= drawRight; x += effectiveCellSize) {
    const isAccent = Math.round(x / effectiveCellSize) % ACCENT_INTERVAL === 0

    ctx.strokeStyle = isAccent
      ? `rgba(0, 240, 255, ${0.10 * opacity})`   // Accent: brighter
      : `rgba(0, 240, 255, ${0.04 * opacity})`   // Base: subtle
    ctx.lineWidth = isAccent ? 0.8 : 0.5

    ctx.beginPath()
    ctx.moveTo(x, drawTop)
    ctx.lineTo(x, drawBottom)
    ctx.stroke()
  }

  // Horizontal lines
  for (let y = startGridY; y <= drawBottom; y += effectiveCellSize) {
    const isAccent = Math.round(y / effectiveCellSize) % ACCENT_INTERVAL === 0

    ctx.strokeStyle = isAccent
      ? `rgba(0, 240, 255, ${0.10 * opacity})`
      : `rgba(0, 240, 255, ${0.04 * opacity})`
    ctx.lineWidth = isAccent ? 0.8 : 0.5

    ctx.beginPath()
    ctx.moveTo(drawLeft, y)
    ctx.lineTo(drawRight, y)
    ctx.stroke()
  }

  // ── CROSS MARKERS AT ACCENT INTERSECTIONS ───────────────────────────────

  ctx.strokeStyle = `rgba(0, 240, 255, ${0.20 * opacity})`
  ctx.lineWidth = 1.2

  const startAccentX = Math.floor(drawLeft / effectiveAccentStep) * effectiveAccentStep
  const startAccentY = Math.floor(drawTop / effectiveAccentStep) * effectiveAccentStep

  for (let x = startAccentX; x <= drawRight; x += effectiveAccentStep) {
    for (let y = startAccentY; y <= drawBottom; y += effectiveAccentStep) {
      ctx.beginPath()
      // Horizontal stroke
      ctx.moveTo(x - effectiveCrossSize, y)
      ctx.lineTo(x + effectiveCrossSize, y)
      // Vertical stroke
      ctx.moveTo(x, y - effectiveCrossSize)
      ctx.lineTo(x, y + effectiveCrossSize)
      ctx.stroke()
    }
  }

  // ── REFERENCE LINES ─────────────────────────────────────────────────────

  if (showReferenceLines) {
    // Front-of-stage line (magenta dashed) — world space, no zoom scaling
    const stageY = height * STAGE_LINE_Y
    ctx.strokeStyle = `rgba(255, 0, 229, ${0.15 * opacity})`
    ctx.lineWidth = 1.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(drawLeft, stageY)
    ctx.lineTo(drawRight, stageY)
    ctx.stroke()

    // Truss line (cyan dashed)
    const trussY = height * TRUSS_LINE_Y
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 * opacity})`
    ctx.lineWidth = 1
    ctx.setLineDash([6, 8])
    ctx.beginPath()
    ctx.moveTo(drawLeft, trussY)
    ctx.lineTo(drawRight, trussY)
    ctx.stroke()

    ctx.setLineDash([])  // Reset
  }

  // ── STEREO CENTER DIVISION ──────────────────────────────────────────────

  if (showStereoDivision) {
    const centerX = width * STEREO_LINE_X

    // 🛡️ WAVE 7570.3: Replaced createLinearGradient with 3 solid segments.
    const a = 0.08 * opacity
    ctx.lineWidth = 1
    // Top fade (0% → 30%)
    ctx.strokeStyle = `rgba(176, 38, 255, ${a * 0.5})`
    ctx.beginPath(); ctx.moveTo(centerX, drawTop); ctx.lineTo(centerX, drawTop + (drawBottom - drawTop) * 0.3); ctx.stroke()
    // Middle solid (30% → 70%)
    ctx.strokeStyle = `rgba(176, 38, 255, ${a})`
    ctx.beginPath(); ctx.moveTo(centerX, drawTop + (drawBottom - drawTop) * 0.3); ctx.lineTo(centerX, drawTop + (drawBottom - drawTop) * 0.7); ctx.stroke()
    // Bottom fade (70% → 100%)
    ctx.strokeStyle = `rgba(176, 38, 255, ${a * 0.5})`
    ctx.beginPath(); ctx.moveTo(centerX, drawTop + (drawBottom - drawTop) * 0.7); ctx.lineTo(centerX, drawBottom); ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { GRID_CONFIG }
