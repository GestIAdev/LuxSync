/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 PALETTE CONTROL MINI - WAVE 33.2: Color Migration & Polish
 * Selector compacto de paletas vivas con sliders de saturación/intensidad
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Features:
 * - 4 botones de paleta con gradientes visuales
 * - Slider de saturación global
 * - Slider de intensidad global
 * - Sincronización con controlStore
 * 
 * @module components/views/StageViewDual/sidebar/PaletteControlMini
 * @version 33.2.0
 */

import React, { useCallback } from 'react'
import { 
  useControlStore, 
  LivingPaletteId,
  selectActivePalette,
  selectGlobalSaturation,
  selectGlobalIntensity,
} from '../../../../stores/controlStore'
import './PaletteControlMini.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PaletteControlMiniProps {
  className?: string
}

interface PaletteConfig {
  id: LivingPaletteId
  name: string
  icon: string
  gradient: string
  description: string
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const PALETTES: PaletteConfig[] = [
  {
    id: 'fuego',
    name: 'Fuego',
    icon: '🔥',
    gradient: 'linear-gradient(135deg, #ff4444 0%, #ff8800 50%, #ffcc00 100%)',
    description: 'Latino Heat - Rojos/naranjas cálidos',
  },
  {
    id: 'hielo',
    name: 'Hielo',
    icon: '❄️',
    gradient: 'linear-gradient(135deg, #4488ff 0%, #00ddff 50%, #ff88cc 100%)',
    description: 'Arctic Dreams - Azules con aurora',
  },
  {
    id: 'selva',
    name: 'Selva',
    icon: '🌴',
    gradient: 'linear-gradient(135deg, #00cc66 0%, #00ff88 50%, #ff00ff 100%)',
    description: 'Tropical Storm - Verdes vibrantes',
  },
  {
    id: 'neon',
    name: 'Neon',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, #ff00ff 0%, #00ffff 50%, #00ff00 100%)',
    description: 'Cyberpunk - Ciclo de neón',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PaletteControlMini: React.FC<PaletteControlMiniProps> = ({
  className = '',
}) => {
  // Store state
  const activePalette = useControlStore(selectActivePalette)
  const globalSaturation = useControlStore(selectGlobalSaturation)
  const globalIntensity = useControlStore(selectGlobalIntensity)
  
  // Store actions
  const setPalette = useControlStore(state => state.setPalette)
  const setGlobalSaturation = useControlStore(state => state.setGlobalSaturation)
  const setGlobalIntensity = useControlStore(state => state.setGlobalIntensity)
  
  // Handlers
  const handlePaletteClick = useCallback((id: LivingPaletteId) => {
    setPalette(id)
  }, [setPalette])
  
  const handleSaturationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalSaturation(parseFloat(e.target.value))
  }, [setGlobalSaturation])
  
  const handleIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalIntensity(parseFloat(e.target.value))
  }, [setGlobalIntensity])
  
  return (
    <div className={`palette-control-mini ${className}`}>
      {/* HEADER */}
      <h4 className="palette-title">🎨 Paleta de Color</h4>
      
      {/* PALETTE BUTTONS */}
      <div className="palette-grid">
        {PALETTES.map(palette => (
          <button
            key={palette.id}
            className={`palette-btn ${activePalette === palette.id ? 'active' : ''}`}
            onClick={() => handlePaletteClick(palette.id)}
            title={palette.description}
            style={{ 
              '--palette-gradient': palette.gradient 
            } as React.CSSProperties}
          >
            <span className="palette-icon">{palette.icon}</span>
            <span className="palette-name">{palette.name}</span>
          </button>
        ))}
      </div>
      
      {/* SLIDERS */}
      <div className="palette-sliders">
        {/* Saturation */}
        <div className="slider-row">
          <label className="slider-label">
            <span className="slider-icon">🌈</span>
            Saturación
          </label>
          <div className="slider-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={globalSaturation}
              onChange={handleSaturationChange}
              className="mini-slider saturation-slider"
            />
            <span className="slider-value">{Math.round(globalSaturation * 100)}%</span>
          </div>
        </div>
        
        {/* Intensity */}
        <div className="slider-row">
          <label className="slider-label">
            <span className="slider-icon">💡</span>
            Intensidad
          </label>
          <div className="slider-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={globalIntensity}
              onChange={handleIntensityChange}
              className="mini-slider intensity-slider"
            />
            <span className="slider-value">{Math.round(globalIntensity * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaletteControlMini
