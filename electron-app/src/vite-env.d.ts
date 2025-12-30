/// <reference types="vite/client" />

// ⚡ WAVE 27: Fixture Definition Types (Fixture Forge)
type ChannelType = 
  | 'dimmer'
  | 'strobe'
  | 'shutter'
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  | 'color_wheel'
  | 'gobo'
  | 'prism'
  | 'focus'
  | 'zoom'
  | 'speed'
  | 'macro'
  | 'control'
  | 'unknown'

interface FixtureChannel {
  index: number
  name: string
  type: ChannelType
  defaultValue: number
  is16bit: boolean
}

interface FixtureDefinition {
  id: string
  name: string
  manufacturer: string
  type: string
  channels: FixtureChannel[]
}

// ============================================================================
// SELENE STATE UPDATE (from Main Process)
// ============================================================================
interface SeleneStateUpdate {
  colors?: {
    primary: { r: number; g: number; b: number }
    secondary: { r: number; g: number; b: number }
    accent: { r: number; g: number; b: number }
  }
  movement?: {
    pan: number
    tilt: number
    pattern: string
    speed: number
  }
  beat?: {
    bpm: number
    onBeat: boolean
    beatPhase: number
    confidence: number
  }
  brain?: {
    mode: 'reactive' | 'intelligent'
    confidence: number
    beautyScore: number
    energy: number
    mood: string
    section: string
  }
  palette?: {
    name: string
    source: 'memory' | 'procedural' | 'fallback'
  }
  frameId?: number
  timestamp?: number
}

// 🌪️ WAVE 11: DMX Device (from UniversalDMXDriver)
interface DMXDevice {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
  deviceType: 'ftdi' | 'ch340' | 'prolific' | 'cp210x' | 'generic' | 'unknown'
  friendlyName: string
  confidence: number
}

