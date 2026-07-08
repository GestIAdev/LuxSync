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
export function processHunt(pattern) {
    state.framesInPhase++;
    const isActive = pattern.rawEnergy > 0.3 ||
        pattern.isBuilding ||
        pattern.section === 'buildup' ||
        pattern.section === 'drop' ||
        pattern.section === 'chorus';
    switch (state.phase) {
        case 'sleeping':
            if (isActive) {
                transitionTo('stalking');
                return {
                    suggestedPhase: 'stalking',
                    worthiness: 0.5,
                    confidence: 0.4,
                    reasoning: 'Activity detected — stalking',
                };
            }
            return {
                suggestedPhase: 'sleeping',
                worthiness: 0,
                confidence: 0.2,
                reasoning: 'Standby',
            };
        case 'stalking':
            if (isActive) {
                transitionTo('evaluating');
                return {
                    suggestedPhase: 'evaluating',
                    worthiness: 0.6,
                    confidence: 0.5,
                    reasoning: 'Promoting to evaluating',
                };
            }
            if (state.framesInPhase > 60) {
                transitionTo('sleeping');
                return {
                    suggestedPhase: 'sleeping',
                    worthiness: 0,
                    confidence: 0.2,
                    reasoning: 'No activity — sleeping',
                };
            }
            return {
                suggestedPhase: 'stalking',
                worthiness: 0.4,
                confidence: 0.4,
                reasoning: `Stalking frame ${state.framesInPhase}`,
            };
        case 'evaluating':
            if (isActive) {
                transitionTo('striking');
                state.strikesThisSession++;
                state.lastStrikeTimestamp = Date.now();
                return {
                    suggestedPhase: 'striking',
                    worthiness: 0.8,
                    confidence: 0.8,
                    reasoning: `Strike #${state.strikesThisSession}`,
                };
            }
            if (state.framesInPhase > 15) {
                transitionTo('stalking');
                return {
                    suggestedPhase: 'stalking',
                    worthiness: 0.3,
                    confidence: 0.3,
                    reasoning: 'Eval timeout — back to stalking',
                };
            }
            return {
                suggestedPhase: 'evaluating',
                worthiness: 0.5,
                confidence: 0.5,
                reasoning: `Evaluating frame ${state.framesInPhase}`,
            };
        case 'striking':
            transitionTo('learning');
            return {
                suggestedPhase: 'learning',
                worthiness: 0,
                confidence: 0.8,
                reasoning: 'Strike executed',
            };
        case 'learning':
            if (state.framesInPhase >= 45) {
                transitionTo('stalking');
                return {
                    suggestedPhase: 'stalking',
                    worthiness: 0,
                    confidence: 0.4,
                    reasoning: 'Cooldown complete',
                };
            }
            return {
                suggestedPhase: 'learning',
                worthiness: 0,
                confidence: 0.3,
                reasoning: `Learning cooldown: ${state.framesInPhase}/45`,
            };
        default:
            return {
                suggestedPhase: 'sleeping',
                worthiness: 0,
                confidence: 0.2,
                reasoning: 'Unknown phase — sleeping',
            };
    }
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
