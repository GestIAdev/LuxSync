/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ STAGE CONSTRUCTOR VIEW - WAVE 364
 * "El Taller del Arquitecto de Luces"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Vista principal del Stage Constructor. Layout de 3 columnas:
 * - Sidebar Izquierda (250px): Fixture Library
 * - Centro (flex): Canvas 3D con fixtures
 * - Sidebar Derecha (300px): Properties Panel (Tabs: Properties / Groups)
 * 
 * WAVE 361.5: Added snap system, ghost drag, and box selection
 * WAVE 363: Added Groups & Zones management, Keyboard shortcuts
 * WAVE 364: Added Fixture Forge integration
 * 
 * @module components/views/StageConstructorView
 * @version 364.0.0
 */

import React, { Suspense, lazy, useState, useCallback, createContext, useContext } from 'react'
import { useStageStore } from '../../stores/stageStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { Box, Layers, Move3D, Save, FolderOpen, Plus, Trash2, Magnet, MousePointer2, BoxSelect, Users, Map, Wrench } from 'lucide-react'
import { createDefaultFixture, DEFAULT_PHYSICS_PROFILES } from '../../core/stage/ShowFileV2'
import type { FixtureV2, FixtureZone, PhysicsProfile } from '../../core/stage/ShowFileV2'
import type { FixtureDefinition } from '../../types/FixtureDefinition'
import useKeyboardShortcuts from './StageConstructor/KeyboardShortcuts'
import './StageConstructorView.css'

// Lazy load the heavy 3D canvas
const StageGrid3D = lazy(() => import('./StageConstructor/StageGrid3D'))
const GroupManagerPanel = lazy(() => import('./StageConstructor/GroupManagerPanel'))
const FixtureForge = lazy(() => import('../modals/FixtureEditor/FixtureForge'))

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
  
  // Zone visibility - WAVE 363
  showZones: boolean
  setShowZones: (show: boolean) => void
  
  // Fixture Forge - WAVE 364
  openFixtureForge: (fixtureId?: string) => void
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
// TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════

