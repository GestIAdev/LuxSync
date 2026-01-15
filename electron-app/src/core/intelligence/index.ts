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
// COGNICIÓN (TODO: PHASE 3)
// ═══════════════════════════════════════════════════════════════════════════

// export * from './think'

// ═══════════════════════════════════════════════════════════════════════════
// META-CONSCIENCIA (TODO: PHASE 4)
// ═══════════════════════════════════════════════════════════════════════════

// export * from './dream'
