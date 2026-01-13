/**
 * 💡 INTENSITY SECTION - WAVE 375.3
 * Dimmer control for selected fixtures
 * 
 * Features:
 * - Slider 0-100%
 * - Quick buttons: 0%, 25%, 50%, 75%, 100%
 * - Release button (↺) to return control to AI
 * - Orange glow when manual override active
 */

import React, { useCallback } from 'react'

export interface IntensitySectionProps {
  value: number          // 0-100
  hasOverride: boolean   // Is dimmer under manual control?
  onChange: (value: number) => void
  onRelease: () => void
}

// Quick presets
const PRESETS = [
  { label: '0%', value: 0 },
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
]

export const IntensitySection: React.FC<IntensitySectionProps> = ({
  value,
  hasOverride,
  onChange,
  onRelease,
}) => {
  
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }, [onChange])
  
  const handlePresetClick = useCallback((presetValue: number) => {
    onChange(presetValue)
  }, [onChange])
  
  return (
    <div className={`programmer-section intensity-section ${hasOverride ? 'has-override' : ''}`}>
      <div className="section-header">
        <h4 className="section-title">
          <span className="section-icon">💡</span>
          INTENSITY
        </h4>
        {hasOverride && (
          <button 
            className="release-btn"
            onClick={onRelease}
            title="Release to AI control"
          >
            ↺
          </button>
        )}
      </div>
      
      {/* Main Slider */}
      <div className="intensity-slider-container">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={handleSliderChange}
          className="intensity-slider"
        />
        <div className="intensity-value">{Math.round(value)}%</div>
      </div>
      
      {/* Fill indicator */}
      <div className="intensity-bar">
        <div 
          className="intensity-fill"
          style={{ width: `${value}%` }}
        />
      </div>
      
      {/* Quick Presets */}
      <div className="intensity-presets">
        {PRESETS.map(preset => (
          <button
            key={preset.value}
            className={`preset-btn ${value === preset.value ? 'active' : ''}`}
            onClick={() => handlePresetClick(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      
      {/* Override indicator */}
      {hasOverride && (
        <div className="override-badge">MANUAL</div>
      )}
    </div>
  )
}

export default IntensitySection
