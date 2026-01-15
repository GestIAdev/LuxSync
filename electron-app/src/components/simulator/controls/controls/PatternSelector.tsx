/**
 * 🔄 PATTERN SELECTOR - WAVE 375.4
 * Procedural movement patterns for position control
 * 
 * Patterns:
 * - Static: No movement, hold position
 * - Circle: Circular pan/tilt motion
 * - Eight: Figure-8 pattern (Lissajous 1:2)
 * - Sweep: Back and forth pan sweep
 * 
 * Connected to Arbiter for real-time pattern generation
 */

import React, { useCallback } from 'react'

export type PatternType = 'static' | 'circle' | 'eight' | 'sweep'

export interface PatternSelectorProps {
  activePattern: PatternType
  speed: number  // 0-100
  size: number   // 0-100
  onPatternChange: (pattern: PatternType) => void
  onParamsChange: (speed: number, size: number) => void
  disabled?: boolean
}

interface PatternOption {
  id: PatternType
  icon: string
  label: string
  title: string
}

const PATTERNS: PatternOption[] = [
  { id: 'static', icon: '●', label: 'HOLD', title: 'Static position' },
  { id: 'circle', icon: '○', label: 'CIRCLE', title: 'Circular motion' },
  { id: 'eight', icon: '∞', label: 'EIGHT', title: 'Figure-8 pattern' },
  { id: 'sweep', icon: '↔', label: 'SWEEP', title: 'Pan sweep' },
]

export const PatternSelector: React.FC<PatternSelectorProps> = ({
  activePattern,
  speed,
  size,
  onPatternChange,
  onParamsChange,
  disabled = false,
}) => {
  
  /**
   * Handle pattern button click
   */
  const handlePatternClick = useCallback((pattern: PatternType) => {
    if (disabled) return
    onPatternChange(pattern)
  }, [disabled, onPatternChange])
  
  /**
   * Handle speed slider change
   */
  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value, 10)
    onParamsChange(newSpeed, size)
  }, [size, onParamsChange])
  
  /**
   * Handle size slider change
   */
  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value, 10)
    onParamsChange(speed, newSize)
  }, [speed, onParamsChange])
  
  const isPatternActive = activePattern !== 'static'
  
  return (
    <div className={`pattern-selector ${disabled ? 'disabled' : ''}`}>
      {/* Pattern type buttons */}
      <div className="pattern-buttons">
        {PATTERNS.map(pattern => (
          <button
            key={pattern.id}
            className={`pattern-btn ${activePattern === pattern.id ? 'active' : ''}`}
            onClick={() => handlePatternClick(pattern.id)}
            disabled={disabled}
            title={pattern.title}
          >
            <span className="pattern-icon">{pattern.icon}</span>
            <span className="pattern-label">{pattern.label}</span>
          </button>
        ))}
      </div>
      
      {/* Pattern parameters - only show when a pattern is active */}
      {isPatternActive && (
        <div className="pattern-params">
          {/* Speed slider */}
          <div className="param-row">
            <label className="param-label">SPEED</label>
            <input
              type="range"
              className="param-slider speed-slider"
              min={0}
              max={100}
              value={speed}
              onChange={handleSpeedChange}
              disabled={disabled}
            />
            <span className="param-value">{speed}%</span>
          </div>
          
          {/* Size slider */}
          <div className="param-row">
            <label className="param-label">SIZE</label>
            <input
              type="range"
              className="param-slider size-slider"
              min={0}
              max={100}
              value={size}
              onChange={handleSizeChange}
              disabled={disabled}
            />
            <span className="param-value">{size}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatternSelector
