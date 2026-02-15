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
import './TheProgrammer.css'
import './accordion-styles.css'

// Track which channels have manual overrides
interface OverrideState {
  dimmer: boolean
  color: boolean
  position: boolean
  beam: boolean
}

export const TheProgrammerContent: React.FC = () => {
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hook instead of inline selector
  const selectedIds = useSelectedArray()
  
  // Hardware info
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // Track which channels have manual overrides
  const [overrideState, setOverrideState] = useState<OverrideState>({
    dimmer: false,
    color: false,
    position: false,
    beam: false,
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
  const [currentColor, setCurrentColor] = useState({ r: 255, g: 255, b: 255 })
  
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
    
    setOverrideState({ dimmer: false, color: false, position: false, beam: false })
    // WAVE 440.5: Reset UI values to neutral state
    setCurrentDimmer(null)
    setCurrentColor({ r: 128, g: 128, b: 128 })
    
    try {
      // Clear fixture manual overrides
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
      })
      // 🎚️ WAVE 999.7: Also clear movement parameter overrides (speed/amplitude)
      await window.lux?.arbiter?.clearMovementOverrides?.()
      console.log(`[Programmer] 🔓 UNLOCK ALL: Released ${selectedIds.length} fixtures + movement params`)
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
      setOverrideState({ dimmer: false, color: false, position: false, beam: false })
      setCurrentDimmer(null)
      setCurrentColor({ r: 128, g: 128, b: 128 })
      
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
        isExpanded={activeSection === 'intensity'}
        onToggle={() => toggleSection('intensity')}
        onChange={handleDimmerChange}
        onRelease={handleDimmerRelease}
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
      
      {/* OVERRIDE INDICATOR */}
      {(overrideState.dimmer || overrideState.color || overrideState.position || overrideState.beam) && (
        <div className="override-indicator">
          <span className="override-dot" />
          MANUAL CONTROL ACTIVE
        </div>
      )}
    </div>
  )
}

export default TheProgrammerContent
