// ARCHIVO: PalettePreview.tsx
// 🏷️ WAVE 134: THE VIBE CONSOLIDATION - Professional UI
import React from 'react'
import { useTruthPalette, useTruthMusicalDNA, useTruthCognitive, useTruthConnected } from '../../../hooks'
import './PalettePreview.css'

const PalettePreview: React.FC = () => {
  const palette = useTruthPalette()
  const dna = useTruthMusicalDNA()
  const cognitive = useTruthCognitive()
  const connected = useTruthConnected()

  // 🛡️ SAFEGUARDS
  const currentPalette = {
    primary: palette?.primary?.hex || '#222',
    secondary: palette?.secondary?.hex || '#222',
    accent: palette?.accent?.hex || '#222',
    ambient: palette?.ambient?.hex || '#222',
  }

  // 🔥 WAVE 270: Los valores h vienen normalizados (0-1), convertir a grados (0-360)
  // El motor envía h en rango 0-1 para cálculos internos, pero UI muestra grados
  const p_hue = palette?.primary?.h ? Math.round(palette.primary.h * 360) : 0
  const s_hue = palette?.secondary?.h ? Math.round(palette.secondary.h * 360) : 0
  const amb_hue = palette?.ambient?.h ? Math.round(palette.ambient.h * 360) : 0
  const acc_hue = palette?.accent?.h ? Math.round(palette.accent.h * 360) : 0
  
  // Detectores
  const isStrobe = (palette?.accent?.s === 0 && palette?.accent?.l === 100)
  // �️ WAVE 134: Recuperamos la estrategia del payload (strategyLabel es el display name)
  const strategyName = (palette as any)?.strategyLabel || palette?.strategy?.toUpperCase() || 'ADAPTIVE'

  const statusClass = connected ? 'online' : 'offline'

  return (
    <div className={`chromatic-core-panel ${statusClass}`}>
      
      {/* HEADER: TIPO MILITAR */}
      <div className="core-header">
        <div className="core-title">
            <span className="status-dot"></span>
            <span>CHROMA CORE</span>
        </div>
        <span className="meta-tag">{dna?.key || '--'} {Math.round(dna?.rhythm?.bpm || 0)}</span>
      </div>

      {/* STRATEGY DISPLAY (RECUPERADO) */}
      <div className="strategy-display">
        <span className="label">ALGORITHM:</span>
        <span className="value">{strategyName}</span>
      </div>

      {/* COLOR GRID */}
      <div className="swatches-grid">
        <SwatchSlot role="PRIMARY" label="FRONT" hue={p_hue} color={currentPalette.primary} />
        <SwatchSlot role="SECONDARY" label="MOV L" hue={s_hue} color={currentPalette.secondary} />
        <SwatchSlot role="AMBIENT" label="MOV R" hue={amb_hue} color={currentPalette.ambient} />
        <SwatchSlot 
            role="ACCENT" 
            label="BACK" 
            hue={acc_hue} 
            color={currentPalette.accent} 
            isStrobe={isStrobe}
        />
      </div>

      {/* THERMAL / MOOD FOOTER */}
      <div className="core-footer">
         <div className="footer-metric">
            <span className="f-label">MOOD</span>
            <span className="f-value">{dna?.mood?.toUpperCase() || '---'}</span>
         </div>
         <div className="footer-metric">
            <span className="f-label">TEMP</span>
            <span className="f-value">{cognitive?.thermalTemperature ? `${Math.round(cognitive.thermalTemperature)}K` : '---'}</span>
         </div>
      </div>
    </div>
  )
}

interface SwatchSlotProps {
  role: string
  label: string
  hue: number
  color: string
  isStrobe?: boolean
}

const SwatchSlot: React.FC<SwatchSlotProps> = ({ role, label, hue, color, isStrobe }) => (
  <div className="swatch-cell">
    <div className="cell-header">
        <span className="role-id">{role}</span>
        <span className="fixture-id">{label}</span>
    </div>
    <div className="color-preview-box" style={{ background: color }}>
        {isStrobe && <div className="strobe-overlay">⚡</div>}
    </div>
    <div className="cell-footer">
        {isStrobe ? <span className="flash-txt">STROBE</span> : <span className="hue-txt">{hue}°</span>}
    </div>
  </div>
)

export default PalettePreview
