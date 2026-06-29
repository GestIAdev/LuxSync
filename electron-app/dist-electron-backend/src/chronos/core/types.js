/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES — THE RUNTIME DNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FASE 7: V1 types demolished. Only V2 and shared types remain.
 *
 * This file defines shared types for the IN-MEMORY editing model used by
 * the Chronos editor UI, ChronosStoreV2, ChronosEngine, and automation system.
 *
 * V2 types: ChronosProjectV2, TimelineTrackV2 (with concrete TimelineClip).
 * Shared types: Primitives, PlaybackConfig, Automation, Analysis, Context.
 *
 * This is NOT the serialized .lux format. For the file format, see
 * LuxProject in ./ChronosProject.ts.
 * For the architectural map and barrel imports, see ./ProjectTypes.ts.
 *
 * @module chronos/core/types
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
