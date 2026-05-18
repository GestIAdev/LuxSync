/**
 * 🎯 KIN RADAR VIEWPORT — WAVE 4567: THE TRINITY ROUTER
 *
 * Router puro que evalúa el estado (selectedIds + radarMode + movingHeadCount)
 * y monta UNO de los tres componentes de control clásicos en el Main Viewport:
 *
 *  ┌───────────────────────────────────────────────┐
 *  │  0 moving heads (vacío/solo estáticos)      → EmptyState      │
 *  │  1 moving head  + mode classic              → XYPad            │
 *  │  N moving heads + mode classic              → RadarXY          │
 *  │  N moving heads + mode spatial              → SpatialTargetPad │
 *  └───────────────────────────────────────────────┘
 *
 * Los tres componentes ya son relative-sized (100% width, aspect-ratio).
 * Los overrides de max-height y font-scaling viven en KinRadarViewport.css.
 *
 * @module components/hyperion/kinetics/KinRadarViewport
 * @version WAVE 4567
 */

import React, { useMemo, useCallback, useState } from 'react'
import { useShallow } from 'zustand/shallow'
import { useMovementStore } from '../../../stores/movementStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useHardware } from '../../../stores/truthStore'
import { useKineticHydrationStore } from '../../../stores/kineticHydrationStore'
import { useAdiabaticRadarMode } from '../../../hooks/useAdiabaticRadarMode'

import { XYPad } from '../controls/controls/XYPad'
import { RadarXY } from '../controls/controls/RadarXY'
import { SpatialTargetPad, type SpatialFixtureGhost } from '../controls/controls/SpatialTargetPad'
import { PositionReadout } from './PositionReadout'
import type { StageDimensions } from '../../../core/stage/ShowFileV2'
import type { Target3D, SpatialFanMode } from '../../../engine/movement/InverseKinematicsEngine'
import './KinRadarViewport.css'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isMovingHead(type: string): boolean {
  const t = type.toLowerCase()
  return t === 'moving-head' || t === 'moving_head' || t === 'spot'
    || t === 'beam' || t === 'scanner' || t === 'wash'
}

type RadarKey = 'xypad' | 'radarxy' | 'spatial' | 'empty' | 'static-warning'

function resolveRadarComponent(
  selectedCount: number,
  movingHeadCount: number,
  radarModeOverride: 'spatial' | 'classic' | null,
): RadarKey {
  if (selectedCount === 0) return 'empty'
  if (movingHeadCount === 0) return 'static-warning'
  // WAVE 4881 Fase 3: el SpatialTargetPad sale de cuarentena.
  // Cuando el operador fija explícitamente radarModeOverride='spatial',
  // el viewport monta el pad de IK 3D (Francotirador). En ausencia de
  // override (null) o con override='classic' se mantiene la ruta clásica.
  if (radarModeOverride === 'spatial') return 'spatial'
  if (movingHeadCount === 1) return 'xypad'
  return 'radarxy'
}

