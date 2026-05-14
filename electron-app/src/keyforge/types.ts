/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-A: KEYFORGE — CORE TYPES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for KeyForge type system.
 *
 * Pillars:
 *  - `KeyCode`     : layout-independent physical key (derived from `KeyboardEvent.code`).
 *  - `LayerId`     : modal page of the keyboard (base / alt / cmd / select / kinetic / forge).
 *  - `KeyBinding`  : the contract of what a key does in a given layer.
 *  - `ChordBinding`: simultaneous combo (Tekken-style — order independent within window).
 *  - `KeyBehavior` : temporal behavior of a key (tap, hold, toggle, charge, repeat, momentary).
 *
 * @module keyforge/types
 * @version WAVE 4800-A
 */

import type { MidiActionMeta } from '../midi/MidiActionRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// KEYCODE — Layout-independent physical key
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KeyCode is a normalized physical key identifier derived from
 * `KeyboardEvent.code` (NOT `KeyboardEvent.key`, which is layout-dependent).
 *
 * Examples of normalization:
 *   'KeyA'    → 'A'
 *   'Digit1'  → '1'
 *   'Space'   → 'Space'
 *   'F2'      → 'F2'
 *
 * The `(string & {})` escape hatch preserves the union autocomplete while
 * allowing forward-compat for keys we have not enumerated yet (e.g. numpad,
 * media keys). Consumers MUST treat unknown values as "unbindable".
 */
export type KeyCode =
  // Letters
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  // Digits
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  // Function keys
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6'
  | 'F7' | 'F8' | 'F9' | 'F10' | 'F11' | 'F12'
  // Navigation
  | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
  | 'Home' | 'End' | 'PageUp' | 'PageDown'
  // Control
  | 'Space' | 'Enter' | 'Tab' | 'Escape' | 'Backspace' | 'Delete' | 'Insert'
  // Modifiers (tracked physically but never bound as actions)
  | 'Shift' | 'Control' | 'Alt' | 'Meta'
  // Punctuation / symbols
  | 'Backquote' | 'Minus' | 'Equal'
  | 'BracketLeft' | 'BracketRight' | 'Backslash'
  | 'Semicolon' | 'Quote'
  | 'Comma' | 'Period' | 'Slash'
  | 'CapsLock'
  // Forward-compat escape hatch (preserves union autocomplete)
  | (string & {})

/** Set of `KeyCode` values that represent pure modifier keys (never bindable). */
export const MODIFIER_KEYS: ReadonlySet<KeyCode> = new Set<KeyCode>([
  'Shift', 'Control', 'Alt', 'Meta',
])

// ═══════════════════════════════════════════════════════════════════════════
// LAYER — Modal page of the keyboard
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Layer = "page" of the Command Wing. Changes the meaning of the entire keyboard.
 *
 * Resolution priority (highest first):
 *   forge → kinetic → select → cmd → alt → base
 *
 * Layers `kinetic` and `select` require a pivot key (K+Shift / S+other) instead
 * of a bare modifier, to free Shift/Ctrl/Alt for fine-grained combinatorics.
 * Layer `forge` is a TOGGLE (F2), not a hold.
 */
export type LayerId =
  | 'base'
  | 'alt'
  | 'cmd'
  | 'select'
  | 'kinetic'
  | 'forge'

/** Ordered list of all layers (for iteration / UI rendering). */
export const ALL_LAYERS: readonly LayerId[] = [
  'base', 'alt', 'cmd', 'select', 'kinetic', 'forge',
] as const

// ═══════════════════════════════════════════════════════════════════════════
// MODIFIER STATE
// ═══════════════════════════════════════════════════════════════════════════

/** Snapshot of modifier keys currently held. */
export interface ModifierState {
  readonly shift: boolean
  readonly ctrl:  boolean
  readonly alt:   boolean
  readonly meta:  boolean
}

export const EMPTY_MODIFIERS: ModifierState = Object.freeze({
  shift: false, ctrl: false, alt: false, meta: false,
})

// ═══════════════════════════════════════════════════════════════════════════
// KEY BEHAVIOR — Temporal contract of a binding
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Defines how a key behaves over time.
 *
 * - `tap`       : press + release < `tapMaxMs` → fire once on release.
 * - `hold`      : action is "ON" while key is held; release fires nothing.
 * - `toggle`    : press flips a persistent boolean; release ignored.
 * - `momentary` : press fires `actionId`, release fires `releaseActionId` (or noop).
 * - `charge`    : tap (<threshold) fires `actionId`; held (≥threshold) fires
 *                 `chargedActionId` (or `actionId` with intensity = chargeRatio).
 * - `repeat`    : while key is held, fire `actionId` every `periodMs`.
 */
