/**
 * 🎛️ USE SELENE VIBE HOOK - WAVE 62
 * 
 * React hook para controlar el Vibe Context activo.
 * Los Vibes definen bounded constraints para que SELENE
 * se mantenga coherente con el estilo musical del DJ.
 * 
 * 4 Vibes disponibles:
 * - techno-club: Paletas frías, movimientos amplios
 * - fiesta-latina: Paletas cálidas, movimientos fluidos
 * - pop-rock: Paletas brillantes, movimientos energéticos
 * - chill-lounge: Paletas pastel, movimientos suaves
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useControlStore } from '../stores/controlStore'

// ============================================================================
// TYPES
// ============================================================================

export type VibeId = 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'

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
  activeVibe: VibeId | null  // 🔄 WAVE 63.5: null mientras carga
  isTransitioning: boolean
  vibeInfo: VibeInfo | null  // 🔄 WAVE 63.5: null mientras carga
  isLoading: boolean         // 🔄 WAVE 63.5: true mientras fetching inicial
  
  // Actions
  setVibe: (vibeId: VibeId) => Promise<void>
  
  // Computed
  isGhostMode: boolean
  allVibes: VibeInfo[]
}

// ============================================================================
// HOOK
// ============================================================================

export function useSeleneVibe(): UseSeleneVibeReturn {
  // 🔄 WAVE 63.5: null inicial hasta fetch desde backend (evita flash de Techno)
  const [activeVibe, setActiveVibe] = useState<VibeId | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  
  // Check global mode for ghost mode (hide when not in Selene mode)
  const globalMode = useControlStore(state => state.globalMode)
  const isGhostMode = globalMode !== 'selene'
  
  // Initialize: Get current vibe from backend
  useEffect(() => {
    const initVibe = async () => {
      if (!window.lux?.getVibe) return
      
      try {
        const result = await window.lux.getVibe()
        if (result.success && result.vibeId) {
          setActiveVibe(result.vibeId as VibeId)
        }
      } catch (error) {
        console.warn('[useSeleneVibe] Failed to get initial vibe:', error)
      }
    }
    
    initVibe()
  }, [])
  
  // Subscribe to vibe changes from backend
  useEffect(() => {
    if (!window.lux?.onVibeChange) return
    
    unsubscribeRef.current = window.lux.onVibeChange((data) => {
      console.log('[useSeleneVibe] Vibe changed:', data.vibeId)
      setActiveVibe(data.vibeId as VibeId)
      setIsTransitioning(false)
    })
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [])
  
  // Set vibe action
  const setVibe = useCallback(async (vibeId: VibeId) => {
    if (!window.lux?.setVibe) {
      console.warn('[useSeleneVibe] window.lux.setVibe not available')
      return
    }
    
    if (vibeId === activeVibe) return // Already active
    
    setIsTransitioning(true)
    
    try {
      const result = await window.lux.setVibe(vibeId)
      
      if (result.success) {
        // Optimistic update - backend confirmation will follow via onVibeChange
        setActiveVibe(vibeId)
      } else {
        console.error('[useSeleneVibe] Failed to set vibe:', result.error)
        setIsTransitioning(false)
      }
    } catch (error) {
      console.error('[useSeleneVibe] Error setting vibe:', error)
      setIsTransitioning(false)
    }
  }, [activeVibe])
  
  // 🔄 WAVE 63.5: isLoading = true mientras no hemos recibido el vibe del backend
  const isLoading = activeVibe === null
  
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
