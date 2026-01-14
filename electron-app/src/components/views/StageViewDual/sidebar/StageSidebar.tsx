/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ STAGE SIDEBAR - WAVE 429: THE WIDE INSPECTOR
 * Panel lateral contextual con control de fixtures + escenas
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 429 Changes:
 * - Ancho aumentado a 380px para maximizar área de control
 * - Header limpio: nombre real del fixture, sin redundancias
 * - X cierra el sidebar, no solo deselecciona
 * - Tabs CONTROLS/SCENES en header compacto
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, useState, useCallback } from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useSceneStore, selectSceneCount } from '../../../../stores/sceneStore'
import { useDMXStore } from '../../../../stores'
import { TheProgrammer } from '../../../programmer'
import { SceneBrowser } from './SceneBrowser'
import './StageSidebar.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type SidebarTab = 'controls' | 'scenes'

export interface StageSidebarProps {
  /** Si el sidebar está visible */
  isVisible?: boolean
  /** Callback para cerrar el sidebar */
  onClose?: () => void
}

export const StageSidebar: React.FC<StageSidebarProps> = ({
  isVisible = true,
  onClose
}) => {
  // ─────────────────────────────────────────────────────────────────────────
  // 📊 Store State
  // ─────────────────────────────────────────────────────────────────────────
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const fixtures = useDMXStore(state => state.fixtures)
  const sceneCount = useSceneStore(selectSceneCount)
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎛️ Local State
  // ─────────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SidebarTab>('controls')
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🧮 Computed Values
  // ─────────────────────────────────────────────────────────────────────────
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds])
  const hasSelection = selectedArray.length > 0
  
  const selectedFixtures = useMemo(() => {
    return selectedArray
      .map(id => fixtures.find(f => f.id === id))
      .filter(Boolean)
  }, [selectedArray, fixtures])
  
  // WAVE 429: Título limpio - nombre real del fixture
  const headerTitle = useMemo(() => {
    if (selectedArray.length === 0) return 'No fixtures selected'
    if (selectedArray.length === 1) {
      const fixture = selectedFixtures[0]
      return fixture?.name || `Fixture ${selectedArray[0]}`
    }
    const firstName = selectedFixtures[0]?.name || 'Fixture'
    return `${firstName} (+${selectedArray.length - 1} more)`
  }, [selectedArray, selectedFixtures])
  
  // ─────────────────────────────────────────────────────────────────────────
  // � Handlers
  // ─────────────────────────────────────────────────────────────────────────
  
  // WAVE 429: Cerrar el sidebar (no solo deseleccionar)
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose()
    }
  }, [onClose])
  
  // Si no es visible, no renderizar nada
  if (!isVisible) {
    return null
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="stage-sidebar">
      {/* ═══ HEADER COMPACTO ═══ */}
      <div className="sidebar-header">
        {/* Tab Switcher integrado en header */}
        <div className="header-tabs">
          <button
            className={`header-tab ${activeTab === 'controls' ? 'active' : ''}`}
            onClick={() => setActiveTab('controls')}
          >
            <span className="tab-icon">⚡</span>
            CONTROLS
          </button>
          <button
            className={`header-tab ${activeTab === 'scenes' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenes')}
          >
            <span className="tab-icon">◈</span>
            SCENES
            {sceneCount > 0 && <span className="tab-count">{sceneCount}</span>}
          </button>
        </div>
        
        {/* Close button */}
        <button 
          className="close-btn"
          onClick={handleClose}
          title="Close Inspector"
        >
          ✕
        </button>
      </div>
      
      {/* ═══ SELECTION TITLE (solo en Controls) ═══ */}
      {activeTab === 'controls' && hasSelection && (
        <div className="selection-bar">
          <span className="selection-count">{selectedArray.length}</span>
          <span className="selection-title">{headerTitle}</span>
        </div>
      )}
      
      {/* ═══ CONTENT ═══ */}
      <div className="sidebar-content">
        {activeTab === 'controls' ? (
          <TheProgrammer />
        ) : (
          <SceneBrowser />
        )}
      </div>
    </div>
  )
}

export default StageSidebar
