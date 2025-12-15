/**
 * 🧠 SELENE STORE - Selene Lux AI State
 * WAVE 9: Estado del cerebro, memoria y decision log
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type BrainMode = 'reactive' | 'intelligent'
export type SeleneMode = 'flow' | 'selene' | 'locked'
export type PaletteSource = 'memory' | 'procedural' | 'fallback'
export type LogEntryType = 'LEARN' | 'MEMORY' | 'SECTION' | 'GENRE' | 'MODE' | 'INIT' | 'ERROR' | 'PALETTE' | 'ENERGY'

export interface DecisionEntry {
  id: string
  timestamp: number
  type: LogEntryType
  message: string
  data?: unknown
}

export interface SeleneStoreState {
  // Connection status
  brainConnected: boolean
  brainInitialized: boolean
  
  // Real-time Brain data
  mode: SeleneMode            // 🎚️ WAVE 13.6: UI mode (flow, selene, locked)
  currentMode: BrainMode
  paletteSource: PaletteSource
  confidence: number       // 0-1
  energy: number          // 0-1
  beautyScore: number     // 0-1
  
  // Stats
  framesProcessed: number
  patternsLearned: number
  sessionPatterns: number
  memoryUsage: number     // 0-1 (percentage)
  
  // Session
  sessionId: string | null
  sessionStartTime: number | null
  
  // Decision log
  decisionLog: DecisionEntry[]
  logPaused: boolean
  logFilter: LogEntryType | 'ALL'
  maxLogEntries: number
  
  // Actions
  setConnected: (connected: boolean) => void
  setInitialized: (initialized: boolean) => void
  setMode: (mode: SeleneMode) => void
  updateBrainMetrics: (metrics: Partial<SeleneStoreState>) => void
  incrementFrames: () => void
  
  // Log actions
  addLogEntry: (entry: Omit<DecisionEntry, 'id' | 'timestamp'>) => void
  clearLog: () => void
  toggleLogPause: () => void
  setLogFilter: (filter: LogEntryType | 'ALL') => void
  exportLog: () => DecisionEntry[]
  
  // Session actions
  startSession: () => void
  endSession: () => void
}

// ============================================
// LOG ENTRY ICONS & COLORS
// ============================================

export const LOG_ENTRY_CONFIG: Record<LogEntryType, { icon: string; color: string }> = {
  LEARN: { icon: '📊', color: '#00ff88' },     // Green
  MEMORY: { icon: '🧠', color: '#a855f7' },    // Purple
  SECTION: { icon: '🎵', color: '#00fff0' },   // Cyan
  GENRE: { icon: '🎵', color: '#3b82f6' },     // Blue
  MODE: { icon: '🔄', color: '#ff6b35' },      // Orange
  INIT: { icon: '🌙', color: '#9ca3af' },      // Gray
  ERROR: { icon: '❌', color: '#ef4444' },     // Red
  PALETTE: { icon: '🎨', color: '#ff00ff' },   // Pink
  ENERGY: { icon: '⚡', color: '#ffd700' },    // Yellow
}

// ============================================
// HELPERS
// ============================================

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// ============================================
// STORE
// ============================================

export const useSeleneStore = create<SeleneStoreState>((set, get) => ({
  // 🎯 WAVE 13.6: DEFAULTS PESIMISTAS - "Truth First"
  // La UI nace asumiendo que Selene NO está conectado ni inicializado
  // El Backend dirá la verdad en el Initial State Handshake
  brainConnected: false,      // ❌ PESIMISTA: No conectado por defecto
  brainInitialized: false,    // ❌ PESIMISTA: No inicializado por defecto
  mode: 'selene',             // 🎚️ UI mode por defecto (se sincroniza vía handshake)
  currentMode: 'reactive',    // Default conservador
  paletteSource: 'fallback',  // Default conservador
  confidence: 0,
  energy: 0,
  beautyScore: 0.5,
  framesProcessed: 0,
  patternsLearned: 0,
  sessionPatterns: 0,
  memoryUsage: 0,
  sessionId: null,
  sessionStartTime: null,
  decisionLog: [],
  logPaused: false,
  logFilter: 'ALL',
  maxLogEntries: 1000,
  
  // Connection actions
  setConnected: (connected) => {
    set({ brainConnected: connected })
    if (connected) {
      get().addLogEntry({ type: 'INIT', message: 'Brain connection established' })
    }
  },
  
  setInitialized: (initialized) => {
    set({ brainInitialized: initialized })
    if (initialized) {
      get().addLogEntry({ type: 'INIT', message: 'Selene Brain initialized, loading memory...' })
    }
  },
  
  // 🎚️ WAVE 13.6: Cambiar modo UI (flow, selene, locked)
  setMode: (mode) => {
    const prev = get().mode
    set({ mode })
    if (mode !== prev) {
      get().addLogEntry({
        type: 'MODE',
        message: `UI Mode changed: ${prev} → ${mode}`,
        data: { from: prev, to: mode },
      })
    }
  },
  
  updateBrainMetrics: (metrics) => {
    const prev = get()
    
    // Detect significant changes for logging
    if (metrics.currentMode && metrics.currentMode !== prev.currentMode) {
      get().addLogEntry({
        type: 'MODE',
        message: `Mode transition: ${prev.currentMode} → ${metrics.currentMode}`,
        data: { from: prev.currentMode, to: metrics.currentMode },
      })
    }
    
    if (metrics.paletteSource && metrics.paletteSource !== prev.paletteSource) {
      get().addLogEntry({
        type: 'PALETTE',
        message: `Palette source changed to: ${metrics.paletteSource}`,
        data: { source: metrics.paletteSource },
      })
    }
    
    set(metrics)
  },
  
  incrementFrames: () => {
    set((state) => ({ framesProcessed: state.framesProcessed + 1 }))
  },
  
  // Log actions
  addLogEntry: (entry) => {
    if (get().logPaused) return
    
    const state = get()
    const lastEntry = state.decisionLog[0]
    
    // 🎯 WAVE 14: Anti-spam - Deduplicar mensajes repetidos
    if (lastEntry && lastEntry.message === entry.message) {
      // Mismo mensaje que el anterior - actualizar contador en lugar de duplicar
      const updatedEntry: DecisionEntry = {
        ...lastEntry,
        message: lastEntry.message.includes('(x') 
          ? lastEntry.message.replace(/\(x(\d+)\)/, (_, count) => `(x${parseInt(count) + 1})`)
          : `${lastEntry.message} (x2)`,
        timestamp: Date.now(), // Actualizar timestamp
      }
      
      set((state) => ({
        decisionLog: [updatedEntry, ...state.decisionLog.slice(1)],
      }))
      return
    }
    
    const newEntry: DecisionEntry = {
      ...entry,
      id: generateId(),
      timestamp: Date.now(),
    }
    
    set((state) => ({
      decisionLog: [newEntry, ...state.decisionLog].slice(0, state.maxLogEntries),
    }))
  },
  
  clearLog: () => set({ decisionLog: [] }),
  
  toggleLogPause: () => set((state) => ({ logPaused: !state.logPaused })),
  
  setLogFilter: (filter) => set({ logFilter: filter }),
  
  exportLog: () => get().decisionLog,
  
  // Session actions
  startSession: () => {
    const sessionId = `session-${Date.now()}`
    set({
      sessionId,
      sessionStartTime: Date.now(),
      sessionPatterns: 0,
      framesProcessed: 0,
    })
    get().addLogEntry({
      type: 'INIT',
      message: `New session started: ${sessionId}`,
      data: { sessionId },
    })
  },
  
  endSession: () => {
    const { sessionId, framesProcessed, sessionPatterns } = get()
    get().addLogEntry({
      type: 'INIT',
      message: `Session ended. Frames: ${framesProcessed}, Patterns: ${sessionPatterns}`,
      data: { sessionId, framesProcessed, sessionPatterns },
    })
    set({
      sessionId: null,
      sessionStartTime: null,
    })
  },
}))

// ============================================
// 🧠 WAVE 10: Initialize IPC subscriptions
// ============================================
export function initializeSeleneStoreIPC(): () => void {
  const store = useSeleneStore.getState()
  const unsubscribers: Array<() => void> = []
  
  // 🎯 WAVE 13.6: STATE OF TRUTH - Escuchar cambios de modo confirmados por el Backend
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const ipcRenderer = (window as any).electron.ipcRenderer
    
    const handleModeChanged = (_event: any, payload: { mode: string; brain: boolean; timestamp: number }) => {
      console.log(`[SeleneStore] 📡 Mode change confirmed from Backend: ${payload.mode}`)
      useSeleneStore.setState({
        mode: payload.mode as SeleneMode,
        currentMode: payload.brain ? 'intelligent' : 'reactive'
      })
      
      store.addLogEntry({
        type: 'MODE',
        message: `Backend confirmed mode: ${payload.mode.toUpperCase()} (brain: ${payload.brain ? 'ON' : 'OFF'})`,
        data: payload
      })
    }
    
    ipcRenderer.on('selene:mode-changed', handleModeChanged)
    unsubscribers.push(() => ipcRenderer.removeListener('selene:mode-changed', handleModeChanged))
  }
  
  // Check if we're in Electron renderer
  if (typeof window !== 'undefined' && (window as any).luxsync?.selene) {
    const seleneApi = (window as any).luxsync.selene
    
    // 🌙 WAVE 25: DEPRECATED - Brain metrics now in truthStore.system
    // Brain metrics are now part of the selene:truth broadcast
    // Old code kept for reference:
    /*
    if (seleneApi.onBrainMetrics) {
      const unsub = seleneApi.onBrainMetrics((metrics: any) => {
        useSeleneStore.setState({
          brainConnected: metrics.hasMemory ?? false,
          currentMode: metrics.mode ?? 'flow',
          energy: metrics.energy ?? 0,
          confidence: metrics.confidence ?? 0.5,
          beautyScore: metrics.beautyScore ?? 0.75,
          framesProcessed: metrics.framesAnalyzed ?? 0,
          patternsLearned: metrics.patternsLearned ?? 0,
          sessionPatterns: metrics.sessionPatterns ?? 0,
          memoryUsage: metrics.memoryUsage ?? 0,
          sessionId: metrics.sessionId ?? '',
        })
      })
      if (unsub) unsubscribers.push(unsub)
    }
    */
    
    // Subscribe to decision log entries
    if (seleneApi.onDecisionLog) {
      const unsub = seleneApi.onDecisionLog((entry: any) => {
        store.addLogEntry({
          type: entry.type as LogEntryType,
          message: entry.message,
          data: entry.data,
        })
      })
      if (unsub) unsubscribers.push(unsub)
    }
    
    // Fetch initial brain stats
    if (seleneApi.getBrainStats) {
      seleneApi.getBrainStats().then((stats: any) => {
        if (stats) {
          useSeleneStore.setState({
            brainConnected: stats.connected,
            currentMode: stats.mode,
            energy: stats.energy,
            confidence: stats.confidence,
            beautyScore: stats.beautyScore,
            framesProcessed: stats.framesProcessed,
            patternsLearned: stats.patternsLearned,
            sessionPatterns: stats.sessionPatterns,
            memoryUsage: stats.memoryUsage,
            sessionId: stats.sessionId,
          })
          
          if (stats.connected) {
            store.addLogEntry({
              type: 'INIT',
              message: `Connected to Selene Brain (${stats.hasMemory ? 'with memory' : 'amnesia mode'})`,
            })
          }
        }
      }).catch(console.error)
    }
    
    console.log('[SeleneStore] 🧠 IPC subscriptions initialized')
  }
  
  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub())
  }
}
