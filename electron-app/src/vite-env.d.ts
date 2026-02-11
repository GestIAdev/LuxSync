/// <reference types="vite/client" />

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 1120: SYNCHRONIZED WITH FixtureDefinition.ts - SINGLE SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════════════
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
  | 'cyan'
  | 'magenta'
  | 'yellow'
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  | 'color_wheel'
  | 'gobo'
  | 'gobo_rotation'
  | 'prism'
  | 'prism_rotation'
  | 'focus'
  | 'zoom'
  | 'frost'
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

// ⚒️ WAVE 2030.5: Hephaestus Clip Metadata (for library listing)
interface HephClipMetadata {
  id: string
  name: string
  author: string
  category: string
  tags: string[]
  durationMs: number
  effectType: string
  paramCount: number
  filePath: string
  modifiedAt: number
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

    // ⚒️ WAVE 2030.5: Hephaestus File I/O
    hephaestus: {
      /** Save a clip to disk */
      save: (clipData: unknown) => Promise<{ success: boolean; filePath?: string; id?: string; error?: string }>
      /** Load a clip by ID or file path */
      load: (idOrPath: string) => Promise<{ success: boolean; clip?: unknown; error?: string }>
      /** List all available clips (metadata only) */
      list: () => Promise<{ success: boolean; clips: HephClipMetadata[]; error?: string }>
      /** Delete a clip */
      delete: (idOrPath: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>
      /** Check if clip name exists */
      exists: (name: string) => Promise<{ success: boolean; exists?: boolean }>
      /** Get effects folder path */
      getPath: () => Promise<{ success: boolean; path?: string }>
      /** Generate unique clip ID */
      generateId: () => Promise<{ id: string }>
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
    
    // 🧬 WAVE 500: Consciousness Kill Switch
    setConsciousnessEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
    
    // 🧨 WAVE 610: Force Strike - Manual Effect Detonator
    forceStrike: (config: { effect: string; intensity: number }) => Promise<{ success: boolean }>
    
    // 🎛️ WAVE 62: Vibe Selector
    setVibe: (vibeId: string) => Promise<{ success: boolean; vibeId?: string; error?: string }>
    getVibe: () => Promise<{ success: boolean; vibeId: string; error?: string }>
    onVibeChange: (callback: (data: { vibeId: string; timestamp: number }) => void) => () => void
    
    // 🎭 WAVE 700.5.4: Mood Control
    mood: {
      setMood: (moodId: 'calm' | 'balanced' | 'punk') => Promise<{ success: boolean; moodId?: string; error?: string }>
      getMood: () => Promise<{ success: boolean; moodId: string; error?: string }>
      onMoodChange: (callback: (data: { moodId: string; timestamp: number }) => void) => () => void
    }
    
    // WAVE 9.5: Fixtures
    scanFixtures: (customPath?: string) => Promise<{ success: boolean; fixtures: FixtureLibraryItem[]; searchPaths?: string[] }>
    getFixtureLibrary: () => Promise<{ success: boolean; fixtures: FixtureLibraryItem[] }>
    
    // 🔥 WAVE 384: Get FULL fixture definition with channels
    // 🔥 WAVE 1042.1: Added capabilities object with colorEngine and colorWheel
    getFixtureDefinition: (profileId: string) => Promise<{ 
      success: boolean
      definition?: {
        id: string
        name: string
        manufacturer: string
        type: string
        channelCount: number
        channels: Array<{ index: number; name: string; type: string; is16bit: boolean }>
        filePath: string
        // 🔥 WAVE 1042.1: Physics for motor/movement info
        physics?: {
          motorType?: string
          maxAcceleration?: number
          maxVelocity?: number
          safetyCap?: boolean
          orientation?: string
          invertPan?: boolean
          invertTilt?: boolean
          swapPanTilt?: boolean
          homePosition?: { pan: number; tilt: number }
          tiltLimits?: { min: number; max: number }
        } | null
        // 🔥 WAVE 1042.1: Full capabilities with color engine
        capabilities?: {
          colorEngine?: 'rgb' | 'cmy' | 'wheel' | 'hybrid' | 'none'
          colorWheel?: {
            colors: Array<{
              dmx: number
              name: string
              rgb: { r: number; g: number; b: number }
              hasTexture?: boolean
            }>
          }
        } | null
        // Legacy flat flags (backward compat)
        hasMovementChannels: boolean
        has16bitMovement: boolean
        hasColorMixing: boolean
        hasColorWheel: boolean
        confidence?: number
        detectionMethod?: string
      }
      error?: string 
    }>
    
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
      filePath?: string
      filename?: string
      error?: string
    }>
    
    // WAVE 388 EXT: Delete Definition
    deleteDefinition: (fixtureId: string) => Promise<{
      success: boolean
      deletedId?: string
      deletedPath?: string
      error?: string
    }>
    
    // ⚡ WAVE 27: Fixtures Object
    fixtures: {
      saveDefinition: (definition: FixtureDefinition) => Promise<{
        success: boolean
        path?: string
        filePath?: string
        filename?: string
        error?: string
      }>
      // WAVE 388 EXT: Delete Definition
      deleteDefinition: (fixtureId: string) => Promise<{
        success: boolean
        deletedId?: string
        deletedPath?: string
        error?: string
      }>
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔌 WAVE 1113: LIBRARY UNIFIED API - Real FileSystem
    // Single Source of Truth for Forge + StageConstructor
    // ═══════════════════════════════════════════════════════════════════════════
    library: {
      /** List ALL fixtures: system (read-only from /librerias) + user (writable from userData/fixtures) */
      listAll: () => Promise<{
        success: boolean
        systemFixtures: FixtureLibraryItem[]
        userFixtures: FixtureLibraryItem[]
        paths: {
          system: string
          user: string
        }
        error?: string
      }>
      
      /** Save a fixture to user library (userData/fixtures) */
      saveUser: (fixture: FixtureDefinition) => Promise<{
        success: boolean
        filePath?: string
        fixture?: FixtureDefinition
        error?: string
      }>
      
      /** Delete a fixture from user library (cannot delete system fixtures) */
      deleteUser: (fixtureId: string) => Promise<{
        success: boolean
        deletedPath?: string
        error?: string
      }>
      
      /** Get DMX connection status for Live Probe */
      dmxStatus: () => Promise<{
        connected: boolean
        device: string | null
      }>
    }
    
    // 🎭 WAVE 26: Show Management - PURGED WAVE 365
    // Legacy methods removed. Use lux.stage.* API instead
    
    // WAVE 9.5: Config
    getConfig: () => Promise<{ success: boolean; config: LuxSyncConfig }>
    saveConfig: (config: Partial<LuxSyncConfig>) => Promise<{ success: boolean }>
    resetConfig: () => Promise<{ success: boolean; config?: LuxSyncConfig }>
    
    // ============================================
    // 🎛️ WAVE 375: MASTER ARBITER API
    // ============================================
    arbiter: {
      /** Get Arbiter status (includes outputEnabled - WAVE 1132) */
      status: () => Promise<{
        success: boolean
        status: {
          layer: 'ai' | 'manual'
          hasManualOverrides: boolean
          grandMaster: number
          blackout: boolean
          outputEnabled: boolean  // 🚦 WAVE 1132
          activeOverrides?: Record<string, unknown>
        }
      }>
      
      /** Set Grand Master intensity (0-1) */
      setGrandMaster: (value: number) => Promise<void>
      
      /** 
       * 🎛️ WAVE 375.3: Set manual override for fixtures
       */
      setManual: (args: {
        fixtureIds: string[]
        controls: Record<string, number>
        channels?: string[]
        source?: string
        autoReleaseMs?: number
      }) => Promise<Array<{ success: boolean; fixtureId: string; channels: string[] }>>
      
      /**
       * 🎛️ WAVE 375.3: Clear manual override for specific fixtures/channels
       */
      clearManual: (args: {
        fixtureIds: string[]
        channels?: string[]
      }) => Promise<Array<{ success: boolean; fixtureId: string }>>
      
      /** Clear ALL manual overrides - return to AI control */
      clearAllManual: () => Promise<{ success: boolean }>
      
      /** Toggle blackout state */
      toggleBlackout: () => Promise<{ success: boolean; active: boolean }>
      
      /** Set blackout state */
      setBlackout: (active: boolean) => Promise<{ success: boolean; active: boolean }>
      
      // ============================================
      // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
      // ============================================
      
      /** 
       * Set output enabled state (THE GATE)
       * false = ARMED (engine runs but DMX blocked)
       * true = LIVE (DMX flows to fixtures)
       */
      setOutputEnabled: (enabled: boolean) => Promise<{
        success: boolean
        outputEnabled: boolean
        state: 'LIVE' | 'ARMED'
      }>
      
      /** Toggle output gate (ARMED ↔ LIVE) */
      toggleOutput: () => Promise<{
        success: boolean
        outputEnabled: boolean
        state: 'LIVE' | 'ARMED'
      }>
      
      /** Get output enabled state */
      getOutputEnabled: () => Promise<{
        outputEnabled: boolean
        state: 'LIVE' | 'ARMED'
      }>
      
      /** Check if fixture has manual override */
      hasManual: (fixtureId: string, channel?: string) => Promise<{ success: boolean; hasOverride: boolean }>
      
      /** Subscribe to Arbiter status changes (includes outputEnabled - WAVE 1132) */
      onStatusChange: (callback: (status: {
        layer: 'ai' | 'manual'
        hasManualOverrides: boolean
        grandMaster: number
        blackout: boolean
        outputEnabled: boolean  // 🚦 WAVE 1132
      }) => void) => () => void
      
      /**
       * 🎛️ WAVE 999: Set movement pattern parameter override
       * Connects UI sliders directly to VibeMovementManager
       */
      setMovementParameter: (parameter: 'speed' | 'amplitude', value: number | null) => Promise<{
        success: boolean
        parameter: string
        value: number | null
      }>
      
      /**
       * � WAVE 999.4: Set manual movement pattern
       * Pattern buttons in PatternSelector directly control VibeMovementManager
       */
      setMovementPattern: (pattern: string | null) => Promise<{
        success: boolean
        pattern: string | null
      }>
      
      /**
       * 🎛️ WAVE 999: Clear all movement pattern overrides
       * Restores automatic AI-driven movement calculations
       */
      clearMovementOverrides: () => Promise<{
        success: boolean
      }>
      
      /**
       * 🧠 WAVE 999.6: Get unified state for UI hydration
       * Returns state snapshot with null for AI-controlled channels
       */
      getFixturesState: (fixtureIds: string[]) => Promise<{
        success: boolean
        error?: string
        state?: {
          dimmer: number | null
          color: string | null
          pan: number | null
          tilt: number | null
          pattern: string | null
          speed: number | null
          amplitude: number | null
          zoom: number | null
          focus: number | null
        }
      }>
    }
    
    // ============================================
    // 🔌 WAVE 365: Stage Persistence V2 API
    // 🎯 WAVE 369.5: Native File Dialogs
    // ============================================
    stage: {
      /** Load a show file (V2 format) */
      load: (filePath?: string) => Promise<{
        success: boolean
        showFile?: import('./core/stage/ShowFileV2').ShowFileV2
        filePath?: string
        migrated?: boolean
        warnings?: string[]
        error?: string
      }>
      
      /** Load the active show (on startup) */
      loadActive: () => Promise<{
        success: boolean
        showFile?: import('./core/stage/ShowFileV2').ShowFileV2
        filePath?: string
        migrated?: boolean
        warnings?: string[]
        error?: string
      }>
      
      /** Save show to disk */
      save: (showFile: import('./core/stage/ShowFileV2').ShowFileV2, filePath?: string) => Promise<{
        success: boolean
        filePath?: string
        error?: string
      }>
      
      /** Save show with new name */
      saveAs: (showFile: import('./core/stage/ShowFileV2').ShowFileV2, name: string) => Promise<{
        success: boolean
        filePath?: string
        error?: string
      }>
      
      /** List all shows */
      list: () => Promise<{
        success: boolean
        shows?: Array<{ name: string; path: string; modified: number }>
        error?: string
      }>
      
      /** Get recent shows */
      recent: () => Promise<{
        success: boolean
        recent?: Array<{ name: string; path: string; opened: number }>
        error?: string
      }>
      
      /** Delete a show */
      delete: (filePath: string) => Promise<{
        success: boolean
        error?: string
      }>
      
      /** Get shows folder path */
      getPath: () => Promise<{
        success: boolean
        path?: string
        error?: string
      }>
      
      /** Check if show exists */
      exists: (name: string) => Promise<{
        success: boolean
        exists?: boolean
        path?: string
        error?: string
      }>
      
      // WAVE 369.5: Native File Dialogs
      /** Open file dialog - returns selected path and loads the file */
      openDialog: () => Promise<{
        success: boolean
        cancelled?: boolean
        filePath?: string
        showFile?: import('./core/stage/ShowFileV2').ShowFileV2
        error?: string
      }>
      
      /** Save As dialog - let user choose name/location */
      saveAsDialog: (showFile: import('./core/stage/ShowFileV2').ShowFileV2, suggestedName?: string) => Promise<{
        success: boolean
        cancelled?: boolean
        filePath?: string
        error?: string
      }>
      
      /** Confirm unsaved changes dialog */
      confirmUnsaved: (showName: string) => Promise<'save' | 'discard' | 'cancel'>
      
      /** Subscribe to show loaded event */
      onLoaded: (callback: (data: {
        showFile: import('./core/stage/ShowFileV2').ShowFileV2
        filePath?: string
        migrated?: boolean
        warnings?: string[]
      }) => void) => () => void
    }
  }
}
} // End declare global

