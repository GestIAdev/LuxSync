/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 CONTROL STORE - WAVE 30: Stage Command & Dashboard
 * Gestiona el modo global y parámetros de control de la UI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - viewMode: Alternar entre vista 2D (Tactical) y 3D (Visualizer)
 * - globalMode: Manual / Flow / Selene AI
 * - flowParams: Parámetros de patrones Flow
 * - aiEnabled: Override para habilitar/deshabilitar Selene
 * 
 * @module stores/controlStore
 * @version 30.0.0
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Modo de visualización del Stage */
export type ViewMode = '2D' | '3D'

/** Modo global de control DMX */
export type GlobalMode = 'manual' | 'flow' | 'selene'

/** Patrones disponibles para Flow mode */
export type FlowPattern = 'static' | 'chase' | 'wave' | 'rainbow' | 'strobe'

/** Parámetros de Flow Engine */
export interface FlowParams {
  pattern: FlowPattern
  speed: number           // 0-100 (BPM multiplier)
  intensity: number       // 0-100 (blend con AI)
  direction: 'forward' | 'backward' | 'bounce' | 'random'
  spread: number          // 0-100 (para wave)
}

/** Estado del Control Store */
export interface ControlState {
  // ═══════════════════════════════════════════════════════════════════════
  // VIEW MODE - Dual View System
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Modo de vista actual: 2D (Tactical Canvas) o 3D (React Three Fiber) */
  viewMode: ViewMode
  
  /** Cambiar modo de vista */
  setViewMode: (mode: ViewMode) => void
  
  /** Toggle entre 2D y 3D */
  toggleViewMode: () => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // GLOBAL MODE - Control Source
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Modo global de control */
  globalMode: GlobalMode
  
  /** ¿Está la AI de Selene habilitada? */
  aiEnabled: boolean
  
  /** Parámetros del Flow Engine */
  flowParams: FlowParams
  
  /** Cambiar modo global */
  setGlobalMode: (mode: GlobalMode) => void
  
  /** Actualizar parámetros de Flow */
  setFlowParams: (params: Partial<FlowParams>) => void
  
  /** Toggle AI on/off */
  toggleAI: () => void
  
  /** Habilitar/deshabilitar AI explícitamente */
  enableAI: (enabled: boolean) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // UI STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** ¿Mostrar overlay de debug? */
  showDebugOverlay: boolean
  
  /** Toggle debug overlay */
  toggleDebugOverlay: () => void
  
  /** ¿Sidebar expandida en Stage? */
  sidebarExpanded: boolean
  
  /** Toggle sidebar */
  toggleSidebar: () => void
  
  /** Reset a valores por defecto */
  reset: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_FLOW_PARAMS: FlowParams = {
  pattern: 'static',
  speed: 50,
  intensity: 50,
  direction: 'forward',
  spread: 50,
}

const DEFAULT_STATE = {
  viewMode: '2D' as ViewMode,
  globalMode: 'selene' as GlobalMode,
  aiEnabled: true,
  flowParams: DEFAULT_FLOW_PARAMS,
  showDebugOverlay: false,
  sidebarExpanded: true,
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useControlStore = create<ControlState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_STATE,
      
      // ═══════════════════════════════════════════════════════════════════
      // VIEW MODE ACTIONS
      // ═══════════════════════════════════════════════════════════════════
      
      setViewMode: (mode) => {
        console.log(`[ControlStore] 🎬 View mode changed: ${get().viewMode} → ${mode}`)
        set({ viewMode: mode })
      },
      
      toggleViewMode: () => {
        const current = get().viewMode
        const next = current === '2D' ? '3D' : '2D'
        console.log(`[ControlStore] 🔄 Toggle view mode: ${current} → ${next}`)
        set({ viewMode: next })
      },
      
      // ═══════════════════════════════════════════════════════════════════
      // GLOBAL MODE ACTIONS
      // ═══════════════════════════════════════════════════════════════════
      
      setGlobalMode: (mode) => {
        console.log(`[ControlStore] 🎛️ Global mode changed: ${get().globalMode} → ${mode}`)
        set({ globalMode: mode })
      },
      
      setFlowParams: (params) => {
        const current = get().flowParams
        const updated = { ...current, ...params }
        console.log('[ControlStore] 🌊 Flow params updated:', updated)
        set({ flowParams: updated })
      },
      
      toggleAI: () => {
        const current = get().aiEnabled
        console.log(`[ControlStore] 🤖 AI toggled: ${current} → ${!current}`)
        set({ aiEnabled: !current })
      },
      
      enableAI: (enabled) => {
        console.log(`[ControlStore] 🤖 AI explicitly set: ${enabled}`)
        set({ aiEnabled: enabled })
      },
      
      // ═══════════════════════════════════════════════════════════════════
      // UI STATE ACTIONS
      // ═══════════════════════════════════════════════════════════════════
      
      toggleDebugOverlay: () => {
        set((state) => ({ showDebugOverlay: !state.showDebugOverlay }))
      },
      
      toggleSidebar: () => {
        set((state) => ({ sidebarExpanded: !state.sidebarExpanded }))
      },
      
      reset: () => {
        console.log('[ControlStore] 🔄 Reset to defaults')
        set(DEFAULT_STATE)
      },
    }),
    {
      name: 'luxsync-control-store',
      version: 1,
      partialize: (state) => ({
        // Solo persistir preferencias de UI, no estados temporales
        viewMode: state.viewMode,
        showDebugOverlay: state.showDebugOverlay,
        sidebarExpanded: state.sidebarExpanded,
        flowParams: state.flowParams,
      }),
    }
  )
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (Optimized)
// ═══════════════════════════════════════════════════════════════════════════

export const selectViewMode = (state: ControlState) => state.viewMode
export const selectGlobalMode = (state: ControlState) => state.globalMode
export const selectAIEnabled = (state: ControlState) => state.aiEnabled
export const selectFlowParams = (state: ControlState) => state.flowParams
export const selectIs3DMode = (state: ControlState) => state.viewMode === '3D'
export const selectIs2DMode = (state: ControlState) => state.viewMode === '2D'
