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
/** Set of `KeyCode` values that represent pure modifier keys (never bindable). */
export const MODIFIER_KEYS = new Set([
    'Shift', 'Control', 'Alt', 'Meta',
]);
/** Ordered list of all layers (for iteration / UI rendering). */
export const ALL_LAYERS = [
    'base', 'alt', 'cmd', 'select', 'kinetic', 'forge',
];
export const EMPTY_MODIFIERS = Object.freeze({
    shift: false, ctrl: false, alt: false, meta: false,
});
/** Default tap window (ms) — keys held longer than this are NOT taps. */
export const DEFAULT_TAP_MAX_MS = 250;
/** Chord detection window (ms) — gap between key downs for chord eligibility. */
export const CHORD_WINDOW_MS = 150;
/** Default payload for a clean keyboard tap. */
export const DEFAULT_KEY_PAYLOAD = Object.freeze({
    source: 'keyforge',
    intensity: 1.0,
    phase: 'press',
});
// ═══════════════════════════════════════════════════════════════════════════
// STORAGE KEY — Internal helper
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Compose the storage key for the bindings dictionary.
 * `bindings[bindingKey(layer, key)] = KeyBinding`
 */
export function bindingKey(layer, key) {
    return `${layer}::${key}`;
}
/** Parse a storage key back into (layer, key). Throws on malformed input. */
export function parseBindingKey(storageKey) {
    const idx = storageKey.indexOf('::');
    if (idx < 0) {
        throw new Error(`[KeyForge] Malformed bindingKey: ${storageKey}`);
    }
    return {
        layer: storageKey.slice(0, idx),
        key: storageKey.slice(idx + 2),
    };
}
