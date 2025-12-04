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

// ============================================================================
// WINDOW INTERFACES
// ============================================================================
interface Window {
  luxsync: {
    // DMX
    getDMXDevices: () => Promise<string[]>
    selectDMXDevice: (deviceId: string) => Promise<boolean>
    sendDMX: (channel: number, value: number) => void
    sendDMXBatch: (values: { channel: number; value: number }[]) => void

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
    triggerEffect: (effectName: string, params?: Record<string, unknown>, duration?: number) => Promise<{ success: boolean; effectId?: number }>
    cancelEffect: (effectId: number) => Promise<{ success: boolean }>
    cancelAllEffects: () => Promise<{ success: boolean }>
    audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm?: number }) => Promise<{ success: boolean }>
    getState: () => Promise<SeleneStateUpdate | null>
    
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
