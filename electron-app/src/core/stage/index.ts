/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 STAGE MODULE - WAVE 360 Phase 1
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Barrel export for all Stage-related types and utilities.
 * 
 * Usage:
 * import { ShowFileV2, FixtureV2, autoMigrate } from '@core/stage'
 */

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA V2
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Types - Physics
  type MotorType,
  type InstallationOrientation,
  type PhysicsProfile,
  
  // Types - Geometry
  type Position3D,
  type Rotation3D,
  
  // Types - Fixtures
  type CanonicalZone,
  type FixtureZone,
  type FixtureV2,
  type FixtureGroup,
  type FixtureSelector,  // 🔥 WAVE 2040.25 FASE 3
  
  // Types - Scenes
  type FixtureSnapshot,
  type SceneV2,
  
  // Types - Stage
  type StageDimensions,
  type StageVisuals,
  
  // Types - Config
  type DMXConfigV2,
  type AudioConfigV2,
  
  // Types - ShowFile
  type ShowFileV2,
  
  // Constants
  DEFAULT_PHYSICS_PROFILES,
  CANONICAL_ZONES,
  ZONE_LABELS,
  
  // Factory Functions
  createEmptyShowFile,
  createDefaultFixture,
  createFixtureGroup,
  
  // Zone Utilities (WAVE 2040.24)
  normalizeZone,
  isCanonicalZone,
  resolveFixtureSelector,  // 🔥 WAVE 2040.25 FASE 3
  
  // Validation
  validateShowFile,
  validateShowFileDeep,
  type ShowFileValidationResult,
  getSchemaVersion
} from './ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION
// ═══════════════════════════════════════════════════════════════════════════

export {
  type MigrationResult,
  migrateConfigV1ToV2,
  autoMigrate,
  migrateV2ToLatest,
  LATEST_V2_VERSION,
  parseLegacyScenes
} from './ShowFileMigrator'

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE - WAVE 365
// ═══════════════════════════════════════════════════════════════════════════

export {
  type ShowMetadataV2,
  type SaveResult,
  type LoadResult,
  type ListResult,
  StagePersistence,
  stagePersistence
} from './StagePersistence'

// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - WAVE 365
// ═══════════════════════════════════════════════════════════════════════════

export {
  setupStageIPCHandlers,
  type StagePreloadAPI
} from './StageIPCHandlers'

// ═══════════════════════════════════════════════════════════════════════════
// LOCALSTORAGE MIGRATION - WAVE 367
// ═══════════════════════════════════════════════════════════════════════════

export {
  extractLegacyScenesFromLocalStorage,
  convertLegacySceneToV2,
  migrateLegacyScenesToV2,
  purgeLegacyLocalStorageScenes,
  runLocalStorageMigration,
  needsLocalStorageMigration
} from './LocalStorageSceneMigrator'
