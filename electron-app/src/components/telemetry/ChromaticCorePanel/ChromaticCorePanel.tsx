/**
 * 🎨 CHROMATIC CORE PANEL - WAVE 1167
 * 
 * Visualiza la paleta de colores activa con estrategia cromática.
 * 4 swatches: primary, secondary, accent, ambient.
 */

import { memo, useMemo } from 'react'
import { useTruthPaletteThrottled } from '../../../hooks/useSeleneTruth'
import { PaletteChromaticIcon } from '../../icons/LuxIcons'
import type { ColorPalette, HSLColor } from '../../../core/protocol/LightingIntent'
import './ChromaticCorePanel.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PaletteRole {
  key: keyof Omit<ColorPalette, 'strategy'>
  label: string
  shortLabel: string
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PALETTE_ROLES: PaletteRole[] = [
  { key: 'primary', label: 'Primary', shortLabel: 'PRI' },
  { key: 'secondary', label: 'Secondary', shortLabel: 'SEC' },
  { key: 'accent', label: 'Accent', shortLabel: 'ACC' },
  { key: 'ambient', label: 'Ambient', shortLabel: 'AMB' },
]

const STRATEGY_LABELS: Record<string, { label: string; description: string }> = {
  'analogous': { label: 'Analogous', description: 'Colores cercanos en el círculo' },
  'complementary': { label: 'Complementary', description: 'Colores opuestos' },
  'triadic': { label: 'Triadic', description: '120° de separación' },
  'monochromatic': { label: 'Mono', description: 'Variaciones de un hue' },
  'split-complementary': { label: 'Split', description: 'Complemento dividido' },
  'prism': { label: 'Prism', description: 'Arcoíris completo' },
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte HSL (0-1) a CSS hsl() string
 */
function hslToCSS(color: HSLColor): string {
  const h = Math.round(color.h * 360)
  const s = Math.round(color.s * 100)
  const l = Math.round(color.l * 100)
  return `hsl(${h}, ${s}%, ${l}%)`
}

/**
 * Determina si el color es oscuro (para decidir texto claro/oscuro)
 */
function isDarkColor(color: HSLColor): boolean {
  return color.l < 0.5
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface ColorSwatchProps {
  color: HSLColor
  role: PaletteRole
}

const ColorSwatch = memo(({ color, role }: ColorSwatchProps) => {
  const cssColor = useMemo(() => hslToCSS(color), [color])
  const isDark = useMemo(() => isDarkColor(color), [color])
  
  // Valores HSL para display
  const h = Math.round(color.h * 360)
  const s = Math.round(color.s * 100)
  const l = Math.round(color.l * 100)
  
  return (
    <div 
      className={`chromatic-swatch chromatic-swatch--${role.key}`}
      style={{ backgroundColor: cssColor }}
      title={`${role.label}: H${h}° S${s}% L${l}%`}
    >
      <span className={`chromatic-swatch__label ${isDark ? 'chromatic-swatch__label--light' : ''}`}>
        {role.shortLabel}
      </span>
      <span className={`chromatic-swatch__values ${isDark ? 'chromatic-swatch__values--light' : ''}`}>
        {h}°
      </span>
    </div>
  )
})

ColorSwatch.displayName = 'ColorSwatch'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ChromaticCorePanel = memo(() => {
  const palette = useTruthPaletteThrottled()
  
  // Strategy info
  const strategyKey = palette.strategy || 'analogous'
  const strategyInfo = STRATEGY_LABELS[strategyKey] || { label: strategyKey, description: '' }
  
  return (
    <div className="neural-card chromatic-core-panel">
      {/* Header */}
      <div className="neural-card__header">
        <PaletteChromaticIcon size={14} color="var(--cat-color)" />
        <span>CHROMATIC CORE</span>
        <div className="chromatic-strategy-badge">
          {strategyInfo.label}
        </div>
      </div>
      
      {/* Content */}
      <div className="neural-card__content">
        {/* Palette Grid - 2x2 */}
        <div className="chromatic-palette-grid">
          {PALETTE_ROLES.map((role) => (
            <ColorSwatch
              key={role.key}
              color={palette[role.key]}
              role={role}
            />
          ))}
        </div>
        
        {/* Strategy Description */}
        <div className="chromatic-strategy-desc">
          {strategyInfo.description}
        </div>
      </div>
    </div>
  )
})

ChromaticCorePanel.displayName = 'ChromaticCorePanel'
