/**
 * 🎯 RADAR XY - WAVE 425
 * "El Ojo del Francotirador"
 * 
 * Control Pan/Tilt expandido con estética de radar militar.
 * Similar a XYPad pero más grande y con más información visual.
 * 
 * Features:
 * - Radar grid con anillos concéntricos
 * - Crosshair animado
 * - Display de coordenadas en tiempo real
 * - Visual feedback de calibración
 */

import React, { useCallback, useRef, useState, useEffect } from 'react'
import './RadarXY.css'

export interface RadarXYProps {
  pan: number        // 0-540 degrees
  tilt: number       // 0-270 degrees
  onChange: (pan: number, tilt: number) => void
  onCenter?: () => void
  isCalibrating?: boolean
  disabled?: boolean
}

export const RadarXY: React.FC<RadarXYProps> = ({
  pan,
  tilt,
  onChange,
  onCenter,
  isCalibrating = false,
  disabled = false,
}) => {
  const radarRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Normalize to 0-1 range for display
  const normalizedX = pan / 540
  const normalizedY = tilt / 270
  
  // Convert to centered coordinates (-1 to 1)
  const centeredX = (normalizedX - 0.5) * 2
  const centeredY = (normalizedY - 0.5) * 2
  
  /**
   * Convert mouse position to pan/tilt values
   */
  const handleMousePosition = useCallback((clientX: number, clientY: number) => {
    const radar = radarRef.current
    if (!radar || disabled) return
    
    const rect = radar.getBoundingClientRect()
    
    // Calculate normalized position (0-1)
    let x = (clientX - rect.left) / rect.width
    let y = (clientY - rect.top) / rect.height
    
    // Clamp to valid range
    x = Math.max(0, Math.min(1, x))
    y = Math.max(0, Math.min(1, y))
    
    // Convert to degrees
    const newPan = Math.round(x * 540)
    const newTilt = Math.round(y * 270)
    
    onChange(newPan, newTilt)
  }, [onChange, disabled])
  
  /**
   * Mouse down - start dragging
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    setIsDragging(true)
    handleMousePosition(e.clientX, e.clientY)
  }, [disabled, handleMousePosition])
  
  /**
   * Mouse move - update position while dragging
   */
  useEffect(() => {
    if (!isDragging) return
    
    const handleMove = (e: MouseEvent) => {
      handleMousePosition(e.clientX, e.clientY)
    }
    
    const handleUp = () => {
      setIsDragging(false)
    }
    
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, handleMousePosition])
  
  /**
   * Double click to center
   */
  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    onCenter?.()
  }, [disabled, onCenter])
  
  return (
    <div className={`radar-xy-container ${isCalibrating ? 'calibrating' : ''} ${disabled ? 'disabled' : ''}`}>
      {/* RADAR DISPLAY */}
      <div
        ref={radarRef}
        className={`radar-xy ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* RADAR GRID - Concentric rings */}
        <div className="radar-grid">
          <div className="ring ring-outer" />
          <div className="ring ring-mid" />
          <div className="ring ring-inner" />
          <div className="ring ring-center" />
        </div>
        
        {/* CROSSHAIR - Axis lines */}
        <div className="radar-crosshair">
          <div className="crosshair-h" />
          <div className="crosshair-v" />
        </div>
        
        {/* GRID LINES - 45° increments */}
        <div className="radar-diagonals">
          <div className="diagonal diagonal-1" />
          <div className="diagonal diagonal-2" />
        </div>
        
        {/* POSITION CURSOR */}
        <div 
          className="radar-cursor"
          style={{
            left: `${normalizedX * 100}%`,
            top: `${normalizedY * 100}%`,
          }}
        >
          <div className="cursor-core" />
          <div className="cursor-pulse" />
          <div className="cursor-brackets">
            <span className="bracket tl">┌</span>
            <span className="bracket tr">┐</span>
            <span className="bracket bl">└</span>
            <span className="bracket br">┘</span>
          </div>
        </div>
        
        {/* AXIS LABELS */}
        <div className="radar-labels">
          <span className="label label-pan-min">0°</span>
          <span className="label label-pan-max">540°</span>
          <span className="label label-tilt-min">0°</span>
          <span className="label label-tilt-max">270°</span>
        </div>
        
        {/* CALIBRATION OVERLAY */}
        {isCalibrating && (
          <div className="calibrating-overlay">
            <div className="scanning-line" />
            <span className="calibrating-text">🎯 CALIBRATING</span>
          </div>
        )}
      </div>
      
      {/* COORDINATE DISPLAY */}
      <div className="radar-coords">
        <div className="coord-group">
          <span className="coord-label">PAN</span>
          <span className="coord-value">{pan}°</span>
          <span className="coord-normalized">({centeredX.toFixed(2)})</span>
        </div>
        <div className="coord-separator">×</div>
        <div className="coord-group">
          <span className="coord-label">TILT</span>
          <span className="coord-value">{tilt}°</span>
          <span className="coord-normalized">({centeredY.toFixed(2)})</span>
        </div>
      </div>
      
      {/* QUICK ACTIONS */}
      <div className="radar-actions">
        <button 
          className="action-btn center-btn"
          onClick={onCenter}
          disabled={disabled}
          title="Center position"
        >
          ⌖ CENTER
        </button>
      </div>
    </div>
  )
}

export default RadarXY
