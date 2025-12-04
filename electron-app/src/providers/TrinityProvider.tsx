/**
 * 🔺 TRINITY PROVIDER - Sistema Nervioso Central
 * TRINITY PHASE 2: Conecta Audio Input → Main Process → UI
 * 
 * Este provider:
 * 1. Inicia la captura de audio (useAudioCapture)
 * 2. Escucha eventos lux:state-update del Main Process
 * 3. Actualiza stores (audioStore, seleneStore) con datos reales
 * 
 * Resultado: La UI reacciona en tiempo real a la música
 */

import { createContext, useContext, useEffect, useRef, ReactNode, useCallback, useState } from 'react'
import { useAudioCapture, AudioMetrics } from '../hooks/useAudioCapture'
import { useAudioStore } from '../stores/audioStore'
import { useSeleneStore, LogEntryType } from '../stores/seleneStore'

// ============================================================================
// TYPES
// ============================================================================

interface TrinityState {
  isConnected: boolean
  isAudioActive: boolean
  lastUpdateTime: number
  framesReceived: number
}

interface SeleneStateUpdate {
  // Colors from Selene
  colors?: {
    primary: { r: number; g: number; b: number }
    secondary: { r: number; g: number; b: number }
    accent: { r: number; g: number; b: number }
  }
  
  // Movement
  movement?: {
    pan: number
    tilt: number
    pattern: string
    speed: number
  }
  
  // Beat/Audio info
  beat?: {
    bpm: number
    onBeat: boolean
    beatPhase: number
    confidence: number
  }
  
  // Brain state (from GAMMA)
  brain?: {
    mode: 'reactive' | 'intelligent'
    confidence: number
    beautyScore: number
    energy: number
    mood: string
    section: string
  }
  
  // Palette info
  palette?: {
    name: string
    source: 'memory' | 'procedural' | 'fallback'
  }
  
  // Performance
  frameId?: number
  timestamp?: number
}

interface TrinityContextValue {
  state: TrinityState
  startTrinity: () => Promise<void>
  stopTrinity: () => void
  audioMetrics: AudioMetrics
  isSimulating: boolean
  setSimulating: (enabled: boolean) => void
}

// ============================================================================
// CONTEXT
// ============================================================================

const TrinityContext = createContext<TrinityContextValue | null>(null)

export function useTrinity() {
  const context = useContext(TrinityContext)
  if (!context) {
    throw new Error('useTrinity must be used within TrinityProvider')
  }
  return context
}

// ============================================================================
// PROVIDER
// ============================================================================

interface TrinityProviderProps {
  children: ReactNode
  autoStart?: boolean
}

