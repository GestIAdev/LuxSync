/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-B: KEYFORGE — KEYBOARD CORTEX HOOK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The Global Keyboard Cortex.
 *
 * Pipeline:
 *   window.keydown → captureGuard → normalizeKeyCode → heldKeys.add()
 *     → resolveActiveLayer → chordMatcher.match()
 *     → (chord ? dispatchChord : dispatchBinding) → KeyActionDispatcher
 *
 * Lifecycle:
 *   Mount ONCE at app root (sibling of `useMidiLearn()`). The hook is
 *   currently NOT wired in `AppCommander.tsx` to avoid colliding with the
 *   legacy `KeyboardProvider`. Wiring happens in a later batch when the
 *   legacy provider is retired.
 *
 * Hot-path discipline:
 *   - `heldKeys` is a single mutable `Set` reused across all events
 *     (zero-alloc on the keyboard input path).
 *   - `downTimes` is a single mutable `Map` likewise reused.
 *   - The store is read via `getState()` snapshots — NO subscriptions inside
 *     listeners. This avoids re-render cascades.
 *
 * @module hooks/useKeyboardCortex
 * @version WAVE 4800-B
 */

import { useEffect, useRef } from 'react'
import {
  type KeyBehavior,
  type KeyBinding,
  type KeyCode,
  type LayerId,
  type ModifierState,
  DEFAULT_TAP_MAX_MS,
  EMPTY_MODIFIERS,
  MODIFIER_KEYS,
} from '../keyforge/types'
import { shouldInterceptKey } from '../keyforge/captureGuard'
import { normalizeKeyCode, captureModifiers } from '../keyforge/normalizeKeyCode'
import { resolveActiveLayer } from '../keyforge/layerResolver'
import { matchChord } from '../keyforge/chordMatcher'
import { dispatchAction } from '../keyforge/KeyActionDispatcher'
import { useKeyMapStore, getBindingSnapshot, getChordsSnapshot } from '../stores/keyMapStore'

// ═══════════════════════════════════════════════════════════════════════════
// PER-KEY RUNTIME STATE (transient — never persisted)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mutable runtime state owned by the hook. NOT exposed to React.
 * One instance per `useKeyboardCortex()` mount (which should be ONE in the app).
 */
interface CortexRuntime {
  /** Physical keys currently held. Includes modifiers. */
  readonly heldKeys: Set<KeyCode>
  /** Timestamp (ms) at which each key was pressed. Reset on keyup/blur. */
  readonly downTimes: Map<KeyCode, number>
  /** Active repeat timers per key (behavior: repeat). */
  readonly repeatTimers: Map<KeyCode, ReturnType<typeof setInterval>>
  /** Last computed active layer — diffed for store updates. */
  lastLayer: LayerId
  /** Did the last event we processed actually fire something? (for UI debug) */
  lastConsumed: boolean
  /** Keys whose individual action was suppressed because they joined a chord. */
  readonly chordSuppressed: Set<KeyCode>
}

function makeRuntime(): CortexRuntime {
  return {
    heldKeys:        new Set<KeyCode>(),
    downTimes:       new Map<KeyCode, number>(),
    repeatTimers:    new Map<KeyCode, ReturnType<typeof setInterval>>(),
    lastLayer:       'base',
    lastConsumed:    false,
    chordSuppressed: new Set<KeyCode>(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BEHAVIOR EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute the press-phase of a binding.
 *
 * Returns true if anything was dispatched. Returns false for `tap` (deferred
 * to keyup) and `charge` (also deferred).
 */
function executePress(
  binding: KeyBinding,
  mods: ModifierState,
  runtime: CortexRuntime,
): boolean {
  const b: KeyBehavior = binding.behavior
  switch (b.kind) {
    case 'tap':
      // Deferred — fired on keyup if within tapMaxMs.
      return false

    case 'hold':
      return dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 1.0,
        modifiers: mods,
        phase:     'press',
      })

    case 'toggle':
      // Toggle semantics are owned by the downstream action; we just fire press.
      return dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 1.0,
        modifiers: mods,
        phase:     'press',
      })

    case 'momentary':
      return dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 1.0,
        modifiers: mods,
        phase:     'press',
      })

    case 'charge':
      // Deferred — fired on keyup with charge ratio.
      return false

    case 'repeat': {
      // Fire once immediately, then schedule recurring.
      const ok = dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 1.0,
        modifiers: mods,
        phase:     'press',
      })
      // Set up the repeat timer.
      if (typeof window !== 'undefined' && !runtime.repeatTimers.has(binding.key)) {
        const timer = setInterval(() => {
          dispatchAction(binding.actionId, {
            source:    'keyforge',
            intensity: 1.0,
            modifiers: mods,
            phase:     'repeat',
          })
        }, b.periodMs)
        runtime.repeatTimers.set(binding.key, timer)
      }
      return ok
    }

    default: {
      // Exhaustiveness guard
      const _exhaustive: never = b
      void _exhaustive
      return false
    }
  }
}

/**
 * Execute the release-phase of a binding.
 *
 * `tStart` is the keydown timestamp; `now` is the keyup timestamp.
 */
