/**
 * 🎯 KIN RADAR VIEWPORT — WAVE 4564: THE RADAR RELOCATION
 *
 * Radar gigante que ocupa el Main Viewport de Hyperion cuando el modo KIN
 * está activo. Consume directamente movementStore y selectionStore —
 * idéntico al OrthoRadar dentro de KineticsCathedral pero sin la limitación
 * de sidebar (ocupa 100% del área de lienzo central).
 *
 * No duplica lógica: la misma Cathedral sidebar sigue manejando los controles.
 * Este componente solo es el "gran ojo" del escenario.
 *
 * @module components/hyperion/kinetics/KinRadarViewport
 * @version WAVE 4564
 */

import React, { useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/shallow'
import { useMovementStore } from '../../../stores/movementStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useAdiabaticRadarMode } from '../../../hooks/useAdiabaticRadarMode'
import { OrthoRadar, type RadarFixtureGhost } from './OrthoRadar'
import { PositionReadout } from './PositionReadout'
import './KinRadarViewport.css'

export const KinRadarViewport: React.FC = () => {
  // ── Stores ──────────────────────────────────────────────────────────────
  const selectedIds = useSelectionStore(useShallow(s => Array.from(s.selectedIds)))
  const stageFixtures = useStageStore(s => s.fixtures)
  const stageFromStore = useStageStore(s => s.stage)

  const {
    pan, tilt, fanValue,
    spatialTarget, spatialFanMode, spatialFanAmplitude,
    spatialReachability, spatialSubTargets,
    radarModeOverride,
  } = useMovementStore(useShallow(s => ({
    pan: s.pan,
    tilt: s.tilt,
    fanValue: s.fanValue,
    spatialTarget: s.spatialTarget,
    spatialFanMode: s.spatialFanMode,
    spatialFanAmplitude: s.spatialFanAmplitude,
    spatialReachability: s.spatialReachability,
    spatialSubTargets: s.spatialSubTargets,
    radarModeOverride: s.radarModeOverride,
  })))

  const { setPanTilt, setSpatialTarget } = useMovementStore(useShallow(s => ({
    setPanTilt: s.setPanTilt,
    setSpatialTarget: s.setSpatialTarget,
  })))

  // ── Derived ──────────────────────────────────────────────────────────────
  const stage = useMemo(
    () => stageFromStore ?? { width: 12, depth: 10, height: 6, gridSize: 1 },
    [stageFromStore],
  )

  const radarMode = useAdiabaticRadarMode(selectedIds, stageFixtures, radarModeOverride)

  const fixtureGhosts = useMemo((): RadarFixtureGhost[] => {
    if (radarMode !== 'spatial') return []
    return selectedIds.flatMap(id => {
      const sf = stageFixtures.find(f => f.id === id)
      if (!sf) return []
      const t = (sf.type ?? '').toLowerCase()
      const isMoving = t === 'moving-head' || t === 'moving_head' || t === 'spot'
        || t === 'beam' || t === 'scanner' || t === 'wash'
      return [{
        id: sf.id,
        name: sf.name,
        position: (sf as any).position,
        fixtureType: isMoving ? ('moving' as const) : ('static' as const),
      }]
    })
  }, [selectedIds, stageFixtures, radarMode])

  // IK readout del primer fixture seleccionado
  const firstReachability = selectedIds.length > 0 ? spatialReachability[selectedIds[0]] : undefined
  const ikPanDeg = firstReachability ? (firstReachability as any).pan : undefined
  const ikTiltDeg = firstReachability ? (firstReachability as any).tilt : undefined

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handlePanTiltChange = useCallback((newPan: number, newTilt: number) => {
    const SAFE_PAN = 513
    const SAFE_TILT = 256
    const sp = Math.max(0, Math.min(SAFE_PAN, newPan))
    const st = Math.max(0, Math.min(SAFE_TILT, newTilt))
    setPanTilt(sp, st)

    if (selectedIds.length > 1) {
      const basePanNorm = sp / 540
      const baseTiltNorm = st / 270
      const spread = (fanValue / 100) * 0.3
      const positions = selectedIds.map((id, i) => {
        const off = i - (selectedIds.length - 1) / 2
        const offsetX = selectedIds.length > 1 ? off * spread / (selectedIds.length - 1) : 0
        return {
          fixtureId: id,
          pan: Math.max(0, Math.min(1, basePanNorm + offsetX)) * 540,
          tilt: baseTiltNorm * 270,
        }
      })
      useProgrammerStore.getState().setPositionPerFixture(positions)
    } else {
      useProgrammerStore.getState().setPosition(sp, st)
    }
  }, [selectedIds, fanValue, setPanTilt])

  const handleTargetChange = useCallback((newTarget: import('../../../engine/movement/InverseKinematicsEngine').Target3D) => {
    setSpatialTarget(newTarget)
  }, [setSpatialTarget])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="kin-radar-viewport">
      {/* ── Header strip ── */}
      <div className="kin-radar-viewport__header">
        <span className="kin-radar-viewport__label">
          ⊕ KIN RADAR — {radarMode === 'spatial' ? 'SPATIAL 3D' : 'CLASSIC PAN/TILT'}
        </span>
        <PositionReadout
          mode={radarMode}
          pan={pan}
          tilt={tilt}
          target={spatialTarget}
          ikPan={ikPanDeg}
          ikTilt={ikTiltDeg}
        />
      </div>

      {/* ── Radar gigante ── */}
      <div className="kin-radar-viewport__radar">
        <OrthoRadar
          mode={radarMode}
          pan={pan}
          tilt={tilt}
          onPanTiltChange={handlePanTiltChange}
          target={spatialTarget}
          onTargetChange={handleTargetChange}
          stage={stage}
          reachability={spatialReachability}
          subTargets={spatialSubTargets}
          fanMode={spatialFanMode}
          fixtures={fixtureGhosts}
        />
      </div>

      {/* ── Empty state cuando no hay fixtures seleccionados ── */}
      {selectedIds.length === 0 && (
        <div className="kin-radar-viewport__empty">
          <div className="kin-radar-viewport__empty-icon">⊕</div>
          <div className="kin-radar-viewport__empty-text">
            Selecciona fixtures en la sidebar KIN para activar el radar
          </div>
        </div>
      )}
    </div>
  )
}
