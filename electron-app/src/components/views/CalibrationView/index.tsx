/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 CALIBRATION LAB - WAVE 1135
 * "El Laboratorio del Cirujano de Luz"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Vista profesional de calibración de hardware.
 * 
 * ARQUITECTURA DUAL-ZONE:
 * - Zone A (60%): Targeting Bay - Radar + Quick Position + Data
 * - Zone B (40%): Tool Rack - Fixture Rack + DMX Scanner + Offsets
 * - Zone C (Footer): Action Bar - Test buttons
 * 
 * INTEGRACIONES:
 * - Output Gate: Fuerza ARMED al entrar (seguridad)
 * - Priority Layer: Calibración tiene prioridad sobre el Gate
 * - StageStore: Fuente de verdad para fixtures (no TruthStore)
 * 
 * CONTROLES WASD:
 * - W/↑: Tilt arriba     Q/E: Diagonal arriba
 * - S/↓: Tilt abajo      Z/C: Diagonal abajo
 * - A/←: Pan izquierda   Space: Centro
 * - D/→: Pan derecha     Tab: Siguiente fixture
 * - B: Blackout          F: Full ON
 * - 1-9: Selección rápida de fixtures
 * 
 * @module components/views/CalibrationView
 * @version 1135.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useSelectionStore } from '../../../stores/selectionStore'
import { useStageStore } from '../../../stores/stageStore'
import './CalibrationView.css'

