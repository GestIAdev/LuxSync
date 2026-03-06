/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔄 SHOWFILE MIGRATOR - WAVE 360 Phase 1
 * "La Cirugía de Transplante de Órganos"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Migración silenciosa de configuraciones v1 a ShowFile v2.
 *
 * El usuario NO notará nada. Simplemente su viejo config.json
 * será leído, transformado y guardado en el nuevo formato.
 *
 * REGLA: El primer fixture sin posición recibe una posición generada
 *        basada en su zona. Después de eso, SIEMPRE se persiste.
 *
 * @module core/stage/ShowFileMigrator
 * @version 360.1.0
 */
import { DEFAULT_PHYSICS_PROFILES, createEmptyShowFile, getSchemaVersion, normalizeZone } from './ShowFileV2';
// ═══════════════════════════════════════════════════════════════════════════
// POSITION GENERATION (One-time only for migration)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Stage reference dimensions for position generation
 */
const STAGE_REF = {
    width: 12, // meters
    depth: 8, // meters
    height: 5 // meters (truss height)
};
/**
 * Zone position templates
 * These are used ONLY during migration for fixtures without positions
 */
const ZONE_POSITIONS = {
    // 🔥 WAVE 2040.24: Canonical zone positions
    'front': { x: 0, y: 4.5, z: 2 },
    'back': { x: 0, y: 4.5, z: -2 },
    'floor': { x: 0, y: 0.3, z: 3 },
    'movers-left': { x: -4.5, y: 3.0, z: 0 },
    'movers-right': { x: 4.5, y: 3.0, z: 0 },
    'center': { x: 0, y: 4.5, z: 0 },
    'air': { x: 0, y: 3.5, z: -1 },
    'ambient': { x: 0, y: 3.0, z: 0 },
    'unassigned': { x: 0, y: 3.0, z: 0 }
};
/**
 * Generate position for a fixture based on its zone and index
 * Used ONLY during migration when no position exists
 */
function generateMigrationPosition(zone, indexInZone) {
    const basePos = ZONE_POSITIONS[zone] || ZONE_POSITIONS['unassigned'];
    // Spread fixtures within zone (offset by index)
    const spreadX = (indexInZone % 3 - 1) * 1.5; // -1.5, 0, 1.5
    const spreadZ = Math.floor(indexInZone / 3) * 1.0;
    return {
        x: basePos.x + spreadX,
        y: basePos.y,
        z: basePos.z + spreadZ
    };
}
/**
 * Generate default rotation based on zone (WAVE 2040.24: canonical zones)
 */
function generateMigrationRotation(zone) {
    // Floor fixtures point up
    if (zone === 'floor') {
        return { pitch: 45, yaw: 0, roll: 0 };
    }
    // Back/air fixtures point down-forward
    if (zone === 'back' || zone === 'air') {
        return { pitch: -45, yaw: 0, roll: 0 };
    }
    // Center (strobes/blinders) point straight down
    if (zone === 'center') {
        return { pitch: -60, yaw: 0, roll: 0 };
    }
    // Front pars point down at audience
    if (zone === 'front') {
        return { pitch: -30, yaw: 0, roll: 0 };
    }
    // Default: forward
    return { pitch: 0, yaw: 0, roll: 0 };
}
// ═══════════════════════════════════════════════════════════════════════════
// ZONE MAPPING (WAVE 2040.24: CANONICAL)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔥 WAVE 2040.24 FASE 6: Map old zone string → CanonicalZone
 * Delega toda la lógica a normalizeZone() para una sola fuente de verdad.
 */
function mapZone(oldZone) {
    return normalizeZone(oldZone);
}
/**
 * Map old fixture type to new type
 */
function mapFixtureType(oldType) {
    const typeMap = {
        'moving-head': 'moving-head',
        'mover': 'moving-head',
        'spot': 'moving-head',
        'beam': 'moving-head',
        'par': 'par',
        'led-par': 'par',
        'wash': 'wash',
        'strobe': 'strobe',
        'laser': 'laser',
        'blinder': 'blinder'
    };
    const normalized = oldType.toLowerCase().trim();
    return typeMap[normalized] || 'generic';
}
// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS INFERENCE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Infer motor type from fixture name/manufacturer
 * Conservative approach: default to stepper-cheap for safety
 */
