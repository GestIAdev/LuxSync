# 🎨 VISUAL FIXTURE FORGE - CÓDIGO COMPLETO

## ⚡ WAVE 27 - PHASE 2: Drag & Drop Edition

> **INSTRUCCIÓN**: Copia todo el contenido del apartado "CÓDIGO TSX COMPLETO" y pégalo en:  
> `electron-app/src/components/modals/FixtureEditor/FixtureEditorModal.tsx`

---

## 📄 CÓDIGO TSX COMPLETO

```tsx
import React, { useState, useEffect } from 'react'
import { FixtureDefinition, FixtureChannel, ChannelType } from '../../../types/FixtureDefinition'
import { FixtureFactory } from '../../../utils/FixtureFactory'
import './FixtureEditor.css'

interface FixtureEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (definition: FixtureDefinition) => void
}

const FIXTURE_TYPES = ['Moving Head', 'Par', 'Bar', 'Wash', 'Strobe', 'Spot', 'Laser', 'Other']

const FUNCTION_PALETTE: Record<string, { type: ChannelType; label: string; color: string; icon: string }[]> = {
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

export const FixtureEditorModal: React.FC<FixtureEditorModalProps> = ({ isOpen, onClose, onSave }) => {
  const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
  const [totalChannels, setTotalChannels] = useState(8)
  const [draggedType, setDraggedType] = useState<ChannelType | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      setFixture(FixtureFactory.createEmpty())
      setTotalChannels(8)
    }
  }, [isOpen])

  useEffect(() => {
    const currentChannels = fixture.channels.length
    if (totalChannels > currentChannels) {
      const newChannels = [...fixture.channels]
      for (let i = currentChannels; i < totalChannels; i++) {
        newChannels.push({
          index: i + 1,
          name: '',
          type: 'unknown',
          defaultValue: 0,
          is16bit: false
        })
      }
      setFixture({ ...fixture, channels: newChannels })
    } else if (totalChannels < currentChannels) {
      setFixture({ ...fixture, channels: fixture.channels.slice(0, totalChannels) })
    }
  }, [totalChannels])

  if (!isOpen) return null

  const handleDragStart = (type: ChannelType) => {
    setDraggedType(type)
  }

  const handleDragEnd = () => {
    setDraggedType(null)
    setDragOverSlot(null)
  }

  const handleDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    setDragOverSlot(slotIndex)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault()
    if (!draggedType) return

    const newChannels = [...fixture.channels]
    const label = FixtureFactory.getChannelLabel(draggedType)
    
    newChannels[slotIndex] = {
      index: slotIndex + 1,
      name: label,
      type: draggedType,
      defaultValue: draggedType === 'dimmer' ? 255 : 0,
      is16bit: draggedType.includes('_fine')
    }

    setFixture({ ...fixture, channels: newChannels })
    setDraggedType(null)
    setDragOverSlot(null)
  }

  const handleClearSlot = (slotIndex: number) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = {
      index: slotIndex + 1,
      name: '',
      type: 'unknown',
      defaultValue: 0,
      is16bit: false
    }
    setFixture({ ...fixture, channels: newChannels })
  }

  const handleChannelNameChange = (slotIndex: number, name: string) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = { ...newChannels[slotIndex], name }
    setFixture({ ...fixture, channels: newChannels })
  }

  const handleChannelValueChange = (slotIndex: number, value: number) => {
    const newChannels = [...fixture.channels]
    newChannels[slotIndex] = { ...newChannels[slotIndex], defaultValue: value }
    setFixture({ ...fixture, channels: newChannels })
  }

  const handleSave = () => {
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown' && ch.name.trim().length > 0)
    const fixtureToSave = { ...fixture, channels: activeChannels }
    
    if (FixtureFactory.validate(fixtureToSave)) {
      onSave(fixtureToSave)
    }
  }

  const isValid = () => {
    const activeChannels = fixture.channels.filter(ch => ch.type !== 'unknown' && ch.name.trim().length > 0)
    return fixture.name.trim().length > 0 && 
           fixture.manufacturer.trim().length > 0 && 
           activeChannels.length > 0
  }

  return (
    <div className="fixture-forge-overlay" onClick={onClose}>
      <div className="fixture-forge-modal" onClick={(e) => e.stopPropagation()}>
        <header className="forge-header">
          <h1 className="forge-title">⚡ VISUAL FIXTURE FORGE</h1>
          <p className="forge-subtitle">Drag & Drop DMX Channel Builder</p>
          
          <div className="forge-basic-info">
            <div className="forge-input-group">
              <label>Manufacturer</label>
              <input
                type="text"
                placeholder="e.g. Chauvet, ADJ, Elation"
                value={fixture.manufacturer}
                onChange={(e) => setFixture({ ...fixture, manufacturer: e.target.value })}
              />
            </div>
            
            <div className="forge-input-group">
              <label>Model Name</label>
              <input
                type="text"
                placeholder="e.g. Rogue R2 Spot"
                value={fixture.name}
                onChange={(e) => setFixture({ ...fixture, name: e.target.value })}
              />
            </div>
            
            <div className="forge-input-group">
              <label>Total Channels</label>
              <input
                type="number"
                min="1"
                max="64"
                value={totalChannels}
                onChange={(e) => setTotalChannels(Math.max(1, Math.min(64, parseInt(e.target.value) || 1)))}
              />
            </div>
            
            <div className="forge-input-group">
              <label>Fixture Type</label>
              <select value={fixture.type} onChange={(e) => setFixture({ ...fixture, type: e.target.value })}>
                {FIXTURE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <main className="forge-body">
          <section className="forge-rack">
            <h3 className="rack-title">🎛️ THE RACK</h3>
            <div className="rack-slots">
              {fixture.channels.map((channel, index) => {
                const isEmpty = channel.type === 'unknown' || !channel.name
                const color = isEmpty ? '#333' : FixtureFactory.getChannelColor(channel.type)
                
                return (
                  <div
                    key={index}
                    className={`rack-slot ${isEmpty ? 'empty' : 'filled'} ${dragOverSlot === index ? 'drag-over' : ''}`}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    <div className="slot-number">CH {channel.index}</div>
                    
                    {isEmpty ? (
                      <div className="slot-placeholder">Drop Function Here</div>
                    ) : (
                      <div className="slot-content">
                        <div 
                          className="slot-pill" 
                          style={{ 
                            backgroundColor: color,
                            boxShadow: `0 0 10px ${color}40`
                          }}
                        >
                          <span className="pill-type">{channel.type.toUpperCase()}</span>
                        </div>
                        
                        <input
                          type="text"
                          className="slot-name-input"
                          value={channel.name}
                          onChange={(e) => handleChannelNameChange(index, e.target.value)}
                          placeholder="Channel name"
                        />
                        
                        <div className="slot-controls">
                          <label>Default:</label>
                          <input
                            type="number"
                            min="0"
                            max="255"
                            value={channel.defaultValue}
                            onChange={(e) => handleChannelValueChange(index, parseInt(e.target.value) || 0)}
                            className="slot-value-input"
                          />
                          
                          <button
                            className="slot-clear-btn"
                            onClick={() => handleClearSlot(index)}
                            title="Clear slot"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="forge-foundry">
            <h3 className="foundry-title">🏭 THE FOUNDRY</h3>
            <div className="foundry-categories">
              {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
                <div key={category} className="foundry-category">
                  <h4 className="category-title">{category}</h4>
                  <div className="category-functions">
                    {functions.map((func) => (
                      <div
                        key={func.type}
                        className="function-block"
                        draggable
                        onDragStart={() => handleDragStart(func.type)}
                        onDragEnd={handleDragEnd}
                        style={{
                          backgroundColor: func.color,
                          boxShadow: `0 0 15px ${func.color}60`,
                          border: `1px solid ${func.color}`
                        }}
                      >
                        <span className="function-icon">{func.icon}</span>
                        <span className="function-label">{func.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="forge-footer">
          <button className="forge-btn-cancel" onClick={onClose}>
            CANCEL
          </button>
          <button 
            className="forge-btn-save" 
            onClick={handleSave} 
            disabled={!isValid()}
          >
            💾 SAVE FIXTURE
          </button>
        </footer>
      </div>
    </div>
  )
}
```

