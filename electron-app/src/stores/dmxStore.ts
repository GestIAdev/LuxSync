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
  manufacturer: string
  channelCount: number
  dmxAddress: number
  universe: number
  filePath: string
  zone?: string  // WAVE 10: Auto-assigned zone (FRONT_PARS, BACK_PARS, MOVING_LEFT, etc.)
  manualOverride?: string  // WAVE 10.5: Manual type override by user
}

// WAVE 9.6.3: Real-time DMX values for each fixture
export interface FixtureValues {
  dmxAddress: number
  dimmer: number      // 0-255
  r: number           // 0-255
  g: number           // 0-255
  b: number           // 0-255
  pan?: number        // 0-255
  tilt?: number       // 0-255
  zone?: string
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
  
  // WAVE 9.6.3: Real-time fixture values from Selene
  fixtureValues: Map<number, FixtureValues>  // keyed by dmxAddress
  
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
  setFixtures: (fixtures: PatchedFixture[]) => void
  addFixture: (fixture: PatchedFixture) => void
  removeFixture: (id: string) => void
  removeFixtureByAddress: (dmxAddress: number) => void
  updateFixture: (id: string, updates: Partial<PatchedFixture>) => void
  updateFixtureByAddress: (dmxAddress: number, updates: Partial<PatchedFixture>) => void  // WAVE 10.5
  clearFixtures: () => void
  updateStats: (fps: number) => void
  // WAVE 9.6.3: Update fixture values from main process
  updateFixtureValues: (values: FixtureValues[]) => void
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
  // 🎯 WAVE 13.6: DEFAULTS PESIMISTAS - "Truth First"
  // La UI nace asumiendo que TODO está desconectado
  // El Backend dirá la verdad en el Initial State Handshake
  driver: null,
  port: null,
  isConnected: false,  // ❌ PESIMISTA: Desconectado por defecto
  connectionError: null,
  availableInterfaces: [],
  universe: 1,
  frameRate: 44,
  fixtures: [],
  fixtureCount: 0,
  channelsUsed: 0,
  fixtureValues: new Map(),  // WAVE 9.6.3
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
  
  setFixtures: (fixtures) => {
    const channelsUsed = fixtures.reduce((sum, f) => sum + f.channelCount, 0)
    set({
      fixtures,
      fixtureCount: fixtures.length,
      channelsUsed,
    })
  },
  
  addFixture: (fixture) => {
    const { fixtures } = get()
    const newFixtures = [...fixtures, fixture]
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channelCount, 0)
    
    set({
      fixtures: newFixtures,
      fixtureCount: newFixtures.length,
      channelsUsed,
    })
  },
  
  removeFixture: (id) => {
    const { fixtures } = get()
    const newFixtures = fixtures.filter(f => f.id !== id)
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channelCount, 0)
    
    set({
      fixtures: newFixtures,
      fixtureCount: newFixtures.length,
      channelsUsed,
    })
  },
  
  removeFixtureByAddress: (dmxAddress) => {
    const { fixtures } = get()
    const newFixtures = fixtures.filter(f => f.dmxAddress !== dmxAddress)
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channelCount, 0)
    
    set({
      fixtures: newFixtures,
      fixtureCount: newFixtures.length,
      channelsUsed,
    })
  },
  
  updateFixture: (id, updates) => {
    const { fixtures } = get()
    const newFixtures = fixtures.map(f => f.id === id ? { ...f, ...updates } : f)
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channelCount, 0)
    
    set({
      fixtures: newFixtures,
      channelsUsed,
    })
  },

  // WAVE 10.5: Update fixture by DMX address
  updateFixtureByAddress: (dmxAddress, updates) => {
    const { fixtures } = get()
    const newFixtures = fixtures.map(f => f.dmxAddress === dmxAddress ? { ...f, ...updates } : f)
    const channelsUsed = newFixtures.reduce((sum, f) => sum + f.channelCount, 0)
    
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
  
  // WAVE 9.6.3: Update fixture values from Selene main loop
  updateFixtureValues: (values) => {
    const newMap = new Map<number, FixtureValues>()
    values.forEach(v => newMap.set(v.dmxAddress, v))
    set({ fixtureValues: newMap })
  },
}))
