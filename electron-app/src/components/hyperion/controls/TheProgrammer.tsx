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
import { DeviceCellGroup } from '../programmer/DeviceCellGroup'
import { useCapabilityCells } from '../../../hooks/useCapabilityCells'
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
    setDimmer, releaseDimmer,
    setStrobe, releaseStrobe,
    setLimit, releaseLimit,
    setColor, releaseColor,
    releaseAll,
    syncSelection,
    hydrateFromL2,
    displayDimmer: currentDimmer,
    displayStrobe: currentStrobe,
    displayLimit: currentLimit,
    displayColor: currentColor,
    fixtureOverrides,
  } = useProgrammerStore()
  const hydrateMovementFromL2 = useMovementStore(s => s.hydrateFromL2)
  const pruneManualOverride = useMovementStore(s => s.pruneManualOverride)

  // WAVE 4725: CAMALEÓN — carga células de capacidad del nodeGraph
  const deviceGroups = useCapabilityCells(selectedIds)


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

  // WAVE 430.5: EXCLUSIVE ACCORDION - Only one section open at a time
  const [activeSection, setActiveSection] = useState<string>('intensity')
  
  // Toggle section - exclusive mode (only one open)
  const toggleSection = useCallback((section: string) => {
    setActiveSection(prev => prev === section ? '' : section)
  }, [])
  
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
  // HANDLERS — ahora síncronos, el bridge vuelca a 44Hz
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDimmerChange = useCallback((value: number) => {
    if (selectedIds.length === 0) return
    setDimmer(value)
  }, [selectedIds.length, setDimmer])
  
  const handleDimmerRelease = useCallback(() => {
    if (selectedIds.length === 0) return
    releaseDimmer()
  }, [selectedIds.length, releaseDimmer])
  
  const handleStrobeChange = useCallback((value: number) => {
    if (selectedIds.length === 0) return
    setStrobe(value)
  }, [selectedIds.length, setStrobe])
  
  const handleStrobeRelease = useCallback(() => {
    if (selectedIds.length === 0) return
    releaseStrobe()
  }, [selectedIds.length, releaseStrobe])

  const handleLimitChange = useCallback((value: number) => {
    if (selectedIds.length === 0) return
    // WAVE 4531: El store persiste el displayLimit para la UI.
    // El NodeArbiter recibe el cap real vía IPC dedicado (Opción B).
    setLimit(value)
    const nodeIds = selectedIds.map(id => `${id}:impact`)
    const limitNorm = Math.max(0, Math.min(100, value)) / 100
    window.lux?.aether?.setInhibitLimit(nodeIds, limitNorm)
  }, [selectedIds, setLimit])

  const handleLimitRelease = useCallback(() => {
    if (selectedIds.length === 0) return
    releaseLimit()
    const nodeIds = selectedIds.map(id => `${id}:impact`)
    window.lux?.aether?.clearInhibitLimit(nodeIds)
  }, [selectedIds, releaseLimit])
  
  const handleUnlockAll = useCallback(() => {
    if (selectedIds.length === 0) return
    // WAVE 4719: Unlock All alineado con Cathedral Unlock — misma ruta total.
    // 1) NodeArbiter L2: release todos los canales
    releaseAll()
    // 2) Inhibit limits del NodeArbiter (canal IMPACT)
    const nodeIds = selectedIds.map(id => `${id}:impact`)
    window.lux?.aether?.clearInhibitLimit(nodeIds)
    // 3) VMM: limpiar patron activo en masterArbiter + KineticEngine
    void window.lux?.aether?.setManualPattern({
      fixtureIds: selectedIds,
      pattern: null,
      speed: 50,
      amplitude: 50,
    })
    // 4) VMM: limpiar phase offsets del fan residuales
    void window.lux?.aether?.setKineticFanOffsets({})
    // 5) UI: resetear patron
    useMovementStore.getState().setActivePattern('none')
    // 6) EXORCISMO: limpiar Sets zombificados
    useMovementStore.getState().setManualOverrideForFixtures(selectedIds, false)
    useMovementStore.getState().setLockedFixtures(new Set())
  }, [selectedIds, releaseAll])
  

  
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
          
          {/* ── WAVE 4727: VIP BOUNCER — Todo fixture usa DeviceCellGroup ── */}
          {deviceGroups.map(group => group.cells.length > 0 ? (
            <DeviceCellGroup
              key={group.deviceId}
              deviceId={group.deviceId}
              fixtureName={group.fixtureName}
              fixtureType={group.fixtureType}
              cells={group.cells}
              onSectionToggle={toggleSection}
            />
          ) : null)}

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
