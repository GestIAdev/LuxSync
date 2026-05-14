/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-B: KEYFORGE — LAYER RESOLVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Resolves the ACTIVE LAYER from the current held-key set.
 *
 * Resolution priority (highest wins):
 *   1. forge   — toggle (F2); supersedes everything when active
 *   2. kinetic — hold K + Shift (double-pivot to avoid accidental triggers)
 *   3. select  — hold S together with at least one other key
 *   4. cmd     — hold Control or Meta
 *   5. alt     — hold Alt
 *   6. base    — fallback (default)
 *
 * Design notes:
 *  - `kinetic` requires K+Shift (NOT bare K) because K is a common typing key.
 *  - `select` requires S held WITH another key — bare S tap is a regular key.
 *  - `forge` is NOT derived from held keys: it's a UI toggle controlled by
 *    `keyMapStore.toggleLearnMode()` and passed as a parameter.
 *
 * @module keyforge/layerResolver
 * @version WAVE 4800-B
 */

import type { KeyCode, LayerId, ModifierState } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve the active layer.
 *
 * @param held       - set of physical keys currently held down (includes modifiers)
 * @param mods       - modifier snapshot (redundant with `held`, but cheaper to read)
 * @param forgeMode  - whether KeyForge Learn / Forge mode is toggled on
 * @returns the active LayerId
 */
export function resolveActiveLayer(
  held: ReadonlySet<KeyCode>,
  mods: ModifierState,
  forgeMode: boolean,
): LayerId {
  // 1. Forge mode is sovereign (editor mode — actions are not fired)
  if (forgeMode) return 'forge'

  // 2. Kinetic — K + Shift (double pivot)
  if (held.has('K') && mods.shift) return 'kinetic'

  // 3. Select — S held alongside at least one other non-modifier key
  if (held.has('S') && hasNonModifierCompanion(held, 'S')) return 'select'

  // 4. Cmd — Control or Meta (Windows/Cmd key)
  if (mods.ctrl || mods.meta) return 'cmd'

  // 5. Alt
  if (mods.alt) return 'alt'

  // 6. Base
  return 'base'
}

/**
 * Returns true if `held` contains at least one non-modifier key OTHER than `pivot`.
 * This prevents `select` activating on bare `S` keypress.
 */
function hasNonModifierCompanion(held: ReadonlySet<KeyCode>, pivot: KeyCode): boolean {
  for (const k of held) {
    if (k === pivot) continue
    if (k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') continue
    return true
  }
  return false
}

/**
 * Predicate: is this key a "pivot" key that, when held, opens a layer?
 * Useful for the overlay to highlight pivots visually.
 */
export function isPivotKey(key: KeyCode): boolean {
  return key === 'K' || key === 'S'
}

/**
 * Predicate: does this layer require modifiers to be active?
 * Helps the dispatcher decide whether to filter `requiredMods` on bindings.
 */
export function layerRequiresModifier(layer: LayerId): boolean {
  return layer === 'cmd' || layer === 'alt' || layer === 'kinetic'
}
