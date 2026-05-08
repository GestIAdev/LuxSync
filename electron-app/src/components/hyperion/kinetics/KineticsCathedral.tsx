/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ KINETICS CATHEDRAL — Control Sidebar (WAVE 4564 refactor)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sidebar de control cinemático. El OrthoRadar fue relocado al Main Viewport
 * (KinRadarViewport) en WAVE 4564. Esta sidebar alberga exclusivamente:
 *   - ModeBar [AUTO][DEGREES][3D]
 *   - TacticalFader SPEED + AMP (expandidos)
 *   - ChaosOrderSlider
 *   - PatternArsenal (botones prominentes)
 *   - CathedralFooter (grupos)
 *
 * @module components/hyperion/kinetics/KineticsCathedral
 * @version WAVE 4564
 */

import React, { useCallback, useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'

import { useMovementStore, type RadarMode, type PatternType } from '../../../stores/movementStore'
import type { SpatialFanMode } from '../../../engine/movement/InverseKinematicsEngine'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'

import { HorizontalFader } from './HorizontalFader'
import { FixtureMatrix } from './FixtureMatrix'
import { PatternArsenal } from './PatternArsenal'
import { ChaosOrderSlider } from './ChaosOrderSlider'
import { KinRadarViewport } from './KinRadarViewport'
import { useAdiabaticRadarMode } from '../../../hooks/useAdiabaticRadarMode'

import './KineticsCathedral.css'

interface KineticsCathedralProps {
  onClose?: () => void
}

export const KineticsCathedral: React.FC<KineticsCathedralProps> = ({ onClose }) => {
  // ── Stores ─────────────────────────────────────────────────────────────
  const selectedIds = useSelectionStore(useShallow(s => Array.from(s.selectedIds)))
  const stageFixtures = useStageStore(s => s.fixtures)
  const hardware = useHardware()

  const {
    // Spatial
    radarModeOverride,
    cathedralTab,
    spatialFanMode, spatialFanAmplitude,
    // Pattern
    activePattern, patternSpeed, patternAmplitude,
    // Chaos
    chaosAmount, chaosSeed,
  } = useMovementStore(useShallow(s => ({
    radarModeOverride: s.radarModeOverride,
    cathedralTab: s.cathedralTab,
    spatialFanMode: s.spatialFanMode,
    spatialFanAmplitude: s.spatialFanAmplitude,
    activePattern: s.activePattern,
    patternSpeed: s.patternSpeed,
    patternAmplitude: s.patternAmplitude,
    chaosAmount: s.chaosAmount,
    chaosSeed: s.chaosSeed,
  })))

  const {
    setRadarModeOverride, setActivePattern, setPatternSpeed, setPatternAmplitude,
    setChaosAmount, reseed, hydrateFromBackend, setCathedralTab,
    setSpatialFanMode, setSpatialFanAmplitude,
  } = useMovementStore(useShallow(s => ({
    setRadarModeOverride: s.setRadarModeOverride,
    setActivePattern: s.setActivePattern,
    setPatternSpeed: s.setPatternSpeed,
    setPatternAmplitude: s.setPatternAmplitude,
    setChaosAmount: s.setChaosAmount,
    reseed: s.reseed,
    hydrateFromBackend: s.hydrateFromBackend,
    setCathedralTab: s.setCathedralTab,
    setSpatialFanMode: s.setSpatialFanMode,
    setSpatialFanAmplitude: s.setSpatialFanAmplitude,
  })))

  // ── Adiabatic Detection (para el mode-bar indicator) ─────────────────
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

  // ── Hydrate on selection change ────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const hydrate = async () => {
      if (selectedIds.length === 0) return
      try {
        const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
        if (!mounted) return
        if (result?.success && result?.state) {
          // Preservar posiciones de fixtures con override activo de pan/tilt
          // para evitar amnesia al cambiar selección (WAVE 4579 M2)
          const progOverrides = useProgrammerStore.getState().fixtureOverrides
          const filteredState = { ...result.state }
          for (const id of selectedIds) {
            const ov = progOverrides.get(id)
            if (ov?.pan !== null || ov?.tilt !== null) {
              delete filteredState[id]
            }
          }
          hydrateFromBackend(filteredState)
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

  /** Pattern change — KineticsBridge suscribe activePattern y despacha setManualFixturePattern */
  const handlePatternChange = useCallback((pattern: PatternType) => {
    setActivePattern(pattern)
    // Speed → programmerStore via KineticsBridge (44Hz pipeline)
    useProgrammerStore.getState().setKineticSpeed(patternSpeed)
  }, [patternSpeed, setActivePattern])

  /** Speed fader — KineticsBridge suscribe patternSpeed y despacha pattern+speed */
  const handleSpeedChange = useCallback((speed: number) => {
    setPatternSpeed(speed)
    // L2 NodeArbiter:speed channel — fluye vía 44Hz ProgrammerAetherBridge
    useProgrammerStore.getState().setKineticSpeed(speed)
  }, [setPatternSpeed])

  /** Amplitude fader — KineticsBridge suscribe patternAmplitude y despacha setManualFixturePattern */
  const handleAmplitudeChange = useCallback((amplitude: number) => {
    setPatternAmplitude(amplitude)
  }, [setPatternAmplitude])

  // ── Lock feedback — ¿algún fixture seleccionado bajo control superior? ───
  const lockedFixtureIds = useMovementStore(s => s.lockedFixtureIds)
  const anyLocked = useMemo(
    () => selectedIds.some(id => lockedFixtureIds.has(id)),
    [selectedIds, lockedFixtureIds],
  )

  // ── Kinetic overrides activos (para mostrar botón Unlock) ────────────────
  const fixtureOverrides = useProgrammerStore(s => s.fixtureOverrides)
  const hasKineticOverride = useMemo(() => {
    return selectedIds.some(id => {
      const ov = fixtureOverrides.get(id)
      return ov?.pan !== null || ov?.tilt !== null
    })
  }, [selectedIds, fixtureOverrides])

  const handleUnlockKinetics = useCallback(() => {
    // WAVE 4651: Unlock en dos capas, un solo frame coherente:
    // 1) NodeArbiter L2: limpia speed/pan/tilt/color de todas las familias
    useProgrammerStore.getState().releaseAll()
    // 2) Pattern engine (masterArbiter via ruta Aether): clear del patron activo
    //    para que las cabezas vuelvan al control IA sin patron fantasma residual
    if (selectedIds.length > 0) {
      void window.lux?.aether?.setManualPattern({
        fixtureIds: selectedIds,
        pattern: null,
        speed: 50,
        amplitude: 50,
      })
    }
    // 3) UI inmediata: resetear pattern en store sin esperar hidratacion del backend
    useMovementStore.getState().setActivePattern('none')
  }, [selectedIds])

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
        <span className="kinetics-cathedral__wave">WAVE 4568</span>
        {onClose && (
          <button className="kinetics-cathedral__close-btn" onClick={onClose} title="Volver a CONTROLS">
            ✕
          </button>
        )}
      </div>

      {/* ── SUB-TABS ── */}
      <div className="kinetics-cathedral__sub-tabs">
        <button
          className={`kc-sub-tab${cathedralTab === 'kinetics' ? ' kc-sub-tab--active' : ''}`}
          onClick={() => setCathedralTab('kinetics')}
        >
          KINETICS
        </button>
        <button
          className={`kc-sub-tab${cathedralTab === 'matrix' ? ' kc-sub-tab--active' : ''}`}
          onClick={() => setCathedralTab('matrix')}
        >
          FIXTURE MATRIX
        </button>
      </div>

      {/* ── FIXTURE MATRIX TAB ── */}
      {cathedralTab === 'matrix' && <FixtureMatrix />}

      {/* ── KINETICS TAB ── */}
      {cathedralTab === 'kinetics' && (<>

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
              className={`kc-mode-btn ${radarModeOverride === 'classic' ? 'kc-mode-btn--active' : ''}`}
              onClick={() => setRadarModeOverride('classic')}
              title="Fuerza modo grados PAN/TILT"
            >DEGREES</button>
            <button
              className={`kc-mode-btn ${radarModeOverride === 'spatial' ? 'kc-mode-btn--active' : ''}`}
              onClick={() => setRadarModeOverride('spatial')}
              title="Fuerza modo IK 3D espacial"
            >3D</button>
            {hasKineticOverride && (
              <button
                className="kc-mode-btn kc-mode-btn--unlock"
                onClick={handleUnlockKinetics}
                title="Liberar control PAN/TILT → AI controla"
              >🔓 UNLOCK</button>
            )}
            <span className="kc-mode-indicator">
              {radarModeOverride === null ? `AUTO → ${radarMode.toUpperCase()}` : `↑ MANUAL`}
            </span>
          </div>

          {/* ── RADAR EMBED ── WAVE 4647: centro de mando integrado en la Cathedral ── */}
          <div className="kinetics-cathedral__radar-embed">
            <KinRadarViewport />
          </div>

          {/* ── SPATIAL FAN CONTROLS (solo en modo 3D con múltiples fixtures) ── */}
          {radarMode === 'spatial' && selectedIds.length > 1 && (
            <div className="kinetics-cathedral__fan-controls">
              <div className="kc-fan-header">
                <span className="kc-fan-label">FAN MODE</span>
                <span className="kc-fan-mode-indicator">{spatialFanMode.toUpperCase()}</span>
              </div>
              <div className="kc-fan-mode-row">
                <button
                  className={`kc-fan-btn${spatialFanMode === 'converge' ? ' kc-fan-btn--active' : ''}`}
                  onClick={() => setSpatialFanMode('converge' as SpatialFanMode)}
                  title="Convergente — todos apuntan al mismo punto"
                  disabled={anyLocked}
                >
                  <span className="kc-fan-btn-icon">⊙</span>
                  <span className="kc-fan-btn-label">CONV</span>
                </button>
                <button
                  className={`kc-fan-btn${spatialFanMode === 'line' ? ' kc-fan-btn--active' : ''}`}
                  onClick={() => setSpatialFanMode('line' as SpatialFanMode)}
                  title="Lineal — abanico en línea recta"
                  disabled={anyLocked}
                >
                  <span className="kc-fan-btn-icon">═</span>
                  <span className="kc-fan-btn-label">LINE</span>
                </button>
                <button
                  className={`kc-fan-btn${spatialFanMode === 'circle' ? ' kc-fan-btn--active' : ''}`}
                  onClick={() => setSpatialFanMode('circle' as SpatialFanMode)}
                  title="Circular — dispersión en circunferencia"
                  disabled={anyLocked}
                >
                  <span className="kc-fan-btn-icon">◎</span>
                  <span className="kc-fan-btn-label">CIRC</span>
                </button>
              </div>
              {spatialFanMode !== 'converge' && (
                <div className="kc-fan-amplitude">
                  <span className="kc-fan-amplitude-label">SPREAD</span>
                  <input
                    type="range"
                    className="kc-fan-amplitude-slider"
                    min={0} max={10} step={0.1}
                    value={spatialFanAmplitude}
                    onChange={e => setSpatialFanAmplitude(parseFloat(e.target.value))}
                    disabled={anyLocked}
                  />
                  <span className="kc-fan-amplitude-value">{spatialFanAmplitude.toFixed(1)}m</span>
                </div>
              )}
            </div>
          )}

          {/* ── FADERS — SPEED + AMP ── */}
          <div className="kinetics-cathedral__faders-row">
            <HorizontalFader
              label="SPEED"
              value={patternSpeed}
              onChange={handleSpeedChange}
              color="#FF8C00"
              disabled={anyLocked}
            />
            <HorizontalFader
              label="AMP"
              value={patternAmplitude}
              onChange={handleAmplitudeChange}
              color="#FF00E5"
              disabled={anyLocked}
            />
          </div>

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

      </>)} {/* fin kinetics tab */}
    </div>
  )
}
