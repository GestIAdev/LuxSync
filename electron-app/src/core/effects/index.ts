/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧨 EFFECTS MODULE - PUBLIC API
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 600: EFFECT ARSENAL
 * 
 * Exporta todo lo necesario para usar el sistema de efectos.
 * 
 * @module core/effects
 * @version WAVE 600
 */

// Types
export type {
  EffectCategory,
  EffectPhase,
  EffectZone,
  EffectFrameOutput,
  EffectTriggerConfig,
  ILightEffect,
  EffectManagerState,
  CombinedEffectOutput,
  ConsciousnessEffectDecision,
} from './types'

// Effect Manager
export { 
  EffectManager, 
  getEffectManager, 
  resetEffectManager 
} from './EffectManager'