const RADAR_LABELS: Record<RadarKey, string> = {
  xypad:          '⊕ XY PAD — CLASSIC 1:1',
  radarxy:        '⊕ RADAR XY — FORMACIÓN',
  spatial:        '⊕ SPATIAL 3D — IK TARGET',
  empty:          '⊕ KIN RADAR',
  'static-warning': '⊕ KIN RADAR — NO MOVING HEADS',
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const KinRadarViewport: React.FC = () => {
  // ── Stores ────────────────────────────────────────────────────────────────
  const selectedIds = useSelectionStore(useShallow(s => Array.from(s.selectedIds)))
  const stageFixtures = useStageStore(s => s.fixtures)
  const stageFromStore = useStageStore(s => s.stage)
  const hardware = useHardware()

  const {
    fanValue,
    spatialTarget, spatialFanMode, spatialFanAmplitude,
    spatialReachability, spatialSubTargets,
    radarModeOverride, isCalibrating,
  } = useMovementStore(useShallow(s => ({
    fanValue: s.fanValue,
    spatialTarget: s.spatialTarget,
    spatialFanMode: s.spatialFanMode,
    spatialFanAmplitude: s.spatialFanAmplitude,
    spatialReachability: s.spatialReachability,
    spatialSubTargets: s.spatialSubTargets,
    radarModeOverride: s.radarModeOverride,
    isCalibrating: s.isCalibrating,
  })))

  // ── WAVE 4712: el ancla visible del radar viene del hydration store ─────
  // Si la selección está mixta, panAnchor/tiltAnchor son null → cursor
  // se posiciona al centro (270°/135°) como estado neutral.
  const radarAggregate = useKineticHydrationStore(s => s.aggregate)
  const pan  = radarAggregate.panAnchor  ?? 270  // [0, 540] deg — fallback centro
  const tilt = radarAggregate.tiltAnchor ?? 135  // [0, 270] deg — fallback centro

  const { setPanTilt, setSpatialTarget, setSpatialFanMode, setSpatialFanAmplitude } =
    useMovementStore(useShallow(s => ({
      setPanTilt: s.setPanTilt,
      setSpatialTarget: s.setSpatialTarget,
      setSpatialFanMode: s.setSpatialFanMode,
      setSpatialFanAmplitude: s.setSpatialFanAmplitude,
    })))

  // ── Derived: clasificar fixtures seleccionados ────────────────────────────
  const { movingHeadIds, staticIds, stageForPad } = useMemo(() => {
    const hwFixtures = hardware?.fixtures ?? []
    const moving: string[] = []
    const statics: string[] = []

    for (const id of selectedIds) {
      const hf = hwFixtures.find((x: { id: string }) => x.id === id)
        ?? stageFixtures.find(f => f.id === id)
      const moving_ = isMovingHead(hf?.type ?? '')
      if (moving_) moving.push(id)
      else statics.push(id)
    }

    const stage: StageDimensions = stageFromStore ?? {
      width: 12, depth: 10, height: 6, gridSize: 1,
    }

    return { movingHeadIds: moving, staticIds: statics, stageForPad: stage }
  }, [selectedIds, hardware?.fixtures, stageFixtures, stageFromStore])

  const radarMode = useAdiabaticRadarMode(selectedIds, stageFixtures, radarModeOverride)
  const radarKey = resolveRadarComponent(selectedIds.length, movingHeadIds.length, radarModeOverride)

  // ── Ghost points para RadarXY (classic multi) ─────────────────────────────
  const ghostPoints = useMemo(() => {
    if (radarKey !== 'radarxy') return []
    const SAFE_PAN_MAX = 513
    const SAFE_TILT_MAX = 256
    // Si hay sub-targets de fan, cada ghost tiene su propia pos derivada del pan/tilt actual
    // RadarXY solo muestra posición como offset de fan
    return movingHeadIds.map((id, i) => {
      const off = i - (movingHeadIds.length - 1) / 2
      const spread = (fanValue / 100) * 0.3
      const offsetX = movingHeadIds.length > 1 ? off * spread / (movingHeadIds.length - 1) : 0
      const gPan = Math.max(0, Math.min(1, pan / SAFE_PAN_MAX + offsetX))
      const gTilt = pan / SAFE_PAN_MAX  // simplificado: mismo tilt
      return {
        id,
        x: gPan,
        y: tilt / SAFE_TILT_MAX,
        label: `F${i + 1}`,
      }
    })
  }, [radarKey, movingHeadIds, pan, tilt, fanValue])

  // ── Spatial fixture ghosts para SpatialTargetPad ──────────────────────────
  const spatialGhosts = useMemo((): SpatialFixtureGhost[] => {
    if (radarKey !== 'spatial') return []
    return selectedIds.flatMap(id => {
      const sf = stageFixtures.find(f => f.id === id)
      if (!sf || !(sf as any).position) return []
      return [{
        id: sf.id,
        name: sf.name,
        position: (sf as any).position,
        displayColor: isMovingHead(sf.type ?? '') ? '#00F0FF' : '#886644',
      }]
    })
  }, [radarKey, selectedIds, stageFixtures])

  // ── IK readout ────────────────────────────────────────────────────────────
  const firstReachability = movingHeadIds.length > 0 ? spatialReachability[movingHeadIds[0]] : undefined
  const ikPanDeg  = firstReachability ? (firstReachability as any).pan  : undefined
  const ikTiltDeg = firstReachability ? (firstReachability as any).tilt : undefined

  // ── Dismissable static-warning banner ────────────────────────────────────
  const [bannerDismissed, setBannerDismissed] = useState(false)
  // Reset al cambiar selección
  const lastSelKey = useMemo(() => selectedIds.join(','), [selectedIds])
  const prevSelKey = React.useRef(lastSelKey)
  if (prevSelKey.current !== lastSelKey) {
    prevSelKey.current = lastSelKey
    if (bannerDismissed) setBannerDismissed(false)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePanTiltChange = useCallback((newPan: number, newTilt: number) => {
    const SAFE_PAN = 513
    const SAFE_TILT = 256
    const sp = Math.max(0, Math.min(SAFE_PAN, newPan))
    const st = Math.max(0, Math.min(SAFE_TILT, newTilt))
    setPanTilt(sp, st)

    if (movingHeadIds.length > 1) {
      const basePanNorm = sp / 540
      const spread = (fanValue / 100) * 0.3
      const positions = movingHeadIds.map((id, i) => {
        const off = i - (movingHeadIds.length - 1) / 2
        const offsetX = off * spread / (movingHeadIds.length - 1)
        return {
          fixtureId: id,
          pan: Math.max(0, Math.min(1, basePanNorm + offsetX)) * 540,
          tilt: st,
        }
      })
      useProgrammerStore.getState().setPositionPerFixture(positions)
    } else {
      // WAVE 4710 S2: aislar payload al único mover activo — ignora selectedIds global
      useProgrammerStore.getState().setPositionPerFixture([{
        fixtureId: movingHeadIds[0],
        pan: sp,
        tilt: st,
      }])
    }
  }, [movingHeadIds, fanValue, setPanTilt])

  const handleCenter = useCallback(() => {
    handlePanTiltChange(256, 128)
  }, [handlePanTiltChange])

  const handleTargetChange = useCallback((t: Target3D) => {
    // WAVE 4884 Fase 1A: canal único — solo movementStore.
    // setManualOverrideForFixtures(true) fue eliminado: activaba el guard de
    // KineticsBridge que silenciaba la propia emisión del target (Dead Loop).
    // Con Aether L2 la supremacía IK espacial es automática.
    setSpatialTarget(t)
  }, [setSpatialTarget])

  const handleFanModeChange = useCallback((mode: SpatialFanMode) => {
    setSpatialFanMode(mode)
  }, [setSpatialFanMode])

  const handleFanAmplitudeChange = useCallback((amp: number) => {
    setSpatialFanAmplitude(amp)
  }, [setSpatialFanAmplitude])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="kin-radar-viewport">
      {/* ── Header strip ── */}
      <div className="kin-radar-viewport__header">
        <span className="kin-radar-viewport__label">
          {RADAR_LABELS[radarKey]}
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

      {/* ── Banner: fixtures estáticos en selección mixta ── */}
      {staticIds.length > 0 && movingHeadIds.length > 0 && !bannerDismissed && (
        <div className="kin-radar-viewport__static-banner">
          <span className="kin-radar-viewport__static-banner-text">
            ⚠ {staticIds.length} fixture{staticIds.length !== 1 ? 's' : ''} estático
            {staticIds.length !== 1 ? 's' : ''} ignorado{staticIds.length !== 1 ? 's' : ''} —
            controlando {movingHeadIds.length} moving head{movingHeadIds.length !== 1 ? 's' : ''}
          </span>
          <button
            className="kin-radar-viewport__static-banner-dismiss"
            onClick={() => setBannerDismissed(true)}
          >×</button>
        </div>
      )}

      {/* ── Canvas — el radar que corresponde ── */}
      <div className="kin-radar-viewport__canvas">

        {/* 1 moving head, classic */}
        {radarKey === 'xypad' && (
          <XYPad
            pan={pan}
            tilt={tilt}
            onChange={handlePanTiltChange}
            onCenter={handleCenter}
            disabled={isCalibrating}
          />
        )}

        {/* N moving heads, classic */}
        {radarKey === 'radarxy' && (
          <RadarXY
            pan={pan}
            tilt={tilt}
            onChange={handlePanTiltChange}
            onCenter={handleCenter}
            isCalibrating={isCalibrating}
            isGroupMode
            ghostPoints={ghostPoints}
            fixtureCount={movingHeadIds.length}
          />
        )}

        {/* WAVE 4881 Fase 3 — Spatial IK target pad activo (Francotirador) */}
        {radarKey === 'spatial' && (
          <SpatialTargetPad
            target={spatialTarget}
            onChange={handleTargetChange}
            fixtures={spatialGhosts}
            stage={stageForPad}
            disabled={isCalibrating}
            reachabilityMap={spatialReachability}
            fanMode={spatialFanMode}
            onFanModeChange={handleFanModeChange}
            fanAmplitude={spatialFanAmplitude}
            onFanAmplitudeChange={handleFanAmplitudeChange}
            subTargets={spatialSubTargets}
          />
        )}

        {/* 0 fixtures seleccionados */}
        {radarKey === 'empty' && (
          <div className="kin-radar-viewport__empty">
            <div className="kin-radar-viewport__empty-icon">⊕</div>
            <div className="kin-radar-viewport__empty-text">
              Selecciona fixtures en la sidebar KIN para activar el radar
            </div>
          </div>
        )}

        {/* Selección sin moving heads */}
        {radarKey === 'static-warning' && (
          <div className="kin-radar-viewport__empty">
            <div className="kin-radar-viewport__empty-icon">⚠</div>
            <div className="kin-radar-viewport__empty-text">
              No hay moving heads en la selección.<br />
              Los fixtures estáticos no tienen control de posición.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


