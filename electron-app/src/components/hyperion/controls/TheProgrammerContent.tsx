/**
 * 🎹 THE PROGRAMMER CONTENT - WAVE 432.5: UNIFIED SIDEBAR
 * Solo el contenido de controles (sin tabs, sin wrapper)
 * 
 * Este componente es renderizado por StageSidebar en la tab CONTROLS.
 * Las tabs ahora viven en StageSidebar, no aquí.
 * 
 * Arquitectura:
 * - Header con selección info + UNLOCK ALL
 * - Accordion: Position, Intensity, Color, Beam (WAVE 999: Position es Rey)
 * 
 * Conecta directamente al MasterArbiter via window.lux.arbiter
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { IntensitySection } from './IntensitySection'
import { ColorSection } from './ColorSection'
import { PositionSection } from './PositionSection'
import { BeamSection } from './BeamSection'
import { ExtrasSection } from './ExtrasSection'
import './TheProgrammer.css'
import './accordion-styles.css'

// Track which channels have manual overrides
interface OverrideState {
  dimmer: boolean
  strobe: boolean
  color: boolean
  position: boolean
  beam: boolean
  extras: boolean
}

export const TheProgrammerContent: React.FC = () => {
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hook instead of inline selector
  const selectedIds = useSelectedArray()
  
  // Hardware info
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // Track which channels have manual overrides
  const [overrideState, setOverrideState] = useState<OverrideState>({
    dimmer: false,
    strobe: false,
    color: false,
    position: false,
    beam: false,
    extras: false,
  })
  
  // WAVE 999: POSITION ES REY - Position abierto por defecto
  const [activeSection, setActiveSection] = useState<string>('position')
  
  // Toggle section - exclusive mode (only one open)
  const toggleSection = useCallback((section: string) => {
    setActiveSection(prev => prev === section ? '' : section)
  }, [])
  
  // Current values (for display)
  // WAVE 440.5: Initial state is null/undefined = no preset button active
  // until user touches a control
  const [currentDimmer, setCurrentDimmer] = useState<number | null>(null)
  const [currentStrobe, setCurrentStrobe] = useState(0)
  const [currentColor, setCurrentColor] = useState({ r: 255, g: 255, b: 255 })
  // 🔒 WAVE 3270: Inhibit limit (100 = full power, no limit)
  const [currentLimit, setCurrentLimit] = useState(100)
  
  // Get fixture info
  const selectedFixtures = useMemo(() => {
    const fixtures = hardware?.fixtures || []
    return selectedIds
      .map(id => fixtures.find((f: { id: string }) => f.id === id))
      .filter(Boolean)
  }, [selectedIds, hardware?.fixtures])
  
  // Check if any fixture supports color
  const hasColorFixtures = useMemo(() => {
    return selectedFixtures.some((f: any) => {
      const type = f?.type?.toLowerCase() || ''
      return type.includes('rgb') || 
             type.includes('wash') || 
             type.includes('par') || 
             type.includes('led') ||
             type.includes('moving') ||
             type.includes('spot') ||
             type.includes('beam')
    })
  }, [selectedFixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS - Conectan al MasterArbiter
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDimmerChange = useCallback(async (value: number) => {
    if (selectedIds.length === 0) return
    
    setCurrentDimmer(value)
    setOverrideState(prev => ({ ...prev, dimmer: true }))
    
    const payload = {
      fixtureIds: selectedIds,
      controls: { dimmer: Math.round(value * 2.55) },
      channels: ['dimmer'],
    }
    
    console.log('[Programmer] Dimmer payload:', payload)
    
    try {
      await window.lux?.arbiter?.setManual(payload)
    } catch (err) {
      console.error('[Programmer] Dimmer error:', err)
    }
  }, [selectedIds])
  
  const handleDimmerRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState(prev => ({ ...prev, dimmer: false }))
    // WAVE 440.5: Reset dimmer to null so no preset button appears active
    setCurrentDimmer(null)
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['dimmer'],
      })
    } catch (err) {
      console.error('[Programmer] Dimmer release error:', err)
    }
  }, [selectedIds])
  
  /**
   * ⚡ WAVE 2494: Set strobe value for selected fixtures
   */
  const handleStrobeChange = useCallback(async (value: number) => {
    if (selectedIds.length === 0) return
    
    setCurrentStrobe(value)
    setOverrideState(prev => ({ ...prev, strobe: true }))
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: { strobe: Math.round(value * 2.55) },
        channels: ['strobe'],
        source: 'ui_programmer',
      })
    } catch (err) {
      console.error('[Programmer] Strobe error:', err)
    }
  }, [selectedIds])
  
  /**
   * ⚡ WAVE 2494: Release strobe back to AI
   */
  const handleStrobeRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setCurrentStrobe(0)
    setOverrideState(prev => ({ ...prev, strobe: false }))
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['strobe'],
      })
    } catch (err) {
      console.error('[Programmer] Strobe release error:', err)
    }
  }, [selectedIds])

  /**
   * 🔒 WAVE 3270: Set inhibit limit for selected fixtures
   * Proportional ceiling: 100% = full power, 50% = half max
   */
  const handleLimitChange = useCallback(async (value: number) => {
    if (selectedIds.length === 0) return
    
    setCurrentLimit(value)
    
    try {
      await window.lux?.arbiter?.setInhibitLimit(selectedIds, value / 100)
    } catch (err) {
      console.error('[Programmer] Limit error:', err)
    }
  }, [selectedIds])

  /**
   * 🔒 WAVE 3270: Release inhibit limit (restore full power)
   */
  const handleLimitRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setCurrentLimit(100)
    
    try {
      await window.lux?.arbiter?.clearInhibitLimit(selectedIds)
    } catch (err) {
      console.error('[Programmer] Limit release error:', err)
    }
  }, [selectedIds])
  
  const handleColorChange = useCallback(async (r: number, g: number, b: number) => {
    if (selectedIds.length === 0) return
    
    setCurrentColor({ r, g, b })
    setOverrideState(prev => ({ ...prev, color: true }))
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: { red: r, green: g, blue: b },
        channels: ['red', 'green', 'blue'],
      })
    } catch (err) {
      console.error('[Programmer] Color error:', err)
    }
  }, [selectedIds])
  
  const handleColorRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState(prev => ({ ...prev, color: false }))
    // WAVE 440.5: Reset color to neutral gray so no quick button appears active
    setCurrentColor({ r: 128, g: 128, b: 128 })
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['red', 'green', 'blue'],
      })
    } catch (err) {
      console.error('[Programmer] Color release error:', err)
    }
  }, [selectedIds])
  
  const [unlockFlash, setUnlockFlash] = useState(false)
  
  const handleUnlockAll = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    // 🔓 WAVE 999.7: Visual feedback - Flash effect
    setUnlockFlash(true)
    setTimeout(() => setUnlockFlash(false), 400)
    
    setOverrideState({ dimmer: false, strobe: false, color: false, position: false, beam: false, extras: false })
    // WAVE 440.5: Reset UI values to neutral state
    setCurrentDimmer(null)
    setCurrentStrobe(0)
    setCurrentColor({ r: 128, g: 128, b: 128 })
    // 🔒 WAVE 3270: Reset limit to full power
    setCurrentLimit(100)
    
    try {
      // Clear fixture manual overrides (dimmer, color, pan, tilt, etc.)
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
      })
      
      // 🔒 WAVE 3270: Clear inhibit limits
      await window.lux?.arbiter?.clearInhibitLimit(selectedIds)
      
      // 🔄 WAVE 2042.22: PATTERN PERSISTENCE
      // OLD: clearMovementOverrides() → Killed pattern on unlock
      // NEW: Let pattern continue running (user can click HOLD to stop)
      // Movement params (speed/amplitude) also persist as "suggestions" to AI
      
      console.log(`[Programmer] 🔓 UNLOCK ALL: Released ${selectedIds.length} fixtures (pattern persists)`)
    } catch (err) {
      console.error('[Programmer] Unlock all error:', err)
    }
  }, [selectedIds])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 999.7: THE HYBRID FLUSH - Clean state on selection change
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let isMounted = true
    
    const hydrateState = async () => {
      // ═══════════════════════════════════════════════════════════════════
      // 🧼 PASO 1: FLUSH INMEDIATO - Limpiar estado local ANTES de fetch
      // ═══════════════════════════════════════════════════════════════════
      setOverrideState({ dimmer: false, strobe: false, color: false, position: false, beam: false, extras: false })
      setCurrentDimmer(null)
      setCurrentStrobe(0)
      setCurrentColor({ r: 128, g: 128, b: 128 })
      setCurrentLimit(100)
      
      if (selectedIds.length === 0) {
        console.log(`[Programmer] 🧼 FLUSH: No selection, defaults applied`)
        return
      }
      
      // ═══════════════════════════════════════════════════════════════════
      // 🧠 PASO 2: HIDRATAR - Pedir estado real al Arbiter
      // ═══════════════════════════════════════════════════════════════════
      try {
        const result = await window.lux?.arbiter?.getFixturesState(selectedIds)
        
        if (!isMounted) return
        
        if (!result?.success || !result?.state) {
          console.log(`[Programmer] 🧼 FLUSH: No backend state, keeping defaults`)
          return
        }
        
        const { state } = result
        
        // ═══════════════════════════════════════════════════════════════════
        // 🎯 PASO 3: APLICAR solo los valores que tienen OVERRIDE MANUAL
        // ═══════════════════════════════════════════════════════════════════
        
        // --- INTENSITY ---
        if (state.dimmer !== null) {
          setCurrentDimmer(state.dimmer)
          setOverrideState(prev => ({ ...prev, dimmer: true }))
        }
        // else: mantiene null del flush (AI control)
        
        // --- COLOR ---
        if (state.color !== null) {
          // Parse hex to RGB
          const hex = state.color.replace('#', '')
          const r = parseInt(hex.substring(0, 2), 16)
          const g = parseInt(hex.substring(2, 4), 16)
          const b = parseInt(hex.substring(4, 6), 16)
          setCurrentColor({ r, g, b })
          setOverrideState(prev => ({ ...prev, color: true }))
        }
        // else: mantiene gris neutro del flush (AI control)
        
        // Position & Beam handled by their own sections
        console.log(`[Programmer] 🧠 Hydrated fixture ${selectedIds[0]} - Dimmer: ${state.dimmer ?? 'AI'} Color: ${state.color ?? 'AI'}`)

        // 🔒 WAVE 3270: Hydrate inhibit limit from backend
        try {
          const limitsResult = await window.lux?.arbiter?.getInhibitLimits()
          if (isMounted && limitsResult?.inhibitLimits) {
            const firstId = selectedIds[0]
            const limit = limitsResult.inhibitLimits[firstId]
            if (limit !== undefined && limit < 1.0) {
              setCurrentLimit(Math.round(limit * 100))
            }
          }
        } catch (_) { /* limit hydration is non-critical */ }
      } catch (err) {
        console.error('[Programmer] Hydration error:', err)
        // En caso de error, los defaults del flush ya están aplicados
      }
    }
    
    hydrateState()
    
    return () => { isMounted = false }
  }, [JSON.stringify(selectedIds)]) // 🔑 Stringify para detectar cambios de contenido
  
  const handlePositionOverrideChange = useCallback((hasOverride: boolean) => {
    setOverrideState(prev => ({ ...prev, position: hasOverride }))
  }, [])
  
  const handleBeamOverrideChange = useCallback((hasOverride: boolean) => {
    setOverrideState(prev => ({ ...prev, beam: hasOverride }))
  }, [])
  
  const handleExtrasOverrideChange = useCallback((hasOverride: boolean) => {
    setOverrideState(prev => ({ ...prev, extras: hasOverride }))
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  // Empty state when nothing selected
  if (selectedIds.length === 0) {
    return (
      <div className="programmer-content empty-state">
        <div className="empty-state-content">
          <span className="empty-state-icon">🎛️</span>
          <h3 className="empty-state-title">No fixtures selected</h3>
          <p className="empty-state-hint">
            Click fixtures in the stage view or use <strong>GROUPS</strong> tab
          </p>
        </div>
      </div>
    )
  }
  
  return (
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
            className={`unlock-all-btn ${unlockFlash ? 'flash' : ''}`}
            onClick={handleUnlockAll}
            title="Release all manual overrides"
          >
            🔓 UNLOCK ALL
          </button>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════════
          WAVE 999: NUEVA JERARQUÍA - Position es Rey
          📍 POSITION → 💡 INTENSITY → 🎨 COLOR → 🔦 BEAM
          ═══════════════════════════════════════════════════════════════════════ */}
      
      {/* 📍 POSITION SECTION - Ahora primero y abierto por defecto */}
      <PositionSection
        hasOverride={overrideState.position}
        isExpanded={activeSection === 'position'}
        onToggle={() => toggleSection('position')}
        onOverrideChange={handlePositionOverrideChange}
      />
      
      {/* 💡 INTENSITY SECTION */}
      {/* WAVE 440.5: Pass -1 when null to prevent any preset button from being active */}
      <IntensitySection
        value={currentDimmer ?? -1}
        hasOverride={overrideState.dimmer}
        strobeValue={currentStrobe}
        hasStrobeOverride={overrideState.strobe}
        limitValue={currentLimit}
        hasLimitActive={currentLimit < 100}
        isExpanded={activeSection === 'intensity'}
        onToggle={() => toggleSection('intensity')}
        onChange={handleDimmerChange}
        onRelease={handleDimmerRelease}
        onStrobeChange={handleStrobeChange}
        onStrobeRelease={handleStrobeRelease}
        onLimitChange={handleLimitChange}
        onLimitRelease={handleLimitRelease}
      />
      
      {/* 🎨 COLOR SECTION */}
      {hasColorFixtures && (
        <ColorSection
          color={currentColor}
          hasOverride={overrideState.color}
          isExpanded={activeSection === 'color'}
          onToggle={() => toggleSection('color')}
          onChange={handleColorChange}
          onRelease={handleColorRelease}
        />
      )}
      
      {/* 🔦 BEAM SECTION */}
      <BeamSection
        hasOverride={overrideState.beam}
        isExpanded={activeSection === 'beam'}
        onToggle={() => toggleSection('beam')}
        onOverrideChange={handleBeamOverrideChange}
      />
      
      {/* 🔥 WAVE 2084.10: THE DOPPELGÄNGER FIX — ExtrasSection finally in the REAL component */}
      <ExtrasSection
        hasOverride={overrideState.extras}
        isExpanded={activeSection === 'extras'}
        onToggle={() => toggleSection('extras')}
        onOverrideChange={handleExtrasOverrideChange}
      />
      
      {/* OVERRIDE INDICATOR */}
      {(overrideState.dimmer || overrideState.strobe || overrideState.color || overrideState.position || overrideState.beam || overrideState.extras) && (
        <div className="override-indicator">
          <span className="override-dot" />
          MANUAL CONTROL ACTIVE
        </div>
      )}
    </div>
  )
}

export default TheProgrammerContent
