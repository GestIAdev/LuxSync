/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS V3 NATIVE EDITOR STORE — WAVE 7000
 * Store basado en HephAutomationClipV3 con Undo/Redo por Immer Patches.
 * Cero retrocompatibilidad con V2.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { produceWithPatches, enablePatches, applyPatches } from 'immer';
import { bakeOverrides } from '../phase/PhaseOverride';
import { DEFAULT_COGNITIVE_DNA } from '../defaults';
enablePatches();
const HISTORY_LIMIT = 200;
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function computeSpatialUnion(tracks) {
    const set = new Set();
    for (const t of tracks) {
        for (const z of t.zones)
            set.add(z);
    }
    return Array.from(set);
}
function buildTrack(id, init) {
    return {
        id,
        paramId: init.paramId,
        zones: init.zones,
        curve: init.curve ?? {
            paramId: init.paramId,
            valueType: 'number',
            range: [0, 255],
            defaultValue: 0,
            keyframes: [],
            mode: 'absolute',
        },
        dimmerScale: init.dimmerScale ?? 1,
        blendMode: init.blendMode ?? 'max',
        colorOverride: init.colorOverride,
        cell: init.cell,
        selector: init.selector,
        phaseConfig: init.phaseConfig,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════
export const useHephaestusEditorStore = create()(immer((set, get) => {
    /**
     * Wrapper universal de mutación. TODA acción destructiva pasa por aquí.
     * Produce patches inversos (undo) y forward (redo), empuja un HistoryFrame,
     * e invalida la rama de redo.
     */
    const mutate = (label, recipe) => {
        const current = get().clip;
        const [nextClip, redoPatches, undoPatches] = produceWithPatches(current, recipe);
        if (redoPatches.length === 0)
            return;
        set(state => {
            state.clip = nextClip;
            state.isDirty = true;
            state._undoStack.push({ undo: undoPatches, redo: redoPatches, label });
            if (state._undoStack.length > HISTORY_LIMIT)
                state._undoStack.shift();
            state._redoStack.length = 0;
        });
    };
    return {
        // ── ESTADO INICIAL ──
        clip: {
            id: 'empty',
            name: 'Untitled',
            author: '',
            category: 'composite',
            tags: [],
            vibeCompat: [],
            spatialZones: ['all'],
            mixBus: 'global',
            priority: 0,
            durationMs: 1000,
            effectType: 'custom',
            tracks: [],
            staticParams: {},
            schemaVersion: '3.0',
        },
        selection: { activeTrackId: null, selectedKeyframeIndices: new Set(), playheadMs: 0 },
        viewport: { zoom: 1, scrollX: 0, laneHeight: 120 },
        isDirty: false,
        _undoStack: [],
        _redoStack: [],
        _dragSnapshot: null,
        // ── INTERNAL ──
        mutate,
        // ── CLIP-LEVEL ──
        loadClip: (clip) => {
            // 🧬 HYDRATION FIX: Normalize V2 selector.phase → V3 track.phaseConfig
            // so the LabTab/PhaseControls can read the phase config without
            // duplicating the runtime's _extractPhaseConfig fallback logic.
            if (clip?.tracks) {
                for (const track of clip.tracks) {
                    if (track.phaseConfig)
                        continue;
                    const v2 = track.selector?.phase;
                    const legacySpread = track.selector?.phaseSpread;
                    if (v2 && v2.spread > 0) {
                        track.phaseConfig = {
                            spreadDeg: v2.spread * 1440,
                            symmetry: v2.symmetry ?? 'linear',
                            wings: v2.wings ?? 1,
                            blocks: 1,
                            shuffle: 0,
                            shuffleSeed: 1,
                            direction: v2.direction ?? 1,
                        };
                    }
                    else if (legacySpread != null && legacySpread > 0) {
                        track.phaseConfig = {
                            spreadDeg: legacySpread * 1440,
                            symmetry: 'linear',
                            wings: 1,
                            blocks: 1,
                            shuffle: 0,
                            shuffleSeed: 1,
                            direction: 1,
                        };
                    }
                }
            }
            // Auto-select first track with non-trivial phase config, else first track
            const phaseTrack = clip?.tracks?.find(t => t.phaseConfig && t.phaseConfig.spreadDeg > 0);
            const firstTrackId = phaseTrack?.id ?? clip?.tracks?.[0]?.id ?? null;
            set((state) => {
                state.clip = clip;
                state.isDirty = false;
                state.selection.activeTrackId = firstTrackId;
                state.selection.selectedKeyframeIndices = new Set();
                state._undoStack = [];
                state._redoStack = [];
                state._dragSnapshot = null;
            });
        },
        renameClip: (name) => mutate('Rename clip', draft => { draft.name = name; }),
        setDuration: (durationMs) => mutate('Set duration', draft => { draft.durationMs = durationMs; }),
        setMixBus: (bus) => mutate('Set mix bus', draft => { draft.mixBus = bus; }),
        // ── TRACK CRUD ──
        addTrack: (init) => {
            const id = crypto.randomUUID();
            mutate('Add track', draft => {
                draft.tracks.push(buildTrack(id, init));
                draft.spatialZones = computeSpatialUnion(draft.tracks);
            });
            set(s => { s.selection.activeTrackId = id; });
            return id;
        },
        removeTrack: (trackId) => mutate('Remove track', draft => {
            draft.tracks = draft.tracks.filter(t => t.id !== trackId);
            draft.spatialZones = computeSpatialUnion(draft.tracks);
        }),
        duplicateTrack: (trackId) => {
            const newId = crypto.randomUUID();
            mutate('Duplicate track', draft => {
                const orig = draft.tracks.find(t => t.id === trackId);
                if (!orig)
                    return;
                const clone = {
                    ...orig,
                    id: newId,
                    curve: { ...orig.curve, keyframes: [...orig.curve.keyframes] },
                    zones: [...orig.zones],
                };
                const idx = draft.tracks.findIndex(t => t.id === trackId);
                draft.tracks.splice(idx + 1, 0, clone);
                draft.spatialZones = computeSpatialUnion(draft.tracks);
            });
            set(s => { s.selection.activeTrackId = newId; });
            return newId;
        },
        reorderTrack: (trackId, toIndex) => mutate('Reorder track', draft => {
            const fromIndex = draft.tracks.findIndex(t => t.id === trackId);
            if (fromIndex === -1)
                return;
            const [moved] = draft.tracks.splice(fromIndex, 1);
            draft.tracks.splice(toIndex, 0, moved);
        }),
        setTrackZones: (trackId, zones) => mutate('Set track zones', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            track.zones = zones;
            draft.spatialZones = computeSpatialUnion(draft.tracks);
        }),
        setTrackBlendMode: (trackId, mode) => mutate('Set blend mode', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (track)
                track.blendMode = mode;
        }),
        setTrackDimmerScale: (trackId, scale) => mutate('Set dimmer scale', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (track)
                track.dimmerScale = scale;
        }),
        // ── CURVE MUTATION ──
        updateCurveInTrack: (trackId, recipe) => mutate('Edit curve', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (track)
                recipe(track.curve);
        }),
        addKeyframe: (trackId, kf) => mutate('Add keyframe', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            track.curve.keyframes.push(kf);
            track.curve.keyframes.sort((a, b) => a.timeMs - b.timeMs);
        }),
        removeKeyframes: (trackId, indices) => mutate('Remove keyframes', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            const toRemove = new Set(indices);
            track.curve.keyframes = track.curve.keyframes.filter((_, i) => !toRemove.has(i));
        }),
        moveKeyframes: (trackId, delta, indices) => mutate('Move keyframes', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            const idxSet = new Set(indices);
            track.curve.keyframes = track.curve.keyframes.map((kf, i) => idxSet.has(i)
                ? { ...kf, timeMs: kf.timeMs + delta.dtMs, value: typeof kf.value === 'number' ? kf.value + delta.dValue : kf.value }
                : kf);
            track.curve.keyframes.sort((a, b) => a.timeMs - b.timeMs);
        }),
        setKeyframeInterpolation: (trackId, index, interp) => mutate('Set interpolation', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            const kf = track.curve.keyframes[index];
            if (kf)
                kf.interpolation = interp;
        }),
        // ── PHASE ──
        updatePhaseInTrack: (trackId, recipe) => mutate('Edit phase', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            if (!track.phaseConfig) {
                track.phaseConfig = { spreadDeg: 0, symmetry: 'linear', wings: 1, blocks: 1, shuffle: 0, shuffleSeed: 1, direction: 1 };
            }
            recipe(track.phaseConfig);
        }),
        clearPhaseInTrack: (trackId) => mutate('Clear phase', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (track)
                track.phaseConfig = undefined;
        }),
        // ── PHASE OVERRIDES (per-fixture) ──
        updatePhaseOverride: (trackId, fixtureId, override) => mutate('Edit phase override', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            if (!track.phaseOverrides)
                track.phaseOverrides = {};
            if (override === null) {
                delete track.phaseOverrides[fixtureId];
                if (Object.keys(track.phaseOverrides).length === 0) {
                    track.phaseOverrides = undefined;
                }
            }
            else {
                track.phaseOverrides[fixtureId] = override;
            }
        }),
        clearPhaseOverrides: (trackId) => mutate('Clear phase overrides', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (track)
                track.phaseOverrides = undefined;
        }),
        bakePhaseOverrides: (trackId, fixtureIds, config, durationMs) => mutate('Bake phase overrides', draft => {
            const track = draft.tracks.find(t => t.id === trackId);
            if (!track)
                return;
            track.phaseOverrides = bakeOverrides(fixtureIds, config, durationMs);
        }),
        // ── DNA / SimMeta ──
        setCognitiveDNA: (recipe) => mutate('Set cognitive DNA', draft => {
            if (!draft.cognitiveDNA) {
                draft.cognitiveDNA = { ...DEFAULT_COGNITIVE_DNA };
            }
            recipe(draft.cognitiveDNA);
        }),
        enableDNA: () => mutate('Enable DNA', draft => {
            if (!draft.cognitiveDNA) {
                draft.cognitiveDNA = { ...DEFAULT_COGNITIVE_DNA };
            }
        }),
        // ── SELECTION (efímero — NO historial) ──
        selectTrack: (trackId) => set(s => {
            s.selection.activeTrackId = trackId;
            s.selection.selectedKeyframeIndices = new Set();
        }),
        selectKeyframes: (indices, additive) => set(s => {
            if (additive) {
                const next = new Set(s.selection.selectedKeyframeIndices);
                for (const i of indices)
                    next.add(i);
                s.selection.selectedKeyframeIndices = next;
            }
            else {
                s.selection.selectedKeyframeIndices = new Set(indices);
            }
        }),
        setPlayhead: (ms) => set(s => { s.selection.playheadMs = ms; }),
        setViewport: (partial) => set(s => { s.viewport = { ...s.viewport, ...partial }; }),
        // ── HISTORY ──
        undo: () => set(state => {
            const frame = state._undoStack.pop();
            if (!frame)
                return;
            state.clip = applyPatches(state.clip, frame.undo);
            state._redoStack.push(frame);
        }),
        redo: () => set(state => {
            const frame = state._redoStack.pop();
            if (!frame)
                return;
            state.clip = applyPatches(state.clip, frame.redo);
            state._undoStack.push(frame);
        }),
        canUndo: () => get()._undoStack.length > 0,
        canRedo: () => get()._redoStack.length > 0,
        // ── DRAG BATCHING ──
        beginDragSnapshot: () => set(state => { state._dragSnapshot = state.clip; }),
        endDragSnapshot: (label = 'Drag') => {
            const { _dragSnapshot, clip } = get();
            if (!_dragSnapshot)
                return;
            const [, redoPatches, undoPatches] = produceWithPatches(_dragSnapshot, () => clip);
            if (redoPatches.length === 0) {
                set(state => { state._dragSnapshot = null; });
                return;
            }
            set(state => {
                state._undoStack.push({ undo: undoPatches, redo: redoPatches, label });
                if (state._undoStack.length > HISTORY_LIMIT)
                    state._undoStack.shift();
                state._redoStack.length = 0;
                state._dragSnapshot = null;
            });
        },
        replaceClipTransient: (nextClip) => set(state => {
            state.clip = nextClip;
            state.isDirty = true;
        }),
        // ── DERIVED ──
        getActiveTrack: () => {
            const { clip, selection } = get();
            if (!clip || !selection.activeTrackId)
                return null;
            return clip.tracks.find(t => t.id === selection.activeTrackId) ?? null;
        },
    };
}));
