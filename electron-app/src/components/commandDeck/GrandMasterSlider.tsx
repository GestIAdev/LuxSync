/**
 * 🎚️ GRAND MASTER SLIDER - WAVE 431.5: POLISH
 * Controls overall light intensity (0-100%)
 * Affects ALL fixtures - AI and Manual
 * 
 * Layout: [ICON] [====FAT SLIDER====] [100%]
 * - Custom MasterIntensity icon
 * - Metallic rectangular thumb (22x44px)
 * - Digital value display on right
 */

import React, { useCallback } from 'react'
import { MasterIntensityIcon } from '../icons/LuxIcons'
import './CommandDeck.css'

interface GrandMasterSliderProps {
  value: number  // 0-1
  onChange: (value: number) => void
}

export const GrandMasterSlider: React.FC<GrandMasterSliderProps> = ({
  value,
  onChange
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value))
  }, [onChange])
  
  const percentage = Math.round(value * 100)
  
  return (
    <div className="grand-master">
      <div className="gm-icon-wrapper">
        <MasterIntensityIcon size={32} color="#00ffff" />
      </div>
      
      <div className="gm-slider-container">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={handleChange}
          className="gm-slider"
          style={{
            '--gm-progress': `${percentage}%`
          } as React.CSSProperties}
        />
      </div>
      
      <span className="gm-value-display">{percentage}%</span>
    </div>
  )
}
