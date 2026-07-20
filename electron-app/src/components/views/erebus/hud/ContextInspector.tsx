import React, { Suspense, useMemo } from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useStageStore } from '../../../../stores/stageStore'
import { FixtureInspector } from './FixtureInspector'
import { RigInspector } from './RigInspector'
import { MultiInspector } from './MultiInspector'
import type { ToolMode } from '../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// ContextInspector — Satélite Derecho
// PROYECTO EREBUS FASE 1 + FASE 8
//
// Tarjeta flotante a la derecha (320px).
//
// Prioridad de renderizado:
//   1. toolMode === 'calibrate' → CalibrationDock (preserva Fase 1)
//   2. 1 fixture seleccionado → FixtureInspector
//   3. 1 rig seleccionado → RigInspector
//   4. >1 elemento → MultiInspector
//   5. Sin selección → null (se desvanece)
// ═══════════════════════════════════════════════════════════════════════════

const CalibrationDock = React.lazy(() => import('../calibration/CalibrationDock'))

interface ContextInspectorProps {
  toolMode: ToolMode
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({ toolMode }) => {
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const fixtures = useStageStore(s => s.fixtures)
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])

  const selectedArray = useMemo(() => [...selectedIds], [selectedIds])

  // Priority 1: Calibrate mode
  if (toolMode === 'calibrate') {
    return (
      <div className="erebus-context-inspector">
        <div className="erebus-inspector-header">
          <span className="erebus-inspector-title">Calibration</span>
        </div>
        <div className="erebus-inspector-body">
          <Suspense fallback={<div style={{ color: 'var(--obs-ink)', fontSize: 11 }}>Loading...</div>}>
            <CalibrationDock />
          </Suspense>
        </div>
      </div>
    )
  }

  // No selection → hide
  if (selectedArray.length === 0) return null

  // Determine if selection is fixtures or rigs
  const selectedFixtures = selectedArray.filter(id => fixtures.some(f => f.id === id))
  const selectedRigs = selectedArray.filter(id => rigs.some(r => r.id === id))

  return (
    <div className="erebus-context-inspector">
      <div className="erebus-inspector-header">
        <span className="erebus-inspector-title">
          {selectedArray.length === 1 ? 'Inspector' : `${selectedArray.length} Selected`}
        </span>
      </div>
      <div className="erebus-inspector-body">
        {selectedArray.length === 1 && selectedFixtures.length === 1 && (
          <FixtureInspector fixtureId={selectedFixtures[0]} />
        )}
        {selectedArray.length === 1 && selectedRigs.length === 1 && (
          <RigInspector rigId={selectedRigs[0]} />
        )}
        {selectedArray.length > 1 && (
          <MultiInspector selectedIds={selectedArray} />
        )}
        {selectedArray.length === 1 && selectedFixtures.length === 0 && selectedRigs.length === 0 && (
          <div className="erebus-inspector-empty">Unknown entity</div>
        )}
      </div>
    </div>
  )
}

export default ContextInspector
