/**
 * 🔴 BLACKOUT BUTTON — WAVE 3304: ABSOLUTE SETTER
 * Emergency kill switch - big, red, isolated
 * Always accessible with SPACE key
 * 
 * WAVE 3304 FIX: Replaced toggle-relative logic with absolute setBlackout(true/false).
 * - Reads current store state → sends the opposite explicitly
 * - No optimistic toggle → no rollback needed → no desync possible
 * - Fire-and-forget with .then() → no UI deadlock from await
 * - Backend returns authoritative state → store syncs from truth
 */

import React, { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BlackoutIcon } from '../icons/LuxIcons'
import { useEffectsStore, selectBlackoutButton } from '../../stores/effectsStore'
import './CommandDeck.css'

export const BlackoutButton: React.FC = () => {
  const { blackout, setBlackout } = useEffectsStore(useShallow(selectBlackoutButton))
  
  const handleBlackout = useCallback(() => {
    const targetState = !blackout
    
    // 🔴 WAVE 3304: Absolute setter — sin toggle, sin optimismo, sin deadlock
    window.lux?.arbiter?.setBlackout(targetState)
      .then((result: { success?: boolean; blackoutActive?: boolean }) => {
        if (result?.success) {
          setBlackout(result.blackoutActive ?? targetState)
          console.log(`[BlackoutButton] 🔴 Blackout: ${result.blackoutActive ? 'ON' : 'OFF'}`)
        } else {
          console.error('[BlackoutButton] setBlackout failed:', result)
        }
      })
      .catch((err: unknown) => {
        console.error('[BlackoutButton] Blackout IPC error:', err)
      })
  }, [blackout, setBlackout])
  
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
