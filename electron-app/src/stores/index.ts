/**
 * 🗃️ STORES INDEX - Export all stores
 * WAVE 9: Commander Layout State Management
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
