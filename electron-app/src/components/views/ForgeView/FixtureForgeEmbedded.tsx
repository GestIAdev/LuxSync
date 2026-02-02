/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FIXTURE FORGE EMBEDDED - WAVE 1112: FUNCTIONAL CLOSURE & LIBRARY MANAGER
 * "The Blacksmith's Workshop" - Full-screen Fixture Editor (no modal overlay)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This component wraps the original FixtureForge but renders it embedded
 * in the main content area instead of as a modal overlay.
 * 
 * Key differences from modal version:
 * - No overlay backdrop
 * - No close button (navigation handled by sidebar)
 * - Full viewport width/height
 * - English labels (WAVE 1110 localization)
 * - LIBRARY tab for fixture browsing (WAVE 1112)
 * 
 * @module components/views/ForgeView/FixtureForgeEmbedded
 * @version 1112.0.0
 */

import React, { useState, useCallback, useEffect, DragEvent, Suspense } from 'react'
import './FixtureForgeEmbedded.css'
import { 
  GripVertical, 
  Server, 
  Factory, 
  Save, 
  Download, 
  Upload,
  Eye,
  EyeOff,
  Sliders,
  Cpu,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  AlertTriangle,
  Check,
  Palette,
  BookOpen,
  Lock
} from 'lucide-react'
import { FixturePreview3D } from '../../modals/FixtureEditor/FixturePreview3D'
import { PhysicsTuner } from '../../modals/FixtureEditor/PhysicsTuner'
import { WheelSmithEmbedded } from './WheelSmithEmbedded'
import { LibraryTab } from './LibraryTab'
import { 
  PhysicsProfile, 
  DEFAULT_PHYSICS_PROFILES,
  FixtureV2,
  MotorType,
  InstallationOrientation
} from '../../../core/stage/ShowFileV2'
import { FixtureDefinition, ChannelType, FixtureChannel, ColorEngineType, WheelColor } from '../../../types/FixtureDefinition'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import { useStageStore } from '../../../stores/stageStore'
import { useLibraryStore } from '../../../stores/libraryStore'
import { useNavigationStore } from '../../../stores/navigationStore'
import '../../modals/FixtureEditor/FixtureForge.css'
import './FixtureForgeEmbedded.css'  // Override styles for embedded mode

// ═══════════════════════════════════════════════════════════════════════════
// TYPES - WAVE 1112: Added 'library' tab
// ═══════════════════════════════════════════════════════════════════════════

type ForgeTabId = 'library' | 'general' | 'channels' | 'wheelsmith' | 'physics' | 'export'

interface FixtureForgeEmbeddedProps {
  onSave: (
    fixture: FixtureDefinition, 
    physics: PhysicsProfile,
    patchData?: { dmxAddress?: number; universe?: number }
  ) => void
  editingFixture?: FixtureV2 | null
  existingDefinition?: FixtureDefinition | null
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - English labels (WAVE 1112: LIBRARY tab added)
// ═══════════════════════════════════════════════════════════════════════════

const TAB_CONFIG: { id: ForgeTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'library', label: 'LIBRARY', icon: <BookOpen size={16} /> },
  { id: 'general', label: 'GENERAL', icon: <Settings size={16} /> },
  { id: 'channels', label: 'CHANNEL RACK', icon: <Server size={16} /> },
  { id: 'wheelsmith', label: 'WHEELSMITH', icon: <Palette size={16} /> },
  { id: 'physics', label: 'PHYSICS ENGINE', icon: <Cpu size={16} /> },
  { id: 'export', label: 'EXPORT', icon: <Download size={16} /> },
]

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION CATEGORY COLORS - WAVE 1111: THE GLOW
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_COLORS: Record<string, string> = {
  INTENSITY: '#a0a0a0',   // White/Gray
  COLOR: '#ef4444',       // Red Neon
  POSITION: '#22d3ee',    // Cyan Neon
  BEAM: '#f59e0b',        // Yellow/Amber
  CONTROL: '#a855f7',     // Violet
}

