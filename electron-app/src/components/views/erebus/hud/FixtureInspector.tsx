import React, { useCallback } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import {
  snapToVoxel,
  clampToCrystalBox,
  VOXEL_SIZE,
  CANONICAL_ZONES,
} from '../../../../core/stage/ShowFileV2'
import type { FixtureV2, InstallationOrientation, CanonicalZone } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// FixtureInspector — Datos de un foco seleccionado
// PROYECTO EREBUS FASE 8
//
// Muestra ID, coordenadas XYZ vivas, orientación y mini-gizmo 3D.
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureInspectorProps {
  fixtureId: string
}

export const FixtureInspector: React.FC<FixtureInspectorProps> = ({ fixtureId }) => {
  const fixture = useStageStore(s => s.fixtures.find(f => f.id === fixtureId))
  // WAVE 7631-DIAG: Log what position the inspector reads
  console.log(`[FixtureInspector] 📖 ${fixtureId} position=`, fixture?.position)
  const updateFixturePosition = useStageStore(s => s.updateFixturePosition)
  const updateFixture = useStageStore(s => s.updateFixture)
  const setFixtureZone = useStageStore(s => s.setFixtureZone)

  const handleOrientationChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!fixture) return
      const newOrientation = e.target.value as InstallationOrientation
      updateFixture(fixture.id, { orientation: newOrientation })
    },
    [fixture, updateFixture],
  )

  const handleZoneChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!fixture) return
      setFixtureZone(fixture.id, e.target.value as CanonicalZone)
    },
    [fixture, setFixtureZone],
  )

  if (!fixture) {
    return <div className="erebus-inspector-empty">Fixture not found</div>
  }

  const { position, orientation, zone, type } = fixture

  const handlePosChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newPos = { ...position, [axis]: snapToVoxel(value) }
    // WAVE 7608: Use dynamic stage dimensions from store (was hardcoded 12×8×6)
    const stage = useStageStore.getState().showFile?.stage
    const clamped = clampToCrystalBox(newPos, stage ?? { width: 50, depth: 25, height: 15, gridSize: VOXEL_SIZE })
    updateFixturePosition(fixture.id, clamped)
  }

  return (
    <div className="erebus-fixture-inspector">
      {/* Header */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">ID</span>
        <span className="erebus-inspector-value">{fixture.id}</span>
      </div>

      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Type</span>
        <span className="erebus-inspector-value">{type}</span>
      </div>

      {/* Live coordinates — editable */}
      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Position</div>
        <div className="erebus-coord-grid">
          <div className="erebus-coord">
            <span className="erebus-coord-axis">X</span>
            <input
              className="erebus-coord-input"
              type="number"
              step={0.25}
              value={Number(position.x.toFixed(2))}
              onChange={(e) => handlePosChange('x', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Y</span>
            <input
              className="erebus-coord-input"
              type="number"
              step={0.25}
              value={Number(position.y.toFixed(2))}
              onChange={(e) => handlePosChange('y', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Z</span>
            <input
              className="erebus-coord-input"
              type="number"
              step={0.25}
              value={Number(position.z.toFixed(2))}
              onChange={(e) => handlePosChange('z', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Orientation — editable dropdown */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Orientation</span>
        <select
          className="erebus-inspector-select"
          value={orientation}
          onChange={handleOrientationChange}
        >
          <option value="ceiling">ceiling</option>
          <option value="truss-front">truss-front</option>
          <option value="truss-back">truss-back</option>
          <option value="floor">floor</option>
          <option value="totem">totem</option>
          <option value="wall-left">wall-left</option>
          <option value="wall-right">wall-right</option>
        </select>
      </div>

      {/* Zone — editable dropdown */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Zone</span>
        <select
          className="erebus-inspector-select"
          value={zone}
          onChange={handleZoneChange}
        >
          {CANONICAL_ZONES.map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>

      {/* Mini orientation gizmo */}
      <div className="erebus-inspector-gizmo">
        <svg viewBox="-1 -1 2 2" width="60" height="60">
          {/* Ground plane */}
          <ellipse cx="0" cy="0.3" rx="0.6" ry="0.15" fill="none" stroke="var(--obs-line, #2A3040)" strokeWidth="0.02" />
          {/* Fixture marker */}
          <circle cx="0" cy={-position.y * 0.08} r="0.08" fill="var(--obs-accent, #5EEAD4)" />
          {/* Vertical line to ground */}
          <line x1="0" y1={-position.y * 0.08} x2="0" y2="0.3" stroke="var(--obs-ink, #8B94A8)" strokeWidth="0.015" strokeDasharray="0.05 0.03" />
          {/* Height label */}
          <text x="0.15" y={-position.y * 0.08} fill="var(--obs-ink, #8B94A8)" fontSize="0.08" fontFamily="monospace">
            {position.y.toFixed(1)}m
          </text>
        </svg>
      </div>
    </div>
  )
}

export default FixtureInspector
