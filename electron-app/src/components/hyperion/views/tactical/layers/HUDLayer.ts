/**
 * ☀️ HYPERION — HUD Layer
 * 
 * Capa de información superpuesta: FPS, quality badge, fixture count.
 * Estilo: HUD de combate minimalista.
 * 
 * @module components/hyperion/views/tactical/layers/HUDLayer
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import type { RenderMetrics, QualityMode } from '../types'
import { HYPERION } from '../../../shared/NeonPalette'

// ═══════════════════════════════════════════════════════════════════════════
// HUD CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const HUD_CONFIG = {
  /** HUD font size */
  FONT_SIZE: 10,
  /** HUD padding from edges */
  PADDING: 12,
  /** Row spacing */
  ROW_SPACING: 14,
} as const

// ═══════════════════════════════════════════════════════════════════════════
// HUD LAYER RENDERER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render performance HUD overlay.
 * 
 * Layout (bottom-right corner):
 * ```
 *                    ┌─────────────┐
 *                    │   ⚡ HQ     │
 *                    │  60 FPS     │
 *                    │  24 FIX     │
 *                    └─────────────┘
 * ```
 */
export function renderHUDLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  metrics: RenderMetrics,
  quality: QualityMode,
  options?: {
    /** Show FPS counter */
    showFPS?: boolean
    /** Show fixture count */
    showFixtureCount?: boolean
    /** Show quality badge */
    showQualityBadge?: boolean
  }
): void {
  const {
    showFPS = true,
    showFixtureCount = true,
    showQualityBadge = true,
  } = options ?? {}

  const { FONT_SIZE, PADDING, ROW_SPACING } = HUD_CONFIG
  
  ctx.font = `700 ${FONT_SIZE}px ${HYPERION.font.primary}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'

  let yOffset = PADDING

  // ── QUALITY BADGE ───────────────────────────────────────────────────────
  
  if (showQualityBadge) {
    const isHQ = quality === 'HQ'
    const badgeText = isHQ ? '✨ HQ' : '⚡ LQ'
    const badgeColor = isHQ ? HYPERION.neon.cyan : HYPERION.neon.gold

    ctx.fillStyle = badgeColor
    ctx.fillText(badgeText, width - PADDING, yOffset)
    yOffset += ROW_SPACING
  }

  // ── FPS COUNTER ─────────────────────────────────────────────────────────
  
  if (showFPS) {
    const fps = Math.round(metrics.fps)
    const fpsColor = fps >= 55 
      ? HYPERION.neon.green 
      : fps >= 30 
        ? HYPERION.neon.gold 
        : HYPERION.neon.red

    ctx.fillStyle = fpsColor
    ctx.fillText(`${fps} FPS`, width - PADDING, yOffset)
    yOffset += ROW_SPACING
  }

  // ── FIXTURE COUNT ───────────────────────────────────────────────────────
  
  if (showFixtureCount) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fillText(`${metrics.fixtureCount} FIX`, width - PADDING, yOffset)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { HUD_CONFIG }
