/**
 * 💡 INTENSITY SECTION - WAVE 430
 * Dimmer control for selected fixtures
 * 
 * Features:
 * - COLLAPSIBLE section header
 * - Slider 0-100%
 * - Quick buttons: 0%, 25%, 50%, 75%, 100%
 * - Release button (↺) to return control to AI
 * - Orange glow when manual override active
 */

import React, { useCallback } from 'react'

export interface IntensitySectionProps {
  value: number          // 0-100
  hasOverride: boolean   // Is dimmer under manual control?
  isExpanded: boolean    // Is section expanded?
  onToggle: () => void   // Toggle expansion
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
  isExpanded,
  onToggle,
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
    <div className={`programmer-section intensity-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          💡 INTENSITY
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={(e) => {
                e.stopPropagation()
                onRelease()
              }}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <>
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
        </>
      )}
    </div>
  )
}

export default IntensitySection
