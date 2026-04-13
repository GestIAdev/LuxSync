/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 CHRONOS PROJECT — PERSISTENCE LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2014 → WAVE 2081 (M1 Unification)
 *
 * This file defines the LuxProject type — the SERIALIZABLE format for
 * .lux files saved to disk and loaded by TimelineEngine / Hyperion.
 *
 * LuxProject is NOT the runtime editing model. For the in-memory
 * representation used by the Chronos editor (Zustand store, ChronosEngine),
 * see ChronosProject in ./types.ts.
 *
 * For the architectural map and barrel imports, see ./ProjectTypes.ts.
 *
 * AXIOMA ANTI-SIMULACIÓN:
 * The saved project represents REAL work, not demos.
 *
 * @module chronos/core/ChronosProject
 * @version WAVE 2081
 */
import { generateChronosId } from './types';
import { normalizeTagsToCanonical } from '../../core/zones/ZoneMapper';
// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FILE FORMAT (.lux)
// ═══════════════════════════════════════════════════════════════════════════
/** Current project file version */
export const PROJECT_VERSION = '2.0';
/** File extension for LuxSync projects */
export const PROJECT_EXTENSION = '.lux';
/** MIME type for LuxSync projects */
export const PROJECT_MIME = 'application/x-luxsync-project';
// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FACTORY
// ═══════════════════════════════════════════════════════════════════════════
/**
 * WAVE 2040.17 P13: Resolve system username for project authorship.
 * Uses the preload-exposed getSystemUser() when running in Electron,
 * falls back to empty string in browser dev mode.
 */
function resolveAuthor() {
    try {
        return window.luxsync?.getSystemUser?.() || '';
    }
    catch {
        return '';
    }
}
/**
 * WAVE 2040.17 P12: Extract Hephaestus effect summaries from timeline clips.
 * Deduplicates by fileName so each .lfx appears only once.
 */
function extractHephEffects(clips) {
    const seen = new Map();
    for (const clip of clips) {
        if (clip.type !== 'fx')
            continue;
        const fx = clip;
        if (!fx.isHephCustom || !fx.hephFilePath)
            continue;
        const fileName = fx.hephFilePath;
        if (seen.has(fileName))
            continue;
        seen.set(fileName, {
            fileName,
            name: fx.label,
            effectType: typeof fx.params?.effectType === 'string' ? fx.params.effectType : 'heph-custom',
            mixBus: fx.mixBus,
            curveCount: fx.hephClip ? Object.keys(fx.hephClip.curves || {}).length : 0,
        });
    }
    return Array.from(seen.values());
}
/**
 * Create a new empty project
 */
export function createEmptyProject(name = 'Untitled Project') {
    const now = Date.now();
    return {
        meta: {
            version: PROJECT_VERSION,
            // WAVE 2040.17 P13: Real author from system
            author: resolveAuthor(),
            created: now,
            modified: now,
            durationMs: 60000, // Default 1 minute
            name,
        },
        audio: null,
        timeline: {
            clips: [],
            playheadMs: 0,
            viewportStartMs: 0,
            pixelsPerSecond: 100,
        },
        library: {
            customEffects: [],
            presets: [],
        },
    };
}
/**
 * Create a project from current session state
 */
