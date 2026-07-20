import React, { useMemo } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// MultiInspector — Operaciones de grupo para multi-selección
// PROYECTO EREBUS FASE 8
//
// Muestra el recuento de elementos seleccionados y operaciones de grupo:
// agrupar, alinear, distribuir, eliminar.
// ═══════════════════════════════════════════════════════════════════════════

interface MultiInspectorProps {
  selectedIds: string[]
}

export const MultiInspector: React.FC<MultiInspectorProps> = ({ selectedIds }) => {
  const fixtures = useStageStore(s => s.fixtures)
  const removeFixture = useStageStore(s => s.removeFixture)
  const deselectAll = useSelectionStore(s => s.deselectAll)

  const selectedFixtures = useMemo(
    () => fixtures.filter(f => selectedIds.includes(f.id)),
    [fixtures, selectedIds],
  )

  const avgPosition = useMemo(() => {
    if (selectedFixtures.length === 0) return { x: 0, y: 0, z: 0 }
    const sum = selectedFixtures.reduce(
      (acc, f) => ({
        x: acc.x + f.position.x,
        y: acc.y + f.position.y,
        z: acc.z + f.position.z,
      }),
      { x: 0, y: 0, z: 0 },
    )
    return {
      x: sum.x / selectedFixtures.length,
      y: sum.y / selectedFixtures.length,
      z: sum.z / selectedFixtures.length,
    }
  }, [selectedFixtures])

  const handleDelete = () => {
    selectedIds.forEach(id => removeFixture(id))
    deselectAll()
  }

  return (
    <div className="erebus-multi-inspector">
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Selected</span>
        <span className="erebus-inspector-value">{selectedIds.length} fixtures</span>
      </div>

      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Avg Position</div>
        <div className="erebus-coord-grid">
          <div className="erebus-coord">
            <span className="erebus-coord-axis">X</span>
            <span className="erebus-coord-value">{avgPosition.x.toFixed(2)}m</span>
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Y</span>
            <span className="erebus-coord-value">{avgPosition.y.toFixed(2)}m</span>
          </div>
          <div className="erebus-coord">
            <span className="erebus-coord-axis">Z</span>
            <span className="erebus-coord-value">{avgPosition.z.toFixed(2)}m</span>
          </div>
        </div>
      </div>

      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Group Actions</div>
        <div className="erebus-multi-actions">
          <button className="erebus-multi-btn" title="Align to average X">
            Align X
          </button>
          <button className="erebus-multi-btn" title="Align to average Z">
            Align Z
          </button>
          <button className="erebus-multi-btn" title="Distribute evenly">
            Distribute
          </button>
          <button
            className="erebus-multi-btn erebus-multi-btn--danger"
            onClick={handleDelete}
            title="Delete all selected"
          >
            Delete All
          </button>
        </div>
      </div>

      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Fixture List</div>
        <div className="erebus-anchored-list">
          {selectedFixtures.map(f => (
            <div key={f.id} className="erebus-anchored-item">
              <span className="erebus-anchored-id">{f.id}</span>
              <span className="erebus-anchored-type">{f.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MultiInspector
