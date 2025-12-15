/**
 * 📜 LOG STORE - WAVE 25.7: THE CHRONICLER
 * 
 * Store dedicado para logs del sistema.
 * Separado del truthStore para evitar re-renders innecesarios.
 * Los logs llegan por canal IPC dedicado (selene:log), no en el broadcast de 30fps.
 */

import { create } from 'zustand'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LogEntry {
  id: string
  timestamp: number
  category: 'Music' | 'DMX' | 'System' | 'Brain' | 'Visual' | 'Mode' | 'Beat' | 'Genre' | string
  message: string
  data?: any
}

interface LogState {
  logs: LogEntry[]
  maxLogs: number
  
  // Actions
  addLog: (entry: LogEntry) => void
  clearLogs: () => void
  
  // Filters (for UI)
  activeFilters: Set<string>
  setFilter: (category: string, active: boolean) => void
  clearFilters: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  maxLogs: 200,
  activeFilters: new Set<string>(),
  
  addLog: (entry) => set((state) => ({
    logs: [entry, ...state.logs].slice(0, state.maxLogs)
  })),
  
  clearLogs: () => set({ logs: [] }),
  
  setFilter: (category, active) => set((state) => {
    const newFilters = new Set(state.activeFilters)
    if (active) {
      newFilters.add(category)
    } else {
      newFilters.delete(category)
    }
    return { activeFilters: newFilters }
  }),
  
  clearFilters: () => set({ activeFilters: new Set() }),
}))

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

/** Get all logs */
export const selectLogs = (state: LogState) => state.logs

/** Get logs filtered by active filters (if any) */
export const selectFilteredLogs = (state: LogState) => {
  if (state.activeFilters.size === 0) {
    return state.logs
  }
  return state.logs.filter(log => state.activeFilters.has(log.category))
}

/** Get log count */
export const selectLogCount = (state: LogState) => state.logs.length

// ═══════════════════════════════════════════════════════════════════════════
// IPC LISTENER INITIALIZER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Initialize the IPC listener for logs.
 * Call this once in App.tsx or index.tsx
 */
export function initializeLogIPC(): () => void {
  // Listen for logs from backend
  if (typeof window !== 'undefined' && window.lux?.onLog) {
    const cleanup = window.lux.onLog((logEntry) => {
      useLogStore.getState().addLog(logEntry)
    })
    console.log('[LogStore] 📜 IPC listener registered for selene:log')
    return cleanup
  }
  
  console.warn('[LogStore] ⚠️ window.lux.onLog not available')
  return () => {}
}

export default useLogStore
