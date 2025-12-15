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

import React, { useState, useMemo } from 'react'
import './AddFixtureModal.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
  confidence?: number
  hasMovementChannels?: boolean
  hasColorMixing?: boolean
}

interface AddFixtureModalProps {
  library: LibraryItem[]
  nextAddress: number
  onAdd: (modelId: string, quantity: number, startAddress: number) => void
  onClose: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get fixture type icon
 */
const getTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'moving_head': '🎯',
    'par': '💡',
    'wash': '🌊',
    'strobe': '⚡',
    'laser': '🔴',
    'generic': '○',
  }
  return icons[type] || '○'
}

/**
 * Format type for display
 */
const formatType = (type: string): string => {
  const names: Record<string, string> = {
    'moving_head': 'Moving Head',
    'par': 'PAR',
    'wash': 'Wash',
    'strobe': 'Strobe',
    'laser': 'Laser',
    'generic': 'Generic',
  }
  return names[type] || type
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AddFixtureModal: React.FC<AddFixtureModalProps> = ({
  library,
  nextAddress,
  onAdd,
  onClose,
}) => {
  // State
  const [selectedId, setSelectedId] = useState<string>(library[0]?.id || '')
  const [quantity, setQuantity] = useState<number>(1)
  const [startAddress, setStartAddress] = useState<number>(nextAddress)
  const [useAutoAddress, setUseAutoAddress] = useState(true)

  // Selected model
  const selectedModel = useMemo(() => 
    library.find(f => f.id === selectedId),
    [library, selectedId]
  )

  // Calculate end address
  const endAddress = useMemo(() => {
    if (!selectedModel) return startAddress
    return startAddress + (selectedModel.channelCount * quantity) - 1
  }, [selectedModel, startAddress, quantity])

  // Check if address is valid
  const isAddressValid = endAddress <= 512

  // Group library by type for better UX
  const groupedLibrary = useMemo(() => {
    const groups: Record<string, LibraryItem[]> = {}
    for (const item of library) {
      const type = item.type || 'generic'
      if (!groups[type]) groups[type] = []
      groups[type].push(item)
    }
    return groups
  }, [library])

  // Handlers
  const handleQuantityChange = (value: number) => {
    setQuantity(Math.max(1, Math.min(32, value))) // Max 32 fixtures at once
  }

  const handleStartAddressChange = (value: number) => {
    setUseAutoAddress(false)
    setStartAddress(Math.max(1, Math.min(512, value)))
  }

  const handleModelChange = (id: string) => {
    setSelectedId(id)
    if (useAutoAddress) {
      setStartAddress(nextAddress)
    }
  }

  const handleAdd = () => {
    if (selectedModel && isAddressValid) {
      onAdd(selectedId, quantity, startAddress)
    }
  }

  // Reset to auto address
  const handleResetAddress = () => {
    setUseAutoAddress(true)
    setStartAddress(nextAddress)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-fixture-modal" onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div className="modal-header">
          <h2>➕ Add Fixtures</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* CONTENT */}
        <div className="modal-content">
          {library.length === 0 ? (
            <div className="modal-empty">
              <span className="empty-icon">📂</span>
              <p>No fixtures found in library</p>
              <p className="empty-hint">
                Add .fxt files to the /librerias folder
              </p>
            </div>
          ) : (
            <>
              {/* MODEL SELECTOR */}
              <div className="form-group">
                <label>Model</label>
                <select 
                  className="model-select"
                  value={selectedId}
                  onChange={e => handleModelChange(e.target.value)}
                >
                  {Object.entries(groupedLibrary).map(([type, items]) => (
                    <optgroup key={type} label={formatType(type)}>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>
                          {getTypeIcon(item.type)} {item.name} ({item.channelCount}ch)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* SELECTED MODEL INFO */}
              {selectedModel && (
                <div className="model-info">
                  <div className="model-info-row">
                    <span className="model-icon">{getTypeIcon(selectedModel.type)}</span>
                    <span className="model-name">{selectedModel.name}</span>
                  </div>
                  <div className="model-stats">
                    <span className="stat">
                      <strong>{selectedModel.channelCount}</strong> channels
                    </span>
                    <span className="stat">
                      <strong>{formatType(selectedModel.type)}</strong>
                    </span>
                    {selectedModel.confidence && (
                      <span className="stat confidence">
                        {Math.round(selectedModel.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <div className="model-features">
                    {selectedModel.hasMovementChannels && (
                      <span className="feature">🎯 Movement</span>
                    )}
                    {selectedModel.hasColorMixing && (
                      <span className="feature">🌈 RGB</span>
                    )}
                  </div>
                </div>
              )}

              {/* QUANTITY */}
              <div className="form-group">
                <label>Quantity</label>
                <div className="quantity-input">
                  <button 
                    className="qty-btn"
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => handleQuantityChange(parseInt(e.target.value) || 1)}
                    min={1}
                    max={32}
                  />
                  <button 
                    className="qty-btn"
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= 32}
                  >
                    +
                  </button>
                </div>
                <span className="form-hint">Batch patch multiple fixtures at once</span>
              </div>

              {/* START ADDRESS */}
              <div className="form-group">
                <label>
                  Start Address
                  {useAutoAddress && <span className="auto-badge">AUTO</span>}
                </label>
                <div className="address-input">
                  <input
                    type="number"
                    value={startAddress}
                    onChange={e => handleStartAddressChange(parseInt(e.target.value) || 1)}
                    min={1}
                    max={512}
                    className={!isAddressValid ? 'invalid' : ''}
                  />
                  {!useAutoAddress && (
                    <button 
                      className="reset-btn"
                      onClick={handleResetAddress}
                      title="Reset to auto"
                    >
                      ↻
                    </button>
                  )}
                </div>
                <span className="form-hint">
                  Next available address: {nextAddress}
                </span>
              </div>

              {/* ADDRESS PREVIEW */}
              <div className={`address-preview ${!isAddressValid ? 'invalid' : ''}`}>
                <div className="preview-label">DMX Range:</div>
                <div className="preview-range">
                  <span className="preview-start">{startAddress.toString().padStart(3, '0')}</span>
                  <span className="preview-arrow">→</span>
                  <span className="preview-end">{endAddress.toString().padStart(3, '0')}</span>
                </div>
                {!isAddressValid && (
                  <div className="preview-error">
                    ⚠️ Exceeds universe limit (512)
                  </div>
                )}
                {quantity > 1 && selectedModel && (
                  <div className="preview-breakdown">
                    {quantity} × {selectedModel.channelCount}ch = {quantity * selectedModel.channelCount} channels
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-add"
            onClick={handleAdd}
            disabled={!selectedModel || !isAddressValid || library.length === 0}
          >
            Add {quantity > 1 ? `${quantity} Fixtures` : 'Fixture'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddFixtureModal
