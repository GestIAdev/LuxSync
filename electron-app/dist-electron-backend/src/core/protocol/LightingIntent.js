/**
 * 🏛️ WAVE 201: LIGHTING INTENT
 *
 * Define la salida del MOTOR (SeleneLux2).
 * El Motor recibe MusicalContext y produce SOLO este tipo.
 *
 * REGLA: El Motor NO conoce fixtures específicos ni DMX.
 *        Solo describe QUÉ QUEREMOS EXPRESAR en términos abstractos.
 *
 * @layer MOTOR → HAL
 * @version TITAN 2.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY / HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea un LightingIntent por defecto (blackout)
 */
export function createDefaultLightingIntent() {
    return {
        palette: {
            primary: { h: 0, s: 0, l: 0 },
            secondary: { h: 0, s: 0, l: 0 },
            accent: { h: 0, s: 0, l: 0 },
            ambient: { h: 0, s: 0, l: 0 },
        },
        masterIntensity: 0,
        zones: {},
        movement: {
            pattern: 'static',
            speed: 0,
            amplitude: 0,
            centerX: 0.5,
            centerY: 0.5,
            beatSync: false,
        },
        effects: [],
        source: 'procedural',
        timestamp: Date.now(),
    };
}
/**
 * Convierte HSL a RGB (0-255)
 */
export function hslToRgb(hsl) {
    const { h, s, l } = hsl;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}
/**
 * Convierte HSL a HEX string (#RRGGBB)
 */
export function hslToHex(hsl) {
    const { r, g, b } = hslToRgb(hsl);
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
/**
 * Añade el campo .hex a un HSLColor
 */
export function withHex(hsl) {
    return {
        ...hsl,
        hex: hslToHex(hsl)
    };
}
