/**
 * 🎛️ THE COMMAND DECK - WAVE 2073.1: THE DECOUPLING (ARM vs GO)
 * Bottom control bar for live performance - "THE FLIGHT STICK"
 * 
 * Layout (WAVE 1131 - Command Deck Reforged):
 * [ INTELLIGENCE ] [ VIBES_MOOD ] [ GRAND_MASTER ] [ TRIGGERS ]
 * 
 * ⚛️ WAVE 2073.1: ARM and GO are now DECOUPLED:
 * - ARM button: Starts/stops the TitanEngine tick loop (the brain)
 * - GO button: Opens/closes the DMX output gate (the valve)
 * 
 * DJ workflow: ARM first (engine thinks) → GO when ready (DMX flows)
 */

import React, { useCallback, useEffect, useState } from 'react'
import { ReactorIcon, BrainNeuralIcon, BoltIcon } from '../icons/LuxIcons'
import { useEffectsStore, selectBlackout } from '../../stores/effectsStore'
import { useControlStore, selectAIEnabled, selectOutputEnabled, selectSystemArmed } from '../../stores/controlStore'
import { useSystemPower } from '../../hooks/useSystemPower'
import { GrandMasterSlider } from './GrandMasterSlider'
import { GrandMasterSpeedSlider } from './GrandMasterSpeedSlider'
import { VibeSelectorCompact } from './VibeSelectorCompact'
import { MoodToggle } from './MoodToggle'
import { BlackoutButton } from './BlackoutButton'
import './CommandDeck.css'

