/**
 * 🎨 WAVE 3504-EXT.1 — COLOR PROCESSORS
 *
 * Funciones puras de transformación cromática extraídas de TitanEngine.
 * Cero estado. Cero singletons. Cero side-effects.
 *
 * Contiene:
 *  - Conversión SelenePalette → ColorPalette (normalización HSL)
 *  - Aplicación de decisiones de consciencia sobre paleta y efectos
 *  - Cálculo de intensidad global con noise gate
 *  - Cálculo de intensidades de zona por banda espectral
 *  - Normalización de tipo de sección musical
 *
 * @layer ENGINE/GENERATORS (Pure Math)
 */
import { withHex, hslToHex } from '../../core/protocol/LightingIntent';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * WAVE 2990: NOISE GATE — energía por debajo de este umbral se trata como silencio.
 * El ruido de fondo, hum de sala y artefactos de codec dan ~2-4% de energía.
 * Silencio duro a cero previene luz residual cuando la sala está realmente en silencio.
 */
export const NOISE_GATE = 0.05;
// ─────────────────────────────────────────────────────────────────────────
// WAVE 0-ALLOC: Pre-allocated scratch objects for mutate variants
// ─────────────────────────────────────────────────────────────────────────
const _colorPaletteScratch = {
    primary: { h: 0, s: 0, l: 0 },
    secondary: { h: 0, s: 0, l: 0 },
    accent: { h: 0, s: 0, l: 0 },
    ambient: { h: 0, s: 0, l: 0 },
    strategy: 'analogous',
};
// ─────────────────────────────────────────────────────────────────────────
// CONVERSIÓN DE PALETA
// ─────────────────────────────────────────────────────────────────────────
/**
 * Convierte SelenePalette (HSL 0-360/0-100) a ColorPalette (HSL 0-1).
 *
 * WAVE 0-ALLOC: Mutates pre-allocated _colorPaletteScratch — zero allocations.
 * Computes hex inline via hslToHex to avoid withHex spread.
 *
 * @pure (no side effects beyond internal scratch)
 */
export function selenePaletteToColorPaletteMutate(selene) {
    const out = _colorPaletteScratch;
    // primary
    out.primary.h = selene.primary.h / 360;
    out.primary.s = selene.primary.s / 100;
    out.primary.l = selene.primary.l / 100;
    out.primary.hex = hslToHex(out.primary);
    // secondary
    out.secondary.h = selene.secondary.h / 360;
    out.secondary.s = selene.secondary.s / 100;
    out.secondary.l = selene.secondary.l / 100;
    out.secondary.hex = hslToHex(out.secondary);
    // accent
    out.accent.h = selene.accent.h / 360;
    out.accent.s = selene.accent.s / 100;
    out.accent.l = selene.accent.l / 100;
    out.accent.hex = hslToHex(out.accent);
    // ambient
    out.ambient.h = selene.ambient.h / 360;
    out.ambient.s = selene.ambient.s / 100;
    out.ambient.l = selene.ambient.l / 100;
    out.ambient.hex = hslToHex(out.ambient);
    // strategy
    out.strategy = selene.meta.strategy;
    return out;
}
/**
 * Convierte SelenePalette (HSL en rango 0-360 / 0-100 / 0-100)
 * a ColorPalette del protocolo (HSL en rango 0-1).
 *
 * WAVE 269: SeleneColorEngine usa escalas absolutas, el protocolo usa
 * escalas normalizadas. Esta función es el único punto de traducción.
 *
 * Allocating variant — use selenePaletteToColorPaletteMutate in hot paths.
 *
 * @pure
 */
