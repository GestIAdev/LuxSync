// ═══════════════════════════════════════════════════════════════════════════
//  🐆 HUNT ENGINE — V3 PHASE 3.3.B: CANDIDATE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  V3.3.B: Lobotomized — no mathematical authority. Only fetches
//  eligible effect candidates from the DynamicEffectRegistry.
//  V3 Liquid Cognition decides WHEN to fire. HuntEngine provides WHAT.
// ═══════════════════════════════════════════════════════════════════════════
import { getDynamicEffectRegistry } from '../../arsenal/DynamicEffectRegistry';
let state = createInitialState();
function createInitialState() {
    return {
        phase: 'sleeping',
        framesInPhase: 0,
        lastStrikeTimestamp: 0,
        strikesThisSession: 0,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// CANDIDATE GENERATOR — V3.3.B
// ═══════════════════════════════════════════════════════════════════════════
/**
 * V3.3.B: Fetches eligible effect candidates for a vibe and energy zone.
 * This is the sole public purpose of HuntEngine after V3 extirpation.
 * Returns Divine arsenal if available, falls back to Heavy, then all vibe effects.
 */
export function getEligibleCandidates(vibe, energyZone) {
    const divine = getDynamicEffectRegistry().getDivineArsenal(vibe);
    if (divine.length > 0)
        return divine;
    const heavy = getDynamicEffectRegistry().getHeavyArsenal(vibe);
    if (heavy.length > 0)
        return heavy;
    return getDynamicEffectRegistry().getEffectsForVibe(vibe);
}
// ═══════════════════════════════════════════════════════════════════════════
// FSM — Telemetry-only phase tracking (no decision authority)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Processes the current musical state and returns telemetry.
 * V3.3.B: No worthiness calculation, no VIBE_STRIKE_MATRIX, no threshold checks.
 * Phase transitions are driven by simple energy/section heuristics for telemetry.
 */
const HUNT_TELEMETRY_STATIC = {
    suggestedPhase: 'stalking',
    worthiness: 0,
    confidence: 0.3,
    reasoning: 'V3 Liquid Cognition authority — Hunt FSM lobotomized',
};
/**
 * V3 LOBOTOMY: processHunt is now a zero-cost static telemetry stub.
 * The V2 FSM (sleeping→stalking→evaluating→striking→learning) was degenerate:
 * it cycled in 3 frames then sat in 45-frame cooldown, providing no useful signal.
 * V3 Liquid Cognition (epicness, impact, tension) is the sole authority.
 * This function is kept for interface compatibility only.
 */
export function processHunt(_pattern) {
    return HUNT_TELEMETRY_STATIC;
}
/**
 * Fuerza transición de fase (para control externo)
 */
export function forcePhaseTransition(newPhase) {
    state.phase = newPhase;
    state.framesInPhase = 0;
}
/**
 * Obtiene estado actual (para debug)
 */
export function getHuntState() {
    return { ...state };
}
/**
 * Resetea el hunt engine
 */
export function resetHuntEngine() {
    state = createInitialState();
}
/**
 * Obtiene estadísticas de la sesión
 */
export function getHuntStats() {
    return {
        strikes: state.strikesThisSession,
        lastStrike: state.lastStrikeTimestamp,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function transitionTo(newPhase) {
    state.phase = newPhase;
    state.framesInPhase = 0;
}
