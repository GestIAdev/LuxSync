/**
 * 📡 SELENE TELEMETRY STORE
 * WAVE 14: Brain Surgery & Monitoring
 * 
 * Zustand store for real-time telemetry data from SeleneLux backend.
 * Updates at ~20 FPS via IPC.
 */

import { create } from 'zustand'

// ═══════════════════════════════════════════════════════════════════════════
// 📊 TELEMETRY TYPES (mirror backend interfaces)
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioTelemetry {
  spectrum: {
    bass: number
    mid: number
    treble: number
  }
  energy: {
    current: number
    peak: number
    trend: 'rising' | 'falling' | 'stable'
  }
  beat: {
    detected: boolean
    bpm: number
    confidence: number
    phase: number
  }
  inputGain: number
}

export interface MusicalDNATelemetry {
  key: string | null
  mode: string
  modeDescription: string
  mood: string
  
  zodiac: {
    element: 'fire' | 'water' | 'air' | 'earth'
    position: number
    sign: string
    symbol: string
  }
  
  section: {
    type: string
    confidence: number
    estimatedDuration: number
  }
  
  rhythm: {
    bpm: number
    bpmConfidence: number
    syncopation: number
  }
  
  genre: {
    primary: string
    secondary: string | null
    confidence: number
  }
  
  energy: number
  energyTrend: 'rising' | 'falling' | 'stable'
}

export interface HuntTelemetry {
  status: 'idle' | 'stalking' | 'evaluating' | 'striking' | 'learning' | 'completed'
  cycleId: string | null
  
  currentTarget: {
    pattern: string
    emotionalTone: string
    cyclesObserved: number
    maxCycles: number
    huntWorthiness: number
    beautyTrend: 'rising' | 'falling' | 'stable'
    stabilityScore: number
  } | null
  
  strikeConditions: {
    beauty: { current: number; threshold: number; met: boolean }
    trend: { direction: string; required: string; met: boolean }
    harmony: { consonance: number; threshold: number; met: boolean }
    health: { current: number; threshold: number; met: boolean }
    cooldown: { ready: boolean; timeUntilReady: number }
    conditionsMet: number
    totalConditions: number
    strikeScore: number
    allConditionsMet: boolean
  }
  
  preyCandidates: Array<{
    pattern: string
    huntWorthiness: number
    isTarget: boolean
  }>
  
  estimatedTimeToStrike: number
}

export interface CosmicTelemetry {
  zodiac: {
    currentPosition: number
    currentSign: string
    symbol: string
    element: 'fire' | 'water' | 'air' | 'earth'
    quality: 'cardinal' | 'fixed' | 'mutable'
    creativity: number
    stability: number
    adaptability: number
    description: string
  }
  
  fibonacci: {
    sequence: number[]
    harmonyRatio: number
    phi: number
    musicalKey: string
  }
  
  elementalAffinities: {
    fire: number
    water: number
    air: number
    earth: number
  }
}

export interface PaletteTelemetry {
  strategy: 'analogous' | 'triadic' | 'complementary' | 'split-complementary'
  source: 'memory' | 'procedural' | 'fallback'
  
  // 🎨 WAVE 17.4: SeleneColorEngine debug info
  macroGenre?: string        // e.g., "ELECTRONIC_4X4", "LATINO_TRADICIONAL"
  temperature?: string       // e.g., "warm", "cool", "neutral"
  description?: string       // e.g., "Azul profundo hipnótico (Techno A minor)"
  debugKey?: string          // Musical key from SeleneColorEngine
  debugMode?: string         // Musical mode from SeleneColorEngine
  
  colors: {
    primary: { h: number; s: number; l: number; hex: string }
    secondary: { h: number; s: number; l: number; hex: string }
    accent: { h: number; s: number; l: number; hex: string }
    ambient: { h: number; s: number; l: number; hex: string }
    contrast: { h: number; s: number; l: number; hex: string }
  }
  
  dnaDerivation: {
    keyToHue: { key: string | null; hue: number }
    modeShift: { mode: string; delta: number }
    zodiacPull: { element: string; delta: number }
    finalHue: number
  }
}

