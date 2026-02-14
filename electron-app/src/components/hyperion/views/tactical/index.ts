/**
 * ☀️ HYPERION — Tactical Canvas Module Index
 * 
 * Barrel exports for the 2D tactical view.
 * 
 * @module components/hyperion/views/tactical
 * @since WAVE 2042.5 (Project Hyperion — Phase 3)
 */

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export { TacticalCanvas } from './TacticalCanvas'
export type { TacticalCanvasProps } from './TacticalCanvas'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type {
  TacticalFixture,
  HitTestResult,
  TacticalSelection,
  TacticalCanvasOptions,
  RenderMetrics,
  QualityMode,
} from './types'

export { DEFAULT_TACTICAL_OPTIONS } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export { useFixtureData } from './useFixtureData'

// ═══════════════════════════════════════════════════════════════════════════
// HIT TESTING
// ═══════════════════════════════════════════════════════════════════════════

export { 
  hitTestFixtures, 
  hitTestLasso,
  getCanvasMousePosition,
  canvasToNormalized,
} from './HitTestEngine'

// ═══════════════════════════════════════════════════════════════════════════
// LAYERS (for advanced customization)
// ═══════════════════════════════════════════════════════════════════════════

export {
  renderGridLayer,
  renderZoneLayer,
  renderFixtureLayer,
  renderSelectionLayer,
  renderHUDLayer,
  GRID_CONFIG,
  ZONE_LABEL_CONFIG,
  FIXTURE_CONFIG,
  SELECTION_CONFIG,
  HUD_CONFIG,
} from './layers'