// ============================================================================
// WINDOW INTERFACES (Global Extension)
// ============================================================================
declare global {
  interface Window {
    luxsync: {
    // DMX (legacy)
    getDMXDevices: () => Promise<string[]>
    selectDMXDevice: (deviceId: string) => Promise<boolean>
    sendDMX: (channel: number, value: number) => void
    sendDMXBatch: (values: { channel: number; value: number }[]) => void

    // 🌪️ WAVE 11: Universal DMX Driver
    dmx: {
      getStatus: () => Promise<{ success: boolean; state: string; device?: DMXDevice }>
      listDevices: () => Promise<{ success: boolean; devices: DMXDevice[] }>
      autoConnect: () => Promise<{ success: boolean; device?: DMXDevice; state: string; error?: string }>
      connect: (portPath: string) => Promise<{ success: boolean; device?: DMXDevice; state: string; error?: string }>
      disconnect: () => Promise<{ success: boolean; state: string }>
      blackout: () => Promise<{ success: boolean }>
      highlightFixture: (startChannel: number, channelCount: number, isMovingHead: boolean) => Promise<{ success: boolean }>
      onStatus: (callback: (status: { state: string; device?: DMXDevice; error?: string }) => void) => () => void
      onConnected: (callback: (device: DMXDevice) => void) => () => void
      onDisconnected: (callback: () => void) => () => void
    }

    // Audio
    getAudioDevices: () => Promise<string[]>
    selectAudioDevice: (deviceId: string) => Promise<boolean>
    startAudioCapture: () => void
    stopAudioCapture: () => void
    onAudioData: (callback: (data: AudioData) => void) => void
    
    // WAVE 9.6.2: Desktop Capturer para audio del sistema
    audio: {
      getDesktopSources: () => Promise<Array<{ id: string; name: string; displayId: string }>>
    }
    
    // 🧠 WAVE 10: Selene Mode Control
    selene: {
      onDecision: (callback: (decision: unknown) => void) => void
      onMoodChange: (callback: (mood: string) => void) => void
      setMode: (mode: 'flow' | 'selene' | 'locked') => void
    }

    // App
    minimize: () => void
    maximize: () => void
    close: () => void
    onBlackout: (callback: () => void) => void
  }
  
  // 🎯 WAVE 13.6: Electron IPC API (for direct event subscriptions)
  electron: {
    ipcRenderer: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
      removeListener: (channel: string, listener: (...args: any[]) => void) => void
    }
  }
  
  // Lux API (TRINITY PHASE 2)
  lux: {
    // Control
    start: () => Promise<{ success: boolean; inputGain?: number; alreadyRunning?: boolean }>  // 🔧 WAVE 15.1
    stop: () => Promise<{ success: boolean }>
    // FIX: Ahora acepta string canónico del ColorEngine ('fuego' | 'hielo' | 'selva' | 'neon')
    setPalette: (paletteId: string) => Promise<{ success: boolean }>
    setMovement: (config: { pattern?: string; speed?: number; intensity?: number }) => Promise<{ success: boolean }>
    
    // 🎚️ WAVE 13.6: Mode control (flow, selene, locked)
    setMode: (mode: 'flow' | 'selene' | 'locked') => Promise<{ success: boolean; mode?: string; brain?: boolean; error?: string }>
    
    // 🎨 WAVE 13.6: Global color multipliers (STATE OF TRUTH)
    setGlobalColorParams: (params: { saturation?: number; intensity?: number }) => Promise<{ 
      success: boolean
      params?: { saturation: number; intensity: number }
      error?: string
    }>
    
    triggerEffect: (effectName: string, params?: Record<string, unknown>, duration?: number) => Promise<{ success: boolean; effectId?: number }>
    cancelEffect: (effectIdOrName: number | string) => Promise<{ success: boolean }>
    cancelAllEffects: () => Promise<{ success: boolean }>
    setBlackout: (active: boolean) => Promise<{ success: boolean }>
    
    // 🗡️ WAVE 15.3 REAL: Raw audio buffer - El único camino a Trinity
    audioBuffer: (buffer: Float32Array) => Promise<{ success: boolean }>
    
    // Legacy: NO alimenta Trinity Workers
    // 🎯 WAVE 39.1: Ahora incluye fftBins (64 bins normalizados 0-1)
    audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm?: number; fftBins?: number[] }) => Promise<{ success: boolean }>
    getState: () => Promise<SeleneStateUpdate | null>
    
    // 🎯 WAVE 13.6: Full state sync for initial handshake
    getFullState: () => Promise<{
      dmx: {
        isConnected: boolean
        status: string
        driver: string | null
        port: string | null
      }
      selene: {
        isRunning: boolean
        mode: string | null
        brainMode: string | null
        paletteSource: string | null
        consciousness: unknown | null
      }
      fixtures: PatchedFixture[]
      audio: {
        hasWorkers: boolean
      }
    }>
    
    // Events
    onStateUpdate: (callback: (state: SeleneStateUpdate) => void) => () => void
    onPaletteChange: (callback: (paletteId: string) => void) => () => void
    onEffectTriggered: (callback: (effectName: string, effectId: number) => void) => () => void
    
    // 🎯 WAVE 13.6: Mode change confirmation from Backend
    onModeChange: (callback: (data: { mode: string; brain: boolean }) => void) => () => void
    
    // 📡 WAVE-14: Telemetry updates (20 FPS)
    onTelemetryUpdate: (callback: (packet: unknown) => void) => () => void
    
    // 📡 WAVE 15.3: TRUTH CABLE - Datos reales de Trinity Workers
    onAudioAnalysis: (callback: (analysis: unknown) => void) => () => void
    onLightingDecision: (callback: (decision: unknown) => void) => () => void
    
    // 🌙 WAVE 248: TITAN 2.0 TRUTH PROTOCOL - La Verdad Única
    onTruthUpdate: (callback: (data: import('./core/protocol/SeleneProtocol').SeleneTruth) => void) => () => void
    
    // � WAVE 25.7: THE CHRONICLER - Log events via dedicated channel
    onLog: (callback: (logEntry: { id: string; timestamp: number; category: string; message: string; data?: any }) => void) => () => void
    
    // �📡 WAVE-14: Input Gain control
    setInputGain: (value: number) => Promise<{ success: boolean; inputGain?: number; error?: string }>
    
    // 🎨 WAVE-14.5: Lab Controls
    forceMutate: () => Promise<{ success: boolean; error?: string }>
    resetMemory: () => Promise<{ success: boolean; error?: string }>
    
    // 🎛️ WAVE 62: Vibe Selector
    setVibe: (vibeId: string) => Promise<{ success: boolean; vibeId?: string; error?: string }>
    getVibe: () => Promise<{ success: boolean; vibeId: string; error?: string }>
    onVibeChange: (callback: (data: { vibeId: string; timestamp: number }) => void) => () => void
    
    // WAVE 9.5: Fixtures
    scanFixtures: (customPath?: string) => Promise<{ success: boolean; fixtures: FixtureLibraryItem[]; searchPaths?: string[] }>
    getFixtureLibrary: () => Promise<{ success: boolean; fixtures: FixtureLibraryItem[] }>
    getPatchedFixtures: () => Promise<{ success: boolean; fixtures: PatchedFixture[] }>
    patchFixture: (fixtureId: string, dmxAddress: number, universe?: number) => Promise<{ success: boolean; fixture?: PatchedFixture; totalPatched?: number }>
    unpatchFixture: (dmxAddress: number) => Promise<{ success: boolean; removed?: PatchedFixture }>
    clearPatch: () => Promise<{ success: boolean; cleared?: number }>
    
    // WAVE 10.5: Force fixture type override
    forceFixtureType: (dmxAddress: number, newType: string) => Promise<{ success: boolean; fixture?: PatchedFixture }>
    
    // 🎯 WAVE 12.5: Installation Type Selector (ceiling/floor)
    setInstallationType: (type: 'ceiling' | 'floor') => Promise<{ 
      success: boolean
      installationType?: 'ceiling' | 'floor'
      appliedTo?: number
      description?: string 
    }>
    
    // WAVE 10.6: New show - full reset
    newShow: () => Promise<{ success: boolean; message?: string; clearedFixtures?: number }>
    
    // ⚡ WAVE 27: Fixture Forge - Save Definition
    saveDefinition: (definition: FixtureDefinition) => Promise<{
      success: boolean
      path?: string
      filename?: string
      error?: string
    }>
    
    // ⚡ WAVE 27: Fixtures Object
    fixtures: {
      saveDefinition: (definition: FixtureDefinition) => Promise<{
        success: boolean
        path?: string
        filename?: string
        error?: string
      }>
    }
    
    // 🎭 WAVE 26: Show Management (Save/Load/Delete)
    listShows: () => Promise<{
      success: boolean
      shows: ShowMetadata[]
      showsPath: string
      error?: string
    }>
    saveShow: (name: string, description: string) => Promise<{
      success: boolean
      filename?: string
      path?: string
      error?: string
    }>
    loadShow: (filename: string) => Promise<{
      success: boolean
      data?: ShowData
      error?: string
    }>
    deleteShow: (filename: string) => Promise<{
      success: boolean
      error?: string
    }>
    createShow: (name: string, description?: string) => Promise<{
      success: boolean
      filename?: string
      path?: string
      error?: string
    }>
    getShowsPath: () => Promise<{ success: boolean; path: string }>
    
    // WAVE 9.5: Config
    getConfig: () => Promise<{ success: boolean; config: LuxSyncConfig }>
    saveConfig: (config: Partial<LuxSyncConfig>) => Promise<{ success: boolean }>
    resetConfig: () => Promise<{ success: boolean; config?: LuxSyncConfig }>
  }
}
} // End declare global

