import React, { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// CalibrationTargetMini — mini SpatialTargetPad for forcing test aim points.
//
// WAVE 7662: AXIS CORRECTION — the 2D pad now maps to the TOP-DOWN view:
//   · Pad horizontal → target.x (Stage Left/Right)
//   · Pad vertical   → target.z (Stage Depth, front/back)
//   · Slider         → target.y (Elevation/Height)
//
// This matches the 2D Blueprint Canvas coordinate system and the engine's
// 3D space (X=left/right, Y=height, Z=depth).
//
// WAVE 7662: Added precision numeric inputs for X, Z, and Y below the pad.
// ═══════════════════════════════════════════════════════════════════════════

interface CalibrationTargetMiniProps {
  fixtureId: string | null
  target: { x: number; y: number; z: number }
  onTargetChange: (target: { x: number; y: number; z: number }) => void
}

const PAD_SIZE = 160
const RANGE_X = 10 // meters: -5 to +5 (stage left/right)
const RANGE_Z = 10 // meters: -5 to +5 (stage depth)
const RANGE_Y = 6  // meters: 0 to 6 (elevation)

export const CalibrationTargetMini: React.FC<CalibrationTargetMiniProps> = ({
  fixtureId,
  target,
  onTargetChange,
}) => {
  const padRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const fireSpatialTarget = useCallback(
    (x: number, y: number, z: number) => {
      if (!fixtureId) return
      window.lux?.aether?.applySpatialTarget({
        target: { x, y, z },
        fixtureIds: [fixtureId],
        fanMode: 'converge',
        fanAmplitude: 0,
      }).catch(() => {})
    },
    [fixtureId],
  )

  // ── 2D Pad: X (horizontal) / Z (vertical, depth) ──────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      draggingRef.current = true
      handlePointerMove(e)
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !padRef.current) return
      const rect = padRef.current.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width   // 0 to 1
      const ny = (e.clientY - rect.top) / rect.height    // 0 to 1
      const x = (nx - 0.5) * RANGE_X                      // -5 to +5
      const z = (0.5 - ny) * RANGE_Z                      // invert: top = far, bottom = near
      onTargetChange({ x, y: target.y, z })
      fireSpatialTarget(x, target.y, z)
    },
    [target.y, onTargetChange, fireSpatialTarget],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    draggingRef.current = false
  }, [])

  // ── Elevation slider: Y (height) ──────────────────────────────────────────
  const handleYChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const y = parseFloat(e.target.value)
      onTargetChange({ ...target, y })
      fireSpatialTarget(target.x, y, target.z)
    },
    [target, onTargetChange, fireSpatialTarget],
  )

  // ── Numeric input handlers ────────────────────────────────────────────────
  const handleNumX = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!Number.isFinite(v)) return
    onTargetChange({ ...target, x: v })
    fireSpatialTarget(v, target.y, target.z)
  }, [target, onTargetChange, fireSpatialTarget])

  const handleNumZ = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!Number.isFinite(v)) return
    onTargetChange({ ...target, z: v })
    fireSpatialTarget(target.x, target.y, v)
  }, [target, onTargetChange, fireSpatialTarget])

  const handleNumY = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    if (!Number.isFinite(v)) return
    onTargetChange({ ...target, y: v })
    fireSpatialTarget(target.x, v, target.z)
  }, [target, onTargetChange, fireSpatialTarget])

  // Target position in px (pad uses X/Z)
  const targetX = ((target.x / RANGE_X) + 0.5) * PAD_SIZE
  const targetZ = (0.5 - (target.z / RANGE_Z)) * PAD_SIZE

  return (
    <div className="cal-target-mini-container">
      <div className="cal-section-label">Test Target</div>
      <div className="cal-target-mini-row">
        <div
          ref={padRef}
          className="cal-target-mini-pad"
          style={{ width: PAD_SIZE, height: PAD_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="cal-target-mini-grid-h" />
          <div className="cal-target-mini-grid-v" />
          <div className="cal-target-mini-center" />
          <div
            className="cal-target-mini-dot"
            style={{ transform: `translate(${targetX}px, ${targetZ}px)` }}
          />
        </div>
        <div className="cal-target-mini-z">
          <span className="cal-target-mini-z-label">Y</span>
          <input
            type="range"
            min={0}
            max={RANGE_Y}
            step={0.25}
            value={target.y}
            onChange={handleYChange}
            className="cal-target-mini-z-slider"
          />
          <span className="cal-target-mini-z-value">{target.y.toFixed(1)}m</span>
        </div>
      </div>

      {/* WAVE 7662: Precision numeric inputs */}
      <div className="cal-target-mini-numinputs">
        <label className="cal-num-field">
          <span className="cal-num-field-label">X</span>
          <input
            type="number"
            step={0.25}
            value={Number(target.x.toFixed(2))}
            onChange={handleNumX}
            className="cal-num-input"
          />
        </label>
        <label className="cal-num-field">
          <span className="cal-num-field-label">Z</span>
          <input
            type="number"
            step={0.25}
            value={Number(target.z.toFixed(2))}
            onChange={handleNumZ}
            className="cal-num-input"
          />
        </label>
        <label className="cal-num-field">
          <span className="cal-num-field-label">Y</span>
          <input
            type="number"
            step={0.25}
            value={Number(target.y.toFixed(2))}
            onChange={handleNumY}
            className="cal-num-input"
          />
        </label>
      </div>

      <div className="cal-target-mini-coords">
        X: {target.x.toFixed(1)}m · Z: {target.z.toFixed(1)}m · Y(Elev): {target.y.toFixed(1)}m
      </div>
    </div>
  )
}

export default CalibrationTargetMini
