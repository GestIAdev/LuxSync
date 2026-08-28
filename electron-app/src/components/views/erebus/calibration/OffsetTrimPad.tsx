import React, { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// OffsetTrimPad — WAVE 7676: Circular Polar Radar (SVG, self-contained)
//
// Renders a circular pan/tilt offset radar using inline SVG so it does
// NOT depend on external CSS classes loading correctly.
//
// Drag within the circle to set panOffset (X, -30° to +30°) and
// tiltOffset (Y, -30° to +30°). Snap to 0.5° increments.
// Double-click resets to 0,0.
//
// The cursor is clamped to the circle boundary — dragging outside the
// disc pins the offset to the edge at the corresponding angle.
// ═══════════════════════════════════════════════════════════════════════════

interface OffsetTrimPadProps {
  panOffset: number
  tiltOffset: number
  onChange: (pan: number, tilt: number) => void
}

const MAX_DEG = 30
const SNAP_DEG = 0.5
const SIZE = 140 // SVG viewBox size
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 6 // padding for stroke

function snap(value: number): number {
  return Math.round(value / SNAP_DEG) * SNAP_DEG
}

export const OffsetTrimPad: React.FC<OffsetTrimPadProps> = ({ panOffset, tiltOffset, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const r = rect.width / 2

      let dx = (clientX - cx) / r
      let dy = (clientY - cy) / r

      // Clamp to unit circle
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1) {
        dx = dx / dist
        dy = dy / dist
      }

      onChange(snap(dx * MAX_DEG), snap(dy * MAX_DEG))
    },
    [onChange],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      draggingRef.current = true
      updateFromPointer(e.clientX, e.clientY)
    },
    [updateFromPointer],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      updateFromPointer(e.clientX, e.clientY)
    },
    [updateFromPointer],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    draggingRef.current = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    onChange(0, 0)
  }, [onChange])

  // Numeric input handlers
  const handlePanInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      if (!Number.isFinite(v)) return
      onChange(snap(Math.max(-MAX_DEG, Math.min(MAX_DEG, v))), tiltOffset)
    },
    [tiltOffset, onChange],
  )

  const handleTiltInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      if (!Number.isFinite(v)) return
      onChange(panOffset, snap(Math.max(-MAX_DEG, Math.min(MAX_DEG, v))))
    },
    [panOffset, onChange],
  )

  // Cursor position in SVG coordinates
  const cursorX = CENTER + (panOffset / MAX_DEG) * (RADIUS - 8)
  const cursorY = CENTER + (tiltOffset / MAX_DEG) * (RADIUS - 8)

  // Container styles (inline — no external CSS dependency)
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    width: '100%',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  }

  const valuesStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    fontSize: '0.55rem',
    color: 'rgba(34, 211, 238, 0.8)',
    lineHeight: 1.3,
  }

  const hintStyle: React.CSSProperties = {
    fontSize: '0.5rem',
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    marginTop: '2px',
  }

  const numInputsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
    width: '100%',
  }

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    flex: 1,
    minWidth: 0,
  }

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '0.55rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.4)',
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    minWidth: '22px',
    textAlign: 'right',
    flexShrink: 0,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    flex: 1,
    padding: '3px 5px',
    fontSize: '0.65rem',
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    color: 'rgba(255, 255, 255, 0.9)',
    background: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    outline: 'none',
  }

  return (
    <div className="cal-trim-pad-container" style={containerStyle}>
      <div className="cal-trim-pad-label" style={labelStyle}>
        <span style={titleStyle}>Offset Trim</span>
        <span style={valuesStyle}>
          Pan {panOffset > 0 ? '+' : ''}{panOffset.toFixed(1)}° · Tilt {tiltOffset > 0 ? '+' : ''}{tiltOffset.toFixed(1)}°
        </span>
      </div>

      {/* ── Circular Polar Radar (inline SVG — no CSS dependency) ─────────── */}
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Background disc */}
        <defs>
          <radialGradient id="trim-radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
          </radialGradient>
        </defs>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="url(#trim-radar-bg)" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />

        {/* Concentric rings */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx={CENTER} cy={CENTER} r={RADIUS * 0.66} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx={CENTER} cy={CENTER} r={RADIUS * 0.33} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* Crosshair H+V */}
        <line x1={CENTER - RADIUS + 2} y1={CENTER} x2={CENTER + RADIUS - 2} y2={CENTER} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={CENTER} y1={CENTER - RADIUS + 2} x2={CENTER} y2={CENTER + RADIUS - 2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Diagonal guides */}
        <line x1={CENTER - RADIUS * 0.7} y1={CENTER - RADIUS * 0.7} x2={CENTER + RADIUS * 0.7} y2={CENTER + RADIUS * 0.7} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <line x1={CENTER - RADIUS * 0.7} y1={CENTER + RADIUS * 0.7} x2={CENTER + RADIUS * 0.7} y2={CENTER - RADIUS * 0.7} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {/* Center dot */}
        <circle cx={CENTER} cy={CENTER} r="2" fill="rgba(255,255,255,0.3)" />

        {/* Axis labels */}
        <text x={CENTER} y={SIZE - 2} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.25)" fontWeight="600">PAN</text>
        <text x={SIZE - 4} y={CENTER + 2} textAnchor="end" fontSize="7" fill="rgba(255,255,255,0.25)" fontWeight="600">TILT</text>

        {/* Position cursor — cyan dot + ring */}
        <circle cx={cursorX} cy={cursorY} r="9" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
        <circle cx={cursorX} cy={cursorY} r="5" fill="#22d3ee" stroke="rgba(0,0,0,0.4)" strokeWidth="1" style={{ filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.6))' }} />
      </svg>

      <div style={hintStyle}>Drag · Dbl-click to reset</div>

      {/* ── Precision numeric inputs ────────────────────────────────────────── */}
      <div className="cal-trim-pad-numinputs" style={numInputsStyle}>
        <label className="cal-num-field" style={fieldStyle}>
          <span className="cal-num-field-label" style={fieldLabelStyle}>Pan°</span>
          <input
            type="number"
            step={0.5}
            min={-MAX_DEG}
            max={MAX_DEG}
            value={Number(panOffset.toFixed(1))}
            onChange={handlePanInput}
            className="cal-num-input"
            style={inputStyle}
          />
        </label>
        <label className="cal-num-field" style={fieldStyle}>
          <span className="cal-num-field-label" style={fieldLabelStyle}>Tilt°</span>
          <input
            type="number"
            step={0.5}
            min={-MAX_DEG}
            max={MAX_DEG}
            value={Number(tiltOffset.toFixed(1))}
            onChange={handleTiltInput}
            className="cal-num-input"
            style={inputStyle}
          />
        </label>
      </div>
    </div>
  )
}

export default OffsetTrimPad
