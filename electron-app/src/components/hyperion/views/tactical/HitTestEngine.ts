/**
 * ☀️ HYPERION — Hit Test Engine
 * 
 * Motor de detección de colisión mouse → fixture.
 * Determina qué fixture está bajo el cursor para hover/selection.
 * 
 * @module components/hyperion/views/tactical/HitTestEngine
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import type { TacticalFixture, HitTestResult } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// HIT TEST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const HIT_TEST_CONFIG = {
  /** Hit radius multiplier (relative to fixture base radius) */
  HIT_RADIUS_MULTIPLIER: 1.5,
  /** Minimum hit radius in pixels */
  MIN_HIT_RADIUS: 12,
  /** Priority boost for lit fixtures (prefer hitting lit ones) */
  LIT_PRIORITY_BONUS: -5,  // Negative = closer = higher priority
} as const

// ═══════════════════════════════════════════════════════════════════════════
// HIT TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find the fixture under the given canvas coordinates.
 * 
 * @param mouseX - Mouse X in canvas pixels
 * @param mouseY - Mouse Y in canvas pixels
 * @param fixtures - Array of tactical fixtures
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param baseRadius - Base fixture radius in pixels
 * @returns HitTestResult with fixture info if hit
 */
export function hitTestFixtures(
  mouseX: number,
  mouseY: number,
  fixtures: TacticalFixture[],
  canvasWidth: number,
  canvasHeight: number,
  baseRadius: number
): HitTestResult {
  const hitRadius = Math.max(
    baseRadius * HIT_TEST_CONFIG.HIT_RADIUS_MULTIPLIER,
    HIT_TEST_CONFIG.MIN_HIT_RADIUS
  )

  let closestFixture: TacticalFixture | null = null
  let closestIndex: number | null = null
  let closestDistance = Infinity

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]
    
    // Convert normalized coords to canvas pixels
    const fx = fixture.x * canvasWidth
    const fy = fixture.y * canvasHeight

    // Calculate distance
    const dx = mouseX - fx
    const dy = mouseY - fy
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Check if within hit radius
    if (distance <= hitRadius) {
      // Apply priority bonus for lit fixtures
      const priorityDistance = fixture.intensity > 0.02
        ? distance + HIT_TEST_CONFIG.LIT_PRIORITY_BONUS
        : distance

      if (priorityDistance < closestDistance) {
        closestDistance = priorityDistance
        closestFixture = fixture
        closestIndex = i
      }
    }
  }

  if (closestFixture) {
    return {
      fixtureId: closestFixture.id,
      fixtureIndex: closestIndex,
      distance: closestDistance,
    }
  }

  return {
    fixtureId: null,
    fixtureIndex: null,
    distance: null,
  }
}

/**
 * Find all fixtures within a rectangular lasso selection.
 * 
 * @param bounds - Normalized selection bounds (0-1)
 * @param fixtures - Array of tactical fixtures
 * @returns Array of fixture IDs within bounds
 */
export function hitTestLasso(
  bounds: { startX: number; startY: number; endX: number; endY: number },
  fixtures: TacticalFixture[]
): string[] {
  const minX = Math.min(bounds.startX, bounds.endX)
  const maxX = Math.max(bounds.startX, bounds.endX)
  const minY = Math.min(bounds.startY, bounds.endY)
  const maxY = Math.max(bounds.startY, bounds.endY)

  const hitIds: string[] = []

  for (const fixture of fixtures) {
    if (
      fixture.x >= minX &&
      fixture.x <= maxX &&
      fixture.y >= minY &&
      fixture.y <= maxY
    ) {
      hitIds.push(fixture.id)
    }
  }

  return hitIds
}

/**
 * Convert mouse event coordinates to canvas-relative coordinates.
 * Handles DPR scaling and canvas offset.
 * 
 * @param event - Mouse event
 * @param canvas - Canvas element
 * @param dpr - Device pixel ratio used for rendering
 * @returns Canvas-relative coordinates in CSS pixels
 */
export function getCanvasMousePosition(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  dpr: number = 1
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  
  return {
    x: (event.clientX - rect.left),
    y: (event.clientY - rect.top),
  }
}

/**
 * Convert canvas coordinates to normalized coordinates (0-1).
 */
export function canvasToNormalized(
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  return {
    x: x / width,
    y: y / height,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { HIT_TEST_CONFIG }
