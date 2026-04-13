/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS PURE UTILITIES — WAVE 2495
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pure functions extracted from HephaestusRuntime.ts so that renderer code
 * can import them WITHOUT dragging in the full Runtime (which depends on
 * MasterArbiter → EventEmitter → Node.js 'events' module).
 *
 * These functions have ZERO backend dependencies — safe for browser bundle.
 */
// ═══════════════════════════════════════════════════════════════════════════
// COLOR CONVERSION
// ═══════════════════════════════════════════════════════════════════════════
export function hslToRgb(h, s, l) {
    // Normalize hue to 0-360
    const hue = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = l - c / 2;
    let r1, g1, b1;
    if (hue < 60) {
        r1 = c;
        g1 = x;
        b1 = 0;
    }
    else if (hue < 120) {
        r1 = x;
        g1 = c;
        b1 = 0;
    }
    else if (hue < 180) {
        r1 = 0;
        g1 = c;
        b1 = x;
    }
    else if (hue < 240) {
        r1 = 0;
        g1 = x;
        b1 = c;
    }
    else if (hue < 300) {
        r1 = x;
        g1 = 0;
        b1 = c;
    }
    else {
        r1 = c;
        g1 = 0;
        b1 = x;
    }
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255),
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// DMX SCALING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/** Parameters that scale 0-1 → 0-255 (DMX channels, 8-bit standard) */
const DMX_SCALED_PARAMS = new Set([
    'intensity', 'strobe', 'white', 'amber',
    'zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism',
]);
/**
 * ⚒️ WAVE 2030.24: 16-bit movement params.
 * These scale 0-1 → 0-65535 and emit BOTH coarse (MSB) and fine (LSB).
 */
const DMX_16BIT_PARAMS = new Set(['pan', 'tilt']);
/** Parameters that pass through as 0-1 floats (engine-internal) */
const FLOAT_PASSTHROUGH_PARAMS = new Set([
    'speed', 'width', 'direction', 'globalComp',
]);
/**
 * ⚒️ WAVE 2030.24: Scale a raw 0-1 curve value to DMX format
 *
 * 16-bit params (pan/tilt): returns coarse byte (0-255).
 * Use scaleToDMX16 for the full { coarse, fine } pair.
 *
 * 8-bit DMX params: 0-1 → 0-255 (clamped).
 * Engine params: 0-1 passthrough (clamped).
 */
export function scaleToDMX(paramId, rawValue) {
    const clamped = Math.max(0, Math.min(1, rawValue));
    if (DMX_16BIT_PARAMS.has(paramId)) {
        // 16-bit: return coarse byte (MSB) for backward compatibility
        const val16 = Math.round(clamped * 65535);
        return (val16 >> 8) & 0xFF;
    }
    if (DMX_SCALED_PARAMS.has(paramId)) {
        return Math.round(clamped * 255);
    }
    // Engine-internal params: clamp 0-1, no scaling
    return clamped;
}
/**
 * ⚒️ WAVE 2030.24: 16-bit scaling — returns { coarse, fine } pair.
 *
 * coarse = MSB = (val16 >> 8) & 0xFF
 * fine   = LSB = val16 & 0xFF
 *
 * Example:
 *   0.5000 → val16=32768 → coarse=128, fine=0
 *   0.5019 → val16=32893 → coarse=128, fine=125
 */
export function scaleToDMX16(rawValue) {
    const clamped = Math.max(0, Math.min(1, rawValue));
    const val16 = Math.round(clamped * 65535);
    return {
        coarse: (val16 >> 8) & 0xFF,
        fine: val16 & 0xFF,
    };
}
