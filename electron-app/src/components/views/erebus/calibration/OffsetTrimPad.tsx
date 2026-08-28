import React, { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// OffsetTrimPad — XY drag pad for pan/tilt offset degrees.
// Drag X = panOffset (-30° to +30°), Drag Y = tiltOffset (-30° to +30°).
// Snap to 0.5° increments. Double-click resets to 0.
//
// WAVE 7662: Added precision numeric inputs for Pan and Tilt below the pad.
// Typing a number fires the same onChange flow as dragging.
// ═══════════════════════════════════════════════════════════════════════════

interface OffsetTrimPadProps {
  panOffset: number
  tiltOffset: number
  onChange: (pan: number, tilt: number) => void
}

const MAX_DEG = 30
const SNAP_DEG = 0.5
const PAD_SIZE = 180 // px

function snap(value: number): number {
  return Math.round(value / SNAP_DEG) * SNAP_DEG
}

export const OffsetTrimPad: React.FC<OffsetTrimPadProps> = ({ panOffset, tiltOffset, onChange }) => {
  const padRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    handlePointerMove(e)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !padRef.current) return
      const rect = padRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) / (rect.width / 2) // -1 to +1
      const dy = (e.clientY - cy) / (rect.height / 2) // -1 to +1
      const pan = snap(Math.max(-1, Math.min(1, dx)) * MAX_DEG)
      const tilt = snap(Math.max(-1, Math.min(1, dy)) * MAX_DEG)
      onChange(pan, tilt)
    },
    [onChange],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    draggingRef.current = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    onChange(0, 0)
  }, [onChange])

  // ── Numeric input handlers (WAVE 7662) ────────────────────────────────────
  const handlePanInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!Number.isFinite(v)) return
    onChange(snap(Math.max(-MAX_DEG, Math.min(MAX_DEG, v))), tiltOffset)
  }, [tiltOffset, onChange])

  const handleTiltInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!Number.isFinite(v)) return
    onChange(panOffset, snap(Math.max(-MAX_DEG, Math.min(MAX_DEG, v))))
  }, [panOffset, onChange])

  // Crosshair position in px from center
  const crossX = (panOffset / MAX_DEG) * (PAD_SIZE / 2)
  const crossY = (tiltOffset / MAX_DEG) * (PAD_SIZE / 2)

  return (
    <div className="cal-trim-pad-container">
      <div className="cal-trim-pad-label">
        <span>Offset Trim</span>
        <span className="cal-trim-pad-values">
          Pan: {panOffset.toFixed(1)}° / Tilt: {tiltOffset.toFixed(1)}°
        </span>
      </div>
      <div
        ref={padRef}
        className="cal-trim-pad"
        style={{ width: PAD_SIZE, height: PAD_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Grid lines */}
        <div className="cal-trim-pad-grid-h" />
        <div className="cal-trim-pad-grid-v" />
        {/* Center dot */}
        <div className="cal-trim-pad-center" />
        {/* Crosshair */}
        <div
          className="cal-trim-pad-crosshair"
          style={{
            transform: `translate(${crossX}px, ${crossY}px)`,
          }}
        />
      </div>
      <div className="cal-trim-pad-hint">Drag to adjust · Double-click to reset</div>

      {/* WAVE 7662: Precision numeric inputs */}
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
