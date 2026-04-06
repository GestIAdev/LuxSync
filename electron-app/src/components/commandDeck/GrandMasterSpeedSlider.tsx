/**
 * 🎚️ WAVE 2472: GRANDMASTER SPEED SLIDER
 * Controls AI generative movement speed (×0.1 to ×2.0)
 * Affects ONLY the VibeMovementManager phase flow (Layer 0 / CHOREO)
 * Does NOT touch manual patterns (Layer 2 / MasterArbiter)
 * 
 * Layout: [⚡ICON] [====FAT SLIDER====] [×1.0]
 * - BoltIcon in orange (velocity standard)
 * - Metallic rectangular thumb (same as GrandMasterSlider)
 * - Digital multiplier display on right
 */

import React, { useCallback } from 'react'
import { BoltIcon } from '../icons/LuxIcons'
import './CommandDeck.css'

interface GrandMasterSpeedSliderProps {
  value: number  // 0.1-2.0
  onChange: (value: number) => void
}

export const GrandMasterSpeedSlider: React.FC<GrandMasterSpeedSliderProps> = ({
  value,
  onChange
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value))
  }, [onChange])
  
  // Normalize 0.1-2.0 to 0%-100% for the CSS progress track
  const progressPercent = Math.round(((value - 0.1) / 1.9) * 100)
  const displayValue = `×${value.toFixed(1)}`
  
  return (
    <div className="grand-master-speed">
      <div className="gms-icon-wrapper">
        <BoltIcon size={32} color="#ff8c00" />
      </div>
      
      <div className="gms-slider-container">
        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.1"
          value={value}
          onChange={handleChange}
          className="gms-slider"
          style={{
            '--gms-progress': `${progressPercent}%`
          } as React.CSSProperties}
        />
      </div>
      
      <span className="gms-value-display">{displayValue}</span>
    </div>
  )
}
