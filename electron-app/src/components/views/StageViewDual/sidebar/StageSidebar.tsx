/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ STAGE SIDEBAR - WAVE 30.1: Stage Command & Dashboard
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Panel lateral contextual que muestra:
 * - InspectorControls cuando hay fixtures seleccionados
 * - GlobalControls cuando no hay selección
 * 
 * Features:
 * - Transición suave entre modos
 * - Animación de entrada/salida
 * - Responsive a cambios de selección
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo } from 'react'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useDMXStore } from '../../../../stores'
import { InspectorControls } from './InspectorControls'
import { GlobalControls } from './GlobalControls'
import './StageSidebar.css'

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
          {/* Header */}
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
          
          {/* Content - Contextual based on selection */}
          <div className="sidebar-content">
            {hasSelection ? (
              <InspectorControls />
            ) : (
              <GlobalControls />
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
