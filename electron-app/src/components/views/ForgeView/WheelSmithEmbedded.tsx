/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎡 WHEELSMITH EMBEDDED - WAVE 1111: THE WHEELSMITH & THE GLOW
 * "The Color Wheel Craftsman" - Embedded Panel for Forge Tab
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This is the embedded version of ColorWheelEditor, designed to live
 * inside the Forge as a tab (not a modal overlay).
 * 
 * Key differences from modal version:
 * - No overlay/modal wrapper
 * - No close button (tab navigation)
 * - State bridged to parent Forge (onWheelChange callback)
 * - Auto-discovery of color_wheel channel
 * 
 * 🔥 WAVE 2042.19: REAL COLOR - DMX targeting to actual fixture
 * - fixtureId prop para targeting real
 * - channelIndex prop para canal color_wheel específico
 * - sendDirectDMX() portado de TestPanel.tsx
 * - Fallback a Arbiter si no hay lux.sendDmxChannel
 * 
 * @module components/views/ForgeView/WheelSmithEmbedded
 * @version WAVE 2042.19
 */

import React, { useState, useCallback, useEffect } from 'react'
import { 
  Plus, 
  Trash2, 
  Palette,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Eye,
  Zap,
  Server,
  ArrowRight
} from 'lucide-react'
import { useStageStore } from '../../../stores/stageStore'
import './WheelSmithEmbedded.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface WheelColor {
  dmx: number
  name: string
  rgb: { r: number; g: number; b: number }
  hasTexture?: boolean
}

export interface WheelSmithEmbeddedProps {
  /** Current wheel colors from fixture state */
  colors: WheelColor[]
  /** Callback when colors change */
  onColorsChange: (colors: WheelColor[]) => void
  /** Is there a color_wheel channel in the rack? */
  hasColorWheelChannel: boolean
  /** Navigate to Channel Rack tab */
  onNavigateToRack: () => void
  /** Optional: Send DMX value for live testing */
  onTestDmx?: (value: number) => void
  
