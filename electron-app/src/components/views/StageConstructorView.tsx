/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ STAGE CONSTRUCTOR VIEW - WAVE 369.5
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
 * WAVE 368: Library scanner integration
 * WAVE 368.5: Accordion UI + Big Forge Button + D&D Raycaster Fix
 * WAVE 369.5: File System Dialogs (Open/Save/New) + Title Sync
 * 
 * @module components/views/StageConstructorView
 * @version 369.5.0
 */

import React, { Suspense, lazy, useState, useCallback, useEffect, createContext, useContext, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStageStore } from '../../stores/stageStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { useNavigationStore, selectStageConstructorNav } from '../../stores/navigationStore'
import { Box, Layers, Move3D, Save, FolderOpen, Plus, Trash2, Magnet, MousePointer2, BoxSelect, Users, Map, Wrench, RefreshCcw, Upload, ChevronRight, ChevronDown, FilePlus, Pencil, LayoutGrid, Box as Box3D } from 'lucide-react'
import { lazy as lazyComponent } from 'react'
const StageCanvas2D = lazyComponent(() => import('./StageConstructor/StageCanvas2D'))
import { createDefaultFixture, DEFAULT_PHYSICS_PROFILES, mapLibraryTypeToFixtureType } from '../../core/stage/ShowFileV2'
import type { FixtureV2, FixtureZone, PhysicsProfile, InstallationOrientation } from '../../core/stage/ShowFileV2'
import type { FixtureDefinition } from '../../types/FixtureDefinition'
import useKeyboardShortcuts from './StageConstructor/KeyboardShortcuts'
import { UniversalAssetBrowser } from '../shared/AssetBrowser'
import type { LibraryAsset } from '../../stores/assetAdapters'
import './StageConstructorView.css'

