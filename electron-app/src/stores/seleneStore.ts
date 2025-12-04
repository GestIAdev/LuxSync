/**
 * 🧠 SELENE STORE - Selene Lux AI State
 * WAVE 9: Estado del cerebro, memoria y decision log
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type BrainMode = 'reactive' | 'intelligent'
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
  // Initial state
  brainConnected: false,
  brainInitialized: false,
  currentMode: 'reactive',
  paletteSource: 'fallback',
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
