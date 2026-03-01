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
// CANONICAL ZONE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔥 WAVE 2040.24: Array canónico de las 9 zonas válidas.
 * Usado para validación, UI dropdowns y iteración.
 */
export const CANONICAL_ZONES = [
    'front',
    'back',
    'floor',
    'movers-left',
    'movers-right',
    'center',
    'air',
    'ambient',
    'unassigned',
];
/**
 * 🔥 WAVE 2040.24: Labels para UI — cada zona canónica con su emoji y nombre.
 */
export const ZONE_LABELS = {
    'front': '🔴 FRONT (Main)',
    'back': '🔵 BACK (Counter)',
    'floor': '⬇️ FLOOR (Uplight)',
    'movers-left': '🏎️ MOVER LEFT',
    'movers-right': '🏎️ MOVER RIGHT',
    'center': '⚡ CENTER (Strobes/Blinders)',
    'air': '✨ AIR (Laser/Atmosphere)',
    'ambient': '🌫️ AMBIENT (House)',
    'unassigned': '❓ UNASSIGNED',
};
/**
 * 🔥 WAVE 2040.24 FASE 1: NORMALIZER — El traductor universal de zonas.
 *
 * Acepta CUALQUIER string legacy y lo convierte a CanonicalZone.
 * Determinista, sin side effects, sin excepciones.
 * Si no reconoce el input → 'unassigned' (nunca crashea).
 *
 * @param zone — Cualquier string de zona (legacy V1, SCREAMING V2, canonical, basura...)
 * @returns CanonicalZone — Siempre uno de los 9 valores válidos
 */
export function normalizeZone(zone) {
    if (!zone)
        return 'unassigned';
    const raw = zone.trim().toLowerCase();
    // ── Ya es canónica ────────────────────────────────────────────────────
    if (CANONICAL_ZONES.includes(raw)) {
        return raw;
    }
    // ── Mapa exhaustivo: legacy → canonical ───────────────────────────────
    const MAP = {
        // SCREAMING_CASE V2
        'front_pars': 'front',
        'back_pars': 'back',
        'floor_pars': 'floor',
        'moving_left': 'movers-left',
        'moving_right': 'movers-right',
        'strobes': 'center',
        'lasers': 'air',
        // kebab-case legacy V1
        'stage-left': 'movers-left',
        'stage-right': 'movers-right',
        'stage-center': 'center',
        'ceiling-front': 'front',
        'ceiling-back': 'back',
        'ceiling-left': 'movers-left',
        'ceiling-right': 'movers-right',
        'ceiling-center': 'center',
        'floor-front': 'front',
        'floor-back': 'back',
        'truss-1': 'back',
        'truss-2': 'back',
        'truss-3': 'back',
        'custom': 'unassigned',
        // Aliases cortos (por si llegan del migrador viejo)
        'left': 'movers-left',
        'right': 'movers-right',
        'front': 'front',
        'back': 'back',
        'floor': 'floor',
        'center': 'center',
        'ceiling': 'center',
        'truss': 'back',
        'air': 'air',
        'ambient': 'ambient',
        'unassigned': 'unassigned',
    };
    return MAP[raw] ?? 'unassigned';
}
/**
 * 🔥 WAVE 2040.24: Comprueba si un string es una CanonicalZone válida.
 */
export function isCanonicalZone(zone) {
    if (!zone)
        return false;
    return CANONICAL_ZONES.includes(zone);
}
/**
 * 🎯 WAVE 2040.25 FASE 3: Resolver FixtureSelector → lista de IDs
 *
 * Esta función es el CORAZÓN del targeting avanzado.
 * Convierte un selector abstracto en una lista concreta de fixture IDs.
 *
 * @param selector — El selector a resolver
 * @param fixtures — Array de todas las fixtures del show (desde stageStore)
 * @param groups — Array de grupos del show (para resolver group IDs)
 * @returns Array de fixture IDs que matchean el selector
 */