export type KeyBehavior =
  | { readonly kind: 'tap'; readonly tapMaxMs?: number }
  | { readonly kind: 'hold' }
  | { readonly kind: 'toggle' }
  | { readonly kind: 'momentary'; readonly releaseActionId?: string }
  | {
      readonly kind: 'charge'
      readonly thresholdMs: number
      readonly chargedActionId?: string
    }
  | { readonly kind: 'repeat'; readonly periodMs: number }

/** Default tap window (ms) — keys held longer than this are NOT taps. */
export const DEFAULT_TAP_MAX_MS = 250

/** Chord detection window (ms) — gap between key downs for chord eligibility. */
export const CHORD_WINDOW_MS = 150

// ═══════════════════════════════════════════════════════════════════════════
// BINDINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KeyBinding: what a single key does in a given layer.
 *
 * `actionId` MUST be a known ID from the `MidiActionRegistry` catalog
 * (`fx-*`, `vibe-*`, `arb-*`, `ctrl-*`, `flow-*`, `tung-*`) OR a KeyForge-native
 * action prefix (`sel-*` selection ops, `kin-*` kinetic ops, `ui-*` UI ops,
 * `cue-*` cue transport, `kf-*` KeyForge meta).
 *
 * Resolution against the registry happens at dispatch time
 * (`KeyActionDispatcher.resolve`).
 */
export interface KeyBinding {
  readonly key:           KeyCode
  readonly layer:         LayerId
  readonly actionId:      string
  readonly behavior:      KeyBehavior
  /** Modifiers that MUST be held in addition to the layer requirements. */
  readonly requiredMods?: Partial<ModifierState>
  /** Optional human-readable label override (defaults to action label). */
  readonly label?:        string
}

/**
 * ChordBinding: 2-4 keys held simultaneously fire a unified action.
 *
 * Detection rule (see `chordMatcher.ts`):
 *   When the LAST key of `keys` is pressed, if ALL other keys in `keys` are
 *   currently held AND the gap between their respective keydowns is within
 *   `CHORD_WINDOW_MS`, the chord fires INSTEAD OF the individual keys' actions.
 *
 * Use case: `1 + F` → strobe scoped to group 1 without modifying selection.
 */
export interface ChordBinding {
  readonly chordId:  string
  readonly keys:     readonly KeyCode[]
  readonly layer:    LayerId
  readonly actionId: string
  readonly behavior: KeyBehavior
  readonly label?:   string
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION PAYLOAD — What the dispatcher receives
// ═══════════════════════════════════════════════════════════════════════════

/** Source of an action dispatch (for telemetry + scope routing). */
export type ActionSource = 'midi' | 'keyforge' | 'cue' | 'osc' | 'mqtt' | 'ipc'

/**
 * Payload accompanying every dispatched action.
 *
 * `intensity` is 0..1 normalized:
 *   - MIDI CC      → value / 127
 *   - MIDI velocity → fixed 1.0 (anti-Piano-Syndrome, per WAVE 3303)
 *   - keyboard tap → 1.0
 *   - keyboard charge → chargeRatio (held duration / threshold, clamped 0..1)
 *   - keyboard repeat → 1.0 per tick
 */
export interface ActionPayload {
  readonly source:     ActionSource
  readonly intensity:  number
  readonly modifiers?: ModifierState
  /** Phase of the action — relevant for hold/momentary/charge. */
  readonly phase?:     'press' | 'release' | 'repeat'
}

/** Default payload for a clean keyboard tap. */
export const DEFAULT_KEY_PAYLOAD: ActionPayload = Object.freeze({
  source:    'keyforge',
  intensity: 1.0,
  phase:     'press',
})

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH RESULT
// ═══════════════════════════════════════════════════════════════════════════

/** Outcome of resolving an actionId against the registry. */
export interface ResolvedAction {
  readonly actionId: string
  readonly meta:     MidiActionMeta | null  // null = KeyForge-native action
  readonly known:    boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE KEY — Internal helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compose the storage key for the bindings dictionary.
 * `bindings[bindingKey(layer, key)] = KeyBinding`
 */
export function bindingKey(layer: LayerId, key: KeyCode): string {
  return `${layer}::${key}`
}

/** Parse a storage key back into (layer, key). Throws on malformed input. */
export function parseBindingKey(storageKey: string): { layer: LayerId; key: KeyCode } {
  const idx = storageKey.indexOf('::')
  if (idx < 0) {
    throw new Error(`[KeyForge] Malformed bindingKey: ${storageKey}`)
  }
  return {
    layer: storageKey.slice(0, idx) as LayerId,
    key:   storageKey.slice(idx + 2) as KeyCode,
  }
}
