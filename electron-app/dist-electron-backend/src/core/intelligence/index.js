/**
 * 🧬 WAVE 500: PROJECT GENESIS - Intelligence Core
 * ==================================================
 *
 * Exports públicos del nuevo sistema de inteligencia.
 * Diseñado desde cero para TitanEngine.
 *
 * @module core/intelligence
 * @version 500.0.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PRINCIPALES
// ═══════════════════════════════════════════════════════════════════════════
export * from './types';
// ═══════════════════════════════════════════════════════════════════════════
// CEREBRO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export { SeleneTitanConscious, getSelene, resetSelene, } from './SeleneTitanConscious';
// ═══════════════════════════════════════════════════════════════════════════
// VALIDADORES
// ═══════════════════════════════════════════════════════════════════════════
export { 
// EnergyOverride
applyEnergyOverride, getEnergyOverrideInfo, getEnergyDistanceToThreshold, predictEnergyOverride, 
// ConstitutionGuard
validateColorDecision, enforceConstitution, } from './validate';
// ═══════════════════════════════════════════════════════════════════════════
// SENSORES - Los Ojos de Selene (PHASE 2 COMPLETE)
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Musical Pattern Sensor
senseMusicalPattern, detectSectionChange, calculateMomentUrgency, resetPatternHistory, 
// Beauty Sensor
senseBeauty, getAverageBeauty, getBeautyTrend, evaluateGoldenDistribution, resetBeautyHistory, 
// Consonance Sensor
senseConsonance, evaluateHueChange, suggestConsonantHues, resetConsonanceState, } from './sense';
// ═══════════════════════════════════════════════════════════════════════════
// COGNICIÓN - El Cazador (PHASE 3 COMPLETE)
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Hunt Engine — V3.3.B: Candidate generator
processHunt, forcePhaseTransition, getHuntState, resetHuntEngine, getHuntStats, getEligibleCandidates, 
// Prediction Engine
predict, getLastPrediction, getSectionHistory, validatePrediction, resetPredictionEngine, observeSection, // 🔮 CASSANDRA 2.0
getCassandraState, 
// Decision Maker
makeDecision, mergeDecisions, isSignificantDecision, } from './think';
// ═══════════════════════════════════════════════════════════════════════════
// META-CONSCIENCIA - El Soñador (PHASE 4 COMPLETE)
// ═══════════════════════════════════════════════════════════════════════════
export { 
// Scenario Simulator
dream, getLastDream, getDreamStats, resetDreamEngine, 
// Bias Detector
recordDecision, analyzeBiases, getBiasStrings, getLastAnalysis, getBiasStats, resetBiasDetector, } from './dream';
