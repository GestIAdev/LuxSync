/**
 * 🔌 USE SYSTEM POWER - WAVE 63.8
 * 
 * Hook maestro que controla el estado de encendido global del sistema.
 * 
 * Estados:
 * - OFFLINE: Sistema apagado, UI en modo oscuro
 * - STARTING: Inicializando workers y audio
 * - ONLINE: Sistema activo, audio fluyendo
 * 
 * CRÍTICO: Este hook controla cuándo se inicia el audio y los workers.
 * No hay auto-arranque. El usuario debe presionar el botón de power.
 */

import { create } from 'zustand'
import { useCallback } from 'react'
import { useControlStore } from '../stores/controlStore'

// ============================================================================
// TYPES
// ============================================================================

export type SystemPowerState = 'OFFLINE' | 'STARTING' | 'ONLINE'

interface PowerStore {
  powerState: SystemPowerState
  setPowerState: (state: SystemPowerState) => void
  lastError: string | null
  setLastError: (error: string | null) => void
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const usePowerStore = create<PowerStore>((set) => ({
  powerState: 'OFFLINE',
  setPowerState: (state) => set({ powerState: state }),
  lastError: null,
  setLastError: (error) => set({ lastError: error }),
}))

// ============================================================================
// MAIN HOOK
// ============================================================================

export interface UseSystemPowerReturn {
  powerState: SystemPowerState
  isOnline: boolean
  isOffline: boolean
  isStarting: boolean
  lastError: string | null
  powerOn: () => Promise<void>
  powerOff: () => Promise<void>
  togglePower: () => Promise<void>
}

export function useSystemPower(): UseSystemPowerReturn {
  const powerState = usePowerStore((s) => s.powerState)
  const setPowerState = usePowerStore((s) => s.setPowerState)
  const lastError = usePowerStore((s) => s.lastError)
  const setLastError = usePowerStore((s) => s.setLastError)

  // Computed states
  const isOnline = powerState === 'ONLINE'
  const isOffline = powerState === 'OFFLINE'
  const isStarting = powerState === 'STARTING'

  /**
   * 🚀 POWER ON
   * 
   * Secuencia de arranque:
   * 1. Iniciar SeleneLux (Backend Workers)
   * 2. Iniciar AudioCapture (Frontend)
   * 3. Conectar al Truth Protocol
   */
  const powerOn = useCallback(async () => {
    if (powerState !== 'OFFLINE') {
      console.warn('[SystemPower] Already starting or online')
      return
    }

    console.log('[SystemPower] 🔌 Powering ON...')
    setPowerState('STARTING')
    setLastError(null)

    try {
      // 1. Start backend (Selene LUX)
      if (window.lux?.start) {
        const result = await window.lux.start()
        if (!result?.success && !result?.alreadyRunning) {
          throw new Error('Backend failed to start')
        }
      }

      // 2. Signal to TrinityProvider that we're ready
      // TrinityProvider will handle audio capture when it sees powerState === 'ONLINE'
      
      // 3. Small delay for systems to initialize
      await new Promise(resolve => setTimeout(resolve, 100))

      setPowerState('ONLINE')
      
      // 4. 🔌 WAVE 63.99: NO auto-select mode - Wait for user input
      // globalMode permanece null = "Ready but Idle"
      // El usuario debe elegir Manual/Flow/Selene manualmente
      
      console.log('[SystemPower] ✅ System ONLINE (awaiting mode selection)')

    } catch (error) {
      console.error('[SystemPower] ❌ Power ON failed:', error)
      setLastError(error instanceof Error ? error.message : 'Unknown error')
      setPowerState('OFFLINE')
    }
  }, [powerState, setPowerState, setLastError])

  /**
   * 🛑 POWER OFF
   * 
   * Secuencia de apagado:
   * 1. Detener AudioCapture
   * 2. Pausar Workers (no matar, solo pausar)
   * 3. Limpiar recursos
   */
  const powerOff = useCallback(async () => {
    if (powerState === 'OFFLINE') {
      console.warn('[SystemPower] Already offline')
      return
    }

    console.log('[SystemPower] 🛑 Powering OFF...')

    try {
      // 1. 🔌 WAVE 63.9: Reset control mode to idle
      useControlStore.getState().setGlobalMode(null)
      
      // 2. Stop backend
      if (window.lux?.stop) {
        await window.lux.stop()
      }

      // 3. Clear any lingering state
      setPowerState('OFFLINE')
      console.log('[SystemPower] 💤 System OFFLINE')

    } catch (error) {
      console.error('[SystemPower] ❌ Power OFF error:', error)
      // Force offline even on error
      useControlStore.getState().setGlobalMode(null)
      setPowerState('OFFLINE')
    }
  }, [powerState, setPowerState])

  /**
   * 🔄 TOGGLE POWER
   */
  const togglePower = useCallback(async () => {
    if (isOnline) {
      await powerOff()
    } else if (isOffline) {
      await powerOn()
    }
    // If STARTING, do nothing
  }, [isOnline, isOffline, powerOn, powerOff])

  return {
    powerState,
    isOnline,
    isOffline,
    isStarting,
    lastError,
    powerOn,
    powerOff,
    togglePower,
  }
}

export default useSystemPower
