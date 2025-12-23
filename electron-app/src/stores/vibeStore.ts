/**
 * 🎛️ VIBE STORE - WAVE 69.2
 * 
 * Zustand store persistente para el estado del Vibe Context.
 * Soluciona el problema de pérdida de estado al cambiar de pestaña/componente.
 * 
 * ARQUITECTURA:
 * - Store global (survives component unmount/remount)
 * - Sincronizado con backend via IPC events
 * - Single source of truth para UI vibe state
 */

import { create } from 'zustand'

// ============================================================================
// TYPES
// ============================================================================

export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'
export type VibeVisualId = 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'

interface VibeStoreState {
  // Current vibe (backend truth)
  currentVibe: VibeId
  
  // UI state
  isTransitioning: boolean
  hasFetchedInitial: boolean
  lastUpdated: number
  
  // Actions
  setCurrentVibe: (vibe: VibeId) => void
  setTransitioning: (transitioning: boolean) => void
  setHasFetchedInitial: (fetched: boolean) => void
  
  // Computed
  getVisualVibe: () => VibeVisualId | null  // null = idle (ningún botón iluminado)
}

// ============================================================================
// STORE
// ============================================================================

export const useVibeStore = create<VibeStoreState>((set, get) => ({
  // Initial state - pessimistic defaults
  currentVibe: 'idle',
  isTransitioning: false,
  hasFetchedInitial: false,
  lastUpdated: 0,
  
  // Actions
  setCurrentVibe: (vibe: VibeId) => {
    set({ 
      currentVibe: vibe, 
      lastUpdated: Date.now(),
      isTransitioning: false  // Clear transitioning when vibe confirmed
    })
  },
  
  setTransitioning: (transitioning: boolean) => {
    set({ isTransitioning: transitioning })
  },
  
  setHasFetchedInitial: (fetched: boolean) => {
    set({ hasFetchedInitial: fetched })
  },
  
  // Computed getter
  getVisualVibe: () => {
    const vibe = get().currentVibe
    // 'idle' se mapea a null visual (ningún botón iluminado)
    return vibe === 'idle' ? null : vibe as VibeVisualId
  }
}))

export default useVibeStore
