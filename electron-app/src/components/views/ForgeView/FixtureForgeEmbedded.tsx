/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔨 FIXTURE FORGE EMBEDDED - WAVE 1110: THE GREAT UNBUNDLING
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
 * 
 * @module components/views/ForgeView/FixtureForgeEmbedded
 * @version 1110.0.0
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
  Palette
} from 'lucide-react'
import { FixturePreview3D } from '../../modals/FixtureEditor/FixturePreview3D'
import { PhysicsTuner } from '../../modals/FixtureEditor/PhysicsTuner'
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
import '../../modals/FixtureEditor/FixtureForge.css'
import './FixtureForgeEmbedded.css'  // Override styles for embedded mode

// ═══════════════════════════════════════════════════════════════════════════
// TYPES - WAVE 1110: Extended tabs
// ═══════════════════════════════════════════════════════════════════════════

type ForgeTabId = 'general' | 'channels' | 'physics' | 'export'

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
// CONSTANTS - English labels (WAVE 1110: EN-US Standard)
// ═══════════════════════════════════════════════════════════════════════════

const TAB_CONFIG: { id: ForgeTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'GENERAL', icon: <Settings size={16} /> },
  { id: 'channels', label: 'CHANNEL RACK', icon: <Server size={16} /> },
  { id: 'physics', label: 'PHYSICS ENGINE', icon: <Cpu size={16} /> },
  { id: 'export', label: 'EXPORT', icon: <Download size={16} /> },
]

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
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const FixtureForgeEmbedded: React.FC<FixtureForgeEmbeddedProps> = ({
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
  const [activeTab, setActiveTab] = useState<ForgeTabId>('general')
  const [colorEngine, setColorEngine] = useState<ColorEngineType>('rgb')
  
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
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleSave = useCallback(() => {
    if (!isFormValid) return
    
    console.log('[ForgeEmbedded] 🔨 Saving fixture:', fixture.name)
    onSave(fixture, physics)
  }, [fixture, physics, isFormValid, onSave])

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fixture.name || 'fixture'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [fixture])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className="forge-embedded">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HEADER - WAVE 1110: English labels */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <header className="forge-header embedded">
        <div className="forge-title">
          <Factory size={24} />
          <h1>FIXTURE FORGE</h1>
          <span className="forge-subtitle">The Blacksmith</span>
        </div>
        
        <div className="forge-actions">
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
            title="Save Profile"
          >
            <Save size={18} />
            <span>Save Profile</span>
          </button>
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TABS - WAVE 1110 */}
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
              {fixture.channels.map((channel, idx) => (
                <div 
                  key={idx}
                  className={`channel-slot ${channel.type !== 'unknown' ? 'assigned' : ''} ${dragOverSlot === idx ? 'drag-over' : ''}`}
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
              ))}
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
