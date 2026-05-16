/**
 * 🧠 CONSCIOUSNESS OUTPUT - Interface de Comunicación
 * ====================================================
 * WAVE 450: CORE 3 - Despertar de Selene
 *
 * Define la estructura de comunicación entre SeleneLuxConscious
 * y el resto del sistema (TitanEngine, SeleneLux, MasterArbiter).
 *
 * FILOSOFÍA:
 * - Consciencia SUGIERE, no ORDENA
 * - Vibe RESTRINGE, Consciencia ELIGE dentro
 * - Física tiene VETO en alta energía (Energy Override)
 *
 * @module engine/consciousness/ConsciousnessOutput
 * @version 450.0.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea un output vacío (consciencia dormida o sin decisiones)
 */
export function createEmptyOutput() {
    return {
        colorDecision: null,
        physicsModifier: null,
        movementDecision: null,
        effectDecision: null, // 🧨 WAVE 600
        confidence: 0,
        timestamp: Date.now(),
        source: 'hunt',
        debugInfo: {
            huntState: 'sleeping',
            beautyScore: 0,
            consonance: 0,
            beautyTrend: 'stable',
            biasesDetected: [],
            cyclesInCurrentState: 0,
        },
    };
}
/**
 * Valida que los modificadores de física respeten los límites
 */
export function clampPhysicsModifier(modifier) {
    return {
        ...modifier,
        // Strobe: mínimo 0.3 (no se puede apagar), máximo 1.0
        strobeIntensity: modifier.strobeIntensity
            ? Math.max(0.3, Math.min(1.0, modifier.strobeIntensity))
            : undefined,
        // Flash: igual
        flashIntensity: modifier.flashIntensity
            ? Math.max(0.3, Math.min(1.0, modifier.flashIntensity))
            : undefined,
        // Threshold: 0.8-1.2
        triggerThresholdMod: modifier.triggerThresholdMod
            ? Math.max(0.8, Math.min(1.2, modifier.triggerThresholdMod))
            : undefined,
    };
}
/**
 * Valida que los modificadores de color respeten los límites
 */
export function clampColorDecision(decision) {
    return {
        ...decision,
        // Hue: 0-360 (wrap around)
        suggestedHue: decision.suggestedHue !== undefined
            ? ((decision.suggestedHue % 360) + 360) % 360
            : undefined,
        // Saturación: 0.8-1.2
        saturationMod: decision.saturationMod
            ? Math.max(0.8, Math.min(1.2, decision.saturationMod))
            : undefined,
        // Brillo: 0.8-1.2
        brightnessMod: decision.brightnessMod
            ? Math.max(0.8, Math.min(1.2, decision.brightnessMod))
            : undefined,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// ENERGY OVERRIDE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 📜 WAVE 450 ENMIENDA: THE RULE OF COOL
 *
 * Umbral de energía por encima del cual la física tiene VETO TOTAL.
 * Si energy > ENERGY_OVERRIDE_THRESHOLD, los modificadores de física son ignorados.
 *
 * "En los drops, la física manda. En los valles, Selene piensa."
 */
export const ENERGY_OVERRIDE_THRESHOLD = 0.75; // WAVE 4829: 0.85→0.75 — captura drops latinos (0.75-0.82)
/**
 * Verifica si estamos en modo Energy Override (drop/clímax)
 */
export function isEnergyOverrideActive(energy) {
    return energy > ENERGY_OVERRIDE_THRESHOLD;
}
/**
 * Aplica Energy Override a los modificadores de física
 *
 * Si energy > 0.85, devuelve modificadores neutros (1.0 = full power)
 */
export function applyEnergyOverride(modifier, energy) {
    if (!modifier)
        return null;
    if (isEnergyOverrideActive(energy)) {
        // 🔥 DROP MODE: Física al máximo, Selene se calla
        return {
            strobeIntensity: 1.0,
            flashIntensity: 1.0,
            triggerThresholdMod: 1.0,
            confidence: 1.0, // Máxima confianza en el override
        };
    }
    // Valle: Selene puede modular
    return modifier;
}
