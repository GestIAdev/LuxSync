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
  }
): void {
  const {
    showReferenceLines = true,
    showStereoDivision = true,
    opacity = 1.0,
  } = options ?? {}

  const { CELL_SIZE, ACCENT_INTERVAL, CROSS_SIZE, STAGE_LINE_Y, TRUSS_LINE_Y, STEREO_LINE_X } = GRID_CONFIG

  // ── BASE GRID LINES ─────────────────────────────────────────────────────
  
  // Vertical lines
  for (let x = 0; x <= width; x += CELL_SIZE) {
    const isAccent = (x / CELL_SIZE) % ACCENT_INTERVAL === 0
    
    ctx.strokeStyle = isAccent
      ? `rgba(0, 240, 255, ${0.10 * opacity})`   // Accent: brighter
      : `rgba(0, 240, 255, ${0.04 * opacity})`   // Base: subtle
    ctx.lineWidth = isAccent ? 0.8 : 0.5
    
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += CELL_SIZE) {
    const isAccent = (y / CELL_SIZE) % ACCENT_INTERVAL === 0
    
    ctx.strokeStyle = isAccent
      ? `rgba(0, 240, 255, ${0.10 * opacity})`
      : `rgba(0, 240, 255, ${0.04 * opacity})`
    ctx.lineWidth = isAccent ? 0.8 : 0.5
    
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // ── CROSS MARKERS AT ACCENT INTERSECTIONS ───────────────────────────────
  
  ctx.strokeStyle = `rgba(0, 240, 255, ${0.20 * opacity})`
  ctx.lineWidth = 1.2

  const accentStep = CELL_SIZE * ACCENT_INTERVAL

  for (let x = 0; x <= width; x += accentStep) {
    for (let y = 0; y <= height; y += accentStep) {
      ctx.beginPath()
      // Horizontal stroke
      ctx.moveTo(x - CROSS_SIZE, y)
      ctx.lineTo(x + CROSS_SIZE, y)
      // Vertical stroke
      ctx.moveTo(x, y - CROSS_SIZE)
      ctx.lineTo(x, y + CROSS_SIZE)
      ctx.stroke()
    }
  }

  // ── REFERENCE LINES ─────────────────────────────────────────────────────
  
  if (showReferenceLines) {
    // Front-of-stage line (magenta dashed)
    const stageY = height * STAGE_LINE_Y
    ctx.strokeStyle = `rgba(255, 0, 229, ${0.15 * opacity})`
    ctx.lineWidth = 1.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(0, stageY)
    ctx.lineTo(width, stageY)
    ctx.stroke()

    // Truss line (cyan dashed)
    const trussY = height * TRUSS_LINE_Y
    ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 * opacity})`
    ctx.lineWidth = 1
    ctx.setLineDash([6, 8])
    ctx.beginPath()
    ctx.moveTo(0, trussY)
    ctx.lineTo(width, trussY)
    ctx.stroke()

    ctx.setLineDash([])  // Reset
  }

  // ── STEREO CENTER DIVISION ──────────────────────────────────────────────
  
  if (showStereoDivision) {
    const centerX = width * STEREO_LINE_X
    
    // Subtle purple gradient line in center
    const grad = ctx.createLinearGradient(centerX, 0, centerX, height)
    grad.addColorStop(0, `rgba(176, 38, 255, 0)`)
    grad.addColorStop(0.3, `rgba(176, 38, 255, ${0.08 * opacity})`)
    grad.addColorStop(0.7, `rgba(176, 38, 255, ${0.08 * opacity})`)
    grad.addColorStop(1, `rgba(176, 38, 255, 0)`)

    ctx.strokeStyle = grad
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, height)
    ctx.stroke()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { GRID_CONFIG }