const ConstructorToolbar: React.FC = () => {
  const isDirty = useStageStore(state => state.isDirty)
  const saveShow = useStageStore(state => state.saveShow)
  const showFile = useStageStore(state => state.showFile)
  
  const { snapEnabled, setSnapEnabled, toolMode, setToolMode, showZones, setShowZones } = useConstructorContext()
  
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
        
        {/* Zone Toggle - WAVE 363 */}
        <div className="tool-group">
          <button 
            className={`tool-btn zone-btn ${showZones ? 'active' : ''}`}
            title={showZones ? 'Hide Zones' : 'Show Zones'}
            onClick={() => setShowZones(!showZones)}
          >
            <Map size={16} />
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

/** Tabs for right sidebar - WAVE 363 */
type RightSidebarTab = 'properties' | 'groups'

const StageConstructorView: React.FC = () => {
  // WAVE 361.5 - Snap system state
  const [snapEnabled, setSnapEnabled] = useState(true) // Default ON
  const [draggedFixtureType, setDraggedFixtureType] = useState<string | null>(null)
  const [toolMode, setToolMode] = useState<'select' | 'boxSelect'>('select')
  
  // WAVE 363 - Zone visibility & Groups
  const [showZones, setShowZones] = useState(true)  // Default ON
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('properties')
  const [showGroupCreateModal, setShowGroupCreateModal] = useState(false)
  
  // WAVE 364 - Fixture Forge
  const [isForgeOpen, setIsForgeOpen] = useState(false)
  const [forgeEditingFixtureId, setForgeEditingFixtureId] = useState<string | null>(null)
  
  // Store actions
  const updateFixture = useStageStore(state => state.updateFixture)
  const updateFixturePhysics = useStageStore(state => state.updateFixturePhysics)
  const fixtures = useStageStore(state => state.fixtures)
  
  // Snap values per spec
  const snapDistance = 0.5    // 0.5 metros
  const snapRotation = Math.PI / 12  // 15 grados
  
  // WAVE 364 - Open Fixture Forge
  const openFixtureForge = useCallback((fixtureId?: string) => {
    setForgeEditingFixtureId(fixtureId || null)
    setIsForgeOpen(true)
  }, [])
  
  // WAVE 364 - Handle Forge Save
  const handleForgeSave = useCallback((definition: FixtureDefinition, physics: PhysicsProfile) => {
    if (forgeEditingFixtureId) {
      // Update existing fixture
      const existingFixture = fixtures.find(f => f.id === forgeEditingFixtureId)
      if (existingFixture) {
        updateFixture(forgeEditingFixtureId, {
          model: definition.name,
          manufacturer: definition.manufacturer,
          channelCount: definition.channels.length
        })
        updateFixturePhysics(forgeEditingFixtureId, physics)
      }
    }
    // TODO: Save definition to library for new fixtures
    setIsForgeOpen(false)
    setForgeEditingFixtureId(null)
  }, [forgeEditingFixtureId, fixtures, updateFixture, updateFixturePhysics])
  
  const contextValue: ConstructorContextType = {
    snapEnabled,
    setSnapEnabled,
    snapDistance,
    snapRotation,
    draggedFixtureType,
    setDraggedFixtureType,
    toolMode,
    setToolMode,
    showZones,
    setShowZones,
    openFixtureForge
  }
  
  // WAVE 363 - Keyboard shortcuts
  useKeyboardShortcuts({
    onCreateGroup: () => {
      setRightSidebarTab('groups')
      setShowGroupCreateModal(true)
    },
    onToolModeChange: setToolMode
  })
  
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
          
          {/* Right Sidebar - Properties / Groups (Tabbed) */}
          <aside className="constructor-sidebar properties-sidebar">
            {/* Tab Header - WAVE 363 */}
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${rightSidebarTab === 'properties' ? 'active' : ''}`}
                onClick={() => setRightSidebarTab('properties')}
              >
                <Move3D size={14} />
                <span>Properties</span>
              </button>
              <button
                className={`sidebar-tab ${rightSidebarTab === 'groups' ? 'active' : ''}`}
                onClick={() => setRightSidebarTab('groups')}
              >
                <Users size={14} />
                <span>Groups</span>
              </button>
            </div>
            
            {/* Tab Content */}
            <div className="sidebar-tab-content">
              {rightSidebarTab === 'properties' && <PropertiesContent />}
              {rightSidebarTab === 'groups' && (
                <Suspense fallback={<div className="loading-tab">Loading...</div>}>
                  <GroupManagerPanel />
                </Suspense>
              )}
            </div>
          </aside>
        </div>
        
        {/* WAVE 364 - Fixture Forge Modal */}
        {isForgeOpen && (
          <Suspense fallback={null}>
            <FixtureForge
              isOpen={isForgeOpen}
              onClose={() => {
                setIsForgeOpen(false)
                setForgeEditingFixtureId(null)
              }}
              onSave={handleForgeSave}
              editingFixture={forgeEditingFixtureId 
                ? fixtures.find(f => f.id === forgeEditingFixtureId) 
                : null}
            />
          </Suspense>
        )}
      </div>
    </ConstructorContext.Provider>
  )
}

// Extracted Properties content for tabs
const PropertiesContent: React.FC = () => {
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const fixtures = useStageStore(state => state.fixtures)
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
  const setFixtureZone = useStageStore(state => state.setFixtureZone)
  const { openFixtureForge } = useConstructorContext()
  
  const selectedArray = Array.from(selectedIds)
  const selectedFixture = selectedArray.length === 1 
    ? fixtures.find(f => f.id === selectedArray[0])
    : null
  
  // Zone options for dropdown
  const ZONE_OPTIONS: FixtureZone[] = [
    'stage-left', 'stage-center', 'stage-right',
    'ceiling-front', 'ceiling-back', 'ceiling-left', 'ceiling-right', 'ceiling-center',
    'floor-front', 'floor-back',
    'truss-1', 'truss-2', 'truss-3',
    'custom', 'unassigned'
  ]
  
  if (selectedArray.length === 0) {
    return (
      <div className="empty-state">
        <Move3D size={32} className="empty-icon" />
        <p>Selecciona un fixture</p>
        <span>Click en un objeto 3D para editar</span>
      </div>
    )
  }
  
  if (selectedArray.length > 1) {
    return (
      <div className="multi-select-info">
        <p>{selectedArray.length} fixtures seleccionados</p>
        <span>Click on zone below to assign to all</span>
        
        {/* Zone selector for multi-select */}
        <div className="property-group" style={{ marginTop: 16 }}>
          <label>Assign Zone to All</label>
          <select
            className="zone-select"
            onChange={(e) => {
              const zone = e.target.value as FixtureZone
              for (const id of selectedIds) {
                setFixtureZone(id, zone)
              }
            }}
          >
            <option value="">Select zone...</option>
            {ZONE_OPTIONS.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }
  
  if (!selectedFixture) return null
  
  return (
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
      
      {/* Zone - WAVE 363: Now a dropdown */}
      <div className="property-group">
        <label>Zone</label>
        <select
          className="zone-select"
          value={selectedFixture.zone}
          onChange={(e) => setFixtureZone(selectedFixture.id, e.target.value as FixtureZone)}
        >
          {ZONE_OPTIONS.map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
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
        {/* WAVE 364: Edit Profile Button */}
        <button 
          className="edit-profile-btn"
          onClick={() => openFixtureForge(selectedFixture.id)}
        >
          <Wrench size={14} />
          <span>Edit Profile</span>
        </button>
      </div>
      
      {/* DMX Info */}
      <div className="property-group">
        <label>DMX</label>
        <div className="dmx-info">
          <span>Universe {selectedFixture.universe} · Address {selectedFixture.address}</span>
        </div>
      </div>
    </div>
  )
}

export default StageConstructorView
