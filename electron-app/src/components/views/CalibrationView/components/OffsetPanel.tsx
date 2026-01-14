/**
 * 🔧 OFFSET PANEL - WAVE 425
 * Panel de ajuste de offsets de instalación
 * 
 * Allows adjusting:
 * - Pan Offset: Compensation for physical mounting angle
 * - Tilt Offset: Compensation for physical tilt mounting
 * - Pan Invert: Flip pan direction
 * - Tilt Invert: Flip tilt direction
 */

import React, { useState, useCallback } from 'react'
import './OffsetPanel.css'

export interface OffsetPanelProps {
  fixtureId: string | null
  disabled?: boolean
}

export const OffsetPanel: React.FC<OffsetPanelProps> = ({
  fixtureId,
  disabled = false,
}) => {
  // Local state for offsets (in real app, would load from fixture config)
  const [panOffset, setPanOffset] = useState(0)
  const [tiltOffset, setTiltOffset] = useState(0)
  const [panInvert, setPanInvert] = useState(false)
  const [tiltInvert, setTiltInvert] = useState(false)
  
  /**
   * Handle pan offset change
   */
  const handlePanOffsetChange = useCallback(async (value: number) => {
    setPanOffset(value)
    if (!fixtureId) return
    
    try {
      const electron = (window as any).electron
      await electron?.ipcRenderer?.invoke?.('lux:fixture:setOffset', {
        fixtureId,
        channel: 'pan',
        offset: value,
      })
      console.log(`[OffsetPanel] Pan offset: ${value}°`)
    } catch (err) {
      console.error('[OffsetPanel] Error:', err)
    }
  }, [fixtureId])
  
  /**
   * Handle tilt offset change
   */
  const handleTiltOffsetChange = useCallback(async (value: number) => {
    setTiltOffset(value)
    if (!fixtureId) return
    
    try {
      const electron = (window as any).electron
      await electron?.ipcRenderer?.invoke?.('lux:fixture:setOffset', {
        fixtureId,
        channel: 'tilt',
        offset: value,
      })
      console.log(`[OffsetPanel] Tilt offset: ${value}°`)
    } catch (err) {
      console.error('[OffsetPanel] Error:', err)
    }
  }, [fixtureId])
  
  /**
   * Toggle invert
   */
  const handleInvertToggle = useCallback(async (channel: 'pan' | 'tilt') => {
    const newValue = channel === 'pan' ? !panInvert : !tiltInvert
    
    if (channel === 'pan') {
      setPanInvert(newValue)
    } else {
      setTiltInvert(newValue)
    }
    
    if (!fixtureId) return
    
    try {
      const electron = (window as any).electron
      await electron?.ipcRenderer?.invoke?.('lux:fixture:setInvert', {
        fixtureId,
        channel,
        invert: newValue,
      })
      console.log(`[OffsetPanel] ${channel} invert: ${newValue}`)
    } catch (err) {
      console.error('[OffsetPanel] Error:', err)
    }
  }, [fixtureId, panInvert, tiltInvert])
  
  /**
   * Reset all offsets
   */
  const handleReset = useCallback(() => {
    setPanOffset(0)
    setTiltOffset(0)
    setPanInvert(false)
    setTiltInvert(false)
    console.log('[OffsetPanel] Reset all offsets')
  }, [])
  
  return (
    <div className={`offset-panel ${disabled ? 'disabled' : ''}`}>
      <div className="panel-header">
        <span className="header-icon">🔧</span>
        <h3>OFFSET CONFIG</h3>
      </div>
      
      <div className="offset-controls">
        {/* Pan Offset */}
        <div className="offset-row">
          <label className="offset-label">
            <span className="label-text">PAN OFFSET</span>
            <span className="label-value">{panOffset}°</span>
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            value={panOffset}
            onChange={(e) => handlePanOffsetChange(Number(e.target.value))}
            disabled={disabled}
            className="offset-slider"
          />
          <button
            className={`invert-btn ${panInvert ? 'active' : ''}`}
            onClick={() => handleInvertToggle('pan')}
            disabled={disabled}
            title="Invert pan direction"
          >
            ⇄
          </button>
        </div>
        
        {/* Tilt Offset */}
        <div className="offset-row">
          <label className="offset-label">
            <span className="label-text">TILT OFFSET</span>
            <span className="label-value">{tiltOffset}°</span>
          </label>
          <input
            type="range"
            min="-90"
            max="90"
            value={tiltOffset}
            onChange={(e) => handleTiltOffsetChange(Number(e.target.value))}
            disabled={disabled}
            className="offset-slider"
          />
          <button
            className={`invert-btn ${tiltInvert ? 'active' : ''}`}
            onClick={() => handleInvertToggle('tilt')}
            disabled={disabled}
            title="Invert tilt direction"
          >
            ⇅
          </button>
        </div>
      </div>
      
      {/* Reset button */}
      <div className="offset-actions">
        <button
          className="reset-offset-btn"
          onClick={handleReset}
          disabled={disabled}
        >
          ↺ RESET OFFSETS
        </button>
      </div>
    </div>
  )
}

export default OffsetPanel