export function TrinityProvider({ children, autoStart = true }: TrinityProviderProps) {
  // Audio capture hook
  const {
    metrics: audioMetrics,
    isCapturing,
    startCapture,
    stopCapture,
    setSimulationMode,
  } = useAudioCapture()
  
  // Stores
  const { updateMetrics: updateAudioStore, registerBeat } = useAudioStore()
  const {
    setConnected,
    setInitialized,
    updateBrainMetrics,
    incrementFrames,
    addLogEntry,
  } = useSeleneStore()
  
  // Local state
  const [state, setState] = useState<TrinityState>({
    isConnected: false,
    isAudioActive: false,
    lastUpdateTime: 0,
    framesReceived: 0,
  })
  const [isSimulating, setIsSimulating] = useState(false)
  
  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const lastModeRef = useRef<string>('')
  const lastSectionRef = useRef<string>('')
  
  // Handle state updates from Main Process
  const handleStateUpdate = useCallback((seleneState: SeleneStateUpdate) => {
    setState(prev => ({
      ...prev,
      lastUpdateTime: Date.now(),
      framesReceived: prev.framesReceived + 1,
    }))
    
    incrementFrames()
    
    // === UPDATE AUDIO STORE ===
    if (seleneState.beat) {
      updateAudioStore({
        bpm: seleneState.beat.bpm,
        bpmConfidence: seleneState.beat.confidence,
        onBeat: seleneState.beat.onBeat,
      })
      
      if (seleneState.beat.onBeat) {
        registerBeat()
      }
    }
    
    // === UPDATE SELENE STORE ===
    if (seleneState.brain) {
      const { mode, confidence, beautyScore, energy } = seleneState.brain
      
      updateBrainMetrics({
        currentMode: mode,
        confidence,
        beautyScore,
        energy,
      })
      
      // Log mode changes
      if (mode !== lastModeRef.current) {
        lastModeRef.current = mode
        addLogEntry({
          type: 'MODE' as LogEntryType,
          message: `Switched to ${mode.toUpperCase()} mode`,
          data: { confidence, energy },
        })
      }
    }
    
    // Log section changes
    if (seleneState.brain?.section && seleneState.brain.section !== lastSectionRef.current) {
      lastSectionRef.current = seleneState.brain.section
      addLogEntry({
        type: 'SECTION' as LogEntryType,
        message: `Section: ${seleneState.brain.section}`,
        data: { mood: seleneState.brain.mood },
      })
    }
    
    // Log palette changes
    if (seleneState.palette) {
      updateBrainMetrics({
        paletteSource: seleneState.palette.source,
      })
    }
    
  }, [updateAudioStore, registerBeat, updateBrainMetrics, incrementFrames, addLogEntry])
  
  // Start Trinity System
  const startTrinity = useCallback(async () => {
    console.log('[Trinity] 🔺 Starting Trinity System...')
    
    try {
      // 1. Start Selene in Main Process
      if (window.lux) {
        const result = await window.lux.start()
        console.log('[Trinity] ✅ Selene LUX started:', result)
      }
      
      // 2. Subscribe to state updates
      if (window.lux?.onStateUpdate) {
        unsubscribeRef.current = window.lux.onStateUpdate(handleStateUpdate)
        console.log('[Trinity] 📡 Subscribed to state updates')
      }
      
      // 3. Start audio capture
      await startCapture()
      console.log('[Trinity] 🎤 Audio capture started')
      
      // Update state
      setState(prev => ({
        ...prev,
        isConnected: true,
        isAudioActive: true,
      }))
      setConnected(true)
      setInitialized(true)
      
      addLogEntry({
        type: 'INIT' as LogEntryType,
        message: '🔺 TRINITY SYSTEM ONLINE',
        data: { audioActive: true },
      })
      
      console.log('[Trinity] ✅ Trinity System ONLINE!')
      
    } catch (error) {
      console.error('[Trinity] ❌ Error starting:', error)
      addLogEntry({
        type: 'ERROR' as LogEntryType,
        message: `Trinity start failed: ${error}`,
      })
    }
  }, [startCapture, handleStateUpdate, setConnected, setInitialized, addLogEntry])
  
  // Stop Trinity System
  const stopTrinity = useCallback(() => {
    console.log('[Trinity] 🛑 Stopping Trinity System...')
    
    // Unsubscribe from updates
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    
    // Stop audio
    stopCapture()
    
    // Stop Selene
    if (window.lux) {
      window.lux.stop()
    }
    
    // Update state
    setState(prev => ({
      ...prev,
      isConnected: false,
      isAudioActive: false,
    }))
    setConnected(false)
    
    addLogEntry({
      type: 'INIT' as LogEntryType,
      message: '🛑 Trinity System stopped',
    })
    
  }, [stopCapture, setConnected, addLogEntry])
  
  // Toggle simulation mode
  const setSimulating = useCallback((enabled: boolean) => {
    setIsSimulating(enabled)
    setSimulationMode(enabled)
    
    addLogEntry({
      type: 'MODE' as LogEntryType,
      message: enabled ? '🎮 Simulation mode ON' : '🎤 Real audio mode',
    })
  }, [setSimulationMode, addLogEntry])
  
  // Sync audio metrics to store (from useAudioCapture → audioStore)
  useEffect(() => {
    if (isCapturing) {
      updateAudioStore({
        bass: audioMetrics.bass,
        mid: audioMetrics.mid,
        treble: audioMetrics.treble,
        onBeat: audioMetrics.onBeat,
        bpm: audioMetrics.bpm,
      })
    }
  }, [audioMetrics, isCapturing, updateAudioStore])
  
  // Auto-start on mount
  useEffect(() => {
    if (autoStart) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTrinity()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [autoStart, startTrinity])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTrinity()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Context value
  const value: TrinityContextValue = {
    state,
    startTrinity,
    stopTrinity,
    audioMetrics,
    isSimulating,
    setSimulating,
  }
  
  return (
    <TrinityContext.Provider value={value}>
      {children}
    </TrinityContext.Provider>
  )
}

export default TrinityProvider
