/**
 * 🏛️ WAVE 200 + 367: Config Exports
 * 
 * WAVE 367: ConfigManager → ConfigManagerV2 (preferences only, no fixtures)
 */

export { FLAGS, type FeatureFlag } from './FeatureFlags'

// WAVE 367: ConfigManagerV2 - App Preferences Only (no fixtures!)
export {
  configManager,
  type LuxSyncPreferencesV2,
  type DMXInterfaceConfig,
  type AudioInputConfig,
  type UIPreferences,
  // Legacy compatibility alias
  type PatchedFixtureConfig
} from './ConfigManagerV2'
