/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎹 WAVE 3300: MIDI ACTION REGISTRY — THE BRIDGE CATALOG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for every action that can be MIDI-mapped.
 * Builds a categorized catalog from the live DynamicEffectRegistry via IPC.
 *
 * ARCHITECTURE:
 * - Runs in RENDERER process (no access to EffectManager singleton)
 * - Effect IDs come from the live DynamicEffectRegistry via `lux:arsenal:getCatalog`
 * - Grouped by energy zone via the energyZone.max field in the registry entry
 * - Consumed by MidiLearnOverlay for categorized display
 * - Consumed by useMidiLearn for prefix-based dispatch routing
 *
 * WAVE 4914: EFFECT_ZONE_MAP hardcoded replaced by live registry feed.
 * `initArsenalCatalog()` must be called once at app boot (AppCommander).
 * The static EFFECT_ZONE_MAP is kept as emergency fallback only.
 *
 * @module midi/MidiActionRegistry
 * @version WAVE 4914
 */
// ═══════════════════════════════════════════════════════════════════════════
// EFFECT ZONE MAP — BOOTSTRAP FALLBACK
// Fuente estática de arranque. Se reemplaza por el catálogo vivo del
// DynamicEffectRegistry en cuanto `initArsenalCatalog()` complete el IPC.
// Mantener actualizado es opcional — es solo el estado pre-IPC.
// ═══════════════════════════════════════════════════════════════════════════
const EFFECT_ZONE_MAP = {
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
};
// ═══════════════════════════════════════════════════════════════════════════
// HUMANIZE HELPER
// ═══════════════════════════════════════════════════════════════════════════
function humanize(snakeCase) {
    return snakeCase
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC EFFECT CONTROLS — WAVE 4914
// Inicializados desde el EFFECT_ZONE_MAP (fallback síncrono al module load).
// `initArsenalCatalog()` los reemplaza con el catálogo vivo del registry.
// ═══════════════════════════════════════════════════════════════════════════
function _buildFromZoneMap(map) {
    return Object.entries(map).map(([effectId, zone]) => ({
        id: `fx-${effectId}`,
        label: humanize(effectId),
        category: 'button',
        group: 'effect',
        energyZone: zone,
    }));
}
/** Catálogo mutable de efectos — se actualiza en runtime via `initArsenalCatalog()`. */
let _effectControls = _buildFromZoneMap(EFFECT_ZONE_MAP);
/**
 * Reemplaza el catálogo de efectos con los datos del DynamicEffectRegistry.
 * Llamar desde `initArsenalCatalog()`. Exportado para testing.
 */
export function setLiveEffectCatalog(entries) {
    _effectControls = entries.map(e => ({
        id: `fx-${e.id}`,
        label: e.name,
        category: 'button',
        group: 'effect',
        energyZone: e.energyZone ?? 'active',
    }));
}
function _getArsenalBridge() {
    const w = globalThis;
    return w.lux?.arsenal ?? null;
}
/**
 * Llama a `lux:arsenal:getCatalog` vía IPC y actualiza el catálogo en vivo.
 * Debe llamarse UNA VEZ en AppCommander.useEffect al arrancar la app.
 *
 * Falla silenciosamente si el bridge no está disponible (entorno no-Electron).
 */
export async function initArsenalCatalog() {
    const bridge = _getArsenalBridge();
    if (!bridge) {
        console.warn('[MidiActionRegistry] ⚠️ lux.arsenal bridge no disponible — usando fallback estático');
        return;
    }
    try {
        const entries = await bridge.getCatalog();
        setLiveEffectCatalog(entries);
        console.log(`[MidiActionRegistry] ⚡ Catálogo vivo cargado: ${entries.length} efectos`);
    }
    catch (err) {
        console.error('[MidiActionRegistry] ❌ getCatalog falló — usando fallback estático:', err);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM CONTROLS (the original 7 + flow)
// ═══════════════════════════════════════════════════════════════════════════
const SYSTEM_CONTROLS = [
    { id: 'ctrl-intensity', label: 'Grand Master', category: 'fader', group: 'system' },
    { id: 'ctrl-saturation', label: 'Saturation', category: 'fader', group: 'system' },
    { id: 'flow-speed', label: 'Flow Speed', category: 'fader', group: 'system' },
    { id: 'flow-spread', label: 'Flow Spread', category: 'fader', group: 'system' },
    { id: 'ctrl-output-toggle', label: 'Output ON/OFF', category: 'button', group: 'system' },
    { id: 'ctrl-ai-toggle', label: 'AI ON/OFF', category: 'button', group: 'system' },
    { id: 'lux-blackout', label: 'BLACKOUT', category: 'button', group: 'system' },
];
// ═══════════════════════════════════════════════════════════════════════════
// VIBE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
const VIBE_CONTROLS = [
    { id: 'vibe-fiesta-latina', label: 'Fiesta Latina', category: 'button', group: 'vibe' },
    { id: 'vibe-techno-club', label: 'Techno Club', category: 'button', group: 'vibe' },
    { id: 'vibe-pop-rock', label: 'Pop Rock', category: 'button', group: 'vibe' },
    { id: 'vibe-chill-lounge', label: 'Chill Lounge', category: 'button', group: 'vibe' },
];
// ═══════════════════════════════════════════════════════════════════════════
// ARBITER OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════
const ARBITER_CONTROLS = [
    { id: 'arb-blackout', label: 'Arbiter Blackout', category: 'button', group: 'arbiter' },
    { id: 'arb-grand-master', label: 'Arbiter Grand Master', category: 'fader', group: 'arbiter' },
    { id: 'arb-kill-effects', label: 'Kill All Effects', category: 'button', group: 'arbiter' },
    // WAVE 5020: Selection Kill — blackout contextual (sel) o global (panic sin selección)
    { id: 'sel-blackout', label: 'Selection Kill / Panic Blackout', category: 'button', group: 'arbiter' },
];
// 🌊 WAVE 4699.2: TUNGSTEN GOLDEN NUKE — NanoPAD2 mappings
// tung-spin        → CC fader bipolar [-1, 1]: rotation continua del rotor Tungsten.
// tung-nuke-all    → PAD 1: golden-master + petal-l/c/r (Big Bang dorá)
// tung-petal-l/c/r → PAD 2/3/4: ráfagas individuales de pétalo
// 🌊 WAVE 4825: SURGICAL NUKE
// tung-nuke-gold   → PAD 5: SOLO golden-master node (L0 Washer intacto)
const TUNGSTEN_CONTROLS = [
    { id: 'tung-spin', label: 'Tungsten Spin', category: 'fader', group: 'arbiter' },
    { id: 'tung-nuke-all', label: 'Nuke Gold — Big Bang', category: 'button', group: 'arbiter' },
    { id: 'tung-nuke-gold', label: 'Gold Surgical Nuke', category: 'button', group: 'arbiter' },
    { id: 'tung-petal-l', label: 'Petal Left Burst', category: 'button', group: 'arbiter' },
    { id: 'tung-petal-c', label: 'Petal Center Burst', category: 'button', group: 'arbiter' },
    { id: 'tung-petal-r', label: 'Petal Right Burst', category: 'button', group: 'arbiter' },
];
// 🌊 WAVE 5021: GROUP MACROS — Freestyler-style fixture groups via KeyForge
// grp-N-blackout toggles inhibit on ALL fixtures in saved group N, independently
// of the current UI selection. Use sel-assign-group-N to save, then map these.
const GROUP_CONTROLS = [
    { id: 'grp-1-blackout', label: 'Group 1 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-2-blackout', label: 'Group 2 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-3-blackout', label: 'Group 3 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-4-blackout', label: 'Group 4 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-5-blackout', label: 'Group 5 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-6-blackout', label: 'Group 6 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-7-blackout', label: 'Group 7 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-8-blackout', label: 'Group 8 Blackout', category: 'button', group: 'arbiter' },
    { id: 'grp-9-blackout', label: 'Group 9 Blackout', category: 'button', group: 'arbiter' },
];
// ═══════════════════════════════════════════════════════════════════════════
// ZONE DISPLAY ORDER (peak first — the user thinks "dame algo para el DROP")
// ═══════════════════════════════════════════════════════════════════════════
const ZONE_ORDER = ['peak', 'intense', 'active', 'gentle', 'ambient', 'valley', 'silence'];
const ZONE_LABELS = {
    peak: 'PEAK — Drops & Explosions',
    intense: 'INTENSE — Pre-Climax',
    active: 'ACTIVE — Rhythm Established',
    gentle: 'GENTLE — Building Energy',
    ambient: 'AMBIENT — Soft Movement',
    valley: 'VALLEY — Atmospheric Fog',
    silence: 'SILENCE — Deep Breath',
};
const ZONE_EMOJI = {
    peak: '💣',
    intense: '☢️',
    active: '👯',
    gentle: '⚡',
    ambient: '🌧️',
    valley: '🌫️',
    silence: '🌑',
};
// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════
/** Full catalog of all MIDI-mappable actions */
export function getAllActions() {
    return [
        ...SYSTEM_CONTROLS,
        ..._effectControls,
        ...VIBE_CONTROLS,
        ...ARBITER_CONTROLS,
        ...TUNGSTEN_CONTROLS,
        ...GROUP_CONTROLS,
    ];
}
/** Tungsten Golden Nuke controls */
export function getTungstenActions() {
    return TUNGSTEN_CONTROLS;
}
/** System controls only */
export function getSystemActions() {
    return SYSTEM_CONTROLS;
}
/** Effect controls grouped by energy zone (in display order: peak → silence) */
export function getEffectsByZone() {
    return ZONE_ORDER.map(zone => ({
        zone,
        label: ZONE_LABELS[zone],
        emoji: ZONE_EMOJI[zone],
        effects: _effectControls.filter(e => e.energyZone === zone),
    })).filter(g => g.effects.length > 0);
}
/** Vibe controls */
export function getVibeActions() {
    return VIBE_CONTROLS;
}
/** Arbiter override controls */
export function getArbiterActions() {
    return [...ARBITER_CONTROLS, ...GROUP_CONTROLS];
}
/** WAVE 5021: Group macro controls (grp-N-blackout) */
export function getGroupActions() {
    return GROUP_CONTROLS;
}
/** Find action metadata by ID */
export function findAction(id) {
    return getAllActions().find(a => a.id === id);
}
/** Check if an ID is a known MIDI action */
export function isKnownAction(id) {
    return getAllActions().some(a => a.id === id);
}
