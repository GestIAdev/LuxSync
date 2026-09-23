import React, { useCallback, useMemo, useState } from 'react'
import { useStageStore, generateId } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import {
  generateLinearArray,
  generateGridMatrix,
  generateCircularArray,
  generateMirrorX,
  type CircleAxis,
} from '../../../../core/stage/massOps'
import type { FixtureV2 } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// MassOpsSection — WAVE 8130-F2 (M2): Clonación Masiva en Erebus
//
// Sección del MultiInspector: Linear Array, Grid Matrix, Circular, Mirror X.
// Los clones nacen UNPATCHED (address: 0 — WAVE 7731), se inyectan vía
// addFixtures (UNA sync backend) y quedan AUTO-SELECCIONADOS → el operador
// puede borrar el resultado con "Delete All" como pseudo-undo.
//
// Las semillas iteran round-robin: una selección mixta genera patrones que
// alternan modelos (ver core/stage/massOps.ts).
// ═══════════════════════════════════════════════════════════════════════════

type MassMode = 'linear' | 'grid' | 'circular' | null

interface MassOpsSectionProps {
  /** Fixtures seleccionados que actúan como semillas (ya filtrados de rigs). */
  seeds: FixtureV2[]
}

const num = (raw: string, fallback: number): number => {
  const v = parseFloat(raw)
  return Number.isFinite(v) ? v : fallback
}

