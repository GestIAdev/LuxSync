/**
 * 🎨 CHROMATIC CORE COMPLETE - WAVE 1193: THE GREAT DIVIDE
 * 
 * Panel cromático expandido con:
 * - Rueda de color visual (gradiente cónico CSS)
 * - Temperatura de color (Kelvin)
 * - Acorde detectado (si disponible)
 * - Harmony Engine settings
 * - Paleta de 4 colores con detalles HSL
 */

import React, { memo, useMemo } from 'react'
import { useTruthPaletteThrottled, useTruthContext } from '../../../hooks/useSeleneTruth'
import { PaletteChromaticIcon } from '../../icons/LuxIcons'
import type { HSLColor } from '../../../core/protocol/LightingIntent'
import './ChromaticCoreComplete.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

interface PaletteRole {
  key: 'primary' | 'secondary' | 'accent' | 'ambient'
  label: string
  shortLabel: string
}

const PALETTE_ROLES: PaletteRole[] = [
  { key: 'primary', label: 'Primary', shortLabel: 'PRI' },
  { key: 'secondary', label: 'Secondary', shortLabel: 'SEC' },
  { key: 'accent', label: 'Accent', shortLabel: 'ACC' },
  { key: 'ambient', label: 'Ambient', shortLabel: 'AMB' },
]

const STRATEGY_INFO: Record<string, { label: string; icon: string; description: string }> = {
  'analogous': { label: 'Analogous', icon: '🌈', description: 'Adjacent colors on the wheel' },
  'complementary': { label: 'Complementary', icon: '⚡', description: 'Opposite colors for contrast' },
  'triadic': { label: 'Triadic', icon: '△', description: '120° equidistant colors' },
  'monochromatic': { label: 'Mono', icon: '◯', description: 'Single hue variations' },
  'split-complementary': { label: 'Split', icon: '⋔', description: 'Split complement for balance' },
  'prism': { label: 'Prism', icon: '💎', description: 'Full spectrum rainbow' },
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function hslToCSS(color: HSLColor): string {
  const h = Math.round(color.h * 360)
  const s = Math.round(color.s * 100)
  const l = Math.round(color.l * 100)
  return `hsl(${h}, ${s}%, ${l}%)`
}

function hslToHex(color: HSLColor): string {
  const h = color.h
  const s = color.s
  const l = color.l
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255)
  const g = Math.round(hue2rgb(p, q, h) * 255)
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255)
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
}

function hueToTemperature(hue: number): number {
  // Approximate color temperature from hue
  // Warm colors (red/orange/yellow): 2000-4000K
  // Neutral (white): 5000-6000K
  // Cool colors (cyan/blue): 7000-10000K
  const h = hue * 360
  
  if (h < 60) return 2000 + (h / 60) * 2000 // Red to Yellow: 2000-4000K
  if (h < 180) return 4000 + ((h - 60) / 120) * 2500 // Yellow to Cyan: 4000-6500K
  if (h < 270) return 6500 + ((h - 180) / 90) * 3500 // Cyan to Blue: 6500-10000K
  return 2000 + ((360 - h) / 90) * 2000 // Blue to Red: back to warm
}