// Lazy load the heavy 3D canvas
const StageGrid3D = lazy(() => import('./StageConstructor/StageGrid3D'))
const GroupManagerPanel = lazy(() => import('./StageConstructor/GroupManagerPanel'))
// WAVE 1117: DELETED - FixtureForge modal removed, now uses /forge view

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 368.5: COLLAPSIBLE SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  badge?: number | string
  children: React.ReactNode
  action?: React.ReactNode
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  defaultOpen = true, 
  badge,
  children,
  action
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className={`collapsible-section ${isOpen ? 'open' : 'closed'}`}>
      <div 
        className="collapsible-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="collapse-icon">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="section-title">{title}</span>
        {badge !== undefined && <span className="section-badge">{badge}</span>}
        {action && (
          <div className="section-action" onClick={e => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>
      <div className="collapsible-content">
        {isOpen && children}
      </div>
    </div>
  )
}

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

  // 🧱 WAVE 4538: Voxel view toggles
  showCrystalBox: boolean
  setShowCrystalBox: (v: boolean) => void
  showFloorGrid: boolean
  setShowFloorGrid: (v: boolean) => void
  showDropLines: boolean
  setShowDropLines: (v: boolean) => void
  ghostCursorEnabled: boolean
  setGhostCursorEnabled: (v: boolean) => void

  // Fixture Forge - WAVE 364
  openFixtureForge: (fixtureId?: string, existingDefinition?: FixtureDefinition) => void

  // 🗺️ WAVE 4574: 3D/2D view mode
  viewMode: '3d' | '2d'
  setViewMode: (mode: '3d' | '2d') => void
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

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE LIBRARY SIDEBAR (LEFT) - WAVE 4549.3
// Reemplaza la lista plana legacy por UniversalAssetBrowser compact.
// handleDragStart conecta el D&D de las AssetCards con StageGrid3D.
// ═══════════════════════════════════════════════════════════════════════════

const FixtureLibrarySidebar: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const groups = useStageStore(state => state.groups)
  const { setDraggedFixtureType } = useConstructorContext()

  // WAVE 4574-C: Guerrilla Quick-Add EXTIRPADO.
  // Click en librería ya NO crea fixtures. Solo D&D.
  // 3D viewport = placed (IK motor espacial).
  // 2D viewport = unplaced (pan-tilt clásico, sin posición 3D).
  
  const handleDragStart = useCallback((e: React.DragEvent, type: string, libraryId?: string) => {
    e.dataTransfer.setData('fixture-type', type)
    if (libraryId) {
      e.dataTransfer.setData('library-fixture-id', libraryId)
    }
    e.dataTransfer.effectAllowed = 'copy'
    setDraggedFixtureType(type)
    
    // Ghost image visual al arrastrar
    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.innerHTML = getFixtureIcon(type)
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
  
  return (
    <aside className="constructor-sidebar library-sidebar">
      <div className="sidebar-header">
        <Layers size={18} />
        <h3>Fixture Library</h3>
      </div>
      
      <div className="sidebar-content">
        {/* WAVE 4549.3: UniversalAssetBrowser compact reemplaza la lista plana legacy */}
        {/* D&D: onDragStart configura el dataTransfer para que StageGrid3D reciba fixture-type + library-fixture-id */}
        <div className="sidebar-asset-browser">
          <UniversalAssetBrowser
            assetTypes={['fixture']}
            compact={true}
            defaultViewMode="tree"
            maxHeight="100%"
            onDragStart={(e: React.DragEvent, asset: LibraryAsset) => {
              const rawDef = (asset as any)._raw
              const fixtureType = rawDef?.type
                ? mapLibraryTypeToFixtureType(rawDef.type)
                : 'par'
              handleDragStart(e, fixtureType, asset.id)
            }}
          />
        </div>
        
        {/* On Stage - Open by default */}
        <CollapsibleSection title="On Stage" defaultOpen={true} badge={fixtures.length}>
          {fixtures.length === 0 ? (
            <div className="empty-state compact">
              <p>Stage vacío</p>
              <span>Arrastra fixtures aquí ↓</span>
            </div>
          ) : (
            <ul className="fixture-list">
              {fixtures.map(fix => (
                <li key={fix.id} className="fixture-item">
                  <span className="fixture-type-icon">{getFixtureIcon(fix.type)}</span>
                  <span className="fixture-name">{fix.name}</span>
                  <span className="fixture-address">#{fix.address}</span>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
        
        {/* Groups - Collapsed by default */}
        <CollapsibleSection 
          title="Groups" 
          defaultOpen={false} 
          badge={groups.length}
          action={
            <button className="icon-btn" title="Create Group">
              <Plus size={14} />
            </button>
          }
        >
          {groups.length === 0 ? (
            <div className="empty-state compact">
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
        </CollapsibleSection>
      </div>
    </aside>
  )
}

// Helper: Map definition type to FixtureV2 type
function getFixtureIcon(type: string): string {
  const icons: Record<string, string> = {
    'moving-head': '🎯',
    'par': '💡',
    'wash': '🌊',
    'strobe': '⚡',
    'laser': '🔺',
    'blinder': '☀️'
  }
  return icons[type] || '💡'
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ WAVE 4533: DIMENSION SLIDERS — room size (E7)
// ═══════════════════════════════════════════════════════════════════════════

const DimensionSliders: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const updateStageDimensions = useStageStore(state => state.updateStageDimensions)

  const width = stage?.width ?? 12
  const depth = stage?.depth ?? 8
  const height = stage?.height ?? 6

  return (
    <div className="dimension-sliders">
      <div className="dim-row">
        <span className="dim-label">W</span>
        <input
          type="range" min="4" max="30" step="0.5"
          value={width}
          onChange={(e) => updateStageDimensions({ width: parseFloat(e.target.value) })}
          title={`Stage Width: ${width}m`}
        />
        <span className="dim-value">{width}m</span>
      </div>
      <div className="dim-row">
        <span className="dim-label">D</span>
        <input
          type="range" min="4" max="30" step="0.5"
          value={depth}
          onChange={(e) => updateStageDimensions({ depth: parseFloat(e.target.value) })}
          title={`Stage Depth: ${depth}m`}
        />
        <span className="dim-value">{depth}m</span>
      </div>
      <div className="dim-row">
        <span className="dim-label">H</span>
        <input
          type="range" min="3" max="15" step="0.5"
          value={height}
          onChange={(e) => updateStageDimensions({ height: parseFloat(e.target.value) })}
          title={`Stage Height: ${height}m`}
        />
        <span className="dim-value">{height}m</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧱 WAVE 4538/4539 + WAVE 4547.3: VOXEL VIEW TOGGLES
// HeightLayerManager/VisualizationToggles (2.5D) fueron purgados.
// ═══════════════════════════════════════════════════════════════════════════

const VoxelViewToggles: React.FC = () => {
  const {
    showFloorGrid, setShowFloorGrid,
    showCrystalBox, setShowCrystalBox,
    showDropLines, setShowDropLines,
    ghostCursorEnabled, setGhostCursorEnabled,
  } = useConstructorContext()

  return (
    <div className="viz-toggles">
      <span className="viz-label">VIEW</span>
      <button
        className={`viz-btn ${showFloorGrid ? 'active' : ''}`}
        onClick={() => setShowFloorGrid(!showFloorGrid)}
        title="Toggle floor grid"
      >
        <span className="viz-dot" style={{ background: '#1a1a2e' }} />
        Grid
      </button>
      <button
        className={`viz-btn ${showCrystalBox ? 'active' : ''}`}
        onClick={() => setShowCrystalBox(!showCrystalBox)}
        title="Toggle Crystal Box (room bounds)"
      >
        <span className="viz-dot" style={{ background: '#22d3ee' }} />
        Box
      </button>
      <button
        className={`viz-btn ${showDropLines ? 'active' : ''}`}
        onClick={() => setShowDropLines(!showDropLines)}
        title="Toggle drop lines"
      >
        <span className="viz-dot" style={{ background: '#a855f7' }} />
        Lines
      </button>
      <button
        className={`viz-btn ${ghostCursorEnabled ? 'active' : ''}`}
        onClick={() => setGhostCursorEnabled(!ghostCursorEnabled)}
        title="Toggle Ghost Cursor (placement preview)"
      >
        <span className="viz-dot" style={{ background: '#4ade80' }} />
        Ghost
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOLBAR - WAVE 369.5: Full File System Integration
// ═══════════════════════════════════════════════════════════════════════════

const ConstructorToolbar: React.FC = () => {
  const isDirty = useStageStore(state => state.isDirty)
  const saveShow = useStageStore(state => state.saveShow)
  const showFile = useStageStore(state => state.showFile)
  const showFilePath = useStageStore(state => state.showFilePath)
  const newShow = useStageStore(state => state.newShow)
  const loadShowFile = useStageStore(state => state.loadShowFile)
  
  const { snapEnabled, setSnapEnabled, toolMode, setToolMode, showZones, setShowZones, viewMode, setViewMode } = useConstructorContext()
  
  // WAVE 369.5: Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  // WAVE 369.5: Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])
  
  // WAVE 369.5: Handle Save (smart: Save As if untitled, Save if has path)
  const handleSave = useCallback(async () => {
    if (!showFile) return
    
    // If untitled or no path, trigger Save As dialog
    const isUntitled = showFile.name === 'Untitled Stage' || !showFilePath
    
    if (isUntitled && window.lux?.stage?.saveAsDialog) {
      const result = await window.lux.stage.saveAsDialog(showFile, showFile.name)
      if (result.success && result.filePath) {
        // Extract name from file path
        const savedName = result.filePath.split(/[/\\]/).pop()?.replace(/\.luxshow$/, '') || showFile.name
        showToast(`💾 Saved as "${savedName}"`)
        // Update store with new path and name
        showFile.name = savedName
        useStageStore.setState({ 
          showFilePath: result.filePath,
          isDirty: false
        })
      } else if (!result.cancelled) {
        showToast('Failed to save show', 'error')
      }
    } else {
      // Regular save
      const success = await saveShow()
      if (success) {
        showToast('💾 Show saved')
      } else {
        showToast('Failed to save show', 'error')
      }
    }
  }, [showFile, showFilePath, saveShow, showToast])
  
  // WAVE 369.5: Handle Open
  const handleOpen = useCallback(async () => {
    if (!window.lux?.stage?.openDialog) {
      console.warn('[Toolbar] openDialog not available')
      return
    }
    
    // Check for unsaved changes
    if (isDirty && showFile && window.lux?.stage?.confirmUnsaved) {
      const action = await window.lux.stage.confirmUnsaved(showFile.name)
      if (action === 'cancel') return
      if (action === 'save') {
        await handleSave()
      }
    }
    
    const result = await window.lux.stage.openDialog()
    if (result.success && result.showFile && result.filePath) {
      // WAVE 369.6 FIX: Actually load the file into the store!
      useStageStore.setState({
        showFile: result.showFile,
        showFilePath: result.filePath,
        isDirty: false,
        lastError: null
      })
      // Sync derived state (fixtures array, etc)
      useStageStore.getState()._syncDerivedState()
      showToast(`📂 Opened "${result.showFile.name}"`)
      console.log('[Toolbar] ✅ Loaded show into store:', result.showFile.name, 'with', result.showFile.fixtures.length, 'fixtures')
    } else if (!result.cancelled) {
      showToast('Failed to open file', 'error')
    }
  }, [isDirty, showFile, handleSave, showToast])
  
  // WAVE 369.5: Handle New
  const handleNew = useCallback(async () => {
    if (!window.lux?.stage?.confirmUnsaved) {
      newShow('Untitled Stage')
      return
    }
    
    // Check for unsaved changes
    if (isDirty && showFile) {
      const action = await window.lux.stage.confirmUnsaved(showFile.name)
      if (action === 'cancel') return
      if (action === 'save') {
        await handleSave()
      }
    }
    
    newShow('Untitled Stage')
    showToast('🆕 New stage created')
  }, [isDirty, showFile, newShow, handleSave, showToast])
  
  // WAVE 369.5: Handle title edit
  const startEditingTitle = useCallback(() => {
    if (showFile) {
      setEditedTitle(showFile.name)
      setIsEditingTitle(true)
      setTimeout(() => titleInputRef.current?.select(), 0)
    }
  }, [showFile])
  
  const finishEditingTitle = useCallback(() => {
    if (showFile && editedTitle.trim() && editedTitle !== showFile.name) {
      showFile.name = editedTitle.trim()
      useStageStore.getState()._setDirty()
    }
    setIsEditingTitle(false)
  }, [showFile, editedTitle])
  
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditingTitle()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
    }
  }, [finishEditingTitle])
  
  return (
    <div className="constructor-toolbar">
      {/* Toast Notification */}
      {toast && (
        <div className={`toolbar-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      
      <div className="toolbar-left">
        <h2 className="toolbar-title">
          <Move3D size={20} />
          Stage Constructor
        </h2>
        {showFile && (
          isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              className="show-name-input"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={finishEditingTitle}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <span 
              className="show-name"
              onDoubleClick={startEditingTitle}
              title="Double-click to rename"
            >
              {showFile.name}
              {isDirty && <span className="dirty-indicator">●</span>}
            </span>
          )
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

        {/* 🏗️ WAVE 4533: Stage Dimension Sliders */}
        <div className="tool-group">
          <DimensionSliders />
        </div>

        {/* 🗺️ WAVE 4574: 3D / 2D view mode toggle */}
        <div className="tool-group view-mode-toggle">
          <button
            className={`tool-btn ${viewMode === '3d' ? 'active' : ''}`}
            title="3D Orbit View"
            onClick={() => setViewMode('3d')}
          >
            <Box size={15} />
            <span style={{ fontSize: 11 }}>3D</span>
          </button>
          <button
            className={`tool-btn ${viewMode === '2d' ? 'active' : ''}`}
            title="2D Top-Down View"
            onClick={() => setViewMode('2d')}
          >
            <LayoutGrid size={15} />
            <span style={{ fontSize: 11 }}>2D</span>
          </button>
        </div>
      </div>
      
      <div className="toolbar-right">
        {/* WAVE 369.5: New Stage button */}
        <button 
          className="toolbar-btn"
          title="New Stage"
          onClick={handleNew}
        >
          <Plus size={16} />
          <span>New</span>
        </button>
        
        <button 
          className="toolbar-btn" 
          title="Open Show"
          onClick={handleOpen}
        >
          <FolderOpen size={16} />
          <span>Open</span>
        </button>
        
        <button 
          className="toolbar-btn primary" 
          title={showFilePath ? "Save Show" : "Save Show As..."}
          onClick={handleSave}
        >
          <Save size={16} />
          <span>{showFilePath ? 'Save' : 'Save As...'}</span>
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
  // WAVE 368.5: Auto-create show if none exists
  const showFile = useStageStore(state => state.showFile)
  const newShow = useStageStore(state => state.newShow)
  
  useEffect(() => {
    if (!showFile) {
      console.log('[StageConstructorView] 🆕 No show loaded, creating empty show')
      newShow('Untitled Stage')
    }
  }, [showFile, newShow])
  
  // WAVE 361.5 - Snap system state
  const [snapEnabled, setSnapEnabled] = useState(true) // Default ON
  const [draggedFixtureType, setDraggedFixtureType] = useState<string | null>(null)
  const [toolMode, setToolMode] = useState<'select' | 'boxSelect'>('select')
  
  // WAVE 363 - Zone visibility & Groups
  const [showZones, setShowZones] = useState(true)  // Default ON
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('properties')
  const [showGroupCreateModal, setShowGroupCreateModal] = useState(false)
  // 🗺️ WAVE 4574: 2D top-down view toggle
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  
  // WAVE 1117: DELETED - Forge modal state removed, now uses /forge view
  // 🛡️ WAVE 2042.13.9: useShallow for stable reference
  const { setActiveTab, editFixture } = useNavigationStore(useShallow(selectStageConstructorNav))
  
  // Store actions
  const updateFixture = useStageStore(state => state.updateFixture)
  const updateFixturePhysics = useStageStore(state => state.updateFixturePhysics)
  const fixtures = useStageStore(state => state.fixtures)

  // 🧱 WAVE 4538: Voxel view toggles
  const [showCrystalBox, setShowCrystalBox] = useState(true)
  const [showFloorGrid, setShowFloorGrid] = useState(true)
  const [showDropLines, setShowDropLines] = useState(true)
  const [ghostCursorEnabled, setGhostCursorEnabled] = useState(true)
  
  // Snap values per WAVE 4538 spec
  const snapDistance = 0.25   // 0.25m — voxel unit
  const snapRotation = Math.PI / 12  // 15 grados
  
  // WAVE 1117: THE GREAT PURGE - Rewired to use navigation store
  // Opens /forge view with optional fixture to edit
  const openFixtureForge = useCallback((fixtureId?: string, existingDefinition?: FixtureDefinition) => {
    if (existingDefinition?.id) {
      // Edit existing fixture from library
      editFixture(existingDefinition.id)
    } else if (fixtureId) {
      // Edit fixture from stage
      editFixture(fixtureId)
    } else {
      // New fixture from scratch
      setActiveTab('forge')
    }
  }, [editFixture, setActiveTab])
  
  // WAVE 1117: DELETED - handleForgeSave removed (modal architecture eliminated)
  // Forge view now handles saving directly via LibraryStore IPC
  
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
    showCrystalBox,
    setShowCrystalBox,
    showFloorGrid,
    setShowFloorGrid,
    showDropLines,
    setShowDropLines,
    ghostCursorEnabled,
    setGhostCursorEnabled,
    openFixtureForge,
    viewMode,
    setViewMode
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
          
          {/* Center - 3D / 2D Viewport */}
          <div className="constructor-viewport">
            {viewMode === '3d' ? (
              <>
                <Suspense fallback={<Loading3DFallback />}>
                  <StageGrid3D />
                </Suspense>
                {/* 🧱 WAVE 4538: Voxel View Toggles */}
                <VoxelViewToggles />
              </>
            ) : (
              <Suspense fallback={<Loading3DFallback />}>
                <StageCanvas2D />
              </Suspense>
            )}
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
        
        {/* WAVE 1117: DELETED - FixtureForge modal removed, now uses /forge route */}
      </div>
    </ConstructorContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4574: GUERRILLA PANEL REMOVED — replaced by StageCanvas2D (2D top-down)
// ═══════════════════════════════════════════════════════════════════════════

// (GuerrillaContent, GuerrillaToggleBtn removed — see StageCanvas2D component)





// Extracted Properties content for tabs
const PropertiesContent: React.FC = () => {
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
  const updateFixture = useStageStore(state => state.updateFixture)
  const setFixtureZone = useStageStore(state => state.setFixtureZone)
  const { openFixtureForge } = useConstructorContext()
  
  // 🔥 WAVE 1042.2: REACTIVIDAD GRANULAR MEJORADA
  // El problema era que useCallback memorizaba el selector y no detectaba cambios.
  // Solución: Suscribirse al array de fixtures Y al selectedId, recalcular en cada cambio.
  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null
  const fixtures = useStageStore(state => state.fixtures)
  const selectedFixture = selectedId ? fixtures.find(f => f.id === selectedId) : null
  
  // ⚙️ WAVE 1042.1: STRICT MOTOR MAPPING (con aliases)
  // Los tipos canónicos + aliases comunes
  const getMotorLabel = (type?: string) => {
    // Normalizar input por si acaso llega mayúscula/minúscula mezclada
    const t = type?.toLowerCase().trim() || 'unknown'
    
    switch (t) {
      // Canónicos
      case 'servo-pro':       return '🏎️ Servo Pro'
      case 'stepper-quality': return '🚙 Stepper Quality'
      case 'stepper-economy': return '🛵 Stepper Económico'
      // Aliases comunes
      case 'stepper-cheap':   return '🛵 Stepper Económico'  // Alias
      case 'servo':           return '🏎️ Servo Pro'         // Alias
      case 'stepper':         return '🚙 Stepper Quality'   // Alias (default stepper)
      // Desconocido
      case 'unknown':         return '❓ Desconocido'
      default:                return `❓ ${type}` // Fallback visual por si hay datos viejos
    }
  }

  // 🔥 WAVE 2040.24: CANONICAL ZONES — fuente única desde ShowFileV2
  // 💡 PARS & BARS: Auto-Stereo L/R via Position X (handled by MasterArbiter)
  // 🏎️ MOVERS: Explicit Stereo (user must choose L or R)
  // ✨ SPECIALS: Air, Ambient, Center
  const ZONES_V2 = [
    // 💡 PARS & BARS (Auto-Stereo L/R via Position X)
    { value: 'front',         label: '🔴 FRONT (Main)' },
    { value: 'back',          label: '🔵 BACK (Counter)' },
    { value: 'floor',         label: '⬇️ FLOOR (Uplight)' }, 
    
    // 🏎️ MOVERS (Explicit Stereo)
    { value: 'movers-left',   label: '🏎️ MOVER LEFT' },
    { value: 'movers-right',  label: '🏎️ MOVER RIGHT' },
    
    // ✨ SPECIALS
    { value: 'center',        label: '⚡ CENTER (Strobes/Blinders)' },
    { value: 'air',           label: '✨ AIR (Laser/Atmosphere)' },
    { value: 'ambient',       label: '🌫️ AMBIENT (House)' },
    { value: 'unassigned',    label: '❓ UNASSIGNED' }
  ]

  const ORIENTATIONS: { value: InstallationOrientation; label: string; icon: string }[] = [
    { value: 'ceiling',     label: 'Ceiling (Truss)',   icon: '⬇️' },
    { value: 'floor',       label: 'Floor (Standing)',  icon: '⬆️' },
    { value: 'wall-left',   label: 'Wall Left',         icon: '➡️' },
    { value: 'wall-right',  label: 'Wall Right',        icon: '⬅️' },
    { value: 'truss-front', label: 'Truss Front',       icon: '🔛' },
    { value: 'truss-back',  label: 'Truss Back',        icon: '🔙' },
  ]
  
  // 🔥 WAVE 1041.2: REACTIVE TRUTH - Detect invalid zones
  const isValidZone = (zone?: string) => {
    if (!zone) return false
    return ZONES_V2.some(z => z.value === zone)
  }
  
  // Empty state
  if (selectedIds.size === 0) {
    return (
      <div className="empty-state">
        <Move3D size={32} className="empty-icon" />
        <p>Selecciona un fixture</p>
        <span>Click en el grid 3D para editar</span>
      </div>
    )
  }
  
  // Multi-select state
  if (selectedIds.size > 1) {
    return (
      <div className="multi-select-info">
        <p>{selectedIds.size} fixtures seleccionados</p>
        <span style={{ fontSize: '11px', opacity: 0.6 }}>Edición en lote activa</span>
        
        {/* Zone selector for multi-select */}
        <div className="property-group" style={{ marginTop: 16 }}>
          <label>Asignar Zona a Lote</label>
          <select
            className="zone-select"
            onChange={(e) => {
              const zone = e.target.value as FixtureZone
              if (zone) selectedIds.forEach(id => setFixtureZone(id, zone))
            }}
            defaultValue=""
          >
            <option value="" disabled>-- Seleccionar Zona --</option>
            {ZONES_V2.map(z => (
              <option key={z.value} value={z.value}>{z.label}</option>
            ))}
          </select>
        </div>

        {/* Orientation selector for multi-select */}
        <div className="property-group" style={{ marginTop: 8 }}>
          <label>Asignar Orientación a Lote</label>
          <select
            className="zone-select"
            onChange={(e) => {
              const o = e.target.value as InstallationOrientation
              if (o) selectedIds.forEach(id => updateFixture(id, { orientation: o }))
            }}
            defaultValue=""
          >
            <option value="" disabled>-- Seleccionar Orientación --</option>
            {ORIENTATIONS.map(o => (
              <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
            ))}
          </select>
        </div>
      </div>
    )
  }
  
  if (!selectedFixture) return null
  
  // 🕵️ WAVE 1042: DETECCIÓN DE ZONA VÁLIDA
  const currentZoneIsValid = ZONES_V2.some(z => z.value === selectedFixture.zone)
  const zoneSelectValue = currentZoneIsValid ? selectedFixture.zone : "INVALID_ZONE"
  
  return (
    <div className="fixture-properties">
      {/* Header */}
      <div className="property-header">
        <div className="header-icon">
           {selectedFixture.type === 'moving-head' ? '🎯' : 
            selectedFixture.type === 'laser' ? '🔺' : '💡'}
        </div>
        <div className="header-info">
          <h4>{selectedFixture.name || 'Unnamed'}</h4>
          <span className="fixture-model">{selectedFixture.model || 'Generic'}</span>
        </div>
      </div>
      
      {/* Position */}
      <div className="property-group">
        <label>Coordenadas (m)</label>
        <div className="position-inputs">
          {(['x', 'y', 'z'] as const).map(axis => (
            <div key={axis} className="input-row">
              <span className={`axis-label ${axis}`}>{axis.toUpperCase()}</span>
              <input 
                type="number" step="0.1"
                value={selectedFixture.position[axis].toFixed(2)}
                onChange={(e) => updateFixturePosition(selectedFixture.id, {
                  ...selectedFixture.position,
                  [axis]: parseFloat(e.target.value) || 0
                })}
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Zone Selector - WAVE 1042: REACTIVO */}
      <div className="property-group">
        <label>Zona DMX</label>
        <select
          className={`zone-select ${!currentZoneIsValid ? 'invalid' : ''}`}
          value={zoneSelectValue}
          onChange={(e) => setFixtureZone(selectedFixture.id, e.target.value as FixtureZone)}
        >
          {!currentZoneIsValid && (
            <option value="INVALID_ZONE" disabled>
              ⚠️ {selectedFixture.zone || 'Sin Asignar'}
            </option>
          )}
          {ZONES_V2.map(z => (
            <option key={z.value} value={z.value}>{z.label}</option>
          ))}
        </select>
      </div>

      {/* Orientation Selector - WAVE 4573-C M1a */}
      <div className="property-group">
        <label>Orientación</label>
        <select
          className="zone-select"
          value={selectedFixture.orientation ?? 'ceiling'}
          onChange={(e) => updateFixture(selectedFixture.id, { orientation: e.target.value as InstallationOrientation })}
        >
          {ORIENTATIONS.map(o => (
            <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
          ))}
        </select>
      </div>
      
      {/* Physics - WAVE 1041.2: Strict Motor Mapping */}
      <div className="property-group">
        <label>Hardware & Física</label>
        <div className="physics-info">
          <div className="physics-row">
            <span>Motor:</span>
            <span className="physics-value highlight">
              {getMotorLabel(selectedFixture.physics?.motorType)}
            </span>
          </div>
          <div className="physics-row">
            <span>Aceleración:</span>
            <span className="physics-value">
              {(selectedFixture.physics?.maxAcceleration || 0).toFixed(0)} rad/s²
            </span>
          </div>
          <div className="physics-row">
            <span>Safety:</span>
            <span className={`physics-badge ${selectedFixture.physics?.safetyCap ? 'safe' : 'raw'}`}>
              {selectedFixture.physics?.safetyCap ? '🛡️ ON' : '⚡ RAW'}
            </span>
          </div>
        </div>
        
        <button 
          className="edit-profile-btn"
          onClick={() => openFixtureForge(selectedFixture.id)}
        >
          <Wrench size={14} />
          <span>Editar en Forge</span>
        </button>
      </div>
      
      {/* DMX - WAVE 1042: Patch Info */}
      <div className="property-group">
        <label>Patch DMX</label>
        <div className="dmx-patch-row" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: '8px',
          marginTop: '4px'
        }}>
          <div className="dmx-field" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>UNIVERSE</span>
            <strong style={{ display: 'block', fontSize: '14px' }}>{selectedFixture.universe || 1}</strong>
          </div>
          <div className="dmx-field" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>ADDRESS</span>
            <strong className="address-highlight" style={{ display: 'block', fontSize: '14px', color: '#00ff88' }}>{selectedFixture.address || 1}</strong>
          </div>
          <div className="dmx-field" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>CHANNELS</span>
            <strong style={{ display: 'block', fontSize: '14px' }}>{selectedFixture.channelCount}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StageConstructorView

/* 🏗️ WAVE 4533 — Control Tower styles injected via JS to keep changes self-contained */
const ctStyles = `
  .dimension-sliders {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .dim-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dim-label {
    width: 12px;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255,255,255,0.5);
    font-family: monospace;
    text-transform: uppercase;
  }
  .dimension-sliders input[type=range] {
    width: 90px;
    height: 3px;
    accent-color: #22d3ee;
    cursor: pointer;
  }
  .dim-value {
    width: 34px;
    font-size: 10px;
    color: #22d3ee;
    font-family: monospace;
    text-align: right;
  }

  .height-layer-manager {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px;
    background: rgba(10, 10, 20, 0.92);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    pointer-events: auto;
    z-index: 20;
    white-space: nowrap;
  }
  .hlm-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    font-family: monospace;
  }
  .hlm-tabs {
    display: flex;
    gap: 4px;
  }
  .hlm-tab {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .hlm-tab:hover {
    background: rgba(255,255,255,0.1);
    color: white;
  }
  .hlm-tab.active {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.3);
    color: white;
    font-weight: 600;
  }
  .hlm-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .hlm-height-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 8px;
    border-left: 1px solid rgba(255,255,255,0.1);
  }
  .hlm-height-label {
    font-size: 9px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    font-family: monospace;
    text-transform: uppercase;
  }
  .hlm-height-row input[type=range] {
    width: 100px;
    height: 3px;
    cursor: pointer;
    accent-color: #22d3ee;
  }
  .hlm-height-val {
    width: 42px;
    font-size: 11px;
    font-family: monospace;
    font-weight: 700;
    text-align: right;
  }

  /* 🏗️ WAVE 4536: Visualisation Toggles */
  .viz-toggles {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    background: rgba(10, 10, 20, 0.92);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    pointer-events: auto;
    z-index: 20;
  }
  .viz-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    font-family: monospace;
    margin-right: 2px;
  }
  .viz-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 5px;
    color: rgba(255,255,255,0.45);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .viz-btn:hover { background: rgba(255,255,255,0.1); color: white; }
  .viz-btn.active {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.25);
    color: white;
  }
  .viz-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
`

if (typeof document !== 'undefined' && !document.getElementById('wave-4533-styles')) {
  const s = document.createElement('style')
  s.id = 'wave-4533-styles'
  s.textContent = ctStyles
  document.head.appendChild(s)
}
