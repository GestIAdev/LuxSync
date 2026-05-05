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
import { useSelectionStore } from '../../../stores/selectionStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useHardware } from '../../../stores/truthStore'
import { useStageStore } from '../../../stores/stageStore'

import { TacticalFader } from './TacticalFader'
import { PatternArsenal } from './PatternArsenal'
import { ChaosOrderSlider } from './ChaosOrderSlider'
import { CathedralFooter } from './CathedralFooter'
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
    // Spatial (para pasar al KinRadarViewport via store — Cathedral solo necesita radarModeOverride)
    radarModeOverride,
    // Pattern
    activePattern, patternSpeed, patternAmplitude,
    // Chaos
    chaosAmount, chaosSeed,
  } = useMovementStore(useShallow(s => ({
    radarModeOverride: s.radarModeOverride,
    activePattern: s.activePattern,
    patternSpeed: s.patternSpeed,
    patternAmplitude: s.patternAmplitude,
    chaosAmount: s.chaosAmount,
    chaosSeed: s.chaosSeed,
  })))

  const {
    setRadarModeOverride, setActivePattern, setPatternSpeed, setPatternAmplitude,
    setChaosAmount, reseed, hydrateFromBackend, resetToDefaults,
  } = useMovementStore(useShallow(s => ({
    setRadarModeOverride: s.setRadarModeOverride,
    setActivePattern: s.setActivePattern,
    setPatternSpeed: s.setPatternSpeed,
    setPatternAmplitude: s.setPatternAmplitude,
    setChaosAmount: s.setChaosAmount,
    reseed: s.reseed,
    hydrateFromBackend: s.hydrateFromBackend,
    resetToDefaults: s.resetToDefaults,
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

          {/* ── FADERS — SPEED + AMP (sin radar, vive en el viewport principal) ── */}
          <div className="kinetics-cathedral__faders-row">
            <TacticalFader
              label="SPEED"
              value={patternSpeed}
              onChange={handleSpeedChange}
              color="#FF8C00"
              disabled={anyLocked}
            />
            <TacticalFader
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

      {/* ── FOOTER (siempre visible para acceso a grupos) ── */}
      <CathedralFooter />
    </div>
  )
}