function isDarkColor(color: HSLColor): boolean {
  return color.l < 0.5
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ChromaticCoreComplete: React.FC = memo(() => {
  const palette = useTruthPaletteThrottled()
  const context = useTruthContext()
  
  const strategyKey = palette.strategy || 'analogous'
  const strategyData = STRATEGY_INFO[strategyKey] || STRATEGY_INFO['analogous']
  
  // Primary color details
  const primaryHue = Math.round(palette.primary.h * 360)
  const primarySat = Math.round(palette.primary.s * 100)
  const primaryLight = Math.round(palette.primary.l * 100)
  const primaryHex = useMemo(() => hslToHex(palette.primary), [palette.primary])
  const temperature = useMemo(() => hueToTemperature(palette.primary.h), [palette.primary.h])
  
  // Wheel rotation for indicator
  const wheelRotation = primaryHue
  
  return (
    <div className="titan-card chromatic-core-complete">
      {/* Header */}
      <div className="titan-card__header">
        <div className="titan-card__title">
          <PaletteChromaticIcon size={18} color={hslToCSS(palette.primary)} />
          <span>CHROMATIC CORE</span>
        </div>
        <div className="chromatic-core-complete__strategy-badge">
          <span>{strategyData.icon}</span>
          <span>{strategyData.label}</span>
        </div>
      </div>
      
      {/* Color Wheel Section */}
      <div className="chromatic-core-complete__wheel-section">
        <div className="chromatic-core-complete__wheel">
          {/* Conic gradient wheel */}
          <div className="chromatic-core-complete__wheel-ring" />
          
          {/* Current hue indicator */}
          <div 
            className="chromatic-core-complete__wheel-indicator"
            style={{ transform: `rotate(${wheelRotation}deg)` }}
          >
            <div 
              className="chromatic-core-complete__wheel-dot"
              style={{ backgroundColor: hslToCSS(palette.primary) }}
            />
          </div>
          
          {/* Center display */}
          <div 
            className="chromatic-core-complete__wheel-center"
            style={{ backgroundColor: hslToCSS(palette.primary) }}
          >
            <span className={`chromatic-core-complete__wheel-hex ${isDarkColor(palette.primary) ? 'chromatic-core-complete__wheel-hex--light' : ''}`}>
              {primaryHex}
            </span>
          </div>
        </div>
        
        {/* HSL Values */}
        <div className="chromatic-core-complete__hsl">
          <div className="chromatic-core-complete__hsl-item">
            <span className="chromatic-core-complete__hsl-label">H</span>
            <span className="chromatic-core-complete__hsl-value">{primaryHue}°</span>
          </div>
          <div className="chromatic-core-complete__hsl-item">
            <span className="chromatic-core-complete__hsl-label">S</span>
            <span className="chromatic-core-complete__hsl-value">{primarySat}%</span>
          </div>
          <div className="chromatic-core-complete__hsl-item">
            <span className="chromatic-core-complete__hsl-label">L</span>
            <span className="chromatic-core-complete__hsl-value">{primaryLight}%</span>
          </div>
        </div>
      </div>
      
      {/* Temperature & Key Section */}
      <div className="chromatic-core-complete__info-section">
        <div className="chromatic-core-complete__info-item">
          <span className="chromatic-core-complete__info-label">🌡️ TEMPERATURE</span>
          <span className="chromatic-core-complete__info-value">
            {Math.round(temperature)}K
          </span>
          <span className="chromatic-core-complete__info-desc">
            {temperature < 4000 ? 'Warm' : temperature < 6000 ? 'Neutral' : 'Cool'}
          </span>
        </div>
        
        <div className="chromatic-core-complete__info-item">
          <span className="chromatic-core-complete__info-label">🎹 KEY</span>
          <span className="chromatic-core-complete__info-value">
            {context.key || 'C'} {context.mode === 'minor' ? 'm' : ''}
          </span>
          <span className="chromatic-core-complete__info-desc">
            {context.mode === 'minor' ? 'Minor' : context.mode === 'major' ? 'Major' : 'Detecting...'}
          </span>
        </div>
      </div>
      
      {/* Strategy Description */}
      <div className="chromatic-core-complete__strategy-section">
        <span className="chromatic-core-complete__strategy-desc">
          {strategyData.description}
        </span>
      </div>
      
      {/* Palette Grid */}
      <div className="chromatic-core-complete__palette">
        {PALETTE_ROLES.map((role) => {
          const color = palette[role.key]
          const cssColor = hslToCSS(color)
          const h = Math.round(color.h * 360)
          const isDark = isDarkColor(color)
          
          return (
            <div 
              key={role.key}
              className="chromatic-core-complete__swatch"
              style={{ backgroundColor: cssColor }}
              title={`${role.label}: H${h}° S${Math.round(color.s * 100)}% L${Math.round(color.l * 100)}%`}
            >
              <span className={`chromatic-core-complete__swatch-label ${isDark ? 'chromatic-core-complete__swatch-label--light' : ''}`}>
                {role.shortLabel}
              </span>
              <span className={`chromatic-core-complete__swatch-hue ${isDark ? 'chromatic-core-complete__swatch-hue--light' : ''}`}>
                {h}°
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

ChromaticCoreComplete.displayName = 'ChromaticCoreComplete'

export default ChromaticCoreComplete
