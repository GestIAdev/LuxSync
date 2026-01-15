/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕹️ PAN TILT CONTROL - WAVE 30.1: Stage Command & Dashboard
 * Control de movimiento para cabezas móviles
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useRef } from 'react'
import './controls.css'

export interface PanTiltControlProps {
  pan: number   // 0-540 grados
  tilt: number  // 0-270 grados
  onChange: (pan: number, tilt: number) => void
  disabled?: boolean
}

export const PanTiltControl: React.FC<PanTiltControlProps> = ({
  pan,
  tilt,
  onChange,
  disabled = false,
}) => {
  const padRef = useRef<HTMLDivElement>(null)
  
  // Normalizar valores para visualización (0-1)
  const normalizedPan = pan / 540
  const normalizedTilt = tilt / 270
  
  // Handler para el pad XY
  const handlePadClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return
    
    const pad = padRef.current
    if (!pad) return
    
    const rect = pad.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    // Convertir a grados
    const newPan = Math.round(x * 540)
    const newTilt = Math.round(y * 270)
    
    onChange(newPan, newTilt)
  }, [disabled, onChange])
  
  const handlePadDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 || disabled) return
    handlePadClick(e)
  }, [disabled, handlePadClick])
  
  // Handlers para sliders individuales
  const handlePanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value), tilt)
  }, [tilt, onChange])
  
  const handleTiltChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(pan, Number(e.target.value))
  }, [pan, onChange])
  
  // Centrar
  const handleCenter = useCallback(() => {
    onChange(270, 135) // Centro de los rangos
  }, [onChange])
  
  return (
    <div className={`pan-tilt-control ${disabled ? 'disabled' : ''}`}>
      <div className="pan-tilt-header">
        <span className="label">Pan/Tilt</span>
        <button 
          className="center-btn"
          onClick={handleCenter}
          disabled={disabled}
          title="Center"
        >
          ⊙
        </button>
      </div>
      
      {/* XY PAD */}
      <div 
        ref={padRef}
        className="xy-pad"
        onClick={handlePadClick}
        onMouseMove={handlePadDrag}
      >
        <div className="xy-grid" />
        <div 
          className="xy-cursor"
          style={{
            left: `${normalizedPan * 100}%`,
            top: `${normalizedTilt * 100}%`,
          }}
        />
      </div>
      
      {/* VALUES */}
      <div className="pan-tilt-values">
        <div className="value-row">
          <span className="label">Pan</span>
          <input
            type="range"
            min="0"
            max="540"
            value={pan}
            onChange={handlePanChange}
            disabled={disabled}
          />
          <span className="value">{pan}°</span>
        </div>
        
        <div className="value-row">
          <span className="label">Tilt</span>
          <input
            type="range"
            min="0"
            max="270"
            value={tilt}
            onChange={handleTiltChange}
            disabled={disabled}
          />
          <span className="value">{tilt}°</span>
        </div>
      </div>
    </div>
  )
}

export default PanTiltControl
