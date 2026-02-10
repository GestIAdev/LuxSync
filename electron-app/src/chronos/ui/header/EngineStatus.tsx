/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ ENGINE STATUS - WAVE 2016.5: COMMAND CENTER
 * Panel de control del motor dentro de Chronos
 * 
 * Permite ver y controlar el estado del sistema sin salir del timeline:
 * - REACTOR: Power ON/OFF (TitanEngine)
 * - DATA: DMX Output GO/ARMED (MasterArbiter)
 * - SYNAPSE: AI Consciousness ON/OFF (SeleneTitanConscious)
 * 
 * @module chronos/ui/header/EngineStatus
 * @version WAVE 2016.5
 */

import React, { useCallback, useEffect, useState } from 'react'
import { ReactorIcon, DataStreamIcon, SynapseIcon } from '../../../components/icons/LuxIcons'
import { usePowerStore, type SystemPowerState } from '../../../hooks/useSystemPower'
import { useControlStore, selectAIEnabled, selectOutputEnabled } from '../../../stores/controlStore'
import './EngineStatus.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface StatusButtonProps {
  icon: React.ReactNode
  label: string
  state: 'off' | 'starting' | 'on'
  onClick: () => void
  variant: 'power' | 'data' | 'ai'
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const StatusButton: React.FC<StatusButtonProps> = ({ 
  icon, 
  label, 
  state, 
  onClick, 
  variant 
}) => {
  const stateClass = `status-${state}`
  const variantClass = `variant-${variant}`
  
  return (
    <button
      className={`engine-status-btn ${stateClass} ${variantClass}`}
      onClick={onClick}
      title={`${label}: ${state.toUpperCase()}`}
    >
      <div className="status-icon">
        {icon}
      </div>
      <div className="status-glow" />
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const EngineStatus: React.FC = () => {
  // ─────────────────────────────────────────────────────────────────────────
  // POWER STATE (usePowerStore)
  // ─────────────────────────────────────────────────────────────────────────
  const powerState = usePowerStore(s => s.powerState)
  const setPowerState = usePowerStore(s => s.setPowerState)
  
  const getPowerStatus = (state: SystemPowerState): 'off' | 'starting' | 'on' => {
    switch (state) {
      case 'OFFLINE': return 'off'
      case 'STARTING': return 'starting'
      case 'ONLINE': return 'on'
    }
  }
  
  const handlePowerToggle = useCallback(async () => {
    if (powerState === 'STARTING') return // No interrumpir arranque
    
    if (powerState === 'OFFLINE') {
      setPowerState('STARTING')
      try {
        if (window.lux?.start) {
          const result = await window.lux.start()
          if (result?.success || result?.alreadyRunning) {
            setPowerState('ONLINE')
            console.log('[EngineStatus] ⚡ REACTOR: ONLINE')
          } else {
            setPowerState('OFFLINE')
          }
        } else {
          // Fallback si no hay IPC
          await new Promise(r => setTimeout(r, 500))
          setPowerState('ONLINE')
        }
      } catch (err) {
        console.error('[EngineStatus] Power ON failed:', err)
        setPowerState('OFFLINE')
      }
    } else {
      // Power OFF
      try {
        if (window.lux?.stop) {
          await window.lux.stop()
        }
        setPowerState('OFFLINE')
        console.log('[EngineStatus] ⚡ REACTOR: OFFLINE')
      } catch (err) {
        console.error('[EngineStatus] Power OFF failed:', err)
      }
    }
  }, [powerState, setPowerState])
  
  // ─────────────────────────────────────────────────────────────────────────
  // DMX OUTPUT STATE (controlStore.outputEnabled)
  // ─────────────────────────────────────────────────────────────────────────
  const outputEnabled = useControlStore(selectOutputEnabled)
  const setOutputEnabled = useControlStore(s => s.setOutputEnabled)
  
  const handleDataToggle = useCallback(async () => {
    const newState = !outputEnabled
    
    try {
      const result = await window.lux?.arbiter?.setOutputEnabled?.(newState)
      if (result?.success) {
        setOutputEnabled(newState)
        console.log(`[EngineStatus] 📡 DATA: ${newState ? 'LIVE' : 'ARMED'}`)
      }
    } catch (err) {
      console.error('[EngineStatus] Data toggle failed:', err)
      // Fallback: update local anyway
      setOutputEnabled(newState)
    }
  }, [outputEnabled, setOutputEnabled])
  
  // ─────────────────────────────────────────────────────────────────────────
  // AI CONSCIOUSNESS STATE (controlStore.aiEnabled)
  // ─────────────────────────────────────────────────────────────────────────
  const aiEnabled = useControlStore(selectAIEnabled)
  const toggleAI = useControlStore(s => s.toggleAI)
  
  const handleSynapseToggle = useCallback(async () => {
    const newState = !aiEnabled
    toggleAI()
    
    try {
      await window.lux?.setConsciousnessEnabled?.(newState)
      console.log(`[EngineStatus] 🧠 SYNAPSE: ${newState ? 'ACTIVE' : 'DORMANT'}`)
    } catch (err) {
      console.error('[EngineStatus] Synapse toggle failed:', err)
    }
  }, [aiEnabled, toggleAI])
  
  // ─────────────────────────────────────────────────────────────────────────
  // SYNC WITH BACKEND ON MOUNT
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const syncWithBackend = async () => {
      try {
        // Check if backend is already running
        const status = await window.lux?.arbiter?.status()
        if (status?.status?.outputEnabled !== undefined) {
          setOutputEnabled(status.status.outputEnabled)
        }
        
        // Check power state from arbiter (if arbiter responds, backend is running)
        if (status && powerState === 'OFFLINE') {
          setPowerState('ONLINE')
        }
      } catch {
        // Silent fail - backend might not be ready
      }
    }
    
    syncWithBackend()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  return (
    <div className="engine-status">
      {/* REACTOR - Power */}
      <StatusButton
        icon={<ReactorIcon size={18} />}
        label="Reactor"
        state={getPowerStatus(powerState)}
        onClick={handlePowerToggle}
        variant="power"
      />
      
      {/* DATA - DMX Output */}
      <StatusButton
        icon={<DataStreamIcon size={18} />}
        label="Data"
        state={outputEnabled ? 'on' : 'off'}
        onClick={handleDataToggle}
        variant="data"
      />
      
      {/* SYNAPSE - AI */}
      <StatusButton
        icon={<SynapseIcon size={18} />}
        label="Synapse"
        state={aiEnabled ? 'on' : 'off'}
        onClick={handleSynapseToggle}
        variant="ai"
      />
    </div>
  )
}
