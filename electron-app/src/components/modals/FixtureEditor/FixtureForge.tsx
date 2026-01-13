/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FIXTURE FORGE - WAVE 364: LA HERRERÍA
 * "El Laboratorio de Frankenstein donde creamos vida"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Editor profesional de fixtures con:
 * - Channel Mapper (Drag & Drop)
 * - Vista previa 3D en tiempo real
 * - Physics Tuner (El Seguro de Vida)
 * - Export/Import de definiciones
 * 
 * @module components/modals/FixtureEditor/FixtureForge
 * @version 364.0.0
 */

import React, { useState, useCallback, useEffect, DragEvent, Suspense } from 'react'
import { 
  X, 
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
  Check
} from 'lucide-react'
import { FixturePreview3D } from './FixturePreview3D'
import { PhysicsTuner } from './PhysicsTuner'
import { 
  PhysicsProfile, 
  DEFAULT_PHYSICS_PROFILES,
  FixtureV2,
  MotorType
} from '../../../core/stage/ShowFileV2'
import { FixtureDefinition, ChannelType, FixtureChannel } from '../../../types/FixtureDefinition'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import { useStageStore } from '../../../stores/stageStore'
import './FixtureForge.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FixtureForgeProps {
  /** Is the modal open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Save handler - returns the complete fixture profile */
  onSave: (fixture: FixtureDefinition, physics: PhysicsProfile) => void
  /** Optional existing fixture to edit */
  editingFixture?: FixtureV2 | null
  /** Optional existing definition to load */
  existingDefinition?: FixtureDefinition | null
}

interface FunctionDef {
  type: ChannelType
  label: string
  color: string
  icon: string
  is16bit?: boolean
}

type TabId = 'channels' | 'physics' | 'export'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate deterministic ID (NO Math.random - Axioma Anti-Simulación)
 */
function generateFixtureId(name: string): string {
  const timestamp = Date.now()
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return `fxt-${hash}-${timestamp}`
}

/**
 * Get category color for a channel type
 */
function getCategoryColor(type: ChannelType | undefined): string {
  if (!type || type === 'unknown') return '#333'
  const def = Object.values(FUNCTION_PALETTE).flat().find(f => f.type === type)
  return def?.color || '#333'
}

/**
 * Detect if channel is 16-bit based on naming pattern
 */
function detect16bit(type: ChannelType, prevChannel?: FixtureChannel): boolean {
  // Cast to string for comparison since TypeScript may have stale types
  const typeStr = type as string
  if (typeStr === 'pan_fine' || typeStr === 'tilt_fine') return true
  if (prevChannel && (prevChannel.type === 'pan' || prevChannel.type === 'tilt')) {
    if (typeStr === 'pan_fine' || typeStr === 'tilt_fine') return true
  }
  return false
}

/**
 * Export fixture definition to .fxt format (FreeStyler compatible)
 */
