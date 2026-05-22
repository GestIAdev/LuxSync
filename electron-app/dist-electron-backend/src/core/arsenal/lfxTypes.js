// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2482 — INFINITE ARSENAL · LFX V2.1 TYPES
// ════════════════════════════════════════════════════════════════════════════
//  Tipado del Genoma para .lfx v2.1.0 (Aether-aware).
//
//  Referencias:
//   - docs/blueprints/WAVE-2480-INFINITE-ARSENAL-BLUEPRINT.md (esquema base)
//   - docs/blueprints/WAVE-2481-INFINITE-ARSENAL-V2-AUDIT.md  (correcciones V2)
//
//  Reglas:
//   - Estos tipos son ADITIVOS. No modifican `HephAutomationClip` existente.
//   - Todos los campos del bloque cognitivo son `readonly` — pensados para
//     Object.freeze() en el Registry (zero-alloc hot path).
//   - El campo `spatialBehavior` declara la relación con el motor IK
//     (WAVE 4912 / 4914 / 4916). Sin él no podemos enrutar pan/tilt
//     correctamente.
// ════════════════════════════════════════════════════════════════════════════
// ─── DEFAULTS (para .lfx que omiten campos opcionales) ──────────────────────
export const DEFAULT_IK_COMPATIBILITY = Object.freeze({
    respectsTarget: true,
    orbitAmplitude: 1.0,
    fallbackOnNoTarget: 'static',
});
export const DEFAULT_SAFETY_DECLARATION = Object.freeze({
    maxStrobeFreqHz: 0,
    containsRapidFlash: false,
    communityTrusted: true, // builtin trust por defecto; ingesta override por path
});
export const DEFAULT_SIMULATION_META = Object.freeze({
    beautyWeights: Object.freeze({ base: 0.50, energyMultiplier: 1.00, vibeBonus: 0.00 }),
    gpuCost: 0.30,
    fatigueImpact: 0.06,
    minDurationMs: 1000,
    cooldownMs: 7000,
    isStrobe: false,
    isDivineCandidate: false,
    isHeavyCandidate: false,
    zScoreGuards: Object.freeze({
        requireRising: false,
        minimumZ: null,
        minimumEnergy: null,
    }),
});
// ─── TYPE GUARDS ────────────────────────────────────────────────────────────
/** Type guard de runtime: ¿el clip tiene bloque cognitivo? */
export function hasCognitiveDNA(clip) {
    return clip.clip.cognitiveDNA != null;
}
/** Type guard: ¿es un clip elegible para Selene IA? */
export function isSeleneEligible(clip) {
    return clip.clip.effectType === 'heph_custom' && hasCognitiveDNA(clip);
}
