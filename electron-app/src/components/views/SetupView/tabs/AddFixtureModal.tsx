/**
 * ➕ ADD FIXTURE MODAL - Library Scanner & Batch Patch
 * WAVE 26 Phase 3
 * 
 * Features:
 * - Model dropdown populated from /librerias/*.fxt
 * - Quantity input for batch patching
 * - Auto-calculated start address
 * - Preview of channel usage
 */

import React, { useState, useEffect } from 'react'
import { X, ArrowUp, ArrowDown, Move, RefreshCw, Settings } from 'lucide-react'
import './AddFixtureModal.css'

export interface LibraryItem {
  id: string
  name: string
  manufacturer: string
  type: string
  channelCount: number
  modes: any[]
}

interface FixturePatchConfig {
  orientation: 'ceiling' | 'floor' | 'truss_front' | 'truss_back'
  invertPan: boolean
  invertTilt: boolean
  swapXY: boolean
}

interface AddFixtureModalProps {
  library: LibraryItem[]
  nextAddress: number
  onAdd: (modelId: string, quantity: number, startAddress: number, config: FixturePatchConfig) => void
  onClose: () => void
}

export const AddFixtureModal: React.FC<AddFixtureModalProps> = ({ library, nextAddress, onAdd, onClose }) => {
  // Estado Básico
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [address, setAddress] = useState(nextAddress)

  // Estado Avanzado (Orientación y Física)
  const [config, setConfig] = useState<FixturePatchConfig>({
    orientation: 'ceiling', // Default standard
    invertPan: false,
    invertTilt: false,
    swapXY: false
  })

  // Auto-seleccionar el primero si hay librería
  useEffect(() => {
    if (library.length > 0 && !selectedModel) {
      setSelectedModel(library[0].id)
    }
  }, [library])

  const handleAdd = () => {
    if (!selectedModel) return
    onAdd(selectedModel, quantity, address, config)
  }

  // Helper para mostrar info del modelo seleccionado
  const getSelectedModelInfo = () => library.find(f => f.id === selectedModel)

  return (
    <div className="modal-overlay">
      <div className="modal-content add-fixture-window" style={{ maxWidth: '600px' }}>
        
        {/* HEADER */}
        <div className="modal-header">
          <h3>➕ Add Fixtures</h3>
          <button className="close-btn" onClick={onClose}><X /></button>
        </div>

        {/* BODY */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SELECCIÓN DE MODELO */}
          <div className="form-group">
            <label>Select Model</label>
            <select 
              className="cyber-select" 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
            >
              {library.map(fix => (
                <option key={fix.id} value={fix.id}>
                  {fix.manufacturer} - {fix.name} ({fix.channelCount}ch)
                </option>
              ))}
            </select>
          </div>

          {/* CANTIDAD Y DIRECCIÓN (Dos columnas) */}
          <div className="form-row" style={{ display: 'flex', gap: '20px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Quantity</label>
              <div className="number-control">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} 
                />
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Start Address <span className="badge-auto">Auto: {nextAddress}</span></label>
              <input 
                type="number" 
                className="cyber-input" 
                value={address} 
                onChange={(e) => setAddress(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* --- CONFIGURACIÓN FÍSICA PRO --- */}
          <div className="physics-section" style={{ 
            background: 'rgba(0,0,0,0.3)', 
            padding: '15px', 
            borderRadius: '8px',
            border: '1px solid #333'
          }}>
            <div className="section-title" style={{ color: '#00f3ff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={16} /> PHYSICAL INSTALLATION
            </div>

            {/* ORIENTATION */}
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', color: '#888' }}>Orientation</label>
              <div className="orientation-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '5px' }}>
                <OrientationBtn 
                  label="Ceiling (Down)" 
                  active={config.orientation === 'ceiling'} 
                  onClick={() => setConfig({...config, orientation: 'ceiling'})}
                  icon={<ArrowDown size={14} />}
                />
                <OrientationBtn 
                  label="Floor (Up)" 
                  active={config.orientation === 'floor'} 
                  onClick={() => setConfig({...config, orientation: 'floor'})}
                  icon={<ArrowUp size={14} />}
                />
                <OrientationBtn 
                  label="Truss (Front)" 
                  active={config.orientation === 'truss_front'} 
                  onClick={() => setConfig({...config, orientation: 'truss_front'})}
                  icon={<Move size={14} />}
                />
                <OrientationBtn 
                  label="Truss (Back)" 
                  active={config.orientation === 'truss_back'} 
                  onClick={() => setConfig({...config, orientation: 'truss_back'})}
                  icon={<RefreshCw size={14} />}
                />
              </div>
            </div>

            {/* SWITCHES */}
            <div className="switches-row" style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
              <ToggleCheckbox 
                label="Invert Pan" 
                checked={config.invertPan} 
                onChange={(v: boolean) => setConfig({...config, invertPan: v})} 
              />
              <ToggleCheckbox 
                label="Invert Tilt" 
                checked={config.invertTilt} 
                onChange={(v: boolean) => setConfig({...config, invertTilt: v})} 
              />
              <ToggleCheckbox 
                label="Swap X/Y" 
                checked={config.swapXY} 
                onChange={(v: boolean) => setConfig({...config, swapXY: v})} 
              />
            </div>
          </div>

          {/* INFO FOOTER */}
          <div className="patch-summary" style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
            Adding {quantity} {getSelectedModelInfo()?.name || 'fixtures'} starting at {address}. 
            Range: {address} → {address + (quantity * (getSelectedModelInfo()?.channelCount || 0)) - 1}
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleAdd}>Confirm Patch</button>
        </div>

      </div>
    </div>
  )
}

// Sub-componentes para UI limpia
const OrientationBtn = ({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    style={{
      background: active ? 'rgba(0, 243, 255, 0.1)' : '#111',
      border: `1px solid ${active ? '#00f3ff' : '#444'}`,
      color: active ? '#fff' : '#888',
      padding: '8px',
      borderRadius: '4px',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      fontSize: '0.85rem',
      transition: 'all 0.2s'
    }}
  >
    {icon} {label}
  </button>
)

const ToggleCheckbox = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#ccc' }}>
    <input 
      type="checkbox" 
      checked={checked} 
      onChange={e => onChange((e.target as HTMLInputElement).checked)}
      style={{ accentColor: '#bf00ff', width: '16px', height: '16px' }} 
    />
    {label}
  </label>
)

export default AddFixtureModal