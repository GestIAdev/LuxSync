/**
 * 🎛️ THE COMMAND DECK - WAVE 700.4: THE COCKPIT REDESIGN
 * Bottom control bar for live performance - "THE FLIGHT STICK"
 * 
 * Layout (WAVE 700.4 - Cockpit Redesign):
 * [CONSCIOUSNESS] | [VIBES] | [MOOD TOGGLE] | [BLACKOUT] | [GRAND MASTER]
 * 
 * Moved to StatusBar (top): BPM, Energy, Strike, Debug
 * 
 * Height: 140px
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useEffectsStore } from '../../stores/effectsStore'
import { useControlStore, selectAIEnabled } from '../../stores/controlStore'
import { GrandMasterSlider } from './GrandMasterSlider'
import { VibeSelectorCompact } from './VibeSelectorCompact'
import { MoodToggle } from './MoodToggle'
import { BlackoutButton } from './BlackoutButton'
import './CommandDeck.css'

export const CommandDeck: React.FC = () => {
  const { blackout } = useEffectsStore()
  
  // 🧬 WAVE 500: Kill Switch - Consciencia ON/OFF
  const aiEnabled = useControlStore(selectAIEnabled)
  const toggleAI = useControlStore(state => state.toggleAI)
  
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
    // Initial fetch
    const fetchStatus = async () => {
      try {
        const response = await window.lux?.arbiter?.status()
        if (response) {
          // 🛡️ WAVE 420: Anti-nuke protection
          // grandMaster should be 0-1, but if DMX (0-255) leaks through, normalize it
          const rawGM = (response as any).grandMaster ?? response.status?.grandMaster ?? 1.0
          const safeGM = rawGM > 1 ? rawGM / 255 : rawGM
          
          setArbiterStatus({
            hasManualOverrides: response.status?.hasManualOverrides ?? false,
            grandMaster: Math.max(0, Math.min(1, safeGM))
          })
        }
      } catch (err) {
        // Silent fail - arbiter might not be ready
      }
    }
    
    fetchStatus()
    
    // Subscribe to changes
    const unsubscribe = window.lux?.arbiter?.onStatusChange?.((status) => {
      // 🛡️ WAVE 420: Anti-nuke protection on status updates
      const rawGM = status.grandMaster ?? 1.0
      const safeGM = rawGM > 1 ? rawGM / 255 : rawGM
      
      setArbiterStatus({
        hasManualOverrides: status.hasManualOverrides ?? false,
        grandMaster: Math.max(0, Math.min(1, safeGM))
      })
    })
    
    // Fallback: poll if subscription not available
    const interval = !unsubscribe ? setInterval(fetchStatus, 200) : undefined
    
    return () => {
      unsubscribe?.()
      if (interval) clearInterval(interval)
    }
  }, [])
  
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

  return (
    <footer className={`command-deck command-deck-v2 ${blackout ? 'blackout-active' : ''}`}>
      {/* ═══════════════════════════════════════════════════════════════════
       * BLOCK 1: EL CEREBRO - Consciousness Toggle
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-section deck-consciousness">
        <button
          className={`consciousness-btn ${aiEnabled ? 'active' : 'inactive'}`}
          onClick={handleConsciousnessToggle}
          title={aiEnabled ? 'Desactivar Consciencia (Solo Física Reactiva)' : 'Activar Consciencia (Selene V2)'}
        >
          <span 
            className="consciousness-dot" 
            style={{
              backgroundColor: aiEnabled ? '#4ADE80' : '#EF4444',
              boxShadow: aiEnabled ? '0 0 12px #4ADE80' : '0 0 8px #EF4444',
            }} 
          />
          <span className="consciousness-label">
            {aiEnabled ? '🧠 CONSCIOUS' : '⚙️ REACTIVE'}
          </span>
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * BLOCK 2: EL CONTEXTO - Vibe Selector (Compact)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-section deck-vibes">
        <VibeSelectorCompact />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * BLOCK 3: LA ACTITUD - Mood Toggle [NUEVO WAVE 700.4]
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-section deck-mood">
        <MoodToggle />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * BLOCK 4: EMERGENCIA - Blackout
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-section deck-emergency">
        <BlackoutButton />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * BLOCK 5: MASTER - Grand Master Slider
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="deck-section deck-grandmaster">
        <GrandMasterSlider 
          value={arbiterStatus.grandMaster}
          onChange={handleGrandMasterChange}
        />
      </div>
    </footer>
  )
}

export default CommandDeck
