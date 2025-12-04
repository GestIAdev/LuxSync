/**
 * 🔴 BLACKOUT OVERLAY - Full Screen Blackout
 * WAVE 9: Overlay visual cuando blackout está activo
 */

import React from 'react'
import { useEffectsStore } from '../../stores/effectsStore'
import './BlackoutOverlay.css'

const BlackoutOverlay: React.FC = () => {
  const { toggleBlackout } = useEffectsStore()

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
