/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ MASTER ARBITER - TYPE DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 373: Complete type system for the MasterArbiter control hierarchy.
 *
 * ARCHITECTURE:
 * - Layer 0: TITAN_AI (base from TitanEngine)
 * - Layer 1: CONSCIOUSNESS (future CORE 3 - SeleneLuxConscious)
 * - Layer 2: MANUAL (user overrides via UI/MIDI)
 * - Layer 3: EFFECTS (temporary effects like strobe/flash)
 * - Layer 4: BLACKOUT (emergency, highest priority)
 *
 * @module core/arbiter/types
 * @version WAVE 373
 */
// ═══════════════════════════════════════════════════════════════════════════
// ENUMS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Control layer priorities (higher number = higher priority)
 * Used to determine which layer "wins" when multiple layers want to control the same channel.
 */
export var ControlLayer;
(function (ControlLayer) {
    /** Base: AI-generated intent from TitanEngine */
    ControlLayer[ControlLayer["TITAN_AI"] = 0] = "TITAN_AI";
    /** Future: Modifications from SeleneLuxConscious (CORE 3) */
    ControlLayer[ControlLayer["CONSCIOUSNESS"] = 1] = "CONSCIOUSNESS";
    /** User manual overrides (faders, joystick, MIDI) */
    ControlLayer[ControlLayer["MANUAL"] = 2] = "MANUAL";
    /** Temporary effects (strobe, flash, blinder) */
    ControlLayer[ControlLayer["EFFECTS"] = 3] = "EFFECTS";
    /** Emergency blackout - always wins */
    ControlLayer[ControlLayer["BLACKOUT"] = 4] = "BLACKOUT";
})(ControlLayer || (ControlLayer = {}));
/**
 * Default merge strategies per channel type
 * Industry standard: HTP for intensity, LTP for everything else.
 *
 * 🔥 WAVE 2084: PHANTOM PANEL — Canales de INGENIOS (rotation, custom, macro, etc.)
 * usan LTP por defecto. Titan/Selene NO inyectan valores en estos canales
 * (eso se controla en arbitrateFixture), pero si alguien los toca manualmente → LTP.
 */
export const DEFAULT_MERGE_STRATEGIES = {
    // INTENSITY
    dimmer: 'HTP',
    strobe: 'LTP',
    shutter: 'LTP',
    // COLOR
    red: 'LTP',
    green: 'LTP',
    blue: 'LTP',
    white: 'LTP',
    amber: 'LTP',
    uv: 'LTP',
    cyan: 'LTP',
    magenta: 'LTP',
    yellow: 'LTP',
    color_wheel: 'LTP',
    // POSITION
    pan: 'LTP',
    pan_fine: 'LTP',
    tilt: 'LTP',
    tilt_fine: 'LTP',
    // BEAM
    gobo: 'LTP',
    gobo_rotation: 'LTP',
    prism: 'LTP',
    prism_rotation: 'LTP',
    focus: 'LTP',
    zoom: 'LTP',
    frost: 'LTP',
    // CONTROL
    speed: 'LTP',
    macro: 'LTP',
    control: 'LTP',
    // 🔥 WAVE 2084: INGENIOS
    rotation: 'LTP',
    custom: 'LTP',
    // 🟢 WAVE 7737: LASER GEOMETRY
    scale_x: 'LTP',
    scale_y: 'LTP',
    rot_x: 'LTP',
    rot_y: 'LTP',
    // 🚨 WAVE 7737: SAFETY INTERLOCK
    emission_gate: 'LTP',
    // 🌫️ WAVE 7737: ATMOSPHERE
    smoke_pump: 'LTP',
    smoke_density: 'LTP',
    fan_speed: 'LTP',
    // 🔥 WAVE 7737: FIRE
    fire_valve: 'LTP',
    fire_ignite: 'LTP',
    // FALLBACK
    unknown: 'LTP',
};
const CHANNEL_CATEGORY_MAP = {
    // COLOR
    red: 'color',
    green: 'color',
    blue: 'color',
    white: 'color',
    amber: 'color',
    uv: 'color',
    cyan: 'color',
    magenta: 'color',
    yellow: 'color',
    color_wheel: 'color',
    // POSITION
    pan: 'position',
    pan_fine: 'position',
    tilt: 'position',
    tilt_fine: 'position',
    // INTENSITY
    dimmer: 'intensity',
    strobe: 'intensity',
    shutter: 'intensity',
    // BEAM
    gobo: 'beam',
    gobo_rotation: 'beam',
    prism: 'beam',
    prism_rotation: 'beam',
    focus: 'beam',
    zoom: 'beam',
    frost: 'beam',
    // CONTROL
    speed: 'control',
    macro: 'control',
    control: 'control',
    // INGENIOS
    rotation: 'ingenios',
    custom: 'ingenios',
    // 🟢 WAVE 7737: LASER GEOMETRY → beam (escala/tumble de patrón)
    scale_x: 'beam',
    scale_y: 'beam',
    rot_x: 'beam',
    rot_y: 'beam',
    // 🚨🌫️🔥 WAVE 7737: SAFETY INTERLOCK + ATMOSPHERE + FIRE → atmosphere (cuarentena)
    emission_gate: 'atmosphere',
    smoke_pump: 'atmosphere',
    smoke_density: 'atmosphere',
    fan_speed: 'atmosphere',
    fire_valve: 'atmosphere',
    fire_ignite: 'atmosphere',
    // FALLBACK
    unknown: 'control',
};
/**
 * Get the category for a channel type.
 * Used by setManualOverride to determine which channels to replace vs preserve.
 */
export function getChannelCategory(channel) {
    return CHANNEL_CATEGORY_MAP[channel] ?? 'control';
}
/**
 * Get all unique categories present in a list of channels.
 */
export function getChannelCategories(channels) {
    const categories = new Set();
    for (const ch of channels) {
        categories.add(getChannelCategory(ch));
    }
    return categories;
}
/**
 * Default arbiter configuration
 */
export const DEFAULT_ARBITER_CONFIG = {
    defaultCrossfadeMs: 500,
    maxManualOverrides: 64,
    maxActiveEffects: 8,
    consciousnessEnabled: false, // Will be true in CORE 3
    // 🩸 WAVE 7571: Silenced in production — was hardcoded `true` since WAVE 2790.
    // The Arbiter logs every zone change at 44Hz in debug mode. In production,
    // this generates ~44 console.log/sec of zone diagnostics that nobody reads.
    // `as const` requires literal types, so we use a runtime check instead of
    // `process.env.NODE_ENV` (which is stripped by bundlers and would make
    // this `false` at compile time, breaking the `as const` type).
    debug: !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'),
};
