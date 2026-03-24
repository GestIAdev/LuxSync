/**
 * 🔄 PATTERN SELECTOR - WAVE 2184 (Creative Matrix)
 * Procedural movement patterns for position control
 * 
 * Patterns:
 * - Static: No movement, hold position
 * - Circle: Circular pan/tilt motion
 * - Eight: Figure-8 pattern (Lissajous 1:2)
 * - Sweep: Back and forth pan sweep
 * - Tornado: Spiral vortex — growing/shrinking circle
 * - Gravity Bounce: Realistic bouncing ball simulation
 * - Butterfly: Lissajous 3:2 — celtic knot pattern
 * - Heartbeat: Violent techno pulse — sharp tilt spikes
 * 
 * Connected to Arbiter for real-time pattern generation
 */

import React, { useCallback } from 'react'

export type PatternType = 'none' | 'static' | 'circle' | 'eight' | 'sweep' | 'tornado' | 'gravity_bounce' | 'butterfly' | 'heartbeat'

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
  icon: string | React.ReactNode
  label: string
  title: string
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2184: CREATIVE MATRIX — Custom SVG Pattern Icons
// ═══════════════════════════════════════════════════════════════════════════

/** 🌪️ TORNADO — Spiral vortex icon */
const TornadoPatternIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 4C8 4 5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M7 8C7 8 9 9 12 9C16 9 19 8 19 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 12C8 12 10 13 13 13C16 13 17 12 17 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M10 16C10 16 11 17 13 17C14.5 17 15 16 15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M11 20L13 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

/** 🏓 GRAVITY BOUNCE — Bouncing ball with arc */
const GravityBouncePatternIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 20L8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 6Q12 2 16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M16 10Q18 14 20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <circle cx="8" cy="6" r="2.5" fill="currentColor" />
    <path d="M3 20H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
  </svg>
)

/** 🦋 BUTTERFLY — Lissajous figure / infinity flower */
const ButterflyPatternIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 12C12 12 6 6 4 9C2 12 5 15 8 14C10 13.3 12 12 12 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M12 12C12 12 18 6 20 9C22 12 19 15 16 14C14 13.3 12 12 12 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M12 12C12 12 6 18 4 15C2 12 5 9 8 10C10 10.7 12 12 12 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M12 12C12 12 18 18 20 15C22 12 19 9 16 10C14 10.7 12 12 12 12Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
)

/** ⚡ HEARTBEAT — Sharp pulse spike */
const HeartbeatPatternIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M2 14H6L8 8L10 18L12 4L14 16L16 10L18 14H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PATTERNS: PatternOption[] = [
  // Row 1 - Foundation patterns
  { id: 'static', icon: '🛑', label: 'HOLD', title: 'Freeze position - No movement' },
  { id: 'circle', icon: '○', label: 'CIRCLE', title: 'Circular motion' },
  { id: 'eight', icon: '∞', label: 'EIGHT', title: 'Figure-8 pattern' },
  { id: 'sweep', icon: '↔', label: 'SWEEP', title: 'Pan sweep' },
  // Row 2 - WAVE 2184: Creative Matrix patterns
  { id: 'tornado', icon: (<TornadoPatternIcon size={16} />), label: 'TORNADO', title: 'Spiral vortex — growing/shrinking circle' },
  { id: 'gravity_bounce', icon: (<GravityBouncePatternIcon size={16} />), label: 'BOUNCE', title: 'Gravity bounce — realistic bouncing ball' },
  { id: 'butterfly', icon: (<ButterflyPatternIcon size={16} />), label: 'BUTTERFLY', title: 'Lissajous butterfly — celtic knot pattern' },
  { id: 'heartbeat', icon: (<HeartbeatPatternIcon size={16} />), label: 'PULSE', title: 'Heartbeat pulse — violent techno tilt spikes' },
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
  
  const isPatternActive = activePattern !== 'none' && activePattern !== 'static'
  
  return (
    <div className={`pattern-selector ${disabled ? 'disabled' : ''}`}>
      {/* Pattern type buttons - 2x4 GRID */}
      <div className="pattern-buttons-grid">
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