// 🎭 WAVE 26: Show Types
interface ShowMetadata {
  filename: string
  name: string
  description: string
  createdAt: string
  modifiedAt: string
  sizeBytes: number
  fixtureCount: number
  version: string
}

interface ShowData {
  name: string
  description: string
  createdAt: string
  modifiedAt: string
  version: string
  audio: AudioConfig
  dmx: DMXConfig
  patchedFixtures: PatchedFixture[]
  seleneMode: string
  installationType: 'ceiling' | 'floor'
}

interface AudioConfig {
  source: 'microphone' | 'system' | 'simulation'
  deviceId?: string
  sensitivity: number
  inputGain?: number
}

interface DMXConfig {
  driver: string
  port: string
  universe: number
  frameRate: number
}

// WAVE 9.5: Fixture Types
interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
}

interface PatchedFixture extends FixtureLibraryItem {
  dmxAddress: number
  universe: number
  zone?: string  // WAVE 10: Auto-assigned zone
}

interface LuxSyncConfig {
  audio: {
    source: 'microphone' | 'system' | 'simulation'
    deviceId?: string
    sensitivity: number
  }
  dmx: {
    driver: string
    port: string
    universe: number
    frameRate: number
  }
  fixtures: PatchedFixture[]
  ui: {
    theme: string
    showAdvanced: boolean
  }
}

interface AudioData {
  bpm: number
  energy: number
  bass: number
  mid: number
  treble: number
  frequencies: number[]
  waveform: number[]
}

// Required to make this file a module for declare global to work
export {}
