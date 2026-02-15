/**
 * 🔴 BLACKOUT OVERLAY - Full Screen Blackout
 * WAVE 9: Overlay visual cuando blackout está activo
 */

import React from 'react'
import { useEffectsStore, selectToggleBlackout } from '../../stores/effectsStore'
import './BlackoutOverlay.css'

const BlackoutOverlay: React.FC = () => {
  // 🛡️ WAVE 2042.13.8: Function selector (stable reference)
  const toggleBlackout = useEffectsStore(selectToggleBlackout)

  return (
    <div className="blackout-overlay" onClick={toggleBlackout}>
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
