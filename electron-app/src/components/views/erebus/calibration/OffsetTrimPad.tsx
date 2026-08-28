import React, { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// OffsetTrimPad — WAVE 7672: Circular Polar Radar for pan/tilt offset.
//
// Replaces the old square cartesian pad with a proper circular polar radar
// that matches the Calibration Lab's visual language.
//
// Drag within the circle to set panOffset (X, -30° to +30°) and
// tiltOffset (Y, -30° to +30°). Snap to 0.5° increments.
// Double-click resets to 0,0.
//
// The dot is clamped to the circle boundary — dragging outside the disc
// pins the offset to the edge at the corresponding angle.
// ═══════════════════════════════════════════════════════════════════════════

interface OffsetTrimPadProps {
  panOffset: number
  tiltOffset: number
  onChange: (pan: number, tilt: number) => void
}

const MAX_DEG = 30
const SNAP_DEG = 0.5
const PAD_SIZE = 140 // px — circular diameter

function snap(value: number): number {
  return Math.round(value / SNAP_DEG) * SNAP_DEG
}

export const OffsetTrimPad: React.FC<OffsetTrimPadProps> = ({ panOffset, tiltOffset, onChange }) => {
  const padRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current
      if (!pad) return
      const rect = pad.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const radius = rect.width / 2

      let dx = (clientX - cx) / radius // -1 to +1 (can exceed if outside circle)
      let dy = (clientY - cy) / radius

      // Clamp to unit circle
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 1) {
        dx = dx / dist
        dy = dy / dist
      }

      const pan = snap(dx * MAX_DEG)
      const tilt = snap(dy * MAX_DEG)
      onChange(pan, tilt)
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

  // ── Numeric input handlers ───────────────────────────────────────────────
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

  // Dot position as percentage within the circle (50% = center)
  const dotLeft = 50 + (panOffset / MAX_DEG) * 45 // 5% to 95% to stay inside
  const dotTop = 50 + (tiltOffset / MAX_DEG) * 45

  return (
    <div className="cal-trim-pad-container">
      <div className="cal-trim-pad-label">
        <span className="cal-trim-pad-title">Offset Trim</span>
        <span className="cal-trim-pad-values">
          Pan {panOffset > 0 ? '+' : ''}{panOffset.toFixed(1)}° · Tilt {tiltOffset > 0 ? '+' : ''}{tiltOffset.toFixed(1)}°
        </span>
      </div>

      {/* ── Circular Polar Radar ────────────────────────────────────────────── */}
      <div
        ref={padRef}
        className="cal-trim-radar"
        style={{ width: PAD_SIZE, height: PAD_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Concentric rings */}
        <div className="cal-trim-ring cal-trim-ring-outer" />
        <div className="cal-trim-ring cal-trim-ring-mid" />
        <div className="cal-trim-ring cal-trim-ring-inner" />

        {/* Crosshair lines */}
        <div className="cal-trim-cross-h" />
        <div className="cal-trim-cross-v" />

        {/* Diagonal guides */}
        <div className="cal-trim-diag cal-trim-diag-1" />
        <div className="cal-trim-diag cal-trim-diag-2" />

        {/* Center dot */}
        <div className="cal-trim-center-dot" />

        {/* Position indicator */}
        <div
          className="cal-trim-cursor"
          style={{ left: `${dotLeft}%`, top: `${dotTop}%` }}
        >
          <div className="cal-trim-cursor-dot" />
          <div className="cal-trim-cursor-ring" />
        </div>

        {/* Axis labels */}
        <span className="cal-trim-axis-label cal-trim-axis-pan">PAN</span>
        <span className="cal-trim-axis-label cal-trim-axis-tilt">TILT</span>
      </div>

      <div className="cal-trim-pad-hint">Drag · Dbl-click to reset</div>

      {/* ── Precision numeric inputs ────────────────────────────────────────── */}
      <div className="cal-trim-pad-numinputs">
        <label className="cal-num-field">
          <span className="cal-num-field-label">Pan°</span>
          <input
            type="number"
            step={0.5}
            min={-MAX_DEG}
            max={MAX_DEG}
            value={Number(panOffset.toFixed(1))}
            onChange={handlePanInput}
            className="cal-num-input"
          />
        </label>
        <label className="cal-num-field">
          <span className="cal-num-field-label">Tilt°</span>
          <input
            type="number"
            step={0.5}
            min={-MAX_DEG}
            max={MAX_DEG}
            value={Number(tiltOffset.toFixed(1))}
            onChange={handleTiltInput}
            className="cal-num-input"
          />
        </label>
      </div>
    </div>
  )
}

export default OffsetTrimPad
