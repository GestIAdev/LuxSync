/**
 * 🎨 PALETTE PREVIEW
 * WAVE 14: Real-time color palette visualization
 * WAVE 17.4: SeleneColorEngine debug info integration
 * WAVE 17.5: UI STABILIZATION - Anti-flicker defensive rendering
 * 
 * Shows:
 * - Current palette colors (primary, secondary, accent, ambient, contrast)
 * - Color derivation info (key→hue, mode shift, zodiac pull)
 * - Palette source (memory/procedural/fallback)
 * - SeleneColorEngine metadata (macroGenre, temperature, description)
 */

import React, { useMemo } from 'react'
import { useTelemetryStore, type PaletteTelemetry } from '../../../stores/telemetryStore'
import './PalettePreview.css'

const PalettePreview: React.FC = () => {
  const palette = useTelemetryStore((state) => state.palette)
  const connected = useTelemetryStore((state) => state.connected)
  
  // Default values
  const data: PaletteTelemetry = palette || {
    strategy: 'analogous',
    source: 'procedural',
    colors: {
      primary: { h: 280, s: 70, l: 50, hex: '#a855f7' },
      secondary: { h: 200, s: 70, l: 50, hex: '#0ea5e9' },
      accent: { h: 40, s: 80, l: 60, hex: '#f59e0b' },
      ambient: { h: 280, s: 40, l: 30, hex: '#6b21a8' },
      contrast: { h: 100, s: 60, l: 50, hex: '#84cc16' },
    },
    dnaDerivation: {
      keyToHue: { key: null, hue: 280 },
      modeShift: { mode: 'major', delta: 0 },
      zodiacPull: { element: 'earth', delta: 0 },
      finalHue: 280,
    },
  }

  // WAVE 17.5: STABILIZED VALUES - Evita undefined/null que colapsan el layout
  const stableDebugInfo = useMemo(() => ({
    macroGenre: data.macroGenre || 'ANALYZING',
    temperature: data.temperature || 'neutral',
    description: data.description || 'Waiting for audio analysis...',
    debugKey: data.debugKey || null,
    debugMode: data.debugMode || null,
  }), [data.macroGenre, data.temperature, data.description, data.debugKey, data.debugMode])
  
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'memory': return '🧠'
      case 'procedural': return '🔧'
      case 'fallback': return '⚠️'
      default: return '❓'
    }
  }

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case 'warm': return '🔥'
      case 'cool': return '❄️'
      default: return '⚖️'
    }
  }

  return (
    <div className={`telemetry-panel palette-preview ${connected ? 'connected' : 'disconnected'}`}>
      <div className="panel-header">
        <h3>🎨 PALETTE</h3>
        <span className="palette-source">
          {getSourceIcon(data.source)} {data.source}
        </span>
      </div>
      
      {/* Color Swatches */}
      <div className="color-swatches">
        <div 
          className="color-swatch primary"
          style={{ backgroundColor: data.colors.primary.hex }}
          title={`Primary: ${data.colors.primary.hex}`}
        >
          <span className="swatch-label">P</span>
        </div>
        <div 
          className="color-swatch secondary"
          style={{ backgroundColor: data.colors.secondary.hex }}
          title={`Secondary: ${data.colors.secondary.hex}`}
        >
          <span className="swatch-label">S</span>
        </div>
        <div 
          className="color-swatch accent"
          style={{ backgroundColor: data.colors.accent.hex }}
          title={`Accent: ${data.colors.accent.hex}`}
        >
          <span className="swatch-label">A</span>
        </div>
        <div 
          className="color-swatch ambient"
          style={{ backgroundColor: data.colors.ambient.hex }}
          title={`Ambient: ${data.colors.ambient.hex}`}
        >
          <span className="swatch-label">Am</span>
        </div>
        <div 
          className="color-swatch contrast"
          style={{ backgroundColor: data.colors.contrast.hex }}
          title={`Contrast: ${data.colors.contrast.hex}`}
        >
          <span className="swatch-label">C</span>
        </div>
      </div>
      
      {/* Primary Color Details */}
      <div className="primary-details">
        <span className="detail-label">Primary</span>
        <div className="hsl-values">
          <span className="hsl-value">
            H: <strong>{Math.round(data.colors.primary.h)}°</strong>
          </span>
          <span className="hsl-value">
            S: <strong>{Math.round(data.colors.primary.s)}%</strong>
          </span>
          <span className="hsl-value">
            L: <strong>{Math.round(data.colors.primary.l)}%</strong>
          </span>
        </div>
        <span className="hex-value">{data.colors.primary.hex}</span>
      </div>
      
      {/* DNA Derivation */}
      <div className="derivation-section">
        <span className="section-title">DNA Derivation</span>
        <div className="derivation-flow">
          <div className="derivation-step">
            <span className="step-label">Key</span>
            <span className="step-value">
              {data.dnaDerivation.keyToHue.key || '—'} → {data.dnaDerivation.keyToHue.hue}°
            </span>
          </div>
          <span className="flow-arrow">→</span>
          <div className="derivation-step">
            <span className="step-label">Mode</span>
            <span className="step-value">
              {data.dnaDerivation.modeShift.delta >= 0 ? '+' : ''}{data.dnaDerivation.modeShift.delta}°
            </span>
          </div>
          <span className="flow-arrow">→</span>
          <div className="derivation-step">
            <span className="step-label">Final</span>
            <span className="step-value highlight">
              {data.dnaDerivation.finalHue}°
            </span>
          </div>
        </div>
      </div>
      
      {/* Strategy */}
      <div className="strategy-badge">
        <span className="strategy-label">Strategy:</span>
        <span className="strategy-value">{data.strategy}</span>
      </div>

      {/* WAVE 17.4/17.5: SeleneColorEngine Debug Info - ALWAYS RENDERED (Anti-Flicker) */}
      <div className="selene-engine-section">
        <span className="section-title">🌙 Selene Engine</span>
        
        {/* Macro Genre Badge - ALWAYS visible con placeholder */}
        <div className="macro-genre-badge">
          <span className="genre-icon">🎵</span>
          <span className={`genre-value ${stableDebugInfo.macroGenre === 'ANALYZING' ? 'genre-placeholder' : ''}`}>
            {stableDebugInfo.macroGenre.replace(/_/g, ' ')}
          </span>
        </div>
        
        {/* Temperature Indicator - ALWAYS visible con neutral por defecto */}
        <div className="temperature-indicator">
          <span className="temp-icon">
            {getTemperatureIcon(stableDebugInfo.temperature)}
          </span>
          <span className={`temp-value ${stableDebugInfo.temperature === 'neutral' ? 'temp-placeholder' : ''}`}>
            {stableDebugInfo.temperature.toUpperCase()}
          </span>
        </div>
        
        {/* Key/Mode Debug Info - Renderiza espacio incluso si está vacío */}
        <div className="key-mode-info">
          {stableDebugInfo.debugKey ? (
            <span className="debug-key">🎹 {stableDebugInfo.debugKey}</span>
          ) : (
            <span className="debug-key debug-placeholder">🎹 —</span>
          )}
          {stableDebugInfo.debugMode ? (
            <span className="debug-mode">{stableDebugInfo.debugMode}</span>
          ) : (
            <span className="debug-mode debug-placeholder">—</span>
          )}
        </div>
        
        {/* Description Tooltip - ALWAYS visible */}
        <div className="description-tooltip">
          <span className={`description-text ${stableDebugInfo.description === 'Waiting for audio analysis...' ? 'description-placeholder' : ''}`}>
            {stableDebugInfo.description}
          </span>
        </div>
      </div>
    </div>
  )
}

export default PalettePreview
