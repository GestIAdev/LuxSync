/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💡 DIMMER SLIDER - WAVE 30.1: Stage Command & Dashboard
 * Control de intensidad con feedback visual
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback } from 'react'
import './controls.css'

export interface DimmerSliderProps {
  value: number  // 0-255
  onChange: (value: number) => void
  label?: string
  disabled?: boolean
}

export const DimmerSlider: React.FC<DimmerSliderProps> = ({
  value,
  onChange,
  label = 'Dimmer',
  disabled = false,
}) => {
  const percentage = Math.round((value / 255) * 100)
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }, [onChange])
  
  // Presets de intensidad
  const presets = [
    { label: 'OFF', value: 0 },
    { label: '25%', value: 64 },
    { label: '50%', value: 128 },
    { label: '75%', value: 191 },
    { label: 'FULL', value: 255 },
  ]
  
  return (
    <div className={`dimmer-slider ${disabled ? 'disabled' : ''}`}>
      <div className="dimmer-header">
        <span className="dimmer-label">{label}</span>
        <span className="dimmer-value">{percentage}%</span>
      </div>
      
      {/* MAIN SLIDER */}
      <div className="dimmer-track">
        <input
          type="range"
          min="0"
          max="255"
          value={value}
          onChange={handleChange}
          disabled={disabled}
        />
        <div 
          className="dimmer-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {/* PRESETS */}
      <div className="dimmer-presets">
        {presets.map(preset => (
          <button
            key={preset.label}
            className={`dimmer-preset ${value === preset.value ? 'active' : ''}`}
            onClick={() => onChange(preset.value)}
            disabled={disabled}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DimmerSlider