export interface SessionTelemetry {
  uptime: number
  framesProcessed: number
  strikesExecuted: number
  averageBeauty: number
  mutationCount: number
  healthScore: number
  palettesFromMemory: number
  palettesGenerated: number
  patternsLearned: number
  brainMode: 'reactive' | 'intelligent'
  confidence: number
}

export interface TelemetryLogEntry {
  id: string
  timestamp: number
  type: 'MODE' | 'BEAT' | 'BPM' | 'GENRE' | 'STRIKE' | 'BIAS' | 'PALETTE' 
      | 'ZODIAC' | 'SECTION' | 'HUNT' | 'MEMORY' | 'MUTATION' | 'INFO'
  message: string
  severity: 'info' | 'warning' | 'success' | 'error'
  duplicateCount: number
  data?: Record<string, unknown>
}

export interface SeleneTelemetryPacket {
  timestamp: number
  frameId: number
  
  audio: AudioTelemetry
  dna: MusicalDNATelemetry
  hunt: HuntTelemetry
  cosmic: CosmicTelemetry
  palette: PaletteTelemetry
  session: SessionTelemetry
  
  newLogEntries: TelemetryLogEntry[]
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏪 ZUSTAND STORE
// ═══════════════════════════════════════════════════════════════════════════

interface TelemetryState {
  // Connection state
  connected: boolean
  lastUpdate: number
  
  // 📡 WAVE 15.3: TRUTH CABLE - Estado de conexión con Workers reales
  trinityConnected: boolean
  trinityLastUpdate: number
  signalLost: boolean  // True si no hay señal por más de 1 segundo
  
  // Latest telemetry data
  audio: AudioTelemetry | null
  dna: MusicalDNATelemetry | null
  hunt: HuntTelemetry | null
  cosmic: CosmicTelemetry | null
  palette: PaletteTelemetry | null
  session: SessionTelemetry | null
  
  // 📡 WAVE 15.3: Datos reales de Trinity Workers
  trinityAudio: {
    bass: number
    mid: number
    treble: number
    energy: number
    bpm: number
    onBeat: boolean
  } | null
  
  trinityDecision: {
    beautyScore: number
    paletteIntensity: number
    movementPattern: string
  } | null
  
  // Log history (accumulated)
  logs: TelemetryLogEntry[]
  logFilter: string
  logAutoScroll: boolean
  