export function createProjectFromState(name, clips, audio, playheadMs = 0, viewportStartMs = 0, pixelsPerSecond = 100) {
    const now = Date.now();
    return {
        meta: {
            version: PROJECT_VERSION,
            // WAVE 2040.17 P13: Real author from system
            author: resolveAuthor(),
            created: now,
            modified: now,
            durationMs: audio?.durationMs ?? 60000,
            name,
        },
        audio: audio ? {
            name: audio.name,
            path: audio.path,
            bpm: audio.bpm,
            offsetMs: 0,
            durationMs: audio.durationMs,
        } : null,
        timeline: {
            clips,
            playheadMs,
            viewportStartMs,
            pixelsPerSecond,
        },
        // WAVE 2040.17 P12: Populate library with Hephaestus effects from timeline
        library: {
            customEffects: extractHephEffects(clips),
            presets: [],
        },
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Serialize project to JSON string
 *
 * WAVE 2040.17 P12: Also refreshes library.customEffects from
 * the current timeline clips, so it's always up-to-date.
 */
export function serializeProject(project) {
    // Update modified timestamp
    project.meta.modified = Date.now();
    // WAVE 2040.17 P12: Refresh custom effects library from timeline
    project.library.customEffects = extractHephEffects(project.timeline.clips);
    return JSON.stringify(project, null, 2);
}
/**
 * Deserialize project from JSON string
 */
export function deserializeProject(json) {
    try {
        const data = JSON.parse(json);
        // Validate version
        if (!data.meta?.version) {
            console.error('[ChronosProject] Invalid project: missing version');
            return null;
        }
        // Version migration (future)
        if (data.meta.version !== PROJECT_VERSION) {
            console.warn(`[ChronosProject] Project version mismatch: ${data.meta.version} vs ${PROJECT_VERSION}`);
            // Could add migration logic here
        }
        // Validate required fields
        if (!data.timeline?.clips) {
            console.error('[ChronosProject] Invalid project: missing timeline.clips');
            return null;
        }
        return data;
    }
    catch (err) {
        console.error('[ChronosProject] Failed to parse project:', err);
        return null;
    }
}
/**
 * Validate project integrity
 *
 * WAVE 2040.17: Extended validation for Hephaestus Diamond Data.
 * Now returns warnings in addition to errors.
 * - Errors: things that make the project invalid
 * - Warnings: things that may cause issues but don't block loading
 */
export function validateProject(project) {
    const errors = [];
    const warnings = [];
    // Check meta
    if (!project.meta)
        errors.push('Missing meta');
    if (!project.meta?.version)
        errors.push('Missing meta.version');
    if (!project.meta?.name)
        errors.push('Missing meta.name');
    // Check timeline
    if (!project.timeline)
        errors.push('Missing timeline');
    if (!Array.isArray(project.timeline?.clips))
        errors.push('Invalid timeline.clips');
    // Check clips integrity
    project.timeline?.clips?.forEach((clip, i) => {
        if (!clip.id)
            errors.push(`Clip ${i}: missing id`);
        if (!clip.type)
            errors.push(`Clip ${i}: missing type`);
        if (typeof clip.startMs !== 'number')
            errors.push(`Clip ${i}: invalid startMs`);
        if (typeof clip.endMs !== 'number')
            errors.push(`Clip ${i}: invalid endMs`);
        // WAVE 2040.17: Temporal range validation
        if (typeof clip.startMs === 'number' && typeof clip.endMs === 'number') {
            if (clip.startMs >= clip.endMs)
                errors.push(`Clip ${i}: startMs (${clip.startMs}) >= endMs (${clip.endMs})`);
            if (clip.startMs < 0)
                errors.push(`Clip ${i}: negative startMs (${clip.startMs})`);
        }
        // WAVE 2040.17: TrackId check
        if (!clip.trackId)
            warnings.push(`Clip ${i}: missing trackId`);
        // WAVE 2040.17: Hephaestus clip integrity
        if (clip.type === 'fx') {
            const fx = clip;
            if (fx.isHephCustom && !fx.hephClip) {
                warnings.push(`Clip ${i} "${fx.label}": Hephaestus custom clip but missing hephClip curves (legacy or broken D&D)`);
            }
            if (fx.isHephCustom && fx.hephClip) {
                const curveCount = Object.keys(fx.hephClip.curves || {}).length;
                if (curveCount === 0) {
                    errors.push(`Clip ${i} "${fx.label}": Hephaestus clip has 0 curves — empty automation data`);
                }
            }
            if (fx.isHephCustom && !fx.mixBus) {
                warnings.push(`Clip ${i} "${fx.label}": Hephaestus clip missing mixBus routing`);
            }
        }
    });
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION HELPERS (LuxProject ↔ ChronosProject)
// ═══════════════════════════════════════════════════════════════════════════
//
// These bridge the two project representations:
//   LuxProject  = serializable .lux file (flat clip list, portable)
//   RuntimeProject = in-memory editing model (multi-track, automation, analysis)
//
// The clip type systems diverge intentionally:
//   LuxProject uses TimelineClip = VibeClip | FXClip  (concrete, serializable)
//   RuntimeProject uses TimelineClip<ClipData>  (generic, extensible)
//
// Conversion uses `any` at the clip boundary because these are two
// independent type hierarchies. Runtime safety is guaranteed by the
// fact that clips always carry their `type` discriminator.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Convert a LuxProject (file) into a runtime ChronosProject.
 *
 * 🌍 WAVE 2543.3: Zone-aware track creation.
 * - Clips with zones data → routed to zone-{zone} tracks
 * - Legacy clips (fx1-fx4 trackIds) → routed to zone-all fallback
 * - Non-FX clips (audio, vibe) → dedicated structural tracks
 */
export function luxToChronos(lux) {
    const nowIso = new Date(lux.meta.modified || Date.now()).toISOString();
    const rawClips = lux.timeline?.clips || [];
    // Group clips by their zone destination
    const zoneTrackMap = new Map();
    const audioTrackId = generateChronosId();
    const audioClips = [];
    for (const c of rawClips) {
        const clip = c;
        // Non-FX clips go to a generic audio track
        if (clip.type !== 'fx') {
            audioClips.push({ ...clip, trackId: audioTrackId });
            continue;
        }
        // Determine zone target from clip data
        // WAVE 2543.4: normalizeTagsToCanonical handles multi-zone arrays
        // e.g. ['back', 'all-right'] → 'back-right'
        let zoneKey = 'all'; // fallback for legacy fx1-fx4 clips
        if (clip.zones && clip.zones.length > 0) {
            zoneKey = normalizeTagsToCanonical(clip.zones);
        }
        const trackKey = `zone-${zoneKey}`;
        if (!zoneTrackMap.has(trackKey)) {
            zoneTrackMap.set(trackKey, { id: generateChronosId(), clips: [] });
        }
        const entry = zoneTrackMap.get(trackKey);
        entry.clips.push({ ...clip, trackId: entry.id });
    }
    // Build tracks array
    const tracks = [];
    // Audio/structural track (if there are non-FX clips)
    if (audioClips.length > 0) {
        tracks.push({
            id: audioTrackId,
            name: 'Timeline',
            type: 'audio',
            enabled: true,
            solo: false,
            locked: false,
            height: 120,
            color: '#6b7280',
            clips: audioClips,
            automation: [],
            order: 0,
        });
    }
    // Zone tracks (one per zone destination found in clips)
    let order = tracks.length;
    for (const [trackKey, { id, clips }] of zoneTrackMap) {
        const zoneName = trackKey.replace('zone-', '');
        tracks.push({
            id,
            name: zoneName === 'all' ? 'ALL' : zoneName.toUpperCase(),
            type: 'effect',
            targetZone: zoneName === 'all' ? undefined : zoneName,
            enabled: true,
            solo: false,
            locked: false,
            height: 60,
            color: '#22d3ee',
            clips,
            automation: [],
            order: order++,
        });
    }
    // If no clips at all, create one empty zone-all track
    if (tracks.length === 0) {
        tracks.push({
            id: generateChronosId(),
            name: 'ALL',
            type: 'effect',
            enabled: true,
            solo: false,
            locked: false,
            height: 60,
            color: '#22d3ee',
            clips: [],
            automation: [],
            order: 0,
        });
    }
    return {
        version: '1.0.0',
        id: generateChronosId(),
        meta: {
            name: lux.meta.name || 'Imported Project',
            description: '',
            audioPath: lux.audio?.path || null,
            durationMs: lux.meta.durationMs || lux.audio?.durationMs || 60000,
            bpm: lux.audio?.bpm ?? 120,
            timeSignature: 4,
            key: null,
            createdAt: new Date(lux.meta.created || Date.now()).toISOString(),
            modifiedAt: nowIso,
            audioHash: lux.audio?.checksum || null,
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
        tracks,
        globalAutomation: [],
        markers: [],
    };
}
/**
 * Convert a runtime ChronosProject into a LuxProject for serialization.
 * Flattens all tracks into a single timeline.clips array.
 */
export function chronosToLux(ch) {
    const metaNow = Date.now();
    // Flatten all track clips into a single list
    const clips = (ch.tracks || []).flatMap((t) => t.clips || []);
    return {
        meta: {
            version: PROJECT_VERSION,
            author: resolveAuthor(),
            created: Date.parse(ch.meta.createdAt) || metaNow,
            modified: Date.parse(ch.meta.modifiedAt) || metaNow,
            durationMs: ch.meta.durationMs || 0,
            name: ch.meta.name || 'Chronos Export',
        },
        audio: ch.meta.audioPath
            ? {
                name: ch.meta.audioPath.split(/[/\\]/).pop() || 'audio',
                path: ch.meta.audioPath,
                bpm: ch.meta.bpm || 120,
                offsetMs: 0,
                durationMs: ch.meta.durationMs || 0,
            }
            : null,
        timeline: {
            clips: clips,
            playheadMs: 0,
            viewportStartMs: 0,
            pixelsPerSecond: 100,
        },
        library: {
            customEffects: extractHephEffects(clips),
            presets: [],
        },
    };
}
