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
import { useStageStore } from '../../stores/stageStore'
import { useSelectionStore } from '../../stores/selectionStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { Box, Layers, Move3D, Save, FolderOpen, Plus, Trash2, Magnet, MousePointer2, BoxSelect, Users, Map, Wrench, RefreshCcw, Upload, ChevronRight, ChevronDown, FilePlus, Pencil } from 'lucide-react'
import { createDefaultFixture, DEFAULT_PHYSICS_PROFILES, mapLibraryTypeToFixtureType } from '../../core/stage/ShowFileV2'
import type { FixtureV2, FixtureZone, PhysicsProfile } from '../../core/stage/ShowFileV2'
import type { FixtureDefinition } from '../../types/FixtureDefinition'
import useKeyboardShortcuts from './StageConstructor/KeyboardShortcuts'
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
  
  // Fixture Forge - WAVE 364
  openFixtureForge: (fixtureId?: string, existingDefinition?: FixtureDefinition) => void
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
// FIXTURE LIBRARY SIDEBAR (LEFT) - With Drag Source
// WAVE 368: Now reads real .fxt files from library!
// WAVE 1117: DELETED Quick Templates (FixtureTemplate interface + FIXTURE_TEMPLATES array)
// ═══════════════════════════════════════════════════════════════════════════

// Library fixture loaded from .fxt file
interface LibraryFixture {
  id: string
  name: string
  manufacturer: string
  type: FixtureV2['type']
  channelCount: number
  filePath: string
}

// WAVE 389: Props for exposing reload function
interface FixtureLibrarySidebarProps {
  onLoadLibraryRef?: React.MutableRefObject<(() => Promise<void>) | null>
}

