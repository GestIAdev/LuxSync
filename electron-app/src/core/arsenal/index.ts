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
