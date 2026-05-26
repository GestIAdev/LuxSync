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
 * - 🆕 WAVE 667: FuzzyDecisionMaker: Lógica difusa para decisiones no binarias
 * - 🆕 WAVE 668: DropBridge: Override divino para momentos épicos
 *
 * Flujo:
 * sense/ → [think/] → dream/ → act
 *           ^^^^^^^^
 *           AQUÍ ESTAMOS
 * ═══════════════════════════════════════════════════════════════════════════
 */
// Hunt Engine - FSM del depredador
export { processHunt, forcePhaseTransition, getHuntState, resetHuntEngine, getHuntStats } from './HuntEngine';
// Prediction Engine - Anticipación musical
export { predict, predictCombined, // 🔮 WAVE 1169: Combinado sección + energía
predictFromEnergy, // 🔮 WAVE 1169: Solo por tendencia de energía
getLastPrediction, getSectionHistory, getEnergyPredictionState, // 🔮 WAVE 1169: Debug del historial de energía
validatePrediction, resetPredictionEngine, resetEnergyHistory } from './PredictionEngine';
// Decision Maker - Síntesis final
// 🔪 WAVE 1010: Ahora incluye DIVINE_THRESHOLD
// ⚡ WAVE 4915: DIVINE_ARSENAL purgado — vive en el Live Registry.
export { makeDecision, mergeDecisions, isSignificantDecision, DIVINE_THRESHOLD } from './DecisionMaker';
// 🆕 WAVE 667: Fuzzy Decision Maker - Lógica difusa
export { fuzzyEvaluate, debugFuzzify, getFuzzyRules, FuzzyDecisionMaker, } from './FuzzyDecisionMaker';
// 🆕 WAVE 668: Drop Bridge - Override divino para momentos épicos
export { checkDropBridge, DropBridge, zScoreToProbability, describeZScore, } from './DropBridge';
