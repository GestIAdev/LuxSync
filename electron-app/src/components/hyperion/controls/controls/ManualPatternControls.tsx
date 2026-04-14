/**
 * 🎚️ MANUAL PATTERN CONTROLS — WAVE 2616
 * Desacuplamiento de controles Speed/Amplitude del layout de pads.
 *
 * ANTES: Sliders duplicados inline en PositionSection (formation + sniper)
 *        Desaparecían en modo SPATIAL
 * AHORA: Componente extraído, se renderiza SIEMPRE → pad-agnostic
 *
 * Layout: Vertical slider con ícono arriba y valor abajo
 * Colores: Speed = #ff8c00 (orange), Amplitude = #ff00ff (magenta)
 */

import React from 'react'

export interface VSliderProps {
  track: 'speed' | 'amp'
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  /** 'formation' → 36px / 16px icon, 'sniper' → 32px / 14px icon */
  variant?: 'formation' | 'sniper'
}

/**
 * Slider vertical con ícono SVG + valor numérico.
 * Se coloca a los costados del pad activo.
 */
export const VSlider: React.FC<VSliderProps> = ({
  track,
  value,
  onChange,
  disabled = false,
  variant = 'formation',
}) => {
  const iconSize = variant === 'sniper' ? 14 : 16

  return (
    <div className={`v-slider-track ${track}-track`}>
      <svg className="v-slider-icon" viewBox="0 0 24 24" width={iconSize} height={iconSize}>
        {track === 'speed' ? (
          <path fill="currentColor" d="M13 2v8h4l-5 6-5-6h4V2h2zm-2 16v4h2v-4h-2zm-6-4l1.41-1.41L12 18.17l5.59-5.58L19 14l-7 7-7-7z"/>
        ) : (
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        )}
      </svg>
      <div className="v-slider-wrapper">
        <input
          type="range"
          className="v-slider-input"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
        />
      </div>
      <span className="v-slider-value">{value}</span>
    </div>
  )
}
