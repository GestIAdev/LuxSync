/**
 * 🌙 USE SELENE HOOK
 * React hook para conectar con Selene Lux Core
 * 
 * Escucha actualizaciones de estado del backend (30fps)
 * y proporciona métodos para controlar la iluminación.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export interface SeleneState {
  // Color
  r: number
  g: number
  b: number
  w: number
  
  // Position
  pan: number
  tilt: number
  
  // Dimmer
  dimmer: number
  
  // Movement
  movementPhase: number
  
  // Effects
  activeEffects: string[]
  
  // Optics
  prismActive: boolean
  goboIndex: number
  
  // Audio (opcional)
  audioMetrics?: {
    bass: number
    mid: number
    treble: number
    energy: number
    bpm: number
  }
  
  // Palette
  paletteIndex: number
  paletteName: string
  
  // Timing
  timestamp: number
}

export interface UseSeleneReturn {
  // Estado
  state: SeleneState | null
  isConnected: boolean
  isRunning: boolean
  
  // Control
  start: () => Promise<void>
  stop: () => Promise<void>
  setPalette: (index: number) => Promise<void>
  setMovement: (config: { pattern?: string; speed?: number; intensity?: number }) => Promise<void>
  triggerEffect: (name: string, params?: Record<string, any>, duration?: number) => Promise<number>
  cancelEffect: (effectId: number) => Promise<void>
  cancelAllEffects: () => Promise<void>
  
  // Audio simulation
  simulateAudio: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm: number }) => Promise<void>
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_STATE: SeleneState = {
  r: 0, g: 0, b: 0, w: 0,
  pan: 127, tilt: 127,
  dimmer: 0,
  movementPhase: 0,
  activeEffects: [],
  prismActive: false,
  goboIndex: 0,
  paletteIndex: 0,
  paletteName: 'fire',
  timestamp: 0,
}

// ============================================================================
// HOOK
// ============================================================================

// NOTA: Los tipos de window.lux están definidos en vite-env.d.ts

export function useSelene(): UseSeleneReturn {
  const [state, setState] = useState<SeleneState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Conectar al iniciar
  useEffect(() => {
    // Verificar si la API está disponible
    if (typeof window !== 'undefined' && window.lux) {
      setIsConnected(true)
      
      // Suscribirse a actualizaciones de estado
      // El callback recibe SeleneStateUpdate, lo convertimos a SeleneState
      unsubscribeRef.current = window.lux.onStateUpdate((update) => {
        setState(prev => ({
          ...DEFAULT_STATE,
          ...prev,
          // Mapear colores
          r: update.colors?.primary.r ?? prev?.r ?? 0,
          g: update.colors?.primary.g ?? prev?.g ?? 0,
          b: update.colors?.primary.b ?? prev?.b ?? 0,
          // Mapear movimiento
          pan: update.movement?.pan ?? prev?.pan ?? 127,
          tilt: update.movement?.tilt ?? prev?.tilt ?? 127,
          // Mapear audio
          audioMetrics: update.beat ? {
            bass: 0,
            mid: 0,
            treble: 0,
            energy: 0,
            bpm: update.beat.bpm
          } : prev?.audioMetrics,
          // Timestamp
          timestamp: update.timestamp ?? Date.now()
        }))
      })
      
      // Obtener estado inicial
      window.lux.getState().then((initialState) => {
        if (initialState) {
          // Convertir SeleneStateUpdate a SeleneState
          setState({
            ...DEFAULT_STATE,
            r: initialState.colors?.primary.r ?? 0,
            g: initialState.colors?.primary.g ?? 0,
            b: initialState.colors?.primary.b ?? 0,
            pan: initialState.movement?.pan ?? 127,
            tilt: initialState.movement?.tilt ?? 127,
            paletteName: initialState.palette?.name ?? 'fire',
            timestamp: initialState.timestamp ?? Date.now()
          })
          setIsRunning(true)
        }
      }).catch(() => {
        // Selene aún no iniciado
        setState(DEFAULT_STATE)
      })
    } else {
      // No estamos en Electron, usar estado mock
      console.log('[useSelene] No Electron API, using mock state')
      setIsConnected(false)
      setState(DEFAULT_STATE)
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  // === CONTROL METHODS ===

  const start = useCallback(async () => {
    if (window.lux) {
      await window.lux.start()
      setIsRunning(true)
    }
  }, [])

  const stop = useCallback(async () => {
    if (window.lux) {
      await window.lux.stop()
      setIsRunning(false)
    }
  }, [])

  const setPalette = useCallback(async (index: number) => {
    if (window.lux) {
      // La API ahora espera string. Mapear index a nombre si es necesario.
      // Por compatibilidad, convertimos el índice a string del nombre de paleta
      const paletteNames = ['fuego', 'hielo', 'selva', 'neon', 'arcoiris', 'sunset', 'ocean']
      const paletteName = paletteNames[index] ?? 'fuego'
      await window.lux.setPalette(paletteName)
    }
  }, [])

  const setMovement = useCallback(async (config: { pattern?: string; speed?: number; intensity?: number }) => {
    if (window.lux) {
      await window.lux.setMovement(config)
    }
  }, [])

  const triggerEffect = useCallback(async (name: string, params?: Record<string, unknown>, duration?: number): Promise<number> => {
    if (window.lux) {
      const result = await window.lux.triggerEffect(name, params, duration)
      return result.effectId ?? -1
    }
    return -1
  }, [])

  const cancelEffect = useCallback(async (effectId: number) => {
    if (window.lux) {
      await window.lux.cancelEffect(effectId)
    }
  }, [])

  const cancelAllEffects = useCallback(async () => {
    if (window.lux) {
      await window.lux.cancelAllEffects()
    }
  }, [])

  const simulateAudio = useCallback(async (metrics: { bass: number; mid: number; treble: number; energy: number; bpm: number }) => {
    if (window.lux) {
      await window.lux.audioFrame(metrics)
    }
  }, [])

  return {
    state,
    isConnected,
    isRunning,
    start,
    stop,
    setPalette,
    setMovement,
    triggerEffect,
    cancelEffect,
    cancelAllEffects,
    simulateAudio,
  }
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook para obtener solo el color RGB actual
 */
export function useSeleneColor(): { r: number; g: number; b: number } {
  const { state } = useSelene()
  return {
    r: state?.r ?? 0,
    g: state?.g ?? 0,
    b: state?.b ?? 0,
  }
}

/**
 * Hook para obtener solo las métricas de audio
 */
export function useSeleneAudio() {
  const { state } = useSelene()
  return state?.audioMetrics ?? { bass: 0, mid: 0, treble: 0, energy: 0, bpm: 120 }
}

/**
 * Hook para obtener el dimmer normalizado (0-1)
 */
export function useSeleneDimmer(): number {
  const { state } = useSelene()
  return (state?.dimmer ?? 0) / 255
}

export default useSelene
