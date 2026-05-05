/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ KINETICS CATHEDRAL — Main Kinematic Control Panel (WAVE 4561)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Panel principal de control cinemático. Reemplaza la sidebar cuando
 * está activo. Vive DENTRO de HyperionView (no es una tab de nav).
 *
 * LAYOUT:
 *   ┌──────────────────────────────────────┐
 *   │ CathedralHeader                      │
 *   ├───────────────────────┬──────────────┤
 *   │ OrthoRadar            │ TacticalFader│
 *   │ (main radar control)  │ SPEED + AMP  │
 *   ├───────────────────────┴──────────────┤
 *   │ ModeBar [AUTO][DEGREES][3D]          │
 *   │ ChaosOrderSlider                     │
 *   │ PatternArsenal                       │
 *   │ PositionReadout                      │
 *   ├──────────────────────────────────────┤
 *   │ CathedralFooter                      │
 *   └──────────────────────────────────────┘
 *
 * STATE: movementStore (Zustand) — persiste entre cambios de sidebar mode.
 *
 * ADIABATIC DETECTION: Auto-detect radar mode (classic vs spatial) basado
 * en si los fixtures seleccionados tienen position 3D en stageStore.
 *
 * @module components/hyperion/kinetics/KineticsCathedral
 * @version WAVE 4561
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useShallow } from 'zustand/shallow'

import { useMovementStore, type RadarMode, type PatternType } from '../../../stores/movementStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'

import { OrthoRadar } from './OrthoRadar'
import type { RadarFixtureGhost } from './OrthoRadar'
import { TacticalFader } from './TacticalFader'
import { PatternArsenal } from './PatternArsenal'
import { ChaosOrderSlider } from './ChaosOrderSlider'
import { PositionReadout } from './PositionReadout'
import { CathedralFooter } from './CathedralFooter'
import type { Target3D, IKResult } from '../../../engine/movement/InverseKinematicsEngine'

import './KineticsCathedral.css'

// ─────────────────────────────────────────────────────────────────────────────
// ADIABATIC DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WAVE 4561: Paradoja Adiabática — detecta automáticamente el modo del radar.
 * Si todos los fixtures seleccionados tienen posición 3D en stageStore → spatial.
 * Cualquier fixture sin posición → classic.
 * El override manual del operador siempre gana.
 */
