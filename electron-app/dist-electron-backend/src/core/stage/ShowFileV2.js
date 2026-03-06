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
/**
 * 🔧 WAVE 2093.1: Deep validate a ShowFile structure
 *
 * Returns detailed diagnostics: hard errors (invalid data that would crash)
 * and soft warnings (missing optional fields, suspicious values).
 *
 * Checks:
 *  - Schema version, name, required arrays
 *  - Per-fixture: id (string), address (1-512), universe (>=0)
 *  - Physics object exists with positive maxAcceleration
 *  - No duplicate fixture IDs
 *  - Group referential integrity (fixtureIds ⊆ fixtures[].id)
 */
export function validateShowFileDeep(data) {
    const errors = [];
    const warnings = [];
    // ── STRUCTURAL CHECKS ──
    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['Data is null or not an object'], warnings };
    }
    const show = data;
    if (show.schemaVersion !== '2.0.0' && show.schemaVersion !== '2.1.0') {
        errors.push(`Invalid schemaVersion: expected '2.0.0' or '2.1.0', got '${show.schemaVersion}'`);
    }
    if (typeof show.name !== 'string' || show.name.trim() === '') {
        errors.push(`Invalid or empty show name: '${show.name}'`);
    }
    if (!Array.isArray(show.fixtures)) {
        errors.push('fixtures is not an array');
        return { valid: false, errors, warnings };
    }
    if (!Array.isArray(show.groups)) {
        errors.push('groups is not an array');
    }
    if (!Array.isArray(show.scenes)) {
        errors.push('scenes is not an array');
    }
    // If fatal structural errors, stop here
    if (errors.length > 0 && !Array.isArray(show.fixtures)) {
        return { valid: false, errors, warnings };
    }
    // ── PER-FIXTURE VALIDATION ──
    const fixtureIds = new Set();
    const fixtures = show.fixtures;
    for (let i = 0; i < fixtures.length; i++) {
        const f = fixtures[i];
        const prefix = `fixtures[${i}]`;
        // ID: must be a non-empty string
        if (typeof f.id !== 'string' || f.id.trim() === '') {
            errors.push(`${prefix}: missing or empty 'id'`);
            continue;
        }
        // Duplicate ID check
        if (fixtureIds.has(f.id)) {
            errors.push(`${prefix}: duplicate fixture id '${f.id}'`);
        }
        fixtureIds.add(f.id);
        // Address: integer 1-512
        if (typeof f.address !== 'number' || !Number.isInteger(f.address) || f.address < 1 || f.address > 512) {
            errors.push(`${prefix} (${f.id}): address must be integer 1-512, got ${f.address}`);
        }
        // Universe: integer >= 0
        const universe = f.universe;
        if (universe !== undefined && universe !== null) {
            if (typeof universe !== 'number' || !Number.isInteger(universe) || universe < 0) {
                errors.push(`${prefix} (${f.id}): universe must be integer >= 0, got ${universe}`);
            }
        }
        // Physics: must exist with positive maxAcceleration
        if (!f.physics || typeof f.physics !== 'object') {
            warnings.push(`${prefix} (${f.id}): missing 'physics' object — will use defaults`);
        }
        else {
            const physics = f.physics;
            if (typeof physics.maxAcceleration !== 'number' || physics.maxAcceleration <= 0) {
                warnings.push(`${prefix} (${f.id}): physics.maxAcceleration must be positive, got ${physics.maxAcceleration}`);
            }
            // Validate tiltLimits if present
            if (physics.tiltLimits && typeof physics.tiltLimits === 'object') {
                const tl = physics.tiltLimits;
                if (typeof tl.min !== 'number' || typeof tl.max !== 'number') {
                    warnings.push(`${prefix} (${f.id}): physics.tiltLimits.min/max must be numbers`);
                }
                else if (tl.min >= tl.max) {
                    warnings.push(`${prefix} (${f.id}): physics.tiltLimits.min (${tl.min}) >= max (${tl.max})`);
                }
            }
        }
        // Position: must have x, y, z as numbers (if present)
        if (f.position && typeof f.position === 'object') {
            const pos = f.position;
            if (typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
                warnings.push(`${prefix} (${f.id}): position.x/y/z must be numbers`);
            }
        }
    }
    // ── GROUP REFERENTIAL INTEGRITY ──
    if (Array.isArray(show.groups)) {
        const groups = show.groups;
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const gPrefix = `groups[${g}]`;
            if (typeof group.id !== 'string' || group.id.trim() === '') {
                warnings.push(`${gPrefix}: missing or empty group 'id'`);
                continue;
            }
            if (!Array.isArray(group.fixtureIds)) {
                warnings.push(`${gPrefix} (${group.id}): fixtureIds is not an array`);
                continue;
            }
            const fIds = group.fixtureIds;
            for (const fId of fIds) {
                if (!fixtureIds.has(fId)) {
                    errors.push(`${gPrefix} (${group.id}): references non-existent fixture '${fId}'`);
                }
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Validate a ShowFile structure (type guard)
 *
 * 🔧 WAVE 2093.1: Now performs DEEP validation — checks every fixture,
 * detects duplicates, validates ranges, and verifies referential integrity.
 * Logs warnings to console for non-fatal issues.
 */
export function validateShowFile(data) {
    const result = validateShowFileDeep(data);
    // Log warnings for visibility (non-fatal but important)
    if (result.warnings.length > 0) {
        console.warn(`[ShowFileV2] ⚠️ Validation warnings (${result.warnings.length}):`);
        for (const w of result.warnings) {
            console.warn(`  → ${w}`);
        }
    }
    // Log errors
    if (result.errors.length > 0) {
        console.error(`[ShowFileV2] 🔴 Validation FAILED (${result.errors.length} errors):`);
        for (const e of result.errors) {
            console.error(`  ✗ ${e}`);
        }
    }
    return result.valid;
}
/**
 * Get schema version from file (for migration)
 */
export function getSchemaVersion(data) {
    if (!data || typeof data !== 'object')
        return null;
    const obj = data;
    // V2 format (any 2.x.x version)
    if (typeof obj.schemaVersion === 'string' && obj.schemaVersion.startsWith('2.'))
        return '2.0.0';
    // V1 format (old ConfigManager)
    if (obj.version && typeof obj.patchedFixtures !== 'undefined')
        return '1.0.0';
    return null;
}
