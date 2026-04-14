/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MASTER ARBITER - BARREL EXPORT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 373: Central control hierarchy for LuxSync.
 * 
 * @module core/arbiter
 * @version WAVE 373
 */

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CLASS & SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

export { MasterArbiter, masterArbiter } from './MasterArbiter'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Enums
  ControlLayer,
  
  // Types
  type ChannelType,
  type MergeStrategy,
  type ConsciousMood,
  type ManualControlSource,
  type EffectType,
  
  // Layer interfaces
  type Layer0_Titan,
  type Layer1_Consciousness,
  type Layer2_Manual,
  type Layer2_ManualGroup,
  type Layer3_Effect,
  
  // Modifier interfaces
  type PaletteModifier,
  type MovementModifier,
  type ManualControls,
  
  // Output interfaces
  type FinalLightingTarget,
  type FixtureLightingTarget,
  type GlobalEffectsState,
  type RGBOutput,

  // 🎯 WAVE 2662: Effect Intent types
  type EffectIntent,
  type EffectIntentMap,
  
  // Config
  type MasterArbiterConfig,
  DEFAULT_ARBITER_CONFIG,
  DEFAULT_MERGE_STRATEGIES,
  
  // Internal types
  type ChannelValue,
  type MergeResult,
  type FixtureValues,
  type CrossfadeResult,
  type TransitionState,
  type ArbiterFixture,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// MERGE STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

export {
  mergeHTP,
  mergeLTP,
  mergeBLEND,
  mergeOVERRIDE,
  mergeChannel,
  getDefaultStrategy,
  isHTPChannel,
  isLTPChannel,
  clampDMX,
  dmxToNormalized,
  normalizedToDMX,
} from './merge/MergeStrategies'

// ═══════════════════════════════════════════════════════════════════════════
// CROSSFADE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export {
  CrossfadeEngine,
  globalCrossfadeEngine,
  easeInOutCubic,
  easeOutCubic,
  easeInCubic,
  linear,
} from './CrossfadeEngine'

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS (WAVE 376)
// ═══════════════════════════════════════════════════════════════════════════

export {
  registerArbiterHandlers,
} from './ArbiterIPCHandlers'
