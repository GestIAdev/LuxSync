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
  type FixtureZone,
  type FixtureV2,
  type FixtureGroup,
  
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
  
  // Factory Functions
  createEmptyShowFile,
  createDefaultFixture,
  createFixtureGroup,
  
  // Validation
  validateShowFile,
  getSchemaVersion
} from './ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION
// ═══════════════════════════════════════════════════════════════════════════

export {
  type MigrationResult,
  migrateConfigV1ToV2,
  autoMigrate,
  parseLegacyScenes
} from './ShowFileMigrator'
