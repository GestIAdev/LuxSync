/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES — THE RUNTIME DNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2001 → WAVE 2081 (M1 Unification)
 *
 * This file defines ChronosProject and all related types for the
 * IN-MEMORY editing model used by the Chronos editor UI, Zustand store,
 * ChronosEngine, and automation system.
 *
 * This is NOT the serialized .lux format. For the file format, see
 * LuxProject in ./ChronosProject.ts.
 * For the architectural map and barrel imports, see ./ProjectTypes.ts.
 *
 * ARCHITECTURE:
 * - ChronosProject: Root runtime document (like an open .als in Ableton)
 * - TimelineTrack: Parallel content layers
 * - TimelineClip<T>: Generic positioned blocks with typed payloads
 * - AutomationLane: Bézier parameter curves
 * - AnalysisData: Pre-computed audio data (waveform, beats, sections)
 *
 * @module chronos/core/types
 * @version 2081.0.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Genera un ID único para Chronos
 */
export function generateChronosId() {
    // Prefer stable, cryptographic UUID when available (no Math.random())
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `chr_${crypto.randomUUID()}`;
        }
    }
    catch (e) {
        // Fallthrough to deterministic fallback
    }
    // Fallback deterministic ID (time + monotonic counter) for older environments
    // This avoids Math.random() and remains unique within a single process.
    const now = Date.now().toString(36);
    generateChronosIdCounter = (generateChronosIdCounter + 1) % 0xFFFFFF;
    return `chr_${now}_${generateChronosIdCounter.toString(36)}`;
}
// Monotonic counter used by fallback path
let generateChronosIdCounter = 0;
/**
 * Crea un proyecto vacío por defecto
 */
export function createDefaultProject(name = 'Untitled') {
    const now = new Date().toISOString();
    return {
        version: '1.0.0',
        id: generateChronosId(),
        meta: {
            name,
            description: '',
            audioPath: null,
            durationMs: 180000, // 3 minutos default
            bpm: 120,
            timeSignature: 4,
            key: null,
            createdAt: now,
            modifiedAt: now,
            audioHash: null,
        },
        playback: {
            loop: false,
            loopRegion: null,
            snapToBeat: true,
            snapResolution: 'beat',
            overrideMode: 'whisper',
            latencyCompensationMs: 10,
        },
        analysis: null,
        tracks: [],
        globalAutomation: [],
        markers: [],
    };
}
/**
 * Crea una track vacía
 */
export function createDefaultTrack(type, name, order = 0) {
    const trackColors = {
        audio: '#64748b',
        vibe: '#8b5cf6',
        effect: '#22d3ee',
        intensity: '#f59e0b',
        zone: '#10b981',
        color: '#ec4899',
        automation: '#6366f1',
        marker: '#94a3b8',
    };
    return {
        id: generateChronosId(),
        name: name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
        type,
        enabled: true,
        solo: false,
        locked: false,
        height: type === 'automation' ? 80 : 60,
        color: trackColors[type],
        clips: [],
        automation: [],
        order,
    };
}
/**
 * Crea un clip de efecto
 */
export function createEffectClip(trackId, effectId, startMs, durationMs, intensity = 1.0) {
    return {
        id: generateChronosId(),
        trackId,
        type: 'effect_trigger',
        startMs,
        durationMs,
        data: {
            type: 'effect_trigger',
            effectId,
            intensity,
            speed: 1.0,
            zones: [],
            bpmSync: true,
            params: {},
        },
        easeIn: 'linear',
        easeOut: 'linear',
        loop: false,
        priority: 0,
        enabled: true,
        meta: {
            label: effectId,
        },
    };
}
/**
 * Crea un punto de automation
 */
export function createAutomationPoint(timeMs, value, interpolation = 'linear') {
    return {
        id: generateChronosId(),
        timeMs,
        value,
        interpolation,
    };
}
/**
 * Crea una lane de automation
 */
export function createAutomationLane(target, name) {
    return {
        id: generateChronosId(),
        name: name ?? target,
        target,
        range: { min: 0, max: 1 },
        points: [],
        enabled: true,
        defaultValue: target.includes('intensity') ? 1.0 : 0.5,
        color: '#7c4dff',
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// 🏭 WAVE 2547: V2 FACTORIES
// ─────────────────────────────────────────────────────────────────────────────
/** Colores por zona para las tracks V2 */
const TRACK_V2_ZONE_COLORS = {
    'front': '#ef4444',
    'back': '#3b82f6',
    'floor': '#22c55e',
    'movers-left': '#f59e0b',
    'movers-right': '#f59e0b',
    'center': '#a855f7',
    'air': '#06b6d4',
    'ambient': '#64748b',
    'unassigned': '#475569',
    'global': '#e2e8f0',
};
/**
 * Genera el label visual por defecto para una track V2.
 * Primera track de 'front' → "FRONT". Segunda → "FRONT #2".
 */
export function generateTrackV2Label(targetZone, existingTracks) {
    const BASE_LABELS = {
        'front': 'FRONT',
        'back': 'BACK',
        'floor': 'FLOOR',
        'movers-left': 'MOVER LEFT',
        'movers-right': 'MOVER RIGHT',
        'center': 'CENTER',
        'air': 'AIR',
        'ambient': 'AMBIENT',
        'unassigned': 'UNASSIGNED',
        'global': 'GLOBAL',
    };
    const base = BASE_LABELS[targetZone] ?? targetZone.toUpperCase();
    const count = existingTracks.filter(t => t.targetZone === targetZone).length;
    return count === 0 ? base : `${base} #${count + 1}`;
}
/**
 * Crea una nueva TimelineTrackV2 vacía con valores por defecto.
 */
export function createTrackV2(targetZone, existingTracks, order) {
    const nextOrder = order ?? existingTracks.length;
    return {
        id: generateChronosId(),
        targetZone,
        visualLabel: generateTrackV2Label(targetZone, existingTracks),
        color: TRACK_V2_ZONE_COLORS[targetZone] ?? '#64748b',
        clips: [],
        automation: [],
        enabled: true,
        solo: false,
        locked: false,
        order: nextOrder,
        height: 36,
    };
}
/**
 * Crea un ChronosProjectV2 vacío con valores por defecto.
 */
export function createDefaultProjectV2(name = 'Untitled') {
    const now = new Date().toISOString();
    return {
        version: '2.0.0',
        id: generateChronosId(),
        meta: {
            name,
            description: '',
            audioPath: null,
            durationMs: 180000,
            bpm: 120,
            timeSignature: 4,
            key: null,
            createdAt: now,
            modifiedAt: now,
            audioHash: null,
        },
        playback: {
            loop: false,
            loopRegion: null,
            snapToBeat: true,
            snapResolution: 'beat',
            overrideMode: 'whisper',
            latencyCompensationMs: 10,
        },
        analysis: null,
        tracks: [],
        globalAutomation: [],
        markers: [],
    };
}
