import React, { useMemo, useCallback } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useSnapStore } from '../../../../stores/snapStore'
import { CANONICAL_ZONES } from '../../../../core/stage/ShowFileV2'
import type { InstallationOrientation, CanonicalZone, FixtureV2 } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// MultiInspector — Operaciones de grupo para multi-selección
// PROYECTO EREBUS FASE 8 + WAVE 7606
//
// Muestra el recuento de elementos seleccionados y operaciones de grupo:
// agrupar, alinear, distribuir, eliminar.
// WAVE 7606: Batch edit — Orientation y Zone dropdowns aplican a todos.
// ═══════════════════════════════════════════════════════════════════════════

interface MultiInspectorProps {
  selectedIds: string[]
}

export const MultiInspector: React.FC<MultiInspectorProps> = ({ selectedIds }) => {
  const fixtures = useStageStore(s => s.fixtures)
  const removeFixture = useStageStore(s => s.removeFixture)
  const updateMultipleFixtures = useStageStore(s => s.updateMultipleFixtures)
  const batchUpdateFixtures = useStageStore(s => s.batchUpdateFixtures)
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

  // WAVE 7606: Check if all selected fixtures share the same orientation/zone
  const sharedOrientation = useMemo(() => {
    if (selectedFixtures.length === 0) return ''
    const first = selectedFixtures[0].orientation
    return selectedFixtures.every(f => f.orientation === first) ? first : ''
  }, [selectedFixtures])

  const sharedZone = useMemo(() => {
    if (selectedFixtures.length === 0) return ''
    const first = selectedFixtures[0].zone
    return selectedFixtures.every(f => f.zone === first) ? first : ''
  }, [selectedFixtures])

  const handleBatchOrientation = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newOrientation = e.target.value as InstallationOrientation
      updateMultipleFixtures(selectedIds, { orientation: newOrientation })
    },
    [selectedIds, updateMultipleFixtures],
  )

  const handleBatchZone = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newZone = e.target.value as CanonicalZone
      updateMultipleFixtures(selectedIds, { zone: newZone })
    },
    [selectedIds, updateMultipleFixtures],
  )

  // WAVE 7606: Group alignment and distribution actions
  const handleAlignX = useCallback(() => {
    if (selectedFixtures.length < 2) return
    const snap = useSnapStore.getState().snap
    const avgX = snap(avgPosition.x)
    const updates = selectedFixtures.map(f => ({
      id: f.id,
      changes: { position: { ...f.position, x: avgX } },
    }))
    batchUpdateFixtures(updates)
  }, [selectedFixtures, avgPosition.x, batchUpdateFixtures])

  const handleAlignZ = useCallback(() => {
    if (selectedFixtures.length < 2) return
    const snap = useSnapStore.getState().snap
    const avgZ = snap(avgPosition.z)
    const updates = selectedFixtures.map(f => ({
      id: f.id,
      changes: { position: { ...f.position, z: avgZ } },
    }))
    batchUpdateFixtures(updates)
  }, [selectedFixtures, avgPosition.z, batchUpdateFixtures])

  const handleDistribute = useCallback(() => {
    if (selectedFixtures.length < 3) return
    // Determine which axis has more spread — distribute along that one
    const xs = selectedFixtures.map(f => f.position.x)
    const zs = selectedFixtures.map(f => f.position.z)
    const xSpread = Math.max(...xs) - Math.min(...xs)
    const zSpread = Math.max(...zs) - Math.min(...zs)
    const alongX = xSpread >= zSpread

    // Sort fixtures along the chosen axis
    const sorted = [...selectedFixtures].sort((a, b) =>
      alongX ? a.position.x - b.position.x : a.position.z - b.position.z,
    )
    const min = alongX ? sorted[0].position.x : sorted[0].position.z
    const max = alongX ? sorted[sorted.length - 1].position.x : sorted[sorted.length - 1].position.z
    const step = (max - min) / (sorted.length - 1)

    const updates = sorted.map((f, i) => {
      const snap = useSnapStore.getState().snap
      const newVal = snap(min + step * i)
      return {
        id: f.id,
        changes: alongX
          ? { position: { ...f.position, x: newVal } }
          : { position: { ...f.position, z: newVal } },
      }
    })
    batchUpdateFixtures(updates)
  }, [selectedFixtures, batchUpdateFixtures])

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

      {/* WAVE 7606: Batch Orientation — applies to ALL selected fixtures */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Orientation</span>
        <select
          className="erebus-inspector-select"
          value={sharedOrientation}
          onChange={handleBatchOrientation}
        >
          <option value="" disabled>(mixed)</option>
          <option value="ceiling">ceiling</option>
          <option value="truss-front">truss-front</option>
          <option value="truss-back">truss-back</option>
          <option value="floor">floor</option>
          <option value="totem">totem</option>
          <option value="wall-left">wall-left</option>
          <option value="wall-right">wall-right</option>
        </select>
      </div>

      {/* WAVE 7606: Batch Zone — applies to ALL selected fixtures */}
      <div className="erebus-inspector-row">
        <span className="erebus-inspector-label">Zone</span>
        <select
          className="erebus-inspector-select"
          value={sharedZone}
          onChange={handleBatchZone}
        >
          <option value="" disabled>(mixed)</option>
          {CANONICAL_ZONES.map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>

      <div className="erebus-inspector-section">
        <div className="erebus-inspector-section-title">Group Actions</div>
        <div className="erebus-multi-actions">
          <button
            className="erebus-multi-btn"
            onClick={handleAlignX}
            disabled={selectedFixtures.length < 2}
            title="Align all to average X"
          >
            Align X
          </button>
          <button
            className="erebus-multi-btn"
            onClick={handleAlignZ}
            disabled={selectedFixtures.length < 2}
            title="Align all to average Z"
          >
            Align Z
          </button>
          <button
            className="erebus-multi-btn"
            onClick={handleDistribute}
            disabled={selectedFixtures.length < 3}
            title="Distribute evenly along widest axis"
          >
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
