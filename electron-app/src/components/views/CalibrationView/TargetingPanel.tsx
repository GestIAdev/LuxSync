import React, { useState, useCallback, useMemo } from 'react'
import type { FixtureV2 } from '../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// TargetingPanel — WAVE 7669 Phase 3b
//
// Numeric X/Y/Z spatial targeting module. Replaces CalibrationTargetMini's
// 2D pad + elevation slider with three unambiguous numeric inputs.
//
// F2 FIX (Spatial Amnesia): The payload includes fixturePositions (from
// stageStore's fixture.position) and fixtureIKProfiles. Without these, the
// handler falls back to the Orchestrator's stale {0,0,0} position copy.
//
// Axis semantics (inherited from engine + WAVE 7662 correction):
//   X = Stage Left/Right (meters)
//   Y = Elevation/Height (meters)
//   Z = Stage Depth, front/back (meters)
// ═══════════════════════════════════════════════════════════════════════════

const IK_ELIGIBLE_TYPES = ['moving-head', 'movinghead', 'scanner', 'spot', 'beam', 'wash-mover']

interface TargetingPanelProps {
  fixtureId: string | null
  fixture: FixtureV2 | null
  /** All stage fixtures — used to build fixturePositions + fixtureIKProfiles */
  allFixtures: FixtureV2[]
}

interface TargetState {
  x: number
  y: number
  z: number
}

const DEFAULT_TARGET: TargetState = { x: 0, y: 1.5, z: 2 }

const PRESETS: { label: string; value: TargetState }[] = [
  { label: 'Centre', value: { x: 0, y: 1.5, z: 0 } },
  { label: 'Downstage', value: { x: 0, y: 1.5, z: 3 } },
  { label: 'Upstage', value: { x: 0, y: 1.5, z: -3 } },
]

type StatusKind = 'idle' | 'aiming' | 'aimed' | 'warning' | 'error'

interface StatusState {
  kind: StatusKind
  message: string
}

