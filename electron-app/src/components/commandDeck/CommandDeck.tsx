/**
 * 🎛️ THE COMMAND DECK - WAVE 375 + WAVE 426
 * Bottom control bar for live performance
 * 
 * Layout (WAVE 426 - Updated priority):
 * [LAYER INDICATOR] | [GRAND MASTER] | [VIBES] | [QUICK ACTIONS] | [STATUS] | [BLACKOUT]
 * 
 * Priority: GrandMaster > Vibes > QuickActions > Status
 * 
 * Height: 140px
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useEffectsStore } from '../../stores/effectsStore'
import { useTruthSensory } from '../../hooks'
import { LayerIndicator } from './LayerIndicator'
import { QuickActions } from './QuickActions'
import { GrandMasterSlider } from './GrandMasterSlider'
import { VibeSelectorCompact } from './VibeSelectorCompact'
import { StatusBar } from './StatusBar'
import { BlackoutButton } from './BlackoutButton'
import './CommandDeck.css'

export const CommandDeck: React.FC = () => {
  const { blackout } = useEffectsStore()
  const sensory = useTruthSensory()
  
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
  
  // Kill All handler (ESC)
  const handleKillAll = useCallback(async () => {
    try {
      await window.lux?.arbiter?.clearAllManual()
      console.log('[CommandDeck] 🔓 All manual overrides released')
    } catch (err) {
      console.error('[CommandDeck] Kill All error:', err)
    }
  }, [])
  
  // Extract sensory data
  const bpm = sensory?.beat?.bpm ?? 0
  const energy = sensory?.audio?.energy ?? 0
  const onBeat = sensory?.beat?.onBeat ?? false

  return (
    <footer className={`command-deck ${blackout ? 'blackout-active' : ''}`}>
      {/* Section 1: Layer Indicator */}
      <div className="deck-section deck-layer">
        <LayerIndicator 
          hasManualOverrides={arbiterStatus.hasManualOverrides}
          onKillAll={handleKillAll}
        />
      </div>
      
      {/* Section 2: Grand Master (Priority #1) */}
      <div className="deck-section deck-grandmaster">
        <GrandMasterSlider 
          value={arbiterStatus.grandMaster}
          onChange={handleGrandMasterChange}
        />
      </div>
      
      {/* Section 3: VIBES (Priority #2) - WAVE 426 */}
      <div className="deck-section deck-vibes">
        <VibeSelectorCompact />
      </div>
      
      {/* Section 4: Quick Actions */}
      <div className="deck-section deck-actions">
        <QuickActions disabled={blackout} />
      </div>
      
      {/* Section 5: Status Bar */}
      <div className="deck-section deck-status">
        <StatusBar 
          bpm={bpm}
          energy={energy}
          onBeat={onBeat}
        />
      </div>
      
      {/* Section 6: Blackout (Isolated - Emergency) */}
      <div className="deck-section deck-emergency">
        <BlackoutButton />
      </div>
    </footer>
  )
}

export default CommandDeck