  // 🔥 WAVE 2042.19: Real DMX targeting
  /** ID del fixture que estamos calibrando (null si solo editamos librería) */
  fixtureId?: string | null
  /** Índice del canal color_wheel en el fixture (0-based) */
  channelIndex?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS - EN-US Localized (WAVE 1111)
// ═══════════════════════════════════════════════════════════════════════════

const COLOR_PRESETS: { name: string; rgb: { r: number; g: number; b: number } }[] = [
  { name: 'White', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
  { name: 'Orange', rgb: { r: 255, g: 128, b: 0 } },
  { name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
  { name: 'Green', rgb: { r: 0, g: 255, b: 0 } },
  { name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
  { name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
  { name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
  { name: 'UV', rgb: { r: 170, g: 0, b: 255 } },
  { name: 'Pink', rgb: { r: 255, g: 105, b: 180 } },
  { name: 'Lavender', rgb: { r: 230, g: 190, b: 255 } },
  { name: 'CTO (Warm)', rgb: { r: 255, g: 200, b: 150 } },
  { name: 'CTB (Cool)', rgb: { r: 200, g: 220, b: 255 } },
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return '#' + [rgb.r, rgb.g, rgb.b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 }
}

function suggestNextDmx(colors: WheelColor[]): number {
  if (colors.length === 0) return 0
  const maxDmx = Math.max(...colors.map(c => c.dmx))
  return Math.min(255, maxDmx + 15)
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const WheelSmithEmbedded: React.FC<WheelSmithEmbeddedProps> = ({
  colors,
  onColorsChange,
  hasColorWheelChannel,
  onNavigateToRack,
  onTestDmx,
  fixtureId,
  channelIndex = 0,
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [validationError, setValidationError] = useState<string | null>(null)
  const [probeValue, setProbeValue] = useState<number>(0)
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 2042.19: REAL DMX TARGETING - Fixture from Store
  // ═══════════════════════════════════════════════════════════════════════
  
  const fixture = useStageStore(state => {
    if (!fixtureId) return null
    const fixtures = state.fixtures || []
    return fixtures.find(f => f.id === fixtureId) || null
  })
  
  const dmxBaseAddress = fixture?.address ?? null
  const universe = fixture?.universe ?? 0
  
  /**
   * 🔥 WAVE 2042.19: DIRECT DMX SEND - Copiado de TestPanel
   * Envía DMX directo al canal correcto del fixture
   */
  const sendDirectDMX = useCallback(async (dmxValue: number) => {
    // Si no hay fixture, solo loguear (modo librería sin fixture real)
    if (!fixtureId || dmxBaseAddress === null) {
      console.log(`[WheelSmith] 📭 No fixture connected - DMX value: ${dmxValue} (not sent)`)
      return
    }
    
    // 🔥 CRITICAL: channelIndex es 0-based, dmxBaseAddress es la dirección inicial del fixture
    const absoluteAddress = dmxBaseAddress + channelIndex
    
    console.log(`[WheelSmith] 🎛️ DMX OUT: Universe ${universe}, ColorWheel CH${channelIndex} → DMX ${absoluteAddress} = ${dmxValue}`)
    
    // Try direct DMX first (window.lux API)
    const lux = window.lux as any
    if (lux?.sendDmxChannel) {
      lux.sendDmxChannel(universe, absoluteAddress, dmxValue)
      return
    }
    if (lux?.dmx?.sendDirect) {
      lux.dmx.sendDirect(universe, absoluteAddress, dmxValue)
      return
    }
    
    // 🔥 FALLBACK: Use Arbiter.setManual for color_wheel type
    if (lux?.arbiter?.setManual) {
      try {
        await lux.arbiter.setManual({
          fixtureIds: [fixtureId],
          controls: { color_wheel: dmxValue },
          channels: ['color_wheel'],
        })
        console.log(`[WheelSmith] 🎯 Arbiter fallback: color_wheel = ${dmxValue}`)
      } catch (err) {
        console.error('[WheelSmith] ❌ Arbiter error:', err)
      }
    } else {
      console.warn('[WheelSmith] ⚠️ No DMX API available (lux.sendDmxChannel or arbiter)')
    }
  }, [fixtureId, dmxBaseAddress, channelIndex, universe])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleAddColor = useCallback(() => {
    const nextDmx = suggestNextDmx(colors)
    const newColor: WheelColor = {
      dmx: nextDmx,
      name: `Color ${colors.length + 1}`,
      rgb: { r: 255, g: 255, b: 255 }
    }
    onColorsChange([...colors, newColor])
    console.log('[WheelSmith] ➕ Added slot at DMX:', nextDmx)
  }, [colors, onColorsChange])
  
  const handleAddPreset = useCallback((preset: typeof COLOR_PRESETS[0]) => {
    const nextDmx = suggestNextDmx(colors)
    const newColor: WheelColor = {
      dmx: nextDmx,
      name: preset.name,
      rgb: { ...preset.rgb }
    }
    onColorsChange([...colors, newColor])
    console.log('[WheelSmith] ➕ Added preset:', preset.name)
  }, [colors, onColorsChange])
  
  const handleRemoveColor = useCallback((index: number) => {
    onColorsChange(colors.filter((_, i) => i !== index))
    console.log('[WheelSmith] ➖ Removed slot:', index)
  }, [colors, onColorsChange])
  
  const handleDmxChange = useCallback((index: number, dmx: number) => {
    const clampedDmx = Math.max(0, Math.min(255, dmx))
    onColorsChange(colors.map((c, i) => 
      i === index ? { ...c, dmx: clampedDmx } : c
    ))
  }, [colors, onColorsChange])
  
  const handleNameChange = useCallback((index: number, name: string) => {
    onColorsChange(colors.map((c, i) => 
      i === index ? { ...c, name } : c
    ))
  }, [colors, onColorsChange])
  
  const handleColorChange = useCallback((index: number, hex: string) => {
    const rgb = hexToRgb(hex)
    onColorsChange(colors.map((c, i) => 
      i === index ? { ...c, rgb } : c
    ))
  }, [colors, onColorsChange])
  
  const handleTextureToggle = useCallback((index: number) => {
    onColorsChange(colors.map((c, i) => 
      i === index ? { ...c, hasTexture: !c.hasTexture } : c
    ))
  }, [colors, onColorsChange])
  
  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    const newColors = [...colors]
    ;[newColors[index - 1], newColors[index]] = [newColors[index], newColors[index - 1]]
    onColorsChange(newColors)
  }, [colors, onColorsChange])
  
  const handleMoveDown = useCallback((index: number) => {
    if (index === colors.length - 1) return
    const newColors = [...colors]
    ;[newColors[index], newColors[index + 1]] = [newColors[index + 1], newColors[index]]
    onColorsChange(newColors)
  }, [colors, onColorsChange])
  
  // Live Probe handlers
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 1113: Live Probe with REAL DMX via IPC
  // ═══════════════════════════════════════════════════════════════════════
  
  const [dmxConnected, setDmxConnected] = useState<boolean>(false)
  
  // Check DMX status on mount and periodically
  useEffect(() => {
    const checkDMXStatus = async () => {
      // WAVE 1116.3: Enhanced DMX status check with logging
      if (typeof window !== 'undefined' && window.lux?.library?.dmxStatus) {
        try {
          const status = await window.lux.library.dmxStatus()
          console.log(`[WheelSmith] 📡 DMX Status: connected=${status.connected}, device=${status.device}`)
          setDmxConnected(status.connected)
        } catch (err) {
          console.error('[WheelSmith] ❌ DMX Status check failed:', err)
          setDmxConnected(false)
        }
      } else {
        console.warn('[WheelSmith] ⚠️ window.lux.library.dmxStatus not available')
        setDmxConnected(false)
      }
    }
    
    checkDMXStatus()
    const interval = setInterval(checkDMXStatus, 5000) // Check every 5s
    return () => clearInterval(interval)
  }, [])
  
  const handleProbeChange = useCallback(async (value: number) => {
    const clampedValue = Math.max(0, Math.min(255, value))
    setProbeValue(clampedValue)
    
    // 🔥 WAVE 2042.19: Use sendDirectDMX (real fixture targeting)
    await sendDirectDMX(clampedValue)
    
    // Also call parent callback if provided
    if (onTestDmx) {
      onTestDmx(clampedValue)
    }
  }, [onTestDmx, sendDirectDMX])
  
  const handleAutoJump = useCallback(async (dmxValue: number) => {
    setProbeValue(dmxValue)
    
    // 🔥 WAVE 2042.19: Use sendDirectDMX (real fixture targeting)
    await sendDirectDMX(dmxValue)
    
    if (onTestDmx) {
      onTestDmx(dmxValue)
    }
  }, [onTestDmx])
  
  const handleCreateFromProbe = useCallback(() => {
    const newColor: WheelColor = {
      dmx: probeValue,
      name: `Color @ ${probeValue}`,
      rgb: { r: 255, g: 255, b: 255 }
    }
    onColorsChange([...colors, newColor])
    console.log('[WheelSmith] ⚡ Created slot from probe:', probeValue)
  }, [probeValue, colors, onColorsChange])
  
  const handleReset = useCallback(() => {
    onColorsChange([])
    setValidationError(null)
    console.log('[WheelSmith] 🔄 Reset to empty')
  }, [onColorsChange])
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER - NO COLOR WHEEL CHANNEL STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  if (!hasColorWheelChannel) {
    return (
      <div className="wheelsmith-no-channel">
        <div className="no-channel-icon">
          <Palette size={64} strokeWidth={1} />
        </div>
        <h3>No Color Wheel Channel Detected</h3>
        <p>Add a <strong>Color Wheel</strong> channel in the Channel Rack first.</p>
        <button className="go-to-rack-btn" onClick={onNavigateToRack}>
          <Server size={16} />
          <span>Go to Channel Rack</span>
          <ArrowRight size={16} />
        </button>
      </div>
    )
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER - MAIN EDITOR
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className="wheelsmith-embedded">
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PRESETS BAR */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="wheel-presets-bar">
        <span className="presets-label">Quick Add:</span>
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
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* COLOR SLOTS LIST */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="wheelsmith-body">
        {colors.length === 0 ? (
          <div className="wheel-empty-state">
            <Palette size={48} strokeWidth={1} />
            <p>No colors defined</p>
            <p className="hint">Use presets above or add colors manually</p>
          </div>
        ) : (
          <div className="wheel-colors-list">
            {/* Header */}
            <div className="wheel-list-header">
              <span className="col-order"></span>
              <span className="col-dmx">DMX</span>
              <span className="col-color">Color</span>
              <span className="col-name">Name</span>
              <span className="col-gobo">Gobo</span>
              <span className="col-actions"></span>
            </div>
            
            {/* Color Rows */}
            {colors.map((color, index) => (
              <div key={index} className="wheel-color-row">
                
                {/* Reorder buttons */}
                <div className="color-reorder">
                  <button 
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button 
                    onClick={() => handleMoveDown(index)}
                    disabled={index === colors.length - 1}
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                
                {/* DMX Value */}
                <div className="color-dmx">
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
                    title="Select color"
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
                    placeholder="Color name..."
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
                  <span title="Has gobo/texture?">🕸️</span>
                </label>
                
                {/* Preview button (if live probe available) */}
                {onTestDmx && (
                  <button 
                    className="color-preview-btn"
                    onClick={() => handleAutoJump(color.dmx)}
                    title={`Preview (DMX ${color.dmx})`}
                  >
                    <Eye size={14} />
                  </button>
                )}
                
                {/* Delete */}
                <button 
                  className="color-delete"
                  onClick={() => handleRemoveColor(index)}
                  title="Remove slot"
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
          Add Slot
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* VALIDATION ERROR */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {validationError && (
        <div className="wheel-validation-error">
          <AlertCircle size={16} />
          {validationError}
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* LIVE PROBE - WAVE 1114: ALWAYS VISIBLE                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="wheel-live-probe">
        <div className="probe-header">
          <Zap size={16} />
          <span className="probe-title">LIVE PROBE</span>
          <span className="probe-subtitle">(Channel Output)</span>
          {/* WAVE 1114: DMX Status Indicator - Always show */}
          <span 
            className={`probe-dmx-status ${dmxConnected ? 'connected' : 'offline'}`}
            title={dmxConnected ? 'DMX Connected' : 'DMX Offline'}
          >
            {dmxConnected ? '🟢' : '🔴'}
          </span>
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
            title="Create slot at this value"
          >
            <Plus size={14} />
            Create Slot
          </button>
        </div>
        {/* WAVE 1114: Offline warning (non-blocking) */}
        {!dmxConnected && (
          <div className="probe-offline-warning">
            ⚠️ DMX Offline - slider moves but won't output
          </div>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* FOOTER STATS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="wheelsmith-footer">
        <div className="wheel-stats">
          {colors.length} slot{colors.length !== 1 ? 's' : ''} defined
        </div>
        <button className="wheel-btn secondary" onClick={handleReset} disabled={colors.length === 0}>
          <RotateCcw size={14} />
          Clear All
        </button>
      </div>
      
    </div>
  )
}

export default WheelSmithEmbedded
