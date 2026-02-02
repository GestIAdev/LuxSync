/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 STAGE STORE - WAVE 360 Phase 1
 * "El Único Altar de la Verdad del Stage"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este es el store UNIFICADO para toda la información del Stage.
 *
 * REGLA ABSOLUTA:
 * - NO hay otro lugar donde se guarden posiciones
 * - NO hay otro lugar donde se guarden grupos
 * - NO hay otro lugar donde se guarden escenas
 * - TODO lo del Stage viene de AQUÍ
 *
 * RESPONSABILIDADES:
 * 1. Cargar ShowFile v2 desde disco
 * 2. Persistir cambios con debounce
 * 3. Exponer fixtures, groups, scenes a la UI
 * 4. Migrar automáticamente desde v1
 *
 * RESTRICCIONES PUNK:
 * - CERO Math.random()
 * - CERO simulaciones
 * - CERO mocks
 * - TODO es real y persistido
 *
 * @module stores/stageStore
 * @version 360.1.0
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createEmptyShowFile, createFixtureGroup } from '../core/stage/ShowFileV2';
import { autoMigrate } from '../core/stage/ShowFileMigrator';
// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION (DETERMINISTIC, NOT RANDOM)
// ═══════════════════════════════════════════════════════════════════════════
let idCounter = 0;
/**
 * Generate a unique ID based on timestamp and counter
 * NO Math.random() - Axioma Anti-Simulación
 */