export const CommandDeck: React.FC = () => {
  // 🛡️ WAVE 2042.13.8: Primitive selector (stable)
  const blackout = useEffectsStore(selectBlackout)
  const setBlackout = useEffectsStore(state => state.setBlackout)
  
  // 🧬 WAVE 500: Kill Switch - Consciencia ON/OFF
  const aiEnabled = useControlStore(selectAIEnabled)
  const toggleAI = useControlStore(state => state.toggleAI)
  
  // ⚛️ WAVE 2073.1: System ARM state (the reactor)
  const systemArmed = useControlStore(selectSystemArmed)
  const setSystemArmed = useControlStore(state => state.setSystemArmed)
  const { powerState, togglePower } = useSystemPower()
  
  // 🚦 WAVE 1132: Output Gate from store (synced with backend)
  const outputEnabled = useControlStore(selectOutputEnabled)
  const setOutputEnabled = useControlStore(state => state.setOutputEnabled)
  
  // Arbiter status state
  const [arbiterStatus, setArbiterStatus] = useState<{
    grandMaster: number
    grandMasterSpeed: number
  }>({
    grandMaster: 1.0,
    grandMasterSpeed: 1.0
  })
  
  // Subscribe to arbiter status changes
  useEffect(() => {
    // ⚛️ WAVE 2073.1: Sync systemArmed with powerState from usePowerStore
    // If the system was powered on externally (eg. from another component), update our store
    const isArmed = powerState === 'ONLINE'
    if (systemArmed !== isArmed) {
      setSystemArmed(isArmed)
    }
  }, [powerState, systemArmed, setSystemArmed])
  
  useEffect(() => {
    // WAVE 4656: Hydration desde Aether (sin status legacy del arbiter clásico).
    const fetchStatus = async () => {
      try {
        const response = await window.lux?.aether?.getControlState?.()
        if (response) {
          const rawGM = response.grandMaster ?? 1.0
          const safeGM = rawGM > 1 ? rawGM / 255 : rawGM
          
          setArbiterStatus(prev => ({
            grandMaster: Math.max(0, Math.min(1, safeGM)),
            grandMasterSpeed: prev.grandMasterSpeed,
          }))
          
          const backendOutputEnabled = response.outputEnabled ?? false
          const backendBlackout = response.blackoutActive ?? false
          setOutputEnabled(backendOutputEnabled)
          setBlackout(backendBlackout)
        }
      } catch (err) {
        // Silent fail - aether might not be ready
      }
    }
    
    fetchStatus()
    
    const interval = setInterval(fetchStatus, 250)
    
    return () => {
      clearInterval(interval)
    }
  }, [setBlackout, setOutputEnabled])
  
  // Grand Master change handler
  const handleGrandMasterChange = useCallback(async (value: number) => {
    try {
      // WAVE 4652: Ruta Aether — NodeArbiter + masterArbiter en paralelo
      await window.lux?.aether?.setGrandMaster(value)
      setArbiterStatus(prev => ({ ...prev, grandMaster: value }))
    } catch (err) {
      console.error('[CommandDeck] Grand Master error:', err)
    }
  }, [])
  
  // 🎚️ WAVE 2472: Grand Master Speed handler (AI only)
  const handleGrandMasterSpeedChange = useCallback(async (value: number) => {
    try {
      // WAVE 4652: Ruta Aether
      await window.lux?.aether?.setGrandMasterSpeed(value)
      setArbiterStatus(prev => ({ ...prev, grandMasterSpeed: value }))
    } catch (err) {
      console.error('[CommandDeck] Grand Master Speed error:', err)
    }
  }, [])
  
  // 🧬 Consciousness toggle handler
  const handleConsciousnessToggle = useCallback(async () => {
    const newState = !aiEnabled
    toggleAI()
    
    // Propagar al backend (TitanEngine → Selene V2)
    try {
      await window.lux?.setConsciousnessEnabled?.(newState)
      console.log(`[CommandDeck] 🧬 Consciousness ${newState ? 'ENABLED ✅' : 'DISABLED ⏸️'}`)
    } catch (err) {
      console.error('[CommandDeck] Failed to sync consciousness state:', err)
    }
  }, [aiEnabled, toggleAI])

  // ⚛️ WAVE 2073.1: ARM toggle handler - THE REACTOR SWITCH
  // Starts/stops the TitanEngine tick loop via useSystemPower
  // This is the BRAIN — it thinks, calculates physics, listens to audio
  // But does NOT send DMX until GO is pressed
  const handleArmToggle = useCallback(async () => {
    try {
      await togglePower()
      // Sync local store after power toggle completes
      const willBeArmed = powerState === 'OFFLINE'
      setSystemArmed(willBeArmed)
      console.log(`[CommandDeck] ⚛️ System ${willBeArmed ? '🟢 ARMED (engine running)' : '� COLD (engine stopped)'}`)
      
      // If disarming, also close the DMX gate (safety)
      if (!willBeArmed && outputEnabled) {
        try {
          await window.lux?.aether?.setOutputEnabled(false)
          setOutputEnabled(false)
          console.log('[CommandDeck] ⚛️ Safety: DMX gate closed on disarm')
        } catch (e) {
          // Best effort
        }
      }
    } catch (err) {
      console.error('[CommandDeck] ARM toggle error:', err)
    }
  }, [togglePower, powerState, setSystemArmed, outputEnabled, setOutputEnabled])

  // �🚦 WAVE 1132: Output GO toggle handler - THE DMX GATE
  // Opens/closes the DMX output valve via MasterArbiter
  // This is the VALVE — it lets the calculated light flow to physical fixtures
  const handleOutputToggle = useCallback(async () => {
    const newState = !outputEnabled
    
    try {
      const result = await window.lux?.aether?.setOutputEnabled(newState)
      
      if (result?.success) {
        // Update local store to match backend
        setOutputEnabled(result.outputEnabled ?? newState)
        console.log(`[CommandDeck] 🚦 DMX Gate ${newState ? '🟢 OPEN' : '🔴 CLOSED'} - DMX ${newState ? 'flowing' : 'blocked'}`)
      } else {
        console.error('[CommandDeck] Failed to set output enabled:', result)
      }
    } catch (err) {
      console.error('[CommandDeck] Output toggle error:', err)
      // Fallback: at least update local state
      setOutputEnabled(newState)
    }
  }, [outputEnabled, setOutputEnabled])

  return (
    <footer className={`command-deck command-deck-reforged ${blackout ? 'blackout-active' : ''}`}>
      {/* ═══════════════════════════════════════════════════════════════════
       * ZONE 1: INTELLIGENCE - Mode Toggle (Tech Badge)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-zone zone-intelligence">
        <button
          className={`intelligence-badge arm-badge ${systemArmed ? 'armed' : 'disarmed'}`}
          onClick={handleArmToggle}
          disabled={powerState === 'STARTING'}
          title={systemArmed 
            ? 'ENGINE RUNNING — Click to shut down' 
            : 'ENGINE OFF — Click to start TitanEngine'}
        >
          <ReactorIcon size={28} className="intel-icon" />
          <span className="intel-label">{systemArmed ? 'LIVE' : 'ARM'}</span>
        </button>
        <button
          className={`intelligence-badge ${aiEnabled ? 'conscious' : 'reactive'}`}
          onClick={handleConsciousnessToggle}
          title={aiEnabled ? 'CONSCIOUS: AI-driven lighting' : 'REACTIVE: Physics-only mode'}
        >
          {aiEnabled ? (
            <BrainNeuralIcon size={28} className="intel-icon" />
          ) : (
            <BoltIcon size={28} className="intel-icon" />
          )}
          <span className="intel-label">{aiEnabled ? 'AI' : 'RX'}</span>
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * ZONE 2: VIBES + MOOD (Compressed)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-zone zone-vibes-mood">
        <VibeSelectorCompact />
        <div className="zone-divider" />
        <MoodToggle />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * ZONE 3: GRAND MASTERS (INTENSITY + SPEED)
       * ═══════════════════════════════════════════════════════════════ */}
      <div className="deck-zone zone-grandmaster">
        <GrandMasterSlider 
          value={arbiterStatus.grandMaster}
          onChange={handleGrandMasterChange}
        />
        <GrandMasterSpeedSlider
          value={arbiterStatus.grandMasterSpeed}
          onChange={handleGrandMasterSpeedChange}
        />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * ZONE 4: TRIGGERS - BLACKOUT + GO (The Gate) - WAVE 1131.2 Swap
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-zone zone-triggers">
        <BlackoutButton />
        
        <button
          className={`trigger-sq trigger-go ${outputEnabled ? 'active' : ''}`}
          onClick={handleOutputToggle}
          title={outputEnabled ? 'Output ENABLED - Click to pause' : 'Output PAUSED - Click to go live'}
        >
          <ReactorIcon size={28} className="trigger-icon" />
          <span className="trigger-label">GO</span>
        </button>
      </div>
    </footer>
  )
}

export default CommandDeck
