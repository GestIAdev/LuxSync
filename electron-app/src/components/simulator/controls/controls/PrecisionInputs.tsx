/**
 * 🔬 PRECISION INPUTS - The Surgeon
 * WAVE 375.4 - Numeric position control
 * 
 * Direct numeric entry for exact pan/tilt values
 * - Pan: 0-540° with 0.1° precision
 * - Tilt: 0-270° with 0.1° precision
 * 
 * For those moments when you need surgical precision
 */

import React, { useCallback, useState, useEffect } from 'react'

export interface PrecisionInputsProps {
  pan: number   // 0-540 degrees
  tilt: number  // 0-270 degrees
  onChange: (pan: number, tilt: number) => void
  disabled?: boolean
}

export const PrecisionInputs: React.FC<PrecisionInputsProps> = ({
  pan,
  tilt,
  onChange,
  disabled = false,
}) => {
  // Local state for input editing
  const [panInput, setPanInput] = useState(pan.toString())
  const [tiltInput, setTiltInput] = useState(tilt.toString())
  const [isEditing, setIsEditing] = useState(false)
  
  // Sync local state with props when not editing
  useEffect(() => {
    if (!isEditing) {
      setPanInput(pan.toString())
      setTiltInput(tilt.toString())
    }
  }, [pan, tilt, isEditing])
  
  /**
   * Parse and validate input value
   */
  const parseValue = useCallback((value: string, max: number): number | null => {
    const num = parseFloat(value)
    if (isNaN(num)) return null
    return Math.max(0, Math.min(max, num))
  }, [])
  
  /**
   * Handle pan input change
   */
  const handlePanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPanInput(e.target.value)
  }, [])
  
  /**
   * Handle tilt input change  
   */
  const handleTiltChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTiltInput(e.target.value)
  }, [])
  
  /**
   * Commit pan value on blur or enter
   */
  const commitPan = useCallback(() => {
    const newPan = parseValue(panInput, 540)
    if (newPan !== null) {
      onChange(newPan, tilt)
      setPanInput(newPan.toString())
    } else {
      setPanInput(pan.toString())
    }
    setIsEditing(false)
  }, [panInput, pan, tilt, onChange, parseValue])
  
  /**
   * Commit tilt value on blur or enter
   */
  const commitTilt = useCallback(() => {
    const newTilt = parseValue(tiltInput, 270)
    if (newTilt !== null) {
      onChange(pan, newTilt)
      setTiltInput(newTilt.toString())
    } else {
      setTiltInput(tilt.toString())
    }
    setIsEditing(false)
  }, [tiltInput, pan, tilt, onChange, parseValue])
  
  /**
   * Handle key press
   */
  const handlePanKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitPan()
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setPanInput(pan.toString())
      setIsEditing(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }, [commitPan, pan])
  
  const handleTiltKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitTilt()
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setTiltInput(tilt.toString())
      setIsEditing(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }, [commitTilt, tilt])
  
  /**
   * Focus handler
   */
  const handleFocus = useCallback(() => {
    setIsEditing(true)
  }, [])
  
  /**
   * Increment/decrement helpers
   */
  const incrementPan = useCallback(() => {
    const newPan = Math.min(540, pan + 1)
    onChange(newPan, tilt)
  }, [pan, tilt, onChange])
  
  const decrementPan = useCallback(() => {
    const newPan = Math.max(0, pan - 1)
    onChange(newPan, tilt)
  }, [pan, tilt, onChange])
  
  const incrementTilt = useCallback(() => {
    const newTilt = Math.min(270, tilt + 1)
    onChange(pan, newTilt)
  }, [pan, tilt, onChange])
  
  const decrementTilt = useCallback(() => {
    const newTilt = Math.max(0, tilt - 1)
    onChange(pan, newTilt)
  }, [pan, tilt, onChange])
  
  return (
    <div className={`precision-inputs ${disabled ? 'disabled' : ''}`}>
      {/* Pan input */}
      <div className="precision-row">
        <label className="precision-label">PAN</label>
        <div className="precision-control">
          <button 
            className="precision-btn decrement"
            onClick={decrementPan}
            disabled={disabled || pan <= 0}
          >
            −
          </button>
          <input
            type="text"
            className="precision-input"
            value={panInput}
            onChange={handlePanChange}
            onBlur={commitPan}
            onFocus={handleFocus}
            onKeyDown={handlePanKeyDown}
            disabled={disabled}
          />
          <button 
            className="precision-btn increment"
            onClick={incrementPan}
            disabled={disabled || pan >= 540}
          >
            +
          </button>
        </div>
        <span className="precision-unit">°</span>
        <span className="precision-range">(0-540)</span>
      </div>
      
      {/* Tilt input */}
      <div className="precision-row">
        <label className="precision-label">TILT</label>
        <div className="precision-control">
          <button 
            className="precision-btn decrement"
            onClick={decrementTilt}
            disabled={disabled || tilt <= 0}
          >
            −
          </button>
          <input
            type="text"
            className="precision-input"
            value={tiltInput}
            onChange={handleTiltChange}
            onBlur={commitTilt}
            onFocus={handleFocus}
            onKeyDown={handleTiltKeyDown}
            disabled={disabled}
          />
          <button 
            className="precision-btn increment"
            onClick={incrementTilt}
            disabled={disabled || tilt >= 270}
          >
            +
          </button>
        </div>
        <span className="precision-unit">°</span>
        <span className="precision-range">(0-270)</span>
      </div>
    </div>
  )
}

export default PrecisionInputs