export const MassOpsSection: React.FC<MassOpsSectionProps> = ({ seeds }) => {
  const addFixtures = useStageStore(s => s.addFixtures)
  const selectMultiple = useSelectionStore(s => s.selectMultiple)

  const [mode, setMode] = useState<MassMode>(null)

  // Params — strings en el input, se parsean al Generate (fallback honesto)
  const [pCount, setPCount] = useState('4')
  const [pOffsetX, setPOffsetX] = useState('0.5')
  const [pOffsetY, setPOffsetY] = useState('0')
  const [pOffsetZ, setPOffsetZ] = useState('0')
  const [pCols, setPCols] = useState('4')
  const [pRows, setPRows] = useState('2')
  const [pSpacingX, setPSpacingX] = useState('0.5')
  const [pSpacingZ, setPSpacingZ] = useState('0.5')
  const [pRadius, setPRadius] = useState('2')
  const [pAxis, setPAxis] = useState<CircleAxis>('XZ')

  const toggle = (m: Exclude<MassMode, null>) =>
    setMode(prev => (prev === m ? null : m))

  /** Commit compartido: inyecta + autoselecciona clones (pseudo-undo). */
  const commit = useCallback(
    (clones: FixtureV2[]) => {
      if (clones.length === 0) return
      addFixtures(clones)
      selectMultiple(clones.map(c => c.id), 'replace')
      setMode(null)
    },
    [addFixtures, selectMultiple],
  )

  const idGen = useCallback(() => generateId('fix'), [])

  const previewCount = useMemo(() => {
    switch (mode) {
      case 'linear':
        return Math.max(0, Math.floor(num(pCount, 0))) * seeds.length
      case 'grid':
        return Math.max(0, Math.floor(num(pCols, 0))) * Math.max(0, Math.floor(num(pRows, 0)))
      case 'circular':
        return Math.max(0, Math.floor(num(pCount, 0)))
      default:
        return 0
    }
  }, [mode, pCount, pCols, pRows, seeds.length])

  const handleGenerate = useCallback(() => {
    switch (mode) {
      case 'linear': {
        const count = Math.max(1, Math.floor(num(pCount, 1)))
        commit(
          generateLinearArray(
            seeds,
            count,
            { x: num(pOffsetX, 0), y: num(pOffsetY, 0), z: num(pOffsetZ, 0) },
            idGen,
          ),
        )
        break
      }
      case 'grid': {
        const cols = Math.max(1, Math.floor(num(pCols, 1)))
        const rows = Math.max(1, Math.floor(num(pRows, 1)))
        commit(
          generateGridMatrix(seeds, cols, rows, num(pSpacingX, 0.25), num(pSpacingZ, 0.25), idGen),
        )
        break
      }
      case 'circular': {
        const count = Math.max(1, Math.floor(num(pCount, 1)))
        commit(generateCircularArray(seeds, count, Math.max(0.25, num(pRadius, 1)), pAxis, idGen))
        break
      }
    }
  }, [mode, seeds, pCount, pOffsetX, pOffsetY, pOffsetZ, pCols, pRows, pSpacingX, pSpacingZ, pRadius, pAxis, commit, idGen])

  const handleMirrorX = useCallback(() => {
    commit(generateMirrorX(seeds, idGen))
  }, [seeds, commit, idGen])

  if (seeds.length === 0) return null

  return (
    <div className="erebus-inspector-section">
      <div className="erebus-inspector-section-title">Mass Operations</div>
      <div className="erebus-multi-actions">
        <button
          className={`erebus-multi-btn${mode === 'linear' ? ' erebus-multi-btn--active' : ''}`}
          onClick={() => toggle('linear')}
          title="Repeat selection N times along an XYZ offset"
        >
          Linear
        </button>
        <button
          className={`erebus-multi-btn${mode === 'grid' ? ' erebus-multi-btn--active' : ''}`}
          onClick={() => toggle('grid')}
          title="Fill a cols×rows grid anchored at first selected"
        >
          Grid
        </button>
        <button
          className={`erebus-multi-btn${mode === 'circular' ? ' erebus-multi-btn--active' : ''}`}
          onClick={() => toggle('circular')}
          title="Ring around the selection centroid"
        >
          Circular
        </button>
        <button
          className="erebus-multi-btn"
          onClick={handleMirrorX}
          title="Mirror selection across the YZ plane (x → −x)"
        >
          Mirror X
        </button>
      </div>

      {mode === 'linear' && (
        <div className="erebus-massops-form">
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Count</span>
            <input className="erebus-coord-input" type="number" min={1} step={1} value={pCount} onChange={e => setPCount(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">ΔX</span>
            <input className="erebus-coord-input" type="number" step={0.25} value={pOffsetX} onChange={e => setPOffsetX(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">ΔY</span>
            <input className="erebus-coord-input" type="number" step={0.25} value={pOffsetY} onChange={e => setPOffsetY(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">ΔZ</span>
            <input className="erebus-coord-input" type="number" step={0.25} value={pOffsetZ} onChange={e => setPOffsetZ(e.target.value)} />
          </div>
        </div>
      )}

      {mode === 'grid' && (
        <div className="erebus-massops-form">
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Cols</span>
            <input className="erebus-coord-input" type="number" min={1} step={1} value={pCols} onChange={e => setPCols(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Rows</span>
            <input className="erebus-coord-input" type="number" min={1} step={1} value={pRows} onChange={e => setPRows(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Gap X</span>
            <input className="erebus-coord-input" type="number" step={0.25} value={pSpacingX} onChange={e => setPSpacingX(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Gap Z</span>
            <input className="erebus-coord-input" type="number" step={0.25} value={pSpacingZ} onChange={e => setPSpacingZ(e.target.value)} />
          </div>
        </div>
      )}

      {mode === 'circular' && (
        <div className="erebus-massops-form">
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Count</span>
            <input className="erebus-coord-input" type="number" min={1} step={1} value={pCount} onChange={e => setPCount(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Radius</span>
            <input className="erebus-coord-input" type="number" min={0.25} step={0.25} value={pRadius} onChange={e => setPRadius(e.target.value)} />
          </div>
          <div className="erebus-massops-field">
            <span className="erebus-coord-axis">Plane</span>
            <select
              className="erebus-inspector-select"
              value={pAxis}
              onChange={e => setPAxis(e.target.value as CircleAxis)}
            >
              <option value="XZ">XZ (top)</option>
              <option value="XY">XY (front)</option>
              <option value="YZ">YZ (side)</option>
            </select>
          </div>
        </div>
      )}

      {mode !== null && (
        <div className="erebus-massops-footer">
          <span className="erebus-massops-preview">→ {previewCount} fixture{previewCount === 1 ? '' : 's'}</span>
          <button
            className="erebus-multi-btn erebus-multi-btn--primary"
            onClick={handleGenerate}
            disabled={previewCount === 0}
          >
            Generate
          </button>
        </div>
      )}
    </div>
  )
}

export default MassOpsSection
