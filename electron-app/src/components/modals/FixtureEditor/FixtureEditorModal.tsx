import React, { useState, useEffect, DragEvent } from 'react'
import { FixtureDefinition, ChannelType } from '../../../types/FixtureDefinition'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import { X, Server, Factory, Save } from 'lucide-react'
import './FixtureEditor.css'

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface FixtureEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (fixture: FixtureDefinition) => void
}

interface FunctionDef {
  type: ChannelType
  label: string
  color: string
  icon: string
}

// =============================================================================
// FUNCTION PALETTE - Todas las funciones DMX disponibles
// =============================================================================

const FUNCTION_PALETTE: Record<string, FunctionDef[]> = {
  'INTENSITY': [
    { type: 'dimmer', label: 'Dimmer', color: '#ffffff', icon: '💡' },
    { type: 'shutter', label: 'Shutter', color: '#e0e0e0', icon: '🚪' },
    { type: 'strobe', label: 'Strobe', color: '#ffeb3b', icon: '⚡' },
  ],
  'COLOR': [
    { type: 'red', label: 'Red', color: '#ff3366', icon: '🔴' },
    { type: 'green', label: 'Green', color: '#00ff88', icon: '🟢' },
    { type: 'blue', label: 'Blue', color: '#3366ff', icon: '🔵' },
    { type: 'white', label: 'White', color: '#ffffff', icon: '⚪' },
    { type: 'amber', label: 'Amber', color: '#ffaa00', icon: '🟠' },
    { type: 'uv', label: 'UV', color: '#bb00ff', icon: '🟣' },
    { type: 'color_wheel', label: 'Color Wheel', color: '#ff00ff', icon: '🎨' },
  ],
  'POSITION': [
    { type: 'pan', label: 'Pan', color: '#00d4ff', icon: '↔️' },
    { type: 'pan_fine', label: 'Pan Fine', color: '#0099cc', icon: '↔' },
    { type: 'tilt', label: 'Tilt', color: '#00d4ff', icon: '↕️' },
    { type: 'tilt_fine', label: 'Tilt Fine', color: '#0099cc', icon: '↕' },
  ],
  'BEAM': [
    { type: 'gobo', label: 'Gobo', color: '#aa00ff', icon: '🕸️' },
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

const FIXTURE_TYPES = ['Moving Head', 'Par', 'Bar', 'Wash', 'Strobe', 'Spot', 'Laser', 'Other']

// =============================================================================
// COMPONENT
// =============================================================================

export const FixtureEditorModal: React.FC<FixtureEditorModalProps> = ({ isOpen, onClose, onSave }) => {
  // =========== STATE ===========
  const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
  const [totalChannels, setTotalChannels] = useState<number>(8)
  const [validationMessage, setValidationMessage] = useState<string>('')
  const [isFormValid, setIsFormValid] = useState<boolean>(false)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  // =========== EFFECTS ===========
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFixture(FixtureFactory.createEmpty())
      setTotalChannels(8)
      setValidationMessage('')
      setIsFormValid(false)
    }
  }, [isOpen])

  // Update channels when totalChannels changes
  useEffect(() => {
    if (totalChannels > 0 && totalChannels <= 64) {
      const newChannels = FixtureFactory.generateChannels(totalChannels, fixture.channels)
      setFixture(prev => ({ ...prev, channels: newChannels }))
    }
  }, [totalChannels])

  // Validation
  useEffect(() => {
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown' && ch.name.trim().length > 0)
    
    if (fixture.name.trim().length === 0) {
      setValidationMessage('⚠️ Enter a model name')
      setIsFormValid(false)
    } else if (activeChannels.length === 0) {
      setValidationMessage('⚠️ Assign at least one function')
      setIsFormValid(false)
    } else {
      setValidationMessage('✅ Ready: ' + activeChannels.length + ' channels configured')
      setIsFormValid(true)
    }
  }, [fixture])

  // =========== HANDLERS ===========
  
  const handleDragStart = (e: DragEvent<HTMLButtonElement>, func: FunctionDef) => {
    e.dataTransfer.setData('application/json', JSON.stringify(func))
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
    setDragOverSlot(null)
    
    try {
      const data = e.dataTransfer.getData('application/json')
      const func: FunctionDef = JSON.parse(data)
      
      const newChannels = [...fixture.channels]
      newChannels[slotIndex] = {
        ...newChannels[slotIndex],
        type: func.type,
        name: func.label,
        defaultValue: 0,
        is16bit: false
      }
      
      setFixture(prev => ({ ...prev, channels: newChannels }))
    } catch (err) {
      console.error('[FixtureForge] Drop error:', err)
    }
  }

  const handleClearSlot = (slotIndex: number) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = {
      ...newChannels[slotIndex],
      type: 'unknown' as ChannelType,
      name: '',
      defaultValue: 0,
      is16bit: false
    }
    setFixture(prev => ({ ...prev, channels: newChannels }))
  }

  const handleChannelNameChange = (slotIndex: number, name: string) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = { ...newChannels[slotIndex], name }
    setFixture(prev => ({ ...prev, channels: newChannels }))
  }

  const handleSave = () => {
    if (!isFormValid) return
    
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown' && ch.name.trim().length > 0)
    const fixtureToSave = { ...fixture, channels: activeChannels }
    
    const validationResult = FixtureFactory.validate(fixtureToSave)
    if (validationResult) {
      onSave(fixtureToSave)
    }
  }

  // =========== EARLY RETURN - CRÍTICO PARA MODAL ===========
  if (!isOpen) {
    return null
  }

  // =========== RENDER ===========
  return (
    <div className="fixture-editor-overlay" onClick={onClose}>
      <div className="fixture-editor-window" onClick={(e) => e.stopPropagation()}>
        
        {/* === HEADER === */}
        <header className="forge-header">
          <div className="forge-input-group">
            <label className="forge-label">Manufacturer</label>
            <input
              type="text"
              className="forge-input"
              placeholder="e.g. Chauvet, ADJ, Elation"
              value={fixture.manufacturer}
              onChange={(e) => setFixture(prev => ({ ...prev, manufacturer: e.target.value }))}
            />
          </div>
          
          <div className="forge-input-group">
            <label className="forge-label">Model Name *</label>
            <input
              type="text"
              className="forge-input"
              placeholder="e.g. Rogue R2 Spot"
              value={fixture.name}
              onChange={(e) => setFixture(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          
          <div className="forge-input-group" style={{ maxWidth: '120px' }}>
            <label className="forge-label">Channels</label>
            <input
              type="number"
              className="forge-input"
              min={1}
              max={64}
              value={totalChannels}
              onChange={(e) => setTotalChannels(Math.max(1, Math.min(64, parseInt(e.target.value) || 1)))}
            />
          </div>
          
          <div className="forge-input-group" style={{ maxWidth: '180px' }}>
            <label className="forge-label">Type</label>
            <select
              className="forge-select"
              value={fixture.type}
              onChange={(e) => setFixture(prev => ({ ...prev, type: e.target.value }))}
            >
              {FIXTURE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <button className="close-icon-btn" onClick={onClose} title="Close">
            <X size={24} />
          </button>
        </header>

        {/* === BODY === */}
        <main className="forge-body">
          
          {/* --- LEFT: THE RACK --- */}
          <section className="rack-area">
            <h2 className="section-title">
              <Server size={20} /> THE RACK
            </h2>
            
            <div className="rack-grid">
              {fixture.channels.map((channel, index) => {
                const hasFunction = channel.type !== 'unknown' && channel.name.trim().length > 0
                const funcDef = hasFunction 
                  ? Object.values(FUNCTION_PALETTE).flat().find(f => f.type === channel.type)
                  : null
                
                return (
                  <div 
                    key={index}
                    className={'dmx-slot' + (hasFunction ? ' active' : '') + (dragOverSlot === index ? ' drag-over' : '')}
                  >
                    <div className="slot-header">
                      <span>CH {index + 1}</span>
                      <span>DMX {index + 1}</span>
                    </div>
                    
                    <div
                      className={'slot-dropzone' + (hasFunction ? ' has-function' : '')}
                      style={{ '--slot-color': funcDef?.color || '#333' } as React.CSSProperties}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                    >
                      {hasFunction ? (
                        <span style={{ color: funcDef?.color }}>
                          {funcDef?.icon} {channel.name}
                        </span>
                      ) : (
                        <span style={{ color: '#555' }}>Drop function here</span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="slot-input-name"
                        placeholder="Custom name..."
                        value={channel.name}
                        onChange={(e) => handleChannelNameChange(index, e.target.value)}
                      />
                      {hasFunction && (
                        <button 
                          className="slot-clear-btn"
                          onClick={() => handleClearSlot(index)}
                          title="Clear"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* --- RIGHT: THE FOUNDRY --- */}
          <aside className="foundry-area">
            <div className="foundry-header">
              <h2 className="foundry-title">
                <Factory size={20} /> THE FOUNDRY
              </h2>
            </div>
            
            <div className="foundry-content">
              {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
                <div key={category} className="function-category">
                  <div className="category-label">{category}</div>
                  
                  {functions.map((func) => (
                    <button
                      key={func.type}
                      className="function-cartridge"
                      style={{ '--cartridge-color': func.color } as React.CSSProperties}
                      draggable
                      onDragStart={(e) => handleDragStart(e, func)}
                    >
                      <span className="cartridge-icon">{func.icon}</span>
                      <span className="cartridge-label">{func.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </main>

        {/* === FOOTER === */}
        <footer className="forge-footer">
          <span className={'validation-message ' + (isFormValid ? 'valid' : 'invalid')}>
            {validationMessage}
          </span>
          
          <button className="btn-cancel" onClick={onClose}>
            CANCEL
          </button>
          
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={!isFormValid}
          >
            <Save size={18} />
            SAVE FIXTURE
          </button>
        </footer>
      </div>
    </div>
  )
}

export default FixtureEditorModal