export function selenePaletteToColorPalette(selene) {
    const normalizeHSL = (color) => withHex({
        h: color.h / 360,
        s: color.s / 100,
        l: color.l / 100,
    });
    return {
        primary: normalizeHSL(selene.primary),
        secondary: normalizeHSL(selene.secondary),
        accent: normalizeHSL(selene.accent),
        ambient: normalizeHSL(selene.ambient),
        strategy: selene.meta.strategy,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// DECISIONES DE CONSCIENCIA
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Aplica las modificaciones de color de la consciencia a una paleta.
 *
 * WAVE 0-ALLOC: Mutates the input palette in place — zero allocations.
 * No spread operators, no new objects.
 *
 * Modificadores clampeados a ±20% para evitar distorsiones extremas.
 */
export function applyConsciousnessColorDecisionMutate(palette, decision) {
    const satMod = Math.max(0.8, Math.min(1.2, decision.saturationMod ?? 1));
    const brightMod = Math.max(0.8, Math.min(1.2, decision.brightnessMod ?? 1));
    // WAVE 0-ALLOC: Mutate each channel in place — no spread, no new objects
    palette.primary.s = Math.max(0, Math.min(1, palette.primary.s * satMod));
    palette.primary.l = Math.max(0, Math.min(1, palette.primary.l * brightMod));
    palette.primary.hex = hslToHex(palette.primary);
    palette.secondary.s = Math.max(0, Math.min(1, palette.secondary.s * satMod));
    palette.secondary.l = Math.max(0, Math.min(1, palette.secondary.l * brightMod));
    palette.secondary.hex = hslToHex(palette.secondary);
    palette.accent.s = Math.max(0, Math.min(1, palette.accent.s * satMod));
    palette.accent.l = Math.max(0, Math.min(1, palette.accent.l * brightMod));
    palette.accent.hex = hslToHex(palette.accent);
    palette.ambient.s = Math.max(0, Math.min(1, palette.ambient.s * satMod));
    palette.ambient.l = Math.max(0, Math.min(1, palette.ambient.l * brightMod));
    palette.ambient.hex = hslToHex(palette.ambient);
    return palette;
}
/**
 * Aplica las modificaciones de color de la consciencia a una paleta.
 *
 * La consciencia puede ajustar saturación y brillo (factor ±20%) pero
 * RESPETA la paleta base generada por SeleneColorEngine. No cambia hue.
 *
 * Modificadores clampeados a ±20% para evitar distorsiones extremas.
 *
 * Allocating variant — use applyConsciousnessColorDecisionMutate in hot paths.
 *
 * @pure
 */
export function applyConsciousnessColorDecision(palette, decision) {
    const satMod = Math.max(0.8, Math.min(1.2, decision.saturationMod ?? 1));
    const brightMod = Math.max(0.8, Math.min(1.2, decision.brightnessMod ?? 1));
    const modifyChannel = (color) => ({
        ...color,
        s: Math.max(0, Math.min(1, color.s * satMod)),
        l: Math.max(0, Math.min(1, color.l * brightMod)),
    });
    return {
        primary: modifyChannel({ ...palette.primary }),
        secondary: modifyChannel({ ...palette.secondary }),
        accent: modifyChannel({ ...palette.accent }),
        ambient: modifyChannel({ ...palette.ambient }),
        strategy: palette.strategy,
    };
}
/**
 * Aplica modificadores de física de la consciencia a la lista de efectos.
 *
 * WAVE 0-ALLOC: Mutates effects array in place — no .map(), no spread.
 * Sólo modifica intensidades de strobe/flash — no añade ni elimina efectos.
 * ⚠️ Solo debe llamarse cuando energy < 0.85. En drops, la física tiene VETO TOTAL.
 */
export function applyConsciousnessPhysicsModifierMutate(effects, modifier) {
    for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];
        if (effect.type === 'strobe' && modifier.strobeIntensity !== undefined) {
            effect.intensity = Math.max(0, Math.min(1, effect.intensity * modifier.strobeIntensity));
        }
        if (effect.type === 'flash' && modifier.flashIntensity !== undefined) {
            effect.intensity = Math.max(0, Math.min(1, effect.intensity * modifier.flashIntensity));
        }
    }
    return effects;
}
/**
 * Aplica modificadores de física de la consciencia a la lista de efectos.
 *
 * Sólo modifica intensidades de strobe/flash — no añade ni elimina efectos.
 * ⚠️ Solo debe llamarse cuando energy < 0.85. En drops, la física tiene VETO TOTAL.
 *
 * Allocating variant — use applyConsciousnessPhysicsModifierMutate in hot paths.
 *
 * @pure
 */
