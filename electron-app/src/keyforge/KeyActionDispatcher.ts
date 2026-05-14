/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-C: KEYFORGE — KEY ACTION DISPATCHER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The BRIDGE between KeyForge intent and the existing action catalog.
 *
 * Two-stage contract:
 *   1. RESOLVE  — look up the `actionId` in `MidiActionRegistry` (single source
 *                 of truth for fireable actions). Returns `ResolvedAction`.
 *   2. DISPATCH — execute the resolved action via prefix-based routing,
 *                 mirroring the dispatch table already used by `useMidiLearn.ts`.
 *
 * Why a thin wrapper rather than calling `window.lux.*` directly?
 *   - It centralizes the prefix routing in ONE place.
 *   - It allows Batch 1 to ship WITHOUT refactoring `useMidiLearn.ts`
 *     (4800-C in the roadmap was flagged HIGH risk; that refactor will land
 *     when KeyForge is mounted in `AppCommander.tsx`).
 *   - It lets us add KeyForge-native prefixes (`sel-*`, `kin-*`, `kf-*`,
 *     `cue-*`, `ui-*`) without polluting the MIDI hook.
 *
 * IMPORTANT: this module ONLY emits side effects via the public `window.lux.*`
 * IPC surface. It does not import any store directly to keep the dependency
 * graph one-way (stores → dispatcher would be a cycle).
 *
 * @module keyforge/KeyActionDispatcher
 * @version WAVE 4800-C
 */

