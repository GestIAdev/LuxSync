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

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  ShowFileV2,
  FixtureV2,
  FixtureGroup,
  SceneV2,
  Position3D,
  Rotation3D,
  PhysicsProfile,
  FixtureZone,
  StageDimensions,
  StageVisuals,
  createEmptyShowFile,
  createDefaultFixture,
  createFixtureGroup,
  DEFAULT_PHYSICS_PROFILES
} from '../core/stage/ShowFileV2'
import { autoMigrate, parseLegacyScenes } from '../core/stage/ShowFileMigrator'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface StageStoreState {
  // ═══════════════════════════════════════════════════════════════════════
  // SHOW FILE DATA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Current show file (THE TRUTH) */
  showFile: ShowFileV2 | null
  
  /** Path to current show file on disk */
  showFilePath: string | null
  
  /** Is there unsaved changes? */
  isDirty: boolean
  
  /** Is the store currently loading? */
  isLoading: boolean
  
  /** Last error message */
  lastError: string | null
  
  // ═══════════════════════════════════════════════════════════════════════
  // QUICK ACCESS GETTERS (derived from showFile)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** All fixtures */
  fixtures: FixtureV2[]
  
  /** All groups */
  groups: FixtureGroup[]
  
  /** All scenes */
  scenes: SceneV2[]
  
  /** Stage dimensions */
  stage: StageDimensions | null
  
  /** Visual settings */
  visuals: StageVisuals | null
}

interface StageStoreActions {
  // ═══════════════════════════════════════════════════════════════════════
  // SHOW FILE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Load a show file (triggers migration if v1) */
  loadShowFile: (path: string) => Promise<boolean>
  
  /** Create a new empty show */
  newShow: (name: string) => void
  
  /** Save current show to disk */
  saveShow: () => Promise<boolean>
  
  /** Save show to a new path */
  saveShowAs: (path: string) => Promise<boolean>
  
  /** Load from raw data (for testing/import) */
  loadFromData: (data: unknown) => boolean
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Add a new fixture */
  addFixture: (fixture: FixtureV2) => void
  
  /** Remove a fixture by ID */
  removeFixture: (id: string) => void
  
  /** Update a fixture */
  updateFixture: (id: string, updates: Partial<FixtureV2>) => void
  
  /** Update fixture position (THE MEAT - positions are persisted!) */
  updateFixturePosition: (id: string, position: Position3D) => void
  
  /** Update fixture rotation */
  updateFixtureRotation: (id: string, rotation: Rotation3D) => void
  
  /** Update fixture physics profile (THE LIFE INSURANCE) */
  updateFixturePhysics: (id: string, physics: Partial<PhysicsProfile>) => void
  
  /** Set fixture zone */
  setFixtureZone: (id: string, zone: FixtureZone) => void
  
  /** Batch update fixtures (for undo/redo operations) */
  batchUpdateFixtures: (updates: Array<{ id: string; changes: Partial<FixtureV2> }>) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // GROUP ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Create a new group */
  createGroup: (name: string, fixtureIds: string[]) => FixtureGroup
  
  /** Delete a group */
  deleteGroup: (id: string) => void
  
  /** Add fixture to group */
  addToGroup: (groupId: string, fixtureId: string) => void
  
  /** Remove fixture from group */
  removeFromGroup: (groupId: string, fixtureId: string) => void
  
  /** Update group */
  updateGroup: (id: string, updates: Partial<FixtureGroup>) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // SCENE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Save current state as scene */
  saveScene: (name: string, fixtureValues: SceneV2['snapshots']) => SceneV2
  
  /** Delete a scene */
  deleteScene: (id: string) => void
  
  /** Update scene */
  updateScene: (id: string, updates: Partial<SceneV2>) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // STAGE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Update stage dimensions */
  updateStageDimensions: (dims: Partial<StageDimensions>) => void
  
