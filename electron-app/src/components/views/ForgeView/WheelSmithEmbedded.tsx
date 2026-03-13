/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎡 WHEELSMITH EMBEDDED - WAVE 2072: THE WHEELSMITH OVERHAUL
 * "The Color Wheel Craftsman" - Cyberpunk Slot Card Editor
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2072 MANIFESTO:
 * Phase 1 — Array robustness: stable keys via crypto.randomUUID(), 
 *           deep-copy updateColorSlot, zero index-based mutations.
 * Phase 2 — DMX injection bridge: sendDirectDMX() with 3-tier fallback
 *           (lux.sendDmxChannel → lux.dmx.sendDirect → lux.arbiter.setManual),
 *           per-slot ⚡TEST button for instant hardware verification.
 * Phase 3 — Cyberpunk visual overhaul: dark slot cards (#18181b), amber
 *           accents (#f59e0b), circular color pickers, JetBrains Mono,
 *           tactical buttons, ForgeView CSS integration.
 * Phase 4 — Cold test cockpit header: DMX address input promoted to
 *           probe header area, always visible when in mold-test mode.
 * 
 * ZERO lucide-react. ALL icons from LuxIcons.
 * 
 * @module components/views/ForgeView/WheelSmithEmbedded
 * @version WAVE 2072
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  PlusIcon,
  TrashIcon,
  PaletteChromaticIcon,
  ResetIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  AlertIcon,
  OracleEyeIcon,
  ZapIcon,
  NetworkIcon,
  ChevronRightIcon,
  GoboIcon,
} from '../../icons/LuxIcons'
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
  /** WAVE 2072: Stable identity key — never mutates after creation */
  _key?: string
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

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 2100: minChangeTimeMs — velocidad mínima de la rueda mecánica
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Tiempo mínimo entre cambios de color de la rueda mecánica (ms).
   * El HardwareSafetyLayer usa este valor × safetyMargin para proteger
   * el motor. Valores típicos:
   *   - 200ms → Rueda LED rápida (solo protección contra chaos)
   *   - 500ms → Beam 2R estándar (default industria)
   *   - 800ms → Mover viejo / rueda pesada
   *   - 1000ms → CMY flags lentos
   */
  minChangeTimeMs?: number
  /** Callback cuando el usuario ajusta el minChangeTimeMs */
  onMinChangeTimeMsChange?: (ms: number) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
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

/** WAVE 2072: Generate a stable unique key for each color slot */
let _keyCounter = 0
function generateSlotKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `ws-${Date.now()}-${++_keyCounter}`
}

/** WAVE 2072: Ensure every color in the array has a stable _key */
function ensureKeys(colors: WheelColor[]): WheelColor[] {
  let dirty = false
  const keyed = colors.map(c => {
    if (c._key) return c
    dirty = true
    return { ...c, _key: generateSlotKey() }
  })
  return dirty ? keyed : colors
}

/**
 * WAVE 2072 Phase 1: DEEP-COPY SLOT UPDATE
 * Pure function — never mutates the source array.
 */
