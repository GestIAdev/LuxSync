/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS MODULE - THE FORGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.5: HEPHAESTUS CORE ENGINE + FILE I/O
 * 
 * Barrel export del módulo Hephaestus.
 * 
 * @module core/hephaestus
 * @version WAVE 2030.5
 */

// ── Types ───────────────────────────────────────────────────────────────
export type {
  HSL,
  HephInterpolation,
  HephCurveMode,
  HephParamId,
  HephKeyframe,
  HephCurve,
  HephAutomationClip,
  HephAutomationClipV3,
  HephTrack,
  HephParamSnapshot,
  HephAutomationClipSerialized,
} from './types'

export {
  BEZIER_PRESETS,
  isHSL,
  isNumericValue,
  serializeHephClip,
  serializeHephClipV3,
  deserializeHephClip,
  inferHephCategory,
} from './types'

// ── Engine ──────────────────────────────────────────────────────────────
export { CurveEvaluator } from './CurveEvaluator'

// ── Overlay ─────────────────────────────────────────────────────────────
export { HephParameterOverlay } from './HephParameterOverlay'

// ── File I/O (WAVE 2030.5) ──────────────────────────────────────────────
export { hephFileIO, type HephClipMetadata } from './HephFileIO'
export { setupHephIPCHandlers } from './HephIPCHandlers'