function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const count = (++idCounter).toString(36);
    return `${prefix}-${timestamp}-${count}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE HELPERS (WAVE 365: Connected to Electron IPC)
// ═══════════════════════════════════════════════════════════════════════════
// Check if we're in Electron environment
const isElectron = typeof window !== 'undefined' && 'lux' in window;
/**
 * Get the persistence API from the preload bridge
 */
function getStageAPI() {
    if (!isElectron)
        return null;
    const lux = window.lux;
    if (!lux?.stage)
        return null;
    return {
        load: lux.stage.load,
        save: lux.stage.save
    };
}
/**
 * Debounced save - waits for 2 seconds of inactivity before saving
 * WAVE 365: Increased debounce to 2s to avoid thrashing disk
 */
let saveTimeout = null;
const SAVE_DEBOUNCE = 2000;
function debouncedSave(save) {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
        await save();
        saveTimeout = null;
    }, SAVE_DEBOUNCE);
}
// ═══════════════════════════════════════════════════════════════════════════
// THE STORE
// ═══════════════════════════════════════════════════════════════════════════
export const useStageStore = create()(subscribeWithSelector((set, get) => ({
    // ═══════════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════════
    showFile: null,
    showFilePath: null,
    isDirty: false,
    isLoading: false,
    lastError: null,
    // Derived state (synced from showFile)
    fixtures: [],
    groups: [],
    scenes: [],
    stage: null,
    visuals: null,
    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    _setDirty: () => {
        set({ isDirty: true });
        // 🔥 WAVE 1007.5 FIX: Debounce the save call itself, not a closure
        // ANTI-CLOSURE: Force fresh state read inside debounced execution
        if (get().showFilePath) {
            debouncedSave(async () => {
                // ⚡ CRITICAL: get() called HERE, not captured in closure
                return await get().saveShow();
            });
        }
    },
    _syncDerivedState: () => {
        const { showFile } = get();
        if (!showFile) {
            set({
                fixtures: [],
                groups: [],
                scenes: [],
                stage: null,
                visuals: null
            });
            return;
        }
        // 🔥 WAVE 1042.2: Create NEW array reference for Zustand shallow comparison
        // Without this, React components with shallow selectors won't re-render
        set({
            fixtures: [...showFile.fixtures],
            groups: showFile.groups,
            scenes: showFile.scenes,
            stage: showFile.stage,
            visuals: showFile.visuals
        });
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SHOW FILE ACTIONS (WAVE 365: Connected to Electron IPC)
    // ═══════════════════════════════════════════════════════════════════════
    loadShowFile: async (filePath) => {
        set({ isLoading: true, lastError: null });
        try {
            const stageAPI = getStageAPI();
            if (stageAPI) {
                // WAVE 365: Use Electron IPC
                const result = await stageAPI.load(filePath);
                if (result.success && result.showFile) {
                    set({
                        showFile: result.showFile,
                        showFilePath: filePath || 'active',
                        isLoading: false,
                        isDirty: false
                    });
                    get()._syncDerivedState();
                    console.log('[stageStore] ✅ Loaded show via IPC:', result.showFile.name);
                    return true;
                }
                else {
                    throw new Error(result.error || 'Load failed');
                }
            }
            else {
                // Fallback: try localStorage in development
                const cached = localStorage.getItem(`showfile:${filePath}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    get().loadFromData(data);
                    set({ showFilePath: filePath, isLoading: false });
                    return true;
                }
                throw new Error('Persistence API not available');
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error loading show';
            set({ lastError: msg, isLoading: false });
            console.error('[stageStore] ❌ Load failed:', msg);
            return false;
        }
    },
    newShow: (name) => {
        const show = createEmptyShowFile(name);
        set({
            showFile: show,
            showFilePath: null,
            isDirty: true,
            lastError: null
        });
        get()._syncDerivedState();
    },
    saveShow: async () => {
        // 🔥 WAVE 1007.5 FIX: ALWAYS get fresh state, never trust closure
        // The debouncer captures stale showFile references. Force fresh read.
        const state = get();
        const { showFile, showFilePath } = state;
        if (!showFile) {
            set({ lastError: 'No show to save' });
            return false;
        }
        try {
            // Update modification timestamp
            showFile.modifiedAt = new Date().toISOString();
            const stageAPI = getStageAPI();
            if (stageAPI) {
                // WAVE 365: Use Electron IPC
                const result = await stageAPI.save(showFile, showFilePath || undefined);
                if (result.success) {
                    set({ isDirty: false });
                    console.log('[stageStore] 💾 Saved show via IPC:', showFile.name);
                    return true;
                }
                else {
                    throw new Error(result.error || 'Save failed');
                }
            }
            else {
                // Fallback: localStorage in development
                const key = showFilePath || 'current-show';
                localStorage.setItem(`showfile:${key}`, JSON.stringify(showFile, null, 2));
                set({ isDirty: false, showFilePath: key });
                console.log('[stageStore] 💾 Saved show to localStorage:', showFile.name);
                return true;
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error saving show';
            set({ lastError: msg });
            console.error('[stageStore] ❌ Save failed:', msg);
            return false;
        }
    },
    saveShowAs: async (path) => {
        set({ showFilePath: path });
        return get().saveShow();
    },
    loadFromData: (data) => {
        const result = autoMigrate(data);
        if (!result.success || !result.showFile) {
            set({ lastError: result.warnings.join(', ') });
            return false;
        }
        // Log migration warnings
        if (result.warnings.length > 0) {
            console.warn('[stageStore] Migration warnings:', result.warnings);
        }
        set({
            showFile: result.showFile,
            isDirty: false,
            lastError: null
        });
        get()._syncDerivedState();
        return true;
    },
    // ═══════════════════════════════════════════════════════════════════════
    // FIXTURE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    addFixture: (fixture) => {
        const { showFile } = get();
        if (!showFile) {
            console.error('[stageStore] ❌ Cannot add fixture - no showFile loaded!');
            return;
        }
        console.log('[stageStore] ➕ Adding fixture:', fixture.id, 'at', fixture.position);
        showFile.fixtures.push(fixture);
        get()._syncDerivedState();
        get()._setDirty();
    },
    removeFixture: (id) => {
        const { showFile } = get();
        if (!showFile)
            return;
        showFile.fixtures = showFile.fixtures.filter(f => f.id !== id);
        // Remove from all groups
        for (const group of showFile.groups) {
            group.fixtureIds = group.fixtureIds.filter(fid => fid !== id);
        }
        get()._syncDerivedState();
        get()._setDirty();
    },
    updateFixture: (id, updates) => {
        const { showFile } = get();
        if (!showFile)
            return;
        const fixtureIndex = showFile.fixtures.findIndex(f => f.id === id);
        if (fixtureIndex === -1)
            return;
        // 🔥 WAVE 1042.2: Create NEW fixture reference for Zustand reactivity
        // Object.assign mutates in place - shallow comparison misses it
        const updatedFixture = { ...showFile.fixtures[fixtureIndex], ...updates };
        showFile.fixtures[fixtureIndex] = updatedFixture;
        get()._syncDerivedState();
        get()._setDirty();
    },
    updateFixturePosition: (id, position) => {
        get().updateFixture(id, { position });
    },
    updateFixtureRotation: (id, rotation) => {
        get().updateFixture(id, { rotation });
    },
    updateFixturePhysics: (id, physics) => {
        const { showFile } = get();
        if (!showFile)
            return;
        const fixture = showFile.fixtures.find(f => f.id === id);
        if (!fixture)
            return;
        fixture.physics = { ...fixture.physics, ...physics };
        get()._syncDerivedState();
        get()._setDirty();
    },
    setFixtureZone: (id, zone) => {
        get().updateFixture(id, { zone });
    },
    batchUpdateFixtures: (updates) => {
        const { showFile } = get();
        if (!showFile)
            return;
        for (const { id, changes } of updates) {
            const fixture = showFile.fixtures.find(f => f.id === id);
            if (fixture) {
                Object.assign(fixture, changes);
            }
        }
        get()._syncDerivedState();
        get()._setDirty();
    },
    // ═══════════════════════════════════════════════════════════════════════
    // GROUP ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    createGroup: (name, fixtureIds) => {
        const { showFile } = get();
        if (!showFile) {
            throw new Error('No show loaded');
        }
        const group = createFixtureGroup(generateId('grp'), name, fixtureIds);
        group.order = showFile.groups.length;
        showFile.groups.push(group);
        get()._syncDerivedState();
        get()._setDirty();
        return group;
    },
    deleteGroup: (id) => {
        const { showFile } = get();
        if (!showFile)
            return;
        showFile.groups = showFile.groups.filter(g => g.id !== id);
        get()._syncDerivedState();
        get()._setDirty();
    },
    addToGroup: (groupId, fixtureId) => {
        const { showFile } = get();
        if (!showFile)
            return;
        const group = showFile.groups.find(g => g.id === groupId);
        if (!group)
            return;
        if (!group.fixtureIds.includes(fixtureId)) {
            group.fixtureIds.push(fixtureId);
            get()._syncDerivedState();
            get()._setDirty();
        }
    },
    removeFromGroup: (groupId, fixtureId) => {
        const { showFile } = get();
        if (!showFile)
            return;
        const group = showFile.groups.find(g => g.id === groupId);
        if (!group)
            return;
        group.fixtureIds = group.fixtureIds.filter(id => id !== fixtureId);
        get()._syncDerivedState();
        get()._setDirty();
    },
    updateGroup: (id, updates) => {
        const { showFile } = get();
        if (!showFile)
            return;
        const group = showFile.groups.find(g => g.id === id);
        if (!group)
            return;
        Object.assign(group, updates);
        get()._syncDerivedState();
        get()._setDirty();
    },
    // ═══════════════════════════════════════════════════════════════════════
    // SCENE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    saveScene: (name, fixtureValues) => {
        const { showFile } = get();
        if (!showFile) {
            throw new Error('No show loaded');
        }
        const now = new Date().toISOString();
        const scene = {
            id: generateId('scene'),
            name,
            createdAt: now,
            modifiedAt: now,
            fadeTime: 500,
            tags: [],
            previewColor: '#00f3ff',
            snapshots: fixtureValues
        };
        showFile.scenes.push(scene);
        get()._syncDerivedState();
        get()._setDirty();
        return scene;
    },
    deleteScene: (id) => {
        const { showFile } = get();
        if (!showFile)
            return;
        showFile.scenes = showFile.scenes.filter(s => s.id !== id);
        get()._syncDerivedState();
        get()._setDirty();
    },
    updateScene: (id, updates) => {
        const { showFile } = get();
        if (!showFile)
            return;
        const scene = showFile.scenes.find(s => s.id === id);
        if (!scene)
            return;
        Object.assign(scene, updates);
        scene.modifiedAt = new Date().toISOString();
        get()._syncDerivedState();
        get()._setDirty();
    },
    // ═══════════════════════════════════════════════════════════════════════
    // STAGE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    updateStageDimensions: (dims) => {
        const { showFile } = get();
        if (!showFile)
            return;
        showFile.stage = { ...showFile.stage, ...dims };
        get()._syncDerivedState();
        get()._setDirty();
    },
    updateVisuals: (visuals) => {
        const { showFile } = get();
        if (!showFile)
            return;
        showFile.visuals = { ...showFile.visuals, ...visuals };
        get()._syncDerivedState();
        get()._setDirty();
    }
})));
// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (for optimized renders)
// ═══════════════════════════════════════════════════════════════════════════
export const selectFixtures = (state) => state.fixtures;
export const selectGroups = (state) => state.groups;
export const selectScenes = (state) => state.scenes;
export const selectStageDimensions = (state) => state.stage;
export const selectVisuals = (state) => state.visuals;
export const selectIsDirty = (state) => state.isDirty;
export const selectIsLoading = (state) => state.isLoading;
export const selectFixtureById = (id) => (state) => state.fixtures.find(f => f.id === id);
export const selectGroupById = (id) => (state) => state.groups.find(g => g.id === id);
export const selectSceneById = (id) => (state) => state.scenes.find(s => s.id === id);
export const selectFixturesByZone = (zone) => (state) => state.fixtures.filter(f => f.zone === zone);
export const selectFixturesInGroup = (groupId) => (state) => {
    const group = state.groups.find(g => g.id === groupId);
    if (!group)
        return [];
    return state.fixtures.filter(f => group.fixtureIds.includes(f.id));
};
export const selectMovingHeads = (state) => state.fixtures.filter(f => f.type === 'moving-head');
// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Get a fixture by ID with reactive updates
 */
