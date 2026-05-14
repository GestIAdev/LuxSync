/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-B: KEYFORGE — CAPTURE GUARD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Decides whether KeyForge should intercept a `keydown`/`keyup` event or let
 * it pass through to its native target (input, textarea, contenteditable, etc).
 *
 * Defensive rings (in order of evaluation):
 *
 *   Ring 0 — IME composition (e.isComposing / keyCode 229):
 *            Asian input methods are mid-typing → never intercept.
 *
 *   Ring 1 — Tag-based editable element (`<input>`, `<textarea>`, `<select>`):
 *            User is typing. Cannot intercept.
 *
 *   Ring 2 — `contenteditable` attribute (rich text, code mirrors, …).
 *
 *   Ring 3 — Opt-out via `[data-keyforge-bypass="true"]` ancestor:
 *            Panel-level escape hatch (e.g. timecode editor in Cue Sheet).
 *
 *   Ring 4 — Opt-in via `[data-keyforge-claim="true"]` ancestor:
 *            OVERRIDE — even if an editable is inside, the container reclaims
 *            keyboard control (e.g. TheProgrammer wants WASD even with a
 *            search input present).
 *
 *   Ring 5 — Whitelist of ALWAYS-INTERCEPT keys:
 *            `Escape` and `F1` are universal escapes; they must reach KeyForge
 *            regardless of focus (R1 from the Blueprint Safety Section).
 *
 * @module keyforge/captureGuard
 * @version WAVE 4800-B
 */

import type { KeyCode } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const EDITABLE_TAGS: ReadonlySet<string> = new Set([
  'INPUT', 'TEXTAREA', 'SELECT',
])

/** Keys that are ALWAYS intercepted, even inside `<input>`. (R1) */
const ALWAYS_INTERCEPT: ReadonlySet<KeyCode> = new Set<KeyCode>([
  'Escape',
  'F1',
])

const ATTR_BYPASS = 'data-keyforge-bypass'
const ATTR_CLAIM  = 'data-keyforge-claim'

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decide whether KeyForge should intercept this event.
 *
 * @param event - the raw KeyboardEvent
 * @param normalizedKey - the normalized KeyCode (for the always-intercept check)
 * @returns true → KeyForge handles it (and may `preventDefault`).
 *          false → let the browser / focused element handle it.
 */
export function shouldInterceptKey(
  event: KeyboardEvent,
  normalizedKey: KeyCode | null,
): boolean {
  // Ring 0 — IME composition
  if (event.isComposing) return false
  // Some browsers (Safari historical) flag IME with keyCode 229
  // KeyboardEvent.keyCode is deprecated but still populated.
  if ((event as KeyboardEvent & { keyCode: number }).keyCode === 229) return false

  // Ring 5 — Always-intercept whitelist (highest priority above editables)
  if (normalizedKey !== null && ALWAYS_INTERCEPT.has(normalizedKey)) {
    return true
  }

  const target = event.target
  if (!(target instanceof HTMLElement)) {
    // Non-element target (e.g. window) — safe to intercept
    return true
  }

  // Ring 4 — Explicit claim overrides anything below
  if (target.closest(`[${ATTR_CLAIM}="true"]`) !== null) {
    return true
  }

  // Ring 3 — Explicit bypass
  if (target.closest(`[${ATTR_BYPASS}="true"]`) !== null) {
    return false
  }

  // Ring 1 — Structural editable tags
  if (EDITABLE_TAGS.has(target.tagName)) return false

  // Ring 2 — contenteditable
  if (target.isContentEditable) return false

  return true
}

/**
 * Lightweight variant — checks ONLY the focus context (no event).
 * Useful for store-level guards that need to consult focus without a
 * fresh event in hand.
 */
export function isFocusInEditable(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  if (EDITABLE_TAGS.has(el.tagName)) return true
  if (el.isContentEditable) return true
  return false
}
