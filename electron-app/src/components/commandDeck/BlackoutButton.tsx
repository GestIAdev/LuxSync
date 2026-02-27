/**
 * 🔴 BLACKOUT BUTTON - WAVE 2073: IPC FIX
 * Emergency kill switch - big, red, isolated
 * Always accessible with SPACE key
 * 
 * WAVE 2073 FIX: Was calling window.lux.setBlackout() → IPC 'lux:set-blackout' (NO HANDLER)
 * Now calls window.lux.arbiter.toggleBlackout() → IPC 'lux:arbiter:toggleBlackout' (CONNECTED)
 * 
 * WAVE 2074: Sync store with backend response + rollback on failure
 */

import React, { useCallback } from 'react'
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
    // 🔧 WAVE 2074: Rollback on failure — no more phantom overlays
    try {
      const result = await window.lux?.arbiter?.toggleBlackout()
      if (result?.success) {
        console.log(`[BlackoutButton] 🔴 Blackout: ${result.active ? 'ON' : 'OFF'}`)
      } else {
        console.error('[BlackoutButton] toggleBlackout returned no success:', result)
        // Rollback: undo the optimistic toggle
        toggleBlackout()
      }
    } catch (err) {
      console.error('[BlackoutButton] Blackout IPC error:', err)
      // Rollback on error
      toggleBlackout()
    }
  }, [toggleBlackout])
  
  // ⚡ WAVE 2074: SPACE key listener REMOVED from here
  // KeyboardProvider handles SPACE globally with proper IPC — no more duplicate listeners
  
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