  /** Update visual settings */
  updateVisuals: (visuals: Partial<StageVisuals>) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Mark show as dirty (needs save) */
  _setDirty: () => void
  
  /** Sync derived state from showFile */
  _syncDerivedState: () => void
}

type StageStore = StageStoreState & StageStoreActions

// ═══════════════════════════════════════════════════════════════════════════
// ID GENERATION (DETERMINISTIC, NOT RANDOM)
// ═══════════════════════════════════════════════════════════════════════════

let idCounter = 0

/**
 * Generate a unique ID based on timestamp and counter
 * NO Math.random() - Axioma Anti-Simulación
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const count = (++idCounter).toString(36)
  return `${prefix}-${timestamp}-${count}`
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENCE HELPERS (WAVE 365: Connected to Electron IPC)
// ═══════════════════════════════════════════════════════════════════════════

// Check if we're in Electron environment
const isElectron = typeof window !== 'undefined' && 'lux' in window

/**
 * Get the persistence API from the preload bridge
 */
function getStageAPI(): {
  load: (path?: string) => Promise<{ success: boolean; showFile?: ShowFileV2; error?: string }>
  save: (showFile: ShowFileV2, path?: string) => Promise<{ success: boolean; error?: string }>
} | null {
  if (!isElectron) return null
  
  const lux = (window as any).lux
  if (!lux?.stage) return null
  
  return {
    load: lux.stage.load,
    save: lux.stage.save
  }
}

