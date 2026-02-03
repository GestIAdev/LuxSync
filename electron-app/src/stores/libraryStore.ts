/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 LIBRARY STORE - WAVE 1113: HARDWARE BINDING & REAL FS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * SINGLE SOURCE OF TRUTH for fixture definitions.
 * Used by BOTH Forge and StageConstructor.
 * 
 * Data Sources (via IPC to Main Process):
 * - SYSTEM: Read-only fixtures from /librerias (factory library)
 * - USER: Writable fixtures from userData/fixtures
 * 
 * NO MORE:
 * - localStorage (killed)
 * - Hardcoded SYSTEM_FIXTURES (killed)
 * - Parallel lists (unified)
 * 
 * @module stores/libraryStore
 * @version WAVE 1113
 */

import { create } from 'zustand'
import { FixtureDefinition } from '../types/FixtureDefinition'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type FixtureSource = 'system' | 'user'

export interface LibraryFixture extends FixtureDefinition {
  source: FixtureSource
  filePath?: string
}

export interface LibraryPaths {
  system: string
  user: string
}

export interface DMXStatus {
  connected: boolean
  device: string | null
}

export interface LibraryState {
  // Data
  systemFixtures: LibraryFixture[]
  userFixtures: LibraryFixture[]
  paths: LibraryPaths | null
  dmxStatus: DMXStatus
  
  // Loading state
  isLoading: boolean
  lastError: string | null
  lastLoadTime: number | null
  
  // Actions
  loadFromDisk: () => Promise<void>
  saveUserFixture: (fixture: FixtureDefinition) => Promise<{ success: boolean; error?: string }>
  deleteUserFixture: (fixtureId: string) => Promise<{ success: boolean; error?: string }>
  refreshDMXStatus: () => Promise<void>
  
