/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🪦 ARBITER TYPES — Survivor barrel post WAVE 4704
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ArbitrationDirector, MasterArbiter, CrossfadeEngine, MergeStrategies y
 * LayerStateManager han sido eliminados físicamente en WAVE 4704.
 * Este barrel mantiene SOLO los tipos que aún tienen dependencias activas:
 *   - ControlLayer      → usado en HardwareAbstraction.ts
 *   - EffectIntent/Map  → usado en TitanOrchestrator + IntentComposer
 *   - Layer0_Titan, FinalLightingTarget, etc. → tipos de pipeline Aether
 *
 * @module core/arbiter
 * @version WAVE 4704 (RIP masterArbiter)
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (únicos supervivientes)
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
