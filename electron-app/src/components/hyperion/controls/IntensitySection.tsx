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
import { IntensityIcon, StrobeIcon } from '../../icons/LuxIcons'

export interface IntensitySectionProps {
  value: number          // 0-100
  hasOverride: boolean   // Is dimmer under manual control?
  strobeValue: number    // 0-100 strobe speed
  hasStrobeOverride: boolean // Is strobe under manual control?
  isExpanded: boolean    // Is section expanded?
  onToggle: () => void   // Toggle expansion
  onChange: (value: number) => void
  onRelease: () => void
  onStrobeChange: (value: number) => void
  onStrobeRelease: () => void
}

// Quick presets
const PRESETS = [
  { label: '0%', value: 0 },
  { label: '25%', value: 25 },
  { label: '50%', value: 50 },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
]

// Strobe presets (Hz-equivalent labels)
const STROBE_PRESETS = [
  { label: 'OFF', value: 0 },
  { label: 'SLOW', value: 25 },
  { label: 'MED', value: 50 },
  { label: 'FAST', value: 75 },
  { label: 'MAX', value: 100 },
]

export const IntensitySection: React.FC<IntensitySectionProps> = ({
  value,
  hasOverride,
  strobeValue,
  hasStrobeOverride,
  isExpanded,
  onToggle,
  onChange,
  onRelease,
  onStrobeChange,
  onStrobeRelease,
}) => {
  
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }, [onChange])
  
  const handlePresetClick = useCallback((presetValue: number) => {
    onChange(presetValue)
  }, [onChange])
  
  const handleStrobeSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onStrobeChange(Number(e.target.value))
  }, [onStrobeChange])
  
  const handleStrobePresetClick = useCallback((presetValue: number) => {
    onStrobeChange(presetValue)
  }, [onStrobeChange])
  
  const hasAnyOverride = hasOverride || hasStrobeOverride
  
  return (
    <div className={`programmer-section intensity-section ${hasAnyOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <IntensityIcon size={18} className="title-icon" />
          INTENSITY
        </h4>
        <div className="header-right">
          {hasAnyOverride && (
            <button 
              className="release-btn"
              onClick={(e) => {
                e.stopPropagation()
                onRelease()
                onStrobeRelease()
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
          {/* Main Dimmer Slider */}
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
          
          {/* ⚡ WAVE 2494: STROBE CONTROL */}
          <div className="strobe-control-section">
            <div className="strobe-header">
              <StrobeIcon size={14} className="strobe-icon" />
              <span className="strobe-label">STROBE</span>
              {hasStrobeOverride && (
                <button
                  className="release-btn release-btn-mini"
                  onClick={onStrobeRelease}
                  title="Release strobe to AI"
                >
                  ↺
                </button>
              )}
            </div>
            
            <div className="intensity-slider-container">
              <input
                type="range"
                min={0}
                max={100}
                value={strobeValue}
                onChange={handleStrobeSliderChange}
                className="intensity-slider strobe-slider"
              />
              <div className="intensity-value">{strobeValue === 0 ? 'OFF' : `${Math.round(strobeValue)}%`}</div>
            </div>
            
            <div className="intensity-presets strobe-presets">
              {STROBE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  className={`preset-btn ${strobeValue === preset.value ? 'active' : ''}`}
                  onClick={() => handleStrobePresetClick(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            {hasStrobeOverride && (
              <div className="override-badge strobe-override">STROBE MANUAL</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default IntensitySection