// 🎭 WAVE 26: Show Types - PURGED WAVE 365
// Legacy types removed. Use ShowFileV2 from src/core/stage/ShowFileV2.ts instead

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

// WAVE 9.5: Fixture Types - WAVE 390.5: Complete interface for Edit support
interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
  confidence?: number
  detectionMethod?: string
  hasMovementChannels?: boolean
  has16bitMovement?: boolean
  hasColorMixing?: boolean
  hasColorWheel?: boolean
  // WAVE 390.5: Full fixture data for Edit
  channels?: Array<{ index: number; name?: string; type: string; is16bit: boolean; defaultValue?: number }>
  physics?: {
    motorType?: string
    maxAcceleration?: number
    maxVelocity?: number
    safetyCap?: number | boolean
    orientation?: string
    invertPan?: boolean
    invertTilt?: boolean
    swapPanTilt?: boolean
    homePosition?: { pan: number; tilt: number }
    tiltLimits?: { min: number; max: number }
  }
  capabilities?: {
    hasPan?: boolean
    hasTilt?: boolean
    hasColorMixing?: boolean
    hasColorWheel?: boolean
    hasGobo?: boolean
    hasPrism?: boolean
    hasStrobe?: boolean
    hasDimmer?: boolean
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 384: LUXDEBUG API - Testing utilities
// ═══════════════════════════════════════════════════════════════════════════
interface LuxDebugAPI {
  testConstructor: () => Promise<{
    success: boolean
    profile?: any
    definition?: any
    assertions?: Record<string, boolean>
    error?: string
  }>
  inspectFixture: (fixtureId: string) => { fixtureId: string; note: string }
  help: () => void
}

declare global {
  interface Window {
    luxDebug: LuxDebugAPI
  }
}

// Required to make this file a module for declare global to work
export {}
