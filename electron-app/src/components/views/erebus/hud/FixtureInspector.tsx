import React from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import type { FixtureV2 } from '../../../../core/stage/ShowFileV2'

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

  if (!fixture) {
    return <div className="erebus-inspector-empty">Fixture not found</div>
  }

  const { position, orientation, rigId, type } = fixture

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

      {/* Live coordinates */}
      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Position</div>
        <div className="erebus-coord-grid">
          <div className="erebus-coord">
            <span className="erebus-coord-axis">X</span>
            <span className="erebus-coord-value">{position.x.toFixed(2)}m</span>
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Y</span>
            <span className="erebus-coord-value">{position.y.toFixed(2)}m</span>
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Z</span>
            <span className="erebus-coord-value">{position.z.toFixed(2)}m</span>
          </div>
        </div>
      </div>

      {/* Orientation */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Orientation</span>
        <span className="erebus-inspector-value">{orientation}</span>
      </div>

      {/* Rig assignment */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Rig</span>
        <span className="erebus-inspector-value">{rigId ?? '—'}</span>
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