/**
 * Debounced save - waits for 2 seconds of inactivity before saving
 * WAVE 365: Increased debounce to 2s to avoid thrashing disk
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null
const SAVE_DEBOUNCE = 2000

function debouncedSave(save: () => Promise<boolean>) {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(async () => {
    await save()
    saveTimeout = null
  }, SAVE_DEBOUNCE)
}

// ═══════════════════════════════════════════════════════════════════════════
// THE STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useStageStore = create<StageStore>()(
  subscribeWithSelector((set, get) => ({
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
      set({ isDirty: true })
      
      // 🔥 WAVE 1007.5 FIX: Debounce the save call itself, not a closure
      // ANTI-CLOSURE: Force fresh state read inside debounced execution
      if (get().showFilePath) {
        debouncedSave(async () => {
          // ⚡ CRITICAL: get() called HERE, not captured in closure
          return await get().saveShow()
        })
      }
    },
    
    _syncDerivedState: () => {
      const { showFile } = get()
      if (!showFile) {
        set({
          fixtures: [],
          groups: [],
          scenes: [],
          stage: null,
          visuals: null
        })
        return
      }
      
      // 🔥 WAVE 1042.2: Create NEW array reference for Zustand shallow comparison
      // Without this, React components with shallow selectors won't re-render
      set({
        fixtures: [...showFile.fixtures],
        groups: showFile.groups,
        scenes: showFile.scenes,
        stage: showFile.stage,
        visuals: showFile.visuals
      })
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // SHOW FILE ACTIONS (WAVE 365: Connected to Electron IPC)
    // ═══════════════════════════════════════════════════════════════════════
    
    loadShowFile: async (filePath) => {
      set({ isLoading: true, lastError: null })
      
      try {
        const stageAPI = getStageAPI()
        
        if (stageAPI) {
          // WAVE 365: Use Electron IPC
          const result = await stageAPI.load(filePath)
          
          if (result.success && result.showFile) {
            set({
              showFile: result.showFile,
              showFilePath: filePath || 'active',
              isLoading: false,
              isDirty: false
            })
            get()._syncDerivedState()
            console.log('[stageStore] ✅ Loaded show via IPC:', result.showFile.name)
            return true
          } else {
            throw new Error(result.error || 'Load failed')
          }
        } else {
          // Fallback: try localStorage in development
          const cached = localStorage.getItem(`showfile:${filePath}`)
          if (cached) {
            const data = JSON.parse(cached)
            get().loadFromData(data)
            set({ showFilePath: filePath, isLoading: false })
            return true
          }
          throw new Error('Persistence API not available')
        }
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error loading show'
        set({ lastError: msg, isLoading: false })
        console.error('[stageStore] ❌ Load failed:', msg)
        return false
      }
    },
    
    newShow: (name) => {
      const show = createEmptyShowFile(name)
      set({
        showFile: show,
        showFilePath: null,
        isDirty: true,
        lastError: null
      })
      get()._syncDerivedState()
    },
    
    saveShow: async () => {
      // 🔥 WAVE 1007.5 FIX: ALWAYS get fresh state, never trust closure
      // The debouncer captures stale showFile references. Force fresh read.
      const state = get()
      const { showFile, showFilePath } = state
      
      if (!showFile) {
        set({ lastError: 'No show to save' })
        return false
      }
      
      try {
        // Update modification timestamp
        showFile.modifiedAt = new Date().toISOString()
        
        const stageAPI = getStageAPI()
        
        if (stageAPI) {
          // WAVE 365: Use Electron IPC
          const result = await stageAPI.save(showFile, showFilePath || undefined)
          
          if (result.success) {
            set({ isDirty: false })
            console.log('[stageStore] 💾 Saved show via IPC:', showFile.name)
            return true
          } else {
            throw new Error(result.error || 'Save failed')
          }
        } else {
          // Fallback: localStorage in development
          const key = showFilePath || 'current-show'
          localStorage.setItem(`showfile:${key}`, JSON.stringify(showFile, null, 2))
          set({ isDirty: false, showFilePath: key })
          console.log('[stageStore] 💾 Saved show to localStorage:', showFile.name)
          return true
        }
        
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error saving show'
        set({ lastError: msg })
        console.error('[stageStore] ❌ Save failed:', msg)
        return false
      }
    },
    
    saveShowAs: async (path) => {
      set({ showFilePath: path })
      return get().saveShow()
    },
    
    loadFromData: (data) => {
      const result = autoMigrate(data)
      
      if (!result.success || !result.showFile) {
        set({ lastError: result.warnings.join(', ') })
        return false
      }
      
      // Log migration warnings
      if (result.warnings.length > 0) {
        console.warn('[stageStore] Migration warnings:', result.warnings)
      }
      
      set({
        showFile: result.showFile,
        isDirty: false,
        lastError: null
      })
      
      get()._syncDerivedState()
      return true
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // FIXTURE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    addFixture: (fixture) => {
      const { showFile } = get()
      if (!showFile) {
        console.error('[stageStore] ❌ Cannot add fixture - no showFile loaded!')
        return
      }
      
      console.log('[stageStore] ➕ Adding fixture:', fixture.id, 'at', fixture.position)
      showFile.fixtures.push(fixture)
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    removeFixture: (id) => {
      const { showFile } = get()
      if (!showFile) return
      
      showFile.fixtures = showFile.fixtures.filter(f => f.id !== id)
      
      // Remove from all groups
      for (const group of showFile.groups) {
        group.fixtureIds = group.fixtureIds.filter(fid => fid !== id)
      }
      
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    updateFixture: (id, updates) => {
      const { showFile } = get()
      if (!showFile) return
      
      const fixtureIndex = showFile.fixtures.findIndex(f => f.id === id)
      if (fixtureIndex === -1) return
      
      // 🔥 WAVE 1042.2: Create NEW fixture reference for Zustand reactivity
      // Object.assign mutates in place - shallow comparison misses it
      const updatedFixture = { ...showFile.fixtures[fixtureIndex], ...updates }
      showFile.fixtures[fixtureIndex] = updatedFixture
      
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    updateFixturePosition: (id, position) => {
      get().updateFixture(id, { position })
    },
    
    updateFixtureRotation: (id, rotation) => {
      get().updateFixture(id, { rotation })
    },
    
    updateFixturePhysics: (id, physics) => {
      const { showFile } = get()
      if (!showFile) return
      
      const fixture = showFile.fixtures.find(f => f.id === id)
      if (!fixture) return
      
      fixture.physics = { ...fixture.physics, ...physics }
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    setFixtureZone: (id, zone) => {
      get().updateFixture(id, { zone })
    },
    
    batchUpdateFixtures: (updates) => {
      const { showFile } = get()
      if (!showFile) return
      
      for (const { id, changes } of updates) {
        const fixture = showFile.fixtures.find(f => f.id === id)
        if (fixture) {
          Object.assign(fixture, changes)
        }
      }
      
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // GROUP ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    createGroup: (name, fixtureIds) => {
      const { showFile } = get()
      if (!showFile) {
        throw new Error('No show loaded')
      }
      
      const group = createFixtureGroup(generateId('grp'), name, fixtureIds)
      group.order = showFile.groups.length
      
      showFile.groups.push(group)
      get()._syncDerivedState()
      get()._setDirty()
      
      return group
    },
    
    deleteGroup: (id) => {
      const { showFile } = get()
      if (!showFile) return
      
      showFile.groups = showFile.groups.filter(g => g.id !== id)
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    addToGroup: (groupId, fixtureId) => {
      const { showFile } = get()
      if (!showFile) return
      
      const group = showFile.groups.find(g => g.id === groupId)
      if (!group) return
      
      if (!group.fixtureIds.includes(fixtureId)) {
        group.fixtureIds.push(fixtureId)
        get()._syncDerivedState()
        get()._setDirty()
      }
    },
    
    removeFromGroup: (groupId, fixtureId) => {
      const { showFile } = get()
      if (!showFile) return
      
      const group = showFile.groups.find(g => g.id === groupId)
      if (!group) return
      
      group.fixtureIds = group.fixtureIds.filter(id => id !== fixtureId)
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    updateGroup: (id, updates) => {
      const { showFile } = get()
      if (!showFile) return
      
      const group = showFile.groups.find(g => g.id === id)
      if (!group) return
      
      Object.assign(group, updates)
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // SCENE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    saveScene: (name, fixtureValues) => {
      const { showFile } = get()
      if (!showFile) {
        throw new Error('No show loaded')
      }
      
      const now = new Date().toISOString()
      const scene: SceneV2 = {
        id: generateId('scene'),
        name,
        createdAt: now,
        modifiedAt: now,
        fadeTime: 500,
        tags: [],
        previewColor: '#00f3ff',
        snapshots: fixtureValues
      }
      
      showFile.scenes.push(scene)
      get()._syncDerivedState()
      get()._setDirty()
      
      return scene
    },
    
    deleteScene: (id) => {
      const { showFile } = get()
      if (!showFile) return
      
      showFile.scenes = showFile.scenes.filter(s => s.id !== id)
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    updateScene: (id, updates) => {
      const { showFile } = get()
      if (!showFile) return
      
      const scene = showFile.scenes.find(s => s.id === id)
      if (!scene) return
      
      Object.assign(scene, updates)
      scene.modifiedAt = new Date().toISOString()
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // STAGE ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    updateStageDimensions: (dims) => {
      const { showFile } = get()
      if (!showFile) return
      
      showFile.stage = { ...showFile.stage, ...dims }
      get()._syncDerivedState()
      get()._setDirty()
    },
    
    updateVisuals: (visuals) => {
      const { showFile } = get()
      if (!showFile) return
      
      showFile.visuals = { ...showFile.visuals, ...visuals }
      get()._syncDerivedState()
      get()._setDirty()
    }
  }))
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (for optimized renders)
// ═══════════════════════════════════════════════════════════════════════════

export const selectFixtures = (state: StageStore) => state.fixtures
export const selectGroups = (state: StageStore) => state.groups
export const selectScenes = (state: StageStore) => state.scenes
export const selectStageDimensions = (state: StageStore) => state.stage
export const selectVisuals = (state: StageStore) => state.visuals
export const selectIsDirty = (state: StageStore) => state.isDirty
export const selectIsLoading = (state: StageStore) => state.isLoading

export const selectFixtureById = (id: string) => (state: StageStore) =>
  state.fixtures.find(f => f.id === id)

export const selectGroupById = (id: string) => (state: StageStore) =>
  state.groups.find(g => g.id === id)

export const selectSceneById = (id: string) => (state: StageStore) =>
  state.scenes.find(s => s.id === id)

export const selectFixturesByZone = (zone: FixtureZone) => (state: StageStore) =>
  state.fixtures.filter(f => f.zone === zone)

export const selectFixturesInGroup = (groupId: string) => (state: StageStore) => {
  const group = state.groups.find(g => g.id === groupId)
  if (!group) return []
  return state.fixtures.filter(f => group.fixtureIds.includes(f.id))
}

export const selectMovingHeads = (state: StageStore) =>
  state.fixtures.filter(f => f.type === 'moving-head')

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a fixture by ID with reactive updates
 */
