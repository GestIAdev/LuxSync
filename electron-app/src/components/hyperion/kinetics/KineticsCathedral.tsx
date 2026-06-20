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

import React, { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/shallow'

import { useMovementStore } from '../../../stores/movementStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useStageStore } from '../../../stores/stageStore'
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
  const stageFixtures = useStageStore(s => s.fixtures)

  // ── movementStore: SOLO el cathedralTab (UI local) y el seed (no se hidrata desde L2) ─
  const { cathedralTab, chaosSeed } = useMovementStore(useShallow(s => ({
    cathedralTab: s.cathedralTab,
    chaosSeed:    s.chaosSeed,
  })))

  // ── WAVE 4882: modo de paradigma del radar ─────────────────────────────
  // 'individual' = XY Pad 1:1, 'formation' = Radar XY multi, 'spatial' = IK 3D.
  // CathedralViewMode es estado local UI — no persiste en store ni en escena.
  type CathedralViewMode = 'individual' | 'formation' | 'spatial'
  const [viewMode, setViewMode] = useState<CathedralViewMode>('individual')

  // ── Acciones del movementStore — operador → bridge → IPC ──────────────
  const {
    setActivePattern, setPatternSpeed, setPatternAmplitude,
    setChaosAmount, reseed, setCathedralTab, setRadarModeOverride,
  } = useMovementStore(useShallow(s => ({
    setActivePattern:     s.setActivePattern,
    setPatternSpeed:      s.setPatternSpeed,
    setPatternAmplitude:  s.setPatternAmplitude,
    setChaosAmount:         s.setChaosAmount,
    reseed:                 s.reseed,
    setCathedralTab:        s.setCathedralTab,
    setRadarModeOverride:   s.setRadarModeOverride,
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
    return selectedIds.some(id => {
      const f = stageFixtures.find(x => x.id === id)
      const t = (f?.type ?? '').toLowerCase()
      return t.includes('moving') || t.includes('spot') || t.includes('beam') || t.includes('wash')
    })
  }, [selectedIds, stageFixtures])

  // WAVE 4701: La hidratación de Kinetics viene 100% desde Aether L2
  // en TheProgrammer (getL2State + getManualKineticState).

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  /** Pattern change — KineticsBridge suscribe activePattern y despacha setManualFixturePattern */
  const handlePatternChange = useCallback((pattern: string) => {
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

  // ── WAVE 4882: botonera de paradigmas ───────────────────────────────────
  const handleViewMode = useCallback((mode: CathedralViewMode) => {
    setViewMode(mode)
    // Sincronizar radarModeOverride en el store para que KinRadarViewport
    // monte el pad correcto. 'spatial' activa el IK 3D; el resto = clásico.
    setRadarModeOverride(mode === 'spatial' ? 'spatial' : null)
  }, [setRadarModeOverride])

  const handleUnlockKinetics = useCallback(() => {
    // 🔬 WAVE 6020 DIAG: Logging completo del Unlock
    console.log('[ZOMBIE-DIAG] 🚨 UNLOCK STARTED. selectedIds:', selectedIds)
    const preStore = useProgrammerStore.getState()
    const preOverrides = Array.from(preStore.fixtureOverrides.entries())
      .filter(([_, v]) => (v as any).targetX !== null || (v as any).targetY !== null || (v as any).targetZ !== null)
    const preCellOverrides = Array.from(preStore.cellOverrides.entries())
      .filter(([_, v]) => (v as any).targetX !== undefined || (v as any).targetY !== undefined || (v as any).targetZ !== undefined)
    console.log('[ZOMBIE-DIAG] Pre-Unlock fixtureOverrides con spatial:', preOverrides.map(([id, v]) => ({ id, targetX: (v as any).targetX, targetY: (v as any).targetY, targetZ: (v as any).targetZ })))
    console.log('[ZOMBIE-DIAG] Pre-Unlock cellOverrides con spatial:', preCellOverrides.map(([id, v]) => ({ id, targetX: (v as any).targetX, targetY: (v as any).targetY, targetZ: (v as any).targetZ })))

    // WAVE 4868: unlock de Cathedral debe ser estrictamente cinético.
    // Limpia solo KINETIC + motor cinético + estado UI asociado.
    // WAVE 6019.6 FIX: purgar targets espaciales ANTES de releaseKinetics
    // para que ProgrammerAetherBridge no re-inyecte targetX/Y/Z zombis
    // en el frame siguiente al Unlock.
    if (selectedIds.length > 0) {
      console.log('[ZOMBIE-DIAG] Step 1: clearSpatialTargets')
      useProgrammerStore.getState().clearSpatialTargets(selectedIds)
      // WAVE 6020.10: purgeBaseSpatial eliminado — la purga IK de nodo base
      // ahora ocurre de forma atómica dentro de setManualPattern RELEASE/NULL
      // (AetherIPCHandlers.ts), garantizando que el snapshot se capture ANTES
      // de borrar targetX/Y/Z y evitando la race condition que causaba tilt=0.5.
    }
    // 1) NodeArbiter L2 (solo dominio KINETIC)
    console.log('[ZOMBIE-DIAG] Step 2: releaseKinetics')
    useProgrammerStore.getState().releaseKinetics()
    if (selectedIds.length > 0) {
      // 2) Motor L2 + VMM legacy + KineticEngine
      console.log('[ZOMBIE-DIAG] Step 3: IPC setManualPattern(null)')
      void window.lux?.aether?.setManualPattern({
        fixtureIds: selectedIds,
        pattern: null,
        speed: 50,
        amplitude: 50,
      })
      // 3) VMM: limpiar phase offsets del fan residuales
      console.log('[ZOMBIE-DIAG] Step 4: IPC setKineticFanOffsets({})')
      void window.lux?.aether?.setKineticFanOffsets({})
    }
    // 4) Safety net: barrer Dual-Map global del motor por si quedaron huérfanos
    console.log('[ZOMBIE-DIAG] Step 5: IPC clearAllMotorKineticOverrides')
    void window.lux?.aether?.clearAllMotorKineticOverrides?.()
    // 5) UI: resetear patrón y dinámicas que NO disparan flush
    //    (pattern/speed/amplitude no son leídas por la subscripción classic).
    // WAVE 6020: Escudo anti-doble-disparo. setActivePattern('none')
    // dispara _flushPattern('hold') que competiría con el RELEASE anterior.
    console.log('[ZOMBIE-DIAG] Step 6: setActivePattern(none) → ESCUDO _isUnlocking ON')
    const ms = useMovementStore.getState()
    ms.setIsUnlocking(true)
    ms.setActivePattern('none')
    ms.setPatternSpeed(50)
    setTimeout(() => {
      useMovementStore.getState().setIsUnlocking(false)
      console.log('[ZOMBIE-DIAG] _isUnlocking shield OFF (50ms)')
    }, 50)
    ms.setPatternAmplitude(50)
    // 6) WAVE 4709 T2 — RESET RADAR UI silencioso:
    //    devuelve pan/tilt/fan/chaos a defaults SIN dispar un flush a L2.
    //    Si los reseteáramos directamente, la subscripción classic del bridge
    //    grabaría el "centro" como nuevo lock manual y la IA (L0) quedaría
    //    bloqueada de retomar el control hasta el próximo click del operador.
    console.log('[ZOMBIE-DIAG] Step 7: resetRadarSilent')
    KineticsBridge.resetRadarSilent()
    // 7) EXORCISMO: limpiar Sets zombificados
    ms.setManualOverrideForFixtures(selectedIds, false)
    ms.setLockedFixtures(new Set())
    // 8) WAVE 4882: resetear paradigma de radar al estado neutro
    ms.setRadarModeOverride(null)
    setViewMode('individual')
    console.log('[ZOMBIE-DIAG] ✅ UNLOCK SEQUENCE COMPLETE')
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
          <button className="kinetics-cathedral__close-btn" onClick={onClose} title="Back to CONTROLS">
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
          <div className="kinetics-cathedral__empty-text">Select fixtures to control</div>
        </div>
      )}

      {notMoving && (
        <div className="kinetics-cathedral__empty">
          <div className="kinetics-cathedral__empty-icon">⚠</div>
          <div className="kinetics-cathedral__empty-text">No moving heads in the selection</div>
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
              title="Release full kinetic control (Engine + L2 Anchor + UI)"
            >🔓 UNLOCK</button>
          </div>

          {/* ── PARADIGM SELECTOR — WAVE 4882 ── */}
          <div className="kc-paradigm-bar">
            <button
              className={`kc-paradigm-btn${viewMode === 'individual' ? ' kc-paradigm-btn--active' : ''}`}
              onClick={() => handleViewMode('individual')}
              title="1:1 individual control - classic XY Pad"
            >
              <span className="kc-paradigm-btn__icon">⊕</span>
              <span className="kc-paradigm-btn__label">INDIVIDUAL</span>
            </button>
            <button
              className={`kc-paradigm-btn${viewMode === 'formation' ? ' kc-paradigm-btn--active' : ''}`}
              onClick={() => handleViewMode('formation')}
              title="Multi-fixture formation - Radar XY with fan"
            >
              <span className="kc-paradigm-btn__icon">⋮⋮</span>
              <span className="kc-paradigm-btn__label">FORMATION</span>
            </button>
            <button
              className={`kc-paradigm-btn kc-paradigm-btn--spatial${viewMode === 'spatial' ? ' kc-paradigm-btn--active' : ''}`}
              onClick={() => handleViewMode('spatial')}
              title="IK 3D spatial targeting - Sniper"
            >
              <span className="kc-paradigm-btn__icon">🎯</span>
              <span className="kc-paradigm-btn__label">SPATIAL</span>
            </button>
          </div>

          {/* ── RADAR EMBED ── WAVE 4647: centro de mando integrado en la Cathedral ── */}
          <div className="kinetics-cathedral__radar-embed">
            <KinRadarViewport />
          </div>

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
