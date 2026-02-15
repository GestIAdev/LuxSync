/**
 * 🎹 THE PROGRAMMER - WAVE 432: HIVE MIND
 * Panel derecho de control para fixtures seleccionados
 * 
 * Arquitectura:
 * - TABS: CONTROLS | GROUPS
 * - CONTROLS: Intensity, Color, Position, Beam (Accordion)
 * - GROUPS: System + User groups con auto-switch
 * 
 * Conecta directamente al MasterArbiter via window.lux.arbiter
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useSelectionStore, useSelectedArray } from '../../../stores/selectionStore'
import { useHardware } from '../../../stores/truthStore'
import { IntensitySection } from './IntensitySection'
import { ColorSection } from './ColorSection'
import { PositionSection } from './PositionSection'
import { BeamSection } from './BeamSection'
import { GroupsPanel } from './GroupsPanel'
import { IntensityIcon, GroupIcon } from '../../icons/LuxIcons'
import './TheProgrammer.css'
import './accordion-styles.css'
import './GroupsPanel.css'

// Tab types
type ProgrammerTab = 'controls' | 'groups'

// Track which channels have manual overrides
interface OverrideState {
  dimmer: boolean
  color: boolean
  position: boolean
  beam: boolean
}

export const TheProgrammer: React.FC = () => {
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hooks
  const selectedIds = useSelectedArray()
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // Hardware info
  const hardware = useHardware() // 🛡️ WAVE 2042.12: React 19 stable hook
  
  // WAVE 432: TAB NAVIGATION
  const [activeTab, setActiveTab] = useState<ProgrammerTab>('controls')
  
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
  
  // Callback for GroupsPanel to switch to controls
  const handleSwitchToControls = useCallback(() => {
    setActiveTab('controls')
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
      // PARs, Washes, LEDs have color
      // Moving heads, Spots, Beams also have color (CMY or RGB)
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
  
  /**
   * Set dimmer value for selected fixtures
   */
  const handleDimmerChange = useCallback(async (value: number) => {
    if (selectedIds.length === 0) return
    
    setCurrentDimmer(value)
    setOverrideState(prev => ({ ...prev, dimmer: true }))
    
    try {
      await window.lux?.arbiter?.setManual({
        fixtureIds: selectedIds,
        controls: { dimmer: Math.round(value * 2.55) }, // 0-100 -> 0-255
        channels: ['dimmer'],
        source: 'ui_programmer',
      })
      console.log(`[Programmer] 💡 Dimmer → ${value}% for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Programmer] Dimmer error:', err)
    }
  }, [selectedIds])
  
  /**
   * Release dimmer back to AI
   */
  const handleDimmerRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState(prev => ({ ...prev, dimmer: false }))
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['dimmer'],
      })
      console.log(`[Programmer] 🔓 Dimmer released for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Programmer] Dimmer release error:', err)
    }
  }, [selectedIds])
  
  /**
   * Set color for selected fixtures
   */
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
      console.log(`[Programmer] 🎨 Color → RGB(${r},${g},${b}) for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Programmer] Color error:', err)
    }
  }, [selectedIds])
  
  /**
   * Release color back to AI
   */
  const handleColorRelease = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState(prev => ({ ...prev, color: false }))
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
        channels: ['red', 'green', 'blue'],
      })
      console.log(`[Programmer] 🔓 Color released for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Programmer] Color release error:', err)
    }
  }, [selectedIds])
  
  /**
   * UNLOCK ALL - Release all manual overrides for selection
   */
  const handleUnlockAll = useCallback(async () => {
    if (selectedIds.length === 0) return
    
    setOverrideState({ dimmer: false, color: false, position: false, beam: false })
    
    try {
      await window.lux?.arbiter?.clearManual({
        fixtureIds: selectedIds,
      })
      console.log(`[Programmer] 🔓 All overrides released for ${selectedIds.length} fixtures`)
    } catch (err) {
      console.error('[Programmer] Unlock all error:', err)
    }
  }, [selectedIds])
  
  // Reset override state when selection changes
  useEffect(() => {
    setOverrideState({ dimmer: false, color: false, position: false, beam: false })
  }, [selectedIds.length])
  
  /**
   * Handler for position override changes
   */
  const handlePositionOverrideChange = useCallback((hasOverride: boolean) => {
    setOverrideState(prev => ({ ...prev, position: hasOverride }))
  }, [])
  
  /**
   * Handler for beam override changes
   */
  const handleBeamOverrideChange = useCallback((hasOverride: boolean) => {
    setOverrideState(prev => ({ ...prev, beam: hasOverride }))
  }, [])
  
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
          
          {/* INTENSITY SECTION */}
          <IntensitySection
            value={currentDimmer}
            hasOverride={overrideState.dimmer}
            isExpanded={activeSection === 'intensity'}
            onToggle={() => toggleSection('intensity')}
            onChange={handleDimmerChange}
            onRelease={handleDimmerRelease}
          />
          
          {/* COLOR SECTION (solo si hay fixtures con color) */}
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
          
          {/* POSITION SECTION (solo para moving heads) */}
          <PositionSection
            hasOverride={overrideState.position}
            isExpanded={activeSection === 'position'}
            onToggle={() => toggleSection('position')}
            onOverrideChange={handlePositionOverrideChange}
          />
          
          {/* BEAM SECTION (solo para fixtures con óptica) */}
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
      ) : (
        <GroupsPanel onSwitchToControls={handleSwitchToControls} />
      )}
    </div>
  )
}

export default TheProgrammer
