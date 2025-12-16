import React, { useState, useEffect, DragEvent } from 'react'
import { FixtureDefinition, ChannelType } from '../../../types/FixtureDefinition'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import { X, Server, Factory, Save, GripVertical } from 'lucide-react'
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
// FUNCTION PALETTE
// =============================================================================

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
  
  useEffect(() => {
    if (isOpen) {
      setFixture(FixtureFactory.createEmpty())
      setTotalChannels(8)
      setValidationMessage('')
      setIsFormValid(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (totalChannels > 0 && totalChannels <= 64) {
      // Nota: Asegúrate de que FixtureFactory maneje 'unknown' por defecto al generar
      const newChannels = FixtureFactory.generateChannels(totalChannels, fixture.channels)
      // Forzar que los nuevos sean unknown si vienen vacíos
      const sanitizedChannels = newChannels.map(ch => 
        ch.type ? ch : { ...ch, type: 'unknown', name: '' }
      )
      // @ts-ignore
      setFixture(prev => ({ ...prev, channels: sanitizedChannels }))
    }
  }, [totalChannels])

  useEffect(() => {
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown')
    
    if (!fixture.name || fixture.name.trim().length === 0) {
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
  
  const handleDragStart = (e: DragEvent<HTMLDivElement>, func: FunctionDef) => {
    e.dataTransfer.setData('application/json', JSON.stringify(func))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotIndex)
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
        defaultValue: func.type === 'dimmer' ? 255 : (func.type === 'pan' || func.type === 'tilt' ? 127 : 0),
        is16bit: false
      }
      
      setFixture(prev => ({ ...prev, channels: newChannels }))
    } catch (err) {
      console.error('[FixtureForge] Drop error:', err)
    }
  }

  // FIX LOGICO: Borrar ahora resetea a 'unknown'
  const handleClearSlot = (slotIndex: number) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = {
      ...newChannels[slotIndex],
      type: 'unknown' as ChannelType, // Type vacío
      name: '', // Nombre vacío
      defaultValue: 0,
      is16bit: false
    }
    setFixture(prev => ({ ...prev, channels: newChannels }))
  }

  const getCategoryColor = (type: string | undefined) => {
    if (!type || type === 'unknown') return '#333'
    const def = Object.values(FUNCTION_PALETTE).flat().find(f => f.type === type)
    return def?.color || '#333'
  }

  const handleSave = () => {
    if (!fixture.name || fixture.name.trim().length === 0) return;

    const channels = fixture.channels
    const newFixture = {
      id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`,
      name: fixture.name,
      manufacturer: fixture.manufacturer || 'Generic',
      type: fixture.type,
      channelCount: channels.length,
      modes: [{ name: 'Standard', channels: channels }],
      channels: channels
    }

    // @ts-ignore
    onSave(newFixture)
  }

  if (!isOpen) return null

  // =========== RENDER ===========
  return (
    <div className="fixture-editor-overlay">
      <div className="fixture-editor-window">
        
        {/* === HEADER === */}
        <header className="forge-header">
          <div className="forge-input-group">
            <label className="forge-label">Manufacturer</label>
            <input
              type="text"
              className="forge-input"
              placeholder="e.g. Chauvet"
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
              min={1} max={64}
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
                const isEmpty = channel.type === 'unknown';
                const color = getCategoryColor(channel.type);
                
                return (
                  <div 
                    key={index}
                    // CAMBIO CLAVE: Usamos 'dmx-slot' en vez de 'channel-slot'
                    className={`dmx-slot ${!isEmpty ? 'active' : ''}`}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    style={{ '--slot-color': color } as any}
                  >
                    <div className="slot-header">
                      <span>CH {channel.index}</span>
                      {/* Solo mostrar X si tiene contenido */}
                      {!isEmpty && (
                        <button 
                          className="slot-clear-btn"
                          onClick={() => handleClearSlot(index)}
                          title="Clear Slot"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* ZONA DE DROP - VISUALIZA 'DROP HERE' O EL TIPO */}
                    <div 
                      className={`slot-dropzone ${!isEmpty ? 'has-function' : ''}`}
                    >
                      {isEmpty ? 'DROP HERE' : channel.type?.toUpperCase()}
                    </div>

                    <input 
                      className="slot-input-name" 
                      value={channel.name} 
                      placeholder={isEmpty ? "Empty..." : "Name..."}
                      disabled={isEmpty} // Desactivar si no hay función
                      onChange={(e) => {
                        const newCh = [...fixture.channels]; 
                        newCh[index].name = e.target.value; 
                        setFixture(prev => ({ ...prev, channels: newCh }));
                      }} 
                    />

                    <div className="slot-footer">
                      <span style={{fontSize: '0.7rem', color: '#666', opacity: isEmpty ? 0.3 : 1}}>INIT VAL:</span>
                      <input 
                        type="number" 
                        className="slot-input-val" 
                        min={0} max={255}
                        value={channel.defaultValue} 
                        disabled={isEmpty}
                        style={{opacity: isEmpty ? 0.3 : 1}}
                        onChange={(e) => {
                          const newCh = [...fixture.channels]; 
                          newCh[index].defaultValue = parseInt(e.target.value) || 0; 
                          setFixture(prev => ({ ...prev, channels: newCh }));
                        }}
                      />
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
                    <div
                      key={func.type}
                      className="function-cartridge"
                      style={{ '--cartridge-color': func.color } as any}
                      draggable
                      onDragStart={(e) => handleDragStart(e, func)}
                    >
                      <span className="cartridge-icon">{func.icon}</span>
                      <span className="cartridge-label">{func.label}</span>
                      <GripVertical size={16} color="#666" />
                    </div>
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