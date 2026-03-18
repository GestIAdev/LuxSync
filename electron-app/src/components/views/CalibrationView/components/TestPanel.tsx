/**
 * 🧪 TEST PANEL - WAVE 425 + WAVE 1008 LIVE UPGRADE
 * Panel de pruebas de hardware CON DMX DIRECTO
 * 
 * Quick actions para probar funciones del fixture:
 * - Test Color (full white)
 * - Test Strobe
 * - Test Gobo
 * - Blackout
 * 
 * 🔥 WAVE 1008: THE LAB - Direct DMX injection for testing
 * - DMX Channel Scanner: Test any channel with slider
 * - Bypass Arbiter for raw hardware testing
 * - Real-time value feedback
 */

import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import './TestPanel.css'

export interface TestPanelProps {
  fixtureId: string | null
  disabled?: boolean
}

type TestType = 'color' | 'strobe' | 'gobo' | null

// 🔥 Channel info for known fixture types
interface ChannelInfo {
  index: number
  name: string
  type: string
}

export const TestPanel: React.FC<TestPanelProps> = ({
  fixtureId,
  disabled = false,
}) => {
  const [activeTest, setActiveTest] = useState<TestType>(null)
  const [scannerChannel, setScannerChannel] = useState(0)
  const [scannerValue, setScannerValue] = useState(0)
  const [showScanner, setShowScanner] = useState(false)
  
  // Throttle: el slider React actualiza el DOM a 60fps pero el IPC al backend
  // sólo dispara cada THROTTLE_MS. Coincide con el loop de TitanOrchestrator (40ms/25fps).
  const THROTTLE_MS = 40  // 25fps — sincronizado con el frame DMX-safe del Orchestrator
  const lastSendTime = useRef<number>(0)
  // Ref para capturar el fixtureId actual en el closure del cleanup sin re-registrar el efecto
  const fixtureIdRef = useRef<string | null>(fixtureId)
  useEffect(() => { fixtureIdRef.current = fixtureId }, [fixtureId])

  // ── CLEANUP ON UNMOUNT ────────────────────────────────────────────────────
  // Al desmontar el TestPanel, libera todos los overrides manuales del fixture
  // activo en el MasterArbiter. Sin esto, los canales quedan "zombies" luchando
  // contra la LiveView indefinidamente.
  useEffect(() => {
    return () => {
      const id = fixtureIdRef.current
      if (!id) return
      window.lux.arbiter.clearManual({ fixtureIds: [id] })
        .catch((err: unknown) => console.error('[TestPanel] ❌ clearManual en unmount falló:', err))
    }
  }, []) // [] = solo se ejecuta el return en unmount, nunca en re-render
  // ─────────────────────────────────────────────────────────────────────────

  // 🔥 WAVE 1008: Get fixture data from store for DMX address calculation
  const fixture = useStageStore(state => {
    const fixtures = state.fixtures || []
    return fixtures.find(f => f.id === fixtureId) || null
  })
  
  // 🔥 Calculate DMX base address
  const dmxBaseAddress = useMemo(() => {
    if (!fixture) return null
    // address is 1-based from show file
    return fixture.address || 1
  }, [fixture])
  
  const universe = fixture?.universe ?? 0
  
  // 🔥 Get channel list from fixture (WAVE 384: channels stored inline in FixtureV2)
  const channels: ChannelInfo[] = useMemo(() => {
    if (!fixture?.channels) return []
    return fixture.channels.map((ch: any, idx: number) => ({
      index: ch.index ?? idx,
      name: ch.name || `CH ${idx + 1}`,
      type: ch.type || 'unknown'
    }))
  }, [fixture])
  
  /**
   * Canales que el Arbiter entiende nativamente (tienen campo propio en ManualControls).
   * El resto va por phantomChannels para que el HAL los trate como passthrough.
   * Fuente de verdad: MasterArbiter.ts → NATIVE_CHANNELS set.
   */
  const ARBITER_NATIVE_CHANNELS = new Set([
    'dimmer', 'red', 'green', 'blue', 'pan', 'tilt',
    'zoom', 'focus', 'speed', 'color_wheel',
  ])

  /**
   * Envía un valor al Arbiter vía setManual.
   * NUNCA bypassa el Arbiter — sin sendDmxChannel, sin dmx.sendDirect.
   * 
   * Routing:
   *   - Canal nativo  → controls: { [type]: value }, channels: [type]
   *   - Canal phantom → controls: { phantomChannels: { [type]: value } }, channels: [type]
   * 
   * Esto evita el tug-of-war entre el TestPanel y el ciclo HAL a 30Hz
   * que causaba micro-oscilaciones en los motores de los cabezales.
   */
  const sendDirectDMX = useCallback(async (channelIndex: number, value: number) => {
    if (!fixtureId) {
      console.warn('[TestPanel] ⚠️ No fixture configured')
      return
    }

    const channelInfo = channels[channelIndex]
    const channelType = channelInfo?.type || 'unknown'

    if (channelType === 'unknown') {
      console.warn(`[TestPanel] ⚠️ Canal ${channelIndex} sin tipo definido — no se envía`)
      return
    }

    const isNative = ARBITER_NATIVE_CHANNELS.has(channelType)

    const controls: Record<string, unknown> = isNative
      ? { [channelType]: value }
      : { phantomChannels: { [channelType]: value } }

    console.log(`[TestPanel] 🎛️ Arbiter.setManual → ${channelType}=${value} (${isNative ? 'native' : 'phantom'})`)

    try {
      await window.lux.arbiter.setManual({
        fixtureIds: [fixtureId],
        controls: controls as Record<string, number>,
        channels: [channelType],
      })
    } catch (err) {
      console.error('[TestPanel] ❌ Arbiter.setManual falló:', err)
    }
  }, [fixtureId, channels])
  
  /**
   * 🔥 WAVE 1008: Scanner slider change
   * El estado local (UI) se actualiza siempre para que el slider sea fluido.
   * La llamada al backend se throttlea a ~30fps para no saturar el driver serial.
   */
  const handleScannerChange = useCallback((value: number) => {
    setScannerValue(value)
    const now = Date.now()
    if (now - lastSendTime.current >= THROTTLE_MS) {
      lastSendTime.current = now
      sendDirectDMX(scannerChannel, value)
    }
  }, [scannerChannel, sendDirectDMX])
  
  /**
   * 🔥 WAVE 1008: Quick test specific channel
   */
  const testChannel = useCallback((channelIndex: number, value: number) => {
    setScannerChannel(channelIndex)
    setScannerValue(value)
    sendDirectDMX(channelIndex, value)
  }, [sendDirectDMX])
  
  /**
   * Execute test action - NOW WITH DIRECT DMX!
   */
  const handleTest = useCallback(async (testType: TestType) => {
    if (!fixtureId || disabled || dmxBaseAddress === null) return
    
    // Toggle test off if same button pressed
    if (activeTest === testType) {
      setActiveTest(null)
      await handleBlackout()
      return
    }
    
    setActiveTest(testType)
    
    // 🔥 WAVE 1008: Use DIRECT DMX instead of Arbiter
    // Find channels by type
    const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
    const strobeIdx = channels.findIndex(c => c.type === 'strobe')
    const goboIdx = channels.findIndex(c => c.type === 'gobo')
    const colorWheelIdx = channels.findIndex(c => c.type === 'color_wheel')
    
    console.log(`[TestPanel] 🧪 ${testType?.toUpperCase()} test - channels: dimmer=${dimmerIdx}, strobe=${strobeIdx}, gobo=${goboIdx}, colorWheel=${colorWheelIdx}`)
    
    switch (testType) {
      case 'color':
        // Full white - just dimmer on
        if (dimmerIdx >= 0) sendDirectDMX(dimmerIdx, 255)
        if (colorWheelIdx >= 0) sendDirectDMX(colorWheelIdx, 0) // Open white
        break
        
      case 'strobe':
        // Strobe effect
        if (dimmerIdx >= 0) sendDirectDMX(dimmerIdx, 255)
        if (strobeIdx >= 0) sendDirectDMX(strobeIdx, 195)
        break
        
      case 'gobo':
        // Test gobo
        if (dimmerIdx >= 0) sendDirectDMX(dimmerIdx, 255)
        if (goboIdx >= 0) sendDirectDMX(goboIdx, 39)
        break
    }
  }, [fixtureId, disabled, activeTest, dmxBaseAddress, channels, sendDirectDMX])
  
  /**
   * Blackout - all off
   */
  const handleBlackout = useCallback(async () => {
    if (!fixtureId || dmxBaseAddress === null) return
    
    setActiveTest(null)
    
    // 🔥 WAVE 1008: Direct DMX blackout
    const dimmerIdx = channels.findIndex(c => c.type === 'dimmer')
    const strobeIdx = channels.findIndex(c => c.type === 'strobe')
    
    if (dimmerIdx >= 0) sendDirectDMX(dimmerIdx, 0)
    if (strobeIdx >= 0) sendDirectDMX(strobeIdx, 0)
    
    console.log(`[TestPanel] ⬛ Blackout on ${fixtureId}`)
  }, [fixtureId, dmxBaseAddress, channels, sendDirectDMX])
  
  /**
   * Reset fixture to default state
   */
  const handleReset = useCallback(async () => {
    if (!fixtureId) return
    
    setActiveTest(null)
    setScannerValue(0)
    
    // 🔥 Reset all channels to 0
    channels.forEach((ch, idx) => {
      sendDirectDMX(idx, 0)
    })
    
    console.log(`[TestPanel] 🔄 Reset ${fixtureId}`)
  }, [fixtureId, channels, sendDirectDMX])
  
  return (
    <div className={`test-panel ${disabled ? 'disabled' : ''}`}>
      <div className="panel-header">
        <span className="header-icon">🧪</span>
        <h3>TEST PANEL</h3>
        {dmxBaseAddress !== null && (
          <span className="dmx-badge">DMX {dmxBaseAddress}</span>
        )}
      </div>
      
      {/* � WAVE 1008: DMX SCANNER */}
      <div className="scanner-section">
        <button
          className={`scanner-toggle ${showScanner ? 'active' : ''}`}
          onClick={() => setShowScanner(!showScanner)}
          disabled={disabled}
        >
          🔬 DMX SCANNER {showScanner ? '▲' : '▼'}
        </button>
        
        {showScanner && (
          <div className="scanner-panel">
            {/* Channel selector */}
            <div className="scanner-channel-select">
              <label>Channel:</label>
              <select
                value={scannerChannel}
                onChange={(e) => {
                  setScannerChannel(Number(e.target.value))
                  setScannerValue(0)
                }}
                disabled={disabled}
              >
                {channels.map((ch) => (
                  <option key={ch.index} value={ch.index}>
                    CH{ch.index + 1}: {ch.name} ({ch.type})
                  </option>
                ))}
                {channels.length === 0 && (
                  <option value={0}>No channels</option>
                )}
              </select>
            </div>
            
            {/* Value slider */}
            <div className="scanner-slider-row">
              <input
                type="range"
                className="scanner-slider"
                min="0"
                max="255"
                value={scannerValue}
                onChange={(e) => handleScannerChange(Number(e.target.value))}
                disabled={disabled}
              />
              <span className="scanner-value">{scannerValue}</span>
            </div>
            
            {/* Quick value buttons */}
            <div className="scanner-quick-btns">
              {[0, 64, 127, 191, 255].map((v) => (
                <button
                  key={v}
                  className="quick-val-btn"
                  onClick={() => handleScannerChange(v)}
                  disabled={disabled}
                >
                  {v}
                </button>
              ))}
            </div>
            
            {/* Info */}
            <div className="scanner-info">
              → DMX {dmxBaseAddress !== null ? dmxBaseAddress + scannerChannel : '?'}
            </div>
          </div>
        )}
      </div>
      
      <div className="test-grid">
        {/* Test buttons */}
        <button
          className={`test-btn color ${activeTest === 'color' ? 'active' : ''}`}
          onClick={() => handleTest('color')}
          disabled={disabled}
          title="Test full white"
        >
          <span className="btn-icon">💡</span>
          <span className="btn-label">COLOR</span>
        </button>
        
        <button
          className={`test-btn strobe ${activeTest === 'strobe' ? 'active' : ''}`}
          onClick={() => handleTest('strobe')}
          disabled={disabled}
          title="Test strobe"
        >
          <span className="btn-icon">⚡</span>
          <span className="btn-label">STROBE</span>
        </button>
        
        <button
          className={`test-btn gobo ${activeTest === 'gobo' ? 'active' : ''}`}
          onClick={() => handleTest('gobo')}
          disabled={disabled}
          title="Test gobo"
        >
          <span className="btn-icon">🔘</span>
          <span className="btn-label">GOBO</span>
        </button>
        
        <button
          className="test-btn blackout"
          onClick={handleBlackout}
          disabled={disabled}
          title="All off"
        >
          <span className="btn-icon">⬛</span>
          <span className="btn-label">BLACKOUT</span>
        </button>
      </div>
      
      {/* Reset button */}
      <div className="test-actions">
        <button
          className="reset-btn"
          onClick={handleReset}
          disabled={disabled}
          title="Reset all channels to 0"
        >
          🔄 RESET ALL
        </button>
      </div>
      
      {/* Status */}
      {activeTest && (
        <div className="test-status">
          <span className="status-dot" />
          <span className="status-text">Testing {activeTest.toUpperCase()}</span>
        </div>
      )}
    </div>
  )
}

export default TestPanel
