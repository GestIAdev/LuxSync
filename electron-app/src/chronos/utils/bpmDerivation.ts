/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎚️ BPM DERIVATION UTILITY — OPERATION STARDUST (DRY)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shared sliding-window BPM derivation logic for MIDI Clock consumers.
 * Extracted from useMIDIClock.ts and MIDIClockSlave.ts to eliminate
 * code duplication (R5 — Operation Stardust).
 *
 * Algorithm:
 * - Collect beat intervals (24 PPQ → 1 beat per 24 pulses)
 * - Average over a sliding window of BPM_WINDOW_SIZE beats
 * - Median-filtered outlier rejection: intervals deviating >15% from the
 *   window median are excluded from the mean, protecting against USB-MIDI
 *   jitter. Falls back to the full window if all intervals are rejected.
 * - Apply hysteresis: only report if delta >= BPM_HYSTERESIS
 * - Clamp to [BPM_MIN, BPM_MAX] with 1-decimal precision
 *
 * @module chronos/utils/bpmDerivation
 */

/** Pulses Per Quarter Note (MIDI standard) */
export const PPQ = 24

/** Sliding window for BPM calculation (beats) */
export const BPM_WINDOW_SIZE = 8

/** Minimum BPM change to trigger update (hysteresis, prevents jitter) */
export const BPM_HYSTERESIS = 0.5

/** Valid BPM range */
export const BPM_MIN = 20
export const BPM_MAX = 300

/**
 * Maximum deviation (fraction of median) for an interval to be considered
 * valid. Intervals deviating more than this from the window median are
 * rejected as outliers before averaging — protects against single-pulse
 * jitter from USB-MIDI stacks.
 */
const BPM_MEDIAN_REJECT_RATIO = 0.15

/**
 * Compute the median of a sorted copy of the input array.
 * Does not mutate the input.
 */
function median(values: number[]): number {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Mutable state for BPM derivation.
 * Create once per clock source instance via `createBpmDerivationState()`.
 */
export interface BpmDerivationState {
  /** Sliding window of beat intervals (ms) */
  beatIntervals: number[]
  /** Last reported BPM (for hysteresis comparison) */
  lastReportedBpm: number
}

/** Create a fresh BPM derivation state */
export function createBpmDerivationState(): BpmDerivationState {
  return {
    beatIntervals: [],
    lastReportedBpm: 0,
  }
}

/**
 * Feed a new beat interval and derive BPM.
 *
 * @param state - Mutable derivation state (modified in place)
 * @param beatInterval - Duration of one beat in ms (24 pulse intervals)
 * @returns The new BPM if it changed (passed hysteresis), or `null` if
 *          insufficient data or no significant change.
 */
export function deriveBpm(
  state: BpmDerivationState,
  beatInterval: number,
): number | null {
  state.beatIntervals.push(beatInterval)
  if (state.beatIntervals.length > BPM_WINDOW_SIZE) {
    state.beatIntervals.shift()
  }

  if (state.beatIntervals.length < 2) return null

  // Median-filtered outlier rejection: compute the window median, then
  // average only the intervals that fall within ±15% of it. This rejects
  // single-pulse jitter from USB-MIDI stacks without distorting the steady-
  // state estimate. If all intervals are rejected (pathological jitter),
  // fall back to the median itself.
  const med = median(state.beatIntervals)
  if (!Number.isFinite(med) || med <= 0) return null

  const lowerBound = med * (1 - BPM_MEDIAN_REJECT_RATIO)
  const upperBound = med * (1 + BPM_MEDIAN_REJECT_RATIO)
  const filtered = state.beatIntervals.filter(
    (iv) => iv >= lowerBound && iv <= upperBound,
  )
  const intervalsToAverage = filtered.length >= 2 ? filtered : state.beatIntervals
  const avgInterval =
    intervalsToAverage.reduce((a, b) => a + b, 0) / intervalsToAverage.length

  // P1.2 FIX: Guard against avgInterval=0 → Infinity, or NaN → NaN
  if (!Number.isFinite(avgInterval) || avgInterval <= 0) return null

  const calculatedBpm = 60000 / avgInterval
  // P1.2 FIX: isFinite guard before clamp — Infinity passes Math.min/max
  if (!Number.isFinite(calculatedBpm)) return null

  const clampedBpm = Math.max(BPM_MIN, Math.min(BPM_MAX, calculatedBpm))
  const roundedBpm = Math.round(clampedBpm * 10) / 10

  if (Math.abs(roundedBpm - state.lastReportedBpm) >= BPM_HYSTERESIS) {
    state.lastReportedBpm = roundedBpm
    return roundedBpm
  }

  return null
}

/**
 * Compute the beat interval from a ring buffer of clock timestamps.
 *
 * REV. 2: Accepts `ArrayLike<number>` to support circular buffer implementations
 * that expose `.length` and numeric index access without being a true `number[]`.
 *
 * @param timestamps - Array-like of performance.now() timestamps for each clock pulse
 * @returns Beat interval in ms, or null if insufficient data
 */
export function computeBeatInterval(timestamps: ArrayLike<number>): number | null {
  if (timestamps.length < PPQ + 1) return null
  return timestamps[timestamps.length - 1] - timestamps[timestamps.length - 1 - PPQ]
}

/**
 * Assess signal quality from the number of collected beat intervals.
 *
 * @param beatCount - Number of beat intervals collected
 * @returns 'none' | 'weak' | 'stable'
 */
export function assessSignalQuality(beatCount: number): 'none' | 'weak' | 'stable' {
  if (beatCount >= BPM_WINDOW_SIZE) return 'stable'
  if (beatCount >= 2) return 'weak'
  return 'none'
}

/** Reset BPM derivation state to initial values */
export function resetBpmDerivation(state: BpmDerivationState): void {
  state.beatIntervals = []
  state.lastReportedBpm = 0
}
