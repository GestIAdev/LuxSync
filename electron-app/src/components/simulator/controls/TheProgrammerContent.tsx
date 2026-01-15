/**
 * 🎹 THE PROGRAMMER CONTENT - WAVE 432.5: UNIFIED SIDEBAR
 * Solo el contenido de controles (sin tabs, sin wrapper)
 * 
 * Este componente es renderizado por StageSidebar en la tab CONTROLS.
 * Las tabs ahora viven en StageSidebar, no aquí.
 * 
 * Arquitectura:
 * - Header con selección info + UNLOCK ALL
 * - Accordion: Intensity, Color, Position, Beam
 * 
 * Conecta directamente al MasterArbiter via window.lux.arbiter
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useSelectionStore } from '../../stores/selectionStore'
import { useTruthStore, selectHardware } from '../../stores/truthStore'
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
  // Selection store
  const selectedIds = useSelectionStore(state => [...state.selectedIds])
  
  // Hardware info
  const hardware = useTruthStore(selectHardware)
  
  // Track which channels have manual overrides
  const [overrideState, setOverrideState] = useState<OverrideState>({
    dimmer: false,
    color: false,
    position: false,
    beam: false,
  })
  
  // WAVE 430.5: EXCLUSIVE ACCORDION - Only one section open at a time
  const [activeSection, setActiveSection] = useState<string>('intensity')
  
  // Toggle section - exclusive mode (only one open)
  const toggleSection = useCallback((section: string) => {
    setActiveSection(prev => prev === section ? '' : section)
  }, [])
  
  // Current values (for display)
  const [currentDimmer, setCurrentDimmer] = useState(100)
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
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: { dimmer: Math.round(value * 2.55) },
        channels: ['dimmer'],
        source: 'ui_programmer',
      })
    } catch (err) {
      console.error('[Programmer] Dimmer error:', err)
    }
  }, [selectedIds])
  
  const handleDimmerRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState(prev => ({ ...prev, dimmer: false }))
    
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
        controls: { r, g, b },
        channels: ['red', 'green', 'blue'],
        source: 'ui_programmer',
      })
    } catch (err) {
      console.error('[Programmer] Color error:', err)
    }
  }, [selectedIds])
  
  const handleColorRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState(prev => ({ ...prev, color: false }))
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['red', 'green', 'blue'],
      })
    } catch (err) {
      console.error('[Programmer] Color release error:', err)
    }
  }, [selectedIds])
  
  const handleUnlockAll = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState({ dimmer: false, color: false, position: false, beam: false })
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
      })
    } catch (err) {
      console.error('[Programmer] Unlock all error:', err)
    }
  }, [selectedIds])
  
  // Reset override state when selection changes
  useEffect(() => {
    setOverrideState({ dimmer: false, color: false, position: false, beam: false })
  }, [selectedIds.length])
  
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
            className="unlock-all-btn"
            onClick={handleUnlockAll}
            title="Release all manual overrides"
          >
            🔓 UNLOCK ALL
          </button>
        </div>
      </div>
      
      {/* INTENSITY SECTION */}
      <IntensitySection
        value={currentDimmer}
        hasOverride={overrideState.dimmer}
        isExpanded={activeSection === 'intensity'}
        onToggle={() => toggleSection('intensity')}
        onChange={handleDimmerChange}
        onRelease={handleDimmerRelease}
      />
      
      {/* COLOR SECTION */}
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
      
      {/* POSITION SECTION */}
      <PositionSection
        hasOverride={overrideState.position}
        isExpanded={activeSection === 'position'}
        onToggle={() => toggleSection('position')}
        onOverrideChange={handlePositionOverrideChange}
      />
      
      {/* BEAM SECTION */}
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
