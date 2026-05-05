/**
 * 🔢 POSITION READOUT — Digital precision dashboard (WAVE 4561)
 *
 * Indicadores numéricos de alta precisión.
 * Classic: PAN / TILT en grados.
 * Spatial: X / Z / Y en metros + IK PAN/TILT resultante.
 */

import React from 'react'
import type { Target3D } from '../../../engine/movement/InverseKinematicsEngine'

interface PositionReadoutProps {
  mode: 'classic' | 'spatial'
  // Classic
  pan?: number     // 0-540°
  tilt?: number    // 0-270°
  // Spatial
  target?: Target3D
  ikPan?: number   // grados resultantes del IK (opcional)
  ikTilt?: number
}

export const PositionReadout: React.FC<PositionReadoutProps> = ({
  mode,
  pan = 270,
  tilt = 135,
  target = { x: 0, y: 2, z: 0 },
  ikPan,
  ikTilt,
}) => {
  const fmt = (n: number, decimals = 1) => n.toFixed(decimals)
  const sign = (n: number) => n >= 0 ? `+${fmt(n)}` : fmt(n)

  if (mode === 'spatial') {
    return (
      <div className="position-readout position-readout--spatial">
        <span className="position-readout__item">
          <span className="position-readout__key">X</span>
          <span className="position-readout__val">{sign(target.x)}m</span>
        </span>
        <span className="position-readout__item">
          <span className="position-readout__key">Z</span>
          <span className="position-readout__val">{sign(target.z)}m</span>
        </span>
        <span className="position-readout__item">
          <span className="position-readout__key">Y</span>
          <span className="position-readout__val">{fmt(target.y)}m</span>
        </span>
        {(ikPan !== undefined && ikTilt !== undefined) && (
          <>
            <span className="position-readout__divider">│</span>
            <span className="position-readout__item">
              <span className="position-readout__key">PAN</span>
              <span className="position-readout__val">{fmt(ikPan, 1)}°</span>
            </span>
            <span className="position-readout__item">
              <span className="position-readout__key">TILT</span>
              <span className="position-readout__val">{fmt(ikTilt, 1)}°</span>
            </span>
          </>
        )}
        <span className="position-readout__suffix">(IK)</span>
      </div>
    )
  }

  return (
    <div className="position-readout position-readout--classic">
      <span className="position-readout__item">
        <span className="position-readout__key">PAN</span>
        <span className="position-readout__val">{fmt(pan, 0)}°</span>
      </span>
      <span className="position-readout__item">
        <span className="position-readout__key">TILT</span>
        <span className="position-readout__val">{fmt(tilt, 0)}°</span>
      </span>
      <span className="position-readout__item position-readout__item--norm">
        <span className="position-readout__key">({fmt(pan / 540, 3)})</span>
        <span className="position-readout__key">({fmt(tilt / 270, 3)})</span>
      </span>
      <span className="position-readout__suffix">normalized</span>
    </div>
  )
}
