/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 COLOR PICKER - WAVE 30.1: Stage Command & Dashboard
 * Selector de color HSL con preview
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useMemo } from 'react'
import './controls.css'

export interface ColorPickerProps {
  h: number  // 0-360
  s: number  // 0-100
  l: number  // 0-100
  onChange: (h: number, s: number, l: number) => void
  disabled?: boolean
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  h,
  s,
  l,
  onChange,
  disabled = false,
}) => {
  // Calcular color actual para preview
  const currentColor = useMemo(() => {
    return `hsl(${h}, ${s}%, ${l}%)`
  }, [h, s, l])
  
  // Handlers
  const handleHueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value), s, l)
  }, [s, l, onChange])
  
  const handleSatChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(h, Number(e.target.value), l)
  }, [h, l, onChange])
  
  const handleLightChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(h, s, Number(e.target.value))
  }, [h, s, onChange])
  
  // Presets de colores comunes
  const presets = [
    { label: 'R', h: 0, s: 100, l: 50 },
    { label: 'O', h: 30, s: 100, l: 50 },
    { label: 'Y', h: 60, s: 100, l: 50 },
    { label: 'G', h: 120, s: 100, l: 50 },
    { label: 'C', h: 180, s: 100, l: 50 },
    { label: 'B', h: 240, s: 100, l: 50 },
    { label: 'M', h: 300, s: 100, l: 50 },
    { label: 'W', h: 0, s: 0, l: 100 },
  ]
  
  return (
    <div className={`color-picker ${disabled ? 'disabled' : ''}`}>
      {/* COLOR PREVIEW */}
      <div 
        className="color-preview"
        style={{ backgroundColor: currentColor }}
      />
      
      {/* PRESETS */}
      <div className="color-presets">
        {presets.map(preset => (
          <button
            key={preset.label}
            className="color-preset"
            style={{ backgroundColor: `hsl(${preset.h}, ${preset.s}%, ${preset.l}%)` }}
            onClick={() => onChange(preset.h, preset.s, preset.l)}
            disabled={disabled}
            title={preset.label}
          />
        ))}
      </div>
      
      {/* HUE SLIDER */}
      <div className="slider-row">
        <label>H</label>
        <input
          type="range"
          min="0"
          max="360"
          value={h}
          onChange={handleHueChange}
          disabled={disabled}
          className="hue-slider"
        />
        <span className="value">{h}°</span>
      </div>
      
      {/* SATURATION SLIDER */}
      <div className="slider-row">
        <label>S</label>
        <input
          type="range"
          min="0"
          max="100"
          value={s}
          onChange={handleSatChange}
          disabled={disabled}
          className="sat-slider"
          style={{
            background: `linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`
          }}
        />
        <span className="value">{s}%</span>
      </div>
      
      {/* LIGHTNESS SLIDER */}
      <div className="slider-row">
        <label>L</label>
        <input
          type="range"
          min="0"
          max="100"
          value={l}
          onChange={handleLightChange}
          disabled={disabled}
          className="light-slider"
          style={{
            background: `linear-gradient(to right, #000, hsl(${h}, ${s}%, 50%), #fff)`
          }}
        />
        <span className="value">{l}%</span>
      </div>
    </div>
  )
}

export default ColorPicker
