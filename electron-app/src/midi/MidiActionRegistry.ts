/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 WAVE 3300: MIDI ACTION REGISTRY — THE BRIDGE CATALOG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for every action that can be MIDI-mapped.
 * Builds a categorized catalog from known effect IDs, vibe profiles,
 * and arbiter overrides.
 *
 * ARCHITECTURE:
 * - Runs in RENDERER process (no access to EffectManager singleton)
 * - Effect IDs are embedded at build time (they only change with code)
 * - Grouped by energy zone via EFFECT_ZONE_MAP mirror
 * - Consumed by MidiLearnOverlay for categorized display
 * - Consumed by useMidiLearn for prefix-based dispatch routing
 *
 * @module midi/MidiActionRegistry
 * @version WAVE 3300
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type EnergyZone = 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'

export interface MidiActionMeta {
  /** Unique ID — prefixed: fx-*, vibe-*, arb-*, ctrl-*, flow-* */
  id: string
  /** Human-readable label */
  label: string
  /** Control type for MIDI learn */
  category: 'fader' | 'button'
  /** Logical group for UI sections */
  group: 'system' | 'effect' | 'vibe' | 'arbiter'
  /** Energy zone (effects only) */
  energyZone?: EnergyZone
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT ZONE MAP (mirror of EffectManager's EFFECT_ZONE_MAP)
// ═══════════════════════════════════════════════════════════════════════════

const EFFECT_ZONE_MAP: Record<string, EnergyZone> = {
  // SILENCE
  'deep_breath': 'silence',
  'sonar_ping': 'silence',
  'solar_caustics': 'silence',
  'surface_shimmer': 'silence',
  'plankton_drift': 'silence',

  // VALLEY
  'void_mist': 'valley',
  'fiber_optics': 'valley',
  'ghost_breath': 'valley',
  'amazon_mist': 'valley',
  'amp_heat': 'valley',
  'whale_song': 'valley',
  'abyssal_jellyfish': 'valley',
  'bioluminescent_spore': 'valley',

  // AMBIENT
  'digital_rain': 'ambient',
  'acid_sweep': 'ambient',
  'cumbia_moon': 'ambient',
  'ghost_chase': 'ambient',
  'arena_sweep': 'ambient',
  'stage_wash': 'ambient',
  'school_of_fish': 'ambient',
  'deep_current_pulse': 'ambient',

  // GENTLE
  'ambient_strobe': 'gentle',
  'binary_glitch': 'gentle',
  'tropical_pulse': 'gentle',
  'salsa_fire': 'gentle',
  'clave_rhythm': 'gentle',

  // ACTIVE
  'cyber_dualism': 'active',
  'seismic_snap': 'active',
  'machete_spark': 'active',
  'glitch_guaguanco': 'active',
  'corazon_latino': 'active',
  'liquid_solo': 'active',
  'spotlight_pulse': 'active',

  // INTENSE
  'sky_saw': 'intense',
  'abyssal_rise': 'intense',
  'tidal_wave': 'intense',
  'strobe_burst': 'intense',
  'industrial_strobe': 'intense',
  'surgical_strike': 'intense',
  'thunder_struck': 'intense',
  'power_chord': 'intense',

  // PEAK
  'gatling_raid': 'peak',
  'core_meltdown': 'peak',
  'neon_blinder': 'peak',
  'strobe_storm': 'peak',
  'solar_flare': 'peak',
  'latina_meltdown': 'peak',
  'oro_solido': 'peak',
  'feedback_storm': 'peak',
}

// ═══════════════════════════════════════════════════════════════════════════
// HUMANIZE HELPER
// ═══════════════════════════════════════════════════════════════════════════

function humanize(snakeCase: string): string {
  return snakeCase
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CONTROLS (the original 7 + flow)
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_CONTROLS: MidiActionMeta[] = [
  { id: 'ctrl-intensity',     label: 'Grand Master',  category: 'fader',  group: 'system' },
  { id: 'ctrl-saturation',    label: 'Saturation',    category: 'fader',  group: 'system' },
  { id: 'flow-speed',         label: 'Flow Speed',    category: 'fader',  group: 'system' },
  { id: 'flow-spread',        label: 'Flow Spread',   category: 'fader',  group: 'system' },
  { id: 'ctrl-output-toggle', label: 'Output ON/OFF', category: 'button', group: 'system' },
  { id: 'ctrl-ai-toggle',     label: 'AI ON/OFF',     category: 'button', group: 'system' },
  { id: 'lux-blackout',       label: 'BLACKOUT',      category: 'button', group: 'system' },
]

// ═══════════════════════════════════════════════════════════════════════════
// VIBE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_CONTROLS: MidiActionMeta[] = [
  { id: 'vibe-fiesta-latina', label: 'Fiesta Latina', category: 'button', group: 'vibe' },
  { id: 'vibe-techno-club',   label: 'Techno Club',   category: 'button', group: 'vibe' },
  { id: 'vibe-pop-rock',      label: 'Pop Rock',      category: 'button', group: 'vibe' },
  { id: 'vibe-chill-lounge',  label: 'Chill Lounge',  category: 'button', group: 'vibe' },
]

// ═══════════════════════════════════════════════════════════════════════════
// ARBITER OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════

const ARBITER_CONTROLS: MidiActionMeta[] = [
  { id: 'arb-blackout',      label: 'Arbiter Blackout',    category: 'button', group: 'arbiter' },
  { id: 'arb-grand-master',  label: 'Arbiter Grand Master', category: 'fader',  group: 'arbiter' },
  { id: 'arb-kill-effects',  label: 'Kill All Effects',    category: 'button', group: 'arbiter' },
]

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT CONTROLS (built from EFFECT_ZONE_MAP)
// ═══════════════════════════════════════════════════════════════════════════

const EFFECT_CONTROLS: MidiActionMeta[] = Object.entries(EFFECT_ZONE_MAP).map(([effectId, zone]) => ({
  id: `fx-${effectId}`,
  label: humanize(effectId),
  category: 'button' as const,
  group: 'effect' as const,
  energyZone: zone,
}))

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DISPLAY ORDER (peak first — the user thinks "dame algo para el DROP")
// ═══════════════════════════════════════════════════════════════════════════

const ZONE_ORDER: EnergyZone[] = ['peak', 'intense', 'active', 'gentle', 'ambient', 'valley', 'silence']

const ZONE_LABELS: Record<EnergyZone, string> = {
  peak:    'PEAK — Drops & Explosions',
  intense: 'INTENSE — Pre-Climax',
  active:  'ACTIVE — Rhythm Established',
  gentle:  'GENTLE — Building Energy',
  ambient: 'AMBIENT — Soft Movement',
  valley:  'VALLEY — Atmospheric Fog',
  silence: 'SILENCE — Deep Breath',
}

const ZONE_EMOJI: Record<EnergyZone, string> = {
  peak:    '💣',
  intense: '☢️',
  active:  '👯',
  gentle:  '⚡',
  ambient: '🌧️',
  valley:  '🌫️',
  silence: '🌑',
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/** Full catalog of all MIDI-mappable actions */
export function getAllActions(): MidiActionMeta[] {
  return [
    ...SYSTEM_CONTROLS,
    ...EFFECT_CONTROLS,
    ...VIBE_CONTROLS,
    ...ARBITER_CONTROLS,
  ]
}

/** System controls only */
export function getSystemActions(): MidiActionMeta[] {
  return SYSTEM_CONTROLS
}

/** Effect controls grouped by energy zone (in display order: peak → silence) */
export function getEffectsByZone(): { zone: EnergyZone; label: string; emoji: string; effects: MidiActionMeta[] }[] {
  return ZONE_ORDER.map(zone => ({
    zone,
    label: ZONE_LABELS[zone],
    emoji: ZONE_EMOJI[zone],
    effects: EFFECT_CONTROLS.filter(e => e.energyZone === zone),
  })).filter(g => g.effects.length > 0)
}

/** Vibe controls */
export function getVibeActions(): MidiActionMeta[] {
  return VIBE_CONTROLS
}

/** Arbiter override controls */
export function getArbiterActions(): MidiActionMeta[] {
  return ARBITER_CONTROLS
}

/** Find action metadata by ID */
export function findAction(id: string): MidiActionMeta | undefined {
  return getAllActions().find(a => a.id === id)
}

/** Check if an ID is a known MIDI action */
export function isKnownAction(id: string): boolean {
  return getAllActions().some(a => a.id === id)
}