export function useFixture(id: string): FixtureV2 | undefined {
  return useStageStore(selectFixtureById(id))
}

/**
 * Get all fixtures in a group with reactive updates
 */
export function useGroupFixtures(groupId: string): FixtureV2[] {
  return useStageStore(selectFixturesInGroup(groupId))
}

/**
 * Get all moving heads
 */
export function useMovingHeads(): FixtureV2[] {
  return useStageStore(selectMovingHeads)
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION (WAVE 365: Auto-load on startup)
// ═══════════════════════════════════════════════════════════════════════════

let initialized = false

/**
 * Initialize the stage store by loading the active show
 * Call this once at app startup
 */
export async function initializeStageStore(): Promise<boolean> {
  if (initialized) {
    console.log('[stageStore] Already initialized')
    return true
  }
  
  console.log('[stageStore] 🚀 Initializing Stage Store...')
  
  const stageAPI = getStageAPI()
  
  if (stageAPI) {
    // WAVE 365: Load active show via IPC
    try {
      const result = await stageAPI.load() // No path = load active show
      
      if (result.success && result.showFile) {
        useStageStore.setState({
          showFile: result.showFile,
          showFilePath: 'active',
          isLoading: false,
          isDirty: false
        })
        useStageStore.getState()._syncDerivedState()
        console.log('[stageStore] ✅ Loaded active show:', result.showFile.name)
        initialized = true
        return true
      }
    } catch (error) {
      console.warn('[stageStore] ⚠️ Failed to load active show:', error)
    }
  }
  
  // Fallback: Create new empty show
  console.log('[stageStore] 🆕 Creating new empty show')
  useStageStore.getState().newShow('New Show')
  initialized = true
  return true
}

/**
 * Subscribe to stage:loaded events from the main process
 * This allows the main process to push shows to the renderer
 */
export function setupStageStoreListeners(): () => void {
  if (!isElectron) return () => {}
  
  const lux = (window as any).lux
  if (!lux?.stage?.onLoaded) return () => {}
  
  const unsubscribe = lux.stage.onLoaded((data: { 
    showFile: ShowFileV2
    migrated?: boolean
    warnings?: string[] 
  }) => {
    console.log('[stageStore] 📨 Received show from main process:', data.showFile.name)
    
    if (data.migrated) {
      console.log('[stageStore] 🔄 Show was migrated from legacy format')
    }
    
    if (data.warnings?.length) {
      console.warn('[stageStore] ⚠️ Migration warnings:', data.warnings)
    }
    
    useStageStore.setState({
      showFile: data.showFile,
      showFilePath: 'active',
      isLoading: false,
      isDirty: false
    })
    useStageStore.getState()._syncDerivedState()
  })
  
  return unsubscribe
}

