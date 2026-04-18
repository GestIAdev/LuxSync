/**
 * 🔴 BLACKOUT OVERLAY - Full Screen Blackout
 * WAVE 9: Overlay visual cuando blackout está activo
 * WAVE 3304: Absolute setter — siempre envía setBlackout(false) para liberar
 */

import React, { useCallback } from 'react'
import { useEffectsStore } from '../../stores/effectsStore'
import './BlackoutOverlay.css'

const BlackoutOverlay: React.FC = () => {
  const setBlackout = useEffectsStore(state => state.setBlackout)

  // 🔴 WAVE 3304: Release absoluto — siempre false, sin toggle
  const handleRelease = useCallback(() => {
    window.lux?.arbiter?.setBlackout(false)
      .then((result: { success?: boolean; blackoutActive?: boolean }) => {
        if (result?.success) {
          setBlackout(result.blackoutActive ?? false)
          console.log('[BlackoutOverlay] 🔴 Blackout released via overlay click')
        } else {
          console.error('[BlackoutOverlay] setBlackout(false) failed:', result)
        }
      })
      .catch((err: unknown) => {
        console.error('[BlackoutOverlay] IPC error:', err)
      })
  }, [setBlackout])

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