export function applyConsciousnessPhysicsModifier(effects, modifier) {
    return effects.map(effect => {
        const next = { ...effect };
        if (effect.type === 'strobe' && modifier.strobeIntensity !== undefined) {
            next.intensity = Math.max(0, Math.min(1, effect.intensity * modifier.strobeIntensity));
        }
        if (effect.type === 'flash' && modifier.flashIntensity !== undefined) {
            next.intensity = Math.max(0, Math.min(1, effect.intensity * modifier.flashIntensity));
        }
        return next;
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// INTENSIDAD GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Calcula la intensidad maestra normalizada (0..1) para el frame actual.
 *
 * Aplica el noise gate para evitar luz residual en silencio, luego mapea
 * la energía al rango floor/ceiling del vibe actual.
 *
 * WAVE 2990: Sub-threshold energy → absolute silence.
 *
 * @pure
 */
export function calculateMasterIntensity(energy, dimmer) {
    const gated = energy < NOISE_GATE ? 0 : energy;
    return Math.max(0, Math.min(1, dimmer.floor + gated * (dimmer.ceiling - dimmer.floor)));
}
// ─────────────────────────────────────────────────────────────────────────────
// ZONAS DE INTENSIDAD
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Calcula el mapa de intenciones de zona base a partir de las bandas espectrales.
 *
 * Aplica el noise gate por banda antes de los cálculos de zona para que
 * el ruido de fondo no genere intensidad residual en ninguna zona.
 *
 * Esta función devuelve el mapa BASE (mono / 5 zonas).
 * Los overrides estéreo del NervousSystem se aplican en el Engine dispatcher.
 *
 * WAVE 2990: Noise gate por banda.
 *
 * @pure
 */
export function calculateZoneIntents(audio) {
    const NG = NOISE_GATE;
    const bass = audio.bass < NG ? 0 : audio.bass;
    const mid = audio.mid < NG ? 0 : audio.mid;
    const high = audio.high < NG ? 0 : audio.high;
    const energy = audio.energy < NG ? 0 : audio.energy;
    return {
        front: { intensity: mid * 0.8 + bass * 0.2, paletteRole: 'primary' },
        back: { intensity: bass * 0.6 + energy * 0.4, paletteRole: 'accent' },
        left: { intensity: high * 0.5 + energy * 0.5, paletteRole: 'secondary' },
        right: { intensity: high * 0.5 + energy * 0.5, paletteRole: 'ambient' },
        ambient: { intensity: energy * 0.3, paletteRole: 'ambient' },
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZACIÓN DE SECCIÓN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Tabla de mapeo de nombres de sección cruda → tipo normalizado.
 * Los alias más comunes están aquí; los no recognocidos caen a 'unknown'.
 */
const SECTION_MAP = {
    intro: 'intro',
    verse: 'verse',
    chorus: 'chorus',
    drop: 'drop',
    textural_drop: 'textural_drop',
    bridge: 'bridge',
    outro: 'outro',
    build: 'build',
    buildup: 'build',
    breakdown: 'breakdown',
    hook: 'chorus',
    prechorus: 'build',
    postchorus: 'verse',
};
/**
 * Normaliza el tipo de sección musical a un enum tipado.
 *
 * Los strings de sección vienen del análisis Wave8 y pueden tener
 * mayúsculas o variaciones de alias. Esta función los canonicaliza.
 *
 * @pure
 */
export function normalizeSectionType(sectionType) {
    return SECTION_MAP[sectionType?.toLowerCase() ?? ''] ?? 'unknown';
}