const FixtureLibrarySidebar: React.FC<FixtureLibrarySidebarProps> = ({ onLoadLibraryRef }) => {
  const fixtures = useStageStore(state => state.fixtures)
  const groups = useStageStore(state => state.groups)
  const { setDraggedFixtureType, openFixtureForge } = useConstructorContext()
  
  // WAVE 368: Real library state
  const [libraryFixtures, setLibraryFixtures] = useState<LibraryFixture[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  
  // WAVE 368: Load library on mount
  useEffect(() => {
    loadFixtureLibrary()
  }, [])
  
  const loadFixtureLibrary = useCallback(async () => {
    setIsLoadingLibrary(true)
    setLibraryError(null)
    
    try {
      if (!window.lux?.getFixtureLibrary) {
        console.warn('[FixtureLibrarySidebar] window.lux.getFixtureLibrary not available')
        return
      }
      
      const result = await window.lux.getFixtureLibrary()
      console.log('[FixtureLibrarySidebar] Loaded library:', result?.fixtures?.length || 0, 'fixtures')
      
      if (result?.success && Array.isArray(result.fixtures)) {
        setLibraryFixtures(result.fixtures.map((def) => ({
          id: def.id || def.name,
          name: def.name || 'Unknown',
          manufacturer: def.manufacturer || 'Unknown',
          type: mapDefinitionTypeToFixtureType(def.type),
          channelCount: def.channelCount || 0,
          filePath: def.filePath || ''
        })))
      }
    } catch (error) {
      console.error('[FixtureLibrarySidebar] Failed to load library:', error)
      setLibraryError('Failed to load fixture library')
    } finally {
      setIsLoadingLibrary(false)
    }
  }, [])
  
  // WAVE 389: Expose loadFixtureLibrary to parent via ref
  useEffect(() => {
    if (onLoadLibraryRef) {
      onLoadLibraryRef.current = loadFixtureLibrary
    }
  }, [loadFixtureLibrary, onLoadLibraryRef])
  
  // WAVE 388 EXT: Delete fixture from library
  const handleDeleteFixture = useCallback(async (filePath: string, fixtureName: string) => {
    if (!window.confirm(`¿Eliminar "${fixtureName}" de la librería?`)) {
      return
    }
    
    try {
      // WAVE 388.7: Pass filePath directly for precise deletion
      const result = await window.lux?.deleteDefinition?.(filePath)
      console.log('[Library] Delete result:', result)
      
      if (result?.success) {
        console.log(`[Library] ✅ Deleted: ${result.deletedPath}`)
        // Reload library
        loadFixtureLibrary()
      } else {
        alert(`Error: ${result?.error || 'No se pudo eliminar'}`)
      }
    } catch (err) {
      console.error('[Library] Delete error:', err)
      alert('Error al eliminar fixture')
    }
  }, [loadFixtureLibrary])
  
  // WAVE 388 EXT: Edit fixture (open in Forge)
  const handleEditFixture = useCallback(async (fixtureId: string, fixtureName: string) => {
    // WAVE 389: Load full definition from library to edit
    try {
      const result = await window.lux?.getFixtureLibrary?.()
      if (result?.success && result.fixtures) {
        const definition = result.fixtures.find((f: any) => 
          f.id === fixtureId || f.name === fixtureName
        )
        if (definition) {
          console.log('[Library] 📝 Editing fixture:', definition.name)
          console.log('[Library] 📝 Definition channels:', definition.channels?.length, definition.channels)
          console.log('[Library] 📝 Definition physics:', definition.physics)
          // Cast to FixtureDefinition - library items have all required fields
          openFixtureForge(undefined, definition as unknown as FixtureDefinition)
        } else {
          console.warn('[Library] Fixture not found in library:', fixtureId)
        }
      }
    } catch (err) {
      console.error('[Library] Failed to load fixture for edit:', err)
    }
  }, [openFixtureForge])
  
  const handleDragStart = useCallback((e: React.DragEvent, type: string, libraryId?: string) => {
    e.dataTransfer.setData('fixture-type', type)
    if (libraryId) {
      e.dataTransfer.setData('library-fixture-id', libraryId)
    }
    e.dataTransfer.effectAllowed = 'copy'
    setDraggedFixtureType(type)
    
    // Create ghost image
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
        {/* WAVE 1117: DELETED "FORGE NEW FIXTURE" button - use /forge tab instead */}
        
        {/* User Library - Open by default, most important */}
        <CollapsibleSection 
          title="Your Library" 
          defaultOpen={true} 
          badge={libraryFixtures.length}
          action={
            <button 
              className="icon-btn" 
              title="Refresh Library"
              onClick={loadFixtureLibrary}
              disabled={isLoadingLibrary}
            >
              <RefreshCcw size={14} className={isLoadingLibrary ? 'spinning' : ''} />
            </button>
          }
        >
          {isLoadingLibrary ? (
            <div className="empty-state small">
              <span className="loading-spinner">⏳</span>
              <p>Scanning library...</p>
            </div>
          ) : libraryError ? (
            <div className="empty-state small error">
              <p>{libraryError}</p>
              <button className="retry-btn" onClick={loadFixtureLibrary}>Retry</button>
            </div>
          ) : libraryFixtures.length === 0 ? (
            <div className="empty-state compact">
              <p>No fixture definitions yet</p>
              <span>Use the button above to create one</span>
            </div>
          ) : (
            <ul className="library-fixture-list">
              {libraryFixtures.map(libFix => (
                <li 
                  key={libFix.filePath || libFix.id || libFix.name}
                  className="library-fixture-item"
                  draggable
                  onDragStart={(e) => handleDragStart(e, libFix.type, libFix.id)}
                  onDragEnd={handleDragEnd}
                  title={`${libFix.manufacturer} - ${libFix.channelCount}ch\nDrag to stage`}
                >
                  <span className="fixture-type-icon">{getFixtureIcon(libFix.type)}</span>
                  <div className="fixture-info">
                    <span className="fixture-name">{libFix.name}</span>
                    <span className="fixture-meta">{libFix.manufacturer} · {libFix.channelCount}ch</span>
                  </div>
                  {/* WAVE 388 EXT: Edit & Delete buttons */}
                  <div className="fixture-actions">
                    <button 
                      className="action-btn edit" 
                      title="Editar en Forge"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        // WAVE 389: Pass both id and name for reliable lookup
                        handleEditFixture(libFix.id, libFix.name); 
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button 
                      className="action-btn delete" 
                      title="Eliminar de librería"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        // WAVE 388.7: Pass filePath for precise deletion
                        handleDeleteFixture(libFix.filePath, libFix.name); 
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>
        
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
function mapDefinitionTypeToFixtureType(defType: string): FixtureV2['type'] {
  const typeMap: Record<string, FixtureV2['type']> = {
    'moving-head': 'moving-head',
    'movinghead': 'moving-head',
    'par': 'par',
    'wash': 'wash',
    'spot': 'moving-head',
    'strobe': 'strobe',
    'laser': 'laser',
    'blinder': 'blinder',
    'led-bar': 'par',
    'ledbar': 'par'
  }
  return typeMap[defType?.toLowerCase()] || 'par'
}

// Helper: Get icon for fixture type
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
// TOOLBAR - WAVE 369.5: Full File System Integration
// ═══════════════════════════════════════════════════════════════════════════

const ConstructorToolbar: React.FC = () => {
  const isDirty = useStageStore(state => state.isDirty)
  const saveShow = useStageStore(state => state.saveShow)
  const showFile = useStageStore(state => state.showFile)
  const showFilePath = useStageStore(state => state.showFilePath)
  const newShow = useStageStore(state => state.newShow)
  const loadShowFile = useStageStore(state => state.loadShowFile)
  
  const { snapEnabled, setSnapEnabled, toolMode, setToolMode, showZones, setShowZones } = useConstructorContext()
  
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
  
  // WAVE 1117: DELETED - Forge modal state removed, now uses /forge view
  const { setActiveTab, editFixture } = useNavigationStore()
  
  // WAVE 389: Ref to call library reload from child component
  const reloadLibraryRef = useRef<(() => Promise<void>) | null>(null)
  
  // Store actions
  const updateFixture = useStageStore(state => state.updateFixture)
  const updateFixturePhysics = useStageStore(state => state.updateFixturePhysics)
  const fixtures = useStageStore(state => state.fixtures)
  
  // Snap values per spec
  const snapDistance = 0.5    // 0.5 metros
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
          <FixtureLibrarySidebar onLoadLibraryRef={reloadLibraryRef} />
          
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
        
        {/* WAVE 1117: DELETED - FixtureForge modal removed, now uses /forge route */}
      </div>
    </ConstructorContext.Provider>
  )
}

// Extracted Properties content for tabs
const PropertiesContent: React.FC = () => {
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
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

  // 🧹 WAVE 1040: THE CLEAN SLATE - Only canonical zones
  // 💡 PARS & BARS: Auto-Stereo L/R via Position X (handled by MasterArbiter)
  // 🏎️ MOVERS: Explicit Stereo (user must choose L or R)
  // ✨ SPECIALS: Air, Ambient, Center
  const ZONES_V2 = [
    // 💡 PARS & BARS (Auto-Stereo L/R via Position X)
    { value: 'FRONT_PARS',   label: '🔴 FRONT (Main)' },
    { value: 'BACK_PARS',    label: '🔵 BACK (Counter)' },
    { value: 'FLOOR_PARS',   label: '⬇️ FLOOR (Uplight)' }, 
    
    // 🏎️ MOVERS (Explicit Stereo)
    { value: 'MOVING_LEFT',  label: '🏎️ MOVER LEFT' },
    { value: 'MOVING_RIGHT', label: '🏎️ MOVER RIGHT' },
    
    // ✨ SPECIALS
    { value: 'AIR',          label: '✨ AIR (Laser/Atmosphere)' },
    { value: 'AMBIENT',      label: '🌫️ AMBIENT (House)' },
    { value: 'CENTER',       label: '⚡ CENTER (Strobes/Blinders)' }
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