function inferMotorType(name, manufacturer) {
    const lowName = name.toLowerCase();
    const lowMfr = manufacturer.toLowerCase();
    // Pro brands with servo motors
    const proServo = ['robe', 'clay paky', 'martin', 'vari-lite', 'ayrton'];
    for (const brand of proServo) {
        if (lowMfr.includes(brand)) {
            return { ...DEFAULT_PHYSICS_PROFILES['servo-pro'] };
        }
    }
    // Quality brands with good steppers
    const qualityStepper = ['adj', 'chauvet', 'elation', 'american dj'];
    for (const brand of qualityStepper) {
        if (lowMfr.includes(brand)) {
            return { ...DEFAULT_PHYSICS_PROFILES['stepper-quality'] };
        }
    }
    // Default: cheap stepper (safest assumption)
    // 🛡️ THE LIFE INSURANCE - Assume the worst, be pleasantly surprised
    return { ...DEFAULT_PHYSICS_PROFILES['stepper-cheap'] };
}
/**
 * Migrate a V1 config to V2 ShowFile
 */
export function migrateConfigV1ToV2(configV1, scenes = [], showName = 'Migrated Show') {
    const warnings = [];
    // Create empty show as base
    const show = createEmptyShowFile(showName);
    show.description = `Migrated from LuxSync config v${configV1.version}`;
    // ═══════════════════════════════════════════════════════════════════════
    // MIGRATE FIXTURES
    // ═══════════════════════════════════════════════════════════════════════
    // Count fixtures per zone for position spreading
    const zoneCounts = {};
    const fixtures = configV1.patchedFixtures.map((oldFix) => {
        const zone = mapZone(oldFix.zone);
        const indexInZone = zoneCounts[zone] || 0;
        zoneCounts[zone] = indexInZone + 1;
        const physics = inferMotorType(oldFix.name, oldFix.manufacturer);
        return {
            id: oldFix.id,
            name: oldFix.name,
            model: oldFix.name,
            manufacturer: oldFix.manufacturer,
            type: mapFixtureType(oldFix.type),
            address: oldFix.dmxAddress,
            universe: oldFix.universe,
            channelCount: oldFix.channelCount,
            profileId: oldFix.filePath || 'generic',
            position: generateMigrationPosition(zone, indexInZone),
            rotation: generateMigrationRotation(zone),
            physics,
            zone,
            definitionPath: oldFix.filePath,
            enabled: true
        };
    });
    show.fixtures = fixtures;
    // ═══════════════════════════════════════════════════════════════════════
    // MIGRATE SCENES (from localStorage data)
    // ═══════════════════════════════════════════════════════════════════════
    const migratedScenes = scenes.map((oldScene, index) => {
        const snapshots = Object.entries(oldScene.fixtures || {}).map(([fixtureId, values]) => ({
            fixtureId,
            values: values
        }));
        return {
            id: oldScene.id,
            name: oldScene.name || `Scene ${index + 1}`,
            description: 'Migrated from localStorage',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            fadeTime: 500,
            tags: ['migrated'],
            previewColor: '#00f3ff',
            snapshots
        };
    });
    show.scenes = migratedScenes;
    // ═══════════════════════════════════════════════════════════════════════
    // CREATE DEFAULT GROUPS
    // ═══════════════════════════════════════════════════════════════════════
    const groups = [];
    // Auto-create zone-based groups
    const fixturesByZone = new Map();
    for (const fix of fixtures) {
        if (!fixturesByZone.has(fix.zone)) {
            fixturesByZone.set(fix.zone, []);
        }
        fixturesByZone.get(fix.zone).push(fix.id);
    }
    let groupOrder = 0;
    for (const [zone, ids] of fixturesByZone) {
        if (ids.length > 1) { // Only create group if multiple fixtures
            groups.push({
                id: `group-zone-${zone}`,
                name: zone.replace('-', ' ').toUpperCase(),
                fixtureIds: ids,
                color: '#00f3ff',
                isSystem: true,
                order: groupOrder++
            });
        }
    }
    // Auto-create type-based groups
    const fixturesByType = new Map();
    for (const fix of fixtures) {
        if (!fixturesByType.has(fix.type)) {
            fixturesByType.set(fix.type, []);
        }
        fixturesByType.get(fix.type).push(fix.id);
    }
    for (const [type, ids] of fixturesByType) {
        if (ids.length > 1 && type !== 'generic') {
            groups.push({
                id: `group-type-${type}`,
                name: `All ${type.replace('-', ' ')}s`,
                fixtureIds: ids,
                color: '#f54a00',
                isSystem: true,
                order: groupOrder++
            });
        }
    }
    // "All" group
    if (fixtures.length > 0) {
        groups.push({
            id: 'group-all',
            name: 'ALL FIXTURES',
            fixtureIds: fixtures.map(f => f.id),
            color: '#ffffff',
            hotkey: '0',
            isSystem: true,
            order: 999
        });
    }
    show.groups = groups;
    // ═══════════════════════════════════════════════════════════════════════
    // MIGRATE DMX CONFIG
    // ═══════════════════════════════════════════════════════════════════════
    if (configV1.dmxConfig) {
        show.dmx = {
            driver: configV1.dmxConfig.driver || 'virtual',
            port: configV1.dmxConfig.port || '',
            universes: [0], // Default, will be expanded based on fixtures
            frameRate: 40
        };
        // Auto-detect universes from fixtures
        const universes = new Set();
        for (const fix of fixtures) {
            universes.add(fix.universe);
        }
        show.dmx.universes = Array.from(universes).sort((a, b) => a - b);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MIGRATE AUDIO CONFIG
    // ═══════════════════════════════════════════════════════════════════════
    if (configV1.audioConfig) {
        show.audio = {
            source: configV1.audioConfig.source || 'simulation',
            deviceId: configV1.audioConfig.deviceId,
            deviceName: configV1.audioConfig.deviceName,
            sensitivity: configV1.audioConfig.sensitivity || 0.7,
            inputGain: configV1.audioConfig.inputGain || 1.0
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // RESULT
    // ═══════════════════════════════════════════════════════════════════════
    return {
        success: true,
        showFile: show,
        warnings,
        fixturesCount: fixtures.length,
        scenesCount: migratedScenes.length,
        groupsCount: groups.length
    };
}
/**
 * Ordered list of V2 incremental patches.
 * Currently empty — schema is at 2.0.0 with no patches needed yet.
 *
 * Example future patch:
 * {
 *   fromVersion: '2.0.0',
 *   toVersion: '2.1.0',
 *   description: 'Add fixture.tags[] field',
 *   apply: (show) => {
 *     const fixtures = show.fixtures as Array<Record<string, unknown>>
 *     for (const f of fixtures) {
 *       if (!Array.isArray(f.tags)) f.tags = []
 *     }
 *   }
 * }
 */
const V2_PATCHES = [
    // ── PATCHES GO HERE IN ORDER ──
    // Each patch bumps schemaVersion from fromVersion → toVersion.
    // They execute sequentially: 2.0.0 → 2.1.0 → 2.2.0 → ...
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2093.2 (CW-AUDIT-4): Unify invert source of truth
    // 
    // BEFORE: physics.invertPan and calibration.panInvert could disagree,
    //         causing double-invert or silent override depending on code path.
    // AFTER:  calibration.panInvert is THE MASTER. physics.invertPan is frozen
    //         at false (deprecated). Any pre-existing physics.invertPan=true
    //         is migrated INTO calibration.panInvert if calibration doesn't
    //         already have its own value.
    // ═══════════════════════════════════════════════════════════════════════
    {
        fromVersion: '2.0.0',
        toVersion: '2.1.0',
        description: 'CW-AUDIT-4: Migrate physics.invertPan/Tilt → calibration.panInvert/tiltInvert (single source of truth)',
        apply: (show) => {
            const fixtures = show.fixtures;
            for (const f of fixtures) {
                const physics = f.physics;
                const calibration = f.calibration;
                // Ensure calibration object exists
                if (!calibration) {
                    f.calibration = {
                        panOffset: 0,
                        tiltOffset: 0,
                        panInvert: physics?.invertPan ?? false,
                        tiltInvert: physics?.invertTilt ?? false,
                    };
                }
                else {
                    // Only migrate if calibration doesn't already have its own explicit value
                    // (i.e., if the tech manually set it in CalibrationView, respect that)
                    if (calibration.panInvert === undefined || calibration.panInvert === null) {
                        calibration.panInvert = physics?.invertPan ?? false;
                    }
                    if (calibration.tiltInvert === undefined || calibration.tiltInvert === null) {
                        calibration.tiltInvert = physics?.invertTilt ?? false;
                    }
                }
                // Freeze physics.invertPan/Tilt to false (deprecated — no longer read by runtime)
                if (physics) {
                    physics.invertPan = false;
                    physics.invertTilt = false;
                }
            }
        }
    },
];
/** Current latest V2 schema version */
export const LATEST_V2_VERSION = '2.1.0';
/**
 * Migrate a V2 show file through all incremental patches to latest.
 *
 * - If already at latest, returns as-is (zero-copy).
 * - If patches are needed, applies them in order and logs each.
 * - Pure function: does NOT mutate the original if no patches apply.
 *
 * @returns The show at latest version + array of applied patch descriptions
 */
export function migrateV2ToLatest(show) {
    const appliedPatches = [];
    // Fast path: already at latest
    if (show.schemaVersion === LATEST_V2_VERSION && V2_PATCHES.length === 0) {
        return { show, appliedPatches };
    }
    // Work on a shallow clone to avoid mutating the original
    const mutable = { ...show };
    let currentVersion = String(mutable.schemaVersion || '2.0.0');
    for (const patch of V2_PATCHES) {
        if (patch.fromVersion === currentVersion) {
            console.log(`[ShowFileMigrator] 🔄 V2 patch: ${patch.description} (${patch.fromVersion} → ${patch.toVersion})`);
            patch.apply(mutable);
            mutable.schemaVersion = patch.toVersion;
            currentVersion = patch.toVersion;
            appliedPatches.push(patch.description);
        }
    }
    if (appliedPatches.length > 0) {
        console.log(`[ShowFileMigrator] ✅ V2 migration complete: ${appliedPatches.length} patches applied → v${currentVersion}`);
    }
    return { show: mutable, appliedPatches };
}
/**
 * Detect if data is V1 or V2 and migrate if needed
 */
export function autoMigrate(data) {
    const version = getSchemaVersion(data);
    if (version === '2.0.0') {
        // Already V2 — run through incremental patches (CW-10)
        const { show: patched, appliedPatches } = migrateV2ToLatest(data);
        return {
            success: true,
            showFile: patched,
            warnings: appliedPatches.length > 0
                ? [`V2 incremental migration: ${appliedPatches.length} patches applied`]
                : [],
            fixturesCount: patched.fixtures.length,
            scenesCount: patched.scenes.length,
            groupsCount: patched.groups.length
        };
    }
    if (version === '1.0.0') {
        // V1 needs migration
        return migrateConfigV1ToV2(data);
    }
    // Unknown format
    return {
        success: false,
        showFile: null,
        warnings: ['Unknown config format, cannot migrate'],
        fixturesCount: 0,
        scenesCount: 0,
        groupsCount: 0
    };
}
/**
 * Extract scenes from localStorage format (browser-side migration helper)
 */
export function parseLegacyScenes(localStorageData) {
    if (!localStorageData)
        return [];
    try {
        const data = JSON.parse(localStorageData);
        if (Array.isArray(data)) {
            return data;
        }
        return [];
    }
    catch {
        return [];
    }
}
