/**
 * 🔴 BLACKOUT BUTTON - WAVE 375
 * Emergency kill switch - big, red, isolated
 * Always accessible with SPACE key
 */

import React, { useCallback, useEffect } from 'react'
import { Square } from 'lucide-react'
import { useEffectsStore } from '../../stores/effectsStore'
import './CommandDeck.css'

export const BlackoutButton: React.FC = () => {
  const { blackout, toggleBlackout } = useEffectsStore()
  
  const handleBlackout = useCallback(async () => {
    // Toggle local state
    toggleBlackout()
    
    // Send to backend via arbiter
    try {
      // First try arbiter (WAVE 374)
      const newState = !blackout
      await window.lux?.setBlackout(newState)
      console.log(`[BlackoutButton] 🔴 Blackout: ${newState ? 'ON' : 'OFF'}`)
    } catch (err) {
      console.error('[BlackoutButton] Blackout error:', err)
    }
  }, [blackout, toggleBlackout])
  
  // SPACE key always triggers blackout
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        handleBlackout()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleBlackout])
  
  return (
    <button
      className={`blackout-master ${blackout ? 'active' : ''}`}
      onClick={handleBlackout}
      title="BLACKOUT - All lights off [SPACE]"
    >
      <Square size={32} className="blackout-icon" />
      <span className="blackout-text">BLACKOUT</span>
      <span className="blackout-shortcut">SPACE</span>
      
      {/* Danger pulse when active */}
      {blackout && <div className="danger-pulse" />}
    </button>
  )
}
