/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱️ LTP — Latest Takes Precedence
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3504: Pure, stateless LTP strategy function.
 *
 * Industry standard for POSITION and COLOR channels.
 * The most recently set value wins. This models the mental model of a
 * lighting console operator: "whatever I said last is what I mean now."
 *
 * Tie-breaking (equal timestamps): highest priority layer wins.
 *
 * @module core/arbiter/merge/strategies/LTP
 * @version WAVE 3504
 */

import type { LayerCandidate, ResolveResult } from '../types'
import { clampDMX } from '../MergeStrategies'

/**
 * Resolve N candidates via LTP.
 *
 * - Returns the candidate with the newest timestamp.
 * - On timestamp tie, the candidate with the highest priority wins.
 * - An empty candidates array returns { value: 0, winnerPriority: 0 }.
 *
 * @pure — no side-effects, no shared state.
 */
export function resolveLTP(candidates: readonly LayerCandidate[]): ResolveResult {
  if (candidates.length === 0) {
    return { value: 0, winnerPriority: 0 }
  }

  let latestTs = -Infinity
  let winnerPriority = 0
  let winnerValue = 0

  for (const c of candidates) {
    if (
      c.timestamp > latestTs ||
      (c.timestamp === latestTs && c.priority > winnerPriority)
    ) {
      latestTs = c.timestamp
      winnerPriority = c.priority
      winnerValue = c.value
    }
  }

  return { value: clampDMX(winnerValue), winnerPriority }
}
