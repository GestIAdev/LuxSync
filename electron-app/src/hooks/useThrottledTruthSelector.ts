/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 useThrottledTruthSelector — WAVE 7583: ECO-MODE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Throttled data-access hook for Eco-Mode fallback components.
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7.6.
 *
 * The audit describes this hook as subscribing to the transient store via
 * `useTransientStore.subscribeWithSelector` and calling `setState` at most once
 * every `intervalMs`. In the actual codebase, the "transient store" is a
 * **mutable ref** (`transientRef` in `stores/transientStore.ts`), not a Zustand
 * store — it has no `.subscribe` / `.subscribeWithSelector` surface. It is
 * updated at 22–44 Hz by `injectHotFrame()` and read at 60 fps by the
 * AudioSpectrumTitan RAF loop via `getTransientTruth()`.
 *
 * The faithful realization of the audit's intent — "throttle data-driven
 * updates to 5 Hz, no RAF" — given that architecture is a **polling interval**:
 *   • A `setInterval` fires every `intervalMs` (default 200ms = 5 Hz).
 *   • On each tick it reads `getTransientTruth()` (the freshest snapshot,
 *     updated at 22–44 Hz by hot-frames — fresher than `useTruthStore`, which
 *     `useSeleneTruth` already throttles to ~2 Hz).
 *   • It applies the selector and calls `setState` **only if the selected
 *     value changed** (cheap shallow compare), so a static show produces zero
 *     re-renders after the first paint.
 *
 * This is strictly cheaper than the `subscribeWithSelector` formulation would
 * have been: there is no per-frame subscription callback, no comparator
 * allocation, and no dependency on a middleware the transient store doesn't
 * use. The cadence (5 Hz) and the contract (returns the latest snapshot, stale
 * data acceptable for display) match the audit exactly.
 *
 * @module hooks/useThrottledTruthSelector
 * @version 7583.0.0 - Eco-Mode
 */

import { useEffect, useRef, useState } from 'react'
import { getTransientTruth } from '../stores/transientStore'
import type { SeleneTruth } from '../core/protocol/SeleneProtocol'

/** Default throttle interval — 5 Hz, per audit §3.7.6. */
export const DEFAULT_THROTTLE_MS = 200

/**
 * Select a slice from the live `SeleneTruth` snapshot.
 *
 * The selector MUST return a value whose shallow equality is meaningful for the
 * consumer — a primitive, or an object/array whose reference is stable across
 * unchanged frames. For object slices, prefer returning a tuple of primitives
 * and destructuring at the call site, or wrap with `useShallow` at the
 * consumer. Returning a fresh object literal every tick will re-render every
 * tick (defeating the throttle).
 */
export type TruthSelector<T> = (truth: SeleneTruth) => T

/**
 * Subscribe to the transient truth store at a throttled cadence.
 *
 * @param selector  Pure function extracting the slice the component needs.
 * @param intervalMs Minimum time between React state updates. Default 200ms (5 Hz).
 * @returns The latest selected value, or `null` before the first truth arrives.
 */
export function useThrottledTruthSelector<T>(
  selector: TruthSelector<T>,
  intervalMs: number = DEFAULT_THROTTLE_MS,
): T | null {
  const [value, setValue] = useState<T | null>(null)
  const selectorRef = useRef(selector)
  const valueRef = useRef<T | null>(null)

  // Keep the latest selector without re-subscribing on every render.
  selectorRef.current = selector

  useEffect(() => {
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const truth = getTransientTruth()
      if (!truth) return // No truth yet — leave the previous value (or null).

      const next = selectorRef.current(truth)
      const prev = valueRef.current

      // Shallow equality gate — skip setState when nothing changed.
      // This is what makes a static show produce zero re-renders after paint.
      if (prev === next) return
      if (
        prev !== null &&
        next !== null &&
        typeof prev === 'object' &&
        typeof next === 'object'
      ) {
        // Shallow-compare object slices so {bpm:120, onBeat:false} doesn't
        // re-render when the values are identical but the reference changed.
        const prevKeys = Object.keys(prev as Record<string, unknown>)
        const nextKeys = Object.keys(next as Record<string, unknown>)
        if (prevKeys.length === nextKeys.length) {
          let same = true
          for (const k of prevKeys) {
            if ((prev as Record<string, unknown>)[k] !== (next as Record<string, unknown>)[k]) {
              same = false
              break
            }
          }
          if (same) return
        }
      }

      valueRef.current = next
      setValue(next)
    }

    // Fire once immediately so the first paint isn't a null flash, then poll.
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return value
}
