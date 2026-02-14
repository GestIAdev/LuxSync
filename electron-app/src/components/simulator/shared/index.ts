/**
 * ☀️ HYPERION — Shared Module Index
 * 
 * Re-exports de utilidades compartidas entre 2D y 3D.
 * 
 * @module components/simulator/shared
 * @since WAVE 2042.1 (Project Hyperion — Phase 0)
 */

// Zone Layout Engine — Single source of truth para zonas
export {
  // Zone utilities
  normalizeZone,
  resolveFixtureZone,
  groupByCanonicalZone,
  
  // Zone constants
  CANONICAL_ZONES,
  ZONE_LABELS,
  ZONE_COLORS,
  
  // 2D Layout
  ZONE_LAYOUT_2D,
  calculatePosition2D,
  
  // 3D Layout
  ZONE_LAYOUT_3D,
  calculatePosition3D,
  DEFAULT_STAGE_CONFIG,
  getDefaultPitch,
  
  // Helper functions
  distributeInRange,
  isVerticalZone,
  hasStereoSplit,
} from './ZoneLayoutEngine'

// Type exports
export type {
  CanonicalZone,
  ZoneLayout2D,
  ZoneLayout3D,
  StageConfig,
} from './ZoneLayoutEngine'

// Neon Palette — Design tokens
export {
  HYPERION,
  hexToRgba,
  generateGlow,
  getFixtureOffColor,
  getBeatColor,
} from './NeonPalette'

// Shared types
export type {
  HyperionFixtureData,
  QualityMode,
  QualitySettings,
  ViewMode,
  HitTestResult,
  TooltipState,
  BeatState,
} from './types'

export { QUALITY_PRESETS } from './types'
