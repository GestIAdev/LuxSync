/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ STAGE CONSTRUCTOR VIEW - WAVE 361
 * "El Taller del Arquitecto de Luces"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Vista principal del Stage Constructor. Layout de 3 columnas:
 * - Sidebar Izquierda (250px): Fixture Library
 * - Centro (flex): Canvas 3D con fixtures
 * - Sidebar Derecha (300px): Properties Panel
 * 
 * @module components/views/StageConstructorView
 * @version 361.1.0
 */

import React, { Suspense, lazy, useState } from 'react'
import { useStageStore } from '../../stores/stageStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { Box, Layers, Move3D, Save, FolderOpen, Plus, Trash2 } from 'lucide-react'
import './StageConstructorView.css'

// Lazy load the heavy 3D canvas
const StageGrid3D = lazy(() => import('./StageConstructor/StageGrid3D'))

// ═══════════════════════════════════════════════════════════════════════════
// LOADING FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

const Loading3DFallback: React.FC = () => (
  <div className="constructor-loading">
    <div className="loading-grid">
      <div className="grid-line" />
      <div className="grid-line" />
      <div className="grid-line" />
    </div>
    <span className="loading-text">Inicializando Stage Grid 3D...</span>
    <span className="loading-hint">Preparando React Three Fiber</span>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE LIBRARY SIDEBAR (LEFT)
// ═══════════════════════════════════════════════════════════════════════════

const FixtureLibrarySidebar: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const groups = useStageStore(state => state.groups)
  
  return (
    <aside className="constructor-sidebar library-sidebar">
      <div className="sidebar-header">
        <Layers size={18} />
        <h3>Fixture Library</h3>
      </div>
      
      <div className="sidebar-content">
        {/* Fixtures List */}
        <div className="library-section">
          <div className="section-header">
            <span>Fixtures ({fixtures.length})</span>
            <button className="icon-btn" title="Add Fixture">
              <Plus size={14} />
            </button>
          </div>
          
          {fixtures.length === 0 ? (
            <div className="empty-state">
              <Box size={32} className="empty-icon" />
              <p>No hay fixtures patcheados</p>
              <span>Usa SETUP → Patch para añadir</span>
            </div>
          ) : (
            <ul className="fixture-list">
              {fixtures.map(fix => (
                <li key={fix.id} className="fixture-item">
                  <span className="fixture-type-icon">
                    {fix.type === 'moving-head' ? '🎯' : 
                     fix.type === 'par' ? '💡' : 
                     fix.type === 'wash' ? '🌊' : '⚡'}
                  </span>
                  <span className="fixture-name">{fix.name}</span>
                  <span className="fixture-address">#{fix.address}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Groups List */}
        <div className="library-section">
          <div className="section-header">
            <span>Groups ({groups.length})</span>
            <button className="icon-btn" title="Create Group">
              <Plus size={14} />
            </button>
          </div>
          
          {groups.length === 0 ? (
            <div className="empty-state small">
              <p>No hay grupos</p>
            </div>
          ) : (
            <ul className="group-list">
              {groups.map(grp => (
                <li key={grp.id} className="group-item">
                  <span 
                    className="group-color" 
                    style={{ backgroundColor: grp.color }}
                  />
                  <span className="group-name">{grp.name}</span>
                  <span className="group-count">({grp.fixtureIds.length})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTIES SIDEBAR (RIGHT)
// ═══════════════════════════════════════════════════════════════════════════

const PropertiesSidebar: React.FC = () => {
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const fixtures = useStageStore(state => state.fixtures)
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
  
  // Convert Set to Array for easier handling
  const selectedArray = Array.from(selectedIds)
  
  const selectedFixture = selectedArray.length === 1 
    ? fixtures.find(f => f.id === selectedArray[0])
    : null
  
  return (
    <aside className="constructor-sidebar properties-sidebar">
      <div className="sidebar-header">
        <Move3D size={18} />
        <h3>Properties</h3>
      </div>
      
      <div className="sidebar-content">
        {selectedArray.length === 0 ? (
          <div className="empty-state">
            <Move3D size={32} className="empty-icon" />
            <p>Selecciona un fixture</p>
            <span>Click en un objeto 3D para editar</span>
          </div>
        ) : selectedArray.length > 1 ? (
          <div className="multi-select-info">
            <p>{selectedArray.length} fixtures seleccionados</p>
            <span>Selección múltiple (próximamente)</span>
          </div>
        ) : selectedFixture && (
          <div className="fixture-properties">
            {/* Header */}
            <div className="property-header">
              <h4>{selectedFixture.name}</h4>
              <span className="fixture-model">{selectedFixture.model}</span>
            </div>
            
            {/* Position */}
            <div className="property-group">
              <label>Position (meters)</label>
              <div className="position-inputs">
                <div className="input-row">
                  <span className="axis-label x">X</span>
                  <input 
                    type="number" 
                    step="0.1"
                    value={selectedFixture.position.x.toFixed(2)}
                    onChange={(e) => updateFixturePosition(selectedFixture.id, {
                      ...selectedFixture.position,
                      x: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div className="input-row">
                  <span className="axis-label y">Y</span>
                  <input 
                    type="number" 
                    step="0.1"
                    value={selectedFixture.position.y.toFixed(2)}
                    onChange={(e) => updateFixturePosition(selectedFixture.id, {
                      ...selectedFixture.position,
                      y: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
                <div className="input-row">
                  <span className="axis-label z">Z</span>
                  <input 
                    type="number" 
                    step="0.1"
                    value={selectedFixture.position.z.toFixed(2)}
                    onChange={(e) => updateFixturePosition(selectedFixture.id, {
                      ...selectedFixture.position,
                      z: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>
              </div>
            </div>
            
            {/* Zone */}
            <div className="property-group">
              <label>Zone</label>
              <div className="zone-badge">
                {selectedFixture.zone}
              </div>
            </div>
            
            {/* Physics */}
            <div className="property-group">
              <label>Physics Profile</label>
              <div className="physics-info">
                <div className="physics-row">
                  <span>Motor Type:</span>
                  <span className="physics-value">{selectedFixture.physics.motorType}</span>
                </div>
                <div className="physics-row">
                  <span>Max Accel:</span>
                  <span className="physics-value">{selectedFixture.physics.maxAcceleration}</span>
                </div>
                <div className="physics-row">
                  <span>Safety Cap:</span>
                  <span className={`physics-value ${selectedFixture.physics.safetyCap ? 'on' : 'off'}`}>
                    {selectedFixture.physics.safetyCap ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* DMX Info */}
            <div className="property-group">
              <label>DMX</label>
              <div className="dmx-info">
                <span>Universe {selectedFixture.universe} · Address {selectedFixture.address}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════

const ConstructorToolbar: React.FC = () => {
  const isDirty = useStageStore(state => state.isDirty)
  const saveShow = useStageStore(state => state.saveShow)
  const showFile = useStageStore(state => state.showFile)
  
  return (
    <div className="constructor-toolbar">
      <div className="toolbar-left">
        <h2 className="toolbar-title">
          <Move3D size={20} />
          Stage Constructor
        </h2>
        {showFile && (
          <span className="show-name">
            {showFile.name}
            {isDirty && <span className="dirty-indicator">●</span>}
          </span>
        )}
      </div>
      
      <div className="toolbar-center">
        <div className="tool-group">
          <button className="tool-btn active" title="Select Tool (V)">
            <Move3D size={16} />
          </button>
        </div>
      </div>
      
      <div className="toolbar-right">
        <button className="toolbar-btn" title="Open Show">
          <FolderOpen size={16} />
          <span>Open</span>
        </button>
        <button 
          className="toolbar-btn primary" 
          title="Save Show"
          onClick={() => saveShow()}
          disabled={!isDirty}
        >
          <Save size={16} />
          <span>Save</span>
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════════════════

const StageConstructorView: React.FC = () => {
  return (
    <div className="stage-constructor-view">
      {/* Toolbar */}
      <ConstructorToolbar />
      
      {/* Main Content */}
      <div className="constructor-content">
        {/* Left Sidebar - Fixture Library */}
        <FixtureLibrarySidebar />
        
        {/* Center - 3D Viewport */}
        <div className="constructor-viewport">
          <Suspense fallback={<Loading3DFallback />}>
            <StageGrid3D />
          </Suspense>
        </div>
        
        {/* Right Sidebar - Properties */}
        <PropertiesSidebar />
      </div>
    </div>
  )
}

export default StageConstructorView
