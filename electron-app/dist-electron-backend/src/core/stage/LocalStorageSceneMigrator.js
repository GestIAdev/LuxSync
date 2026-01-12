/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🧹 LOCALSTORAGE SCENE MIGRATOR - WAVE 367: SPRING CLEANING
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module handles the one-time migration of scenes from localStorage
 * (used by sceneStore.ts via Zustand persist) into the active ShowFileV2.
 *
 * MIGRATION FLOW:
 * 1. Renderer reads localStorage('luxsync-scenes')
 * 2. Converts Zustand persist format to SceneV2[]
 * 3. Injects into active ShowFileV2 via stageStore
 * 4. Clears localStorage keys on success
 * 5. Marks migration complete in ConfigManager
 *
 * This code runs ONCE per installation during the V1→V2 upgrade.
 *
 * @module core/stage/LocalStorageSceneMigrator
 * @version 367.0.0
 */
// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const LOCALSTORAGE_KEY = 'luxsync-scenes';
// ═══════════════════════════════════════════════════════════════════════════════
// MIGRATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Extract legacy scenes from localStorage
 * Returns empty array if no data or invalid format
 */
export function extractLegacyScenesFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!raw) {
            console.log('[SceneMigrator] No localStorage scenes found');
            return [];
        }
        const parsed = JSON.parse(raw);
        // Zustand persist wraps state
        if (parsed.state && Array.isArray(parsed.state.scenes)) {
            console.log(`[SceneMigrator] Found ${parsed.state.scenes.length} legacy scenes in localStorage`);
            return parsed.state.scenes;
        }
        // Maybe it's raw array (older format?)
        if (Array.isArray(parsed)) {
            console.log(`[SceneMigrator] Found ${parsed.length} legacy scenes (raw array format)`);
            return parsed;
        }
        console.warn('[SceneMigrator] Unrecognized localStorage format');
        return [];
    }
    catch (error) {
        console.error('[SceneMigrator] Error reading localStorage:', error);
        return [];
    }
}
/**
 * Convert a legacy scene to SceneV2 format
 */
export function convertLegacySceneToV2(legacy, index) {
    // Generate deterministic ID (NO Math.random)
    const sceneId = `scene_migrated_${index}_${legacy.createdAt}`;
    // Convert overrides to V2 snapshots format
    const snapshots = Object.entries(legacy.overrides).map(([fixtureId, override]) => ({
        fixtureId,
        values: {
            dimmer: override.values.dimmer,
            h: override.values.h,
            s: override.values.s,
            l: override.values.l,
            r: override.values.r,
            g: override.values.g,
            b: override.values.b,
            w: override.values.w,
            pan: override.values.pan,
            tilt: override.values.tilt,
            focus: override.values.focus,
            zoom: override.values.zoom,
            // gobo: convert string to number if needed (or undefined)
            gobo: typeof override.values.gobo === 'number' ? override.values.gobo : undefined,
            prism: override.values.prism,
        },
    }));
    const converted = {
        id: sceneId,
        name: legacy.name,
        description: `Migrated from localStorage on ${new Date().toISOString()}`,
        createdAt: new Date(legacy.createdAt).toISOString(),
        modifiedAt: legacy.updatedAt
            ? new Date(legacy.updatedAt).toISOString()
            : new Date(legacy.createdAt).toISOString(),
        snapshots,
        fadeTime: legacy.metadata.fadeTime || 500,
        tags: legacy.metadata.tags || [],
        previewColor: legacy.metadata.previewColor || '#00ffff',
    };
    return converted;
}
/**
 * Convert all legacy scenes to V2 format
 */
export function migrateLegacyScenesToV2(legacyScenes) {
    return legacyScenes.map((scene, index) => convertLegacySceneToV2(scene, index));
}
/**
 * Purge localStorage scene data
 * Called after successful migration
 */
export function purgeLegacyLocalStorageScenes() {
    try {
        localStorage.removeItem(LOCALSTORAGE_KEY);
        console.log('[SceneMigrator] 🗑️ Purged localStorage scenes');
        // Also check for any other lux_scenes_* keys (legacy)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('lux_scenes_') || key.startsWith('luxsync-scene'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`[SceneMigrator] 🗑️ Purged legacy key: ${key}`);
        });
        console.log(`[SceneMigrator] ✅ Cleanup complete (${keysToRemove.length + 1} keys removed)`);
    }
    catch (error) {
        console.error('[SceneMigrator] Error purging localStorage:', error);
    }
}
/**
 * Full migration: Extract → Convert → Return V2 scenes
 * Does NOT automatically purge - caller decides when to purge after confirming success
 */
export function runLocalStorageMigration() {
    const legacy = extractLegacyScenesFromLocalStorage();
    if (legacy.length === 0) {
        return [];
    }
    const migrated = migrateLegacyScenesToV2(legacy);
    console.log(`[SceneMigrator] ✅ Converted ${migrated.length} scenes to V2 format`);
    return migrated;
}
// ═══════════════════════════════════════════════════════════════════════════════
// REACT HOOK HELPER (for use in renderer)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Check if migration is needed (has localStorage data and not yet migrated)
 */
export function needsLocalStorageMigration() {
    try {
        const raw = localStorage.getItem(LOCALSTORAGE_KEY);
        if (!raw)
            return false;
        const parsed = JSON.parse(raw);
        return parsed.state?.scenes?.length > 0;
    }
    catch {
        return false;
    }
}
