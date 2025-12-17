/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ STAGE SIDEBAR - WAVE 32: Stage Command & Dashboard + Scene Engine
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Panel lateral contextual que muestra:
 * - Tab CONTROLS: InspectorControls o GlobalControls
 * - Tab SCENES: SceneBrowser con REC/PLAY
 * 
 * Features:
 * - Transición suave entre modos
 * - Animación de entrada/salida
 * - Responsive a cambios de selección
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, useState } from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useSceneStore, selectSceneCount } from '../../../../stores/sceneStore'
import { useDMXStore } from '../../../../stores'
import { InspectorControls } from './InspectorControls'
import { GlobalControls } from './GlobalControls'
import { SceneBrowser } from './SceneBrowser'
import './StageSidebar.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type SidebarTab = 'controls' | 'scenes'

export interface StageSidebarProps {
  /** Ancho del sidebar en píxeles */
  width?: number
  /** Si el sidebar está colapsado */
  collapsed?: boolean
  /** Callback para colapsar/expandir */
  onToggleCollapse?: () => void
}

export const StageSidebar: React.FC<StageSidebarProps> = ({
  width = 320,
  collapsed = false,
  onToggleCollapse
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
  // selectedIds es un Set<string>, convertir a array para operaciones
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds])
  const hasSelection = selectedArray.length > 0
  
  const selectedFixtures = useMemo(() => {
    return selectedArray
      .map(id => fixtures.find(f => f.id === id))
      .filter(Boolean)
  }, [selectedArray, fixtures])
  
  const selectionSummary = useMemo(() => {
    if (selectedArray.length === 0) return 'No selection'
    if (selectedArray.length === 1) {
      const fixture = selectedFixtures[0]
      return fixture?.name || `Fixture ${selectedArray[0]}`
    }
    return `${selectedArray.length} fixtures selected`
  }, [selectedArray, selectedFixtures])
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🎨 Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div 
      className={`stage-sidebar ${collapsed ? 'collapsed' : ''}`}
      style={{ width: collapsed ? 40 : width }}
    >
      {/* Toggle Button */}
      <button 
        className="sidebar-toggle"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className="toggle-icon">
          {collapsed ? '◀' : '▶'}
        </span>
      </button>
      
      {!collapsed && (
        <>
          {/* Tab Switcher */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              <span className="tab-icon">{hasSelection ? '🎯' : '🎛️'}</span>
              <span className="tab-label">CONTROLS</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'scenes' ? 'active' : ''}`}
              onClick={() => setActiveTab('scenes')}
            >
              <span className="tab-icon">🎬</span>
              <span className="tab-label">SCENES</span>
              {sceneCount > 0 && (
                <span className="tab-badge">{sceneCount}</span>
              )}
            </button>
          </div>
          
          {/* Header - Only for Controls tab */}
          {activeTab === 'controls' && (
            <div className="sidebar-header">
              <div className="header-icon">
                {hasSelection ? '🎯' : '🎛️'}
              </div>
              <div className="header-content">
                <h3 className="header-title">
                  {hasSelection ? 'Inspector' : 'Control Panel'}
                </h3>
                <span className="header-subtitle">
                  {selectionSummary}
                </span>
              </div>
            </div>
          )}
          
          {/* Content - Based on active tab */}
          <div className="sidebar-content">
            {activeTab === 'controls' ? (
              /* Controls Tab */
              hasSelection ? (
                <InspectorControls />
              ) : (
                <GlobalControls />
              )
            ) : (
              /* Scenes Tab */
              <SceneBrowser />
            )}
          </div>
          
          {/* Footer */}
          <div className="sidebar-footer">
            <div className="footer-stats">
              <span className="stat">
                <span className="stat-value">{fixtures.length}</span>
                <span className="stat-label">Fixtures</span>
              </span>
              <span className="stat">
                <span className="stat-value">{selectedArray.length}</span>
                <span className="stat-label">Selected</span>
              </span>
            </div>
            <div className="footer-hint">
              {hasSelection 
                ? 'Ctrl+Click for multi-select • Esc to deselect'
                : 'Click fixtures to select • Drag to select area'
              }
            </div>
          </div>
        </>
      )}
      
      {/* Collapsed Mini View */}
      {collapsed && (
        <div className="sidebar-collapsed-content">
          <div className="collapsed-icon" title={selectionSummary}>
            {hasSelection ? '🎯' : '🎛️'}
          </div>
          {hasSelection && (
            <div className="collapsed-count" title={`${selectedArray.length} selected`}>
              {selectedArray.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default StageSidebar
