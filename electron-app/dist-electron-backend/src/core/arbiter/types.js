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
    // FALLBACK
    unknown: 'LTP',
};
/**
 * Default arbiter configuration
 */
export const DEFAULT_ARBITER_CONFIG = {
    defaultCrossfadeMs: 500,
    maxManualOverrides: 64,
    maxActiveEffects: 8,
    consciousnessEnabled: false, // Will be true in CORE 3
    debug: false,
};
