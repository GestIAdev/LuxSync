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
import { useAudioStore, selectTrinityAudioActions } from '../stores/audioStore'
import { useSeleneStore, LogEntryType, selectTrinitySeleneActions } from '../stores/seleneStore'
import { useDMXStore, FixtureValues, selectUpdateFixtureValues } from '../stores/dmxStore'
import { useLuxSyncStore, EffectId, selectTrinityEffectsSync } from '../stores/luxsyncStore'  // 🔥 WAVE 10.7: Effects sync
import { usePowerStore } from '../hooks/useSystemPower'  // 🔌 WAVE 63.8: Power control
import { useControlStore, GlobalMode } from '../stores/controlStore'  // 🔥 WAVE 74: Mode sync
import { useSetupStore } from '../stores/setupStore'  // 🔥 WAVE 2501: Audio persistence on ARM
import { useShallow } from 'zustand/shallow'

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
  /** WAVE 3000: Detener captura de audio completamente (modo OFF) */
  stopAudio: () => void
}

// ============================================================================
// CONTEXT
// ============================================================================

const TrinityContext = createContext<TrinityContextValue | null>(null)

// 🚨 WAVE 14.9: FLAGS GLOBALES (sobreviven React Strict Mode)
// React 18 StrictMode monta/desmonta componentes 2 veces en desarrollo.
// Los useRef dentro del componente se reinician. Estos flags son GLOBALES.
let _hasInitializedHandshake = false
let _hasSubscribedToFixtures = false
let _fixtureListener: ((event: any, fixtures: any[]) => void) | null = null

export function useTrinity() {
  const context = useContext(TrinityContext)
  if (!context) {
    throw new Error('useTrinity must be used within TrinityProvider')
  }
  return context
}

/**
 * WAVE 429: Safe version that returns null if context not ready
 * Use this in components that might render before TrinityProvider is stable
 * (e.g., during React StrictMode double-mount or lazy loading)
 */
export function useTrinityOptional() {
  return useContext(TrinityContext)
}

// ============================================================================
// PROVIDER
// ============================================================================

interface TrinityProviderProps {
  children: ReactNode
}

