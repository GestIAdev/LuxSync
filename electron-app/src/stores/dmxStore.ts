/**
 * 💡 DMX STORE - DMX Interface & Fixtures
 * WAVE 9: Estado de la interfaz DMX y fixtures patcheados
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type DMXDriver = 'enttec-open' | 'enttec-pro' | 'artnet' | 'sacn' | 'virtual'

export interface DMXInterface {
  driver: DMXDriver
  port: string
  label: string
}

export interface PatchedFixture {
  id: string
  name: string
  type: string
  address: number
  channels: number
  universe: number
}

export interface DMXState {
  // Connection
  driver: DMXDriver | null
  port: string | null
  isConnected: boolean
  connectionError: string | null
  
  // Available interfaces
  availableInterfaces: DMXInterface[]
  
  // Config
  universe: number
  frameRate: number
  
  // Fixtures
  fixtures: PatchedFixture[]
  fixtureCount: number
  channelsUsed: number
  
  // Status
  lastFrameTime: number
  framesPerSecond: number
  
  // Actions
  connect: (driver: DMXDriver, port: string) => void
  disconnect: () => void
  setConnectionError: (error: string | null) => void
  setAvailableInterfaces: (interfaces: DMXInterface[]) => void
  setUniverse: (universe: number) => void
  setFrameRate: (rate: number) => void
  addFixture: (fixture: PatchedFixture) => void
  removeFixture: (id: string) => void
  updateFixture: (id: string, updates: Partial<PatchedFixture>) => void
  clearFixtures: () => void
  updateStats: (fps: number) => void
}

// ============================================
// AVAILABLE DRIVERS
// ============================================

export const DMX_DRIVERS: { id: DMXDriver; label: string; description: string }[] = [
  { id: 'enttec-open', label: 'ENTTEC Open DMX USB', description: 'Interfaz básica USB-DMX' },
  { id: 'enttec-pro', label: 'ENTTEC DMX USB Pro', description: 'Interfaz profesional con RDM' },
  { id: 'artnet', label: 'Art-Net (Network)', description: 'DMX sobre red Ethernet' },
  { id: 'sacn', label: 'sACN / E1.31', description: 'Streaming ACN sobre red' },
  { id: 'virtual', label: 'Virtual (Demo)', description: 'Simulación sin hardware' },
]

// ============================================
// STORE
// ============================================

export const useDMXStore = create<DMXState>((set, get) => ({
  // Initial state
  driver: null,
  port: null,
  isConnected: false,
  connectionError: null,
  availableInterfaces: [],
  universe: 1,
  frameRate: 44,
  fixtures: [],
  fixtureCount: 0,
  channelsUsed: 0,
  lastFrameTime: 0,
  framesPerSecond: 0,
  
  // Actions
  connect: (driver, port) => {
    set({
      driver,
      port,
      isConnected: true,
      connectionError: null,
    })
  },
  
  disconnect: () => {
    set({
      driver: null,
      port: null,
      isConnected: false,
    })
  },
  
  setConnectionError: (error) => {
    set({ connectionError: error, isConnected: error ? false : get().isConnected })
  },
  
  setAvailableInterfaces: (interfaces) => {
    set({ availableInterfaces: interfaces })
  },
  
  setUniverse: (universe) => {
    set({ universe: Math.max(1, Math.min(universe, 32768)) })
  },
  
  setFrameRate: (rate) => {
    set({ frameRate: Math.max(1, Math.min(rate, 44)) })
  },
  
  addFixture: (fixture) => {
    const { fixtures } = get()
    const newFixtures = [...fixtures, fixture]
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channels, 0)
    
    set({
      fixtures: newFixtures,
      fixtureCount: newFixtures.length,
      channelsUsed,
    })
  },
  
  removeFixture: (id) => {
    const { fixtures } = get()
    const newFixtures = fixtures.filter(f => f.id !== id)
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channels, 0)
    
    set({
      fixtures: newFixtures,
      fixtureCount: newFixtures.length,
      channelsUsed,
    })
  },
  
  updateFixture: (id, updates) => {
    const { fixtures } = get()
    const newFixtures = fixtures.map(f => f.id === id ? { ...f, ...updates } : f)
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channels, 0)
    
    set({
      fixtures: newFixtures,
      channelsUsed,
    })
  },
  
  clearFixtures: () => {
    set({
      fixtures: [],
      fixtureCount: 0,
      channelsUsed: 0,
    })
  },
  
  updateStats: (fps) => {
    set({
      framesPerSecond: fps,
      lastFrameTime: Date.now(),
    })
  },
}))