import {
  type MidiActionMeta,
  findAction,
  isKnownAction,
} from '../midi/MidiActionRegistry'
import { useSelectionStore } from '../stores/selectionStore'
import { useMovementStore } from '../stores/movementStore'
import type {
  ActionPayload,
  ResolvedAction,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// LUX BRIDGE TYPING (loose — mirrors what exists in production)
// ═══════════════════════════════════════════════════════════════════════════
//
// `window.lux` is exposed by the Electron preload script. The full type lives
// in `vite-env.d.ts`. We re-declare a STRUCTURAL subset here for the calls
// this dispatcher needs — keeps this module type-safe without coupling to
// the global ambient declaration.

interface LuxBridgeAetherSubset {
  setBlackout?: (active: boolean) => Promise<{ success?: boolean; blackoutActive?: boolean }>
  setGrandMaster?: (value: number) => Promise<unknown>
  fireTungstenNuke?: (args: {
    target: string
    value?: number
    release?: boolean
  }) => Promise<unknown> | void
}

interface LuxBridgeSubset {
  forceStrike?: (args: { effect: string; intensity: number }) => Promise<unknown> | void
  setVibe?: (vibeId: string) => Promise<unknown> | void
  cancelAllEffects?: () => Promise<unknown> | void
  aether?: LuxBridgeAetherSubset
}

function getLuxBridge(): LuxBridgeSubset | null {
  const w = globalThis as unknown as { lux?: LuxBridgeSubset }
  return w.lux ?? null
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYFORGE-NATIVE PREFIXES
// ═══════════════════════════════════════════════════════════════════════════
//
// These prefixes are NOT in the MidiActionRegistry today. They are owned by
// KeyForge and may be wired to backend handlers in later batches. For Batch 1
// they log + no-op so the contract is observable in dev tools.

const KEYFORGE_NATIVE_PREFIXES: readonly string[] = [
  'sel-',   // selection ops (sel-group-1, sel-all, sel-invert…)
  'kin-',   // kinetic ops (kin-pan-left, kin-tilt-up, kin-home…)
  'cue-',   // cue transport (cue-go, cue-prev, cue-next…)
  'ui-',    // UI ops (ui-toggle-live-hud, ui-cycle-tab…)
  'kf-',    // KeyForge meta (kf-toggle-learn, kf-save-loadout…)
] as const

function isKeyForgeNativeAction(actionId: string): boolean {
  for (const p of KEYFORGE_NATIVE_PREFIXES) {
    if (actionId.startsWith(p)) return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve an `actionId` against the unified catalog.
 *
 * Resolution order:
 *   1. MidiActionRegistry — fx-*, vibe-*, arb-*, tung-*, ctrl-*, flow-*, lux-*.
 *   2. KeyForge-native prefix — meta returned as `null` but `known = true`.
 *   3. Unknown → `known = false` (consumers should log + skip).
 */
export function resolveAction(actionId: string): ResolvedAction {
  const meta: MidiActionMeta | undefined = findAction(actionId)
  if (meta !== undefined) {
    return { actionId, meta, known: true }
  }
  if (isKeyForgeNativeAction(actionId)) {
    return { actionId, meta: null, known: true }
  }
  return { actionId, meta: null, known: false }
}

/** Convenience: is this actionId fireable at all (MIDI or KeyForge-native)? */
export function isFireable(actionId: string): boolean {
  return isKnownAction(actionId) || isKeyForgeNativeAction(actionId)
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch a resolved action with a payload.
 *
 * The dispatcher is INERT for unknown actions (logs a warning and returns
 * `false`). It NEVER throws — keyboard input must remain robust against
 * stale loadouts.
 *
 * @returns true if the action was dispatched (or queued via IPC), false if
 *          unknown or filtered.
 */
export function dispatchAction(actionId: string, payload: ActionPayload): boolean {
  const resolved = resolveAction(actionId)
  if (!resolved.known) {
    console.warn(`[KeyForge] ⚠️ Unknown actionId: "${actionId}" — ignoring.`)
    return false
  }

  const lux = getLuxBridge()

  // ── fx-* → forceStrike (effect trigger) ──
  if (actionId.startsWith('fx-')) {
    if (payload.phase === 'release') return true  // only fire on press
    const effectId = actionId.slice(3)
    lux?.forceStrike?.({ effect: effectId, intensity: payload.intensity })
    return true
  }

  // ── vibe-* → setVibe (profile change) ──
  if (actionId.startsWith('vibe-')) {
    if (payload.phase === 'release') return true
    const vibeId = actionId.slice(5)
    lux?.setVibe?.(vibeId)
    return true
  }

  // ── tung-* → Tungsten Golden Nuke (WAVE 4699.2 dialect) ──
  if (actionId.startsWith('tung-')) {
    const sub = actionId.slice(5)
    if (sub === 'spin') {
      // Spin is a fader-style action; intensity is bipolar 0..1
      lux?.aether?.fireTungstenNuke?.({ target: 'spin', value: payload.intensity })
      return true
    }
    const target = sub === 'nuke-all' ? 'all' : sub
    if (payload.phase === 'release') {
      lux?.aether?.fireTungstenNuke?.({ target, release: true })
    } else {
      lux?.aether?.fireTungstenNuke?.({ target, value: payload.intensity })
    }
    return true
  }

  // ── arb-* → Arbiter overrides (blackout, grand master, kill effects) ──
  if (actionId.startsWith('arb-')) {
    if (payload.phase === 'release') return true
    const sub = actionId.slice(4)
    switch (sub) {
      case 'blackout':
        // The caller is expected to read the current blackout state and
        // negate it before calling. Per blueprint R3 (double confirmation
        // <500ms) we keep the dispatcher dumb and let the store add the
        // debounce in a later batch.
        lux?.aether?.setBlackout?.(true).catch(() => {})
        return true
      case 'grand-master':
        lux?.aether?.setGrandMaster?.(payload.intensity)?.catch?.(() => {})
        return true
      case 'kill-effects':
        lux?.cancelAllEffects?.()
        return true
      default:
        console.warn(`[KeyForge] ⚠️ Unknown arb-* action: ${actionId}`)
        return false
    }
  }

  // ── ctrl-* / flow-* / lux-* → reserved for the next batch ──
  // These are continuous controllers in MIDI and require store wiring
  // (ControlStore, LuxSyncStore). We log them so devs can see them firing
  // in Batch 1 without yet executing side effects.
  if (
    actionId.startsWith('ctrl-')
    || actionId.startsWith('flow-')
    || actionId.startsWith('lux-')
  ) {
    console.log(
      `[KeyForge] 🎚️ ${actionId} fired (intensity=${payload.intensity.toFixed(2)}, `
      + `phase=${payload.phase ?? 'press'}) — store wiring pending Batch 2.`,
    )
    return true
  }

  // ── KeyForge-native (sel-*, kin-*, cue-*, ui-*, kf-*) ──
  if (isKeyForgeNativeAction(actionId)) {
    console.log(
      `[KeyForge] 🧠 native action: ${actionId} `
      + `(intensity=${payload.intensity.toFixed(2)}, phase=${payload.phase ?? 'press'}) — `
      + `handler wiring pending Batch 2/3.`,
    )
    return true
  }

  // Unreachable — resolved.known guards us, but TS wants exhaustiveness.
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG REFLECTION (re-export for symmetry with WAVE 2047 ergonomics)
// ═══════════════════════════════════════════════════════════════════════════

export { findAction, isKnownAction } from '../midi/MidiActionRegistry'
export {
  getAllActions,
  getSystemActions,
  getEffectsByZone,
  getVibeActions,
  getArbiterActions,
  getTungstenActions,
} from '../midi/MidiActionRegistry'