interface FunctionDef {
  type: ChannelType
  label: string
  color: string
  icon: string
  is16bit?: boolean
}

const FUNCTION_PALETTE: Record<string, FunctionDef[]> = {
  'INTENSITY': [
    { type: 'dimmer', label: 'Dimmer', color: '#ffffff', icon: '💡' },
    { type: 'shutter', label: 'Shutter', color: '#a0a0a0', icon: '🚪' },
    { type: 'strobe', label: 'Strobe', color: '#ffd700', icon: '⚡' },
  ],
  'COLOR': [
    { type: 'red', label: 'Red', color: '#ff0000', icon: '🔴' },
    { type: 'green', label: 'Green', color: '#00ff00', icon: '🟢' },
    { type: 'blue', label: 'Blue', color: '#0088ff', icon: '🔵' },
    { type: 'white', label: 'White', color: '#ffffff', icon: '⚪' },
    { type: 'amber', label: 'Amber', color: '#ffaa00', icon: '🟠' },
    { type: 'uv', label: 'UV', color: '#bf00ff', icon: '🟣' },
    { type: 'color_wheel', label: 'Color Wheel', color: '#ff00ff', icon: '🎨' },
  ],
  'POSITION': [
    { type: 'pan', label: 'Pan', color: '#00f3ff', icon: '↔️' },
    { type: 'pan_fine', label: 'Pan Fine', color: '#0088aa', icon: '↔' },
    { type: 'tilt', label: 'Tilt', color: '#00f3ff', icon: '↕️' },
    { type: 'tilt_fine', label: 'Tilt Fine', color: '#0088aa', icon: '↕' },
  ],
  'BEAM': [
    { type: 'gobo', label: 'Gobo', color: '#bf00ff', icon: '🕸️' },
    { type: 'prism', label: 'Prism', color: '#dd00ff', icon: '💎' },
    { type: 'focus', label: 'Focus', color: '#00ffcc', icon: '🎯' },
    { type: 'zoom', label: 'Zoom', color: '#00ffcc', icon: '🔍' },
  ],
  'CONTROL': [
    { type: 'speed', label: 'Speed', color: '#ffeb3b', icon: '⏱️' },
    { type: 'macro', label: 'Macro', color: '#00ff44', icon: '⚙️' },
    { type: 'control', label: 'Control', color: '#00ff44', icon: '🎛️' },
  ],
}

const FIXTURE_TYPES = [
  'Moving Head', 
  'Par', 
  'Wash',
  'Bar', 
  'Strobe', 
  'Spot', 
  'Laser', 
  'Blinder',
  'Scanner',
  'Other'
]

