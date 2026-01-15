/**
 * 🎨 COLOR SECTION - WAVE 430
 * Color control for selected fixtures with LIVING PALETTES
 * 
 * Features:
 * - COLLAPSIBLE section header
 * - RGB Slider controls
 * - Living Palettes: 🔥 FUEGO, ❄️ HIELO, 🌴 SELVA, ⚡ NEON
 * - Release button (↺) to return control to AI
 * - Orange glow when manual override active
 */

import React, { useCallback, useState } from 'react'
import { ColorIcon } from '../icons/LuxIcons'

export interface ColorSectionProps {
  color: { r: number; g: number; b: number }
  hasOverride: boolean
  isExpanded: boolean
  onToggle: () => void
  onChange: (r: number, g: number, b: number) => void
  onRelease: () => void
}

/**
 * 🎨 LIVING PALETTES - Static representative colors
 * These capture the "essence" of each palette for immediate visual feedback
 */
const LIVING_PALETTES = [
  { 
    id: 'fuego', 
    label: '🔥 FUEGO', 
    color: { r: 255, g: 60, b: 0 },      // Deep orange-red
    description: 'Warm fire tones'
  },
  { 
    id: 'hielo', 
    label: '❄️ HIELO', 
    color: { r: 100, g: 180, b: 255 },   // Ice blue
    description: 'Cool frozen tones'
  },
  { 
    id: 'selva', 
    label: '🌴 SELVA', 
    color: { r: 50, g: 255, b: 100 },    // Tropical green
    description: 'Lush jungle greens'
  },
  { 
    id: 'neon', 
    label: '⚡ NEON', 
    color: { r: 255, g: 0, b: 255 },     // Hot magenta
    description: 'Electric synthwave'
  },
]

/**
 * Quick color presets (pure colors)
 */
const QUICK_COLORS = [
  { label: 'R', color: { r: 255, g: 0, b: 0 } },
  { label: 'G', color: { r: 0, g: 255, b: 0 } },
  { label: 'B', color: { r: 0, g: 0, b: 255 } },
  { label: 'W', color: { r: 255, g: 255, b: 255 } },
  { label: 'Y', color: { r: 255, g: 255, b: 0 } },
  { label: 'C', color: { r: 0, g: 255, b: 255 } },
  { label: 'M', color: { r: 255, g: 0, b: 255 } },
]

export const ColorSection: React.FC<ColorSectionProps> = ({
  color,
  hasOverride,
  isExpanded,
  onToggle,
  onChange,
  onRelease,
}) => {
  const [activePalette, setActivePalette] = useState<string | null>(null)
  
  // Handle RGB slider change
  const handleRGBChange = useCallback((channel: 'r' | 'g' | 'b', value: number) => {
    const newColor = { ...color, [channel]: value }
    setActivePalette(null) // Clear palette selection when manually adjusting
    onChange(newColor.r, newColor.g, newColor.b)
  }, [color, onChange])
  
  // Handle palette selection
  const handlePaletteClick = useCallback((palette: typeof LIVING_PALETTES[0]) => {
    setActivePalette(palette.id)
    onChange(palette.color.r, palette.color.g, palette.color.b)
  }, [onChange])
  
  // Handle quick color click
  const handleQuickColorClick = useCallback((quickColor: typeof QUICK_COLORS[0]) => {
    setActivePalette(null)
    onChange(quickColor.color.r, quickColor.color.g, quickColor.color.b)
  }, [onChange])
  
  // Release handler
  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setActivePalette(null)
    onRelease()
  }, [onRelease])
  
  // Generate CSS color string for preview
  const previewColor = `rgb(${color.r}, ${color.g}, ${color.b})`
  
  return (
    <div className={`programmer-section color-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <ColorIcon size={18} className="title-icon" />
          COLOR
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button 
              className="release-btn"
              onClick={handleRelease}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <>
          {/* Color Preview */}
          <div className="color-preview-container">
            <div 
              className="color-preview"
              style={{ backgroundColor: previewColor }}
            />
            <div className="color-values">
              <span>R: {color.r}</span>
              <span>G: {color.g}</span>
              <span>B: {color.b}</span>
            </div>
          </div>
          
          {/* LIVING PALETTES */}
          <div className="palettes-section">
            <div className="palettes-label">LIVING PALETTES</div>
            <div className="palettes-grid">
              {LIVING_PALETTES.map(palette => (
                <button
                  key={palette.id}
                  className={`palette-btn ${activePalette === palette.id ? 'active' : ''}`}
                  onClick={() => handlePaletteClick(palette)}
                  style={{
                    '--palette-color': `rgb(${palette.color.r}, ${palette.color.g}, ${palette.color.b})`,
                  } as React.CSSProperties}
                  title={palette.description}
                >
                  <span className="palette-label">{palette.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* RGB Sliders */}
          <div className="rgb-sliders">
            {/* Red */}
            <div className="rgb-slider-row">
              <label className="rgb-label red">R</label>
              <input
                type="range"
                min={0}
                max={255}
                value={color.r}
                onChange={(e) => handleRGBChange('r', Number(e.target.value))}
                className="rgb-slider red"
              />
              <span className="rgb-value">{color.r}</span>
            </div>
            
            {/* Green */}
            <div className="rgb-slider-row">
              <label className="rgb-label green">G</label>
              <input
                type="range"
                min={0}
                max={255}
                value={color.g}
                onChange={(e) => handleRGBChange('g', Number(e.target.value))}
                className="rgb-slider green"
              />
              <span className="rgb-value">{color.g}</span>
            </div>
            
            {/* Blue */}
            <div className="rgb-slider-row">
              <label className="rgb-label blue">B</label>
              <input
                type="range"
                min={0}
                max={255}
                value={color.b}
                onChange={(e) => handleRGBChange('b', Number(e.target.value))}
                className="rgb-slider blue"
              />
              <span className="rgb-value">{color.b}</span>
            </div>
          </div>
          
          {/* Quick Colors */}
          <div className="quick-colors">
            {QUICK_COLORS.map((qc, i) => (
              <button
                key={i}
                className="quick-color-btn"
                onClick={() => handleQuickColorClick(qc)}
                style={{
                  backgroundColor: `rgb(${qc.color.r}, ${qc.color.g}, ${qc.color.b})`,
                }}
                title={qc.label}
              >
                {qc.label}
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

export default ColorSection
