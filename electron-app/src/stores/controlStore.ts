/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 CONTROL STORE - WAVE 422: Mode Termination
 * Gestiona el modo global y parámetros de control de la UI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - viewMode: Alternar entre vista 2D (Tactical) y 3D (Visualizer)
 * - globalMode: Manual / Selene AI / null (idle when system OFF)
 * - aiEnabled: Override para habilitar/deshabilitar Selene
 * - activePalette: Paleta de colores vivos activa (WAVE 33.2)
 * - globalSaturation/globalIntensity: Controles globales (WAVE 33.2)
 * 
 * WAVE 422: Eliminado 'flow' mode - sistema Auto-Override
 * 
 * @module stores/controlStore
 * @version 422.0.0
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Modo de visualización del Stage */
export type ViewMode = '2D' | '3D'

/** Modo global de control DMX (null = idle/system off) 
 * WAVE 422: 'flow' eliminado - sistema Auto-Override 
 */
export type GlobalMode = 'manual' | 'selene' | null

/** Patrones disponibles para Flow mode */
export type FlowPattern = 'static' | 'chase' | 'wave' | 'rainbow' | 'strobe' | 'circle' | 'eight'

/** IDs de paletas vivas disponibles - WAVE 33.2 */
export type LivingPaletteId = 'fuego' | 'hielo' | 'selva' | 'neon'

/** Parámetros de Flow Engine */
export interface FlowParams {
  pattern: FlowPattern
  speed: number           // 0-100 (BPM multiplier)
  intensity: number       // 0-100 (blend con AI)
  direction: 'forward' | 'backward' | 'bounce' | 'random'
  spread: number          // 0-100 (para wave)
  // WAVE 33.4: Kinetic Radar parameters
  basePan: number         // 0-1 (normalized, 0.5 = center)
  baseTilt: number        // 0-1 (normalized, 0.5 = center)
  size: number            // 0-1 (movement amplitude)
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
  // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * ¿Está la salida DMX habilitada?
   * false = ARMED (engine corre pero DMX bloqueado)
   * true = LIVE (DMX fluye a fixtures)
   * DEFAULT: false (Cold Start)
   */
  outputEnabled: boolean
  
  /** Toggle output gate (ARMED ↔ LIVE) */
  toggleOutput: () => void
  
  /** Set output state explicitly */
  setOutputEnabled: (enabled: boolean) => void
  
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // COLOR & PALETTE - WAVE 33.2 + WAVE 34.5 (Smooth Transitions)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Paleta de colores vivos activa */
  activePalette: LivingPaletteId
  
  /** Paleta objetivo durante transición (null si no hay transición) */
  targetPalette: LivingPaletteId | null
  
  /** Progreso de transición 0-1 (1 = completa) */
  transitionProgress: number
  
  /** Saturación global (0-1) */
  globalSaturation: number
  
  /** Intensidad global (0-1) */
  globalIntensity: number
  
  /** Cambiar paleta activa (inicia transición suave) */
  setPalette: (palette: LivingPaletteId) => void
  
  /** Actualizar progreso de transición (llamado por animation frame) */
  updateTransition: (progress: number) => void
  
  /** Establecer saturación global */
  setGlobalSaturation: (value: number) => void
  
  /** Establecer intensidad global */
  setGlobalIntensity: (value: number) => void
  
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
  // WAVE 33.4: Kinetic Radar defaults
  basePan: 0.5,   // Center
  baseTilt: 0.5,  // Center
  size: 0.5,      // 50% amplitude
}

