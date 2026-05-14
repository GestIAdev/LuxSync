/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4800-F: KEYFORGE — STADIUM DEFAULT LOADOUT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The `stadium-default` pre-baked loadout. Loaded on first launch when
 * `keyMapStore.bindings` is empty (fresh install or cleared store).
 *
 * Philosophy: An operator at a stadium show should be able to DROP
 * (Space), fire STROBE (F), recall GROUP 1-9 (1-9), and navigate movers
 * (K+Shift+WASD) WITHOUT configuring anything.
 *
 * Call `initStadiumLoadoutIfEmpty()` once at app boot (AppCommander.tsx).
 * It is idempotent: a no-op if any binding already exists.
 *
 * @module keyforge/stadiumLoadout
 * @version WAVE 4800-F
 */

import { useKeyMapStore } from '../stores/keyMapStore'
import type { KeyBinding, ChordBinding } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// LOADOUT DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

const STADIUM_BINDINGS: readonly KeyBinding[] = [
  // ── DROPS & PANIC ────────────────────────────────────────────────────────
  { layer: 'base', key: 'Space', actionId: 'arb-blackout',    behavior: { kind: 'tap' } },
  { layer: 'base', key: 'Slash', actionId: 'arb-kill-effects', behavior: { kind: 'tap' } },

  // ── GROUPS 1-9 ───────────────────────────────────────────────────────────
  { layer: 'base', key: '1', actionId: 'sel-group-1', behavior: { kind: 'tap' } },
  { layer: 'base', key: '2', actionId: 'sel-group-2', behavior: { kind: 'tap' } },
  { layer: 'base', key: '3', actionId: 'sel-group-3', behavior: { kind: 'tap' } },
  { layer: 'base', key: '4', actionId: 'sel-group-4', behavior: { kind: 'tap' } },
  { layer: 'base', key: '5', actionId: 'sel-group-5', behavior: { kind: 'tap' } },
  { layer: 'base', key: '6', actionId: 'sel-group-6', behavior: { kind: 'tap' } },
  { layer: 'base', key: '7', actionId: 'sel-group-7', behavior: { kind: 'tap' } },
  { layer: 'base', key: '8', actionId: 'sel-group-8', behavior: { kind: 'tap' } },
  { layer: 'base', key: '9', actionId: 'sel-group-9', behavior: { kind: 'tap' } },
  { layer: 'base', key: '0', actionId: 'sel-all',     behavior: { kind: 'tap' } },

  // ── SELECT LAYER: additive group pick (Shift + held-S + digit) ────────────
  // (S as pivot is handled by LayerResolver; below are the digit bindings
  //  IN the `select` layer so they coexist without Shift confusion.)
  { layer: 'select', key: '1', actionId: 'sel-group-1', behavior: { kind: 'tap' } },
  { layer: 'select', key: '2', actionId: 'sel-group-2', behavior: { kind: 'tap' } },
  { layer: 'select', key: '3', actionId: 'sel-group-3', behavior: { kind: 'tap' } },
  { layer: 'select', key: '4', actionId: 'sel-group-4', behavior: { kind: 'tap' } },
  { layer: 'select', key: '5', actionId: 'sel-group-5', behavior: { kind: 'tap' } },
  { layer: 'select', key: '6', actionId: 'sel-group-6', behavior: { kind: 'tap' } },
  { layer: 'select', key: '7', actionId: 'sel-group-7', behavior: { kind: 'tap' } },
  { layer: 'select', key: '8', actionId: 'sel-group-8', behavior: { kind: 'tap' } },
  { layer: 'select', key: '9', actionId: 'sel-group-9', behavior: { kind: 'tap' } },
  { layer: 'select', key: 'A', actionId: 'sel-all',     behavior: { kind: 'tap' } },
  { layer: 'select', key: 'I', actionId: 'sel-invert',  behavior: { kind: 'tap' } },
  { layer: 'select', key: 'Backquote', actionId: 'sel-clear', behavior: { kind: 'tap' } },

  // ── EFFECTS — BASE LAYER ─────────────────────────────────────────────────
  { layer: 'base', key: 'F', actionId: 'fx-strobe_storm',    behavior: { kind: 'hold' } },
  { layer: 'base', key: 'G', actionId: 'cue-go',             behavior: { kind: 'tap'  } },
  { layer: 'base', key: 'H', actionId: 'arb-freeze-frame',   behavior: { kind: 'toggle' } },
  { layer: 'base', key: 'N', actionId: 'fx-oro_solido',      behavior: { kind: 'tap'  } },
  { layer: 'base', key: 'B', actionId: 'tung-petal-l',       behavior: { kind: 'charge', thresholdMs: 600, chargedActionId: 'tung-nuke-all' } },
  { layer: 'base', key: 'D', actionId: 'arb-blackout',       behavior: { kind: 'hold' } },

  // ── GRAND MASTER NUDGE ───────────────────────────────────────────────────
  { layer: 'base', key: 'Q', actionId: 'ctrl-intensity', behavior: { kind: 'repeat', periodMs: 80 } },
  { layer: 'base', key: 'E', actionId: 'ctrl-intensity', behavior: { kind: 'repeat', periodMs: 80 } },

  // ── VIBE CYCLE ───────────────────────────────────────────────────────────
  { layer: 'base', key: 'V', actionId: 'vibe-fiesta-latina', behavior: { kind: 'tap' } },
  { layer: 'base', key: 'C', actionId: 'vibe-techno-club',   behavior: { kind: 'tap' } },

  // ── TEMPO ────────────────────────────────────────────────────────────────
  { layer: 'base', key: 'M',      actionId: 'ctrl-tap-tempo',       behavior: { kind: 'tap' } },
  { layer: 'base', key: 'Comma',  actionId: 'ctrl-tempo-nudge-down', behavior: { kind: 'repeat', periodMs: 100 } },
  { layer: 'base', key: 'Period', actionId: 'ctrl-tempo-nudge-up',   behavior: { kind: 'repeat', periodMs: 100 } },

  // ── AI SELENE ────────────────────────────────────────────────────────────
  { layer: 'base', key: 'Y', actionId: 'ctrl-ai-toggle', behavior: { kind: 'toggle' } },

  // ── KINETIC LAYER — WASD pan/tilt (K+Shift activates kinetic layer) ───────
  { layer: 'kinetic', key: 'W', actionId: 'kin-tilt-up',    behavior: { kind: 'repeat', periodMs: 60 } },
  { layer: 'kinetic', key: 'S', actionId: 'kin-tilt-down',  behavior: { kind: 'repeat', periodMs: 60 } },
  { layer: 'kinetic', key: 'A', actionId: 'kin-pan-left',   behavior: { kind: 'repeat', periodMs: 60 } },
  { layer: 'kinetic', key: 'D', actionId: 'kin-pan-right',  behavior: { kind: 'repeat', periodMs: 60 } },
  { layer: 'kinetic', key: 'R', actionId: 'kin-home',       behavior: { kind: 'tap'    } },
  { layer: 'kinetic', key: 'Q', actionId: 'kin-speed-down', behavior: { kind: 'repeat', periodMs: 80 } },
  { layer: 'kinetic', key: 'E', actionId: 'kin-speed-up',   behavior: { kind: 'repeat', periodMs: 80 } },

  // ── ALT LAYER — vibes + signature effects ─────────────────────────────────
  { layer: 'alt', key: '1', actionId: 'vibe-fiesta-latina', behavior: { kind: 'tap' } },
  { layer: 'alt', key: '2', actionId: 'vibe-techno-club',   behavior: { kind: 'tap' } },
  { layer: 'alt', key: '3', actionId: 'vibe-pop-rock',      behavior: { kind: 'tap' } },
  { layer: 'alt', key: '4', actionId: 'vibe-chill-lounge',  behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'Q', actionId: 'fx-deep_breath',     behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'W', actionId: 'fx-ghost_breath',    behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'E', actionId: 'fx-digital_rain',    behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'R', actionId: 'fx-cyber_dualism',   behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'T', actionId: 'fx-tidal_wave',      behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'Y', actionId: 'fx-sky_saw',         behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'U', actionId: 'fx-solar_flare',     behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'A', actionId: 'fx-core_meltdown',   behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'S', actionId: 'fx-strobe_burst',    behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'D', actionId: 'fx-neon_blinder',    behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'F', actionId: 'fx-gatling_raid',    behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'G', actionId: 'fx-oro_solido',      behavior: { kind: 'tap' } },
  { layer: 'alt', key: 'Space', actionId: 'fx-latina_meltdown', behavior: { kind: 'tap' } },
]

