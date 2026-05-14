/**
 * 🎹 THE PROGRAMMER - WAVE 432: HIVE MIND
 * Panel derecho de control para fixtures seleccionados
 * 
 * Arquitectura:
 * - TABS: CONTROLS | GROUPS
 * - CONTROLS: Intensity, Color, Position, Beam (Accordion)
 * - GROUPS: System + User groups con auto-switch
 * 
 * WAVE 4529: Migrado a Aether L2 via programmerStore + ProgrammerAetherBridge.
 * Los handlers ahora son síncronos — el bridge vuelca a 44Hz.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useSelectionStore, useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { useProgrammerStore } from '../../../stores/programmerStore'
import { useMovementStore } from '../../../stores/movementStore'
import { ProgrammerAetherBridge } from '../../../bridges/ProgrammerAetherBridge'
import { KineticsBridge } from '../../../bridges/KineticsBridge'

import { GroupsPanel } from './GroupsPanel'
import { CellRouter } from './CellRouter'
import { useAggregatedCapabilityCells } from '../../../hooks/useAggregatedCapabilityCells'
import { IntensityIcon, GroupIcon } from '../../icons/LuxIcons'
import './TheProgrammer.css'
import './accordion-styles.css'
import './GroupsPanel.css'

// Tab types
type ProgrammerTab = 'controls' | 'groups'

// Track which channels have manual overrides
interface OverrideState {
  dimmer: boolean
  strobe: boolean
  color: boolean
  beam: boolean
  extras: boolean
}

export const TheProgrammer: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hooks
  const selectedIds = useSelectedArray()
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // Hardware info
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // WAVE 4529: Store centralizado
  const {
    releaseAll,
    releaseProgrammer,
    syncSelection,
    hydrateFromL2,
    fixtureOverrides,
  } = useProgrammerStore()
  const hydrateMovementFromL2 = useMovementStore(s => s.hydrateFromL2)
  const pruneManualOverride = useMovementStore(s => s.pruneManualOverride)

  // WAVE 4731: HIVE MIND — células agregadas por firma de capacidad compartida
  const aggregatedGroups = useAggregatedCapabilityCells(selectedIds)


  // WAVE 432: TAB NAVIGATION
  const [activeTab, setActiveTab] = useState<ProgrammerTab>('controls')
  
  // Track which channels have manual overrides (derivado del store)
  const overrideState: OverrideState = useMemo(() => {
    if (selectedIds.length === 0) {
      return { dimmer: false, strobe: false, color: false, beam: false, extras: false }
    }
    // Basta con que al menos un fixture activo tenga override en la familia
    let dimmer = false, strobe = false, color = false, beam = false, extras = false
    for (const id of selectedIds) {
      const ov = fixtureOverrides.get(id)
      if (!ov) continue
      if (ov.dimmer !== null || ov.strobe !== null) dimmer = strobe = true
      if (ov.red !== null || ov.green !== null || ov.blue !== null) color = true
      if (ov.gobo !== null || ov.prism !== null || ov.focus !== null || ov.zoom !== null || ov.iris !== null) beam = true
      if (ov.extras.size > 0) extras = true
    }
    return { dimmer, strobe, color, beam, extras }
  }, [selectedIds, fixtureOverrides])

  // WAVE 430.5: EXCLUSIVE ACCORDION — gestionado por CellRouter desde WAVE 4735.

  // Callback for GroupsPanel to switch to controls
  const handleSwitchToControls = useCallback(() => {
    setActiveTab('controls')
  }, [])
  
  // Get fixture info
  const selectedFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds
      .map(id => fixtures.find((f: { id: string }) => f.id === id))
      .filter(Boolean)
  }, [selectedIds, hardware?.fixtures])

  // ─── WAVE 4529: Iniciar el bridge una sola vez ───────────────────────────
  useEffect(() => {
    ProgrammerAetherBridge.start()
    KineticsBridge.start()
    // Los bridges son singletons — no se detienen al desmontar
  }, [])

  // ─── WAVE 4529: Sincronizar selección con el store ───────────────────────
  useEffect(() => {
    const fixtureIds = [...selectedIds]
    syncSelection(fixtureIds)
    // Bug H: purgar override zombies del motor cinemático al cambiar selección.
    pruneManualOverride(fixtureIds)

    if (fixtureIds.length === 0) {
      hydrateMovementFromL2({
        pan: null,
        tilt: null,
        speed: null,
        pattern: 'none',
        amplitude: 0.5,
        fan: 0,
      })
      return
    }
    // Guard: no hidratar desde IPC si la pestaña CONTROLS no está visible.
    // Evita round-trips inútiles cuando el operador está en GROUPS o SCENES.
    if (!isActive) return
    let cancelled = false
    const expectedSelectionKey = fixtureIds.join(',')

    const hydrate = async () => {
      try {
        const nodeIds: string[] = []
        for (const fixtureId of fixtureIds) {
          nodeIds.push(
            `${fixtureId}:impact`,
            `${fixtureId}:color`,
            `${fixtureId}:kinetic`,
            `${fixtureId}:beam`,
            `${fixtureId}:atmosphere`,
          )
        }

        const result = await window.lux?.aether?.getL2State(nodeIds)
        if (cancelled || !result?.success || !result.overrides) return

        // Guard de carrera: evita hidratar selección vieja.
        const liveSelectionKey = useProgrammerStore.getState().activeFixtureIds.join(',')
        if (liveSelectionKey !== expectedSelectionKey) return

        hydrateFromL2(fixtureIds, result.overrides)

        const firstFixtureId = fixtureIds[0]
        const firstNodeId = `${firstFixtureId}:kinetic`
        const kinetic = result.overrides[firstNodeId]
        const kineticState = await window.lux?.aether?.getManualKineticState?.()

        const pattern = kineticState?.success
          && kineticState.active
          && kineticState.nodeIds?.includes(firstNodeId)
          ? kineticState.pattern
          : 'none'

        hydrateMovementFromL2({
          pan: typeof kinetic?.pan_base === 'number'
            ? kinetic.pan_base
            : (typeof kinetic?.pan === 'number' ? kinetic.pan : null),
          tilt: typeof kinetic?.tilt_base === 'number'
            ? kinetic.tilt_base
            : (typeof kinetic?.tilt === 'number' ? kinetic.tilt : null),
          speed: typeof kinetic?.speed === 'number' ? kinetic.speed : null,
          pattern,
          amplitude: kineticState?.success && kineticState.active ? kineticState.amplitude : 0.5,
          fan: kineticState?.success && kineticState.active ? kineticState.fan : 0,
        })
      } catch (err) {
        console.error('[TheProgrammer] L2 hydration error:', err)
      }
    }

    hydrate()
    return () => { cancelled = true }
  }, [selectedIds.join(','), isActive, syncSelection, pruneManualOverride, hydrateFromL2, hydrateMovementFromL2])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleUnlockAll = useCallback(() => {
    if (selectedIds.length === 0) return
    // 🛡️ WAVE 4730 TARGET 3: divorcio de dominios.
    // Este botón es "UNLOCK CONTROLS" — pertenece al dominio Programmer.
    // Limpia EXCLUSIVAMENTE impact/color/beam/extras y el inhibit limit.
    // El dominio cinético (pan/tilt/speed/patrones/fan offsets) queda intacto;
    // su limpieza es responsabilidad del KineticsCathedral via releaseKinetics().
    releaseProgrammer()
    const nodeIds = selectedIds.map(id => `${id}:impact`)
    window.lux?.aether?.clearInhibitLimit(nodeIds)
  }, [selectedIds, releaseProgrammer])

  // 🧨 WAVE 4730: Kill switch nuclear — borra TODO (Programmer + Cathedral).
  // Reservado para acciones explícitas tipo "Reset Show" o emergencia.
  // El botón "UNLOCK CONTROLS" del Programmer NUNCA debe llamarlo.
  const handleNuclearReset = useCallback(() => {
    if (selectedIds.length === 0) return
    releaseAll()
    const nodeIds = selectedIds.map(id => `${id}:impact`)
    window.lux?.aether?.clearInhibitLimit(nodeIds)
    void window.lux?.aether?.setManualPattern({
      fixtureIds: selectedIds,
      pattern: null,
      speed: 50,
      amplitude: 50,
    })
    void window.lux?.aether?.setKineticFanOffsets({})
    useMovementStore.getState().setActivePattern('none')
    useMovementStore.getState().setManualOverrideForFixtures(selectedIds, false)
    useMovementStore.getState().setLockedFixtures(new Set())
  }, [selectedIds, releaseAll])
  // Suprime warning de variable no usada (handler queda disponible para futuras
  // wires del UI al dominio nuclear sin re-implementarlo cada vez).
  void handleNuclearReset
  

  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER - WAVE 432: Always show tabs, empty state only for CONTROLS
  // ═══════════════════════════════════════════════════════════════════════
  
  // Empty state content for CONTROLS tab when nothing selected
  const renderEmptyState = () => (
    <div className="empty-state-content">
      <span className="empty-state-icon">🎛️</span>
      <h3 className="empty-state-title">No fixtures selected</h3>
      <p className="empty-state-hint">
        Click fixtures in the stage view or use <strong>GROUPS</strong> tab
      </p>
    </div>
  )
  
  return (
    <div className="the-programmer">
      {/* TAB NAVIGATION - WAVE 432 */}
      <div className="programmer-tabs">
        <button 
          className={`programmer-tab ${activeTab === 'controls' ? 'active' : ''}`}
          onClick={() => setActiveTab('controls')}
        >
          <IntensityIcon size={16} />
          <span>CONTROLS</span>
          {selectedIds.length > 0 && (
            <span className="tab-badge">{selectedIds.length}</span>
          )}
        </button>
        <button 
          className={`programmer-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          <GroupIcon size={16} />
          <span>GROUPS</span>
        </button>
      </div>
      
      {/* TAB CONTENT */}
      {activeTab === 'controls' ? (
        selectedIds.length === 0 ? (
          <div className="programmer-content empty-state">
            {renderEmptyState()}
          </div>
        ) : (
        <div className="programmer-content">
          {/* HEADER - Selection Info */}
          <div className="programmer-header">
            <div className="selection-info">
              <span className="fixture-count">{selectedIds.length}</span>
              <span className="fixture-label">
                {selectedIds.length === 1 
                  ? (selectedFixtures[0]?.name || selectedFixtures[0]?.type || 'Fixture')
                  : `Fixtures Selected`
                }
              </span>
              {selectedIds.length === 1 && selectedFixtures[0]?.type && (
                <span className="fixture-subtitle">{selectedFixtures[0].type}</span>
              )}
            </div>
            
            <div className="header-actions">
              <button 
                className="unlock-all-btn"
                onClick={handleUnlockAll}
                title="Release all manual overrides"
              >
                🔓 UNLOCK ALL
              </button>
            </div>
          </div>
          
          {/* ── WAVE 4735: CELL ROUTER — routing dinámico por familia ── */}
          <CellRouter groups={aggregatedGroups} />

          {/* OVERRIDE INDICATOR */}
          {(overrideState.dimmer || overrideState.strobe || overrideState.color || overrideState.beam || overrideState.extras) && (
            <div className="override-indicator">
              <span className="override-dot" />
              MANUAL CONTROL ACTIVE
            </div>
          )}
        </div>
        )
      ) : (
        <GroupsPanel onSwitchToControls={handleSwitchToControls} />
      )}
    </div>
  )
}

export default TheProgrammer
