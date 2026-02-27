/**
 * 🔴 BLACKOUT BUTTON - WAVE 2073: IPC FIX
 * Emergency kill switch - big, red, isolated
 * Always accessible with SPACE key
 * 
 * WAVE 2073 FIX: Was calling window.lux.setBlackout() → IPC 'lux:set-blackout' (NO HANDLER)
 * Now calls window.lux.arbiter.toggleBlackout() → IPC 'lux:arbiter:toggleBlackout' (CONNECTED)
 */

import React, { useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BlackoutIcon } from '../icons/LuxIcons'
import { useEffectsStore, selectBlackoutButton } from '../../stores/effectsStore'
import './CommandDeck.css'

export const BlackoutButton: React.FC = () => {
  // 🛡️ WAVE 2042.13.8: useShallow for stable reference
  const { blackout, toggleBlackout } = useEffectsStore(useShallow(selectBlackoutButton))
  
  const handleBlackout = useCallback(async () => {
    // Toggle local state first (optimistic UI)
    toggleBlackout()
    
    // 🔧 WAVE 2073 FIX: Use arbiter.toggleBlackout (correct IPC channel)
    // OLD (BROKEN): window.lux?.setBlackout(newState) → 'lux:set-blackout' → NO HANDLER
    // NEW (FIXED):  window.lux?.arbiter?.toggleBlackout() → 'lux:arbiter:toggleBlackout' → masterArbiter.toggleBlackout()
    try {
      const result = await window.lux?.arbiter?.toggleBlackout()
      if (result?.success) {
        console.log(`[BlackoutButton] 🔴 Blackout: ${result.active ? 'ON' : 'OFF'}`)
      } else {
        console.error('[BlackoutButton] toggleBlackout returned no success:', result)
      }
    } catch (err) {
      console.error('[BlackoutButton] Blackout IPC error:', err)
    }
  }, [toggleBlackout])
  
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
      <BlackoutIcon size={32} className="blackout-icon" />
      <span className="blackout-text">BLACKOUT</span>
      <span className="blackout-shortcut">SPACE</span>
      
      {/* Danger pulse when active */}
      {blackout && <div className="danger-pulse" />}
    </button>
  )
}