export function TrinityProvider({ children }: TrinityProviderProps) {
  // WAVE 429: Debug - track mount/unmount
  useEffect(() => {
    console.log('[TrinityProvider] 🟢 MOUNTED')
    return () => console.log('[TrinityProvider] 🔴 UNMOUNTED')
  }, [])
  
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
  
  // 🛡️ WAVE 2042.13.6: React 19 fix - Stable selectors to prevent infinite loops
  // Stores - using selectors for action functions
  const { updateMetrics: updateAudioStore, registerBeat } = useAudioStore(useShallow(selectTrinityAudioActions))
  const {
    setConnected,
    setInitialized,
    updateBrainMetrics,
    incrementFrames,
    addLogEntry,
  } = useSeleneStore(useShallow(selectTrinitySeleneActions))
  const updateFixtureValues = useDMXStore(selectUpdateFixtureValues)
  const { setActiveEffects, setBlackout } = useLuxSyncStore(useShallow(selectTrinityEffectsSync))
  
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
    if (seleneState.brain) {
      const { mode, confidence, beautyScore, energy } = seleneState.brain
      
      updateBrainMetrics({
        currentMode: mode,
        confidence,
        beautyScore,
        energy,
      })
      
      // 🎯 WAVE 13.6: Mode sync ahora lo hace onModeChange directamente
      // NO sincronizar aquí - handleStateUpdate solo actualiza métricas visuales
      // La confirmación de modo viene por el evento 'selene:mode-changed'
      
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
    // � WAVE 14.9: Solo actualizar valores DMX, sin logs
    if (seleneState.fixtures && seleneState.fixtures.length > 0) {
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
    // 🧹 WAVE 63.7: Logs silenciados para arranque limpio
    
    try {
      // 1. Query backend state and start Selene only if not running.
      if (window.lux) {
        const current = await window.lux.getState()
        if (!current) {
          // Selene not running → start it
          const result = await window.lux.start()
          
          // Sync saved inputGain from config to audioStore
          if (result?.inputGain !== undefined) {
            useAudioStore.getState().setInputGain(result.inputGain)
          }
        } else {
          // Selene already running → just sync inputGain
          const result = await window.lux.start()
          if (result?.inputGain !== undefined) {
            useAudioStore.getState().setInputGain(result.inputGain)
          }
        }
      }
      
      // 2. Subscribe to state updates
      if (window.lux?.onStateUpdate) {
        unsubscribeRef.current = window.lux.onStateUpdate(handleStateUpdate)
      }
      
      // Subscribe to mode changes from Backend
      // 🔥 WAVE 74 + WAVE 427: Sync controlStore (flow ELIMINATED)
      if (window.lux?.onModeChange) {
        const unsubMode = window.lux.onModeChange((data: { mode: string; brain: boolean }) => {
          // WAVE 427: Backend may still send 'flow' - map it to 'selene'
          const backendMode = data.mode as 'selene' | 'locked' | string
          const uiMode: 'selene' | 'locked' = (backendMode === 'locked') ? 'locked' : 'selene'
          useSeleneStore.getState().setMode(uiMode)
          
          // 🔥 WAVE 427: 'flow' eliminated - always use 'selene' for AI control
          const globalMode: GlobalMode = 'selene'
          useControlStore.getState().setGlobalMode(globalMode)
          console.log(`[TrinityProvider] 🔥 WAVE 427: Backend mode → '${globalMode}' (from ${backendMode})`)
        })
        // Store cleanup function (combined with state update unsub)
        const originalUnsub = unsubscribeRef.current
        unsubscribeRef.current = () => {
          originalUnsub?.()
          unsubMode()
        }
      }
      
      // 🔧 WAVE 24: Subscribe to telemetry updates (for Canvas synchronization)
      if (window.lux?.onTelemetryUpdate) {
        const unsubTelemetry = window.lux.onTelemetryUpdate((packet: any) => {
          // Extract fixtureValues and update DMX store
          if (packet?.fixtureValues && packet.fixtureValues.length > 0) {
            useDMXStore.getState().updateFixtureValues(packet.fixtureValues)
          }
        })
        // Store cleanup function (combined with previous unsubs)
        const originalUnsub = unsubscribeRef.current
        unsubscribeRef.current = () => {
          originalUnsub?.()
          unsubTelemetry()
        }
      }
      
      // Audio capture: NO iniciamos aquí.
      // El usuario DEBE activar el audio manualmente desde SystemsCheck.
      // Audio permanece OFFLINE hasta acción explícita del usuario.
      
      // Update state
      setState(prev => ({
        ...prev,
        isConnected: true,
        isAudioActive: false,  // KILL AUTO-AUDIO: siempre OFF al arrancar
      }))
      setConnected(true)
      setInitialized(true)
      
      addLogEntry({
        type: 'INIT' as LogEntryType,
        message: '🔺 TRINITY SYSTEM ONLINE — Audio OFF (manual)',
        data: { audioActive: false },
      })
      
      // 🧹 WAVE 63.7: Single clean log
      console.log('[Selene UI] ✅ Trinity Online — Audio awaiting manual activation')
      
    } catch (error) {
      console.error('[Trinity] ❌ Error starting:', error)
      addLogEntry({
        type: 'ERROR' as LogEntryType,
        message: `Trinity start failed: ${error}`,
      })
    }
  }, [handleStateUpdate, setConnected, setInitialized, addLogEntry])
  
  // Stop Trinity System
  const stopTrinity = useCallback(() => {
    // 🧹 WAVE 63.7: Log silenciado
    
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
  
  // Initial State Handshake - sincronizar con backend
  useEffect(() => {
    if (_hasInitializedHandshake) {
      return
    }
    _hasInitializedHandshake = true
    
    const syncInitialState = async () => {
      if (!window.lux?.getFullState) {
        return
      }
      
      try {
        const fullState = await window.lux.getFullState()
        
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
        }
        
        // Sync Selene Store
        if (fullState.selene) {
          if (fullState.selene.isRunning) {
            setConnected(true)
            setInitialized(true)
            
            if (fullState.selene.mode) {
              // 🔥 WAVE 427: FORCED SELENE MODE - 'flow' no longer exists
              // Backend may still send 'flow' at startup - always map to 'selene'
              const backendMode = fullState.selene.mode as string
              const initialMode: 'selene' | 'locked' = (backendMode === 'locked') ? 'locked' : 'selene'
              
              if (backendMode === 'flow') {
                console.log('[TrinityProvider] ⚠️ Backend in legacy Flow mode at startup - Forcing SELENE...')
                window.lux.setMode('selene')  // ← Force backend to Selene
              }
              
              // 1. Update brain state with forced mode
              useSeleneStore.getState().setMode(initialMode)
              
              // 2. 🔥 WAVE 427: Always use 'selene' for GlobalMode (AI control)
              const globalMode: GlobalMode = 'selene'
              useControlStore.getState().setGlobalMode(globalMode)
              console.log(`[TrinityProvider] 🔥 WAVE 427: Startup Complete → System locked to '${globalMode}'`)
            }
            
            if (fullState.selene.brainMode) {
              updateBrainMetrics({ 
                currentMode: fullState.selene.brainMode as 'reactive' | 'intelligent',
                paletteSource: (fullState.selene.paletteSource || 'fallback') as 'memory' | 'procedural' | 'fallback'
              })
            }
          }
        }
        
        // 🧹 WAVE 63.7: Logs silenciados
      } catch (error) {
        console.error('[Trinity] ❌ Initial State Handshake failed:', error)
      }
    }
    
    syncInitialState()
  }, [])
  
  // Listener Dedicado para Fixtures (Canal Separado)
  useEffect(() => {
    if (!window.electron || _hasSubscribedToFixtures) return
    _hasSubscribedToFixtures = true
    
    _fixtureListener = (_event: any, fixtures: any[]) => {
      useDMXStore.getState().setFixtures(fixtures)
    }
    
    // Suscribirse al canal dedicado
    window.electron.ipcRenderer.on('lux:fixtures-loaded', _fixtureListener)
    
    return () => {
      // Solo cleanup, sin log
    }
  }, [])
  
  // Sync audio metrics to store (from useAudioCapture → audioStore)
  // 🔧 WAVE 2205.3: BPM excluido — lo gestiona SeleneTruth Audio Bridge (sBPM real).
  // useAudioCapture tiene su propio detector local (bpm: 120 default) que machaca el sBPM.
  useEffect(() => {
    if (isCapturing) {
      updateAudioStore({
        bass: audioMetrics.bass,
        mid: audioMetrics.mid,
        treble: audioMetrics.treble,
        onBeat: audioMetrics.onBeat,
        // bpm: EXCLUIDO — fuente autoritativa: SeleneTruth Audio Bridge (data.context.bpm)
      })
    }
  }, [audioMetrics, isCapturing, updateAudioStore])
  
  // 🔌 WAVE 63.95: TRUE GLOBAL KILL SWITCH
  // Power-controlled startup — inicia workers/subscriptions al ONLINE.
  // KILL AUTO-AUDIO: el audio NO se inicia aquí, solo los workers de Selene.
  // El audio es control MANUAL exclusivo del usuario.
  // 🔥 WAVE 2501: AUDIO PERSISTENCE ON ARM — si el usuario ya configuró una fuente
  // de audio antes de pulsar ARM, el sistema la recupera silenciosamente.
  const powerState = usePowerStore((s) => s.powerState)
  const hasStartedRef = useRef(false)
  
  useEffect(() => {
    // Start workers cuando powerState → ONLINE (usuario pulsó power)
    if (powerState === 'ONLINE' && !hasStartedRef.current) {
      console.log('[Trinity] 🔌 POWER ON - Starting workers (audio MANUAL)')
      hasStartedRef.current = true
      startTrinity().then(() => {
        // 🔥 WAVE 2501: Re-engage audio source if user had one configured before ARM
        // Read directly from store (not hook) — we're inside a callback, not render
        const savedSource = useSetupStore.getState().audioSource
        if (savedSource && savedSource !== 'off') {
          console.log(`[Trinity] 🎵 WAVE 2501: Re-engaging audio source '${savedSource}' after ARM`)
          setState(prev => ({ ...prev, isAudioActive: false }))  // reset before reattach
          if (savedSource === 'simulation') {
            setSimulationMode(true)
            setState(prev => ({ ...prev, isAudioActive: true }))
          } else if (savedSource === 'system') {
            startSystemAudio().then(() => {
              setState(prev => ({ ...prev, isAudioActive: true }))
            }).catch((err) => {
              console.warn('[Trinity] WAVE 2501: System audio re-engage failed:', err)
            })
          } else if (savedSource === 'microphone') {
            startMicrophone().then(() => {
              setState(prev => ({ ...prev, isAudioActive: true }))
            }).catch((err) => {
              console.warn('[Trinity] WAVE 2501: Microphone re-engage failed:', err)
            })
          }
        }
      })
    }
    
    // KILL SWITCH: Stop todo (incluyendo audio) cuando → OFFLINE
    if (powerState === 'OFFLINE') {
      if (hasStartedRef.current) {
        console.log('[Trinity] 🔌 POWER OFF - Killing all (audio + workers)')
        hasStartedRef.current = false
        stopTrinity()
      }
      // Seguridad extra: forzar stop si audio seguía activo
      if (isCapturing) {
        console.log('[Trinity] 🛑 FORCE STOP - Audio was still running!')
        stopCapture()
      }
    }
  }, [powerState, isCapturing]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTrinity()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // B2 FIX: stopAudio wrapper que para captura Y refleja isAudioActive=false en el estado.
  // Antes: stopAudio: stopCapture → stopCapture no toca state.isAudioActive
  // Ahora: el estado se actualiza aquí, SystemsCheck detecta el cambio via useEffect
  const stopAudio = useCallback(() => {
    stopCapture()
    setState(prev => ({ ...prev, isAudioActive: false }))
  }, [stopCapture])

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
    stopAudio,
  }
  
  return (
    <TrinityContext.Provider value={value}>
      {children}
    </TrinityContext.Provider>
  )
}

export default TrinityProvider