export const TargetingPanel: React.FC<TargetingPanelProps> = ({
  fixtureId,
  fixture,
  allFixtures,
}) => {
  const [target, setTarget] = useState<TargetState>({ ...DEFAULT_TARGET })
  const [status, setStatus] = useState<StatusState>({ kind: 'idle', message: '' })

  // ── IK eligibility check ────────────────────────────────────────────────
  const isIKEligible = useMemo(() => {
    if (!fixture) return false
    const t = (fixture.type || '').toLowerCase()
    return IK_ELIGIBLE_TYPES.some(et => t.includes(et))
  }, [fixture])

  const isPlaced = fixture?.isPlaced === true
  const hasValidPosition = useMemo(() => {
    if (!fixture?.position) return false
    const { x, y, z } = fixture.position
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
  }, [fixture])

  const canTarget = isIKEligible && isPlaced && hasValidPosition && !!fixtureId

  // ── Preflight + dispatch ────────────────────────────────────────────────
  const handleAimTarget = useCallback(async () => {
    if (!fixtureId || !fixture) {
      setStatus({ kind: 'warning', message: 'No fixture selected.' })
      return
    }

    if (!isIKEligible) {
      setStatus({ kind: 'warning', message: 'Fixture has no pan/tilt — spatial targeting unavailable.' })
      return
    }

    if (!isPlaced) {
      setStatus({ kind: 'warning', message: 'Fixture not placed on stage — targeting will be skipped.' })
      return
    }

    if (!hasValidPosition) {
      setStatus({ kind: 'warning', message: 'Fixture has no valid position.' })
      return
    }

    setStatus({ kind: 'aiming', message: 'Aiming...' })

    // F2 FIX: Build fixturePositions + fixtureIKProfiles from stageStore
    const fixturePositions: Record<string, { x: number; y: number; z: number }> = {}
    const fixtureIKProfiles: Record<string, {
      orientation?: string
      rotation?: { pitch: number; yaw: number; roll: number }
      calibration?: { panOffset: number; tiltOffset: number; panInvert: boolean; tiltInvert: boolean }
      panRangeDeg?: number
      tiltRangeDeg?: number
      isPlaced?: boolean
    }> = {}

    for (const f of allFixtures) {
      if (f.position && Number.isFinite(f.position.x) && Number.isFinite(f.position.y) && Number.isFinite(f.position.z)) {
        fixturePositions[f.id] = { x: f.position.x, y: f.position.y, z: f.position.z }
      }
      fixtureIKProfiles[f.id] = {
        orientation: fixture.orientation,
        rotation: fixture.rotation,
        calibration: fixture.calibration,
        panRangeDeg: fixture.panRangeDeg,
        tiltRangeDeg: fixture.tiltRangeDeg,
        isPlaced: f.isPlaced,
      }
    }

    try {
      const result = await window.lux?.aether?.applySpatialTarget({
        target: { x: target.x, y: target.y, z: target.z },
        fixtureIds: [fixtureId],
        fanMode: 'converge',
        fanAmplitude: 0,
        fixturePositions,
        fixtureIKProfiles,
      })

      if (!result?.success) {
        setStatus({ kind: 'error', message: result?.error || 'Engine rejected target.' })
        return
      }

      // Compute distance for status feedback
      const dx = target.x - fixture.position!.x
      const dy = target.y - fixture.position!.y
      const dz = target.z - fixture.position!.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      const subTargetCount = result.subTargets ? Object.keys(result.subTargets).length : 0
      if (subTargetCount === 0) {
        setStatus({ kind: 'warning', message: 'Engine accepted but resolved no sub-targets.' })
      } else {
        setStatus({ kind: 'aimed', message: `Aimed — distance ${dist.toFixed(1)}m` })
      }
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) })
    }
  }, [fixtureId, fixture, isIKEligible, isPlaced, hasValidPosition, target, allFixtures])

  const handleReleaseTarget = useCallback(async () => {
    if (!fixtureId) return
    try {
      await window.lux?.aether?.releaseSpatialTarget({ fixtureIds: [fixtureId] })
      setStatus({ kind: 'idle', message: 'Target released.' })
    } catch (err) {
      setStatus({ kind: 'error', message: `Release failed: ${String(err)}` })
    }
  }, [fixtureId])

  const handlePreset = useCallback((preset: TargetState) => {
    setTarget({ ...preset })
  }, [])

  const handleNumChange = useCallback((axis: 'x' | 'y' | 'z', value: string) => {
    const v = parseFloat(value)
    if (!Number.isFinite(v)) return
    setTarget(prev => ({ ...prev, [axis]: v }))
  }, [])

  // ── Status styling ──────────────────────────────────────────────────────
  const statusClass = `targeting-status targeting-status--${status.kind}`

  // ── Disabled state ──────────────────────────────────────────────────────
  const inputsDisabled = !fixtureId

  return (
    <div className="targeting-panel">
      <div className="panel-header">
        <span className="panel-title">🎯 TARGETING (SPATIAL)</span>
      </div>

      <div className="targeting-content">
        {!isIKEligible && fixture ? (
          <div className="targeting-disabled-notice">
            Fixture has no pan/tilt — spatial targeting unavailable.
          </div>
        ) : !isPlaced && isIKEligible ? (
          <div className="targeting-disabled-notice">
            ⚠ Fixture not placed on stage — targeting will be skipped by the engine.
          </div>
        ) : null}

        <div className="targeting-inputs">
          <label className="targeting-field">
            <span className="targeting-field-label">X — Stage L/R</span>
            <input
              type="number"
              step={0.25}
              value={Number(target.x.toFixed(2))}
              onChange={(e) => handleNumChange('x', e.target.value)}
              disabled={inputsDisabled}
              className="targeting-num-input"
            />
            <span className="targeting-unit">m</span>
          </label>

          <label className="targeting-field">
            <span className="targeting-field-label">Y — Elevation</span>
            <input
              type="number"
              step={0.25}
              value={Number(target.y.toFixed(2))}
              onChange={(e) => handleNumChange('y', e.target.value)}
              disabled={inputsDisabled}
              className="targeting-num-input"
            />
            <span className="targeting-unit">m</span>
          </label>

          <label className="targeting-field">
            <span className="targeting-field-label">Z — Depth</span>
            <input
              type="number"
              step={0.25}
              value={Number(target.z.toFixed(2))}
              onChange={(e) => handleNumChange('z', e.target.value)}
              disabled={inputsDisabled}
              className="targeting-num-input"
            />
            <span className="targeting-unit">m</span>
          </label>
        </div>

        <div className="targeting-presets">
          {PRESETS.map(p => (
            <button
              key={p.label}
              className="targeting-preset-btn"
              onClick={() => handlePreset(p.value)}
              disabled={inputsDisabled}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="targeting-actions">
          <button
            className="action-btn primary targeting-aim-btn"
            onClick={handleAimTarget}
            disabled={!canTarget || status.kind === 'aiming'}
          >
            {status.kind === 'aiming' ? '...' : 'AIM TARGET'}
          </button>
          <button
            className="action-btn targeting-release-btn"
            onClick={handleReleaseTarget}
            disabled={!fixtureId}
          >
            RELEASE
          </button>
        </div>

        {status.message && (
          <div className={statusClass}>{status.message}</div>
        )}
      </div>
    </div>
  )
}

export default TargetingPanel
