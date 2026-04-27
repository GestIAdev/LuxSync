/**
 * WAVE 3504.4 — ORCHESTRATOR MATH EXTRACTION
 * Types for the intent composition pipeline (pure, stateless).
 *
 * These types describe the input/output contracts for IntentComposer.
 * No runtime or singleton dependencies — safe to import from anywhere.
 */

import type { EffectIntentMap } from '../../arbiter/types'
import type { CombinedEffectOutput } from '../../effects/types'
import type { ZoneMappableFixture } from '../../zones/ZoneMapper'

// ─── RE-EXPORT FOR CONVENIENCE ───────────────────────────────────────────────

export type { EffectIntentMap, CombinedEffectOutput, ZoneMappableFixture }

// ─── INPUT ───────────────────────────────────────────────────────────────────

/**
 * Minimal fixture view the IntentComposer needs.
 * Must be a superset of ZoneMappableFixture.
 */
export interface FixtureSnapshot extends ZoneMappableFixture {
  /** Optional — used by Chronos guard to skip protected fixtures. */
  chronosProtected?: boolean
}

/**
 * Set of fixture IDs that Chronos (timeline playback) is currently painting.
 * IntentComposer will skip these fixtures when building the intent map.
 */
export type ChronosProtectedIds = ReadonlySet<string>

// ─── OUTPUT ──────────────────────────────────────────────────────────────────

/**
 * Telemetry produced alongside the EffectIntentMap for diagnostic purposes.
 */
export interface IntentCompositionResult {
  /** The resolved fixture-ID → intent map ready for MasterArbiter. */
  intentMap: EffectIntentMap
  /** Total fixture intents written in this frame. */
  intentCount: number
  /** Mix bus of the dominant effect ('htp' | 'global'). */
  mixBus: 'htp' | 'global'
  /** Global composition alpha of the dominant effect (0-1). */
  globalComposition: number
}
