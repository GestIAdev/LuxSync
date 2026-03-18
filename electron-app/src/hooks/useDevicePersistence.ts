/**
 * 🔄 USE DEVICE PERSISTENCE - Auto-reconnect Hook
 * WAVE 26 Phase 2: Restores Audio & DMX configuration on app start
 * 
 * This hook:
 * 1. Reads saved config from electron-store on mount
 * 2. Attempts to reconnect audio source
 * 3. Attempts to reconnect DMX interface
 * 4. Updates setupStore with restored values
 */

import { useEffect, useRef, useCallback } from 'react'
import { useTrinity } from '../providers/TrinityProvider'
import { useSetupStore, selectDevicePersistence } from '../stores/setupStore'
import { useAudioStore, selectSetInputGain } from '../stores/audioStore'
import { useShallow } from 'zustand/shallow'

// Helper to access dmx API
const getDmxApi = () => (window as any).lux?.dmx

// Flag to prevent double initialization in React Strict Mode
let _hasInitialized = false

export function useDevicePersistence() {
  const trinity = useTrinity()
  // 🛡️ WAVE 2042.13.5: useShallow para evitar infinite loop
  const { 
    setAudioSource, 
    setDmxDriver, 
    setDmxPort,
    setDetectedDmxPorts,
  } = useSetupStore(useShallow(selectDevicePersistence))
  // 🛡️ WAVE 2042.13.5: Selector directo (función - estable)
  const setInputGain = useAudioStore(selectSetInputGain)
  
  const isInitializing = useRef(false)
  
  console.log('[DevicePersistence] 🔍 _hasInitialized:', _hasInitialized)
  
  // Restore audio configuration
  const restoreAudio = useCallback(async (config: any) => {
    if (!config?.audio) return
    
    const { source, inputGain } = config.audio
    
    console.log('[DevicePersistence] Restoring audio:', { source, inputGain })
    
    // Restore input gain
    if (typeof inputGain === 'number') {
      setInputGain(inputGain)
    }
    
    // Restore audio source
    // KILL AUTO-AUDIO: solo restaurar estados pasivos (off/simulation).
    // Las fuentes de captura real (system/microphone) requieren acción MANUAL del usuario.
    if (source) {
      if (source === 'off') {
        // Usuario eligió OFF explícitamente — mantener OFF.
        trinity.stopAudio()
        trinity.setSimulating(false)
        setAudioSource('off')
        console.log('[DevicePersistence] ✅ Audio OFF restored (user preference)')

      } else if (source === 'simulation') {
        // Simulation es pasivo, ok restaurar.
        trinity.setSimulating(true)
        setAudioSource('simulation')
        console.log('[DevicePersistence] ✅ Restored simulation mode')

      } else {
        // system/microphone: NO restaurar auto. El usuario debe activarlos manualmente.
        // Dejar en OFF para no capturar audio de fondo sin consentimiento.
        trinity.stopAudio()
        trinity.setSimulating(false)
        setAudioSource('off')
        console.log(`[DevicePersistence] 🔇 source='${source}' → forced to OFF (manual activation required)`)
      }
    }
  }, [trinity, setAudioSource, setInputGain])
  
  // Restore DMX configuration
  const restoreDMX = useCallback(async (config: any) => {
    const dmxApi = getDmxApi()
    if (!dmxApi) {
      console.warn('[DevicePersistence] ❌ DMX API not available')
      return
    }
    
    // 🔌 WAVE 2042.25: Si no hay config guardada, hacer auto-connect
    if (!config?.dmx) {
      console.log('[DevicePersistence] 📡 No saved DMX config, trying auto-connect...')
      try {
        const result = await dmxApi.autoConnect()
        if (result.success) {
          setDmxDriver('usb-serial')
          console.log('[DevicePersistence] ✅ Auto-connected to USB DMX')
        } else {
          console.warn('[DevicePersistence] ⚠️ Auto-connect returned success=false')
        }
      } catch (err) {
        console.error('[DevicePersistence] ❌ Auto-connect failed:', err)
      }
      return
    }
    
    const { driver, comPort } = config.dmx
    
    console.log('[DevicePersistence] Restoring DMX:', { driver, comPort })
    
    try {
      if (driver === 'virtual') {
        await dmxApi.connect('virtual')
        setDmxDriver('virtual')
        console.log('[DevicePersistence] ✅ Restored virtual DMX')
        
      } else if (driver === 'usb-serial') {
        setDmxDriver('usb-serial')
        
        // Scan for devices first
        console.log('[DevicePersistence] 🔍 Scanning for USB DMX devices...')
        const devices = await dmxApi.listDevices()
        console.log('[DevicePersistence] 📡 Found', devices?.length || 0, 'devices')
        setDetectedDmxPorts(devices || [])
        
        // Try to connect to saved port
        if (comPort) {
          const portStillExists = devices?.some((d: any) => d.path === comPort)
          if (portStillExists) {
            console.log('[DevicePersistence] 🔌 Connecting to saved port:', comPort)
            await dmxApi.connect(comPort)
            setDmxPort(comPort)
            console.log('[DevicePersistence] ✅ Restored USB DMX:', comPort)
          } else {
            // Port no longer exists, try auto-connect
            console.log('[DevicePersistence] ⚠️ Saved port not found, trying auto-connect')
            const result = await dmxApi.autoConnect()
            console.log('[DevicePersistence] 🔌 Auto-connect result:', result)
          }
        } else {
          // No saved port, try auto-connect
          console.log('[DevicePersistence] 📡 No saved port, trying auto-connect')
          const result = await dmxApi.autoConnect()
          console.log('[DevicePersistence] 🔌 Auto-connect result:', result)
        }
      }
    } catch (err) {
      console.error('[DevicePersistence] ❌ DMX restore failed:', err)
    }
  }, [setDmxDriver, setDmxPort, setDetectedDmxPorts])
  
  // Main initialization effect
  useEffect(() => {
    console.log('[DevicePersistence] 🎬 useEffect triggered')
    
    if (_hasInitialized || isInitializing.current) {
      console.log('[DevicePersistence] ⏭️ Skipping (already initialized or in progress)')
      return
    }
    
    const initialize = async () => {
      isInitializing.current = true
      _hasInitialized = true
      
      console.log('[DevicePersistence] 🔄 Starting device restoration...')
      
      try {
        // Load config from backend
        if (window.lux?.getConfig) {
          console.log('[DevicePersistence] 📡 Fetching config from backend...')
          const config = await window.lux.getConfig()
          console.log('[DevicePersistence] 📦 Loaded config:', JSON.stringify(config, null, 2))
          
          // Restore in parallel
          await Promise.all([
            restoreAudio(config),
            restoreDMX(config),
          ])
          
          console.log('[DevicePersistence] ✅ Device restoration complete')
        } else {
          console.warn('[DevicePersistence] getConfig not available')
        }
      } catch (err) {
        console.error('[DevicePersistence] Initialization failed:', err)
      } finally {
        isInitializing.current = false
      }
    }
    
    // Small delay to ensure app is ready
    const timer = setTimeout(initialize, 500)
    return () => clearTimeout(timer)
  }, [restoreAudio, restoreDMX])
  
  return {
    restoreAudio,
    restoreDMX,
  }
}

export default useDevicePersistence
