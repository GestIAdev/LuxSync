/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-B: KEYFORGE — KEY CODE NORMALIZATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Maps the raw `KeyboardEvent.code` to a normalized `KeyCode`.
 *
 * RATIONALE — Why `e.code` and not `e.key`?
 *   `e.key` is affected by the OS keyboard layout. On AZERTY, the physical
 *   `W` key produces `'z'` as its `e.key`. On QWERTZ, `Y` and `Z` swap. This
 *   would make `WASD` pan/tilt broken for half of Europe.
 *
 *   `e.code` is the PHYSICAL key position (USB HID-based), identical
 *   across all layouts. `KeyW` always means the physical W key.
 *
 * @module keyforge/normalizeKeyCode
 * @version WAVE 4800-B
 */

import type { KeyCode } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING TABLES
// ═══════════════════════════════════════════════════════════════════════════

/** Modifier-side normalization (KeyboardEvent.code → bare modifier name). */
const MODIFIER_MAP: Readonly<Record<string, KeyCode>> = {
  ShiftLeft:    'Shift',
  ShiftRight:   'Shift',
  ControlLeft:  'Control',
  ControlRight: 'Control',
  AltLeft:      'Alt',
  AltRight:     'Alt',
  MetaLeft:     'Meta',
  MetaRight:    'Meta',
  OSLeft:       'Meta',
  OSRight:      'Meta',
}

/** Punctuation / symbol normalization. */
const PUNCT_MAP: Readonly<Record<string, KeyCode>> = {
  Space:        'Space',
  Enter:        'Enter',
  NumpadEnter:  'Enter',
  Tab:          'Tab',
  Escape:       'Escape',
  Backspace:    'Backspace',
  Delete:       'Delete',
  Insert:       'Insert',
  CapsLock:     'CapsLock',
  Backquote:    'Backquote',
  Minus:        'Minus',
  Equal:        'Equal',
  BracketLeft:  'BracketLeft',
  BracketRight: 'BracketRight',
  Backslash:    'Backslash',
  Semicolon:    'Semicolon',
  Quote:        'Quote',
  Comma:        'Comma',
  Period:       'Period',
  Slash:        'Slash',
  ArrowUp:      'ArrowUp',
  ArrowDown:    'ArrowDown',
  ArrowLeft:    'ArrowLeft',
  ArrowRight:   'ArrowRight',
  Home:         'Home',
  End:          'End',
  PageUp:       'PageUp',
  PageDown:     'PageDown',
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize a `KeyboardEvent` to a `KeyCode`.
 *
 * Strategy:
 *   1. Modifier? → bare name (`ShiftLeft` → `'Shift'`).
 *   2. `KeyX`    → letter (`KeyW` → `'W'`).
 *   3. `DigitX`  → digit (`Digit1` → `'1'`).
 *   4. `FX`      → function key (`F2` → `'F2'`).
 *   5. Punctuation map.
 *   6. Fallback: return raw `code` (forward-compat).
 *
 * Returns `null` if `event.code` is missing or empty (defensive).
 */
export function normalizeKeyCode(event: KeyboardEvent): KeyCode | null {
  const code = event.code
  if (!code) return null

  // 1. Modifiers
  const mod = MODIFIER_MAP[code]
  if (mod) return mod

  // 2. Letters: KeyA..KeyZ → 'A'..'Z'
  if (code.length === 4 && code.startsWith('Key')) {
    return code.charAt(3) as KeyCode
  }

  // 3. Digits: Digit0..Digit9 → '0'..'9' (top row only — Numpad routed separately)
  if (code.length === 6 && code.startsWith('Digit')) {
    return code.charAt(5) as KeyCode
  }

  // 4. Function keys F1..F12: code already in canonical form
  if (code.length >= 2 && code.length <= 3 && code.charAt(0) === 'F') {
    const rest = code.slice(1)
    if (/^([1-9]|1[0-2])$/.test(rest)) {
      return code as KeyCode
    }
  }

  // 5. Punctuation / navigation / control
  const punct = PUNCT_MAP[code]
  if (punct) return punct

  // 6. Fallback — forward-compat (Numpad*, MediaPlayPause, etc.)
  return code as KeyCode
}

/**
 * Pure variant for unit testing — accepts a raw code string.
 */
export function normalizeKeyCodeString(code: string): KeyCode | null {
  if (!code) return null
  // Reuse the same logic via a synthetic minimal event
  return normalizeKeyCode({ code } as KeyboardEvent)
}

/**
 * Capture the modifier state from a `KeyboardEvent`.
 * Mirrors the `ModifierState` shape from `types.ts`.
 */
export function captureModifiers(event: KeyboardEvent): {
  readonly shift: boolean
  readonly ctrl:  boolean
  readonly alt:   boolean
  readonly meta:  boolean
} {
  return {
    shift: event.shiftKey,
    ctrl:  event.ctrlKey,
    alt:   event.altKey,
    meta:  event.metaKey,
  }
}