function updateColorSlot(
  colors: WheelColor[],
  key: string,
  patch: Partial<WheelColor>,
): WheelColor[] {
  return colors.map(c =>
    c._key === key
      ? { ...c, ...patch, rgb: patch.rgb ? { ...patch.rgb } : { ...c.rgb } }
      : c
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const WheelSmithEmbedded: React.FC<WheelSmithEmbeddedProps> = ({
  colors: rawColors,
  onColorsChange,
  hasColorWheelChannel,
  onNavigateToRack,
  onTestDmx,
  fixtureId,
  channelIndex = 0,
  minChangeTimeMs = 500,
  onMinChangeTimeMsChange,
}) => {
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2072 Phase 1: Ensure stable keys on every render
  // ═══════════════════════════════════════════════════════════════════════
  const colors = ensureKeys(rawColors)
  if (colors !== rawColors) {
    queueMicrotask(() => onColorsChange(colors))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [validationError, setValidationError] = useState<string | null>(null)
  const [probeValue, setProbeValue] = useState<number>(0)
  const [testAddress, setTestAddress] = useState<number>(1)
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 2093.3 (CW-AUDIT-7): DMX VALIDATION ENGINE
  // Detects: duplicate DMX values, non-monotonic ordering, spin overlap
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Default continuous spin range for color wheels (industry standard Beam 2R-like) */
  const SPIN_RANGE_START = 190
  const SPIN_RANGE_END = 255
  
  const wheelValidation = useMemo(() => {
    const warnings: Array<{ type: 'duplicate' | 'spin-overlap' | 'non-monotonic'; message: string; slotKey?: string }> = []
    
    if (colors.length < 2) return warnings
    
    // ── Check 1: Duplicate DMX values ──
    const dmxSeen = new Map<number, string>() // dmx → first slot name
    for (const color of colors) {
      const existing = dmxSeen.get(color.dmx)
      if (existing) {
        warnings.push({
          type: 'duplicate',
          message: `DMX ${color.dmx}: "${color.name}" duplicates "${existing}"`,
          slotKey: color._key,
        })
      } else {
        dmxSeen.set(color.dmx, color.name)
      }
    }
    
    // ── Check 2: DMX values in continuous spin range ──
    for (const color of colors) {
      if (color.dmx >= SPIN_RANGE_START && color.dmx <= SPIN_RANGE_END) {
        warnings.push({
          type: 'spin-overlap',
          message: `DMX ${color.dmx} ("${color.name}"): in continuous spin range (${SPIN_RANGE_START}-${SPIN_RANGE_END})`,
          slotKey: color._key,
        })
      }
    }
    
    // ── Check 3: Non-monotonic DMX ordering ──
    // Physical wheels expect ascending DMX values. Non-monotonic = suspicious.
    for (let i = 1; i < colors.length; i++) {
      if (colors[i].dmx <= colors[i - 1].dmx) {
        warnings.push({
          type: 'non-monotonic',
          message: `Slot #${i + 1} ("${colors[i].name}") DMX ${colors[i].dmx} ≤ slot #${i} ("${colors[i - 1].name}") DMX ${colors[i - 1].dmx} — non-ascending order`,
          slotKey: colors[i]._key,
        })
      }
    }
    
    return warnings
  }, [colors])
  
  /** Set of slot keys that have validation issues (for per-card highlighting) */
  const warnedSlotKeys = useMemo(() => 
    new Set(wheelValidation.filter(w => w.slotKey).map(w => w.slotKey!)),
    [wheelValidation]
  )
  
  // ═══════════════════════════════════════════════════════════════════════
  // STORE — Fixture from Stage
  // ═══════════════════════════════════════════════════════════════════════
  
  const fixture = useStageStore(state => {
    if (!fixtureId) return null
    const fixtures = state.fixtures || []
    return fixtures.find(f => f.id === fixtureId) || null
  })
  
  const dmxBaseAddress = fixture?.address ?? null
  const universe = fixture?.universe ?? 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // DMX ENGINE DETECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  const lux = (typeof window !== 'undefined' ? window.lux : null) as any
  const hasDmxEngine = !!lux?.sendDmxChannel || !!lux?.dmx?.sendDirect || !!lux?.arbiter
  const canSendLive = hasDmxEngine
  const isMoldTest = !fixtureId || dmxBaseAddress === null

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2072 Phase 2: DMX INJECTION — 3-tier fallback
  // ═══════════════════════════════════════════════════════════════════════

  const sendDirectDMX = useCallback(async (dmxValue: number) => {
    const effectiveUniverse = isMoldTest ? 0 : universe
    const effectiveBaseAddress = isMoldTest ? testAddress : dmxBaseAddress
    
    if (effectiveBaseAddress === null) return

    const absoluteAddress = effectiveBaseAddress + (channelIndex || 0)
    
    console.log(`[WheelSmith] 🎛️ DMX OUT: Universe ${effectiveUniverse}, ColorWheel CH${channelIndex} → DMX ${absoluteAddress} = ${dmxValue}`)
    
    if (lux?.sendDmxChannel) {
      lux.sendDmxChannel(effectiveUniverse, absoluteAddress, dmxValue)
      return
    }
    if (lux?.dmx?.sendDirect) {
      lux.dmx.sendDirect(effectiveUniverse, absoluteAddress, dmxValue)
      return
    }
    
    if (!isMoldTest && lux?.arbiter?.setManual) {
      try {
        await lux.arbiter.setManual({
          fixtureIds: [fixtureId],
          controls: { color_wheel: dmxValue },
          channels: ['color_wheel'],
        })
      } catch (err) {
        console.error('[WheelSmith] ❌ Arbiter error:', err)
      }
    } else if (isMoldTest) {
      console.warn('[WheelSmith] ⚠️ Cold injection impossible: no direct DMX API available.')
    }
  }, [fixtureId, dmxBaseAddress, channelIndex, universe, testAddress, lux, isMoldTest])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS — All use deep-copy updateColorSlot or fresh arrays
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleAddColor = useCallback(() => {
    const nextDmx = suggestNextDmx(colors)
    const newColor: WheelColor = {
      dmx: nextDmx,
      name: `Color ${colors.length + 1}`,
      rgb: { r: 255, g: 255, b: 255 },
      _key: generateSlotKey(),
    }
    onColorsChange([...colors, newColor])
    console.log('[WheelSmith] ➕ Added slot at DMX:', nextDmx)
  }, [colors, onColorsChange])
  
  const handleAddPreset = useCallback((preset: typeof COLOR_PRESETS[0]) => {
    const nextDmx = suggestNextDmx(colors)
    const newColor: WheelColor = {
      dmx: nextDmx,
      name: preset.name,
      rgb: { ...preset.rgb },
      _key: generateSlotKey(),
    }
    onColorsChange([...colors, newColor])
    console.log('[WheelSmith] ➕ Added preset:', preset.name)
  }, [colors, onColorsChange])
  
  const handleRemoveColor = useCallback((key: string) => {
    onColorsChange(colors.filter(c => c._key !== key))
    setValidationError(null)
    console.log('[WheelSmith] ➖ Removed slot:', key)
  }, [colors, onColorsChange])
  
  const handleDmxChange = useCallback((key: string, dmx: number) => {
    const clampedDmx = Math.max(0, Math.min(255, dmx))
    onColorsChange(updateColorSlot(colors, key, { dmx: clampedDmx }))
  }, [colors, onColorsChange])
  
  const handleNameChange = useCallback((key: string, name: string) => {
    onColorsChange(updateColorSlot(colors, key, { name }))
  }, [colors, onColorsChange])
  
  const handleColorChange = useCallback((key: string, hex: string) => {
    const rgb = hexToRgb(hex)
    onColorsChange(updateColorSlot(colors, key, { rgb }))
  }, [colors, onColorsChange])
  
  const handleTextureToggle = useCallback((key: string, current: boolean) => {
    onColorsChange(updateColorSlot(colors, key, { hasTexture: !current }))
  }, [colors, onColorsChange])
  
  const handleMoveUp = useCallback((key: string) => {
    const idx = colors.findIndex(c => c._key === key)
    if (idx <= 0) return
    const fresh = [...colors]
    ;[fresh[idx - 1], fresh[idx]] = [fresh[idx], fresh[idx - 1]]
    onColorsChange(fresh)
  }, [colors, onColorsChange])
  
  const handleMoveDown = useCallback((key: string) => {
    const idx = colors.findIndex(c => c._key === key)
    if (idx < 0 || idx >= colors.length - 1) return
    const fresh = [...colors]
    ;[fresh[idx], fresh[idx + 1]] = [fresh[idx + 1], fresh[idx]]
    onColorsChange(fresh)
  }, [colors, onColorsChange])
  
  // ═══════════════════════════════════════════════════════════════════════
  // LIVE PROBE — Real DMX via IPC
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleProbeChange = useCallback(async (value: number) => {
    const clampedValue = Math.max(0, Math.min(255, value))
    setProbeValue(clampedValue)
    await sendDirectDMX(clampedValue)
    if (onTestDmx) onTestDmx(clampedValue)
  }, [onTestDmx, sendDirectDMX])
  
  const handleSlotTest = useCallback(async (dmxValue: number) => {
    setProbeValue(dmxValue)
    await sendDirectDMX(dmxValue)
    if (onTestDmx) onTestDmx(dmxValue)
  }, [onTestDmx, sendDirectDMX])
  
  const handleCreateFromProbe = useCallback(() => {
    const newColor: WheelColor = {
      dmx: probeValue,
      name: `Color @ ${probeValue}`,
      rgb: { r: 255, g: 255, b: 255 },
      _key: generateSlotKey(),
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
  // RENDER — NO COLOR WHEEL CHANNEL
  // ═══════════════════════════════════════════════════════════════════════
  
  if (!hasColorWheelChannel) {
    return (
      <div className="wheelsmith-no-channel">
        <div className="no-channel-icon">
          <PaletteChromaticIcon size={64} />
        </div>
        <h3>No Color Wheel Channel Detected</h3>
        <p>Add a <strong>Color Wheel</strong> channel in the Channel Rack first.</p>
        <button className="go-to-rack-btn" onClick={onNavigateToRack}>
          <NetworkIcon size={16} />
          <span>Go to Channel Rack</span>
          <ChevronRightIcon size={16} />
        </button>
      </div>
    )
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — MAIN EDITOR (Cyberpunk Slot Cards)
  // ═══════════════════════════════════════════════════════════════════════
  
  return (
    <div className="wheelsmith-embedded">
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LIVE PROBE — WAVE 2072 Phase 4: Promoted to cockpit header */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="wheel-live-probe">
        <div className="probe-header">
          <ZapIcon size={16} />
          <span className="probe-title">LIVE PROBE</span>
          <span className="probe-subtitle">(Channel Output)</span>
          
          {/* WAVE 2072 Phase 4: Cold test address — in header */}
          {isMoldTest && hasDmxEngine && (
            <div className="probe-cold-test">
              <span className="cold-test-label">🧪 COLD TEST</span>
              <span className="cold-test-addr-label">DMX:</span>
              <input 
                type="number" 
                min={1} max={512} 
                value={testAddress}
                onChange={(e) => setTestAddress(parseInt(e.target.value) || 1)}
                className="cold-test-input"
                title="DMX Address for raw hardware injection"
              />
            </div>
          )}
          
          {/* DMX Status */}
          <span 
            className={`probe-dmx-status ${canSendLive ? 'connected' : 'offline'}`}
            title={canSendLive ? 'DMX Connected' : 'Offline (Open from Stage)'}
          >
            {canSendLive ? '🟢' : '🔴'}
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
            <PlusIcon size={14} />
            Create Slot
          </button>
        </div>
        
        {/* DMX Engine offline warning */}
        {!hasDmxEngine && (
          <div className="probe-offline-warning">
            <AlertIcon size={14} />
            <span>DMX Engine Offline — Open show from Stage to enable</span>
          </div>
        )}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PRESETS BAR */}
      {/* ═══════════════════════════════════════════════════════════ */}
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
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* COLOR SLOTS — Cyberpunk Card Layout */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="wheelsmith-body">
        {colors.length === 0 ? (
          <div className="wheel-empty-state">
            <PaletteChromaticIcon size={48} />
            <p>No colors defined</p>
            <p className="hint">Use presets above or add colors manually</p>
          </div>
        ) : (
          <div className="wheel-slot-grid">
            {colors.map((color, index) => {
              const key = color._key || `fallback-${index}`
              const isFirst = index === 0
              const isLast = index === colors.length - 1
              
              return (
                <div key={key} className={`wheel-slot-card${warnedSlotKeys.has(key) ? ' wheel-slot-warned' : ''}`}
                  style={warnedSlotKeys.has(key) ? { borderColor: 'rgba(245, 158, 11, 0.6)', boxShadow: '0 0 8px rgba(245, 158, 11, 0.15)' } : undefined}
                >
                  
                  {/* ── Slot Header: Index + Color Orb + Name ── */}
                  <div className="slot-header">
                    <span className="slot-index">#{index + 1}</span>
                    <div 
                      className="slot-color-orb"
                      style={{ backgroundColor: rgbToHex(color.rgb) }}
                    />
                    <input
                      type="text"
                      className="slot-name-input"
                      placeholder="Color name..."
                      value={color.name}
                      onChange={(e) => handleNameChange(key, e.target.value)}
                    />
                    
                    {/* Gobo/Texture badge */}
                    <button
                      className={`slot-gobo-badge ${color.hasTexture ? 'active' : ''}`}
                      onClick={() => handleTextureToggle(key, color.hasTexture || false)}
                      title={color.hasTexture ? 'Has gobo/texture' : 'No texture'}
                    >
                      <GoboIcon size={14} />
                    </button>
                  </div>
                  
                  {/* ── Slot Body: DMX + Color Picker ── */}
                  <div className="slot-body">
                    <div className="slot-dmx-group">
                      <label className="slot-field-label">DMX</label>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={color.dmx}
                        onChange={(e) => handleDmxChange(key, parseInt(e.target.value) || 0)}
                        className="slot-dmx-input"
                      />
                    </div>
                    
                    <div className="slot-color-group">
                      <label className="slot-field-label">RGB</label>
                      <div className="slot-color-picker-wrap">
                        <input
                          type="color"
                          value={rgbToHex(color.rgb)}
                          onChange={(e) => handleColorChange(key, e.target.value)}
                          className="slot-color-input"
                          title="Select color"
                        />
                        <span className="slot-hex-label">{rgbToHex(color.rgb)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* ── Slot Actions: Test + Move + Delete ── */}
                  <div className="slot-actions">
                    {/* Per-slot TEST button — WAVE 2072 Phase 2 */}
                    <button 
                      className="slot-action-btn test"
                      onClick={() => handleSlotTest(color.dmx)}
                      title={`⚡ Test DMX ${color.dmx}`}
                      disabled={!canSendLive}
                    >
                      <OracleEyeIcon size={13} />
                      <span>TEST</span>
                    </button>
                    
                    <div className="slot-action-spacer" />
                    
                    <button 
                      className="slot-action-btn move"
                      onClick={() => handleMoveUp(key)}
                      disabled={isFirst}
                      title="Move up"
                    >
                      <ChevronUpIcon size={14} />
                    </button>
                    <button 
                      className="slot-action-btn move"
                      onClick={() => handleMoveDown(key)}
                      disabled={isLast}
                      title="Move down"
                    >
                      <ChevronDownIcon size={14} />
                    </button>
                    
                    <button 
                      className="slot-action-btn delete"
                      onClick={() => handleRemoveColor(key)}
                      title="Remove slot"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Add button */}
        <button className="wheel-add-btn" onClick={handleAddColor}>
          <PlusIcon size={16} />
          Add Slot
        </button>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VALIDATION ERROR */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {validationError && (
        <div className="wheel-validation-error">
          <AlertIcon size={16} />
          {validationError}
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 🔧 WAVE 2093.3 (CW-AUDIT-7): DMX VALIDATION WARNINGS     */}
      {/* Persistent panel: duplicates, spin overlap, non-monotonic  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {wheelValidation.length > 0 && (
        <div className="wheel-validation-panel" style={{
          margin: '8px 0',
          padding: '8px 10px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '6px',
          maxHeight: '120px',
          overflowY: 'auto',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#f59e0b',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            ⚠️ DMX VALIDATION ({wheelValidation.length} issue{wheelValidation.length !== 1 ? 's' : ''})
          </div>
          {wheelValidation.map((w, i) => (
            <div key={i} style={{
              fontSize: '9px',
              color: w.type === 'spin-overlap' ? '#ef4444' : '#fbbf24',
              fontFamily: '"JetBrains Mono", monospace',
              lineHeight: '1.5',
              padding: '1px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span>{w.type === 'duplicate' ? '🔁' : w.type === 'spin-overlap' ? '🌀' : '📉'}</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 🔧 WAVE 2100: MECHANICAL WHEEL SPEED — minChangeTimeMs     */}
      {/* Protege el motor de la rueda contra cambios demasiado rápidos */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {onMinChangeTimeMsChange && (
        <div style={{
          margin: '8px 0',
          padding: '10px 12px',
          background: 'rgba(168, 85, 247, 0.06)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          borderRadius: '6px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#a855f7',
              letterSpacing: '0.5px',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              ⚙️ WHEEL MOTOR SPEED
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: minChangeTimeMs >= 800 ? '#ef4444' : minChangeTimeMs >= 500 ? '#f59e0b' : '#22c55e',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {minChangeTimeMs}ms
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={1500}
            step={50}
            value={minChangeTimeMs}
            onChange={(e) => onMinChangeTimeMsChange(parseInt(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#a855f7',
              cursor: 'pointer',
            }}
            title={`Minimum time between color wheel changes: ${minChangeTimeMs}ms. Lower = faster wheel (LED), higher = slower wheel (mechanical).`}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '8px',
            color: '#71717a',
            fontFamily: '"JetBrains Mono", monospace',
            marginTop: '2px',
          }}>
            <span>50ms (LED)</span>
            <span>500ms (Std)</span>
            <span>1500ms (Slow)</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FOOTER STATS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="wheelsmith-footer">
        <div className="wheel-stats">
          {colors.length} slot{colors.length !== 1 ? 's' : ''} defined
        </div>
        <button className="wheel-btn secondary" onClick={handleReset} disabled={colors.length === 0}>
          <ResetIcon size={14} />
          Clear All
        </button>
      </div>
      
    </div>
  )
}

export default WheelSmithEmbedded