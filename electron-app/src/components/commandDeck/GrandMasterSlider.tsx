/**
 * 🎚️ GRAND MASTER SLIDER - WAVE 375
 * Controls overall light intensity (0-100%)
 * Affects ALL fixtures - AI and Manual
 */

import React, { useCallback } from 'react'
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
      <div className="gm-header">
        <span className="gm-label">GRAND MASTER</span>
        <span className="gm-value">{percentage}%</span>
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
      
      {/* Visual bar underneath */}
      <div className="gm-bar">
        <div 
          className="gm-bar-fill" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
