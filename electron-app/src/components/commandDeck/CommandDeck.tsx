/**
 * 🎛️ THE COMMAND DECK - WAVE 1132: COLD START PROTOCOL
 * Bottom control bar for live performance - "THE FLIGHT STICK"
 * 
 * Layout (WAVE 1131 - Command Deck Reforged):
 * [ INTELLIGENCE ] [ VIBES_MOOD ] [ GRAND_MASTER ] [ TRIGGERS ]
 * 
 * Grid: 0.8fr 2fr 3fr 1.5fr (Master is protagonist)
 * 
 * 🚦 WAVE 1132: Output Gate Integration
 * - GO button now connects to MasterArbiter.setOutputEnabled()
 * - System starts in COLD state (output disabled)
 * - User must explicitly click GO to enable DMX output
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Zap, Sparkles, Power } from 'lucide-react'
import { useEffectsStore, selectBlackout } from '../../stores/effectsStore'
import { useControlStore, selectAIEnabled, selectOutputEnabled } from '../../stores/controlStore'
import { GrandMasterSlider } from './GrandMasterSlider'
import { VibeSelectorCompact } from './VibeSelectorCompact'
import { MoodToggle } from './MoodToggle'
import { BlackoutButton } from './BlackoutButton'
import './CommandDeck.css'

export const CommandDeck: React.FC = () => {
  // 🛡️ WAVE 2042.13.8: Primitive selector (stable)
  const blackout = useEffectsStore(selectBlackout)
  
  // 🧬 WAVE 500: Kill Switch - Consciencia ON/OFF
  const aiEnabled = useControlStore(selectAIEnabled)
  const toggleAI = useControlStore(state => state.toggleAI)
  
  // 🚦 WAVE 1132: Output Gate from store (synced with backend)
  const outputEnabled = useControlStore(selectOutputEnabled)
  const setOutputEnabled = useControlStore(state => state.setOutputEnabled)
  
  // Arbiter status state
  const [arbiterStatus, setArbiterStatus] = useState<{
    hasManualOverrides: boolean
    grandMaster: number
  }>({
    hasManualOverrides: false,
    grandMaster: 1.0
  })
  
  // Subscribe to arbiter status changes
  useEffect(() => {
    // Initial fetch - includes outputEnabled state
    const fetchStatus = async () => {
      try {
        const response = await window.lux?.arbiter?.status()
        if (response) {
          // 🛡️ WAVE 420: Anti-nuke protection
          const rawGM = (response as any).grandMaster ?? response.status?.grandMaster ?? 1.0
          const safeGM = rawGM > 1 ? rawGM / 255 : rawGM
          
          setArbiterStatus({
            hasManualOverrides: response.status?.hasManualOverrides ?? false,
            grandMaster: Math.max(0, Math.min(1, safeGM))
          })
          
          // 🚦 WAVE 1132: Sync outputEnabled from backend
          const backendOutputEnabled = response.status?.outputEnabled ?? false
          setOutputEnabled(backendOutputEnabled)
        }
      } catch (err) {
        // Silent fail - arbiter might not be ready
      }
    }
    
    fetchStatus()
    
    // Subscribe to changes
    const unsubscribe = window.lux?.arbiter?.onStatusChange?.((status) => {
      const rawGM = status.grandMaster ?? 1.0
      const safeGM = rawGM > 1 ? rawGM / 255 : rawGM
      
      setArbiterStatus({
        hasManualOverrides: status.hasManualOverrides ?? false,
        grandMaster: Math.max(0, Math.min(1, safeGM))
      })
      
      // 🚦 WAVE 1132: Sync outputEnabled from backend events
      if (status.outputEnabled !== undefined) {
        setOutputEnabled(status.outputEnabled)
      }
    })
    
    // Fallback: poll if subscription not available
    const interval = !unsubscribe ? setInterval(fetchStatus, 200) : undefined
    
    return () => {
      unsubscribe?.()
      if (interval) clearInterval(interval)
    }
  }, [setOutputEnabled])
  
  // Grand Master change handler
  const handleGrandMasterChange = useCallback(async (value: number) => {
    try {
      await window.lux?.arbiter?.setGrandMaster(value)
      setArbiterStatus(prev => ({ ...prev, grandMaster: value }))
    } catch (err) {
      console.error('[CommandDeck] Grand Master error:', err)
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

  // 🚦 WAVE 1132: Output GO toggle handler - THE COLD START GATE
  // Connects to MasterArbiter via IPC
  const handleOutputToggle = useCallback(async () => {
    const newState = !outputEnabled
    
    try {
      // 🚦 Send to backend arbiter
      const result = await window.lux?.arbiter?.setOutputEnabled?.(newState)
      
      if (result?.success) {
        // Update local store to match backend
        setOutputEnabled(newState)
        console.log(`[CommandDeck] 🚦 Output ${newState ? '🟢 LIVE' : '🔴 ARMED'} - DMX ${newState ? 'flowing' : 'blocked'}`)
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
          className={`intelligence-badge ${aiEnabled ? 'conscious' : 'reactive'}`}
          onClick={handleConsciousnessToggle}
          title={aiEnabled ? 'CONSCIOUS: AI-driven lighting' : 'REACTIVE: Physics-only mode'}
        >
          {aiEnabled ? (
            <Sparkles className="intel-icon" />
          ) : (
            <Zap className="intel-icon" />
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
       * ZONE 3: GRAND MASTER (THE PROTAGONIST)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-zone zone-grandmaster">
        <GrandMasterSlider 
          value={arbiterStatus.grandMaster}
          onChange={handleGrandMasterChange}
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
          <Power className="trigger-icon" />
          <span className="trigger-label">GO</span>
        </button>
      </div>
    </footer>
  )
}

export default CommandDeck
