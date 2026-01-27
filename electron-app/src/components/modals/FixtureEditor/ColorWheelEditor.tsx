/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 COLOR WHEEL EDITOR - WAVE 1006: THE WHEELSMITH
 * "El Herrero de las Ruedas de Color"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Editor de ruedas de color para fixtures con gobo mecánico.
 * Permite mapear los valores DMX a colores específicos para que HAL
 * pueda traducir comandos semánticos (Selene pide "Rojo") a DMX.
 * 
 * FEATURES:
 * - Añadir/eliminar slots de color
 * - Color picker visual + nombre legible
 * - Valor DMX editable por slot
 * - Preview de la rueda completa
 * - Persistencia bidireccional (guarda Y carga correctamente)
 * 
 * @module components/modals/FixtureEditor/ColorWheelEditor
 * @version WAVE 1006.0
 */

import React, { useState, useCallback, useEffect } from 'react'
import { 
  X, 
  Plus, 
  Trash2, 
  Palette,
  Save,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Eye,      // 🎛️ WAVE 1006.5: Auto-jump preview
  Zap       // 🎛️ WAVE 1006.5: Live probe icon
} from 'lucide-react'
import './ColorWheelEditor.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (Compatible with HAL's WheelColor from FixtureProfiles.ts)
// ═══════════════════════════════════════════════════════════════════════════

export interface WheelColor {
  /** Valor DMX para seleccionar este color (0-255) */
  dmx: number
  /** Nombre legible del color */
  name: string
  /** Aproximación RGB para cálculos de distancia */
  rgb: { r: number; g: number; b: number }
  /** Si el color incluye gobo o textura */
  hasTexture?: boolean
}

