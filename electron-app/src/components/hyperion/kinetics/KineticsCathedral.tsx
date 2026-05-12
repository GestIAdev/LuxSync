/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ KINETICS CATHEDRAL — Control Sidebar (WAVE 4564 refactor)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sidebar de control cinemático. El OrthoRadar fue relocado al Main Viewport
 * (KinRadarViewport) en WAVE 4564. Esta sidebar alberga exclusivamente:
 *   - ModeBar [UNLOCK] (modo clásico forzado)
 *   - TacticalFader SPEED + AMP (expandidos)
 *   - ChaosOrderSlider
 *   - PatternArsenal (botones prominentes)
 *   - CathedralFooter (grupos)
 *
 * @module components/hyperion/kinetics/KineticsCathedral
 * @version WAVE 4564
 */

import React, { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'

import { useMovementStore, type PatternType } from '../../../stores/movementStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useHardware } from '../../../stores/truthStore'

import { HorizontalFader } from './HorizontalFader'
import { FixtureMatrix } from './FixtureMatrix'
import { PatternArsenal } from './PatternArsenal'
import { ChaosOrderSlider } from './ChaosOrderSlider'
import { KinRadarViewport } from './KinRadarViewport'

import './KineticsCathedral.css'

interface KineticsCathedralProps {
  onClose?: () => void
}

export const KineticsCathedral: React.FC<KineticsCathedralProps> = ({ onClose }) => {
  // ── Stores ─────────────────────────────────────────────────────────────
  const selectedIds = useSelectionStore(useShallow(s => Array.from(s.selectedIds)))
  const hardware = useHardware()

  const {
    // Pattern
    activePattern, patternSpeed, patternAmplitude,
    cathedralTab,
    // Chaos
    chaosAmount, chaosSeed,
  } = useMovementStore(useShallow(s => ({
    cathedralTab: s.cathedralTab,
    activePattern: s.activePattern,
    patternSpeed: s.patternSpeed,
    patternAmplitude: s.patternAmplitude,
    chaosAmount: s.chaosAmount,
    chaosSeed: s.chaosSeed,
  })))

  const {
    setActivePattern, setPatternSpeed, setPatternAmplitude,
    setChaosAmount, reseed, setCathedralTab,
  } = useMovementStore(useShallow(s => ({
    setActivePattern: s.setActivePattern,
    setPatternSpeed: s.setPatternSpeed,
    setPatternAmplitude: s.setPatternAmplitude,
    setChaosAmount: s.setChaosAmount,
    reseed: s.reseed,
    setCathedralTab: s.setCathedralTab,
  })))

  // ── Check if selected fixtures are moving heads ────────────────────────
  const hasMovingHeads = useMemo(() => {
    const fixtures = hardware?.fixtures ?? []
    return selectedIds.some(id => {
      const f = fixtures.find((x: { id: string }) => x.id === id)
      const t = (f?.type ?? '').toLowerCase()
      return t.includes('moving') || t.includes('spot') || t.includes('beam') || t.includes('wash')
    })
  }, [selectedIds, hardware?.fixtures])

  // WAVE 4701: La hidratación de Kinetics viene 100% desde Aether L2
  // en TheProgrammer (getL2State + getManualKineticState).

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
    // WAVE 4707 S2: el motor corre con _motorKineticOverrides, no con fixtureOverrides.
    // Cuando hay patrón activo el botón UNLOCK debe aparecer aunque el programmerStore
    // no tenga pan/tilt registrados (los patrones usan el dual-map del NodeArbiter).
    if (activePattern !== 'none') return true
    return selectedIds.some(id => {
      const ov = fixtureOverrides.get(id)
      return ov?.pan !== null || ov?.tilt !== null
    })
  }, [selectedIds, fixtureOverrides, activePattern])

  const handleUnlockKinetics = useCallback(() => {
    if (selectedIds.length === 0) return
    // WAVE 4707 S3: Unlock idéntico al de TheProgrammer — cinco capas sincrónicas.
    // 1) NodeArbiter L2: limpia pan/tilt/speed/color de todas las familias
    useProgrammerStore.getState().releaseAll()
    // 2) Inhibit limits del NodeArbiter (canal IMPACT) — FALTABA en la Cathedral
    const nodeIds = selectedIds.map(id => `${id}:impact`)
    window.lux?.aether?.clearInhibitLimit(nodeIds)
    // 3) VMM: limpiar patrón activo en masterArbiter + KineticEngine
    void window.lux?.aether?.setManualPattern({
      fixtureIds: selectedIds,
      pattern: null,
      speed: 50,
      amplitude: 50,
    })
    // WAVE L2-SUPREMACY: limpiar dual-map motor kinético (safety net)
    void window.lux?.aether?.clearAllMotorKineticOverrides?.()
    // 4) VMM: limpiar phase offsets del fan (WAVE 4717.2 residuales)
    void window.lux?.aether?.setKineticFanOffsets({})
    // 5) UI inmediata: resetear patrón en store
    useMovementStore.getState().setActivePattern('none')
    // 6) EXORCISMO (WAVE 4719): limpiar Sets zombificados
    useMovementStore.getState().setManualOverrideForFixtures(selectedIds, false)
    useMovementStore.getState().setLockedFixtures(new Set())
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
          {/* Mode bar — WAVE 4717: DEGREES y 3D en cuarentena. Classic forzado. Solo UNLOCK visible. */}
          {hasKineticOverride && (
            <div className="kinetics-cathedral__mode-bar">
              <button
                className="kc-mode-btn kc-mode-btn--unlock"
                onClick={handleUnlockKinetics}
                title="Liberar control PAN/TILT → AI controla"
              >🔓 UNLOCK</button>
            </div>
          )}

          {/* ── RADAR EMBED ── WAVE 4647: centro de mando integrado en la Cathedral ── */}
          <div className="kinetics-cathedral__radar-embed">
            <KinRadarViewport />
          </div>

          {/* SPATIAL FAN CONTROLS — WAVE 4717: en cuarentena. Solo Classic mode activo. */}

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