function useAdiabaticRadarMode(
  selectedIds: string[],
  stageFixtures: Array<{ id: string; position?: unknown }>,
  override: RadarMode | null
): RadarMode {
  return useMemo((): RadarMode => {
    if (override !== null) return override
    if (selectedIds.length === 0) return 'classic'
    const allHavePosition = selectedIds.every(id => {
      const sf = stageFixtures.find(f => f.id === id)
      return sf?.position != null
    })
    return allHavePosition ? 'spatial' : 'classic'
  }, [selectedIds, stageFixtures, override])
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface KineticsCathedralProps {
  onClose?: () => void
}

export const KineticsCathedral: React.FC<KineticsCathedralProps> = ({ onClose }) => {
  // ── Stores ─────────────────────────────────────────────────────────────
  const selectedIds = useSelectionStore(s => Array.from(s.selectedIds))
  const stageFixtures = useStageStore(s => s.fixtures)
  const stageFromStore = useStageStore(s => s.stage)
  const hardware = useHardware()

  const {
    // Classic
    pan, tilt, fanValue,
    // Spatial
    spatialTarget, spatialFanMode, spatialFanAmplitude,
    spatialReachability, spatialSubTargets,
    // Radar mode
    radarModeOverride,
    // Pattern
    activePattern, patternSpeed, patternAmplitude,
    // Chaos
    chaosAmount, chaosSeed,
  } = useMovementStore(useShallow(s => ({
    pan: s.pan, tilt: s.tilt, fanValue: s.fanValue,
    spatialTarget: s.spatialTarget,
    spatialFanMode: s.spatialFanMode,
    spatialFanAmplitude: s.spatialFanAmplitude,
    spatialReachability: s.spatialReachability,
    spatialSubTargets: s.spatialSubTargets,
    radarModeOverride: s.radarModeOverride,
    activePattern: s.activePattern,
    patternSpeed: s.patternSpeed,
    patternAmplitude: s.patternAmplitude,
    chaosAmount: s.chaosAmount,
    chaosSeed: s.chaosSeed,
  })))

  const {
    setPanTilt, setSpatialTarget, setSpatialFanMode, setSpatialFanAmplitude,
    setSpatialReachability, setSpatialSubTargets,
    setRadarModeOverride, setActivePattern, setPatternSpeed, setPatternAmplitude,
    setChaosAmount, reseed, hydrateFromBackend, resetToDefaults,
  } = useMovementStore(useShallow(s => ({
    setPanTilt: s.setPanTilt,
    setSpatialTarget: s.setSpatialTarget,
    setSpatialFanMode: s.setSpatialFanMode,
    setSpatialFanAmplitude: s.setSpatialFanAmplitude,
    setSpatialReachability: s.setSpatialReachability,
    setSpatialSubTargets: s.setSpatialSubTargets,
    setRadarModeOverride: s.setRadarModeOverride,
    setActivePattern: s.setActivePattern,
    setPatternSpeed: s.setPatternSpeed,
    setPatternAmplitude: s.setPatternAmplitude,
    setChaosAmount: s.setChaosAmount,
    reseed: s.reseed,
    hydrateFromBackend: s.hydrateFromBackend,
    resetToDefaults: s.resetToDefaults,
  })))

  // ── Refs (para handlers de drag — sin re-render) ──────────────────────
  const spatialTargetRef = useRef<Target3D>(spatialTarget)
  const spatialFanModeRef = useRef(spatialFanMode)
  const spatialFanAmplitudeRef = useRef(spatialFanAmplitude)

  useEffect(() => { spatialTargetRef.current = spatialTarget }, [spatialTarget])
  useEffect(() => { spatialFanModeRef.current = spatialFanMode }, [spatialFanMode])
  useEffect(() => { spatialFanAmplitudeRef.current = spatialFanAmplitude }, [spatialFanAmplitude])

  // ── Adiabatic Detection ────────────────────────────────────────────────
  const radarMode = useAdiabaticRadarMode(selectedIds, stageFixtures, radarModeOverride)

  // ── Check if selected fixtures are moving heads ────────────────────────
  const hasMovingHeads = useMemo(() => {
    const fixtures = hardware?.fixtures ?? []
    return selectedIds.some(id => {
      const f = fixtures.find((x: { id: string }) => x.id === id)
      const t = (f?.type ?? '').toLowerCase()
      return t.includes('moving') || t.includes('spot') || t.includes('beam') || t.includes('wash')
    })
  }, [selectedIds, hardware?.fixtures])

  // ── Stage ──────────────────────────────────────────────────────────────
  const stage = useMemo(() => stageFromStore ?? { width: 12, depth: 10, height: 6, gridSize: 1 }, [stageFromStore])

  // ── Fixture ghosts para el radar ──────────────────────────────────────
  const fixtureGhosts = useMemo((): RadarFixtureGhost[] => {
    if (radarMode !== 'spatial') return []
    return selectedIds.flatMap(id => {
      const sf = stageFixtures.find(f => f.id === id)
      if (!sf) return []
      return [{ id: sf.id, name: sf.name, position: (sf as any).position }]
    })
  }, [selectedIds, stageFixtures, radarMode])

  // ── Hydrate on selection change ────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const hydrate = async () => {
      if (selectedIds.length === 0) {
        resetToDefaults()
        return
      }
      try {
        const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
        if (!mounted) return
        if (result?.success && result?.state) {
          hydrateFromBackend(result.state)
        }
      } catch {
        // fallback: keep current state
      }
    }
    hydrate()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(',')])

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  /** Classic pan/tilt drag */
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

  /** Spatial target drag */
  const handleTargetChange = useCallback(async (newTarget: Target3D) => {
    setSpatialTarget(newTarget)
    spatialTargetRef.current = newTarget
    try {
      const result = await window.lux?.arbiter?.applySpatialTarget({
        target: newTarget,
        fixtureIds: selectedIds,
        fanMode: spatialFanModeRef.current,
        fanAmplitude: spatialFanAmplitudeRef.current,
      })
      if (result?.success && result.results) {
        setSpatialReachability(result.results as Record<string, IKResult>)
        const subs: Record<string, Target3D> = {}
        for (const [id, r] of Object.entries(result.results)) {
          if ((r as any).subTarget) subs[id] = (r as any).subTarget
        }
        setSpatialSubTargets(subs)
      }
    } catch {
      // Non-critical — reachability display degrades gracefully
    }
  }, [selectedIds, setSpatialTarget, setSpatialReachability, setSpatialSubTargets])

  /** Pattern change */
  const handlePatternChange = useCallback(async (pattern: PatternType) => {
    setActivePattern(pattern)
    const enginePattern = (pattern === 'none' || pattern === 'static') ? 'hold' : pattern
    try {
      await window.lux?.arbiter?.setManualFixturePattern({
        fixtureIds: selectedIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternAmplitude,
      })
    } catch {
      // Non-critical
    }
  }, [selectedIds, patternSpeed, patternAmplitude, setActivePattern])

  /** Speed fader */
  const handleSpeedChange = useCallback(async (speed: number) => {
    setPatternSpeed(speed)
    if (activePattern !== 'none' && activePattern !== 'static') {
      try {
        await window.lux?.arbiter?.setManualFixturePattern({
          fixtureIds: selectedIds,
          pattern: activePattern,
          speed,
          amplitude: patternAmplitude,
        })
      } catch { /* non-critical */ }
    }
  }, [activePattern, selectedIds, patternAmplitude, setPatternSpeed])

  /** Amplitude fader */
  const handleAmplitudeChange = useCallback(async (amplitude: number) => {
    setPatternAmplitude(amplitude)
    if (activePattern !== 'none' && activePattern !== 'static') {
      try {
        await window.lux?.arbiter?.setManualFixturePattern({
          fixtureIds: selectedIds,
          pattern: activePattern,
          speed: patternSpeed,
          amplitude,
        })
      } catch { /* non-critical */ }
    }
  }, [activePattern, selectedIds, patternSpeed, setPatternAmplitude])

  // ── IK readout values ──────────────────────────────────────────────────
  const firstReachability = selectedIds.length > 0 ? spatialReachability[selectedIds[0]] : undefined
  const ikPanDeg = firstReachability ? (firstReachability as any).pan : undefined
  const ikTiltDeg = firstReachability ? (firstReachability as any).tilt : undefined

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const noSelection = selectedIds.length === 0
  const notMoving = !hasMovingHeads && !noSelection

  return (
    <div className="kinetics-cathedral">
      {/* ── HEADER ── */}
      <div className="kinetics-cathedral__header">
        <span className="kinetics-cathedral__title">⊕ KINETICS CATHEDRAL</span>
        <span className="kinetics-cathedral__wave">WAVE 4561</span>
        {onClose && (
          <button className="kinetics-cathedral__close-btn" onClick={onClose} title="Volver a CONTROLS">
            ✕
          </button>
        )}
      </div>

      {/* ── EMPTY / NO MOVING HEADS STATES ── */}
      {noSelection && (
        <div className="kinetics-cathedral__empty">
          <div className="kinetics-cathedral__empty-icon">⊕</div>
          <div className="kinetics-cathedral__empty-text">Selecciona fixtures para controlar</div>
        </div>
      )}

      {notMoving && (
        <div className="kinetics-cathedral__empty">
          <div className="kinetics-cathedral__empty-icon">⚠</div>
          <div className="kinetics-cathedral__empty-text">No hay moving heads en la selección</div>
        </div>
      )}

      {/* ── MAIN CONTROLS ── */}
      {hasMovingHeads && (
        <>
          {/* Mode bar */}
          <div className="kinetics-cathedral__mode-bar">
            <button
              className={`kc-mode-btn ${radarModeOverride === null ? 'kc-mode-btn--active' : ''}`}
              onClick={() => setRadarModeOverride(null)}
              title="Auto-detect (Adiabatic Detection)"
            >AUTO</button>
            <button
              className={`kc-mode-btn ${radarModeOverride === 'classic' ? 'kc-mode-btn--active' : ''}`}
              onClick={() => setRadarModeOverride('classic')}
              title="Fuerza modo grados PAN/TILT"
            >DEGREES</button>
            <button
              className={`kc-mode-btn ${radarModeOverride === 'spatial' ? 'kc-mode-btn--active' : ''}`}
              onClick={() => setRadarModeOverride('spatial')}
              title="Fuerza modo IK 3D espacial"
            >3D</button>
            <span className="kc-mode-indicator">
              {radarModeOverride === null ? `AUTO → ${radarMode.toUpperCase()}` : `↑ MANUAL`}
            </span>
          </div>

          {/* ── RADAR + FADERS ROW ── */}
          <div className="kinetics-cathedral__radar-row">
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
              fixtures={fixtureGhosts}
            />

            <div className="kinetics-cathedral__faders">
              <TacticalFader
                label="SPEED"
                value={patternSpeed}
                onChange={handleSpeedChange}
                color="#FF8C00"
              />
              <TacticalFader
                label="AMP"
                value={patternAmplitude}
                onChange={handleAmplitudeChange}
                color="#FF00E5"
              />
            </div>
          </div>

          {/* ── POSITION READOUT ── */}
          <PositionReadout
            mode={radarMode}
            pan={pan}
            tilt={tilt}
            target={spatialTarget}
            ikPan={ikPanDeg}
            ikTilt={ikTiltDeg}
          />

          {/* ── CHAOS SLIDER ── */}
          <ChaosOrderSlider
            value={chaosAmount}
            onChange={setChaosAmount}
            seed={chaosSeed}
            onReseed={reseed}
          />

          {/* ── PATTERN ARSENAL ── */}
          <PatternArsenal
            activePattern={activePattern}
            onChange={handlePatternChange}
          />
        </>
      )}

      {/* ── FOOTER (siempre visible para acceso a grupos) ── */}
      <CathedralFooter />
    </div>
  )
}
