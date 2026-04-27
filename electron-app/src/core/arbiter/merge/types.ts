/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔀 MERGE CAPSULE — TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504: Types owned by the merge capsule.
 * These types model the INPUT contract of MergeStrategyResolver.
 * They are intentionally decoupled from the legacy ChannelValue in
 * ../types.ts — that type carries arbiter-internal layer metadata.
 *
 * LayerCandidate is the agnostic projection: a value + its layer priority.
 * MergeStrategyResolver only knows about numbers and priorities — never
 * about fixture state, singletons, or side-effects.
 *
 * @module core/arbiter/merge/types
 * @version WAVE 3504
 */

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL KEY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identifies a channel within a fixture.
 * Mirrors ChannelType from ../types but is declared here as a simple string
 * union alias so the merge capsule has no hard import dependency on the parent.
 *
 * NOTE: Keep in sync with ChannelType in ../types.ts (WAVE 2084).
 */
export type ChannelKey =
  // INTENSITY
  | 'dimmer'
  | 'strobe'
  | 'shutter'
  // COLOR
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'cyan'
  | 'magenta'
  | 'yellow'
  | 'color_wheel'
  // POSITION
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  // BEAM
  | 'gobo'
  | 'gobo_rotation'
  | 'prism'
  | 'prism_rotation'
  | 'focus'
  | 'zoom'
  | 'frost'
  // CONTROL
  | 'speed'
  | 'macro'
  | 'control'
  // INGENIOS (WAVE 2084)
  | 'rotation'
  | 'custom'
  // FALLBACK
  | 'unknown'

// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The four canonical DMX merge strategies.
 *
 * - HTP  (Highest Takes Precedence)  — dimmer/intensity. Brightest wins.
 * - LTP  (Latest Takes Precedence)   — position/color. Timestamp-newest wins.
 * - ADD  (Additive)                  — ambient accents. Both sources contribute, cap 255.
 * - OVERRIDE                         — nuclear. Ignores all other candidates.
 */
export type MergeMode = 'HTP' | 'LTP' | 'ADD' | 'OVERRIDE'

// ═══════════════════════════════════════════════════════════════════════════
// LAYER CANDIDATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A single value candidate coming from one control layer.
 *
 * Fields:
 *   priority  — Numeric layer priority. Higher = more authoritative.
 *               Mirrors ControlLayer enum: 0=TITAN_AI, 2=MANUAL, 3=EFFECTS, 4=BLACKOUT.
 *   value     — Raw DMX value [0, 255].
 *   timestamp — Monotonic ms timestamp when this value was set (for LTP).
 *   weight    — Optional blend weight [0, 1] (used only when mode=ADD with weights).
 */
export interface LayerCandidate {
  readonly priority: number
  readonly value: number
  readonly timestamp: number
  readonly weight?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLVE RESULT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The resolved output of a channel merge operation.
 *
 * Fields:
 *   value      — Final DMX value [0, 255], NaN-safe (clampDMX applied inside resolver).
 *   winnerPriority — Priority of the layer whose value was selected (or dominant layer for ADD).
 */
export interface ResolveResult {
  readonly value: number
  readonly winnerPriority: number
}
