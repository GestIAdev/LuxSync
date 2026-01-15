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