const DEFAULT_STATE = {
  viewMode: '2D' as ViewMode,
  globalMode: null as GlobalMode,  // 🔌 WAVE 63.9: Start idle (system OFF)
  // 🧠 WAVE 1133: AI LOBOTOMY - Selene starts SEDATED, not creative
  // User must explicitly enable Conscious mode after GO
  aiEnabled: false,
  // 🚦 WAVE 1132: Cold Start Protocol - output disabled by default
  outputEnabled: false,
  flowParams: DEFAULT_FLOW_PARAMS,
  showDebugOverlay: false,
  sidebarExpanded: true,
  // WAVE 33.2 + 34.5: Color & Palette with transitions
  activePalette: 'fuego' as LivingPaletteId,
  targetPalette: null as LivingPaletteId | null,
  transitionProgress: 1,  // 1 = no transition in progress
  globalSaturation: 1.0,
  globalIntensity: 1.0,
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
      // 🚦 WAVE 1132: OUTPUT GATE ACTIONS - THE COLD START PROTOCOL
      // ═══════════════════════════════════════════════════════════════════
      
      toggleOutput: () => {
        const current = get().outputEnabled
        const newState = !current
        console.log(`[ControlStore] 🚦 Output toggled: ${current ? 'LIVE' : 'ARMED'} → ${newState ? 'LIVE' : 'ARMED'}`)
        set({ outputEnabled: newState })
      },
      
      setOutputEnabled: (enabled) => {
        const state = enabled ? 'LIVE' : 'ARMED'
        console.log(`[ControlStore] 🚦 Output explicitly set: ${state}`)
        set({ outputEnabled: enabled })
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
      
      // ═══════════════════════════════════════════════════════════════════
      // COLOR & PALETTE ACTIONS - WAVE 33.2 + 34.5 (Smooth Transitions)
      // ═══════════════════════════════════════════════════════════════════
      
      setPalette: (palette) => {
        const current = get().activePalette
        if (current === palette) return // No change needed
        
        console.log(`[ControlStore] 🎨 Palette transition: ${current} → ${palette}`)
        
        // Start transition animation
        set({ 
          targetPalette: palette,
          transitionProgress: 0 
        })
        
        // Animate over 2 seconds
        const duration = 2000
        const startTime = Date.now()
        
        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          
          if (progress < 1) {
            set({ transitionProgress: progress })
            requestAnimationFrame(animate)
          } else {
            // Transition complete
            set({ 
              activePalette: palette,
              targetPalette: null,
              transitionProgress: 1 
            })
            console.log(`[ControlStore] 🎨 Palette transition complete: ${palette}`)
          }
        }
        
        requestAnimationFrame(animate)
      },
      
      updateTransition: (progress) => {
        set({ transitionProgress: Math.max(0, Math.min(1, progress)) })
      },
      
      setGlobalSaturation: (value) => {
        const clamped = Math.max(0, Math.min(1, value))
        console.log(`[ControlStore] 🌈 Saturation: ${clamped.toFixed(2)}`)
        set({ globalSaturation: clamped })
      },
      
      setGlobalIntensity: (value) => {
        const clamped = Math.max(0, Math.min(1, value))
        console.log(`[ControlStore] 💡 Intensity: ${clamped.toFixed(2)}`)
        set({ globalIntensity: clamped })
      },
      
      reset: () => {
        console.log('[ControlStore] 🔄 Reset to defaults')
        set(DEFAULT_STATE)
      },
    }),
    {
      name: 'luxsync-control-store',
      version: 2, // Bumped for WAVE 33.2
      partialize: (state) => ({
        // Solo persistir preferencias de UI, no estados temporales
        viewMode: state.viewMode,
        showDebugOverlay: state.showDebugOverlay,
        sidebarExpanded: state.sidebarExpanded,
        flowParams: state.flowParams,
        // WAVE 33.2: Persist palette preferences
        activePalette: state.activePalette,
        globalSaturation: state.globalSaturation,
        globalIntensity: state.globalIntensity,
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

// 🚦 WAVE 1132: Output Gate selector
export const selectOutputEnabled = (state: ControlState) => state.outputEnabled

// WAVE 33.2: Palette selectors
export const selectActivePalette = (state: ControlState) => state.activePalette
export const selectGlobalSaturation = (state: ControlState) => state.globalSaturation
export const selectGlobalIntensity = (state: ControlState) => state.globalIntensity
