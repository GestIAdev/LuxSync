/**
 * 🗃️ STORES INDEX - Export all stores
 * WAVE 9: Commander Layout State Management
 * WAVE 25: Universal Truth Protocol
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

// 🌙 WAVE 25: Universal Truth Protocol - THE NEW HEART
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
  selectPrediction,
  selectHardware,
  selectColorParams,
  selectFPS,
  selectMode,
  selectBrainStatus,
  debugTruth,
} from './truthStore'
