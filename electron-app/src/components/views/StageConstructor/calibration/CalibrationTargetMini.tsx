import React, { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// CalibrationTargetMini — mini SpatialTargetPad for forcing test aim points.
// Top-down XY grid (X = stage left/right, Y = stage depth).
// Z (height) controlled by a vertical slider on the right.
// Sends target via applySpatialTarget IPC for the selected fixture only.
// ═══════════════════════════════════════════════════════════════════════════

interface CalibrationTargetMiniProps {
  fixtureId: string | null
  target: { x: number; y: number; z: number }
  onTargetChange: (target: { x: number; y: number; z: number }) => void
}

const PAD_SIZE = 160
const RANGE_X = 10 // meters: -5 to +5
const RANGE_Y = 10 // meters: -5 to +5 (depth)
const RANGE_Z = 6 // meters: 0 to 6 (height)

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
      const nx = (e.clientX - rect.left) / rect.width // 0 to 1
      const ny = (e.clientY - rect.top) / rect.height // 0 to 1
      const x = (nx - 0.5) * RANGE_X
      const y = (0.5 - ny) * RANGE_Y // invert Y: top = far, bottom = near
      onTargetChange({ x, y, z: target.z })
      fireSpatialTarget(x, y, target.z)
    },
    [target.z, onTargetChange, fireSpatialTarget],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    draggingRef.current = false
  }, [])

  const handleZChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const z = parseFloat(e.target.value)
      onTargetChange({ ...target, z })
      fireSpatialTarget(target.x, target.y, z)
    },
    [target, onTargetChange, fireSpatialTarget],
  )

  // Target position in px
  const targetX = ((target.x / RANGE_X) + 0.5) * PAD_SIZE
  const targetY = (0.5 - (target.y / RANGE_Y)) * PAD_SIZE

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
            style={{ transform: `translate(${targetX}px, ${targetY}px)` }}
          />
        </div>
        <div className="cal-target-mini-z">
          <span className="cal-target-mini-z-label">Z</span>
          <input
            type="range"
            min={0}
            max={RANGE_Z}
            step={0.25}
            value={target.z}
            onChange={handleZChange}
            className="cal-target-mini-z-slider"
          />
          <span className="cal-target-mini-z-value">{target.z.toFixed(1)}m</span>
        </div>
      </div>
      <div className="cal-target-mini-coords">
        X: {target.x.toFixed(1)}m · Y: {target.y.toFixed(1)}m · Z: {target.z.toFixed(1)}m
      </div>
    </div>
  )
}

export default CalibrationTargetMini