  // Actions
  updateTelemetry: (packet: SeleneTelemetryPacket) => void
  updateFromTrinityAudio: (analysis: unknown) => void
  updateFromTrinityDecision: (decision: unknown) => void
  checkSignalLost: () => void
  setLogFilter: (filter: string) => void
  toggleLogAutoScroll: () => void
  clearLogs: () => void
}

// Default values
const DEFAULT_AUDIO: AudioTelemetry = {
  spectrum: { bass: 0, mid: 0, treble: 0 },
  energy: { current: 0, peak: 0, trend: 'stable' },
  // Defaults - 🚑 RESCUE DIRECTIVE: No more mock values
  beat: { detected: false, bpm: 0, confidence: 0, phase: 0 },
  inputGain: 1,
}

const DEFAULT_DNA: MusicalDNATelemetry = {
  key: null,
  mode: 'major',
  modeDescription: 'Desconocido',
  mood: 'neutral',
  zodiac: { element: 'earth', position: 0, sign: 'Taurus', symbol: '♉' },
  section: { type: 'unknown', confidence: 0, estimatedDuration: 0 },
  rhythm: { bpm: 0, bpmConfidence: 0, syncopation: 0 }, // 🚑 RESCUE DIRECTIVE: No mock BPM
  genre: { primary: 'unknown', secondary: null, confidence: 0 },
  energy: 0,
  energyTrend: 'stable',
}

const DEFAULT_HUNT: HuntTelemetry = {
  status: 'idle',
  cycleId: null,
  currentTarget: null,
  strikeConditions: {
    beauty: { current: 0, threshold: 0.85, met: false },
    trend: { direction: 'stable', required: 'rising', met: false },
    harmony: { consonance: 0, threshold: 0.7, met: false },
    health: { current: 0, threshold: 0.6, met: false },
    cooldown: { ready: true, timeUntilReady: 0 },
    conditionsMet: 0,
    totalConditions: 5,
    strikeScore: 0,
    allConditionsMet: false,
  },
  preyCandidates: [],
  estimatedTimeToStrike: -1,
}

const DEFAULT_COSMIC: CosmicTelemetry = {
  zodiac: {
    currentPosition: 0,
    currentSign: 'Aries',
    symbol: '♈',
    element: 'fire',
    quality: 'cardinal',
    creativity: 0.5,
    stability: 0.5,
    adaptability: 0.5,
    description: 'Iniciando...',
  },
  fibonacci: {
    sequence: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
    harmonyRatio: 0.618,
    phi: 1.618,
    musicalKey: 'C',
  },
  elementalAffinities: { fire: 0.25, water: 0.25, air: 0.25, earth: 0.25 },
}

const DEFAULT_PALETTE: PaletteTelemetry = {
  strategy: 'analogous',
  source: 'procedural',
  colors: {
    primary: { h: 280, s: 70, l: 50, hex: '#a855f7' },
    secondary: { h: 200, s: 70, l: 50, hex: '#0ea5e9' },
    accent: { h: 40, s: 80, l: 60, hex: '#f59e0b' },
    ambient: { h: 280, s: 40, l: 30, hex: '#6b21a8' },
    contrast: { h: 100, s: 60, l: 50, hex: '#84cc16' },
  },
  dnaDerivation: {
    keyToHue: { key: null, hue: 280 },
    modeShift: { mode: 'major', delta: 0 },
    zodiacPull: { element: 'earth', delta: 0 },
    finalHue: 280,
  },
}

const DEFAULT_SESSION: SessionTelemetry = {
  uptime: 0,
  framesProcessed: 0,
  strikesExecuted: 0,
  averageBeauty: 0.5,
  mutationCount: 0,
  healthScore: 0.8,
  palettesFromMemory: 0,
  palettesGenerated: 0,
  patternsLearned: 0,
  brainMode: 'reactive',
  confidence: 0,
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  // Initial state
  connected: false,
  lastUpdate: 0,
  
  // 📡 WAVE 15.3: TRUTH CABLE State
  trinityConnected: false,
  trinityLastUpdate: 0,
  signalLost: true,  // Empieza como "SIGNAL LOST" hasta recibir datos
  trinityAudio: null,
  trinityDecision: null,
  
  audio: DEFAULT_AUDIO,
  dna: DEFAULT_DNA,
  hunt: DEFAULT_HUNT,
  cosmic: DEFAULT_COSMIC,
  palette: DEFAULT_PALETTE,
  session: DEFAULT_SESSION,
  
  logs: [],
  logFilter: 'ALL',
  logAutoScroll: true,
  
  // Actions
  updateTelemetry: (packet: SeleneTelemetryPacket) => {
    set((state) => {
      // Accumulate new log entries
      const newLogs = [...packet.newLogEntries, ...state.logs].slice(0, 200)
      
      return {
        connected: true,
        lastUpdate: packet.timestamp,
        audio: packet.audio,
        dna: packet.dna,
        hunt: packet.hunt,
        cosmic: packet.cosmic,
        palette: packet.palette,
        session: packet.session,
        logs: newLogs,
      }
    })
  },
  
  // 📡 WAVE 15.3: Actualizar con datos REALES de Beta (audio-analysis)
  // 📡 WAVE 15.4: Añadido syncopation, groove, key, mood
  // 🎯 WAVE 16: Cooldown para Key/Mood (anti-epilepsia UI)
  updateFromTrinityAudio: (analysis: unknown) => {
    const data = analysis as {
      bass?: number
      mid?: number
      treble?: number
      energy?: number
      bpm?: number
      bpmConfidence?: number
      onBeat?: boolean
      spectrum?: { bass: number; mid: number; treble: number }
      // WAVE 15.4: Campos que faltaban
      syncopation?: number
      groove?: number
      key?: string
      mood?: 'dark' | 'bright' | 'neutral'
      beatPhase?: number
      beatStrength?: number
    }
    
    const currentState = get()
    const now = Date.now()
    
    // 🎯 WAVE 16: Cooldown para Key y Mood (3 segundos)
    // Esto evita que la UI flashee cada frame cuando la detección cambia
    const KEY_MOOD_COOLDOWN_MS = 3000; // 3 segundos de estabilidad
    
    // Determinar si podemos actualizar Key
    let newKey = currentState.dna?.key ?? null;
    if (data.key !== undefined && data.key !== currentState.dna?.key) {
      const lastKeyChange = (currentState as unknown as { _lastKeyChange?: number })._lastKeyChange ?? 0;
      if (now - lastKeyChange >= KEY_MOOD_COOLDOWN_MS) {
        newKey = data.key;
        // Guardar timestamp del cambio
        (currentState as unknown as { _lastKeyChange: number })._lastKeyChange = now;
      }
    }
    
    // Determinar si podemos actualizar Mood
    let newMood = currentState.dna?.mood ?? 'neutral';
    if (data.mood !== undefined && data.mood !== currentState.dna?.mood) {
      const lastMoodChange = (currentState as unknown as { _lastMoodChange?: number })._lastMoodChange ?? 0;
      if (now - lastMoodChange >= KEY_MOOD_COOLDOWN_MS) {
        newMood = data.mood;
        // Guardar timestamp del cambio
        (currentState as unknown as { _lastMoodChange: number })._lastMoodChange = now;
      }
    }
    
    // Construir nuevo DNA con syncopation actualizado
    const updatedDna: MusicalDNATelemetry | null = currentState.dna ? {
      ...currentState.dna,
      rhythm: {
        ...currentState.dna.rhythm,
        bpm: data.bpm ?? currentState.dna.rhythm.bpm,
        bpmConfidence: data.bpmConfidence ?? currentState.dna.rhythm.bpmConfidence,
        syncopation: data.syncopation ?? currentState.dna.rhythm.syncopation,
      },
      mood: newMood,  // 🎯 WAVE 16: Usa valor con cooldown
      key: newKey,    // 🎯 WAVE 16: Usa valor con cooldown
    } : null
    
    set({
      trinityConnected: true,
      trinityLastUpdate: Date.now(),
      signalLost: false,
      trinityAudio: {
        bass: data.spectrum?.bass ?? data.bass ?? 0,
        mid: data.spectrum?.mid ?? data.mid ?? 0,
        treble: data.spectrum?.treble ?? data.treble ?? 0,
        energy: data.energy ?? 0,
        bpm: data.bpm ?? 0,
        onBeat: data.onBeat ?? false,
      },
      // WAVE 15.4: Actualizar DNA con syncopation REAL de Trinity
      dna: updatedDna,
    })
  },
  
  // 📡 WAVE 15.3: Actualizar con decisiones REALES de Gamma (lighting-decision)
  // 🎨 WAVE 17.4: Incluye debugInfo del SeleneColorEngine
  updateFromTrinityDecision: (decision: unknown) => {
    const data = decision as {
      beautyScore?: number
      palette?: { intensity: number }
      movement?: { pattern: string }
      // 🎨 WAVE 17.4: SeleneColorEngine debug info
      debugInfo?: {
        macroGenre?: string
        strategy?: string
        temperature?: string
        description?: string
        key?: string | null
        mode?: string
      }
    }
    
    const currentState = get()
    const currentPalette = currentState.palette ?? DEFAULT_PALETTE
    
    // 🎨 WAVE 17.4: Actualizar palette con debugInfo si existe
    let updatedPalette: PaletteTelemetry = currentPalette
    if (data.debugInfo) {
      updatedPalette = {
        ...currentPalette,
        macroGenre: data.debugInfo.macroGenre,
        temperature: data.debugInfo.temperature,
        description: data.debugInfo.description,
        debugKey: data.debugInfo.key ?? undefined,
        debugMode: data.debugInfo.mode,
        strategy: (data.debugInfo.strategy as PaletteTelemetry['strategy']) || currentPalette.strategy,
      }
    }
    
    set({
      trinityConnected: true,
      trinityLastUpdate: Date.now(),
      signalLost: false,
      trinityDecision: {
        beautyScore: data.beautyScore ?? 0,
        paletteIntensity: data.palette?.intensity ?? 0,
        movementPattern: data.movement?.pattern ?? 'unknown',
      },
      palette: updatedPalette,
    })
  },
  
  // 📡 WAVE 15.3: Verificar si la señal se perdió (> 1 segundo sin datos)
  checkSignalLost: () => {
    const state = get()
    const timeSinceLastUpdate = Date.now() - state.trinityLastUpdate
    if (timeSinceLastUpdate > 1000 && !state.signalLost) {
      set({ 
        signalLost: true,
        // Resetear valores para indicar "SIGNAL LOST" - PROHIBIDO mantener valores antiguos
        trinityAudio: null,
        trinityDecision: null,
      })
      console.warn('[TelemetryStore] ⚠️ SIGNAL LOST - No data from Trinity for >1s')
    }
  },
  
  setLogFilter: (filter: string) => set({ logFilter: filter }),
  toggleLogAutoScroll: () => set((state) => ({ logAutoScroll: !state.logAutoScroll })),
  clearLogs: () => set({ logs: [] }),
}))

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 IPC INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