// Icons
import { 
  MovingHeadIcon, 
  ParCanIcon,
  TargetIcon,
  BlackoutIcon,
  FlashIcon
} from '../../icons/LuxIcons'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ChannelInfo {
  index: number
  name: string
  type: string
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SAFE_PAN_MAX = 513   // 95% of 540° - protects motor from strain
const SAFE_TILT_MAX = 256  // 95% of 270° - protects motor from strain
const STEP_OPTIONS = [1, 5, 15, 45]

// ═══════════════════════════════════════════════════════════════════════════
// MAIN VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const CalibrationView: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════════
  // STORE CONNECTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  // 🔥 WAVE 1135: Use stageStore as source of truth (not truthStore!)
  const stageFixtures = useStageStore(state => state.fixtures)
  const updateFixture = useStageStore(state => state.updateFixture)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const selectFixture = useSelectionStore(state => state.select)
  
  // ═══════════════════════════════════════════════════════════════════════
  // LOCAL STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  const [pan, setPan] = useState(Math.round(SAFE_PAN_MAX / 2))
  const [tilt, setTilt] = useState(Math.round(SAFE_TILT_MAX / 2))
  const [step, setStep] = useState(5)  // Degrees per step
  const [scannerChannel, setScannerChannel] = useState(0)
  const [scannerValue, setScannerValue] = useState(0)
  const [activeTest, setActiveTest] = useState<string | null>(null)
  
  // Offset state
  const [panOffset, setPanOffset] = useState(0)
  const [tiltOffset, setTiltOffset] = useState(0)
  const [panInvert, setPanInvert] = useState(false)
  const [tiltInvert, setTiltInvert] = useState(false)
  
  // 🔥 WAVE 1135.2: Save feedback state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 1135: OUTPUT GATE SAFETY
  // Force ARMED state when entering calibration (no accidental DMX)
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const initSafety = async () => {
      try {
        // Force output gate closed for safety
        await window.lux?.arbiter?.setOutputEnabled?.(false)
        console.log('[CalibrationLab] 🛡️ Output Gate CLOSED for safety')
      } catch (err) {
        console.error('[CalibrationLab] Safety init error:', err)
      }
    }
    
    initSafety()
    
    // Cleanup: We don't restore automatically - user must press GO
    return () => {
      console.log('[CalibrationLab] 👋 Exiting calibration mode')
    }
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════════════════════════
  
  // All fixtures from show (not just moving heads - show ALL for debugging)
  const allFixtures = useMemo(() => {
    return stageFixtures || []
  }, [stageFixtures])
  
  // Get selected fixture
  const activeFixtureId = selectedIds.size > 0 ? [...selectedIds][0] : null
  
  const activeFixture = useMemo(() => {
    if (!activeFixtureId) return null
    return allFixtures.find(f => f.id === activeFixtureId) || null
  }, [activeFixtureId, allFixtures])
  
  // Get channels for selected fixture
  const channels: ChannelInfo[] = useMemo(() => {
    if (!activeFixture?.channels) return []
    return activeFixture.channels.map((ch: any, idx: number) => ({
      index: ch.index ?? idx,
      name: ch.name || `CH ${idx + 1}`,
      type: ch.type || 'unknown'
    }))
  }, [activeFixture])
  
  const dmxBaseAddress = activeFixture?.address || 1
  const universe = activeFixture?.universe ?? 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔄 WAVE 1135.2: OFFSET SYNC - Load saved calibration when fixture changes
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!activeFixtureId) return
    
    const fixture = stageFixtures?.find(f => f.id === activeFixtureId)
    if (fixture?.calibration) {
      setPanOffset(fixture.calibration.panOffset || 0)
      setTiltOffset(fixture.calibration.tiltOffset || 0)
      setPanInvert(fixture.calibration.panInvert || false)
      setTiltInvert(fixture.calibration.tiltInvert || false)
      console.log(`[CalibrationLab] 📥 Loaded calibration for ${fixture.name}:`, fixture.calibration)
    } else {
      // Reset to defaults if no calibration saved
      setPanOffset(0)
      setTiltOffset(0)
      setPanInvert(false)
      setTiltInvert(false)
    }
    
    // Reset save status when changing fixtures
    setSaveStatus('idle')
  }, [activeFixtureId, stageFixtures])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: POSITION CONTROL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Send position to fixture via Arbiter (bypasses gate with priority)
   */
  const sendPosition = useCallback(async (newPan: number, newTilt: number) => {
    if (!activeFixtureId) return
    
    // Safety clamps
    const safePan = Math.max(0, Math.min(SAFE_PAN_MAX, newPan))
    const safeTilt = Math.max(0, Math.min(SAFE_TILT_MAX, newTilt))
    
    setPan(safePan)
    setTilt(safeTilt)
    
    // Convert to DMX (0-255)
    const panDmx = Math.min(242, Math.round((safePan / 540) * 255))
    const tiltDmx = Math.min(241, Math.round((safeTilt / 270) * 255))
    
    console.log(`[CalibrationLab] 🎯 Pan: ${safePan}° (DMX ${panDmx}) Tilt: ${safeTilt}° (DMX ${tiltDmx})`)
    
    try {
      // 🔥 PRIORITY LAYER: Use setManual with speed=0 for instant response
      await window.lux?.arbiter?.setManual({
        fixtureIds: [activeFixtureId],
        controls: {
          pan: panDmx,
          tilt: tiltDmx,
          speed: 0,  // MAX SPEED during calibration
        },
        channels: ['pan', 'tilt', 'speed'],
      })
    } catch (err) {
      console.error('[CalibrationLab] Position error:', err)
    }
  }, [activeFixtureId])
  
  /**
   * Radar mouse/touch handler
   */
  const handleRadarChange = useCallback((normalizedX: number, normalizedY: number) => {
    const newPan = Math.round(normalizedX * SAFE_PAN_MAX)
    const newTilt = Math.round(normalizedY * SAFE_TILT_MAX)
    sendPosition(newPan, newTilt)
  }, [sendPosition])
  
  /**
   * Quick position buttons (8 directions + center)
   */
  const handleQuickPosition = useCallback((direction: string) => {
    let newPan = pan
    let newTilt = tilt
    
    switch (direction) {
      case 'up':    newTilt -= step; break
      case 'down':  newTilt += step; break
      case 'left':  newPan -= step; break
      case 'right': newPan += step; break
      case 'up-left':    newPan -= step; newTilt -= step; break
      case 'up-right':   newPan += step; newTilt -= step; break
      case 'down-left':  newPan -= step; newTilt += step; break
      case 'down-right': newPan += step; newTilt += step; break
      case 'center':
        newPan = Math.round(SAFE_PAN_MAX / 2)
        newTilt = Math.round(SAFE_TILT_MAX / 2)
        break
    }
    
    sendPosition(newPan, newTilt)
  }, [pan, tilt, step, sendPosition])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: DMX SCANNER
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Send raw DMX value to specific channel
   */
  const sendDMX = useCallback(async (channelIndex: number, value: number) => {
    if (!activeFixtureId) return
    
    const channelInfo = channels[channelIndex]
    const channelType = channelInfo?.type || 'unknown'
    
    console.log(`[CalibrationLab] 🔬 DMX Scanner: CH${channelIndex + 1} (${channelType}) = ${value}`)
    
    try {
      // Use Arbiter for known channel types
      if (channelType !== 'unknown' && window.lux?.arbiter?.setManual) {
        await window.lux.arbiter.setManual({
          fixtureIds: [activeFixtureId],
          controls: { [channelType]: value },
          channels: [channelType],
        })
      }
    } catch (err) {
      console.error('[CalibrationLab] DMX Scanner error:', err)
    }
  }, [activeFixtureId, channels])
  
  const handleScannerChange = useCallback((value: number) => {
    setScannerValue(value)
    sendDMX(scannerChannel, value)
  }, [scannerChannel, sendDMX])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: TEST ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleTest = useCallback(async (testType: string) => {
    if (!activeFixtureId) return
    
    // Toggle off if same test
    if (activeTest === testType) {
      setActiveTest(null)
      // Blackout
      const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
      if (dimmerIdx >= 0) sendDMX(dimmerIdx, 0)
      return
    }
    
    setActiveTest(testType)
    
    const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
    const strobeIdx = channels.findIndex(c => c.type === 'strobe')
    const goboIdx = channels.findIndex(c => c.type === 'gobo')
    const colorWheelIdx = channels.findIndex(c => c.type === 'color_wheel')
    
    switch (testType) {
      case 'full':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (strobeIdx >= 0) sendDMX(strobeIdx, 0)
        break
      case 'strobe':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (strobeIdx >= 0) sendDMX(strobeIdx, 195)
        break
      case 'gobo':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (goboIdx >= 0) sendDMX(goboIdx, 39)
        break
      case 'color':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 255)
        if (colorWheelIdx >= 0) sendDMX(colorWheelIdx, 64)
        break
      case 'blackout':
        if (dimmerIdx >= 0) sendDMX(dimmerIdx, 0)
        if (strobeIdx >= 0) sendDMX(strobeIdx, 0)
        break
    }
  }, [activeFixtureId, activeTest, channels, sendDMX])
  
  // ═══════════════════════════════════════════════════════════════════════
  // HANDLERS: FIXTURE SELECTION
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleFixtureSelect = useCallback((fixtureId: string) => {
    selectFixture(fixtureId, 'replace')
    setActiveTest(null)
    setScannerValue(0)
    setScannerChannel(0)
  }, [selectFixture])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 💾 WAVE 1135.2: OFFSET PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Save calibration offsets to the show file
   * This persists to stageStore → ShowFile (saved to disk)
   */
  const handleSaveOffsets = useCallback(async () => {
    if (!activeFixtureId) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
      return
    }
    
    setSaveStatus('saving')
    
    try {
      // Update fixture in stageStore with calibration data
      updateFixture(activeFixtureId, {
        calibration: {
          panOffset,
          tiltOffset,
          panInvert,
          tiltInvert,
        }
      })
      
      console.log(`[CalibrationLab] 💾 Saved calibration for fixture ${activeFixtureId}:`, {
        panOffset, tiltOffset, panInvert, tiltInvert
      })
      
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[CalibrationLab] Failed to save calibration:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }, [activeFixtureId, updateFixture, panOffset, tiltOffset, panInvert, tiltInvert])
  
  /**
   * Reset offsets to zero
   */
  const handleResetOffsets = useCallback(() => {
    setPanOffset(0)
    setTiltOffset(0)
    setPanInvert(false)
    setTiltInvert(false)
    setSaveStatus('idle')
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎮 WAVE 1135: KEYBOARD SHORTCUTS (WASD + Arrow Keys)
  // ═══════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      switch (e.key.toLowerCase()) {
        // Movement
        case 'w': case 'arrowup':    handleQuickPosition('up'); break
        case 's': case 'arrowdown':  handleQuickPosition('down'); break
        case 'a': case 'arrowleft':  handleQuickPosition('left'); break
        case 'd': case 'arrowright': handleQuickPosition('right'); break
        case 'q': handleQuickPosition('up-left'); break
        case 'e': handleQuickPosition('up-right'); break
        case 'z': handleQuickPosition('down-left'); break
        case 'c': handleQuickPosition('down-right'); break
        case ' ': e.preventDefault(); handleQuickPosition('center'); break
        
        // Tests
        case 'b': handleTest('blackout'); break
        case 'f': handleTest('full'); break
        
        // Fixture selection (1-9)
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9':
          const idx = parseInt(e.key) - 1
          if (allFixtures[idx]) {
            handleFixtureSelect(allFixtures[idx].id)
          }
          break
        
        // Tab navigation
        case 'tab':
          e.preventDefault()
          const currentIdx = allFixtures.findIndex(f => f.id === activeFixtureId)
          const nextIdx = e.shiftKey 
            ? (currentIdx - 1 + allFixtures.length) % allFixtures.length
            : (currentIdx + 1) % allFixtures.length
          if (allFixtures[nextIdx]) {
            handleFixtureSelect(allFixtures[nextIdx].id)
          }
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleQuickPosition, handleTest, handleFixtureSelect, allFixtures, activeFixtureId])
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE ICON HELPER
  // ═══════════════════════════════════════════════════════════════════════
  
  const getFixtureIcon = (type?: string) => {
    const t = (type || '').toLowerCase()
    if (t.includes('moving') || t.includes('spot') || t.includes('beam')) {
      return <MovingHeadIcon size={16} />
    }
    if (t.includes('par') || t.includes('wash')) {
      return <ParCanIcon size={16} />
    }
    return <ParCanIcon size={16} />
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  
  // Normalized position for radar cursor (0-1)
  const normalizedPan = pan / SAFE_PAN_MAX
  const normalizedTilt = tilt / SAFE_TILT_MAX
  
  return (
    <div className="calibration-lab">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="lab-header">
        <div className="header-title">
          <TargetIcon size={20} className="header-icon" />
          <h1>CALIBRATION LAB</h1>
        </div>
        
        <div className="header-status">
          {activeFixture ? (
            <>
              <span className="fixture-name">{activeFixture.name}</span>
              <span className="fixture-badge">DMX {dmxBaseAddress}</span>
              <span className="status-badge armed">⟳ ARMED</span>
            </>
          ) : (
            <span className="no-selection">Select a fixture to calibrate</span>
          )}
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - DUAL ZONE
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="lab-content">
        
        {/* ─────────────────────────────────────────────────────────────────
            ZONE A: TARGETING BAY (Left 60%)
            ───────────────────────────────────────────────────────────────── */}
        <div className="zone-targeting">
          
          {/* TARGETING RADAR */}
          <div className="targeting-radar">
            <div className="radar-container">
              {/* Grid */}
              <div className="radar-grid">
                <div className="grid-ring ring-outer" />
                <div className="grid-ring ring-mid" />
                <div className="grid-ring ring-inner" />
                <div className="grid-cross-h" />
                <div className="grid-cross-v" />
                <div className="grid-diagonal-1" />
                <div className="grid-diagonal-2" />
              </div>
              
              {/* Interactive area */}
              <div 
                className="radar-interactive"
                onMouseDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const update = (clientX: number, clientY: number) => {
                    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
                    handleRadarChange(x, y)
                  }
                  update(e.clientX, e.clientY)
                  
                  const handleMove = (ev: MouseEvent) => update(ev.clientX, ev.clientY)
                  const handleUp = () => {
                    window.removeEventListener('mousemove', handleMove)
                    window.removeEventListener('mouseup', handleUp)
                  }
                  window.addEventListener('mousemove', handleMove)
                  window.addEventListener('mouseup', handleUp)
                }}
                onDoubleClick={() => handleQuickPosition('center')}
              >
                {/* Cursor */}
                <div 
                  className="radar-cursor"
                  style={{
                    left: `${normalizedPan * 100}%`,
                    top: `${normalizedTilt * 100}%`,
                  }}
                >
                  <div className="cursor-core" />
                  <div className="cursor-ring" />
                  <div className="cursor-brackets">
                    <span className="bracket tl">┌</span>
                    <span className="bracket tr">┐</span>
                    <span className="bracket bl">└</span>
                    <span className="bracket br">┘</span>
                  </div>
                </div>
              </div>
              
              {/* Labels */}
              <div className="radar-labels">
                <span className="label l-top">0°</span>
                <span className="label l-bottom">270°</span>
                <span className="label l-left">0°</span>
                <span className="label l-right">540°</span>
              </div>
            </div>
          </div>
          
          {/* QUICK POSITION */}
          <div className="quick-position">
            <div className="position-grid">
              <button className="pos-btn" onClick={() => handleQuickPosition('up-left')} title="Q">↖</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('up')} title="W / ↑">↑</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('up-right')} title="E">↗</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('left')} title="A / ←">←</button>
              <button className="pos-btn center" onClick={() => handleQuickPosition('center')} title="Space">⊙</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('right')} title="D / →">→</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('down-left')} title="Z">↙</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('down')} title="S / ↓">↓</button>
              <button className="pos-btn" onClick={() => handleQuickPosition('down-right')} title="C">↘</button>
            </div>
            
            <div className="step-selector">
              <span className="step-label">STEP</span>
              <div className="step-options">
                {STEP_OPTIONS.map(s => (
                  <button 
                    key={s}
                    className={`step-btn ${step === s ? 'active' : ''}`}
                    onClick={() => setStep(s)}
                  >
                    {s}°
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* POSITION DATA */}
          <div className="position-data">
            <div className="data-row">
              <span className="data-label">PAN</span>
              <div className="data-bar">
                <div className="bar-fill" style={{ width: `${normalizedPan * 100}%` }} />
                <div className="bar-safe" style={{ width: '95%' }} />
              </div>
              <span className="data-value">{pan}°</span>
              <span className="data-max">/ 540°</span>
            </div>
            <div className="data-row">
              <span className="data-label">TILT</span>
              <div className="data-bar">
                <div className="bar-fill" style={{ width: `${normalizedTilt * 100}%` }} />
                <div className="bar-safe" style={{ width: '95%' }} />
              </div>
              <span className="data-value">{tilt}°</span>
              <span className="data-max">/ 270°</span>
            </div>
          </div>
        </div>
        
        {/* ─────────────────────────────────────────────────────────────────
            ZONE B: TOOL RACK (Right 40%)
            ───────────────────────────────────────────────────────────────── */}
        <div className="zone-tools">
          
          {/* FIXTURE RACK */}
          <div className="tool-panel fixture-rack">
            <div className="panel-header">
              <span className="panel-title">FIXTURE RACK</span>
              <span className="panel-badge">{allFixtures.length}</span>
            </div>
            <div className="fixture-list">
              {allFixtures.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-text">No fixtures in show</span>
                  <span className="empty-hint">Load a show or add fixtures</span>
                </div>
              ) : (
                allFixtures.map((fixture, idx) => (
                  <button
                    key={fixture.id}
                    className={`fixture-item ${activeFixtureId === fixture.id ? 'selected' : ''}`}
                    onClick={() => handleFixtureSelect(fixture.id)}
                  >
                    <span className="fixture-index">{idx + 1}</span>
                    <span className="fixture-icon">{getFixtureIcon(fixture.type)}</span>
                    <span className="fixture-name">{fixture.name}</span>
                    <span className="fixture-dmx">CH {fixture.address}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          
          {/* DMX SCANNER */}
          <div className="tool-panel dmx-scanner">
            <div className="panel-header">
              <span className="panel-title">DMX SCANNER</span>
              {activeFixture && <span className="panel-badge">DMX {dmxBaseAddress}</span>}
            </div>
            
            {channels.length === 0 ? (
              <div className="empty-state">
                <span className="empty-text">No channels</span>
              </div>
            ) : (
              <div className="scanner-content">
                <div className="scanner-channel">
                  <label>Channel:</label>
                  <select 
                    value={scannerChannel}
                    onChange={(e) => {
                      setScannerChannel(Number(e.target.value))
                      setScannerValue(0)
                    }}
                  >
                    {channels.map((ch, idx) => (
                      <option key={idx} value={idx}>
                        {idx + 1}: {ch.name} ({ch.type})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="scanner-slider">
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={scannerValue}
                    onChange={(e) => handleScannerChange(Number(e.target.value))}
                  />
                  <span className="scanner-value">{scannerValue}</span>
                </div>
                
                <div className="scanner-presets">
                  {['dimmer', 'strobe', 'gobo', 'color_wheel', 'pan', 'tilt'].map(type => {
                    const idx = channels.findIndex(c => c.type === type)
                    if (idx < 0) return null
                    return (
                      <button
                        key={type}
                        className={`preset-btn ${scannerChannel === idx ? 'active' : ''}`}
                        onClick={() => {
                          setScannerChannel(idx)
                          setScannerValue(0)
                        }}
                      >
                        {type.replace('_', ' ').toUpperCase().slice(0, 4)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* OFFSET CONFIG */}
          <div className="tool-panel offset-config">
            <div className="panel-header">
              <span className="panel-title">OFFSET CONFIG</span>
            </div>
            
            <div className="offset-content">
              <div className="offset-row">
                <label>Pan Offset</label>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={panOffset}
                  onChange={(e) => setPanOffset(Number(e.target.value))}
                  disabled={!activeFixtureId}
                />
                <span className="offset-value">{panOffset > 0 ? '+' : ''}{panOffset}°</span>
              </div>
              
              <div className="offset-row">
                <label>Tilt Offset</label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={tiltOffset}
                  onChange={(e) => setTiltOffset(Number(e.target.value))}
                  disabled={!activeFixtureId}
                />
                <span className="offset-value">{tiltOffset > 0 ? '+' : ''}{tiltOffset}°</span>
              </div>
              
              <div className="offset-toggles">
                <button 
                  className={`toggle-btn ${panInvert ? 'active' : ''}`}
                  onClick={() => setPanInvert(!panInvert)}
                  disabled={!activeFixtureId}
                >
                  Pan ↔
                </button>
                <button 
                  className={`toggle-btn ${tiltInvert ? 'active' : ''}`}
                  onClick={() => setTiltInvert(!tiltInvert)}
                  disabled={!activeFixtureId}
                >
                  Tilt ↕
                </button>
              </div>
              
              <div className="offset-actions">
                <button 
                  className="action-btn"
                  onClick={handleResetOffsets}
                  disabled={!activeFixtureId}
                >
                  RESET
                </button>
                <button 
                  className={`action-btn primary ${saveStatus === 'saved' ? 'saved' : ''} ${saveStatus === 'error' ? 'error' : ''}`}
                  onClick={handleSaveOffsets}
                  disabled={!activeFixtureId || saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? '...' : 
                   saveStatus === 'saved' ? '✓ SAVED' : 
                   saveStatus === 'error' ? '✗ ERROR' : 
                   'SAVE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
          ACTION BAR (Footer)
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="lab-actions">
        <button 
          className={`action-btn blackout ${activeTest === 'blackout' ? 'active' : ''}`}
          onClick={() => handleTest('blackout')}
          title="B"
        >
          <BlackoutIcon size={18} />
          <span>BLACKOUT</span>
        </button>
        
        <button 
          className={`action-btn strobe ${activeTest === 'strobe' ? 'active' : ''}`}
          onClick={() => handleTest('strobe')}
        >
          <FlashIcon size={18} />
          <span>STROBE</span>
        </button>
        
        <button 
          className={`action-btn color ${activeTest === 'color' ? 'active' : ''}`}
          onClick={() => handleTest('color')}
        >
          <span className="color-dot" />
          <span>COLOR</span>
        </button>
        
        <button 
          className={`action-btn gobo ${activeTest === 'gobo' ? 'active' : ''}`}
          onClick={() => handleTest('gobo')}
        >
          <span className="gobo-icon">◐</span>
          <span>GOBO</span>
        </button>
        
        <button 
          className={`action-btn full ${activeTest === 'full' ? 'active' : ''}`}
          onClick={() => handleTest('full')}
          title="F"
        >
          <span className="full-icon">☀</span>
          <span>FULL ON</span>
        </button>
      </footer>
    </div>
  )
}

export default CalibrationView