---

## 🎨 CÓDIGO CSS COMPLETO

Copia todo el contenido del siguiente apartado en:  
`electron-app/src/components/modals/FixtureEditor/FixtureEditor.css`

```css
/* ⚡ VISUAL FIXTURE FORGE - Cyberpunk Drag & Drop Styles */

:root {
  --neon-cyan: #00f3ff;
  --neon-purple: #bb00ff;
  --neon-magenta: #ff00ff;
  --bg-dark: #0a0a0f;
  --bg-darker: #05050a;
  --glass: rgba(255, 255, 255, 0.05);
  --glass-hover: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(0, 243, 255, 0.2);
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
}

/* ═══════════════ OVERLAY & MODAL ═══════════════ */

.fixture-forge-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fixture-forge-modal {
  background: var(--bg-dark);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  width: 95%;
  max-width: 1400px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 0 60px rgba(0, 243, 255, 0.4), 0 0 100px rgba(0, 243, 255, 0.2);
  animation: slideUp 0.3s ease-out;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* ═══════════════ HEADER ═══════════════ */

.forge-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--border-subtle);
  background: linear-gradient(135deg, rgba(0, 243, 255, 0.1) 0%, rgba(187, 0, 255, 0.05) 100%);
}

.forge-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--neon-cyan);
  margin: 0 0 4px 0;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 0 20px rgba(0, 243, 255, 0.6);
}

.forge-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 20px 0;
  letter-spacing: 1px;
}

.forge-basic-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.forge-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.forge-input-group label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  font-weight: 600;
}

.forge-input-group input,
.forge-input-group select {
  background: var(--glass);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  padding: 10px 12px;
  outline: none;
  transition: all 0.3s ease;
  font-family: 'Segoe UI', sans-serif;
}

.forge-input-group input:focus,
.forge-input-group select:focus {
  border-color: var(--neon-cyan);
  background: rgba(0, 243, 255, 0.05);
  box-shadow: 0 0 12px rgba(0, 243, 255, 0.2);
}

.forge-input-group input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* ═══════════════ BODY - GRID 2 COLUMNAS ═══════════════ */

.forge-body {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 0;
  flex: 1;
  overflow: hidden;
}

/* ═══════════════ LEFT: THE RACK ═══════════════ */

.forge-rack {
  padding: 24px;
  overflow-y: auto;
  background: var(--bg-darker);
  border-right: 1px solid var(--border-subtle);
}

.rack-title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-secondary);
  margin: 0 0 16px 0;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rack-title::before {
  content: '';
  width: 4px;
  height: 18px;
  background: var(--neon-cyan);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--neon-cyan);
}

.rack-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rack-slot {
  background: var(--glass);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  min-height: 80px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s ease;
  position: relative;
}

.rack-slot.empty {
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.15);
}

.rack-slot.drag-over {
  border-color: var(--neon-cyan);
  background: rgba(0, 243, 255, 0.1);
  box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
  transform: scale(1.02);
}

.slot-number {
  background: rgba(0, 243, 255, 0.15);
  border: 1px solid var(--neon-cyan);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--neon-cyan);
  text-shadow: 0 0 8px rgba(0, 243, 255, 0.5);
  min-width: 50px;
  text-align: center;
}

.slot-placeholder {
  flex: 1;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
  font-style: italic;
  letter-spacing: 0.5px;
}

.slot-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.slot-pill {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #000;
  white-space: nowrap;
  text-shadow: none;
}

.pill-type {
  text-shadow: none;
}

.slot-name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
  font-size: 14px;
  padding: 6px 8px;
  outline: none;
  transition: all 0.2s ease;
}

.slot-name-input:focus {
  border-bottom-color: var(--neon-cyan);
}

.slot-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slot-controls label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slot-value-input {
  width: 60px;
  background: var(--glass);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 4px 8px;
  text-align: center;
  outline: none;
}

.slot-value-input:focus {
  border-color: var(--neon-cyan);
}

.slot-clear-btn {
  background: transparent;
  border: 1px solid rgba(255, 51, 102, 0.3);
  color: #ff3366;
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.slot-clear-btn:hover {
  background: #ff3366;
  color: #000;
  transform: scale(1.1);
}

/* ═══════════════ RIGHT: THE FOUNDRY ═══════════════ */

.forge-foundry {
  padding: 24px;
  overflow-y: auto;
  background: var(--bg-dark);
}

.foundry-title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-secondary);
  margin: 0 0 20px 0;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.foundry-title::before {
  content: '';
  width: 4px;
  height: 18px;
  background: var(--neon-purple);
  border-radius: 2px;
  box-shadow: 0 0 8px var(--neon-purple);
}

.foundry-categories {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.foundry-category {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  font-weight: 600;
}

.category-functions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.function-block {
  padding: 10px 16px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #000;
  cursor: grab;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.function-block:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.function-block:hover {
  transform: scale(1.05);
}

.function-icon {
  font-size: 14px;
}

.function-label {
  font-weight: 700;
  text-shadow: none;
}

/* ═══════════════ FOOTER ═══════════════ */

.forge-footer {
  padding: 20px 32px;
  border-top: 1px solid var(--border-subtle);
  background: var(--glass);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.forge-btn-cancel,
.forge-btn-save {
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  outline: none;
}

.forge-btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--text-secondary);
}

.forge-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
}

.forge-btn-save {
  background: var(--neon-cyan);
  color: #000;
  box-shadow: 0 0 20px rgba(0, 243, 255, 0.4);
}

.forge-btn-save:hover:not(:disabled) {
  box-shadow: 0 0 30px rgba(0, 243, 255, 0.6);
  transform: translateY(-2px);
}

.forge-btn-save:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
  cursor: not-allowed;
  box-shadow: none;
}

/* ═══════════════ SCROLLBARS ═══════════════ */

.forge-rack::-webkit-scrollbar,
.forge-foundry::-webkit-scrollbar {
  width: 8px;
}

.forge-rack::-webkit-scrollbar-track,
.forge-foundry::-webkit-scrollbar-track {
  background: var(--bg-darker);
}

.forge-rack::-webkit-scrollbar-thumb,
.forge-foundry::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 4px;
}

.forge-rack::-webkit-scrollbar-thumb:hover,
.forge-foundry::-webkit-scrollbar-thumb:hover {
  background: var(--neon-cyan);
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Copiar código TSX en `FixtureEditorModal.tsx`
- [ ] Copiar código CSS en `FixtureEditor.css`
- [ ] Verificar que compila sin errores
- [ ] Probar Drag & Drop en el navegador
- [ ] Integrar en PatchTab (siguiente paso)

---

**¡Ahora tienes el código completo listo para ser copiado!** 🎨✨
