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
 *
 * WAVE 7594: Fire-and-forget IPC (send, not invoke).
 * - Optimistic update: setBlackout(targetState) BEFORE the send.
 * - selene:truth broadcast (~7Hz) confirms or corrects the state.
 */

import React, { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { BlackoutIcon } from '../icons/LuxIcons'
import { useEffectsStore, selectBlackoutButton } from '../../stores/effectsStore'
import { throttleFn } from '../../utils/throttleIpc'
import './CommandDeck.css'

// 🛡️ WAVE 7594: throttle 25ms — prevents IPC flooding from rapid clicks
const throttledSetBlackout = throttleFn(
  (active: boolean) => {
    window.lux?.aether?.setBlackout?.(active)
  },
)

export const BlackoutButton: React.FC = () => {
  const { blackout, setBlackout } = useEffectsStore(useShallow(selectBlackoutButton))

  const handleBlackout = useCallback(() => {
    const targetState = !blackout
    // Optimistic update — immediate visual feedback
    setBlackout(targetState)
    // Fire-and-forget — no .then(), no .catch()
    throttledSetBlackout(targetState)
    console.log(`[BlackoutButton] 🔴 Blackout: ${targetState ? 'ON' : 'OFF'}`)
  }, [blackout, setBlackout])
  
  return (
    <button
      className={`blackout-master ${blackout ? 'active' : ''}`}
      onClick={handleBlackout}
      onMouseDown={(e) => e.preventDefault()}
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
