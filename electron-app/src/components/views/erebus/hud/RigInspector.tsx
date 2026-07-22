import React, { useMemo } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { snapToVoxel } from '../../../../core/stage/ShowFileV2'
import type { RigV2 } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// RigInspector — Datos de un truss/tótem seleccionado
// PROYECTO EREBUS FASE 8
//
// Muestra longitud, altura y lista de focos anclados al rig.
// ═══════════════════════════════════════════════════════════════════════════

interface RigInspectorProps {
  rigId: string
}

export const RigInspector: React.FC<RigInspectorProps> = ({ rigId }) => {
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const fixtures = useStageStore(s => s.fixtures)
  const updateRig = useStageStore(s => s.updateRig)
  const removeRig = useStageStore(s => s.removeRig)

  const rig = useMemo(() => rigs.find(r => r.id === rigId), [rigs, rigId])

  const anchoredFixtures = useMemo(
    () => fixtures.filter(f => f.rigId === rigId),
    [fixtures, rigId],
  )

  if (!rig) {
    return <div className="erebus-inspector-empty">Rig not found</div>
  }

  const handlePosChange = (axis: 'x' | 'z', value: number) => {
    updateRig(rig.id, {
      position: { ...rig.position, [axis]: snapToVoxel(value) },
    })
  }

  const handleHeightChange = (value: number) => {
    updateRig(rig.id, { height: snapToVoxel(value) })
  }

  return (
    <div className="erebus-rig-inspector">
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Rig ID</span>
        <span className="erebus-inspector-value">{rig.id}</span>
      </div>

      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Orientation</span>
        <span className="erebus-inspector-value">{rig.orientation}</span>
      </div>

      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Position</div>
        <div className="erebus-coord-grid">
          <div className="erebus-coord">
            <span className="erebus-coord-axis">X</span>
            <input
              className="erebus-coord-input"
              type="number"
              step={0.25}
              value={Number(rig.position.x.toFixed(2))}
              onChange={(e) => handlePosChange('x', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Y</span>
            <input
              className="erebus-coord-input"
              type="number"
              step={0.25}
              value={Number(rig.height.toFixed(2))}
              onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Z</span>
            <input
              className="erebus-coord-input"
              type="number"
              step={0.25}
              value={Number(rig.position.z.toFixed(2))}
              onChange={(e) => handlePosChange('z', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">
          Anchored Fixtures ({anchoredFixtures.length})
        </div>
        {anchoredFixtures.length === 0 ? (
          <div className="erebus-inspector-empty">No fixtures anchored</div>
        ) : (
          <div className="erebus-anchored-list">
            {anchoredFixtures.map(f => (
              <div key={f.id} className="erebus-anchored-item">
                <span className="erebus-anchored-id">{f.id}</span>
                <span className="erebus-anchored-type">{f.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        className="erebus-rig-delete-btn"
        onClick={() => removeRig(rig.id)}
        title="Remove this rig (detaches all anchored fixtures)"
      >
        Remove Rig
      </button>
    </div>
  )
}

export default RigInspector
