/**
 *  USE SELENE VIBE HOOK - WAVE 62 + WAVE 64 + WAVE 69.2
 * 
 * React hook para controlar el Vibe Context activo.
 * Los Vibes definen bounded constraints para que SELENE
 * se mantenga coherente con el estilo musical del DJ.
 * 
 * 4 Vibes seleccionables:
 * - techno-club: Paletas frías, movimientos amplios
 * - fiesta-latina: Paletas cálidas, movimientos fluidos
 * - pop-rock: Paletas brillantes, movimientos energéticos
 * - chill-lounge: Paletas pastel, movimientos suaves
 * 
 *  WAVE 64: 'idle' es un vibe interno que representa "esperando input"
 * Cuando el backend tiene 'idle', activeVibe visual = null (ningún botón iluminado)
 * 
 *  WAVE 69.2 FIX: Migrado de useState a Zustand store global.
 * Soluciona pérdida de estado al cambiar de pestaña/componente (unmount/remount).
 * El store persiste el vibe actual incluso cuando DashboardView se desmonta.
 */

import { useEffect, useCallback, useRef } from 'react'
import { useControlStore } from '../stores/controlStore'
import { useVibeStore } from '../stores/vibeStore'

// ============================================================================
// TYPES
// ============================================================================

// B4 FIX: VibeId = 4 vibes visuales (sin 'idle').
// VibeIdWithIdle = tipo extendido para setVibe, que permite el toggle-off desde UI.
// VIBE_PRESETS usa solo VibeId — no hay preset visual para 'idle'.
export type VibeId = 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'
export type VibeIdWithIdle = VibeId | 'idle'

export interface VibeInfo {
  id: VibeId
  name: string
  icon: string
  description: string
  accentColor: string  // Tailwind color class
  glowColor: string    // CSS glow shadow
}

export const VIBE_PRESETS: Record<VibeId, VibeInfo> = {
  'techno-club': {
    id: 'techno-club',
    name: 'Techno',
    icon: 'Zap',
    description: 'Underground, industrial, deep',
    accentColor: 'cyan',
    glowColor: 'rgba(6,182,212,0.6)'
  },
  'fiesta-latina': {
    id: 'fiesta-latina',
    name: 'Latino',
    icon: 'Flame',
    description: 'Caliente, tropical, ritmo',
    accentColor: 'orange',
    glowColor: 'rgba(249,115,22,0.6)'
  },
  'pop-rock': {
    id: 'pop-rock',
    name: 'Pop/Rock',
    icon: 'Mic2',
    description: 'Energetic, bright, dynamic',
    accentColor: 'fuchsia',
    glowColor: 'rgba(217,70,239,0.6)'
  },
  'chill-lounge': {
    id: 'chill-lounge',
    name: 'Chill',
    icon: 'Armchair',
    description: 'Ambient, smooth, relaxed',
    accentColor: 'teal',
    glowColor: 'rgba(45,212,191,0.6)'
  }
}

export interface UseSeleneVibeReturn {
  // State
  activeVibe: VibeId | null  // null = 'idle' (ningún botón iluminado)
  isTransitioning: boolean
  vibeInfo: VibeInfo | null
  isLoading: boolean
  
  // Actions
  // B3 FIX: setVibe acepta 'idle' para toggle-off desde UI
  setVibe: (vibeId: VibeIdWithIdle) => Promise<void>
  
  // Computed
  isGhostMode: boolean
  allVibes: VibeInfo[]
}

// ============================================================================
// HOOK
// ============================================================================

export function useSeleneVibe(): UseSeleneVibeReturn {
  //  WAVE 69.2: Use Zustand store instead of local useState
  // This persists across component mount/unmount (tab changes)
  const currentVibe = useVibeStore(state => state.currentVibe)
  const hasFetchedInitial = useVibeStore(state => state.hasFetchedInitial)
  const isTransitioning = useVibeStore(state => state.isTransitioning)
  const getVisualVibe = useVibeStore(state => state.getVisualVibe)
  const setCurrentVibe = useVibeStore(state => state.setCurrentVibe)
  const setHasFetchedInitial = useVibeStore(state => state.setHasFetchedInitial)
  const setTransitioning = useVibeStore(state => state.setTransitioning)
  
  const unsubscribeRef = useRef<(() => void) | null>(null)
  
  // Check global mode for ghost mode (hide when not in Selene mode)
  const globalMode = useControlStore(state => state.globalMode)
  const isGhostMode = globalMode !== 'selene'
  
  // Initialize: Get current vibe from backend (only once globally)
  useEffect(() => {
    if (hasFetchedInitial) return  // Already fetched globally
    
    const initVibe = async () => {
      if (!window.lux?.getVibe) {
        setHasFetchedInitial(true)
        return
      }
      
      try {
        const result = await window.lux.getVibe()
        if (result.success && result.vibeId) {
          // Backend returns 'idle' or VibeId
          setCurrentVibe(result.vibeId as any)
          console.log('[useSeleneVibe] Initial vibe fetched:', result.vibeId)
        }
      } catch (error) {
        console.warn('[useSeleneVibe] Failed to get initial vibe:', error)
      } finally {
        setHasFetchedInitial(true)
      }
    }
    
    initVibe()
  }, [hasFetchedInitial, setCurrentVibe, setHasFetchedInitial])
  
  // Subscribe to vibe changes from backend
  useEffect(() => {
    if (!window.lux?.onVibeChange) return
    
    unsubscribeRef.current = window.lux.onVibeChange((data) => {
      console.log('[useSeleneVibe] Backend vibe changed:', data.vibeId)
      // Backend can send 'idle' or VibeId
      setCurrentVibe(data.vibeId as any)
    })
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [setCurrentVibe])
  
  // Set vibe action — B3+B4 FIX: toggle real
  // Si el vibe YA está activo, envía 'idle' al backend (toggle-off).
  // Si es otro vibe, lo activa normalmente.
  const setVibe = useCallback(async (vibeId: VibeIdWithIdle) => {
    if (!window.lux?.setVibe) {
      console.warn('[useSeleneVibe] window.lux.setVibe not available')
      return
    }

    const visualVibe = getVisualVibe()
    // B3 FIX: mismo vibe → toggle a idle en lugar de early-exit
    const targetVibe: VibeIdWithIdle = vibeId === visualVibe ? 'idle' : vibeId

    setTransitioning(true)

    try {
      const result = await window.lux.setVibe(targetVibe)

      if (result.success) {
        // Optimistic update — confirmación real llegará via onVibeChange
        setCurrentVibe(targetVibe)
        console.log('[useSeleneVibe] Vibe set:', targetVibe)
      } else {
        console.error('[useSeleneVibe] Failed to set vibe:', result.error)
        setTransitioning(false)
      }
    } catch (error) {
      console.error('[useSeleneVibe] Error setting vibe:', error)
      setTransitioning(false)
    }
  }, [getVisualVibe, setCurrentVibe, setTransitioning])
  
  // Computed values
  const activeVibe = getVisualVibe()  // null if currentVibe === 'idle'
  const isLoading = !hasFetchedInitial
  
  return {
    activeVibe,
    isTransitioning,
    vibeInfo: activeVibe ? VIBE_PRESETS[activeVibe] : null,
    isLoading,
    setVibe,
    isGhostMode,
    allVibes: Object.values(VIBE_PRESETS)
  }
}

export default useSeleneVibe
