/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-E: KEYFORGE — CHORD MATCHER (preview from Batch 1)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Detects whether the currently held-key set matches a registered chord
 * (Tekken-style: order-independent combo within a temporal window).
 *
 * Detection rule:
 *   When key K is pressed, for each chord that includes K:
 *     1. All OTHER keys in the chord must be currently held.
 *     2. The keydown timestamps of all chord keys must be within
 *        `CHORD_WINDOW_MS` of the anchor (newest) keydown.
 *     3. The active layer must match the chord's layer (or chord is `base`,
 *        which is universal).
 *
 * If multiple chords could match, the chord with the MOST keys wins
 * (most specific). Ties are resolved by registration order.
 *
 * @module keyforge/chordMatcher
 * @version WAVE 4800-E (foundation)
 */

import {
  type ChordBinding,
  type KeyCode,
  type LayerId,
  CHORD_WINDOW_MS,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-key timestamp map. Required for temporal-window check.
 * Owned by the runtime hook (not the store) — pure transient state.
 */
export type KeyDownTimes = ReadonlyMap<KeyCode, number /* ms */>

/**
 * Try to find a chord that fires NOW.
 *
 * @param anchor    - the key just pressed (kicks the matching attempt)
 * @param held      - set of physically held keys (must include anchor)
 * @param downTimes - per-key keydown timestamps
 * @param layer     - active layer id
 * @param chords    - registered chord catalog
 * @param now       - current timestamp (ms, performance.now or Date.now)
 * @returns the winning chord or `null` if no match
 */
export function matchChord(
  anchor: KeyCode,
  held: ReadonlySet<KeyCode>,
  downTimes: KeyDownTimes,
  layer: LayerId,
  chords: readonly ChordBinding[],
  now: number,
): ChordBinding | null {
  let best: ChordBinding | null = null
  let bestSize = -1

  for (const chord of chords) {
    // Layer filter: chord must match active layer OR be `base` (universal).
    if (chord.layer !== layer && chord.layer !== 'base') continue

    // Anchor membership: the chord must include the just-pressed key.
    if (!chord.keys.includes(anchor)) continue

    // All chord keys must be currently held.
    let allHeld = true
    for (const k of chord.keys) {
      if (!held.has(k)) { allHeld = false; break }
    }
    if (!allHeld) continue

    // Temporal window: every chord key must have been pressed within
    // CHORD_WINDOW_MS of `now`. The anchor (newest) is `now` by definition.
    let withinWindow = true
    for (const k of chord.keys) {
      const t = downTimes.get(k)
      if (t === undefined) { withinWindow = false; break }
      if (now - t > CHORD_WINDOW_MS) { withinWindow = false; break }
    }
    if (!withinWindow) continue

    // Specificity: pick the chord with the most keys (most specific wins).
    if (chord.keys.length > bestSize) {
      best = chord
      bestSize = chord.keys.length
    }
  }

  return best
}

/**
 * Pure helper for unit testing: detect whether two key sets overlap completely
 * regardless of order.
 */
export function chordKeysMatch(
  a: readonly KeyCode[],
  b: readonly KeyCode[],
): boolean {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  for (const k of a) {
    if (!bSet.has(k)) return false
  }
  return true
}
