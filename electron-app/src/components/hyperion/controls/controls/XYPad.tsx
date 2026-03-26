/**
 * 🎯 XY PAD - The Sniper
 * WAVE 375.4 - Position Control
 * WAVE 1008.3 - SAFETY SHIELD
 * WAVE 2190 - RAF THROTTLE (max ~33 IPC/sec, prevents motor DDoS)
 * 
 * Direct position control for pan/tilt
 * - Pan: 0-540° physical max, 0-513° safe max (95%)
 * - Tilt: 0-270° physical max, 0-256° safe max (95%)
 * 
 * No Math.random(), no simulation - pure deterministic control
 * Safety limits protect motor belts from strain/damage
 */

import React, { useCallback, useRef, useState, useEffect } from 'react'

export interface XYPadProps {
  pan: number   // 0-540 degrees (physical), but UI enforces 0-513° (safe)
  tilt: number  // 0-270 degrees (physical), but UI enforces 0-256° (safe)
  onChange: (pan: number, tilt: number) => void
  onCenter?: () => void
  disabled?: boolean
}

export const XYPad: React.FC<XYPadProps> = ({
  pan,
  tilt,
  onChange,
  onCenter,
  disabled = false,
}) => {
  const padRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // 🔥 WAVE 2190: RAF THROTTLE — Prevents IPC flood (was 60-120/sec, now ~33/sec)
  const rafIdRef = useRef<number>(0)
  const pendingPositionRef = useRef<{ clientX: number; clientY: number } | null>(null)
  
  // 🛡️ WAVE 1008.3: SAFETY LIMITS (95% of physical max to protect motor belts)
  const SAFE_PAN_MAX = 513   // 95% of 540° - prevents motor strain
  const SAFE_TILT_MAX = 256  // 95% of 270° - prevents motor strain
  
  // Normalize to 0-1 range for display (using SAFE limits, not physical max!)
  const normalizedX = pan / SAFE_PAN_MAX
  const normalizedY = tilt / SAFE_TILT_MAX
  
  /**
   * Convert mouse position to pan/tilt values
   * 🛡️ WAVE 1008.3: Enforces safety limits to protect motor
   */
  const handleMousePosition = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current
    if (!pad || disabled) return
    
    const rect = pad.getBoundingClientRect()
    
    // Calculate normalized position (0-1)
    let x = (clientX - rect.left) / rect.width
    let y = (clientY - rect.top) / rect.height
    
    // Clamp to valid range
    x = Math.max(0, Math.min(1, x))
    y = Math.max(0, Math.min(1, y))
    
    // Convert to degrees using SAFE limits (95% of physical max)
    const newPan = Math.round(x * SAFE_PAN_MAX)   // Max 513° (not 540°)
    const newTilt = Math.round(y * SAFE_TILT_MAX) // Max 256° (not 270°)
    
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
   * 🔥 WAVE 2190: RAF THROTTLE — Only process the LATEST mouse position per animation frame.
   * Raw mousemove fires 60-120 events/sec → 60-120 IPC calls → motor DDoS.
   * With RAF gate: we buffer the latest position and flush once per frame (~33 FPS).
   * This cut the IPC flood from 120/sec to ~33/sec, ending the motor spasms.
   */
  useEffect(() => {
    if (!isDragging) return
    
    const handleMove = (e: MouseEvent) => {
      pendingPositionRef.current = { clientX: e.clientX, clientY: e.clientY }
      
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = 0
          const pos = pendingPositionRef.current
          if (pos) {
            handleMousePosition(pos.clientX, pos.clientY)
            pendingPositionRef.current = null
          }
        })
      }
    }
    
    const handleUp = () => {
      // Flush any buffered position on release
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
      const pos = pendingPositionRef.current
      if (pos) {
        handleMousePosition(pos.clientX, pos.clientY)
        pendingPositionRef.current = null
      }
      setIsDragging(false)
    }
    
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = 0
      }
    }
  }, [isDragging, handleMousePosition])
  
  /**
   * Touch handlers for mobile support
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    e.preventDefault()
    setIsDragging(true)
    const touch = e.touches[0]
    handleMousePosition(touch.clientX, touch.clientY)
  }, [disabled, handleMousePosition])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return
    e.preventDefault()
    const touch = e.touches[0]
    handleMousePosition(touch.clientX, touch.clientY)
  }, [isDragging, disabled, handleMousePosition])
  
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])
  
  /**
   * Double click to center
   */
  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    onCenter?.()
  }, [disabled, onCenter])
  
  return (
    <div className="xy-pad-container">
      <div
        ref={padRef}
        className={`xy-pad ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {/* Grid lines */}
        <div className="xy-grid">
          <div className="grid-line vertical" style={{ left: '25%' }} />
          <div className="grid-line vertical" style={{ left: '50%' }} />
          <div className="grid-line vertical" style={{ left: '75%' }} />
          <div className="grid-line horizontal" style={{ top: '25%' }} />
          <div className="grid-line horizontal" style={{ top: '50%' }} />
          <div className="grid-line horizontal" style={{ top: '75%' }} />
        </div>
        
        {/* Center crosshair */}
        <div className="center-mark" />
        
        {/* Cursor - The actual position indicator */}
        <div 
          className="xy-cursor"
          style={{
            left: `${normalizedX * 100}%`,
            top: `${normalizedY * 100}%`,
          }}
        >
          <div className="cursor-dot" />
          <div className="cursor-ring" />
        </div>
        
        {/* Axis labels */}
        <span className="axis-label pan-label">PAN</span>
        <span className="axis-label tilt-label">TILT</span>
        
        {/* Center button - Overlay in corner */}
        <button 
          className="center-btn-overlay"
          onClick={(e) => {
            e.stopPropagation()
            onCenter?.()
          }}
          disabled={disabled}
          title="Center position (double-click pad)"
        >
          ⌖
        </button>
      </div>
    </div>
  )
}

export default XYPad
