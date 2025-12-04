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
    setPalette: (paletteIndex: number) => Promise<{ success: boolean }>
    setMovement: (config: { pattern?: string; speed?: number; intensity?: number }) => Promise<{ success: boolean }>
    triggerEffect: (effectName: string, params?: Record<string, unknown>, duration?: number) => Promise<{ success: boolean; effectId?: number }>
    cancelEffect: (effectId: number) => Promise<{ success: boolean }>
    cancelAllEffects: () => Promise<{ success: boolean }>
    audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm?: number }) => Promise<{ success: boolean }>
    getState: () => Promise<SeleneStateUpdate | null>
    
    // Events
    onStateUpdate: (callback: (state: SeleneStateUpdate) => void) => () => void
    onPaletteChange: (callback: (paletteIndex: number) => void) => () => void
    onEffectTriggered: (callback: (effectName: string, effectId: number) => void) => () => void
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
