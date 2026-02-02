/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 LIBRARY STORE - WAVE 1112: FUNCTIONAL CLOSURE & LIBRARY MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Manages fixture definitions from two sources:
 * - SYSTEM: Hardcoded/bundled fixtures (read-only)
 * - USER: User-created fixtures (localStorage, editable)
 * 
 * LocalStorage Key: luxsync_user_fixtures
 * 
 * @module stores/libraryStore
 * @version WAVE 1112
 */

import { create } from 'zustand'
import { FixtureDefinition, WheelColor } from '../types/FixtureDefinition'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'luxsync_user_fixtures'

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM FIXTURES - Read-Only Library
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔒 SYSTEM FIXTURES
 * These are bundled with the app and cannot be modified directly.
 * User must "Clone" to edit.
 */
export const SYSTEM_FIXTURES: FixtureDefinition[] = [
  {
    id: 'system-beam-2r',
    name: 'Beam 2R / LB230N',
    manufacturer: 'Generic',
    type: 'Moving Head',
    channels: [
      { index: 0, name: 'Pan', type: 'pan', defaultValue: 127, is16bit: false },
      { index: 1, name: 'Pan Fine', type: 'pan_fine', defaultValue: 0, is16bit: true },
      { index: 2, name: 'Tilt', type: 'tilt', defaultValue: 127, is16bit: false },
      { index: 3, name: 'Tilt Fine', type: 'tilt_fine', defaultValue: 0, is16bit: true },
      { index: 4, name: 'Color Wheel', type: 'color_wheel', defaultValue: 0, is16bit: false },
      { index: 5, name: 'Gobo', type: 'gobo', defaultValue: 0, is16bit: false },
      { index: 6, name: 'Prism', type: 'prism', defaultValue: 0, is16bit: false },
      { index: 7, name: 'Strobe', type: 'strobe', defaultValue: 0, is16bit: false },
      { index: 8, name: 'Dimmer', type: 'dimmer', defaultValue: 255, is16bit: false },
      { index: 9, name: 'Speed', type: 'speed', defaultValue: 128, is16bit: false },
      { index: 10, name: 'Control', type: 'control', defaultValue: 0, is16bit: false },
    ],
    capabilities: {
      hasPan: true,
      hasTilt: true,
      hasColorWheel: true,
      hasGobo: true,
      hasPrism: true,
      hasStrobe: true,
      hasDimmer: true,
      colorEngine: 'wheel',
      colorWheel: {
        colors: [
          { dmx: 0, name: 'Open (White)', rgb: { r: 255, g: 255, b: 255 } },
          { dmx: 15, name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
          { dmx: 30, name: 'Orange', rgb: { r: 255, g: 128, b: 0 } },
          { dmx: 45, name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
          { dmx: 60, name: 'Green', rgb: { r: 0, g: 255, b: 0 } },
          { dmx: 75, name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
          { dmx: 90, name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
          { dmx: 105, name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
          { dmx: 120, name: 'Light Blue', rgb: { r: 128, g: 128, b: 255 } },
          { dmx: 135, name: 'Pink', rgb: { r: 255, g: 128, b: 255 } },
        ],
        allowsContinuousSpin: true,
        spinStartDmx: 190,
        minChangeTimeMs: 500,
      },
    },
    physics: {
      motorType: 'stepper',
      maxAcceleration: 2000,
      safetyCap: 0.85,
    },
  },
  {
    id: 'system-led-par-rgb',
    name: 'LED PAR RGB 54x3W',
    manufacturer: 'Generic',
    type: 'Par',
    channels: [
      { index: 0, name: 'Dimmer', type: 'dimmer', defaultValue: 255, is16bit: false },
      { index: 1, name: 'Red', type: 'red', defaultValue: 0, is16bit: false },
      { index: 2, name: 'Green', type: 'green', defaultValue: 0, is16bit: false },
      { index: 3, name: 'Blue', type: 'blue', defaultValue: 0, is16bit: false },
      { index: 4, name: 'Strobe', type: 'strobe', defaultValue: 0, is16bit: false },
      { index: 5, name: 'Macro', type: 'macro', defaultValue: 0, is16bit: false },
    ],
    capabilities: {
      hasDimmer: true,
      hasColorMixing: true,
      hasStrobe: true,
      colorEngine: 'rgb',
    },
  },
  {
    id: 'system-led-wash',
    name: 'LED Moving Wash 36x10W',
    manufacturer: 'Generic',
    type: 'Wash',
    channels: [
      { index: 0, name: 'Pan', type: 'pan', defaultValue: 127, is16bit: false },
      { index: 1, name: 'Pan Fine', type: 'pan_fine', defaultValue: 0, is16bit: true },
      { index: 2, name: 'Tilt', type: 'tilt', defaultValue: 127, is16bit: false },
      { index: 3, name: 'Tilt Fine', type: 'tilt_fine', defaultValue: 0, is16bit: true },
      { index: 4, name: 'Speed', type: 'speed', defaultValue: 0, is16bit: false },
      { index: 5, name: 'Dimmer', type: 'dimmer', defaultValue: 255, is16bit: false },
      { index: 6, name: 'Strobe', type: 'strobe', defaultValue: 0, is16bit: false },
      { index: 7, name: 'Red', type: 'red', defaultValue: 0, is16bit: false },
      { index: 8, name: 'Green', type: 'green', defaultValue: 0, is16bit: false },
      { index: 9, name: 'Blue', type: 'blue', defaultValue: 0, is16bit: false },
      { index: 10, name: 'White', type: 'white', defaultValue: 0, is16bit: false },
      { index: 11, name: 'Zoom', type: 'zoom', defaultValue: 128, is16bit: false },
    ],
    capabilities: {
      hasPan: true,
      hasTilt: true,
      hasDimmer: true,
      hasColorMixing: true,
      hasStrobe: true,
      colorEngine: 'rgbw',
    },
    physics: {
      motorType: 'stepper',
      maxAcceleration: 2500,
      safetyCap: 0.9,
    },
  },
  {
    id: 'system-strobe-dmx',
    name: 'LED Strobe 1500W',
    manufacturer: 'Generic',
    type: 'Strobe',
    channels: [
      { index: 0, name: 'Dimmer', type: 'dimmer', defaultValue: 0, is16bit: false },
      { index: 1, name: 'Strobe Speed', type: 'strobe', defaultValue: 0, is16bit: false },
    ],
    capabilities: {
      hasDimmer: true,
      hasStrobe: true,
      colorEngine: 'none',
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type FixtureSource = 'system' | 'user'

export interface LibraryFixture extends FixtureDefinition {
  source: FixtureSource
}

export interface LibraryState {
  // Data
  userFixtures: FixtureDefinition[]
  
  // Computed (getters via selectors)
  
  // Actions
  loadFromStorage: () => void
  saveUserFixture: (fixture: FixtureDefinition) => void
  deleteUserFixture: (fixtureId: string) => void
  cloneSystemFixture: (systemFixtureId: string, newName: string) => FixtureDefinition | null
  
  // Selectors
  getAllFixtures: () => LibraryFixture[]
  getFixtureById: (id: string) => LibraryFixture | null
  isSystemFixture: (id: string) => boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function loadUserFixturesFromStorage(): FixtureDefinition[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    console.log(`[LibraryStore] 📂 Loaded ${parsed.length} user fixtures from storage`)
    return parsed
  } catch (error) {
    console.error('[LibraryStore] ❌ Failed to load user fixtures:', error)
    return []
  }
}

function saveUserFixturesToStorage(fixtures: FixtureDefinition[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixtures))
    console.log(`[LibraryStore] 💾 Saved ${fixtures.length} user fixtures to storage`)
  } catch (error) {
    console.error('[LibraryStore] ❌ Failed to save user fixtures:', error)
  }
}

function generateUniqueId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useLibraryStore = create<LibraryState>((set, get) => ({
  // Initial state
  userFixtures: loadUserFixturesFromStorage(),
  
  // Actions
  loadFromStorage: () => {
    const fixtures = loadUserFixturesFromStorage()
    set({ userFixtures: fixtures })
  },
  
  saveUserFixture: (fixture: FixtureDefinition) => {
    const { userFixtures } = get()
    
    // Check if it's trying to save a system fixture (should clone instead)
    if (SYSTEM_FIXTURES.some(sf => sf.id === fixture.id)) {
      console.warn('[LibraryStore] ⚠️ Cannot overwrite system fixture. Use cloneSystemFixture() instead.')
      return
    }
    
    // Update or add
    const existingIndex = userFixtures.findIndex(f => f.id === fixture.id)
    let newFixtures: FixtureDefinition[]
    
    if (existingIndex >= 0) {
      // Update existing
      newFixtures = [...userFixtures]
      newFixtures[existingIndex] = fixture
      console.log(`[LibraryStore] 📝 Updated user fixture: ${fixture.name}`)
    } else {
      // Add new (ensure unique ID)
      const newFixture = {
        ...fixture,
        id: fixture.id.startsWith('user-') ? fixture.id : generateUniqueId(),
      }
      newFixtures = [...userFixtures, newFixture]
      console.log(`[LibraryStore] ➕ Added new user fixture: ${newFixture.name}`)
    }
    
    set({ userFixtures: newFixtures })
    saveUserFixturesToStorage(newFixtures)
  },
  
  deleteUserFixture: (fixtureId: string) => {
    const { userFixtures } = get()
    const newFixtures = userFixtures.filter(f => f.id !== fixtureId)
    
    if (newFixtures.length !== userFixtures.length) {
      set({ userFixtures: newFixtures })
      saveUserFixturesToStorage(newFixtures)
      console.log(`[LibraryStore] 🗑️ Deleted user fixture: ${fixtureId}`)
    }
  },
  
  cloneSystemFixture: (systemFixtureId: string, newName: string): FixtureDefinition | null => {
    const systemFixture = SYSTEM_FIXTURES.find(sf => sf.id === systemFixtureId)
    if (!systemFixture) {
      console.warn(`[LibraryStore] ⚠️ System fixture not found: ${systemFixtureId}`)
      return null
    }
    
    const clonedFixture: FixtureDefinition = {
      ...JSON.parse(JSON.stringify(systemFixture)), // Deep clone
      id: generateUniqueId(),
      name: newName || `${systemFixture.name} (Copy)`,
    }
    
    // Save the clone as user fixture
    const { userFixtures } = get()
    const newFixtures = [...userFixtures, clonedFixture]
    set({ userFixtures: newFixtures })
    saveUserFixturesToStorage(newFixtures)
    
    console.log(`[LibraryStore] 📋 Cloned system fixture "${systemFixture.name}" as "${clonedFixture.name}"`)
    return clonedFixture
  },
  
  // Selectors
  getAllFixtures: (): LibraryFixture[] => {
    const { userFixtures } = get()
    
    const systemWithSource: LibraryFixture[] = SYSTEM_FIXTURES.map(f => ({
      ...f,
      source: 'system' as FixtureSource,
    }))
    
    const userWithSource: LibraryFixture[] = userFixtures.map(f => ({
      ...f,
      source: 'user' as FixtureSource,
    }))
    
    return [...systemWithSource, ...userWithSource]
  },
  
  getFixtureById: (id: string): LibraryFixture | null => {
    // Check system first
    const systemFixture = SYSTEM_FIXTURES.find(sf => sf.id === id)
    if (systemFixture) {
      return { ...systemFixture, source: 'system' }
    }
    
    // Check user fixtures
    const { userFixtures } = get()
    const userFixture = userFixtures.find(uf => uf.id === id)
    if (userFixture) {
      return { ...userFixture, source: 'user' }
    }
    
    return null
  },
  
  isSystemFixture: (id: string): boolean => {
    return SYSTEM_FIXTURES.some(sf => sf.id === id)
  },
}))

// Log on load
console.log(`[LibraryStore] 📚 WAVE 1112: Library initialized with ${SYSTEM_FIXTURES.length} system fixtures`)
