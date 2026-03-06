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
// Constants
DEFAULT_PHYSICS_PROFILES, CANONICAL_ZONES, ZONE_LABELS, 
// Factory Functions
createEmptyShowFile, createDefaultFixture, createFixtureGroup, 
// Zone Utilities (WAVE 2040.24)
normalizeZone, isCanonicalZone, resolveFixtureSelector, // 🔥 WAVE 2040.25 FASE 3
// Validation
validateShowFile, validateShowFileDeep, getSchemaVersion } from './ShowFileV2';
// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION
// ═══════════════════════════════════════════════════════════════════════════
export { migrateConfigV1ToV2, autoMigrate, migrateV2ToLatest, LATEST_V2_VERSION, parseLegacyScenes } from './ShowFileMigrator';
// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE - WAVE 365
// ═══════════════════════════════════════════════════════════════════════════
export { StagePersistence, stagePersistence } from './StagePersistence';
// ═══════════════════════════════════════════════════════════════════════════
// IPC HANDLERS - WAVE 365
// ═══════════════════════════════════════════════════════════════════════════
export { setupStageIPCHandlers } from './StageIPCHandlers';
// ═══════════════════════════════════════════════════════════════════════════
// LOCALSTORAGE MIGRATION - WAVE 367
// ═══════════════════════════════════════════════════════════════════════════
export { extractLegacyScenesFromLocalStorage, convertLegacySceneToV2, migrateLegacyScenesToV2, purgeLegacyLocalStorageScenes, runLocalStorageMigration, needsLocalStorageMigration } from './LocalStorageSceneMigrator';
