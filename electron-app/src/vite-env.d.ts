/// <reference types="vite/client" />

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
// WINDOW INTERFACES
// ============================================================================
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
  
  // Lux API (TRINITY PHASE 2)
  lux: {
    // Control
    start: () => Promise<{ success: boolean }>
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
    audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm?: number }) => Promise<{ success: boolean }>
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
    
    // WAVE 9.5: Config
    getConfig: () => Promise<{ success: boolean; config: LuxSyncConfig }>
    saveConfig: (config: Partial<LuxSyncConfig>) => Promise<{ success: boolean }>
    resetConfig: () => Promise<{ success: boolean; config?: LuxSyncConfig }>
  }
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
