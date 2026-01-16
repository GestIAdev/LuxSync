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
export { 
  processHunt, 
  forcePhaseTransition,
  getHuntState,
  resetHuntEngine,
  getHuntStats,
  type HuntCandidate,
  type StrikeConditions,
  type HuntDecision
} from './HuntEngine'

// Prediction Engine - Anticipación musical
export {
  predict,
  getLastPrediction,
  getSectionHistory,
  validatePrediction,
  resetPredictionEngine,
  type PredictionType,
  type MusicalPrediction,
  type PredictionAction
} from './PredictionEngine'

// Decision Maker - Síntesis final
export {
  makeDecision,
  mergeDecisions,
  isSignificantDecision,
  type DecisionInputs,
  type DecisionMakerConfig
} from './DecisionMaker'

// 🆕 WAVE 667: Fuzzy Decision Maker - Lógica difusa
export {
  fuzzyEvaluate,
  debugFuzzify,
  getFuzzyRules,
  FuzzyDecisionMaker,
  type FuzzySet,
  type ZScoreFuzzySet,
  type SectionFuzzySet,
  type FuzzyInputs,
  type FuzzyOutputs,
  type FuzzyDecision,
  type FuzzyEvaluatorInput,
} from './FuzzyDecisionMaker'

// 🆕 WAVE 668: Drop Bridge - Override divino para momentos épicos
export {
  checkDropBridge,
  DropBridge,
  zScoreToProbability,
  describeZScore,
  type DropBridgeInput,
  type DropBridgeResult,
  type DropBridgeConfig,
} from './DropBridge'
