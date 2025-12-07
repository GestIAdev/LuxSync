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
import { useDMXStore, FixtureValues } from '../stores/dmxStore'
import { useLuxSyncStore, EffectId } from '../stores/luxsyncStore'  // 🔥 WAVE 10.7: Effects sync

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
    energy?: number  // 🔊 WAVE 10.6: RMS energy 0-1
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
  
  // 🎯 WAVE 13.6: brainMode directo del SeleneLux (STATE OF TRUTH)
  brainMode?: 'reactive' | 'intelligent'
  
  // WAVE 9.6.3: Fixture values from main loop
  fixtures?: FixtureValues[]
  
  // 🔥 WAVE 10.7: Effects from main loop
  effects?: {
    blackout: boolean
    strobe: boolean
    blinder: boolean
    police: boolean
    rainbow: boolean
    beam: boolean
    prism: boolean
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
  // WAVE 9.6.4: Audio source controls
  startSystemAudio: () => Promise<void>
  startMicrophone: () => Promise<void>
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
    startSystemAudio,
    startMicrophone,
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
  const { updateFixtureValues } = useDMXStore()  // WAVE 9.6.3
  const { setActiveEffects, setBlackout } = useLuxSyncStore()  // 🔥 WAVE 10.7: Effects sync
  
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
      // 🔊 WAVE 10.6: Calculate real dB from energy (0-1)
      // Formula: dB = 20 * log10(energy), clamped to -60..0
      const energy = seleneState.beat.energy ?? seleneState.brain?.energy ?? 0.001
      const db = Math.max(-60, Math.min(0, 20 * Math.log10(Math.max(0.001, energy))))
      
      updateAudioStore({
        bpm: seleneState.beat.bpm,
        bpmConfidence: seleneState.beat.confidence,
        onBeat: seleneState.beat.onBeat,
        level: db, // 🎚️ Real dB value!
      })
      
      if (seleneState.beat.onBeat) {
        registerBeat()
      }
    }
    
    // === UPDATE SELENE STORE ===
    // 🎯 WAVE 13.6: STATE OF TRUTH - Sincronizar modo desde brainMode (no brain.mode)
    if (seleneState.brainMode) {
      // Actualizar currentMode directamente desde brainMode (refleja useBrain && mode)
      updateBrainMetrics({
        currentMode: seleneState.brainMode,
      })
      
      // Sincronizar el modo de UI basado en brainMode
      const uiMode = seleneState.brainMode === 'intelligent' ? 'selene' : 'flow'
      const currentStoreMode = useSeleneStore.getState().mode
      if (currentStoreMode !== uiMode) {
        useSeleneStore.getState().setMode(uiMode)
        console.log(`[Trinity] 🔄 Mode synced from brainMode: ${seleneState.brainMode} → UI: ${uiMode}`)
      }
      
      // Log mode changes
      if (seleneState.brainMode !== lastModeRef.current) {
        lastModeRef.current = seleneState.brainMode
        addLogEntry({
          type: 'MODE' as LogEntryType,
          message: `Mode: ${seleneState.brainMode.toUpperCase()}`,
          data: { brainMode: seleneState.brainMode },
        })
      }
    } else if (seleneState.brain) {
      // Fallback: usar brain.mode si brainMode no está disponible
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
    
    // WAVE 9.6.3: Update fixture values for SimulateView
    if (seleneState.fixtures && seleneState.fixtures.length > 0) {
      // 🔍 DEBUG: Log ALL fixture addresses and zones (more detail)
      if (Math.random() < 0.01) { // 1% of frames
        const summary = seleneState.fixtures.map(f => {
          const zoneShort = f.zone === 'MOVING_LEFT' ? 'M_L' : 
                           f.zone === 'MOVING_RIGHT' ? 'M_R' : 
                           f.zone?.substring(0,3) || 'UNK'
          return `${f.dmxAddress}:${zoneShort}`
        }).join(', ')
        console.log('[Trinity] 📍 All fixtures:', summary)
      }
      updateFixtureValues(seleneState.fixtures)
    }
    
    // 🔥 WAVE 10.7: Update effects state from backend
    if (seleneState.effects) {
      const activeEffects = new Set<EffectId>()
      
      if (seleneState.effects.strobe) activeEffects.add('strobe')
      if (seleneState.effects.blinder) activeEffects.add('blinder')
      if (seleneState.effects.rainbow) activeEffects.add('rainbow')
      if (seleneState.effects.police) activeEffects.add('police')
      if (seleneState.effects.beam) activeEffects.add('beam')
      if (seleneState.effects.prism) activeEffects.add('prism')
      
      setActiveEffects(activeEffects)
      setBlackout(seleneState.effects.blackout)
    }
    
  }, [updateAudioStore, registerBeat, updateBrainMetrics, incrementFrames, addLogEntry, updateFixtureValues, setActiveEffects, setBlackout])
  
  // Start Trinity System
  const startTrinity = useCallback(async () => {
    console.log('[Trinity] 🔺 Starting Trinity System...')
    
    try {
      // 1. Query backend state and start Selene only if not running.
      // If getState() returns null, Selene is not initialized yet.
      if (window.lux) {
        const current = await window.lux.getState()
        console.log('[Trinity] 🔎 Backend state:', current)
        if (!current) {
          // Selene not running → start it
          const result = await window.lux.start()
          console.log('[Trinity] ✅ Selene LUX started:', result)
        } else {
          // Selene already running → skip start, just subscribe
          console.log('[Trinity] ℹ️ Backend already running, skipping start')
        }
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
  
  // 🎯 WAVE 13.6: INITIAL STATE HANDSHAKE - "Truth First"
  // Al montar, pedir el estado COMPLETO del Backend y sincronizar TODOS los stores
  useEffect(() => {
    const syncInitialState = async () => {
      if (!window.lux?.getFullState) {
        console.warn('[Trinity] ⚠️ getFullState not available, skipping initial sync')
        return
      }
      
      try {
        const fullState = await window.lux.getFullState()
        console.log('[Trinity] 🎯 Initial State Handshake:', fullState)
        
        // Sync DMX Store
        if (fullState.dmx) {
          if (fullState.dmx.isConnected && fullState.dmx.driver && fullState.dmx.port) {
            useDMXStore.getState().connect(
              fullState.dmx.driver as 'enttec-open' | 'enttec-pro' | 'artnet' | 'sacn' | 'virtual',
              fullState.dmx.port
            )
          } else {
            useDMXStore.getState().disconnect()
          }
          
          console.log(`[Trinity] 💡 DMX synced: ${fullState.dmx.status} (${fullState.dmx.driver || 'none'})`)
        }
        
        // Sync Selene Store
        if (fullState.selene) {
          if (fullState.selene.isRunning) {
            setConnected(true)
            setInitialized(true)
            
            // 🎚️ WAVE 13.6: Sincronizar modo UI (flow, selene, locked)
            if (fullState.selene.mode) {
              useSeleneStore.getState().setMode(fullState.selene.mode as 'flow' | 'selene' | 'locked')
            }
            
            if (fullState.selene.brainMode) {
              updateBrainMetrics({ 
                currentMode: fullState.selene.brainMode as 'reactive' | 'intelligent',
                paletteSource: (fullState.selene.paletteSource || 'fallback') as 'memory' | 'procedural' | 'fallback'
              })
            }
            
            console.log(`[Trinity] 🧠 Selene synced: mode=${fullState.selene.mode}, brain=${fullState.selene.brainMode}`)
          }
        }
        
        // Sync Fixtures
        if (fullState.fixtures && fullState.fixtures.length > 0) {
          useDMXStore.getState().setFixtures(fullState.fixtures)
          console.log(`[Trinity] 🎭 Fixtures synced: ${fullState.fixtures.length} fixtures loaded`)
        }
        
        console.log('[Trinity] ✅ Initial State Handshake complete')
      } catch (error) {
        console.error('[Trinity] ❌ Initial State Handshake failed:', error)
      }
    }
    
    syncInitialState()
  }, [setConnected, setInitialized, updateBrainMetrics]) // Solo ejecutar una vez al montar
  
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
    startSystemAudio,
    startMicrophone,
  }
  
  return (
    <TrinityContext.Provider value={value}>
      {children}
    </TrinityContext.Provider>
  )
}

export default TrinityProvider