  // Selectors
  getAllFixtures: () => LibraryFixture[]
  getFixtureById: (id: string) => LibraryFixture | null
  isSystemFixture: (id: string) => boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert raw fixture from IPC to LibraryFixture
 */
function normalizeFixture(raw: any, source: FixtureSource): LibraryFixture {
  return {
    id: raw.id || raw.name?.replace(/\s+/g, '_').toLowerCase() || `${source}-${Date.now()}`,
    name: raw.name || 'Unknown Fixture',
    manufacturer: raw.manufacturer || 'Unknown',
    type: raw.type || 'Generic',
    channels: raw.channels || [],
    capabilities: raw.capabilities || {},
    physics: raw.physics || null,
    wheels: raw.wheels || null,
    source,
    filePath: raw.filePath,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useLibraryStore = create<LibraryState>((set, get) => ({
  // Initial state - empty until loadFromDisk() is called
  systemFixtures: [],
  userFixtures: [],
  paths: null,
  dmxStatus: { connected: false, device: null },
  isLoading: false,
  lastError: null,
  lastLoadTime: null,
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Load fixtures from disk via IPC
   * This is the ONLY way to populate the store
   */
  loadFromDisk: async () => {
    // Check if window.lux is available (Electron renderer)
    if (typeof window === 'undefined' || !window.lux?.library?.listAll) {
      console.warn('[LibraryStore] ⚠️ window.lux.library not available - running outside Electron?')
      set({ 
        isLoading: false, 
        lastError: 'IPC bridge not available',
      })
      return
    }
    
    set({ isLoading: true, lastError: null })
    
    try {
      console.log('[LibraryStore] 📂 Loading fixtures from disk via IPC...')
      
      const result = await window.lux.library.listAll()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to list fixtures')
      }
      
      // Normalize fixtures
      const systemFixtures = (result.systemFixtures || []).map(
        (f: any) => normalizeFixture(f, 'system')
      )
      const userFixtures = (result.userFixtures || []).map(
        (f: any) => normalizeFixture(f, 'user')
      )
      
      set({
        systemFixtures,
        userFixtures,
        paths: result.paths,
        isLoading: false,
        lastError: null,
        lastLoadTime: Date.now(),
      })
      
      console.log(`[LibraryStore] ✅ Loaded ${systemFixtures.length} system + ${userFixtures.length} user fixtures`)
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[LibraryStore] ❌ Failed to load fixtures:', errorMsg)
      set({ 
        isLoading: false, 
        lastError: errorMsg,
      })
    }
  },
  
  /**
   * Save a fixture to user library via IPC
   */
  saveUserFixture: async (fixture: FixtureDefinition) => {
    if (!window.lux?.library?.saveUser) {
      return { success: false, error: 'IPC bridge not available' }
    }
    
    try {
      console.log(`[LibraryStore] 💾 Saving fixture: ${fixture.name}`)
      
      const result = await window.lux.library.saveUser(fixture)
      
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to save fixture' }
      }
      
      // Reload library to get fresh data
      await get().loadFromDisk()
      
      console.log(`[LibraryStore] ✅ Saved fixture: ${fixture.name}`)
      return { success: true }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[LibraryStore] ❌ Failed to save fixture:', errorMsg)
      return { success: false, error: errorMsg }
    }
  },
  
  /**
   * Delete a user fixture via IPC
   * Note: Frontend is responsible for checking fixture.source before calling
   */
  deleteUserFixture: async (fixtureId: string) => {
    // WAVE 1120.3: Removed isSystemFixture check - it was causing false positives
    // when fixtures had same ID in both system and user arrays.
    // The frontend checks fixture.source === 'user' before calling this.
    // The backend (IPC) will also reject if the file doesn't exist in user folder.
    
    if (!window.lux?.library?.deleteUser) {
      return { success: false, error: 'IPC bridge not available' }
    }
    
    try {
      console.log(`[LibraryStore] 🗑️ Deleting fixture: ${fixtureId}`)
      
      const result = await window.lux.library.deleteUser(fixtureId)
      
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to delete fixture' }
      }
      
      // Reload library to get fresh data
      await get().loadFromDisk()
      
      console.log(`[LibraryStore] ✅ Deleted fixture: ${fixtureId}`)
      return { success: true }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[LibraryStore] ❌ Failed to delete fixture:', errorMsg)
      return { success: false, error: errorMsg }
    }
  },
  
  /**
   * Refresh DMX connection status for Live Probe
   */
  refreshDMXStatus: async () => {
    if (!window.lux?.library?.dmxStatus) {
      set({ dmxStatus: { connected: false, device: null } })
      return
    }
    
    try {
      const status = await window.lux.library.dmxStatus()
      set({ dmxStatus: status })
    } catch (error) {
      console.error('[LibraryStore] ❌ Failed to get DMX status:', error)
      set({ dmxStatus: { connected: false, device: null } })
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTORS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get ALL fixtures (system + user)
   */
  getAllFixtures: (): LibraryFixture[] => {
    const { systemFixtures, userFixtures } = get()
    return [...systemFixtures, ...userFixtures]
  },
  
  /**
   * Get a fixture by ID (checks both system and user)
   */
  getFixtureById: (id: string): LibraryFixture | null => {
    const { systemFixtures, userFixtures } = get()
    
    // Check system first
    const systemMatch = systemFixtures.find(f => f.id === id)
    if (systemMatch) return systemMatch
    
    // Check user
    const userMatch = userFixtures.find(f => f.id === id)
    if (userMatch) return userMatch
    
    return null
  },
  
  /**
   * Check if a fixture is from system library (read-only)
   */
  isSystemFixture: (id: string): boolean => {
    const { systemFixtures } = get()
    return systemFixtures.some(f => f.id === id)
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-INIT
// ═══════════════════════════════════════════════════════════════════════════

// Log on module load
console.log('[LibraryStore] 📚 WAVE 1113: Library Store initialized (IPC-based, no localStorage)')

// Note: loadFromDisk() should be called by the component that needs the data
// This avoids loading on app startup when the IPC bridge might not be ready