const STADIUM_CHORDS: readonly ChordBinding[] = [
  // 1 + F → strobe only on group 1 (scope not yet implemented; fires group
  // select silently before strobe — Batch 3 will scope via IPC)
  {
    chordId:  'chord-group1-strobe',
    keys:     ['1', 'F'],
    layer:    'base',
    actionId: 'fx-strobe_storm',
    behavior: { kind: 'hold' },
  },
  {
    chordId:  'chord-group2-strobe',
    keys:     ['2', 'F'],
    layer:    'base',
    actionId: 'fx-strobe_storm',
    behavior: { kind: 'hold' },
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Populate `keyMapStore` with the `stadium-default` loadout.
 *
 * Idempotent: does nothing if any user binding already exists (respects
 * customizations made between sessions).
 */
export function initStadiumLoadoutIfEmpty(): void {
  const state = useKeyMapStore.getState()
  if (Object.keys(state.bindings).length > 0) {
    console.log('[KeyForge] ⌨ Stadium loadout skipped — user bindings present.')
    return
  }

  console.log('[KeyForge] ⌨ Loading stadium-default loadout…')
  for (const binding of STADIUM_BINDINGS) {
    state.bindKey(binding)
  }
  for (const chord of STADIUM_CHORDS) {
    state.bindChord(chord)
  }
  console.log(
    `[KeyForge] ✅ Stadium loadout applied: ${STADIUM_BINDINGS.length} bindings, `
    + `${STADIUM_CHORDS.length} chords.`,
  )
}

/** Expose the raw loadout arrays (for tests and the overlay's reset button). */
export const STADIUM_DEFAULT_BINDINGS = STADIUM_BINDINGS
export const STADIUM_DEFAULT_CHORDS   = STADIUM_CHORDS
