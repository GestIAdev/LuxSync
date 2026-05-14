/**
 * 🌪️ KINETIC SECTION — WAVE 4731: THE SPINNER
 * Control manual de rotación continua para células KINETIC (rotores, X-infinite, etc.)
 * Lee y escribe directamente en el programmer store vía ctx.cellKey.
 *
 * Dispatcha 'rotation' (0-100 → normalizado 0-1 por setCellKinetic).
 * En Hive Mind, itera sobre peerCellKeys para disparar a TODAS las células del grupo.
 */

import React, { useCallback } from 'react'
import { NodeFamily } from '../../../stores/programmer-types'
import type { CapabilityContext, CellKey } from '../../../stores/programmer-types'
import { useProgrammerStore } from '../../../stores/programmerStore'

export interface KineticSectionProps {
  ctx: CapabilityContext<NodeFamily.KINETIC>
  peerCellKeys?: readonly CellKey[]
  isExpanded: boolean
  onToggle: () => void
}

const ROTATION_PRESETS = [
  { label: 'STOP', value: 0 },
  { label: '25%',  value: 25 },
  { label: '50%',  value: 50 },
  { label: '75%',  value: 75 },
  { label: 'MAX',  value: 100 },
]

export const KineticSection: React.FC<KineticSectionProps> = ({ ctx, peerCellKeys, isExpanded, onToggle }) => {
  const ov = useProgrammerStore(s => s.cellOverrides.get(ctx.cellKey))
  const data = ov?.payload.family === NodeFamily.KINETIC ? ov.payload.data : {}

  const rotation = (data as { rotation?: number }).rotation !== undefined
    ? Math.round(((data as { rotation?: number }).rotation ?? 0) * 100)
    : null

  const hasOverride  = rotation !== null
  const sliderValue  = rotation ?? 0
  const displayLabel = rotation === null ? '-' : (rotation === 0 ? 'STOP' : `${rotation}%`)

  // WAVE 4731: Hive Mind — dispatch simultáneo a todas las células del grupo
  const applyKinetic = useCallback((val: number) => {
    const store = useProgrammerStore.getState()
    store.setCellKinetic(ctx.cellKey, 'rotation', val)
    if (peerCellKeys) for (const k of peerCellKeys) store.setCellKinetic(k, 'rotation', val)
  }, [ctx.cellKey, peerCellKeys])

  const applyRelease = useCallback(() => {
    const store = useProgrammerStore.getState()
    store.releaseCell(ctx.cellKey)
    if (peerCellKeys) for (const k of peerCellKeys) store.releaseCell(k)
  }, [ctx.cellKey, peerCellKeys])

  const handleRotationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    applyKinetic(Number(e.target.value))
  }, [applyKinetic])

  const handlePresetClick = useCallback((val: number) => {
    applyKinetic(val)
  }, [applyKinetic])

  const handleRelease = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    applyRelease()
  }, [applyRelease])

  return (
    <div className={`programmer-section kinetic-section ${hasOverride ? 'has-override' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="section-header clickable" onClick={onToggle}>
        <h4 className="section-title">
          <span className="section-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="title-icon" style={{ fontSize: 18 }}>🌪️</span>
          KINETIC
          <span className="section-node-label" style={{ color: 'var(--neon-base)' }}>: {ctx.label.toUpperCase()}</span>
        </h4>
        <div className="header-right">
          {hasOverride && (
            <button
              className="release-btn"
              onClick={handleRelease}
              title="Release to AI control"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="intensity-slider-container">
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={handleRotationChange}
              className="intensity-slider kinetic-slider"
            />
            <div className="intensity-value">{displayLabel}</div>
          </div>

          <div className="intensity-bar">
            <div
              className="intensity-fill kinetic-fill"
              style={{ width: `${sliderValue}%`, background: 'var(--neon-base)' }}
            />
          </div>

          <div className="intensity-presets kinetic-presets">
            {ROTATION_PRESETS.map(preset => (
              <button
                key={preset.label}
                className={`preset-btn ${rotation !== null && rotation === preset.value ? 'active' : ''}`}
                onClick={() => handlePresetClick(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {hasOverride && (
            <div className="override-badge kinetic-override">ROTOR MANUAL</div>
          )}
        </>
      )}
    </div>
  )
}

export default KineticSection