const COLOR_ENGINE_OPTIONS: { value: ColorEngineType; label: string; description: string; icon: string }[] = [
  { value: 'rgb', label: 'RGB LEDs', description: 'Red/Green/Blue mixing (PARs, Washes)', icon: '🔴🟢🔵' },
  { value: 'rgbw', label: 'RGBW LEDs', description: 'RGB + White LED', icon: '🔴🟢🔵⚪' },
  { value: 'wheel', label: 'Color Wheel', description: 'Mechanical wheel (Beams, Spots)', icon: '🎨' },
  { value: 'cmy', label: 'CMY Mixing', description: 'Cyan/Magenta/Yellow flags', icon: '🩵🩷💛' },
  { value: 'hybrid', label: 'Hybrid', description: 'Wheel + LEDs combined', icon: '🎨+🔴' },
  { value: 'none', label: 'No Color', description: 'Dimmer only (Strobes, etc)', icon: '⬜' },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS - WAVE 1111: Channel Category Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Maps a ChannelType to its visual category for THE GLOW
 */
function getChannelCategory(type: ChannelType): string {
  // Intensity category
  if (['dimmer', 'shutter', 'strobe'].includes(type)) return 'intensity'
  // Color category
  if (['red', 'green', 'blue', 'white', 'amber', 'uv', 'color_wheel', 'cyan', 'magenta', 'yellow'].includes(type)) return 'color'
  // Position category
  if (['pan', 'pan_fine', 'tilt', 'tilt_fine'].includes(type)) return 'position'
  // Beam category
  if (['gobo', 'gobo_rotation', 'prism', 'prism_rotation', 'focus', 'zoom', 'iris', 'frost'].includes(type)) return 'beam'
  // Control category
  if (['speed', 'macro', 'control', 'effect', 'reset'].includes(type)) return 'control'
  return ''
}

/**
 * Gets the color for a channel category - THE GLOW palette
 */
function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toUpperCase()] || ''
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const FixtureForgeEmbedded: React.FC<FixtureForgeEmbeddedProps> = ({
  onSave,
  editingFixture,
  existingDefinition
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // STORES - WAVE 1113: Updated to async library store
  // ═══════════════════════════════════════════════════════════════════════
  
  const { 
    saveUserFixture, 
    isSystemFixture, 
    getFixtureById,
    loadFromDisk 
  } = useLibraryStore()
  const { targetFixtureId, clearTargetFixture } = useNavigationStore()
  
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
  const [physics, setPhysics] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
  const [totalChannels, setTotalChannels] = useState<number>(8)
  const [activeTab, setActiveTab] = useState<ForgeTabId>('library')  // WAVE 1112: Start at library
  const [colorEngine, setColorEngine] = useState<ColorEngineType>('rgb')
  const [wheelColors, setWheelColors] = useState<WheelColor[]>([])
  
  // WAVE 1112: Current editing source tracking
  const [editingSource, setEditingSource] = useState<'system' | 'user' | 'new'>('new')
  const [originalFixtureId, setOriginalFixtureId] = useState<string | null>(null)
  
  // Preview controls
  const [showPreview, setShowPreview] = useState(true)
  const [previewPan, setPreviewPan] = useState(127)
  const [previewTilt, setPreviewTilt] = useState(127)
  const [previewDimmer, setPreviewDimmer] = useState(200)
  const [previewColor, setPreviewColor] = useState({ r: 255, g: 255, b: 255 })
  const [isStressTesting, setIsStressTesting] = useState(false)
  
  // UI state
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [isFormValid, setIsFormValid] = useState(false)
  const [expandedFoundry, setExpandedFoundry] = useState<string | null>('POSITION')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 1112: Load fixture from navigation target
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 1113: Load library from disk on mount
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    console.log('[ForgeEmbedded] 📂 Loading library from disk...')
    loadFromDisk()
  }, [loadFromDisk])
  
  useEffect(() => {
    if (targetFixtureId) {
      const targetFixture = getFixtureById(targetFixtureId)
      if (targetFixture) {
        console.log(`[ForgeEmbedded] 📖 Loading fixture from navigation: ${targetFixture.name}`)
        loadFixtureIntoEditor(targetFixture)
        setEditingSource(targetFixture.source)
        setOriginalFixtureId(targetFixture.id)
        setActiveTab('general')  // Go to edit tabs
        clearTargetFixture()  // Clear the navigation target
      }
    }
  }, [targetFixtureId])

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 1112: Load fixture into editor
  // ═══════════════════════════════════════════════════════════════════════
  
  const loadFixtureIntoEditor = useCallback((def: FixtureDefinition) => {
    setFixture(def)
    setTotalChannels(def.channels.length)
    
    // Load color engine from capabilities
    if (def.capabilities?.colorEngine) {
      setColorEngine(def.capabilities.colorEngine)
    }
    
    // Load wheel colors from wheels or capabilities.colorWheel
    if (def.wheels?.colors) {
      setWheelColors(def.wheels.colors)
    } else if (def.capabilities?.colorWheel?.colors) {
      setWheelColors(def.capabilities.colorWheel.colors)
    } else {
      setWheelColors([])
    }
    
    // Load physics if available
    if (def.physics) {
      const motorType = def.physics.motorType || 'stepper'
      const profileKey = `${motorType}-quality` as keyof typeof DEFAULT_PHYSICS_PROFILES
      setPhysics(DEFAULT_PHYSICS_PROFILES[profileKey] || DEFAULT_PHYSICS_PROFILES['stepper-quality'])
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const hasName = !!fixture.name?.trim()
    const hasChannels = fixture.channels.some(ch => ch.type !== 'unknown')
    
    if (!hasName) {
      setValidationMessage('⚠️ Model name required')
      setIsFormValid(false)
    } else if (!hasChannels) {
      setValidationMessage('⚠️ At least one channel function required')
      setIsFormValid(false)
    } else {
      setValidationMessage('✓ Ready to save')
      setIsFormValid(true)
    }
  }, [fixture])

  // ═══════════════════════════════════════════════════════════════════════
  // CHANNEL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  
  // Generate empty channels when totalChannels changes
  useEffect(() => {
    setFixture(prev => {
      const currentCount = prev.channels.length
      if (currentCount === totalChannels) return prev
      
      if (currentCount < totalChannels) {
        // Add new empty channels
        const newChannels: FixtureChannel[] = Array.from({ length: totalChannels - currentCount }, (_, i) => ({
          index: currentCount + i,
          name: '',
          type: 'unknown' as ChannelType,
          defaultValue: 0,
          is16bit: false
        }))
        return { ...prev, channels: [...prev.channels, ...newChannels] }
      } else {
        // Remove extra channels
        return { ...prev, channels: prev.channels.slice(0, totalChannels) }
      }
    })
  }, [totalChannels])

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, funcType: ChannelType, funcLabel: string) => {
    e.dataTransfer.setData('channelType', funcType)
    e.dataTransfer.setData('channelLabel', funcLabel)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotIndex)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    const channelType = e.dataTransfer.getData('channelType') as ChannelType
    const channelLabel = e.dataTransfer.getData('channelLabel')
    
    setFixture(prev => {
      const newChannels = [...prev.channels]
      newChannels[slotIndex] = {
        ...newChannels[slotIndex],
        type: channelType,
        name: channelLabel,
        defaultValue: getSmartDefaultValue(channelType),
        is16bit: channelType.includes('fine')
      }
      return { ...prev, channels: newChannels }
    })
    
    setDragOverSlot(null)
  }

  const clearChannel = (index: number) => {
    setFixture(prev => {
      const newChannels = [...prev.channels]
      newChannels[index] = {
        index,
        name: '',
        type: 'unknown' as ChannelType,
        defaultValue: 0,
        is16bit: false
      }
      return { ...prev, channels: newChannels }
    })
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS - WAVE 1112: Save to Library
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Build the complete FixtureDefinition with wheels included
   */
  const buildCompleteFixture = useCallback((): FixtureDefinition => {
    return {
      ...fixture,
      // WAVE 1112: Include wheels at root level for JSON export
      wheels: wheelColors.length > 0 ? { colors: wheelColors } : undefined,
      // Also keep in capabilities for HAL compatibility
      capabilities: {
        ...fixture.capabilities,
        colorEngine,
        colorWheel: wheelColors.length > 0 ? {
          colors: wheelColors,
          allowsContinuousSpin: false,
          minChangeTimeMs: 500,
        } : undefined,
        hasPan: fixture.channels.some(ch => ch.type === 'pan'),
        hasTilt: fixture.channels.some(ch => ch.type === 'tilt'),
        hasColorMixing: fixture.channels.some(ch => ['red', 'green', 'blue'].includes(ch.type)),
        hasColorWheel: fixture.channels.some(ch => ch.type === 'color_wheel'),
        hasGobo: fixture.channels.some(ch => ch.type === 'gobo'),
        hasPrism: fixture.channels.some(ch => ch.type === 'prism'),
        hasStrobe: fixture.channels.some(ch => ch.type === 'strobe'),
        hasDimmer: fixture.channels.some(ch => ch.type === 'dimmer'),
      },
    }
  }, [fixture, wheelColors, colorEngine])
  
  const handleSave = useCallback(async () => {
    if (!isFormValid) return
    
    const completeFixture = buildCompleteFixture()
    
    // WAVE 1114 FIX: Handle system vs user vs new correctly
    if (editingSource === 'system') {
      // System fixture: Clone with new ID + "(User Copy)" suffix
      const clonedName = `${completeFixture.name} (User Copy)`
      const clonedFixture = {
        ...completeFixture,
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: clonedName,
      }
      
      const result = await saveUserFixture(clonedFixture)
      if (result.success) {
        setFixture(clonedFixture)
        setEditingSource('user')
        setOriginalFixtureId(clonedFixture.id)
        setSaveMessage('✅ Saved as User Copy (System fixtures are read-only)')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage(`❌ Save failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } else if (editingSource === 'user') {
      // User fixture: UPDATE with SAME ID (no duplication!)
      // Use originalFixtureId to maintain identity
      const updatedFixture = {
        ...completeFixture,
        id: originalFixtureId || completeFixture.id, // Preserve original ID
      }
      
      const result = await saveUserFixture(updatedFixture)
      if (result.success) {
        setSaveMessage('✅ Updated in User Library')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage(`❌ Update failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    } else {
      // New fixture: Generate new ID
      if (!completeFixture.id || !completeFixture.id.startsWith('user-')) {
        completeFixture.id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      
      const result = await saveUserFixture(completeFixture)
      if (result.success) {
        setEditingSource('user')
        setOriginalFixtureId(completeFixture.id)
        setSaveMessage('✅ Saved to User Library')
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage(`❌ Save failed: ${result.error}`)
        setTimeout(() => setSaveMessage(null), 5000)
      }
    }
    
    console.log('[ForgeEmbedded] 🔨 Saved fixture:', completeFixture.name, '| ID:', completeFixture.id)
    
    // Also call the prop callback for any external handlers
    onSave(completeFixture, physics)
  }, [fixture, physics, isFormValid, onSave, buildCompleteFixture, editingSource, originalFixtureId, saveUserFixture])

  const handleExportJSON = useCallback(() => {
    const completeFixture = buildCompleteFixture()
    const blob = new Blob([JSON.stringify(completeFixture, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${completeFixture.name || 'fixture'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [buildCompleteFixture])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 1112: Library Tab Handlers
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleSelectFromLibrary = useCallback((selectedFixture: FixtureDefinition) => {
    loadFixtureIntoEditor(selectedFixture)
    setEditingSource(isSystemFixture(selectedFixture.id) ? 'system' : 'user')
    setOriginalFixtureId(selectedFixture.id)
    setActiveTab('general')  // Go to edit mode
  }, [loadFixtureIntoEditor, isSystemFixture])
  
  const handleNewFromScratch = useCallback(() => {
    setFixture(FixtureFactory.createEmpty())
    setTotalChannels(8)
    setWheelColors([])
    setColorEngine('rgb')
    setPhysics(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
    setEditingSource('new')
    setOriginalFixtureId(null)
    setActiveTab('general')
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className="forge-embedded">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HEADER - WAVE 1112: Shows editing source */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <header className="forge-header embedded">
        <div className="forge-title">
          <Factory size={24} />
          <h1>FIXTURE FORGE</h1>
          <span className="forge-subtitle">
            {editingSource === 'system' && <><Lock size={12} /> System (Read-Only)</>}
            {editingSource === 'user' && 'User Library'}
            {editingSource === 'new' && 'New Fixture'}
          </span>
        </div>
        
        <div className="forge-actions">
          {saveMessage && (
            <span className="save-message">{saveMessage}</span>
          )}
          <span className={`validation-status ${isFormValid ? 'valid' : 'invalid'}`}>
            {validationMessage}
          </span>
          <button 
            className="forge-action-btn export"
            onClick={handleExportJSON}
            title="Export JSON"
          >
            <Download size={18} />
            <span>Export</span>
          </button>
          <button 
            className="forge-action-btn save"
            onClick={handleSave}
            disabled={!isFormValid}
            title={editingSource === 'system' ? 'Save as Copy (System is read-only)' : 'Save Profile'}
          >
            <Save size={18} />
            <span>{editingSource === 'system' ? 'Save Copy' : 'Save'}</span>
          </button>
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TABS - WAVE 1112: Added LIBRARY tab */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <nav className="forge-tabs embedded">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            className={`forge-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="forge-main-content embedded">
        
        {/* LIBRARY TAB - WAVE 1112 */}
        {activeTab === 'library' && (
          <LibraryTab
            onSelectFixture={handleSelectFromLibrary}
            onNewFromScratch={handleNewFromScratch}
            selectedFixtureId={originalFixtureId}
          />
        )}
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="forge-general-panel">
            <div className="forge-form-grid">
              <div className="forge-input-group">
                <label>Manufacturer</label>
                <input
                  type="text"
                  placeholder="ADJ, Chauvet, Martin..."
                  value={fixture.manufacturer || ''}
                  onChange={(e) => setFixture(prev => ({ ...prev, manufacturer: e.target.value }))}
                />
              </div>
              
              <div className="forge-input-group">
                <label>Model Name *</label>
                <input
                  type="text"
                  placeholder="Vizi Beam 5RX"
                  value={fixture.name || ''}
                  onChange={(e) => setFixture(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="forge-input-group">
                <label>Fixture Type</label>
                <select
                  value={fixture.type || 'Other'}
                  onChange={(e) => setFixture(prev => ({ ...prev, type: e.target.value }))}
                >
                  {FIXTURE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div className="forge-input-group">
                <label>Channel Count</label>
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={totalChannels}
                  onChange={(e) => setTotalChannels(Math.max(1, Math.min(64, parseInt(e.target.value) || 1)))}
                />
              </div>
              
              <div className="forge-input-group full-width">
                <label>
                  <Palette size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Color Engine
                </label>
                <select
                  value={colorEngine}
                  onChange={(e) => setColorEngine(e.target.value as ColorEngineType)}
                >
                  {COLOR_ENGINE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
                <span className="color-engine-description">
                  {COLOR_ENGINE_OPTIONS.find(o => o.value === colorEngine)?.description}
                </span>
              </div>
            </div>
            
            {/* Preview Panel */}
            <div className="forge-preview-panel">
              <div className="preview-header">
                <h3>Preview</h3>
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {showPreview && (
                <div className="preview-canvas">
                  <Suspense fallback={<div className="preview-loading">Loading 3D...</div>}>
                    <FixturePreview3D
                      fixtureType={fixture.type || 'Moving Head'}
                      pan={previewPan}
                      tilt={previewTilt}
                      dimmer={previewDimmer}
                      color={previewColor}
                      strobeActive={false}
                      showBeam={true}
                      isStressTesting={isStressTesting}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHANNEL RACK TAB */}
        {activeTab === 'channels' && (
          <div className="forge-channels-layout">
            {/* Function Palette - Left Sidebar */}
            <aside className="function-foundry">
              <h3>Drag Functions</h3>
              {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
                <div key={category} className="function-category">
                  <div 
                    className="category-header"
                    onClick={() => setExpandedFoundry(expandedFoundry === category ? null : category)}
                  >
                    <span>{category}</span>
                    {expandedFoundry === category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  {expandedFoundry === category && (
                    <div className="function-list">
                      {functions.map(func => (
                        <div
                          key={func.type}
                          className="function-chip"
                          draggable
                          onDragStart={(e) => handleDragStart(e, func.type, func.label)}
                          style={{ '--func-color': func.color } as React.CSSProperties}
                        >
                          <span className="func-icon">{func.icon}</span>
                          <span className="func-label">{func.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </aside>
            
            {/* Channel Rack - Center */}
            <div className="channel-rack">
              <div className="rack-header">
                <span>Channel</span>
                <span>Function</span>
                <span>Default</span>
                <span></span>
              </div>
              {fixture.channels.map((channel, idx) => {
                const category = getChannelCategory(channel.type)
                const categoryColor = getCategoryColor(category)
                return (
                  <div 
                    key={idx}
                    className={`channel-slot ${channel.type !== 'unknown' ? 'assigned' : ''} ${dragOverSlot === idx ? 'drag-over' : ''} ${category ? `category-${category}` : ''}`}
                    style={categoryColor ? { 
                      '--slot-category-color': categoryColor 
                    } as React.CSSProperties : undefined}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                  >
                    <span className="channel-number">{idx + 1}</span>
                    <div className="channel-function">
                      {channel.type !== 'unknown' ? (
                        <>
                          <span className="channel-name">{channel.name || channel.type}</span>
                        </>
                      ) : (
                        <span className="channel-empty">Drop function here</span>
                      )}
                    </div>
                    <input
                      type="number"
                      className="channel-default"
                      min={0}
                      max={255}
                      value={channel.defaultValue || 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        setFixture(prev => {
                          const newChannels = [...prev.channels]
                          newChannels[idx] = { ...newChannels[idx], defaultValue: val }
                          return { ...prev, channels: newChannels }
                        })
                      }}
                    />
                    {channel.type !== 'unknown' && (
                      <button 
                        className="channel-clear"
                        onClick={() => clearChannel(idx)}
                        title="Clear channel"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* Preview - Right */}
            {showPreview && (
              <div className="rack-preview">
                <Suspense fallback={<div className="preview-loading">Loading...</div>}>
                  <FixturePreview3D
                    fixtureType={fixture.type || 'Moving Head'}
                    pan={previewPan}
                    tilt={previewTilt}
                    dimmer={previewDimmer}
                    color={previewColor}
                    strobeActive={false}
                    showBeam={true}
                    isStressTesting={isStressTesting}
                  />
                </Suspense>
              </div>
            )}
          </div>
        )}

        {/* WHEELSMITH TAB - WAVE 1111 */}
        {activeTab === 'wheelsmith' && (
          <div className="forge-wheelsmith-panel">
            <WheelSmithEmbedded
              colors={wheelColors}
              onColorsChange={setWheelColors}
              hasColorWheelChannel={fixture.channels.some(ch => ch.type === 'color_wheel')}
              onNavigateToRack={() => setActiveTab('channels')}
            />
          </div>
        )}

        {/* PHYSICS ENGINE TAB */}
        {activeTab === 'physics' && (
          <div className="forge-physics-panel">
            <PhysicsTuner
              physics={physics}
              onChange={setPhysics}
              onStressTest={setIsStressTesting}
              isStressTesting={isStressTesting}
            />
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="forge-export-panel">
            <div className="export-preview">
              <h3>JSON Preview</h3>
              <pre className="json-preview">
                {JSON.stringify(fixture, null, 2)}
              </pre>
            </div>
            <div className="export-actions">
              <button className="export-btn json" onClick={handleExportJSON}>
                <Download size={20} />
                <span>Download JSON</span>
              </button>
              <button className="export-btn copy" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(fixture, null, 2))
              }}>
                <Copy size={20} />
                <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getSmartDefaultValue(type: ChannelType): number {
  switch (type) {
    case 'dimmer': return 255
    case 'shutter': return 255
    case 'pan':
    case 'tilt': return 127
    case 'focus':
    case 'zoom': return 128
    default: return 0
  }
}

export default FixtureForgeEmbedded
