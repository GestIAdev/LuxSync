/**
 * ☀️ HYPERION — Tactical Canvas Types
 * 
 * Type definitions for the 2D tactical view renderer.
 * 
 * @module components/hyperion/views/tactical/types
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

import type { CanonicalZone } from '../../shared/ZoneLayoutEngine'

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY MODE (re-export for convenience)
// ═══════════════════════════════════════════════════════════════════════════

export type QualityMode = 'HQ' | 'LQ'

// ═══════════════════════════════════════════════════════════════════════════
// TACTICAL FIXTURE — Data for 2D rendering
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fixture data prepared for tactical canvas rendering.
 * All coordinates are normalized 0-1.
 */
export interface TacticalFixture {
  /** Unique fixture ID */
  id: string
  
  // ── Position (normalized 0-1) ───────────────────────────────────────────
  /** X position (0=left, 1=right) */
  x: number
  /** Y position (0=top, 1=bottom) */
  y: number
  
  // ── Color (0-255 RGB) ───────────────────────────────────────────────────
  /** Red channel (0-255) */
  r: number
  /** Green channel (0-255) */
  g: number
  /** Blue channel (0-255) */
  b: number
  
  // ── Intensity ───────────────────────────────────────────────────────────
  /** Normalized intensity (0-1) */
  intensity: number
  
  // ── Fixture Classification ──────────────────────────────────────────────
  /** Fixture archetype */
  type: 'par' | 'moving' | 'strobe' | 'laser' | 'wash'
  /** Canonical zone */
  zone: CanonicalZone
  
  // ── Physics (normalized 0-1) ────────────────────────────────────────────
  /** Physical pan position (0-1, 0.5=center) */
  physicalPan: number
  /** Physical tilt position (0-1, 0.5=horizontal) */
  physicalTilt: number
  
  // ── Optics (0-255 DMX) ──────────────────────────────────────────────────
  /** Zoom (0=tight beam, 255=wide wash) */
  zoom: number
  /** Focus (0=sharp, 255=soft) */
  focus: number
  /** Gobo wheel 1 (0=open, >0=gobo index) */
  gobo: number
  /** Prism (0=open, >0=prism active) */
  prism: number
  
  // ── Velocity (for motion effects) ───────────────────────────────────────
  /** Pan velocity (signed, for trail effects) */
  panVelocity: number
  /** Tilt velocity (signed, for trail effects) */
  tiltVelocity: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HIT TEST — Mouse interaction results
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of a hit test (which fixture is under the cursor).
 */
export interface HitTestResult {
  /** Fixture ID if hit, null if none */
  fixtureId: string | null
  /** Fixture index in array if hit */
  fixtureIndex: number | null
  /** Distance from fixture center (pixels) */
  distance: number | null
}

// ═══════════════════════════════════════════════════════════════════════════
// SELECTION STATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selection state for tactical canvas.
 */
export interface TacticalSelection {
  /** Set of selected fixture IDs */
  selectedIds: Set<string>
  /** Currently hovered fixture ID (for tooltip) */
  hoveredId: string | null
  /** Is lasso selection active? */
  isLassoActive: boolean
  /** Lasso bounds if active */
  lassoBounds: {
    startX: number
    startY: number
    endX: number
    endY: number
  } | null
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration options for TacticalCanvas.
 */
export interface TacticalCanvasOptions {
  /** Quality mode (HQ/LQ) */
  quality: QualityMode
  /** Show tactical grid */
  showGrid: boolean
  /** Show zone labels */
  showZoneLabels: boolean
  /** Show reference lines (stage, truss) */
  showReferenceLines: boolean
  /** Show stereo center division */
  showStereoDivision: boolean
  /** Target FPS */
  targetFPS: number
  /** Device pixel ratio cap */
  maxDPR: number
}

/**
 * Default options for TacticalCanvas.
 */
export const DEFAULT_TACTICAL_OPTIONS: TacticalCanvasOptions = {
  quality: 'HQ',
  showGrid: true,
  showZoneLabels: true,
  showReferenceLines: true,
  showStereoDivision: true,
  targetFPS: 60,
  maxDPR: 1.5,
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Real-time performance metrics.
 */
export interface RenderMetrics {
  /** Current FPS */
  fps: number
  /** Frame time in ms */
  frameTime: number
  /** Fixture count being rendered */
  fixtureCount: number
  /** Last render timestamp */
  lastRenderTime: number
}
