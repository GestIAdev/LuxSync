/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📄 SHOWFILE V2 SCHEMA - WAVE 360 Phase 1
 * "La Memoria Fotográfica de LuxSync"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este archivo define la estructura de datos para el nuevo sistema de
 * persistencia. Reemplaza el viejo config.json con un formato más robusto
 * que soporta:
 *
 * - Posiciones 3D reales (no algorítmicas)
 * - Rotación base de fixtures
 * - Grupos de fixtures
 * - Zonas explícitas
 * - Perfiles de seguridad física
 * - Escenas (migradas desde localStorage)
 *
 * @module core/stage/ShowFileV2
 * @version 360.1.0
 */
/**
 * Default physics profiles by motor type
 */
export const DEFAULT_PHYSICS_PROFILES = {
    'servo-pro': {
        motorType: 'servo-pro',
        maxAcceleration: 4000,
        maxVelocity: 800,
        safetyCap: false,
        orientation: 'ceiling',
        invertPan: false,
        invertTilt: false,
        swapPanTilt: false,
        homePosition: { pan: 127, tilt: 127 },
        tiltLimits: { min: 20, max: 200 }
    },
    'stepper-quality': {
        motorType: 'stepper-quality',
        maxAcceleration: 2500,
        maxVelocity: 600,
        safetyCap: true,
        orientation: 'ceiling',
        invertPan: false,
        invertTilt: false,
        swapPanTilt: false,
        homePosition: { pan: 127, tilt: 127 },
        tiltLimits: { min: 20, max: 200 }
    },
    'stepper-cheap': {
        motorType: 'stepper-cheap',
        maxAcceleration: 1500, // 🛡️ THE LIFE INSURANCE - Low acceleration for cheap motors
        maxVelocity: 400,
        safetyCap: true,
        orientation: 'ceiling',
        invertPan: false,
        invertTilt: false,
        swapPanTilt: false,
        homePosition: { pan: 127, tilt: 127 },
        tiltLimits: { min: 30, max: 180 }
    },
    'unknown': {
        motorType: 'unknown',
        maxAcceleration: 2000, // Conservative default
        maxVelocity: 500,
        safetyCap: true,
        orientation: 'ceiling',
        invertPan: false,
        invertTilt: false,
        swapPanTilt: false,
        homePosition: { pan: 127, tilt: 127 },
        tiltLimits: { min: 20, max: 200 }
    }
};
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Create a new empty ShowFile with sensible defaults
 */
export function createEmptyShowFile(name = 'New Show') {
    const now = new Date().toISOString();
    return {
        schemaVersion: '2.0.0',
        name,
        description: '',
        createdAt: now,
        modifiedAt: now,
        createdWith: '1.0.0',
        stage: {
            width: 12,
            depth: 8,
            height: 5,
            gridSize: 0.5
        },
        visuals: {
            showGrid: true,
            showBeams: true,
            showZoneLabels: true,
            showFixtureNames: false,
            backgroundColor: '#0a0a12'
        },
        fixtures: [],
        groups: [],
        scenes: [],
        dmx: {
            driver: 'virtual',
            port: '',
            universes: [0],
            frameRate: 40
        },
        audio: {
            source: 'simulation',
            sensitivity: 0.7,
            inputGain: 1.0
        },
        defaultVibe: 'techno-club',
        seleneMode: 'idle'
    };
}
/**
 * Create a new fixture with default values
 */
export function createDefaultFixture(id, address, options = {}) {
    return {
        id,
        name: options.name || `Fixture ${address}`,
        model: options.model || 'Generic',
        manufacturer: options.manufacturer || 'Unknown',
        type: options.type || 'generic',
        address,
        universe: options.universe || 0,
        channelCount: options.channelCount || 1,
        profileId: options.profileId || 'generic-dimmer',
        position: options.position || { x: 0, y: 3, z: 0 },
        rotation: options.rotation || { pitch: -45, yaw: 0, roll: 0 },
        physics: options.physics || { ...DEFAULT_PHYSICS_PROFILES['unknown'] },
        zone: options.zone || 'unassigned',
        enabled: true,
        ...options
    };
}
/**
 * Create a new fixture group
 */
export function createFixtureGroup(id, name, fixtureIds = []) {
    return {
        id,
        name,
        fixtureIds,
        color: '#00f3ff',
        isSystem: false,
        order: 0
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Validate a ShowFile structure
 */
export function validateShowFile(data) {
    if (!data || typeof data !== 'object')
        return false;
    const show = data;
    // Required fields
    if (show.schemaVersion !== '2.0.0')
        return false;
    if (typeof show.name !== 'string')
        return false;
    if (!Array.isArray(show.fixtures))
        return false;
    if (!Array.isArray(show.groups))
        return false;
    if (!Array.isArray(show.scenes))
        return false;
    return true;
}
/**
 * Get schema version from file (for migration)
 */
export function getSchemaVersion(data) {
    if (!data || typeof data !== 'object')
        return null;
    const obj = data;
    // V2 format
    if (obj.schemaVersion === '2.0.0')
        return '2.0.0';
    // V1 format (old ConfigManager)
    if (obj.version && typeof obj.patchedFixtures !== 'undefined')
        return '1.0.0';
    return null;
}
