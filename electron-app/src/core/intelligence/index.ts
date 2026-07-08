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

export * from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CEREBRO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export {
  SeleneTitanConscious,
  getSelene,
  resetSelene,
  type SeleneTitanConsciousConfig,
} from './SeleneTitanConscious'

// ═══════════════════════════════════════════════════════════════════════════
// VALIDADORES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // EnergyOverride
  applyEnergyOverride,
  getEnergyOverrideInfo,
  getEnergyDistanceToThreshold,
  predictEnergyOverride,
  // ConstitutionGuard
  validateColorDecision,
  enforceConstitution,
  type ValidationResult,
  type ValidationViolation,
} from './validate'

// ═══════════════════════════════════════════════════════════════════════════
// SENSORES - Los Ojos de Selene (PHASE 2 COMPLETE)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Musical Pattern Sensor
  senseMusicalPattern,
  detectSectionChange,
  calculateMomentUrgency,
  resetPatternHistory,
  // Beauty Sensor
  senseBeauty,
  getAverageBeauty,
  getBeautyTrend,
  evaluateGoldenDistribution,
  resetBeautyHistory,
  type BeautyAnalysis,
  // Consonance Sensor
  senseConsonance,
  evaluateHueChange,
  suggestConsonantHues,
  resetConsonanceState,
  type ConsonanceAnalysis,
} from './sense'

// ═══════════════════════════════════════════════════════════════════════════
// COGNICIÓN - El Cazador (PHASE 3 COMPLETE)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Hunt Engine — V3.3.B: Candidate generator
  processHunt,
  forcePhaseTransition,
  getHuntState,
  resetHuntEngine,
  getHuntStats,
  getEligibleCandidates,
  type HuntDecision,
  // Prediction Engine
  predict,
  getLastPrediction,
  getSectionHistory,
  validatePrediction,
  resetPredictionEngine,
  type PredictionType,
  type MusicalPrediction,
  type PredictionAction,
  // Decision Maker
  makeDecision,
  mergeDecisions,
  isSignificantDecision,
  type DecisionInputs,
  type DecisionMakerConfig,
} from './think'

// ═══════════════════════════════════════════════════════════════════════════
// META-CONSCIENCIA - El Soñador (PHASE 4 COMPLETE)
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Scenario Simulator
  dream,
  getLastDream,
  getDreamStats,
  resetDreamEngine,
  type ScenarioType,
  type SimulatedScenario,
  type DreamResult,
  type SimulatorConfig,
  // Bias Detector
  recordDecision,
  analyzeBiases,
  getBiasStrings,
  getLastAnalysis,
  getBiasStats,
  resetBiasDetector,
  type BiasType,
  type BiasSeverity,
  type DetectedBias,
  type BiasAnalysis,
  type BiasDetectorConfig,
} from './dream'
