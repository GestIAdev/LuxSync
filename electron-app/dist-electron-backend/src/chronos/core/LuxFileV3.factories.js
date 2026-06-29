/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 LUX FILE V3 — FACTORIES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deterministic constructors for the `.lux` V3 core. No Math.random() — IDs use
 * crypto.randomUUID when available, with a monotonic-counter fallback.
 *
 * Bridges between the two representations:
 *   - toChronosProjectV3(file) → hydrate runtime state (playhead, viewport, bpm)
 *   - toLuxFileV3(project)     → strip runtime state (checksum recomputed by serializer)
 *
 * @module chronos/core/LuxFileV3.factories
 * @version V3.0
 */
import { LUX_V3_SCHEMA, LUX_DEFAULT_BPM, } from './LuxFileV3';
// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION (deterministic, no Math.random)
// ═══════════════════════════════════════════════════════════════════════════
let _idCounter = 0;
/** Generate a stable unique id with the given prefix. */
export function generateLuxId(prefix = 'lux') {
    try {
        if (typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function') {
            return `${prefix}_${crypto.randomUUID()}`;
        }
    }
    catch {
        // fall through
    }
    const now = Date.now().toString(36);
    _idCounter = (_idCounter + 1) % 0xffffff;
    return `${prefix}_${now}_${_idCounter.toString(36)}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// ZONE COLORS
// ═══════════════════════════════════════════════════════════════════════════
const TRACK_ZONE_COLORS = {
    front: '#ef4444',
    back: '#3b82f6',
    floor: '#22c55e',
    'movers-left': '#f59e0b',
    'movers-right': '#f59e0b',
    center: '#a855f7',
    air: '#06b6d4',
    ambient: '#64748b',
    unassigned: '#475569',
    global: '#e2e8f0',
};
function zoneColor(zone) {
    return TRACK_ZONE_COLORS[zone] ?? '#475569';
}
const VIBE_CLIP_COLOR = '#8b5cf6';
const FX_CLIP_COLOR = '#22d3ee';
// ═══════════════════════════════════════════════════════════════════════════
// META
// ═══════════════════════════════════════════════════════════════════════════
function resolveAuthor() {
    try {
        return (globalThis.luxsync?.getSystemUser?.() ??
            '');
    }
    catch {
        return '';
    }
}
export function createLuxMetaV3(name = 'Untitled Show') {
    const nowIso = new Date().toISOString();
    return {
        name,
        author: resolveAuthor(),
        createdAt: nowIso,
        modifiedAt: nowIso,
        durationMs: 0,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// TRACK
// ═══════════════════════════════════════════════════════════════════════════
const ZONE_BASE_LABELS = {
    front: 'FRONT',
    back: 'BACK',
    floor: 'FLOOR',
    'movers-left': 'MOVERS L',
    'movers-right': 'MOVERS R',
    center: 'CENTER',
    air: 'AIR',
    ambient: 'AMBIENT',
    unassigned: 'UNASSIGNED',
    global: 'GLOBAL',
};
/**
 * Generate a default visual label. First 'front' → "FRONT", second → "FRONT #2".
 */
export function generateTrackLabelV3(targetZone, existing) {
    const base = ZONE_BASE_LABELS[targetZone] ?? String(targetZone).toUpperCase();
    const count = existing.filter((t) => t.targetZone === targetZone).length;
    return count === 0 ? base : `${base} #${count + 1}`;
}
export function createTrackV3(targetZone, existing = [], overrides = {}) {
    return {
        id: generateLuxId('trk'),
        targetZone,
        visualLabel: overrides.visualLabel ?? generateTrackLabelV3(targetZone, existing),
        color: overrides.color ?? zoneColor(targetZone),
        clips: overrides.clips ?? [],
        enabled: overrides.enabled ?? true,
        solo: overrides.solo ?? false,
        locked: overrides.locked ?? false,
        order: overrides.order ?? existing.length,
        height: overrides.height ?? 36,
    };
}
export function createVibeClipV3(opts) {
    return {
        id: generateLuxId('clip'),
        type: 'vibe',
        label: opts.label ?? opts.vibeType,
        startMs: opts.startMs,
        endMs: opts.endMs,
        color: opts.color ?? VIBE_CLIP_COLOR,
        locked: false,
        vibeType: opts.vibeType,
        intensity: opts.intensity ?? 1,
        fadeInMs: opts.fadeInMs ?? 0,
        fadeOutMs: opts.fadeOutMs ?? 0,
    };
}
export function createFXClipV3(opts) {
    const heph = opts.hephClip;
    return {
        id: generateLuxId('clip'),
        type: 'fx',
        label: opts.label ?? heph.name,
        startMs: opts.startMs,
        endMs: opts.endMs,
        color: opts.color ?? FX_CLIP_COLOR,
        locked: false,
        hephClip: heph,
        hephFilePath: opts.hephFilePath,
        zones: opts.zones ?? heph.spatialZones.map((z) => String(z)),
        priority: opts.priority ?? heph.priority,
        mixBus: heph.mixBus,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// MARKER
// ═══════════════════════════════════════════════════════════════════════════
export function createMarkerV3(timeMs, type, label, color) {
    return { id: generateLuxId('mrk'), timeMs, type, label, color };
}
// ═══════════════════════════════════════════════════════════════════════════
// FILE / PROJECT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Create an empty `.lux` V3 file. Checksum is empty — the serializer computes
 * the real one on save.
 */
export function createEmptyLuxFileV3(name = 'Untitled Show') {
    return {
        $schema: LUX_V3_SCHEMA,
        meta: createLuxMetaV3(name),
        audio: null,
        analysis: null,
        vibeBase: null,
        tracks: [],
        markers: [],
        safety: null,
        checksum: '',
    };
}
/**
 * Hydrate a runtime ChronosProjectV3 from a serialized LuxFileV3.
 * Adds ephemeral edit state with sane defaults.
 */
export function toChronosProjectV3(file) {
    const baseBpm = file.audio?.detectedBpm ?? file.analysis?.detectedBpm ?? LUX_DEFAULT_BPM;
    return {
        $schema: file.$schema,
        meta: { ...file.meta },
        audio: file.audio ? { ...file.audio } : null,
        analysis: file.analysis ?? null,
        vibeBase: file.vibeBase ? { ...file.vibeBase } : null,
        tracks: file.tracks.map((t) => ({ ...t, clips: [...t.clips] })),
        markers: file.markers.map((m) => ({ ...m })),
        safety: file.safety ? { ...file.safety } : null,
        checksum: file.checksum,
        // ── ephemeral ──
        playheadMs: 0,
        viewportStartMs: 0,
        pixelsPerSecond: 100,
        runtimeBpm: baseBpm,
        manualBpmOverride: null,
        selectedClipIds: new Set(),
    };
}
/**
 * Strip runtime state from a ChronosProjectV3, producing a LuxFileV3 ready to
 * serialize. Checksum is left as-is — the serializer recomputes it.
 */
export function toLuxFileV3(project) {
    return {
        $schema: project.$schema,
        meta: { ...project.meta, modifiedAt: new Date().toISOString() },
        audio: project.audio,
        analysis: project.analysis,
        vibeBase: project.vibeBase,
        tracks: project.tracks,
        markers: project.markers,
        safety: project.safety,
        checksum: project.checksum,
    };
}
/** Create an empty runtime project. */
export function createEmptyChronosProjectV3(name = 'Untitled Show') {
    return toChronosProjectV3(createEmptyLuxFileV3(name));
}
// ═══════════════════════════════════════════════════════════════════════════
// VIBE BASE
// ═══════════════════════════════════════════════════════════════════════════
export function createVibeBaseV3(vibeId, displayName, overrides = {}) {
    return {
        vibeId,
        displayName,
        intensity: overrides.intensity ?? 0.5,
        color: overrides.color ?? '#64748b',
        icon: overrides.icon ?? '🌙',
    };
}