export interface ColorWheelEditorProps {
  /** Is the modal open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Save handler - returns the array of wheel colors */
  onSave: (colors: WheelColor[]) => void
  /** Existing colors to edit (for load/edit flow) */
  existingColors?: WheelColor[]
  /** Channel name for display */
  channelName?: string
  /** 🎛️ WAVE 1006.5: THE LIVE PROBE - Send DMX value for testing */
  onTestDmx?: (value: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Common colors preset for quick add */
const COLOR_PRESETS: { name: string; rgb: { r: number; g: number; b: number } }[] = [
  { name: 'Blanco', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'Rojo', rgb: { r: 255, g: 0, b: 0 } },
  { name: 'Naranja', rgb: { r: 255, g: 128, b: 0 } },
  { name: 'Amarillo', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'Verde', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
  { name: 'Azul', rgb: { r: 0, g: 0, b: 255 } },
  { name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
  { name: 'UV', rgb: { r: 170, g: 0, b: 255 } },  // 🎛️ WAVE 1006.5: UV added
  { name: 'Rosa', rgb: { r: 255, g: 105, b: 180 } },
  { name: 'Lavanda', rgb: { r: 230, g: 190, b: 255 } },
  { name: 'CTO (Warm)', rgb: { r: 255, g: 200, b: 150 } },
  { name: 'CTB (Cool)', rgb: { r: 200, g: 220, b: 255 } },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Convert RGB to hex string */
function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return '#' + [rgb.r, rgb.g, rgb.b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')
}

/** Convert hex string to RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 }
}

/** Generate next DMX value suggestion based on existing colors */
function suggestNextDmx(colors: WheelColor[]): number {
  if (colors.length === 0) return 0
  const maxDmx = Math.max(...colors.map(c => c.dmx))
  // Suggest next slot ~15 DMX apart (common wheel slot spacing)
  return Math.min(255, maxDmx + 15)
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ColorWheelEditor: React.FC<ColorWheelEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  existingColors,
  channelName,
  onTestDmx  // 🎛️ WAVE 1006.5: THE LIVE PROBE
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [colors, setColors] = useState<WheelColor[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  
  // 🎛️ WAVE 1006.5: THE LIVE PROBE - DMX test value
  const [probeValue, setProbeValue] = useState<number>(0)
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🔥 WAVE 1006: Load existing colors when modal opens
  useEffect(() => {
    if (isOpen) {
      if (existingColors && existingColors.length > 0) {
        // Deep clone to avoid mutation
        console.log('[ColorWheelEditor] 📥 Loading existing colors:', existingColors.length)
        setColors(existingColors.map(c => ({ ...c, rgb: { ...c.rgb } })))
      } else {
        // Start with empty array - user adds colors manually
        console.log('[ColorWheelEditor] 🆕 Starting fresh (no existing colors)')
        setColors([])
      }
      setHasUnsavedChanges(false)
      setValidationError(null)
    }
  }, [isOpen, existingColors])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Add a new color slot */
  const handleAddColor = useCallback(() => {
    const nextDmx = suggestNextDmx(colors)
    const newColor: WheelColor = {
      dmx: nextDmx,
      name: `Color ${colors.length + 1}`,
      rgb: { r: 255, g: 255, b: 255 }
    }
    setColors(prev => [...prev, newColor])
    setHasUnsavedChanges(true)
    console.log('[ColorWheelEditor] ➕ Added color slot at DMX:', nextDmx)
  }, [colors])
  
  /** Add from preset */
  const handleAddPreset = useCallback((preset: typeof COLOR_PRESETS[0]) => {
    const nextDmx = suggestNextDmx(colors)
    const newColor: WheelColor = {
      dmx: nextDmx,
      name: preset.name,
      rgb: { ...preset.rgb }
    }
    setColors(prev => [...prev, newColor])
    setHasUnsavedChanges(true)
    console.log('[ColorWheelEditor] ➕ Added preset:', preset.name, 'at DMX:', nextDmx)
  }, [colors])
  
  /** Remove a color slot */
  const handleRemoveColor = useCallback((index: number) => {
    setColors(prev => prev.filter((_, i) => i !== index))
    setHasUnsavedChanges(true)
    console.log('[ColorWheelEditor] ➖ Removed color at index:', index)
  }, [])
  
  /** Update a color's DMX value */
  const handleDmxChange = useCallback((index: number, dmx: number) => {
    const clampedDmx = Math.max(0, Math.min(255, dmx))
    setColors(prev => prev.map((c, i) => 
      i === index ? { ...c, dmx: clampedDmx } : c
    ))
    setHasUnsavedChanges(true)
  }, [])
  
  /** Update a color's name */
  const handleNameChange = useCallback((index: number, name: string) => {
    setColors(prev => prev.map((c, i) => 
      i === index ? { ...c, name } : c
    ))
    setHasUnsavedChanges(true)
  }, [])
  
  /** Update a color's RGB via color picker */
  const handleColorChange = useCallback((index: number, hex: string) => {
    const rgb = hexToRgb(hex)
    setColors(prev => prev.map((c, i) => 
      i === index ? { ...c, rgb } : c
    ))
    setHasUnsavedChanges(true)
  }, [])
  
  /** Toggle hasTexture flag */
  const handleTextureToggle = useCallback((index: number) => {
    setColors(prev => prev.map((c, i) => 
      i === index ? { ...c, hasTexture: !c.hasTexture } : c
    ))
    setHasUnsavedChanges(true)
  }, [])
  
  /** Move color up in list */
  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    setColors(prev => {
      const newColors = [...prev]
      ;[newColors[index - 1], newColors[index]] = [newColors[index], newColors[index - 1]]
      return newColors
    })
    setHasUnsavedChanges(true)
  }, [])
  
  /** Move color down in list */
  const handleMoveDown = useCallback((index: number) => {
    if (index === colors.length - 1) return
    setColors(prev => {
      const newColors = [...prev]
      ;[newColors[index], newColors[index + 1]] = [newColors[index + 1], newColors[index]]
      return newColors
    })
    setHasUnsavedChanges(true)
  }, [colors.length])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎛️ WAVE 1006.5: THE LIVE PROBE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Update probe value and send DMX */
  const handleProbeChange = useCallback((value: number) => {
    const clampedValue = Math.max(0, Math.min(255, value))
    setProbeValue(clampedValue)
    if (onTestDmx) {
      onTestDmx(clampedValue)
      console.log('[ColorWheelEditor] 🎛️ LIVE PROBE →', clampedValue)
    }
  }, [onTestDmx])
  
  /** Auto-Jump: Jump probe to an existing slot's DMX value */
  const handleAutoJump = useCallback((dmxValue: number) => {
    setProbeValue(dmxValue)
    if (onTestDmx) {
      onTestDmx(dmxValue)
      console.log('[ColorWheelEditor] 👁️ AUTO-JUMP →', dmxValue)
    }
  }, [onTestDmx])
  
  /** Quick create slot from current probe value */
  const handleCreateFromProbe = useCallback(() => {
    const newColor: WheelColor = {
      dmx: probeValue,
      name: `Color @ ${probeValue}`,
      rgb: { r: 255, g: 255, b: 255 }  // User can pick color after
    }
    setColors(prev => [...prev, newColor])
    setHasUnsavedChanges(true)
    console.log('[ColorWheelEditor] ⚡ Created slot from probe:', probeValue)
  }, [probeValue])
  
  /** Validate before save */
  const validate = useCallback((): boolean => {
    // Check for duplicate DMX values
    const dmxValues = colors.map(c => c.dmx)
    const duplicates = dmxValues.filter((v, i) => dmxValues.indexOf(v) !== i)
    if (duplicates.length > 0) {
      setValidationError(`Valores DMX duplicados: ${[...new Set(duplicates)].join(', ')}`)
      return false
    }
    
    // Check for empty names
    const emptyNames = colors.filter(c => !c.name.trim())
    if (emptyNames.length > 0) {
      setValidationError('Todos los colores deben tener nombre')
      return false
    }
    
    setValidationError(null)
    return true
  }, [colors])
  
  /** Save and close */
  const handleSave = useCallback(() => {
    if (!validate()) return
    
    // Sort by DMX value before saving
    const sortedColors = [...colors].sort((a, b) => a.dmx - b.dmx)
    console.log('[ColorWheelEditor] 💾 Saving wheel colors:', sortedColors.length)
    onSave(sortedColors)
    onClose()
  }, [colors, validate, onSave, onClose])
  
  /** Reset to existing colors */
  const handleReset = useCallback(() => {
    if (existingColors && existingColors.length > 0) {
      setColors(existingColors.map(c => ({ ...c, rgb: { ...c.rgb } })))
    } else {
      setColors([])
    }
    setHasUnsavedChanges(false)
    setValidationError(null)
    console.log('[ColorWheelEditor] 🔄 Reset to original state')
  }, [existingColors])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  if (!isOpen) return null
  
  return (
    <div className="wheel-editor-overlay">
      <div className="wheel-editor-modal">
        
        {/* Header */}
        <header className="wheel-editor-header">
          <div className="wheel-editor-title">
            <Palette size={20} />
            <h2>Color Wheel Editor</h2>
            {channelName && <span className="channel-badge">{channelName}</span>}
          </div>
          <button className="wheel-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        
        {/* Presets Bar */}
        <div className="wheel-presets-bar">
          <span className="presets-label">Añadir rápido:</span>
          <div className="presets-list">
            {COLOR_PRESETS.map((preset, i) => (
              <button
                key={i}
                className="preset-btn"
                onClick={() => handleAddPreset(preset)}
                title={preset.name}
                style={{ 
                  backgroundColor: rgbToHex(preset.rgb),
                  color: (preset.rgb.r + preset.rgb.g + preset.rgb.b) / 3 > 128 ? '#000' : '#fff'
                }}
              >
                {preset.name.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Body - Color List */}
        <main className="wheel-editor-body">
          {colors.length === 0 ? (
            <div className="wheel-empty-state">
              <Palette size={48} strokeWidth={1} />
              <p>No hay colores definidos</p>
              <p className="hint">Usa los presets de arriba o añade colores manualmente</p>
            </div>
          ) : (
            <div className="wheel-colors-list">
              {colors.map((color, index) => (
                <div key={index} className="wheel-color-row">
                  
                  {/* Reorder buttons */}
                  <div className="color-reorder">
                    <button 
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Mover arriba"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button 
                      onClick={() => handleMoveDown(index)}
                      disabled={index === colors.length - 1}
                      title="Mover abajo"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  
                  {/* DMX Value */}
                  <div className="color-dmx">
                    <label>DMX</label>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={color.dmx}
                      onChange={(e) => handleDmxChange(index, parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  {/* Color Picker */}
                  <div className="color-picker-cell">
                    <input
                      type="color"
                      value={rgbToHex(color.rgb)}
                      onChange={(e) => handleColorChange(index, e.target.value)}
                      title="Seleccionar color"
                    />
                    <div 
                      className="color-preview"
                      style={{ backgroundColor: rgbToHex(color.rgb) }}
                    />
                  </div>
                  
                  {/* Name */}
                  <div className="color-name">
                    <input
                      type="text"
                      placeholder="Nombre del color..."
                      value={color.name}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                    />
                  </div>
                  
                  {/* Texture toggle */}
                  <label className="color-texture">
                    <input
                      type="checkbox"
                      checked={color.hasTexture || false}
                      onChange={() => handleTextureToggle(index)}
                    />
                    <span title="¿Tiene gobo/textura?">🕸️</span>
                  </label>
                  
                  {/* 🎛️ WAVE 1006.5: Auto-Jump Preview button */}
                  {onTestDmx && (
                    <button 
                      className="color-preview-btn"
                      onClick={() => handleAutoJump(color.dmx)}
                      title={`Ver en vivo (DMX ${color.dmx})`}
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  
                  {/* Delete */}
                  <button 
                    className="color-delete"
                    onClick={() => handleRemoveColor(index)}
                    title="Eliminar color"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Add button */}
          <button className="wheel-add-btn" onClick={handleAddColor}>
            <Plus size={16} />
            Añadir Color Manual
          </button>
        </main>
        
        {/* Validation Error */}
        {validationError && (
          <div className="wheel-validation-error">
            <AlertCircle size={16} />
            {validationError}
          </div>
        )}
        
        {/* 🎛️ WAVE 1006.5: THE LIVE PROBE - Test Area */}
        {onTestDmx && (
          <div className="wheel-live-probe">
            <div className="probe-header">
              <Zap size={16} />
              <span className="probe-title">LIVE PROBE</span>
              <span className="probe-subtitle">(CH Output)</span>
            </div>
            <div className="probe-controls">
              <input
                type="range"
                min={0}
                max={255}
                value={probeValue}
                onChange={(e) => handleProbeChange(parseInt(e.target.value))}
                className="probe-slider"
              />
              <input
                type="number"
                min={0}
                max={255}
                value={probeValue}
                onChange={(e) => handleProbeChange(parseInt(e.target.value) || 0)}
                className="probe-input"
              />
              <button 
                className="probe-add-btn"
                onClick={handleCreateFromProbe}
                title="Crear slot con este valor"
              >
                <Plus size={14} />
                Crear Slot
              </button>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <footer className="wheel-editor-footer">
          <div className="wheel-stats">
            {colors.length} color{colors.length !== 1 ? 'es' : ''} definido{colors.length !== 1 ? 's' : ''}
            {hasUnsavedChanges && <span className="unsaved-badge">• Sin guardar</span>}
          </div>
          <div className="wheel-actions">
            <button className="wheel-btn secondary" onClick={handleReset} disabled={!hasUnsavedChanges}>
              <RotateCcw size={14} />
              Resetear
            </button>
            <button className="wheel-btn primary" onClick={handleSave}>
              <Save size={14} />
              Guardar Rueda
            </button>
          </div>
        </footer>
        
      </div>
    </div>
  )
}

export default ColorWheelEditor
