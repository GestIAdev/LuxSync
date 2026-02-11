/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS MODULE - THE FORGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 * 
 * Barrel export del módulo Hephaestus.
 * 
 * @module core/hephaestus
 * @version WAVE 2030.2
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
  HephParamSnapshot,
} from './types'

export {
  BEZIER_PRESETS,
  isHSL,
  isNumericValue,
} from './types'

// ── Engine ──────────────────────────────────────────────────────────────
export { CurveEvaluator } from './CurveEvaluator'

// ── Overlay ─────────────────────────────────────────────────────────────
export { HephParameterOverlay } from './HephParameterOverlay'