let ipcInitialized = false
let globalUnsubscribe: (() => void) | null = null

export function initializeTelemetryIPC(): () => void {
  if (ipcInitialized) {
    console.log('[TelemetryStore] Already initialized, reusing existing subscription')
    return () => {} // NO hacer nada, ya está suscrito
  }
  
  // Check if IPC is available
  if (!window.lux?.onTelemetryUpdate) {
    console.warn('[TelemetryStore] ⚠️ IPC not available - running in demo mode')
    return () => {}
  }
  
  // Subscribe to telemetry updates (legacy SeleneLux path)
  const unsubscribeTelemetry = window.lux.onTelemetryUpdate((packet: unknown) => {
    useTelemetryStore.getState().updateTelemetry(packet as SeleneTelemetryPacket)
  })
  
  // 📡 WAVE 15.3: TRUTH CABLE - Suscribirse a datos REALES de Trinity Workers
  let unsubscribeAudio: (() => void) | null = null
  let unsubscribeDecision: (() => void) | null = null
  let signalCheckInterval: ReturnType<typeof setInterval> | null = null
  
  if (window.lux?.onAudioAnalysis) {
    unsubscribeAudio = window.lux.onAudioAnalysis((analysis: unknown) => {
      useTelemetryStore.getState().updateFromTrinityAudio(analysis)
    })
    console.log('[TelemetryStore] 📡 TRUTH CABLE: Subscribed to Trinity audio-analysis')
  }
  
  if (window.lux?.onLightingDecision) {
    unsubscribeDecision = window.lux.onLightingDecision((decision: unknown) => {
      useTelemetryStore.getState().updateFromTrinityDecision(decision)
    })
    console.log('[TelemetryStore] 📡 TRUTH CABLE: Subscribed to Trinity lighting-decision')
  }
  
  // 📡 WAVE 15.3: Verificar SIGNAL LOST cada 500ms
  signalCheckInterval = setInterval(() => {
    useTelemetryStore.getState().checkSignalLost()
  }, 500)
  
  globalUnsubscribe = () => {
    unsubscribeTelemetry()
    unsubscribeAudio?.()
    unsubscribeDecision?.()
    if (signalCheckInterval) clearInterval(signalCheckInterval)
  }
  
  ipcInitialized = true
  console.log('[TelemetryStore] 📡 IPC initialized - listening for telemetry updates + Trinity TRUTH CABLE')
  
  // 🚨 WAVE 14.9: NO resetear ipcInitialized en cleanup
  // La suscripción debe persistir entre montajes/desmontajes de LuxCoreView
  return () => {
    // NO hacer nada aquí - la suscripción persiste
    console.log('[TelemetryStore] 📡 Component unmounted (subscription persists)')
  }
}

// 🚨 WAVE 14.9: Función para cleanup global (solo llamar al cerrar la app)
export function cleanupTelemetryIPC(): void {
  if (globalUnsubscribe) {
    globalUnsubscribe()
    globalUnsubscribe = null
  }
  ipcInitialized = false
  console.log('[TelemetryStore] 📡 IPC unsubscribed (app shutdown)')
}
