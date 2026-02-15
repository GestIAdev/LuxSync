/**
 * 🗃️ STORES INDEX - Export all stores
 * WAVE 9: Commander Layout State Management
 * WAVE 25: Universal Truth Protocol
 * WAVE 30: Control Store - Stage Command & Dashboard
 */

// Legacy store (mantener compatibilidad)
export { 
  useLuxSyncStore,
  type SeleneMode,
  type PaletteId,
  type MoodType,
  type MovementPattern,
  type Palette,
  type MovementParams,
  type SeleneState as LegacySeleneState,
  PALETTES,
} from './luxsyncStore'

// WAVE 9: New Commander Layout stores
export * from './navigationStore'
export * from './effectsStore'
export * from './seleneStore'
export * from './audioStore'
export * from './dmxStore'

// 🗃️ WAVE 26: Setup Command Center
export * from './setupStore'

// 🎮 WAVE 30: Control Store - Stage Command & Dashboard
export * from './controlStore'

// 🎯 WAVE 30.1: Selection & Override Stores
export * from './selectionStore'
export * from './overrideStore'

// � WAVE 32: Scene Engine & Snapshots
export * from './sceneStore'

// 🌙 WAVE 248: Universal Truth Protocol - TITAN 2.0 FUSION
export { 
  useTruthStore,
  selectAudio,
  selectBeat,
  selectPalette,
  selectGenre,
  selectSection,
  selectRhythm,
  selectMovement,
  selectEffects,
  selectSystem,
  selectCognitive,
  selectConsciousness,
  selectContext,
  selectHardware,
  selectColorParams,
  selectFPS,
  selectMode,
  selectBrainStatus,
  selectVibe,
  selectDream,
  selectZodiac,
  selectBeauty,
  selectEvolution,
  selectDropState,
  debugTruth,
  // 🛡️ WAVE 2042.12/2042.13: React 19 stable hooks
  useHardware,
  useColorParams,
  useAudio,
  useBeat,
  useRhythm,
} from './truthStore'