export function resolveFixtureSelector(selector, fixtures, groups) {
    // 1️⃣ Resolver target → lista base
    let baseFixtures = [];
    if (selector.target === 'all') {
        baseFixtures = fixtures;
    }
    else if (isCanonicalZone(selector.target)) {
        // Es una zona canónica
        baseFixtures = fixtures.filter(f => f.zone === selector.target);
    }
    else {
        // Intentar resolver como group ID
        const group = groups?.find(g => g.id === selector.target);
        if (group) {
            baseFixtures = fixtures.filter(f => group.fixtureIds.includes(f.id));
        }
        else {
            // Grupo no encontrado, retornar vacío
            console.warn(`[resolveFixtureSelector] Unknown target: ${selector.target}`);
            return [];
        }
    }
    // 2️⃣ Filtrar por stereoSide (si está definido)
    if (selector.stereoSide) {
        if (selector.stereoSide === 'left') {
            baseFixtures = baseFixtures.filter(f => f.position.x < 0);
        }
        else {
            baseFixtures = baseFixtures.filter(f => f.position.x >= 0);
        }
    }
    // 3️⃣ Filtrar por parity (even/odd)
    if (selector.parity && selector.parity !== 'all') {
        baseFixtures = baseFixtures.filter((_, idx) => {
            if (selector.parity === 'even')
                return idx % 2 === 0;
            if (selector.parity === 'odd')
                return idx % 2 !== 0;
            return true;
        });
    }
    // 4️⃣ Filtrar por indexRange (si está definido)
    if (selector.indexRange) {
        const indices = parseIndexRange(selector.indexRange, baseFixtures.length);
        baseFixtures = baseFixtures.filter((_, idx) => indices.includes(idx));
    }
    // 5️⃣ Retornar IDs finales
    return baseFixtures.map(f => f.id);
}
/**
 * Parse index range string: "1-3" | "1,3,5" | "2-"
 * Returns 0-based indices array
 */
function parseIndexRange(range, maxLength) {
    const result = [];
    // Case: "1-3" → [0, 1, 2] (1-based input → 0-based output)
    if (range.includes('-')) {
        const [start, end] = range.split('-').map(s => s.trim());
        const startIdx = start ? parseInt(start, 10) - 1 : 0;
        const endIdx = end ? parseInt(end, 10) - 1 : maxLength - 1;
        for (let i = Math.max(0, startIdx); i <= Math.min(maxLength - 1, endIdx); i++) {
            result.push(i);
        }
    }
    // Case: "1,3,5" → [0, 2, 4]
    else if (range.includes(',')) {
        const indices = range.split(',').map(s => parseInt(s.trim(), 10) - 1);
        result.push(...indices.filter(i => i >= 0 && i < maxLength));
    }
    // Case: "3" → [2]
    else {
        const idx = parseInt(range, 10) - 1;
        if (idx >= 0 && idx < maxLength) {
            result.push(idx);
        }
    }
    return result;
}
// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 384: TYPE MAPPING HELPER
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Map library fixture type (FXTParser format) to FixtureV2 type
 */
export function mapLibraryTypeToFixtureType(libraryType) {
    const typeMap = {
        'moving_head': 'moving-head',
        'movinghead': 'moving-head',
        'moving-head': 'moving-head',
        'moving head': 'moving-head', // 🎯 WAVE 685.6: From Forge dropdown
        'moving': 'moving-head', // 🎯 WAVE 685.6: Saved as "moving" from Forge
        'par': 'par',
        'wash': 'wash',
        'strobe': 'strobe',
        'laser': 'laser',
        'blinder': 'blinder',
        'bar': 'bar',
        'spot': 'spot',
        'scanner': 'scanner',
        'effect': 'effect',
        // 🔥 WAVE 2084.5: INGENIOS — New device types
        'fan': 'fan',
        'fog': 'fog',
        'haze': 'fog', // Common alias
        'mirror-ball': 'mirror-ball',
        'mirrorball': 'mirror-ball',
        'mirror_ball': 'mirror-ball',
        'pyro': 'pyro',
        'flame': 'pyro', // Common alias
        'other': 'generic',
        'generic': 'generic'
    };
    return typeMap[libraryType?.toLowerCase()] || 'generic';
}
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
