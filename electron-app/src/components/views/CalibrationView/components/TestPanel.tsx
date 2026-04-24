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

function clampDmx(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function buildHydratedScannerValues(
  channels: ChannelInfo[],
  state: {
    dimmer?: number | null
    color?: string | null
    pan?: number | null
    tilt?: number | null
    zoom?: number | null
    focus?: number | null
  } | null | undefined
): Record<number, number> {
  if (!state) return {}

  const hydrated: Record<number, number> = {}
  const rgb = state.color && /^#[0-9a-f]{6}$/i.test(state.color)
    ? {
        red: parseInt(state.color.slice(1, 3), 16),
        green: parseInt(state.color.slice(3, 5), 16),
        blue: parseInt(state.color.slice(5, 7), 16),
      }
    : null

  for (const channel of channels) {
    let value: number | null = null

    switch (channel.type) {
      case 'dimmer':
        value = state.dimmer != null ? clampDmx(state.dimmer * 2.55) : null
        break
      case 'red':
        value = rgb?.red ?? null
        break
      case 'green':
        value = rgb?.green ?? null
        break
      case 'blue':
        value = rgb?.blue ?? null
        break
      case 'pan':
        value = state.pan != null ? clampDmx((state.pan / 540) * 255) : null
        break
      case 'tilt':
        value = state.tilt != null ? clampDmx((state.tilt / 270) * 255) : null
        break
      case 'zoom':
        value = state.zoom != null ? clampDmx(state.zoom * 2.55) : null
        break
      case 'focus':
        value = state.focus != null ? clampDmx(state.focus * 2.55) : null
        break
    }

    if (value != null && value > 0) {
      hydrated[channel.index] = value
    }
  }

  return hydrated
}

export const TestPanel: React.FC<TestPanelProps> = ({
  fixtureId,
  disabled = false,
}) => {
  const dmxApi = (window as any).lux?.dmx
  const [activeTest, setActiveTest] = useState<TestType>(null)
  const [scannerValues, setScannerValues] = useState<Record<number, number>>({})
  const [showScanner, setShowScanner] = useState(false)
  
  // Throttle: el slider React actualiza el DOM a 60fps pero el IPC al backend
  // sólo dispara cada THROTTLE_MS. Coincide con el loop de TitanOrchestrator (40ms/25fps).
  const THROTTLE_MS = 40  // 25fps — sincronizado con el frame DMX-safe del Orchestrator
  const lastSendTime = useRef<number>(0)
  const scannerValuesRef = useRef<Record<number, number>>({})
  const sentScannerFrameRef = useRef<Record<number, number>>({})

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
   * WAVE 3479.3: RAW DMX BYPASS.
   * Envía un canal absoluto directo al hardware, sin pasar por Arbiter.
   */
  const sendDirectDMX = useCallback(async (channelIndex: number, value: number) => {
    if (!fixtureId || dmxBaseAddress === null) {
      console.warn('[TestPanel] ⚠️ No fixture configured')
      return
    }
    const absoluteAddress = dmxBaseAddress + channelIndex
    const clamped = Math.max(0, Math.min(255, Math.floor(value)))

    try {
      await dmxApi?.sendDirect(universe, absoluteAddress, clamped)
    } catch (err) {
      console.error('[TestPanel] ❌ DMX raw sendDirect falló:', err)
    }
  }, [dmxApi, fixtureId, dmxBaseAddress, universe])

  /**
   * Envía un frame combinado del scanner vía DMX crudo.
   * Usa diff contra el último frame enviado para apagar canales que fueron retirados.
   */
  const sendScannerFrame = useCallback(async (values: Record<number, number>, bypassThrottle = false) => {
    if (!fixtureId || dmxBaseAddress === null) return

    const now = Date.now()
    if (!bypassThrottle && now - lastSendTime.current < THROTTLE_MS) {
      return
    }
    lastSendTime.current = now

    const normalized: Record<number, number> = {}
    for (const [idx, raw] of Object.entries(values)) {
      const channelIndex = Number(idx)
      const value = Math.max(0, Math.min(255, Math.floor(raw)))
      if (value > 0) {
        normalized[channelIndex] = value
      }
    }

    const channelsToWrite = new Set<number>([
      ...Object.keys(sentScannerFrameRef.current).map(Number),
      ...Object.keys(normalized).map(Number),
    ])

    if (channelsToWrite.size === 0) return

    try {
      await Promise.all(
        Array.from(channelsToWrite).map(channelIndex => {
          const absoluteAddress = dmxBaseAddress + channelIndex
          const value = normalized[channelIndex] ?? 0
          return dmxApi?.sendDirect(universe, absoluteAddress, value)
        })
      )
      sentScannerFrameRef.current = normalized
    } catch (err) {
      console.error('[TestPanel] ❌ sendScannerFrame raw falló:', err)
    }
  }, [dmxApi, fixtureId, dmxBaseAddress, universe])

  useEffect(() => {
    if (!fixtureId) {
      scannerValuesRef.current = {}
      setScannerValues({})
      setActiveTest(null)
      return
    }

    let cancelled = false

    const hydrateFromArbiter = async () => {
      try {
        const result = await window.lux?.arbiter?.getFixturesState([fixtureId])
        if (cancelled) return

        const hydrated = result?.success
          ? buildHydratedScannerValues(channels, result.state)
          : {}

        scannerValuesRef.current = hydrated
        setScannerValues(hydrated)
        setActiveTest(null)
      } catch (err) {
        if (!cancelled) {
          console.error('[TestPanel] ❌ Hydration error:', err)
          scannerValuesRef.current = {}
          setScannerValues({})
          setActiveTest(null)
        }
      }
    }

    void hydrateFromArbiter()

    return () => {
      cancelled = true
    }
  }, [fixtureId, channels])

  useEffect(() => {
    return () => {
      const lastFrame = sentScannerFrameRef.current
      if (Object.keys(lastFrame).length === 0) return
      void Promise.all(
        Object.keys(lastFrame).map((idx) => {
          const absoluteAddress = (dmxBaseAddress ?? 1) + Number(idx)
          return dmxApi?.sendDirect(universe, absoluteAddress, 0)
        })
      )
    }
  }, [dmxApi, dmxBaseAddress, universe])

  /**
   * Actualiza un canal del scanner manteniendo el resto y envía trama combinada.
   */
  const handleChannelChange = useCallback((channelIndex: number, value: number) => {
    const updatedValues = { ...scannerValuesRef.current }
    if (value <= 0) {
      delete updatedValues[channelIndex]
    } else {
      updatedValues[channelIndex] = value
    }

    setScannerValues(updatedValues)
    scannerValuesRef.current = updatedValues

    void sendScannerFrame(updatedValues)
  }, [sendScannerFrame])
  
  /**
   * 🔥 WAVE 1008: Quick test specific channel
   */
  const testChannel = useCallback((channelIndex: number, value: number) => {
    const next = { ...scannerValuesRef.current }
    if (value <= 0) {
      delete next[channelIndex]
    } else {
      next[channelIndex] = value
    }
    setScannerValues(next)
    scannerValuesRef.current = next
    void sendDirectDMX(channelIndex, value)
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
        if (dimmerIdx >= 0) testChannel(dimmerIdx, 255)
        if (colorWheelIdx >= 0) testChannel(colorWheelIdx, 0) // Open white
        break
        
      case 'strobe':
        // Strobe effect
        if (dimmerIdx >= 0) testChannel(dimmerIdx, 255)
        if (strobeIdx >= 0) testChannel(strobeIdx, 195)
        break
        
      case 'gobo':
        // Test gobo
        if (dimmerIdx >= 0) testChannel(dimmerIdx, 255)
        if (goboIdx >= 0) testChannel(goboIdx, 39)
        break
    }
  }, [fixtureId, disabled, activeTest, dmxBaseAddress, channels, testChannel])
  
  /**
   * Blackout - all off
   */
  const handleBlackout = useCallback(async () => {
    if (!fixtureId || dmxBaseAddress === null) return
    
    setActiveTest(null)
    setScannerValues({})
    scannerValuesRef.current = {}
    
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
  const handleReset = useCallback(() => {
    if (!fixtureId) return
    
    setActiveTest(null)
    scannerValuesRef.current = {}
    setScannerValues({})
    void sendScannerFrame({}, true)
    
    console.log(`[TestPanel] 🔄 Reset ${fixtureId}`)
  }, [fixtureId, sendScannerFrame])
  
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
            {channels.map((ch) => {
              const channelValue = scannerValues[ch.index] || 0

              return (
                <div key={ch.index} className="scanner-channel-block">
                  <div className="scanner-channel-select">
                    <label>CH{ch.index + 1}: {ch.name} ({ch.type})</label>
                  </div>

                  <div className="scanner-slider-row">
                    <input
                      type="range"
                      className="scanner-slider"
                      min="0"
                      max="255"
                      value={channelValue}
                      onChange={(e) => handleChannelChange(ch.index, Number(e.target.value))}
                      disabled={disabled}
                    />
                    <span className="scanner-value">{channelValue}</span>
                  </div>

                  <div className="scanner-quick-btns">
                    {[0, 64, 127, 191, 255].map((v) => (
                      <button
                        key={`${ch.index}-${v}`}
                        className="quick-val-btn"
                        onClick={() => handleChannelChange(ch.index, v)}
                        disabled={disabled}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {channels.length === 0 && (
              <div className="scanner-info">No channels</div>
            )}
            
            {/* Info */}
            <div className="scanner-info">
              → DMX base {dmxBaseAddress ?? '?'} | canales activos: {Object.keys(scannerValues).length}
            </div>

            <button
              className="test-btn apply-now"
              onClick={() => void sendScannerFrame(scannerValues, true)}
              disabled={disabled}
              title="Force send current combined frame"
            >
              ⚡ APPLY FRAME NOW
            </button>
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
