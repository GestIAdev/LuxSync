/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 500 - PROJECT GENESIS: THINK MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El módulo de PENSAMIENTO de la consciencia nativa.
 *
 * Componentes:
 * - HuntEngine: FSM del depredador estético
 * - PredictionEngine: Anticipación musical
 * - DecisionMaker: Síntesis final de decisiones
 * - 🆕 WAVE 668: DropBridge: Override divino para momentos épicos
 *
 * Flujo:
 * sense/ → [think/] → dream/ → act
 *           ^^^^^^^^
 *           AQUÍ ESTAMOS
 * ═══════════════════════════════════════════════════════════════════════════
 */
// Hunt Engine - V3.3.B: Candidate generator (no mathematical authority)
export { processHunt, forcePhaseTransition, getHuntState, resetHuntEngine, getHuntStats, getEligibleCandidates } from './HuntEngine';
// Prediction Engine - Anticipación musical
export { predict, predictCombined, // 🔮 WAVE 1169: Combinado sección + energía
predictFromEnergy, // 🔮 WAVE 1169: Solo por tendencia de energía
getLastPrediction, getSectionHistory, getEnergyPredictionState, // 🔮 WAVE 1169: Debug del historial de energía
validatePrediction, resetPredictionEngine, resetEnergyHistory } from './PredictionEngine';
// Decision Maker - Síntesis final
// V3.4: DIVINE_THRESHOLD purged — V3 epicness is the sole authority.
export { makeDecision, mergeDecisions, isSignificantDecision } from './DecisionMaker';
// 🆕 WAVE 668: Drop Bridge - Override divino para momentos épicos
export { checkDropBridge, DropBridge, zScoreToProbability, describeZScore, } from './DropBridge';
