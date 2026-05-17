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
import { KineticsBridge } from '../../../bridges/KineticsBridge'
import { useKineticHydrationStore } from '../../../stores/kineticHydrationStore'

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

  // ── movementStore: SOLO el cathedralTab (UI local) y el seed (no se hidrata desde L2) ─
  const { cathedralTab, chaosSeed } = useMovementStore(useShallow(s => ({
    cathedralTab: s.cathedralTab,
    chaosSeed:    s.chaosSeed,
  })))

  // ── Acciones del movementStore — operador → bridge → IPC ──────────────
  const {
    setActivePattern, setPatternSpeed, setPatternAmplitude,
    setChaosAmount, reseed, setCathedralTab,
  } = useMovementStore(useShallow(s => ({
    setActivePattern:     s.setActivePattern,
    setPatternSpeed:      s.setPatternSpeed,
    setPatternAmplitude:  s.setPatternAmplitude,
    setChaosAmount:       s.setChaosAmount,
    reseed:               s.reseed,
    setCathedralTab:      s.setCathedralTab,
  })))

  // ── WAVE 4712: HYDRATION STORE — la verdad visual para la selección ───
  // El bridge llena este store con los snapshots L2 de los fixtures de la
  // selección. Si todos coinciden → valor numérico. Si difieren → null (mixed).
  // La UI NUNCA escribe aquí; solo lee. Las escrituras siguen yendo a
  // `movementStore`, que el bridge a su vez escribe optimísticamente aquí.
  const aggregate = useKineticHydrationStore(s => s.aggregate)
  const activePattern    = aggregate.pattern    // PatternType | null
  const patternSpeed     = aggregate.speed      // number | null
  const patternAmplitude = aggregate.amplitude  // number | null
  // chaosAmount en hydration usa rango UI -100..100 (fan signo); el slider
  // espera 0..1. Convertimos a positivo y normalizamos. null = mixed.
  const chaosAmount: number | null =
    aggregate.fan === null ? null : Math.max(0, Math.min(1, Math.abs(aggregate.fan) / 100))

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
    // WAVE 4712: patternSpeed agregado puede ser null (mixed); usar fallback 50.
    useProgrammerStore.getState().setKineticSpeed(patternSpeed ?? 50)
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

  // WAVE 4708 T1: el botón UNLOCK siempre se muestra cuando hay selección.
  // El gate antiguo (hasKineticOverride sobre fixtureOverrides) ignoraba
  // el Dual-Map del motor (_motorKineticOverrides) y dejaba al operador sin
  // forma de detener un patrón activo cuyo anchor seguía en defaults.

  const handleUnlockKinetics = useCallback(() => {
    // WAVE 4868: unlock de Cathedral debe ser estrictamente cinético.
    // Limpia solo KINETIC + motor cinético + estado UI asociado.
    // 1) NodeArbiter L2 (solo dominio KINETIC)
    useProgrammerStore.getState().releaseKinetics()
    if (selectedIds.length > 0) {
      // 2) Motor L2 + VMM legacy + KineticEngine
      void window.lux?.aether?.setManualPattern({
        fixtureIds: selectedIds,
        pattern: null,
        speed: 50,
        amplitude: 50,
      })
      // 3) VMM: limpiar phase offsets del fan residuales
      void window.lux?.aether?.setKineticFanOffsets({})
    }
    // 4) Safety net: barrer Dual-Map global del motor por si quedaron huérfanos
    void window.lux?.aether?.clearAllMotorKineticOverrides?.()
    // 5) UI: resetear patrón y dinámicas que NO disparan flush
    //    (pattern/speed/amplitude no son leídas por la subscripción classic).
    const ms = useMovementStore.getState()
    ms.setActivePattern('none')
    ms.setPatternSpeed(50)
    ms.setPatternAmplitude(50)
    // 6) WAVE 4709 T2 — RESET RADAR UI silencioso:
    //    devuelve pan/tilt/fan/chaos a defaults SIN dispar un flush a L2.
    //    Si los reseteáramos directamente, la subscripción classic del bridge
    //    grabaría el "centro" como nuevo lock manual y la IA (L0) quedaría
    //    bloqueada de retomar el control hasta el próximo click del operador.
    KineticsBridge.resetRadarSilent()
    // 7) EXORCISMO: limpiar Sets zombificados
    ms.setManualOverrideForFixtures(selectedIds, false)
    ms.setLockedFixtures(new Set())
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
          {/* Mode bar — WAVE 4708 T1: UNLOCK siempre visible mientras haya selección. */}
          <div className="kinetics-cathedral__mode-bar">
            <button
              className="kc-mode-btn kc-mode-btn--unlock"
              onClick={handleUnlockKinetics}
              title="Liberar control cinético total (Motor + Ancla L2 + UI)"
            >🔓 UNLOCK</button>
          </div>

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

          {/* ── CHAOS SLIDER ── WAVE 4712: chaosAmount agregado puede ser null (mixed) */}
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
