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
import { useSetupStore } from '../stores/setupStore'
import { useAudioStore } from '../stores/audioStore'

// Helper to access dmx API
const getDmxApi = () => (window as any).lux?.dmx

// Flag to prevent double initialization in React Strict Mode
let _hasInitialized = false

export function useDevicePersistence() {
  const trinity = useTrinity()
  const { 
    setAudioSource, 
    setDmxDriver, 
    setDmxPort,
    setDetectedDmxPorts,
  } = useSetupStore()
  const { setInputGain } = useAudioStore()
  
  const isInitializing = useRef(false)
  
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
    if (source) {
      try {
        if (source === 'simulation') {
          trinity.setSimulating(true)
          setAudioSource('simulation')
          console.log('[DevicePersistence] ✅ Restored simulation mode')
          
        } else if (source === 'system') {
          await trinity.startSystemAudio()
          trinity.setSimulating(false)
          setAudioSource('system')
          console.log('[DevicePersistence] ✅ Restored system audio')
          
        } else if (source === 'microphone') {
          await trinity.startMicrophone()
          trinity.setSimulating(false)
          setAudioSource('microphone')
          console.log('[DevicePersistence] ✅ Restored microphone')
        }
      } catch (err) {
        console.warn('[DevicePersistence] Audio restore failed, falling back to simulation:', err)
        trinity.setSimulating(true)
        setAudioSource('simulation')
      }
    }
  }, [trinity, setAudioSource, setInputGain])
  
  // Restore DMX configuration
  const restoreDMX = useCallback(async (config: any) => {
    if (!config?.dmx) return
    
    const { driver, comPort } = config.dmx
    
    console.log('[DevicePersistence] Restoring DMX:', { driver, comPort })
    
    const dmxApi = getDmxApi()
    if (!dmxApi) {
      console.warn('[DevicePersistence] DMX API not available')
      return
    }
    
    try {
      if (driver === 'virtual') {
        await dmxApi.connect('virtual')
        setDmxDriver('virtual')
        console.log('[DevicePersistence] ✅ Restored virtual DMX')
        
      } else if (driver === 'usb-serial') {
        setDmxDriver('usb-serial')
        
        // Scan for devices first
        const devices = await dmxApi.listDevices()
        setDetectedDmxPorts(devices || [])
        
        // Try to connect to saved port
        if (comPort) {
          const portStillExists = devices?.some((d: any) => d.path === comPort)
          if (portStillExists) {
            await dmxApi.connect(comPort)
            setDmxPort(comPort)
            console.log('[DevicePersistence] ✅ Restored USB DMX:', comPort)
          } else {
            // Port no longer exists, try auto-connect
            console.log('[DevicePersistence] Saved port not found, trying auto-connect')
            await dmxApi.autoConnect()
          }
        } else {
          // No saved port, try auto-connect
          await dmxApi.autoConnect()
        }
      }
    } catch (err) {
      console.warn('[DevicePersistence] DMX restore failed:', err)
    }
  }, [setDmxDriver, setDmxPort, setDetectedDmxPorts])
  
  // Main initialization effect
  useEffect(() => {
    if (_hasInitialized || isInitializing.current) return
    
    const initialize = async () => {
      isInitializing.current = true
      _hasInitialized = true
      
      console.log('[DevicePersistence] 🔄 Starting device restoration...')
      
      try {
        // Load config from backend
        if (window.lux?.getConfig) {
          const config = await window.lux.getConfig()
          console.log('[DevicePersistence] Loaded config:', config)
          
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
