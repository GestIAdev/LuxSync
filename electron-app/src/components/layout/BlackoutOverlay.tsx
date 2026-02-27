/**
 * 🔴 BLACKOUT OVERLAY - Full Screen Blackout
 * WAVE 9: Overlay visual cuando blackout está activo
 * WAVE 2074: FIX — onClick now calls the REAL IPC toggle (same as BlackoutButton)
 *   Before: onClick just toggled the store boolean → overlay disappeared but backend stayed in blackout
 *   Now: onClick calls arbiter.toggleBlackout() IPC → backend actually releases blackout → then syncs store
 */

import React, { useCallback } from 'react'
import { useEffectsStore, selectToggleBlackout } from '../../stores/effectsStore'
import './BlackoutOverlay.css'

const BlackoutOverlay: React.FC = () => {
  // 🛡️ WAVE 2042.13.8: Function selector (stable reference)
  const toggleBlackout = useEffectsStore(selectToggleBlackout)

  // ⚡ WAVE 2074: Real blackout release — IPC + store in one action
  const handleRelease = useCallback(async () => {
    // Toggle local state (optimistic UI — overlay disappears immediately)
    toggleBlackout()
    
    // Send the REAL IPC command to the backend arbiter
    try {
      const result = await window.lux?.arbiter?.toggleBlackout()
      if (result?.success) {
        console.log(`[BlackoutOverlay] 🔴 Blackout released via overlay click`)
      } else {
        console.error('[BlackoutOverlay] toggleBlackout IPC failed:', result)
        // Rollback: re-toggle store if backend failed
        toggleBlackout()
      }
    } catch (err) {
      console.error('[BlackoutOverlay] IPC error:', err)
      // Rollback on error
      toggleBlackout()
    }
  }, [toggleBlackout])

  return (
    <div className="blackout-overlay" onClick={handleRelease}>
      <div className="blackout-content">
        <div className="blackout-title">
          ███ BLACKOUT ACTIVE ███
        </div>
        <div className="blackout-hint">
          Press [SPACE] or click to release
        </div>
      </div>
    </div>
  )
}

export default BlackoutOverlay
