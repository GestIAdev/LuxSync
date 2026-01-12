/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ STAGE CONSTRUCTOR VIEW - WAVE 361.5
 * "El Taller del Arquitecto de Luces"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Vista principal del Stage Constructor. Layout de 3 columnas:
 * - Sidebar Izquierda (250px): Fixture Library
 * - Centro (flex): Canvas 3D con fixtures
 * - Sidebar Derecha (300px): Properties Panel
 * 
 * WAVE 361.5: Added snap system, ghost drag, and box selection
 * 
 * @module components/views/StageConstructorView
 * @version 361.5.0
 */

import React, { Suspense, lazy, useState, useCallback, createContext, useContext } from 'react'
import { useStageStore } from '../../stores/stageStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { Box, Layers, Move3D, Save, FolderOpen, Plus, Trash2, Magnet, MousePointer2, BoxSelect } from 'lucide-react'
import { createDefaultFixture, DEFAULT_PHYSICS_PROFILES } from '../../core/stage/ShowFileV2'
import type { FixtureV2 } from '../../core/stage/ShowFileV2'
import './StageConstructorView.css'

// Lazy load the heavy 3D canvas
const StageGrid3D = lazy(() => import('./StageConstructor/StageGrid3D'))

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTOR CONTEXT - Shared state between components
// ═══════════════════════════════════════════════════════════════════════════

interface ConstructorContextType {
  // Snap settings
  snapEnabled: boolean
  setSnapEnabled: (enabled: boolean) => void
  snapDistance: number  // meters
  snapRotation: number  // radians
  
  // Drag state
  draggedFixtureType: string | null
  setDraggedFixtureType: (type: string | null) => void
  
  // Tool mode
  toolMode: 'select' | 'boxSelect'
  setToolMode: (mode: 'select' | 'boxSelect') => void
}

const ConstructorContext = createContext<ConstructorContextType | null>(null)

export const useConstructorContext = () => {
  const ctx = useContext(ConstructorContext)
  if (!ctx) throw new Error('useConstructorContext must be used within StageConstructorView')
  return ctx
}

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
// FIXTURE TEMPLATES FOR DRAG & DROP
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureTemplate {
  type: FixtureV2['type']
  name: string
  icon: string
  channelCount: number
}

const FIXTURE_TEMPLATES: FixtureTemplate[] = [
  { type: 'moving-head', name: 'Moving Head', icon: '🎯', channelCount: 16 },
  { type: 'par', name: 'LED Par', icon: '💡', channelCount: 8 },
  { type: 'wash', name: 'Wash Light', icon: '🌊', channelCount: 12 },
  { type: 'strobe', name: 'Strobe', icon: '⚡', channelCount: 4 },
  { type: 'laser', name: 'Laser', icon: '🔺', channelCount: 8 },
  { type: 'blinder', name: 'Blinder', icon: '☀️', channelCount: 2 },
]

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE LIBRARY SIDEBAR (LEFT) - With Drag Source
// ═══════════════════════════════════════════════════════════════════════════

const FixtureLibrarySidebar: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const groups = useStageStore(state => state.groups)
  const { setDraggedFixtureType } = useConstructorContext()
  
  const handleDragStart = useCallback((e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('fixture-type', type)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggedFixtureType(type)
    
    // Create ghost image
    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.innerHTML = FIXTURE_TEMPLATES.find(t => t.type === type)?.icon || '💡'
    ghost.style.cssText = `
      position: absolute;
      top: -1000px;
      font-size: 32px;
      padding: 8px;
      background: rgba(34, 211, 238, 0.2);
      border: 2px solid #22d3ee;
      border-radius: 8px;
    `
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 28, 28)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }, [setDraggedFixtureType])
  
  const handleDragEnd = useCallback(() => {
    setDraggedFixtureType(null)
  }, [setDraggedFixtureType])
  
  return (
    <aside className="constructor-sidebar library-sidebar">
      <div className="sidebar-header">
        <Layers size={18} />
        <h3>Fixture Library</h3>
      </div>
      
      <div className="sidebar-content">
        {/* Fixture Templates - Draggable */}
        <div className="library-section">
          <div className="section-header">
            <span>Templates (Drag to Stage)</span>
          </div>
          <div className="template-grid">
            {FIXTURE_TEMPLATES.map(template => (
              <div
                key={template.type}
                className="fixture-template"
                draggable
                onDragStart={(e) => handleDragStart(e, template.type)}
                onDragEnd={handleDragEnd}
                title={`Drag ${template.name} to stage`}
              >
                <span className="template-icon">{template.icon}</span>
                <span className="template-name">{template.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Existing Fixtures List */}
        <div className="library-section">
          <div className="section-header">
            <span>On Stage ({fixtures.length})</span>
            <button className="icon-btn" title="Add Fixture">
              <Plus size={14} />
            </button>
          </div>
          
          {fixtures.length === 0 ? (
            <div className="empty-state">
              <Box size={32} className="empty-icon" />
              <p>No hay fixtures en el stage</p>
              <span>Arrastra templates arriba ↑</span>
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
  
  const { snapEnabled, setSnapEnabled, toolMode, setToolMode } = useConstructorContext()
  
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
        {/* Selection Tools */}
        <div className="tool-group">
          <button 
            className={`tool-btn ${toolMode === 'select' ? 'active' : ''}`}
            title="Select Tool (V)"
            onClick={() => setToolMode('select')}
          >
            <MousePointer2 size={16} />
          </button>
          <button 
            className={`tool-btn ${toolMode === 'boxSelect' ? 'active' : ''}`}
            title="Box Selection (B)"
            onClick={() => setToolMode('boxSelect')}
          >
            <BoxSelect size={16} />
          </button>
        </div>
        
        {/* Snap Toggle */}
        <div className="tool-group">
          <button 
            className={`tool-btn snap-btn ${snapEnabled ? 'active' : ''}`}
            title={snapEnabled ? 'Snap ON (0.5m / 15°)' : 'Snap OFF'}
            onClick={() => setSnapEnabled(!snapEnabled)}
          >
            <Magnet size={16} />
            {snapEnabled && <span className="snap-indicator">0.5m</span>}
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
  // WAVE 361.5 - Snap system state
  const [snapEnabled, setSnapEnabled] = useState(true) // Default ON
  const [draggedFixtureType, setDraggedFixtureType] = useState<string | null>(null)
  const [toolMode, setToolMode] = useState<'select' | 'boxSelect'>('select')
  
  // Snap values per spec
  const snapDistance = 0.5    // 0.5 metros
  const snapRotation = Math.PI / 12  // 15 grados
  
  const contextValue: ConstructorContextType = {
    snapEnabled,
    setSnapEnabled,
    snapDistance,
    snapRotation,
    draggedFixtureType,
    setDraggedFixtureType,
    toolMode,
    setToolMode
  }
  
  return (
    <ConstructorContext.Provider value={contextValue}>
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
    </ConstructorContext.Provider>
  )
}

export default StageConstructorView