export function useFixture(id) {
    return useStageStore(selectFixtureById(id));
}
/**
 * Get all fixtures in a group with reactive updates
 */
export function useGroupFixtures(groupId) {
    return useStageStore(selectFixturesInGroup(groupId));
}
/**
 * Get all moving heads
 */
export function useMovingHeads() {
    return useStageStore(selectMovingHeads);
}
// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION (WAVE 365: Auto-load on startup)
// ═══════════════════════════════════════════════════════════════════════════
let initialized = false;
/**
 * Initialize the stage store by loading the active show
 * Call this once at app startup
 */
export async function initializeStageStore() {
    if (initialized) {
        console.log('[stageStore] Already initialized');
        return true;
    }
    console.log('[stageStore] 🚀 Initializing Stage Store...');
    const stageAPI = getStageAPI();
    if (stageAPI) {
        // WAVE 365: Load active show via IPC
        try {
            const result = await stageAPI.load(); // No path = load active show
            if (result.success && result.showFile) {
                useStageStore.setState({
                    showFile: result.showFile,
                    showFilePath: 'active',
                    isLoading: false,
                    isDirty: false
                });
                useStageStore.getState()._syncDerivedState();
                console.log('[stageStore] ✅ Loaded active show:', result.showFile.name);
                initialized = true;
                return true;
            }
        }
        catch (error) {
            console.warn('[stageStore] ⚠️ Failed to load active show:', error);
        }
    }
    // Fallback: Create new empty show
    console.log('[stageStore] 🆕 Creating new empty show');
    useStageStore.getState().newShow('New Show');
    initialized = true;
    return true;
}
/**
 * Subscribe to stage:loaded events from the main process
 * This allows the main process to push shows to the renderer
 */
export function setupStageStoreListeners() {
    if (!isElectron)
        return () => { };
    const lux = window.lux;
    if (!lux?.stage?.onLoaded)
        return () => { };
    const unsubscribe = lux.stage.onLoaded((data) => {
        console.log('[stageStore] 📨 Received show from main process:', data.showFile.name);
        if (data.migrated) {
            console.log('[stageStore] 🔄 Show was migrated from legacy format');
        }
        if (data.warnings?.length) {
            console.warn('[stageStore] ⚠️ Migration warnings:', data.warnings);
        }
        useStageStore.setState({
            showFile: data.showFile,
            showFilePath: 'active',
            isLoading: false,
            isDirty: false
        });
        useStageStore.getState()._syncDerivedState();
    });
    return unsubscribe;
}
