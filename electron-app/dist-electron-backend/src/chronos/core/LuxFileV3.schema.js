/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ LUX FILE V3 — RUNTIME VALIDATION & TYPE GUARDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Strict, defensive validation for `.lux` V3 payloads coming from disk or IPC.
 * No legacy V2 tolerance: anything that isn't a well-formed V3 file is rejected.
 *
 * Returns structured results (errors + warnings) instead of throwing, so the
 * loader can decide policy.
 *
 * @module chronos/core/LuxFileV3.schema
 * @version V3.0
 */
import { CANONICAL_ZONES } from '../../core/stage/ShowFileV2';
import { LUX_V3_SCHEMA, } from './LuxFileV3';
const VALID_TARGET_ZONES = new Set([
    ...CANONICAL_ZONES,
    'global',
]);
const VALID_MIX_BUSES = new Set([
    'global',
    'htp',
    'ambient',
    'accent',
]);
const VALID_CLIP_TYPES = new Set([
    'vibe',
    'fx',
]);
// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE GUARDS
// ═══════════════════════════════════════════════════════════════════════════
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
}
function isNonEmptyString(v) {
    return typeof v === 'string' && v.length > 0;
}
// ═══════════════════════════════════════════════════════════════════════════
// CLIP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
function validateClip(clip, path, errors, warnings) {
    if (!isObject(clip)) {
        errors.push(`${path}: clip is not an object`);
        return;
    }
    if (!isNonEmptyString(clip.id))
        errors.push(`${path}: missing/invalid id`);
    if (!VALID_CLIP_TYPES.has(clip.type)) {
        errors.push(`${path}: invalid type '${String(clip.type)}'`);
    }
    if (typeof clip.label !== 'string')
        warnings.push(`${path}: missing label`);
    if (!isFiniteNumber(clip.startMs))
        errors.push(`${path}: invalid startMs`);
    if (!isFiniteNumber(clip.endMs))
        errors.push(`${path}: invalid endMs`);
    if (isFiniteNumber(clip.startMs) && isFiniteNumber(clip.endMs)) {
        if (clip.startMs < 0)
            errors.push(`${path}: negative startMs (${clip.startMs})`);
        if (clip.startMs >= clip.endMs) {
            errors.push(`${path}: startMs (${clip.startMs}) >= endMs (${clip.endMs})`);
        }
    }
    // ── Type-specific ──
    if (clip.type === 'fx') {
        if (!isObject(clip.hephClip)) {
            errors.push(`${path}: FX clip missing embedded hephClip`);
        }
        else {
            const heph = clip.hephClip;
            if (heph.schemaVersion !== '3.0') {
                errors.push(`${path}: hephClip.schemaVersion must be '3.0' (got '${String(heph.schemaVersion)}')`);
            }
            if (!Array.isArray(heph.tracks) || heph.tracks.length === 0) {
                errors.push(`${path}: hephClip has 0 tracks (empty automation)`);
            }
            if (!isNonEmptyString(heph.mixBus)) {
                warnings.push(`${path}: hephClip missing mixBus routing`);
            }
        }
        if (clip.mixBus !== undefined && !VALID_MIX_BUSES.has(clip.mixBus)) {
            errors.push(`${path}: invalid mixBus '${String(clip.mixBus)}'`);
        }
    }
    if (clip.type === 'vibe') {
        if (!isNonEmptyString(clip.vibeType)) {
            warnings.push(`${path}: vibe clip missing vibeType`);
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// TRACK VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
function validateTrack(track, index, errors, warnings) {
    const path = `tracks[${index}]`;
    if (!isObject(track)) {
        errors.push(`${path}: track is not an object`);
        return;
    }
    if (!isNonEmptyString(track.id))
        errors.push(`${path}: missing/invalid id`);
    if (!VALID_TARGET_ZONES.has(track.targetZone)) {
        errors.push(`${path}: invalid targetZone '${String(track.targetZone)}'`);
    }
    if (typeof track.visualLabel !== 'string') {
        warnings.push(`${path}: missing visualLabel`);
    }
    if (typeof track.enabled !== 'boolean') {
        warnings.push(`${path}: missing enabled flag`);
    }
    if (!Array.isArray(track.clips)) {
        errors.push(`${path}: clips is not an array`);
        return;
    }
    track.clips.forEach((clip, ci) => {
        validateClip(clip, `${path}.clips[${ci}]`, errors, warnings);
    });
}
// ═══════════════════════════════════════════════════════════════════════════
// FILE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Validate an unknown payload as a LuxFileV3.
 * Does NOT verify the checksum — use verifyLuxChecksum() for that.
 */
export function validateLuxFileV3(data) {
    const errors = [];
    const warnings = [];
    if (!isObject(data)) {
        return { valid: false, errors: ['Payload is not an object'], warnings };
    }
    // Schema discriminator — HARD GATE.
    if (data.$schema !== LUX_V3_SCHEMA) {
        errors.push(`Invalid $schema: expected '${LUX_V3_SCHEMA}', got '${String(data.$schema)}'`);
        // Without the right schema, no point continuing deep validation.
        return { valid: false, errors, warnings };
    }
    // Meta
    if (!isObject(data.meta)) {
        errors.push('Missing meta');
    }
    else {
        if (!isNonEmptyString(data.meta.name))
            errors.push('Missing meta.name');
        if (!isFiniteNumber(data.meta.durationMs)) {
            errors.push('Invalid meta.durationMs');
        }
    }
    // Audio (nullable)
    if (data.audio !== null && data.audio !== undefined) {
        if (!isObject(data.audio)) {
            errors.push('audio must be an object or null');
        }
        else {
            if (!isNonEmptyString(data.audio.fileName)) {
                warnings.push('audio missing fileName');
            }
            if (!isFiniteNumber(data.audio.detectedBpm)) {
                warnings.push('audio missing detectedBpm');
            }
        }
    }
    // Tracks
    if (!Array.isArray(data.tracks)) {
        errors.push('tracks is not an array');
    }
    else {
        data.tracks.forEach((t, i) => validateTrack(t, i, errors, warnings));
    }
    // Markers (nullable array)
    if (data.markers !== undefined && !Array.isArray(data.markers)) {
        errors.push('markers is not an array');
    }
    // Checksum present
    if (!isNonEmptyString(data.checksum)) {
        warnings.push('Missing checksum (integrity cannot be verified)');
    }
    return { valid: errors.length === 0, errors, warnings };
}
/**
 * Strict type guard. Returns true only if the payload is a valid LuxFileV3
 * (does not verify checksum).
 */
export function isLuxFileV3(data) {
    return validateLuxFileV3(data).valid;
}
