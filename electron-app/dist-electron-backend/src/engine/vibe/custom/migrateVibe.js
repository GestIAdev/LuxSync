/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 migrateVibe.ts — Schema Migration Pipeline for .luxvibe documents
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROTEUS §6.9: Backward-compatibility framework for .luxvibe files.
 *
 * When the `LUXVIBE_SCHEMA_VERSION` bumps (e.g., from 1 to 2), old user files
 * on disk still have `schemaVersion: 1`. Without a migration pipeline, the
 * type guard `isCustomVibeOverride()` rejects them (it checks
 * `schemaVersion !== LUXVIBE_SCHEMA_VERSION`), and the file becomes unloadable
 * — effectively bricking the user's saved vibes.
 *
 * This module provides:
 *   1. `migrateVibeDoc(raw)` — inspects the parsed JSON's schemaVersion and
 *      runs it through a chain of per-version migration functions until it
 *      reaches the current `LUXVIBE_SCHEMA_VERSION`.
 *   2. `MIGRATIONS` — a registry of `{ fromVersion, toVersion, migrate }`
 *      entries. Today this is empty (we're on v1), but the structure is in
 *      place so that adding a v1→v2 migration is a single entry.
 *
 * Usage in VibeLabPersistence.read():
 *   ```ts
 *   const raw = JSON.parse(content)
 *   const migrated = migrateVibeDoc(raw)
 *   if (!isCustomVibeOverride(migrated)) return { ok: false, error: '...' }
 *   return { ok: true, data: migrated }
 *   ```
 *
 * @module engine/vibe/custom/migrateVibe
 * @version PROTEUS §6.9
 */
import { LUXVIBE_SCHEMA_VERSION, isCustomVibeOverride, } from '../../../types/CustomVibe';
// ═══════════════════════════════════════════════════════════════════════════
// MIGRATION REGISTRY
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Ordered list of migrations. Each entry upgrades from `fromVersion` to
 * `toVersion`. The pipeline runs them in sequence until the document reaches
 * `LUXVIBE_SCHEMA_VERSION`.
 *
 * ── CURRENT STATE ──
 * We are on schema version 1. No migrations exist yet. When v2 is introduced:
 *
 *   ```ts
 *   MIGRATIONS.push({
 *     fromVersion: 1,
 *     toVersion: 2,
 *     description: 'Rename macros.shielded → macros.protected (safety rename)',
 *     migrate(doc) {
 *       const macros = doc.macros as Record<string, unknown> | undefined
 *       if (macros && 'shielded' in macros) {
 *         macros.protected = macros.shielded
 *         delete macros.shielded
 *       }
 *       doc.schemaVersion = 2
 *       return doc
 *     },
 *   })
 *   ```
 *
 * The pipeline will automatically find and run this when it encounters a
 * v1 document. No other code needs to change.
 */
export const MIGRATIONS = [
// ── No migrations yet (schema v1 is the current version) ──
// Add v1→v2, v2→v3, etc. here as the schema evolves.
];
/**
 * Migrates a parsed .luxvibe JSON document to the current `LUXVIBE_SCHEMA_VERSION`.
 *
 * The function:
 *   1. Reads `schemaVersion` from the raw document (defaults to 1 if missing).
 *   2. If already at current version, returns the document as-is.
 *   3. Finds the next migration step (fromVersion === currentVersion) and applies it.
 *   4. Repeats until the document reaches `LUXVIBE_SCHEMA_VERSION`.
 *   5. If no migration is found for the current version, returns `ok: false`
 *      with an error explaining the gap.
 *
 * This is a pure function — it does not mutate the input (it shallow-clones
 * the doc before applying migrations).
 *
 * @param raw The parsed JSON from a .luxvibe file (pre-type-guard).
 * @returns `MigrateResult` with the migrated document or an error.
 */
export function migrateVibeDoc(raw) {
    if (typeof raw !== 'object' || raw === null) {
        return {
            ok: false,
            originalVersion: -1,
            finalVersion: -1,
            error: 'Document is not an object',
            appliedMigrations: [],
        };
    }
    // Shallow clone so we don't mutate the caller's object
    let doc = { ...raw };
    const originalVersion = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1;
    let currentVersion = originalVersion;
    const appliedMigrations = [];
    if (currentVersion === LUXVIBE_SCHEMA_VERSION) {
        // Already at current version — no migration needed
        return {
            ok: true,
            data: doc,
            originalVersion,
            finalVersion: currentVersion,
            appliedMigrations,
        };
    }
    // Walk the migration chain
    while (currentVersion < LUXVIBE_SCHEMA_VERSION) {
        const migration = MIGRATIONS.find((m) => m.fromVersion === currentVersion);
        if (!migration) {
            return {
                ok: false,
                data: doc,
                originalVersion,
                finalVersion: currentVersion,
                error: `No migration found from schema version ${currentVersion} to ${currentVersion + 1}. The file may be from a newer or unsupported version of LuxSync.`,
                appliedMigrations,
            };
        }
        try {
            doc = migration.migrate(doc);
            currentVersion = migration.toVersion;
            appliedMigrations.push(migration.description);
        }
        catch (err) {
            return {
                ok: false,
                data: doc,
                originalVersion,
                finalVersion: currentVersion,
                error: `Migration ${migration.fromVersion}→${migration.toVersion} failed: ${err instanceof Error ? err.message : String(err)}`,
                appliedMigrations,
            };
        }
    }
    return {
        ok: true,
        data: doc,
        originalVersion,
        finalVersion: currentVersion,
        appliedMigrations,
    };
}
/**
 * Convenience wrapper: migrates the raw document and returns it typed as
 * `CustomVibeOverride` if the migration succeeded AND the result passes the
 * structural type guard.
 *
 * This is the function that VibeLabPersistence.read() should call before
 * returning the document to the store.
 *
 * @param raw The parsed JSON from a .luxvibe file.
 * @returns `{ ok: true, data: CustomVibeOverride }` or `{ ok: false, error }`.
 */
export function migrateAndValidate(raw) {
    const result = migrateVibeDoc(raw);
    if (!result.ok || !result.data) {
        return { ok: false, error: result.error };
    }
    // Use the statically imported type guard (ESM-safe, no require)
    if (!isCustomVibeOverride(result.data)) {
        return {
            ok: false,
            error: `Document failed structural validation after migration (v${result.originalVersion} → v${result.finalVersion})`,
            migrationsApplied: result.appliedMigrations,
        };
    }
    return {
        ok: true,
        data: result.data,
        migrationsApplied: result.appliedMigrations,
    };
}
/**
 * Returns the current schema version (re-exported for convenience).
 */
export const CURRENT_SCHEMA_VERSION = LUXVIBE_SCHEMA_VERSION;
