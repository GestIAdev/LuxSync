// ════════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 2482 — INFINITE ARSENAL · BARREL EXPORTS
// ════════════════════════════════════════════════════════════════════════════
//  Punto de entrada único para los módulos del Infinite Arsenal (Fase 0/1).
// ════════════════════════════════════════════════════════════════════════════

export * from './lfxTypes'
export {
  DynamicEffectRegistry,
  getDynamicEffectRegistry,
  __resetDynamicEffectRegistryForTests,
  type RegisterOptions,
} from './DynamicEffectRegistry'
export {
  SeleneHephBridge,
  getSeleneHephBridge,
  __resetSeleneHephBridgeForTests,
  type BridgeContext,
  type BridgeRoute,
  type ResolvedPlayParams,
  type PlayHook,
} from './SeleneHephBridge'
// 🏛️ WAVE 2483: Phase 2 — physical loader of `.lfx v2.1` from disk.
export {
  LfxFileLoader,
  getLfxFileLoader,
  __resetLfxFileLoaderForTests,
  type DirectorySpec,
  type EffectSource,
  type LoadReport,
} from './LfxFileLoader'

// 🧬 WAVE 4817: Phase 1 — LfxClipInstance (Atom + ArchetypeProjector).
export {
  LfxClipInstance,
  ARCHETYPE_BIAS_MAP,
  ENERGY_ZONES,
  COMPATIBLE_VIBES,
  USER_ARCHETYPES,
  type UserArchetype,
  type SpatialBehavior as InstanceSpatialBehavior,
  type CompatibleVibe,
  type EnergyZoneId,
  type AcoTriad,
  type ArchetypeBias,
  type LfxClipInstanceInit,
} from './LfxClipInstance'

// 🛡️ WAVE 4817: Phase 2 — GatekeeperLinter.
export {
  validateClip,
  listFiredRules,
  type WarningSeverity,
  type LinterRuleId,
  type LinterWarning,
  type LinterResult,
} from './GatekeeperLinter'

// 🔬 WAVE 4817: Phase 3 — inferArchetypes (semantic reverse-lookup).
export {
  inferArchetypeFromACO,
  inferArchetype,
  inferArchetypesBatch,
  semanticLabel,
  narrativeDescription,
  type ArchetypeInference,
  type ArchetypeCandidate,
} from './inferArchetypes'
