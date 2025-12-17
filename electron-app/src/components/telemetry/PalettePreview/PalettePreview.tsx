import React from 'react'
import { useTruthPalette, useTruthMusicalDNA, useTruthCognitive, useTruthConnected } from '../../../hooks'
import './PalettePreview.css'

const PalettePreview: React.FC = () => {
  const palette = useTruthPalette()
  const dna = useTruthMusicalDNA()
  const cognitive = useTruthCognitive()
  const connected = useTruthConnected()

  const currentPalette = {
    primary: palette?.primary?.hex || '#ff0055',
    secondary: palette?.secondary?.hex || '#ff5500',
    accent: palette?.accent?.hex || '#00f3ff',
    ambient: palette?.ambient?.hex || '#220033',
    contrast: palette?.contrast?.hex || '#ffffff'
  }
  
  const primaryH = palette?.primary?.h ? Math.round(palette.primary.h) : 345
  const primaryS = palette?.primary?.s ? Math.round(palette.primary.s) : 80
  const primaryL = palette?.primary?.l ? Math.round(palette.primary.l) : 50

  const strategy = palette?.strategy || 'analogous'
  const origin = palette?.source || 'procedural'
  
  const derivation = {
    key: dna?.key || '---',
    mood: cognitive?.mood || 'Neutral',
    finalHue: primaryH
  }

  return (
    <div className={`palette-panel-container ${connected ? 'online' : 'offline'}`}>
      
      {/* HEADER */}
      <div className="palette-header">
        <div className="palette-title">
          <span className="icon">🎨</span>
          <span>CHROMATIC CORE</span>
        </div>
        <div className={`origin-badge ${origin}`}>
          <span className="origin-dot" />
          {origin.toUpperCase()}
        </div>
      </div>

      {/* STRATEGY */}
      <div className="strategy-display">
        <div className="strategy-info">
          <div className="strategy-label">COLOR STRATEGY</div>
          <div className="strategy-value">{strategy.toUpperCase()}</div>
        </div>
        <div className="strategy-graph">
          <div className="color-wheel-mini" style={{borderColor: `${currentPalette.primary}40`}}>
            <div className="spoke primary" style={{background: currentPalette.primary, transform: 'rotate(0deg)'}} />
            <div className="spoke secondary" style={{background: currentPalette.secondary, transform: 'rotate(30deg)'}} />
            <div className="spoke accent" style={{background: currentPalette.accent, transform: 'rotate(180deg)'}} />
          </div>
        </div>
      </div>

      {/* MAIN REACTOR (SWATCHES + DATA INTEGRATED) */}
      <div className="swatch-rack">
        
        {/* 1. PRIMARY FUEL ROD */}
        <SwatchSlot role="PRI" color={currentPalette.primary} label="PRIMARY" large />
        
        {/* 2. TECHNICAL READOUT (MOVED HERE TO FILL GAP) */}
        <div className="tech-readout integrated">
          <div className="readout-col main">
            <span className="label">HEX CODE</span>
            <span className="value hex" style={{color: currentPalette.primary}}>
              {currentPalette.primary.toUpperCase()}
            </span>
          </div>
          <div className="readout-divider" />
          <div className="readout-col">
            <span className="label">HUE</span>
            <span className="value">{primaryH}°</span>
          </div>
          <div className="readout-col">
            <span className="label">SAT</span>
            <span className="value">{primaryS}%</span>
          </div>
          <div className="readout-col">
            <span className="label">LUM</span>
            <span className="value">{primaryL}%</span>
          </div>
        </div>

        {/* 3. SECONDARY RODS */}
        <div className="sub-swatches">
          <div className="sub-row">
            <SwatchSlot role="SEC" color={currentPalette.secondary} label="SECONDARY" />
            <SwatchSlot role="ACC" color={currentPalette.accent} label="ACCENT" />
          </div>
          <div className="sub-row">
            <SwatchSlot role="AMB" color={currentPalette.ambient} label="AMBIENT" />
            <SwatchSlot role="CON" color={currentPalette.contrast} label="CONTRAST" />
          </div>
        </div>
      </div>

      {/* DERIVATION LOGIC */}
      <div className="derivation-logic">
        <div className="logic-header">DERIVATION PATH</div>
        <div className="logic-chain">
          <div className="chain-node">
            <span className="node-label">KEY</span>
            <span className="node-val">{derivation.key.replace(/Major|Minor/, '').trim()}</span>
          </div>
          <div className="chain-operator">+</div>
          <div className="chain-node">
            <span className="node-label">MOOD</span>
            <span className="node-val mood">{derivation.mood}</span>
          </div>
          <div className="chain-arrow">→</div>
          <div className="chain-node final">
            <span className="node-label">HUE</span>
            <span className="node-val" style={{color: currentPalette.primary}}>
              {derivation.finalHue}°
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}

interface SwatchProps { role: string, color: string, label: string, large?: boolean }

const SwatchSlot: React.FC<SwatchProps> = ({ role, color, label, large }) => (
  <div className={`swatch-slot ${large ? 'large' : ''}`}>
    <div 
      className="swatch-color" 
      style={{ 
        background: color, 
        boxShadow: `0 0 15px ${color}60`
      }}
    >
      <span className="role-tag">{role}</span>
    </div>
    <div className="swatch-meta">
      <span className="swatch-label">{label}</span>
    </div>
  </div>
)

export default PalettePreview
