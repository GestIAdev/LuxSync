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

// 🚀 WAVE 7580: Vanguard Launcher — render fidelity tiers.
// Exported from the pure module rather than via ConfigManagerV2 so that
// importing the scoring helpers never drags in `electron` at runtime.
export {
  scoreHardware,
  shouldShowLauncher,
  isPerformanceTier,
  coercePerformanceTier,
  createDefaultPerformanceProfile,
  PERFORMANCE_TIERS,
  FORCE_LAUNCHER_FLAG,
  type PerformanceTier,
  type HardwareProfile,
  type PerformanceProfile
} from './performanceTiers'