function exportToFXT(fixture: FixtureDefinition): string {
  const lines: string[] = [
    `; FXT Definition generated by LuxSync Fixture Forge`,
    `; ${new Date().toISOString()}`,
    ``,
    `[General]`,
    `Manufacturer=${fixture.manufacturer}`,
    `Name=${fixture.name}`,
    `Type=${fixture.type}`,
    `Channels=${fixture.channels.length}`,
    ``,
    `[Channels]`
  ]
  
  fixture.channels.forEach((ch, i) => {
    lines.push(`Channel${i + 1}=${ch.name || ch.type}`)
  })
  
  lines.push('')
  lines.push(`[Functions]`)
  
  fixture.channels.forEach((ch, i) => {
    const typeMap: Record<string, string> = {
      'dimmer': 'Dimmer',
      'pan': 'Pan',
      'pan_fine': 'Pan Fine',
      'tilt': 'Tilt',
      'tilt_fine': 'Tilt Fine',
      'red': 'Red',
      'green': 'Green',
      'blue': 'Blue',
      'white': 'White',
      'amber': 'Amber',
      'strobe': 'Strobe',
      'gobo': 'Gobo',
      'prism': 'Prism',
      'color_wheel': 'Color',
      'zoom': 'Zoom',
      'focus': 'Focus',
      'shutter': 'Shutter',
      'speed': 'Speed',
      'control': 'Control',
      'macro': 'Macro'
    }
    lines.push(`Function${i + 1}=${typeMap[ch.type] || 'Unknown'}`)
  })
  
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const FixtureForge: React.FC<FixtureForgeProps> = ({
  isOpen,
  onClose,
  onSave,
  editingFixture,
  existingDefinition
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
  const [physics, setPhysics] = useState<PhysicsProfile>(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
  const [totalChannels, setTotalChannels] = useState<number>(8)
  const [activeTab, setActiveTab] = useState<TabId>('channels')
  
  // Preview controls
  const [showPreview, setShowPreview] = useState(true)
  const [previewPan, setPreviewPan] = useState(127)
  const [previewTilt, setPreviewTilt] = useState(127)
  const [previewDimmer, setPreviewDimmer] = useState(200)
  const [previewColor, setPreviewColor] = useState({ r: 255, g: 255, b: 255 })
  const [previewStrobe, setPreviewStrobe] = useState(false)
  const [showBeam, setShowBeam] = useState(true)
  const [isStressTesting, setIsStressTesting] = useState(false)
  
  // UI state
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [isFormValid, setIsFormValid] = useState(false)
  const [expandedFoundry, setExpandedFoundry] = useState<string | null>('POSITION')
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      if (existingDefinition) {
        // Edit mode - load existing definition (from library)
        setFixture(existingDefinition)
        setTotalChannels(existingDefinition.channels.length)
      } else if (editingFixture) {
        // 🔥 WAVE 384.5: Create from stage fixture - NOW USES INLINE CHANNELS!
        // editingFixture.channels now contains the channel definitions thanks to WAVE 384
        const fixtureChannels: FixtureChannel[] = editingFixture.channels?.map((ch, idx) => ({
          index: ch.index ?? idx,
          name: ch.name || '',
          type: (ch.type || 'unknown') as ChannelType,
          defaultValue: 0,
          is16bit: ch.is16bit || ch.name?.toLowerCase().includes('fine') || false
        })) || []
        
        console.log(`[FixtureForge] 🔥 Loaded ${fixtureChannels.length} channels from editingFixture`)
        
        setFixture({
          id: editingFixture.profileId || editingFixture.id,
          name: editingFixture.model,
          manufacturer: editingFixture.manufacturer,
          type: editingFixture.type,
          channels: fixtureChannels
        })
        setTotalChannels(fixtureChannels.length || editingFixture.channelCount || 8)
        setPhysics(editingFixture.physics)
      } else {
        // New fixture
        setFixture(FixtureFactory.createEmpty())
        setTotalChannels(8)
        setPhysics(DEFAULT_PHYSICS_PROFILES['stepper-quality'])
      }
      
      // Reset preview
      setPreviewPan(127)
      setPreviewTilt(127)
      setPreviewDimmer(200)
      setActiveTab('channels')
    }
  }, [isOpen, existingDefinition, editingFixture])
  
  // Update channels when totalChannels changes
  useEffect(() => {
    if (totalChannels > 0 && totalChannels <= 64) {
      const newChannels = FixtureFactory.generateChannels(totalChannels, fixture.channels)
      const sanitizedChannels = newChannels.map(ch =>
        ch.type ? ch : { ...ch, type: 'unknown' as ChannelType, name: '' }
      )
      setFixture(prev => ({ ...prev, channels: sanitizedChannels }))
    }
  }, [totalChannels])
  
  // Validation
  useEffect(() => {
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown')
    
    if (!fixture.name || fixture.name.trim().length === 0) {
      setValidationMessage('⚠️ Introduce un nombre de modelo')
      setIsFormValid(false)
    } else if (activeChannels.length === 0) {
      setValidationMessage('⚠️ Asigna al menos una función')
      setIsFormValid(false)
    } else {
      setValidationMessage(`✅ Listo: ${activeChannels.length} canales configurados`)
      setIsFormValid(true)
    }
  }, [fixture])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, func: FunctionDef) => {
    e.dataTransfer.setData('application/json', JSON.stringify(func))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])
  
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotIndex)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null)
  }, [])
  
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    setDragOverSlot(null)
    
    try {
      const data = e.dataTransfer.getData('application/json')
      const func: FunctionDef = JSON.parse(data)
      const prevChannel = slotIndex > 0 ? fixture.channels[slotIndex - 1] : undefined
      
      const newChannels = [...fixture.channels]
      newChannels[slotIndex] = {
        ...newChannels[slotIndex],
        type: func.type,
        name: func.label,
        defaultValue: func.type === 'dimmer' ? 255 : 
                     (func.type === 'pan' || func.type === 'tilt' ? 127 : 0),
        is16bit: detect16bit(func.type, prevChannel)
      }
      
      setFixture(prev => ({ ...prev, channels: newChannels }))
    } catch (err) {
      console.error('[FixtureForge] Drop error:', err)
    }
  }, [fixture.channels])
  
  const handleClearSlot = useCallback((slotIndex: number) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = {
      ...newChannels[slotIndex],
      type: 'unknown' as ChannelType,
      name: '',
      defaultValue: 0,
      is16bit: false
    }
    setFixture(prev => ({ ...prev, channels: newChannels }))
  }, [fixture.channels])
  
  const handleSave = useCallback(async () => {
    if (!isFormValid) return
    
    const finalFixture: FixtureDefinition = {
      id: fixture.id || generateFixtureId(fixture.name),
      name: fixture.name,
      manufacturer: fixture.manufacturer || 'Generic',
      type: fixture.type,
      channels: fixture.channels
    }
    
    // 🔥 WAVE 384.5: Also persist to library
    if (window.lux?.saveDefinition) {
      try {
        const result = await window.lux.saveDefinition(finalFixture)
        if (result.success) {
          console.log(`[FixtureForge] 🔥 Saved definition to library: ${result.path}`)
        } else {
          console.warn(`[FixtureForge] ⚠️ Failed to save to library:`, result.error)
        }
      } catch (err) {
        console.warn(`[FixtureForge] ⚠️ Library save error:`, err)
      }
    }
    
    onSave(finalFixture, physics)
  }, [fixture, physics, isFormValid, onSave])
  
  const handleExport = useCallback(() => {
    const fxtContent = exportToFXT(fixture)
    const blob = new Blob([fxtContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${fixture.manufacturer || 'Generic'}_${fixture.name || 'Fixture'}.fxt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [fixture])
  
  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.fxt,.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        
        // Try JSON first
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(text) as FixtureDefinition
          setFixture(imported)
          setTotalChannels(imported.channels.length)
        }
        // TODO: Parse .fxt format
        
      } catch (err) {
        console.error('[FixtureForge] Import error:', err)
      }
    }
    input.click()
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  if (!isOpen) return null
  
  return (
    <div className="fixture-forge-overlay">
      <div className="fixture-forge-window">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <header className="forge-header">
          <div className="forge-title">
            <Factory size={24} />
            <h1>FIXTURE FORGE</h1>
            <span className="forge-subtitle">La Herrería</span>
          </div>
          
          <div className="forge-metadata">
            <div className="forge-input-group">
              <label>Fabricante</label>
              <input
                type="text"
                placeholder="ADJ, Chauvet..."
                value={fixture.manufacturer}
                onChange={(e) => setFixture(prev => ({ ...prev, manufacturer: e.target.value }))}
              />
            </div>
            
            <div className="forge-input-group">
              <label>Modelo *</label>
              <input
                type="text"
                placeholder="Vizi Beam 5RX"
                value={fixture.name}
                onChange={(e) => setFixture(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="forge-input-group small">
              <label>Canales</label>
              <input
                type="number"
                min={1}
                max={64}
                value={totalChannels}
                onChange={(e) => setTotalChannels(Math.max(1, Math.min(64, parseInt(e.target.value) || 1)))}
              />
            </div>
            
            <div className="forge-input-group">
              <label>Tipo</label>
              <select
                value={fixture.type}
                onChange={(e) => setFixture(prev => ({ ...prev, type: e.target.value }))}
              >
                {FIXTURE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button className="forge-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </header>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TABS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <nav className="forge-tabs">
          <button
            className={`forge-tab ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            <Server size={16} />
            <span>Canalizador</span>
          </button>
          <button
            className={`forge-tab ${activeTab === 'physics' ? 'active' : ''}`}
            onClick={() => setActiveTab('physics')}
          >
            <Cpu size={16} />
            <span>Física</span>
          </button>
          <button
            className={`forge-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            <Download size={16} />
            <span>Export/Import</span>
          </button>
        </nav>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* BODY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <main className="forge-body">
          
          {/* LEFT: Preview 3D */}
          <section className="forge-preview-section">
            <div className="preview-header">
              <h3>
                <Eye size={16} />
                Vista Previa
              </h3>
              <button
                className={`preview-toggle ${showPreview ? '' : 'off'}`}
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            
            {showPreview ? (
              <Suspense fallback={
                <div className="preview-loading">
                  <div className="loading-spinner" />
                  <span>Cargando 3D...</span>
                </div>
              }>
                <FixturePreview3D
                  pan={previewPan}
                  tilt={previewTilt}
                  dimmer={previewDimmer}
                  color={previewColor}
                  strobeActive={previewStrobe}
                  fixtureType={fixture.type}
                  showBeam={showBeam}
                  isStressTesting={isStressTesting}
                />
              </Suspense>
            ) : (
              <div className="preview-disabled">
                <EyeOff size={32} />
                <span>Preview desactivado</span>
              </div>
            )}
            
            {/* Preview Controls */}
            <div className="preview-controls">
              <div className="control-row">
                <label>Pan</label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={previewPan}
                  onChange={(e) => setPreviewPan(parseInt(e.target.value))}
                />
                <span>{previewPan}</span>
              </div>
              <div className="control-row">
                <label>Tilt</label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={previewTilt}
                  onChange={(e) => setPreviewTilt(parseInt(e.target.value))}
                />
                <span>{previewTilt}</span>
              </div>
              <div className="control-row">
                <label>Dim</label>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={previewDimmer}
                  onChange={(e) => setPreviewDimmer(parseInt(e.target.value))}
                />
                <span>{Math.round(previewDimmer / 255 * 100)}%</span>
              </div>
              <div className="control-row colors">
                <label>RGB</label>
                <input
                  type="color"
                  value={`#${previewColor.r.toString(16).padStart(2, '0')}${previewColor.g.toString(16).padStart(2, '0')}${previewColor.b.toString(16).padStart(2, '0')}`}
                  onChange={(e) => {
                    const hex = e.target.value
                    setPreviewColor({
                      r: parseInt(hex.slice(1, 3), 16),
                      g: parseInt(hex.slice(3, 5), 16),
                      b: parseInt(hex.slice(5, 7), 16)
                    })
                  }}
                />
                <button
                  className={`strobe-btn ${previewStrobe ? 'active' : ''}`}
                  onClick={() => setPreviewStrobe(!previewStrobe)}
                >
                  ⚡ Strobe
                </button>
                <button
                  className={`beam-btn ${showBeam ? 'active' : ''}`}
                  onClick={() => setShowBeam(!showBeam)}
                >
                  🔦 Beam
                </button>
              </div>
            </div>
          </section>
          
          {/* CENTER: Tab Content */}
          <section className="forge-main-content">
            
            {/* CHANNELS TAB */}
            {activeTab === 'channels' && (
              <div className="channels-tab">
                <div className="rack-section">
                  <h3>
                    <Server size={18} />
                    THE RACK - Mapa de Canales
                  </h3>
                  <div className="rack-grid">
                    {fixture.channels.map((channel, index) => {
                      const isEmpty = channel.type === 'unknown'
                      const color = getCategoryColor(channel.type)
                      const isDragOver = dragOverSlot === index
                      
                      return (
                        <div
                          key={index}
                          className={`dmx-slot ${!isEmpty ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          style={{ '--slot-color': color } as React.CSSProperties}
                        >
                          <div className="slot-header">
                            <span className="slot-number">CH {channel.index}</span>
                            {!isEmpty && (
                              <button
                                className="slot-clear-btn"
                                onClick={() => handleClearSlot(index)}
                                title="Clear"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          
                          <div className={`slot-dropzone ${!isEmpty ? 'has-function' : ''}`}>
                            {isEmpty ? 'DROP' : channel.type?.toUpperCase()}
                          </div>
                          
                          <input
                            className="slot-name-input"
                            value={channel.name}
                            placeholder={isEmpty ? '—' : 'Nombre...'}
                            disabled={isEmpty}
                            onChange={(e) => {
                              const newChannels = [...fixture.channels]
                              newChannels[index].name = e.target.value
                              setFixture(prev => ({ ...prev, channels: newChannels }))
                            }}
                          />
                          
                          <div className="slot-footer">
                            <span className="slot-default">
                              DEF: {channel.defaultValue}
                            </span>
                            {channel.is16bit && (
                              <span className="slot-16bit">16bit</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* PHYSICS TAB */}
            {activeTab === 'physics' && (
              <div className="physics-tab">
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
              <div className="export-tab">
                <div className="export-section">
                  <h3>
                    <Download size={18} />
                    Exportar Definición
                  </h3>
                  <p>Genera un archivo .fxt compatible con FreeStyler y LuxSync Library.</p>
                  <button className="export-btn" onClick={handleExport}>
                    <Download size={16} />
                    Exportar .fxt
                  </button>
                </div>
                
                <div className="import-section">
                  <h3>
                    <Upload size={18} />
                    Importar Definición
                  </h3>
                  <p>Carga una definición existente (.json o .fxt)</p>
                  <button className="import-btn" onClick={handleImport}>
                    <Upload size={16} />
                    Importar Archivo
                  </button>
                </div>
                
                <div className="preview-json">
                  <h3>Vista previa JSON</h3>
                  <pre>
                    {JSON.stringify({
                      fixture: {
                        name: fixture.name,
                        manufacturer: fixture.manufacturer,
                        type: fixture.type,
                        channels: fixture.channels.filter(ch => ch.type !== 'unknown').length
                      },
                      physics: {
                        motorType: physics.motorType,
                        maxAcceleration: physics.maxAcceleration,
                        safetyCap: physics.safetyCap
                      }
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </section>
          
          {/* RIGHT: Foundry (only on channels tab) */}
          {activeTab === 'channels' && (
            <aside className="forge-foundry">
              <div className="foundry-header">
                <h3>
                  <Factory size={18} />
                  THE FOUNDRY
                </h3>
                <span className="foundry-hint">Arrastra funciones ↔</span>
              </div>
              
              <div className="foundry-categories">
                {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
                  <div key={category} className="foundry-category">
                    <button
                      className="category-header"
                      onClick={() => setExpandedFoundry(
                        expandedFoundry === category ? null : category
                      )}
                    >
                      <span>{category}</span>
                      {expandedFoundry === category ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                    
                    {expandedFoundry === category && (
                      <div className="category-functions">
                        {functions.map((func) => (
                          <div
                            key={func.type}
                            className="function-chip"
                            draggable
                            onDragStart={(e) => handleDragStart(e, func)}
                            style={{ '--chip-color': func.color } as React.CSSProperties}
                          >
                            <span className="chip-icon">{func.icon}</span>
                            <span className="chip-label">{func.label}</span>
                            <GripVertical size={12} className="chip-grip" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </main>
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* FOOTER */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <footer className="forge-footer">
          <span className={`validation-msg ${isFormValid ? 'valid' : 'invalid'}`}>
            {validationMessage}
          </span>
          
          <div className="footer-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={!isFormValid}
            >
              <Save size={18} />
              Guardar Perfil
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default FixtureForge