function executeRelease(
  binding: KeyBinding,
  mods: ModifierState,
  runtime: CortexRuntime,
  tStart: number,
  now: number,
): boolean {
  const b: KeyBehavior = binding.behavior
  const heldMs = Math.max(0, now - tStart)

  switch (b.kind) {
    case 'tap': {
      const maxMs = b.tapMaxMs ?? DEFAULT_TAP_MAX_MS
      if (heldMs > maxMs) return false
      return dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 1.0,
        modifiers: mods,
        phase:     'press',
      })
    }

    case 'hold':
      return dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 0.0,
        modifiers: mods,
        phase:     'release',
      })

    case 'toggle':
      return false  // toggle ignores release by contract

    case 'momentary':
      if (b.releaseActionId !== undefined) {
        return dispatchAction(b.releaseActionId, {
          source:    'keyforge',
          intensity: 0.0,
          modifiers: mods,
          phase:     'release',
        })
      }
      return dispatchAction(binding.actionId, {
        source:    'keyforge',
        intensity: 0.0,
        modifiers: mods,
        phase:     'release',
      })

    case 'charge': {
      const charged = heldMs >= b.thresholdMs
      const ratio = Math.min(1, heldMs / Math.max(1, b.thresholdMs))
      const targetActionId = charged && b.chargedActionId !== undefined
        ? b.chargedActionId
        : binding.actionId
      return dispatchAction(targetActionId, {
        source:    'keyforge',
        intensity: charged ? 1.0 : ratio,
        modifiers: mods,
        phase:     'press',
      })
    }

    case 'repeat': {
      // Tear down the repeat timer.
      const t = runtime.repeatTimers.get(binding.key)
      if (t !== undefined) {
        clearInterval(t)
        runtime.repeatTimers.delete(binding.key)
      }
      return false
    }

    default: {
      const _exhaustive: never = b
      void _exhaustive
      return false
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEARN MODE CAPTURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * In Forge / Learn mode, the next keydown CLAIMS the active listening slot
 * instead of dispatching its bound action. Returns true if the event was
 * consumed by learn capture.
 */
function tryLearnCapture(key: KeyCode): boolean {
  const state = useKeyMapStore.getState()
  if (!state.isLearning) return false
  if (state.listeningSlot === null) return false

  // Reject modifier-only captures — modifiers are layer pivots, not bindable.
  if (MODIFIER_KEYS.has(key)) return false

  const slot = state.listeningSlot
  // If the slot was opened on a specific key, reassigning that same key is OK.
  // If it was opened on `null` (any-key), we use the pressed key.
  const targetKey: KeyCode = slot.key ?? key

  // Default to a `tap` behavior; richer behavior selection happens in the
  // overlay UI (Batch 2). For Batch 1 we bind a placeholder action so the
  // UI can confirm a slot was claimed.
  const placeholderActionId = `__unassigned__::${slot.layer}::${targetKey}`

  state.bindKey({
    key:      targetKey,
    layer:    slot.layer,
    actionId: placeholderActionId,
    behavior: { kind: 'tap' },
  })
  state.cancelListening()
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// THE HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global keyboard cortex.
 *
 * Mount ONCE at the app root. Subsequent mounts will install duplicate
 * listeners and cause double-fires — guard appropriately.
 *
 * Currently NOT auto-mounted in `AppCommander.tsx` — Batch 1 ships the
 * foundation but lets the legacy `KeyboardProvider` continue to handle
 * Space/1-6/Tab/Escape. Wiring happens in Batch 2 alongside the overlay.
 */
export function useKeyboardCortex(): void {
  const runtimeRef = useRef<CortexRuntime>(makeRuntime())

  useEffect(() => {
    const runtime = runtimeRef.current

    // ─────────────────────────── KEYDOWN ───────────────────────────
    const onKeyDown = (e: KeyboardEvent): void => {
      // Browser autorepeat → ignore (KeyForge implements its own repeat).
      if (e.repeat) {
        runtime.lastConsumed = false
        return
      }

      const key = normalizeKeyCode(e)
      if (key === null) return

      if (!shouldInterceptKey(e, key)) {
        runtime.lastConsumed = false
        return
      }

      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      runtime.heldKeys.add(key)
      runtime.downTimes.set(key, now)

      const mods = captureModifiers(e)
      const storeState = useKeyMapStore.getState()
      const activeLayer = resolveActiveLayer(runtime.heldKeys, mods, storeState.isLearning)

      // Sync layer into the store only on change (avoids storms of setState).
      if (activeLayer !== runtime.lastLayer) {
        runtime.lastLayer = activeLayer
        storeState.setLayer(activeLayer)
      }

      // ── LEARN MODE: capture instead of dispatch ──
      if (storeState.isLearning) {
        const captured = tryLearnCapture(key)
        if (captured) {
          e.preventDefault()
          runtime.lastConsumed = true
          return
        }
        // Forge layer is sovereign — DO NOT fire show actions while learning.
        // (R2: Layer `forge` never dispatches show actions.)
        runtime.lastConsumed = false
        return
      }

      // ── CHORD DETECTION ──
      const chord = matchChord(
        key,
        runtime.heldKeys,
        runtime.downTimes,
        activeLayer,
        getChordsSnapshot(),
        now,
      )

      if (chord !== null) {
        // Suppress the individual actions of every chord participant.
        // (Other participants already pressed; mark them so their keyup
        //  release-phase is skipped for tap behaviors.)
        for (const k of chord.keys) runtime.chordSuppressed.add(k)

        // Dispatch the chord with `press` phase semantics.
        const dispatched = dispatchAction(chord.actionId, {
          source:    'keyforge',
          intensity: 1.0,
          modifiers: mods,
          phase:     'press',
        })

        if (dispatched) {
          e.preventDefault()
          runtime.lastConsumed = true
          return
        }
      }

      // ── BINDING LOOKUP ──
      const binding = getBindingSnapshot(activeLayer, key)
      if (binding === undefined) {
        runtime.lastConsumed = false
        return
      }

      // Required-modifier filter
      if (binding.requiredMods !== undefined) {
        const req = binding.requiredMods
        if (req.shift !== undefined && req.shift !== mods.shift) { runtime.lastConsumed = false; return }
        if (req.ctrl  !== undefined && req.ctrl  !== mods.ctrl ) { runtime.lastConsumed = false; return }
        if (req.alt   !== undefined && req.alt   !== mods.alt  ) { runtime.lastConsumed = false; return }
        if (req.meta  !== undefined && req.meta  !== mods.meta ) { runtime.lastConsumed = false; return }
      }

      const consumed = executePress(binding, mods, runtime)
      runtime.lastConsumed = consumed

      // Prevent default ONLY when we actually consumed the key.
      // This keeps keys we don't handle (e.g. browser DevTools shortcuts)
      // working as expected.
      if (consumed) e.preventDefault()
    }

    // ─────────────────────────── KEYUP ───────────────────────────
    const onKeyUp = (e: KeyboardEvent): void => {
      const key = normalizeKeyCode(e)
      if (key === null) return

      // Even if focus moved to an editable mid-hold, we MUST release tracking.
      // Otherwise a stuck key state will linger forever.
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const tStart = runtime.downTimes.get(key) ?? now
      runtime.heldKeys.delete(key)
      runtime.downTimes.delete(key)

      // If this key was suppressed because it joined a chord, skip release dispatch.
      const wasChordSuppressed = runtime.chordSuppressed.delete(key)

      // Update layer (release of S/K/modifier may drop us back to `base`).
      const storeState = useKeyMapStore.getState()
      const mods = captureModifiers(e)
      const activeLayer = resolveActiveLayer(runtime.heldKeys, mods, storeState.isLearning)
      if (activeLayer !== runtime.lastLayer) {
        runtime.lastLayer = activeLayer
        storeState.setLayer(activeLayer)
      }

      // Don't run release logic on the editable-focused path.
      if (!shouldInterceptKey(e, key)) return
      if (storeState.isLearning) return  // forge mode never dispatches show actions
      if (wasChordSuppressed) return

      // Release the binding that was active for this key when pressed.
      // We use the layer that was active AT KEYDOWN; we re-derive a "best
      // effort" by checking both the current layer and the layer the press
      // implicitly used. For Batch 1 we trust the binding under the CURRENT
      // layer; sophisticated keydown-layer memoization lands in Batch 2.
      const binding = getBindingSnapshot(activeLayer, key)
        ?? getBindingSnapshot(runtime.lastLayer, key)
      if (binding === undefined) return

      executeRelease(binding, mods, runtime, tStart, now)
    }

    // ─────────────────────────── BLUR ───────────────────────────
    const onBlur = (): void => {
      // Alt+Tab, lost focus → release every held key to avoid stuck-key state.
      runtime.heldKeys.clear()
      runtime.downTimes.clear()
      runtime.chordSuppressed.clear()
      for (const t of runtime.repeatTimers.values()) clearInterval(t)
      runtime.repeatTimers.clear()
      runtime.lastConsumed = false

      const storeState = useKeyMapStore.getState()
      const baseLayer: LayerId = storeState.isLearning ? 'forge' : 'base'
      if (runtime.lastLayer !== baseLayer) {
        runtime.lastLayer = baseLayer
        storeState.setLayer(baseLayer)
      }
    }

    // ─────────────────── INIT layer reset on mount ───────────────────
    {
      const storeState = useKeyMapStore.getState()
      const initial = resolveActiveLayer(runtime.heldKeys, EMPTY_MODIFIERS, storeState.isLearning)
      runtime.lastLayer = initial
      if (storeState.currentLayer !== initial) storeState.setLayer(initial)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    console.log('[KeyForge] 🧠 Cortex armed — listening on window keydown/keyup/blur.')

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      // Tear down any in-flight repeat timers.
      for (const t of runtime.repeatTimers.values()) clearInterval(t)
      runtime.repeatTimers.clear()
      runtime.heldKeys.clear()
      runtime.downTimes.clear()
      runtime.chordSuppressed.clear()
      console.log('[KeyForge] 🧠 Cortex disarmed.')
    }
  }, [])
}
