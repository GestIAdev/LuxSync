/**
 * ⚙️ WAVE UX-1 + WAVE 2502: TACTICAL HUB — THE NERVE CENTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dropdown hub in the TitleBar that consolidates system tools:
 *   • Art-Net Discovery (migrated from standalone NetIndicator)
 *   • SYNC & TIMECODE — Clock Source selection + protocol controls (WAVE 2502)
 *   • MIDI Clock Master — Outbound clock generation (WAVE 2502)
 *   • [Future] OSC Configuration
 *   • [Future] sACN Bridge
 *   • [Future] System Diagnostics
 *
 * ARCHITECTURE:
 *   - Pill button "⚙️ HUB" in TitleBar → click toggles dropdown
 *   - Dropdown: glassmorphism cyberpunk panel, closes on outside click
 *   - Art-Net section: full discovery UI (start/stop/poll/node list)
 *   - Sync section: Clock source selector + protocol-specific controls
 *   - MIDI Master section: Outbound clock enable/output select
 *
 * @module components/layout/TacticalHub
 * @version WAVE 2502
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChronosEngine } from '../../chronos/core/ChronosEngine'
import type { ClockSourceType, SMPTETimecode, SMPTEFrameRate } from '../../chronos/core/ClockSource'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (mirror of ArtNetDiscovery.ts — same as NetIndicator)
// ═══════════════════════════════════════════════════════════════════════════

interface ArtNetNode {
  ip: string
  shortName: string
  longName: string
  mac: string
  firmwareVersion: number
  outputUniverses: number[]
  inputUniverses: number[]
  nodeStyle: number
  lastSeen: number
  responseCount: number
}

interface DiscoveryStatus {
  state: 'idle' | 'polling' | 'error'
  nodeCount: number
  nodes: ArtNetNode[]
  pollCount: number
  broadcastAddress: string
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC TYPES (WAVE 2502)
// ═══════════════════════════════════════════════════════════════════════════

/** UI-friendly clock source option */
interface ClockSourceOption {
  type: ClockSourceType
  label: string
  icon: string
  description: string
}

const CLOCK_SOURCE_OPTIONS: ClockSourceOption[] = [
  { type: 'internal',   label: 'INTERNAL',    icon: '⏱️', description: 'AudioContext / performance.now()' },
  { type: 'ltc-smpte',  label: 'SMPTE / LTC', icon: '🔊', description: 'Linear Timecode (Audio Input)' },
  { type: 'mtc',         label: 'MTC',         icon: '🎹', description: 'MIDI Time Code (HH:MM:SS:FF)' },
  { type: 'artnet-tc',   label: 'ART-NET TC',  icon: '📡', description: 'Art-Net Timecode (UDP 6454)' },
]

const FRAME_RATE_OPTIONS: SMPTEFrameRate[] = [24, 25, 29.97, 30]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getNodeStyleLabel(style: number): string {
  switch (style) {
    case 0: return 'Node'
    case 1: return 'Controller'
    case 2: return 'Media Server'
    case 3: return 'Route'
    case 4: return 'Backup'
    case 5: return 'Config'
    case 6: return 'Visual'
    default: return 'Unknown'
  }
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'ahora'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

/** Format SMPTE timecode as HH:MM:SS:FF */
function formatTimecode(tc: SMPTETimecode): string {
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(tc.hours)}:${pad2(tc.minutes)}:${pad2(tc.seconds)}:${pad2(tc.frames)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function TacticalHub() {
  // ── State ──
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // ── Art-Net Discovery State (migrated from NetIndicator) ──
  const [artnetStatus, setArtnetStatus] = useState<DiscoveryStatus>({
    state: 'idle',
    nodeCount: 0,
    nodes: [],
    pollCount: 0,
    broadcastAddress: '2.255.255.255',
  })
  const [isDiscoveryActive, setIsDiscoveryActive] = useState(false)

  // ── SYNC & TIMECODE State (WAVE 2502) ──
  const [activeClockSource, setActiveClockSource] = useState<ClockSourceType>('internal')
  const [isSourceSwitching, setIsSourceSwitching] = useState(false)
  const [sourceConnected, setSourceConnected] = useState(false)

  // LTC specific
  const [ltcAudioInputs, setLtcAudioInputs] = useState<Array<{ id: string; label: string }>>([])
  const [ltcSelectedInput, setLtcSelectedInput] = useState<string | null>(null)
  const [ltcFrameRate, setLtcFrameRate] = useState<SMPTEFrameRate>(25)
  const [ltcLevel, setLtcLevel] = useState(0) // 0-1 audio level for VU meter
  const [ltcTimecode, setLtcTimecode] = useState<SMPTETimecode>({ hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25 })
  const [ltcFramesDecoded, setLtcFramesDecoded] = useState(0)

  // MTC specific
  const [mtcInputs, setMtcInputs] = useState<Array<{ id: string; name: string }>>([])
  const [mtcSelectedInput, setMtcSelectedInput] = useState<string | null>(null)
  const [mtcTimecode, setMtcTimecode] = useState<SMPTETimecode>({ hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25 })

  // Art-Net TC specific
  const [artnetTcConnected, setArtnetTcConnected] = useState(false)

  // MIDI Clock Master (outbound, independent)
  const [midiMasterEnabled, setMidiMasterEnabled] = useState(false)
  const [midiMasterOutputs, setMidiMasterOutputs] = useState<Array<{ id: string; name: string; manufacturer: string }>>([])
  const [midiMasterSelectedOutput, setMidiMasterSelectedOutput] = useState<string>('')
  const [midiMasterPulses, setMidiMasterPulses] = useState(0)

  // Shared timecode display for active source
  const [liveTimecode, setLiveTimecode] = useState<SMPTETimecode>({ hours: 0, minutes: 0, seconds: 0, frames: 0, frameRate: 25 })

  // ── Refs for intervals ──
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ltcAnalyserRef = useRef<AnalyserNode | null>(null)
  const ltcLevelRafRef = useRef<number | null>(null)

  // ── Art-Net summary for pill badge ──
  const artnetNodeCount = artnetStatus.nodeCount
  const artnetState = artnetStatus.state

  // ═══════════════════════════════════════════════════════════════════════
  // ART-NET IPC EVENTS
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    const cleanups: Array<() => void> = []

    cleanups.push(
      api.onNodeDiscovered((node: ArtNetNode) => {
        setArtnetStatus(prev => ({
          ...prev,
          nodeCount: prev.nodeCount + 1,
          nodes: [...prev.nodes.filter(n => n.ip !== node.ip), node],
        }))
      })
    )

    cleanups.push(
      api.onNodeLost((ip: string) => {
        setArtnetStatus(prev => ({
          ...prev,
          nodeCount: Math.max(0, prev.nodeCount - 1),
          nodes: prev.nodes.filter(n => n.ip !== ip),
        }))
      })
    )

    cleanups.push(
      api.onNodeUpdated((node: ArtNetNode) => {
        setArtnetStatus(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.ip === node.ip ? node : n),
        }))
      })
    )

    cleanups.push(
      api.onStateChange((state: string) => {
        setArtnetStatus(prev => ({ ...prev, state: state as DiscoveryStatus['state'] }))
        setIsDiscoveryActive(state === 'polling')
      })
    )

    return () => cleanups.forEach(fn => fn())
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // SYNC & TIMECODE — POLLING + EVENTS (WAVE 2502)
  // ═══════════════════════════════════════════════════════════════════════

  // Poll live timecode & status from active source at ~15fps
  useEffect(() => {
    if (!isOpen) {
      if (syncPollRef.current) clearInterval(syncPollRef.current)
      syncPollRef.current = null
      return
    }

    syncPollRef.current = setInterval(() => {
      try {
        const engine = ChronosEngine.getInstance()
        const mgr = engine.getClockSources()
        const currentType = mgr.getActiveSourceType()
        setActiveClockSource(currentType)

        if (currentType === 'ltc-smpte') {
          const ltc = mgr.getLTC()
          setLtcTimecode(ltc.getTimecode())
          setLtcFramesDecoded(ltc.getFramesDecoded())
          setSourceConnected(ltc.isConnected())
          setLiveTimecode(ltc.getTimecode())
        } else if (currentType === 'mtc') {
          const mtc = mgr.getMTC()
          setMtcTimecode(mtc.getTimecode())
          setSourceConnected(mtc.isConnected())
          setLiveTimecode(mtc.getTimecode())
        } else if (currentType === 'artnet-tc') {
          const artnet = mgr.getArtNetTC()
          setArtnetTcConnected(artnet.isConnected())
          setSourceConnected(artnet.isConnected())
        } else {
          setSourceConnected(true) // internal always connected
        }

        // MIDI Master state
        const masterState = mgr.getMIDIMaster().getState()
        setMidiMasterEnabled(masterState.isRunning)
        setMidiMasterOutputs(masterState.availableOutputs)
        setMidiMasterPulses(masterState.pulsesSent)
      } catch { /* engine not yet initialized */ }
    }, 66) // ~15fps

    return () => {
      if (syncPollRef.current) clearInterval(syncPollRef.current)
      syncPollRef.current = null
    }
  }, [isOpen])

  // LTC Audio Level VU Meter — uses AnalyserNode to read RMS level
  useEffect(() => {
    if (activeClockSource !== 'ltc-smpte' || !isOpen) {
      if (ltcLevelRafRef.current) cancelAnimationFrame(ltcLevelRafRef.current)
      ltcLevelRafRef.current = null
      ltcAnalyserRef.current = null
      return
    }

    // Try to hook into the LTC decoder's audio context for level metering
    const pollLevel = () => {
      try {
        const engine = ChronosEngine.getInstance()
        const ltc = engine.getClockSources().getLTC() as any
        // Access internal audioContext and sourceNode if available
        if (ltc.audioContext && ltc.sourceNode && !ltcAnalyserRef.current) {
          const analyser = ltc.audioContext.createAnalyser()
          analyser.fftSize = 256
          ltc.sourceNode.connect(analyser)
          ltcAnalyserRef.current = analyser
        }

        if (ltcAnalyserRef.current) {
          const data = new Float32Array(ltcAnalyserRef.current.fftSize)
          ltcAnalyserRef.current.getFloatTimeDomainData(data)
          // RMS level
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
          const rms = Math.sqrt(sum / data.length)
          setLtcLevel(Math.min(1, rms * 5)) // scale up for visibility
        }
      } catch { /* not ready */ }
      ltcLevelRafRef.current = requestAnimationFrame(pollLevel)
    }
    pollLevel()

    return () => {
      if (ltcLevelRafRef.current) cancelAnimationFrame(ltcLevelRafRef.current)
      ltcLevelRafRef.current = null
      ltcAnalyserRef.current = null
    }
  }, [activeClockSource, isOpen])

  // ── Close on outside click ──
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        btnRef.current && !btnRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // ═══════════════════════════════════════════════════════════════════════
  // ART-NET ACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  const toggleDiscovery = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    if (isDiscoveryActive) {
      await api.stop()
      setIsDiscoveryActive(false)
      setArtnetStatus(prev => ({ ...prev, state: 'idle' }))
    } else {
      const result = await api.start()
      if (result?.success) {
        setIsDiscoveryActive(true)
        setArtnetStatus(prev => ({ ...prev, state: 'polling' }))
      }
    }
  }, [isDiscoveryActive])

  const refreshNodes = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return

    const freshStatus = await api.getStatus()
    if (freshStatus) {
      setArtnetStatus(freshStatus)
      setIsDiscoveryActive(freshStatus.state === 'polling')
    }
  }, [])

  const pollNow = useCallback(async () => {
    const api = (window as any).luxsync?.discovery
    if (!api) return
    await api.pollNow()
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // SYNC & TIMECODE ACTIONS (WAVE 2502)
  // ═══════════════════════════════════════════════════════════════════════

  const handleClockSourceChange = useCallback(async (type: ClockSourceType) => {
    setIsSourceSwitching(true)
    try {
      const engine = ChronosEngine.getInstance()
      await engine.setClockSource(type)
      setActiveClockSource(type)
      setSourceConnected(type === 'internal')

      // Populate device lists for the selected source
      if (type === 'ltc-smpte') {
        const ltc = engine.getClockSources().getLTC()
        const inputs = await ltc.getAudioInputs()
        setLtcAudioInputs(inputs)
      } else if (type === 'mtc') {
        const mtc = engine.getClockSources().getMTC()
        // MTC inputs become available after start()
        setTimeout(() => {
          setMtcInputs(mtc.getInputs())
        }, 300)
      }
    } catch (err) {
      console.error('[TacticalHub] Clock source change failed:', err)
    } finally {
      setIsSourceSwitching(false)
    }
  }, [])

  const handleLtcInputChange = useCallback((deviceId: string) => {
    setLtcSelectedInput(deviceId || null)
    try {
      const engine = ChronosEngine.getInstance()
      const ltc = engine.getClockSources().getLTC()
      ltc.setAudioInput(deviceId || null)
    } catch { /* not ready */ }
  }, [])

  const handleLtcFrameRateChange = useCallback((rate: SMPTEFrameRate) => {
    setLtcFrameRate(rate)
    try {
      const engine = ChronosEngine.getInstance()
      const ltc = engine.getClockSources().getLTC()
      ltc.setFrameRate(rate)
    } catch { /* not ready */ }
  }, [])

  const handleMtcInputChange = useCallback((deviceId: string) => {
    setMtcSelectedInput(deviceId || null)
    try {
      const engine = ChronosEngine.getInstance()
      const mtc = engine.getClockSources().getMTC()
      mtc.selectInput(deviceId || null)
    } catch { /* not ready */ }
  }, [])

  const handleMidiMasterToggle = useCallback(async () => {
    try {
      const engine = ChronosEngine.getInstance()
      const mgr = engine.getClockSources()
      const master = mgr.getMIDIMaster()

      if (midiMasterEnabled) {
        mgr.stopMIDIMaster()
        setMidiMasterEnabled(false)
      } else {
        await master.initialize()
        setMidiMasterOutputs(master.getOutputs())
        mgr.startMIDIMaster(120, true)
        setMidiMasterEnabled(true)
      }
    } catch (err) {
      console.error('[TacticalHub] MIDI Master toggle failed:', err)
    }
  }, [midiMasterEnabled])

  const handleMidiMasterOutputChange = useCallback((outputId: string) => {
    setMidiMasterSelectedOutput(outputId)
    try {
      const engine = ChronosEngine.getInstance()
      const master = engine.getClockSources().getMIDIMaster()
      master.setOutputs(outputId ? [outputId] : [])
    } catch { /* not ready */ }
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) refreshNodes()
      return !prev
    })
  }, [refreshNodes])

  // ═══════════════════════════════════════════════════════════════════════
  // DOT CLASS (Art-Net status dot on the pill)
  // ═══════════════════════════════════════════════════════════════════════

  const dotClass = artnetState === 'polling'
    ? (artnetNodeCount > 0 ? 'hub-dot hub-dot--active' : 'hub-dot hub-dot--polling')
    : artnetState === 'error'
      ? 'hub-dot hub-dot--error'
      : activeClockSource !== 'internal'
        ? (sourceConnected ? 'hub-dot hub-dot--active' : 'hub-dot hub-dot--polling')
        : 'hub-dot'

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ── HUB PILL BUTTON — uses .tb-pill base from TitleBar.css ── */}
      <button
        ref={btnRef}
        className={`tb-pill tb-pill--hub ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
        title="Tactical Hub — System tools & network"
      >
        <span className={dotClass} />
        <span className="tb-pill-label">HUB</span>
        {artnetNodeCount > 0 && (
          <span className="hub-pill-count">{artnetNodeCount}</span>
        )}
      </button>

      {/* ── DROPDOWN PANEL ── */}
      {isOpen && (
        <div className="hub-panel" ref={panelRef}>
          {/* Panel Header */}
          <div className="hub-panel-header">
            <span className="hub-panel-title">⚙️ TACTICAL HUB</span>
            <button className="hub-panel-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div className="hub-panel-body">
          {/* ═══ SECTION: ART-NET DISCOVERY ═══ */}
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">📡</span>
              <span className="hub-section-title">ART-NET DISCOVERY</span>
              <div className="hub-section-actions">
                <button
                  className="hub-action-btn"
                  onClick={pollNow}
                  title="Force poll now"
                  disabled={!isDiscoveryActive}
                >
                  ↻
                </button>
                <button
                  className={`hub-action-btn ${isDiscoveryActive ? 'active' : ''}`}
                  onClick={toggleDiscovery}
                  title={isDiscoveryActive ? 'Stop discovery' : 'Start discovery'}
                >
                  {isDiscoveryActive ? '■' : '▶'}
                </button>
              </div>
            </div>

            {/* Node List */}
            {artnetStatus.nodes.length === 0 ? (
              <div className="hub-section-empty">
                {isDiscoveryActive
                  ? 'Escaneando red...'
                  : 'Discovery inactivo — pulsa ▶ para iniciar'
                }
              </div>
            ) : (
              <div className="hub-node-list">
                {artnetStatus.nodes.map(node => (
                  <div key={node.ip} className="hub-node">
                    <div className="hub-node-row">
                      <span className="hub-node-name">
                        {node.shortName || node.ip}
                      </span>
                      <span className="hub-node-seen">{timeAgo(node.lastSeen)}</span>
                    </div>
                    <div className="hub-node-row">
                      <span className="hub-node-ip">{node.ip}</span>
                      <span className="hub-node-mac">{node.mac}</span>
                    </div>
                    <div className="hub-node-tags">
                      <span className="hub-node-tag">{getNodeStyleLabel(node.nodeStyle)}</span>
                      {node.outputUniverses.length > 0 && (
                        <span className="hub-node-tag hub-node-tag--uni">
                          OUT: {node.outputUniverses.join(', ')}
                        </span>
                      )}
                      {node.inputUniverses.length > 0 && (
                        <span className="hub-node-tag hub-node-tag--uni">
                          IN: {node.inputUniverses.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Art-Net Footer */}
            <div className="hub-section-footer">
              <span>Polls: {artnetStatus.pollCount}</span>
              <span>{artnetStatus.broadcastAddress}</span>
            </div>
          </div>

          {/* ═══ SECTION: SYNC & TIMECODE (WAVE 2502) ═══ */}
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">⏱️</span>
              <span className="hub-section-title">SYNC & TIMECODE</span>
              {activeClockSource !== 'internal' && (
                <span className={`hub-sync-badge ${sourceConnected ? 'hub-sync-badge--lock' : 'hub-sync-badge--seek'}`}>
                  {sourceConnected ? '🔒 LOCKED' : '🔍 SEEKING'}
                </span>
              )}
            </div>

            {/* ── Master Clock Source Selector ── */}
            <div className="hub-sync-selector">
              <label className="hub-sync-label">MASTER CLOCK SOURCE</label>
              <div className="hub-sync-grid">
                {CLOCK_SOURCE_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    className={`hub-sync-option ${activeClockSource === opt.type ? 'hub-sync-option--active' : ''}`}
                    onClick={() => handleClockSourceChange(opt.type)}
                    disabled={isSourceSwitching}
                    title={opt.description}
                  >
                    <span className="hub-sync-option-icon">{opt.icon}</span>
                    <span className="hub-sync-option-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Live Timecode Display (visible for non-internal sources) ── */}
            {activeClockSource !== 'internal' && (
              <div className="hub-timecode-display">
                <span className={`hub-timecode-value ${sourceConnected ? 'hub-timecode-value--active' : ''}`}>
                  {activeClockSource === 'artnet-tc'
                    ? (artnetTcConnected ? '● RECEIVING' : '○ WAITING')
                    : formatTimecode(activeClockSource === 'ltc-smpte' ? ltcTimecode : mtcTimecode)
                  }
                </span>
                {activeClockSource !== 'artnet-tc' && (
                  <span className="hub-timecode-fps">
                    @{(activeClockSource === 'ltc-smpte' ? ltcTimecode : mtcTimecode).frameRate} fps
                  </span>
                )}
              </div>
            )}

            {/* ── LTC/SMPTE Controls ── */}
            {activeClockSource === 'ltc-smpte' && (
              <div className="hub-sync-controls">
                {/* Audio Input Selector */}
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">Audio Input</label>
                  <select
                    className="hub-sync-select"
                    value={ltcSelectedInput ?? ''}
                    onChange={e => handleLtcInputChange(e.target.value)}
                  >
                    <option value="">Default</option>
                    {ltcAudioInputs.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Frame Rate Selector */}
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">Frame Rate</label>
                  <select
                    className="hub-sync-select"
                    value={ltcFrameRate}
                    onChange={e => handleLtcFrameRateChange(Number(e.target.value) as SMPTEFrameRate)}
                  >
                    {FRAME_RATE_OPTIONS.map(fr => (
                      <option key={fr} value={fr}>{fr} fps</option>
                    ))}
                  </select>
                </div>

                {/* VU Meter — Audio Level Indicator */}
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">Signal Level</label>
                  <div className="hub-vu-meter">
                    <div className="hub-vu-track">
                      <div
                        className={`hub-vu-fill ${ltcLevel > 0.7 ? 'hub-vu-fill--hot' : ltcLevel > 0.3 ? 'hub-vu-fill--warm' : ''}`}
                        style={{ width: `${Math.round(ltcLevel * 100)}%` }}
                      />
                    </div>
                    <span className="hub-vu-label">
                      {ltcLevel < 0.01 ? 'NO SIGNAL' : ltcLevel > 0.7 ? 'STRONG' : ltcLevel > 0.3 ? 'GOOD' : 'WEAK'}
                    </span>
                  </div>
                </div>

                {/* Frames decoded counter */}
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">Decoded</label>
                  <span className="hub-sync-value">{ltcFramesDecoded} frames</span>
                </div>
              </div>
            )}

            {/* ── MTC Controls ── */}
            {activeClockSource === 'mtc' && (
              <div className="hub-sync-controls">
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">MIDI Input</label>
                  <select
                    className="hub-sync-select"
                    value={mtcSelectedInput ?? ''}
                    onChange={e => handleMtcInputChange(e.target.value)}
                  >
                    <option value="">All Inputs</option>
                    {mtcInputs.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* ── Art-Net TC Controls ── */}
            {activeClockSource === 'artnet-tc' && (
              <div className="hub-sync-controls">
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">UDP Port</label>
                  <span className="hub-sync-value hub-sync-value--mono">6454</span>
                </div>
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">Status</label>
                  <span className={`hub-sync-value ${artnetTcConnected ? 'hub-sync-value--on' : ''}`}>
                    {artnetTcConnected ? '● ACTIVE — Receiving TC' : '○ LISTENING — Waiting for packets'}
                  </span>
                </div>
              </div>
            )}

            {/* Sync Footer */}
            <div className="hub-section-footer">
              <span>Source: {activeClockSource.toUpperCase()}</span>
              <span>{sourceConnected ? '🟢 SYNC' : '⚪ IDLE'}</span>
            </div>
          </div>

          {/* ═══ SECTION: MIDI CLOCK MASTER (WAVE 2502) ═══ */}
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🥁</span>
              <span className="hub-section-title">MIDI CLOCK OUTPUT</span>
              <div className="hub-section-actions">
                <button
                  className={`hub-action-btn hub-action-btn--toggle ${midiMasterEnabled ? 'active' : ''}`}
                  onClick={handleMidiMasterToggle}
                  title={midiMasterEnabled ? 'Stop MIDI Clock Output' : 'Start MIDI Clock Output'}
                >
                  {midiMasterEnabled ? '■' : '▶'}
                </button>
              </div>
            </div>

            <div className="hub-sync-controls">
              <div className="hub-sync-row">
                <label className="hub-sync-row-label">Enable</label>
                <button
                  className={`hub-toggle-switch ${midiMasterEnabled ? 'hub-toggle-switch--on' : ''}`}
                  onClick={handleMidiMasterToggle}
                  role="switch"
                  aria-checked={midiMasterEnabled}
                >
                  <span className="hub-toggle-knob" />
                  <span className="hub-toggle-label">{midiMasterEnabled ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="hub-sync-row">
                <label className="hub-sync-row-label">Output</label>
                <select
                  className="hub-sync-select"
                  value={midiMasterSelectedOutput}
                  onChange={e => handleMidiMasterOutputChange(e.target.value)}
                  disabled={!midiMasterEnabled}
                >
                  <option value="">All Outputs</option>
                  {midiMasterOutputs.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {midiMasterEnabled && (
                <div className="hub-sync-row">
                  <label className="hub-sync-row-label">Pulses</label>
                  <span className="hub-sync-value hub-sync-value--mono">{midiMasterPulses.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="hub-section-footer">
              <span>24 PPQ · Start/Stop/Continue</span>
              <span>{midiMasterEnabled ? '🟢 TX' : '⚪ OFF'}</span>
            </div>
          </div>

          {/* ═══ SECTION: FUTURE — OSC ═══ */}
          {/* 
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🔗</span>
              <span className="hub-section-title">OSC BRIDGE</span>
            </div>
            <div className="hub-section-empty">Próximamente</div>
          </div>
          */}

          {/* ═══ SECTION: FUTURE — sACN ═══ */}
          {/*
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🌐</span>
              <span className="hub-section-title">sACN BRIDGE</span>
            </div>
            <div className="hub-section-empty">Próximamente</div>
          </div>
          */}

          {/* ═══ SECTION: FUTURE — DIAGNOSTICS ═══ */}
          {/*
          <div className="hub-section">
            <div className="hub-section-header">
              <span className="hub-section-icon">🔬</span>
              <span className="hub-section-title">DIAGNOSTICS</span>
            </div>
            <div className="hub-section-empty">Próximamente</div>
          </div>
          */}
          </div>{/* end hub-panel-body */}

          {/* Panel Footer */}
          <div className="hub-panel-footer">
            WAVE 2502 · TACTICAL CLOCK HUB
          </div>
        </div>
      )}

      <style>{`
        /* ═══════════════════════════════════════════════════════════════ */
        /* HUB PILL — Cyan variant, extends .tb-pill from TitleBar.css   */
        /* ═══════════════════════════════════════════════════════════════ */
        .tb-pill--hub {
          border-color: rgba(0, 240, 255, 0.25);
          color: rgba(0, 240, 255, 0.5);
        }

        .tb-pill--hub:hover {
          border-color: rgba(0, 240, 255, 0.5);
          color: rgba(0, 240, 255, 0.8);
          background: rgba(0, 240, 255, 0.06);
          box-shadow: 0 0 14px rgba(0, 240, 255, 0.12);
        }

        .tb-pill--hub.active {
          border-color: rgba(0, 240, 255, 0.7);
          color: var(--accent-primary, #00ffff);
          background: rgba(0, 240, 255, 0.08);
          box-shadow: 0 0 24px rgba(0, 240, 255, 0.2);
        }

        .hub-pill-count {
          font-size: 0.55rem;
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          padding: 0 4px;
          border-radius: 3px;
          font-weight: 700;
        }

        /* ── Status Dot ── */
        .hub-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .hub-dot--polling {
          background: #f59e0b;
          box-shadow: 0 0 6px #f59e0b;
        }

        .hub-dot--active {
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          animation: hub-dot-pulse 2s ease-in-out infinite;
        }

        .hub-dot--error {
          background: #ef4444;
          box-shadow: 0 0 6px #ef4444;
        }

        @keyframes hub-dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ═══════════════════════════════════════════════════════════════ */
        /* DROPDOWN PANEL — Glassmorphism Cyberpunk                      */
        /* ═══════════════════════════════════════════════════════════════ */
        .hub-panel {
          position: fixed;
          top: 38px;
          left: 8px;
          width: 400px;
          max-height: calc(100vh - 56px);
          background: rgba(8, 8, 14, 0.96);
          backdrop-filter: blur(16px) saturate(1.3);
          border: 1px solid rgba(0, 240, 255, 0.2);
          border-radius: 12px;
          box-shadow:
            0 8px 40px rgba(0, 0, 0, 0.7),
            0 0 60px rgba(0, 240, 255, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          z-index: 99998;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: hub-panel-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hub-panel > .hub-section {
          overflow: visible;
        }

        /* Scrollable area between header and footer */
        .hub-panel-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 240, 255, 0.15) transparent;
        }

        .hub-panel-body::-webkit-scrollbar {
          width: 4px;
        }

        .hub-panel-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .hub-panel-body::-webkit-scrollbar-thumb {
          background: rgba(0, 240, 255, 0.15);
          border-radius: 2px;
        }

        .hub-panel-body::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 240, 255, 0.3);
        }

        @keyframes hub-panel-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Panel Header ── */
        .hub-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(0, 240, 255, 0.06), transparent);
          border-bottom: 1px solid rgba(0, 240, 255, 0.12);
        }

        .hub-panel-title {
          font-family: var(--font-mono, 'Orbitron', monospace);
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--accent-primary, #00ffff);
          letter-spacing: 0.12em;
          text-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
        }

        .hub-panel-close {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          font-size: 0.65rem;
          transition: all 0.15s ease;
        }

        .hub-panel-close:hover {
          border-color: rgba(255, 100, 100, 0.5);
          color: #ff6464;
          background: rgba(255, 100, 100, 0.08);
        }

        /* ── Section ── */
        .hub-section {
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .hub-section:last-of-type {
          border-bottom: none;
        }

        .hub-section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px 6px;
        }

        .hub-section-icon {
          font-size: 0.85rem;
        }

        .hub-section-title {
          flex: 1;
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: 0.1em;
        }

        .hub-section-actions {
          display: flex;
          gap: 4px;
        }

        .hub-action-btn {
          width: 24px;
          height: 24px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          background: transparent;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .hub-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary, #fff);
          border-color: rgba(255, 255, 255, 0.25);
        }

        .hub-action-btn:disabled {
          opacity: 0.25;
          cursor: not-allowed;
        }

        .hub-action-btn.active {
          border-color: #10b981;
          color: #10b981;
        }

        /* ── Section Empty ── */
        .hub-section-empty {
          padding: 20px 14px;
          text-align: center;
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.75rem;
          font-style: italic;
        }

        /* ── Section Footer ── */
        .hub-section-footer {
          display: flex;
          justify-content: space-between;
          padding: 4px 14px 8px;
          font-family: var(--font-mono, monospace);
          font-size: 0.55rem;
          color: rgba(255, 255, 255, 0.2);
        }

        /* ── Node List ── */
        .hub-node-list {
          max-height: 300px;
          overflow-y: auto;
          padding: 4px 10px 6px;
        }

        .hub-node-list::-webkit-scrollbar {
          width: 3px;
        }

        .hub-node-list::-webkit-scrollbar-thumb {
          background: rgba(0, 240, 255, 0.2);
          border-radius: 2px;
        }

        .hub-node {
          padding: 8px 10px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          margin-bottom: 4px;
          transition: all 0.15s ease;
        }

        .hub-node:hover {
          border-color: rgba(0, 240, 255, 0.15);
          background: rgba(0, 240, 255, 0.03);
        }

        .hub-node-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }

        .hub-node-row:last-child {
          margin-bottom: 0;
        }

        .hub-node-name {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
        }

        .hub-node-seen {
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.3);
          font-family: var(--font-mono, monospace);
        }

        .hub-node-ip {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          color: #60a5fa;
        }

        .hub-node-mac {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.25);
        }

        .hub-node-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .hub-node-tag {
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.04);
          padding: 1px 6px;
          border-radius: 3px;
          font-family: var(--font-mono, monospace);
        }

        .hub-node-tag--uni {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }

        /* ═══════════════════════════════════════════════════════════════ */
        /* SYNC & TIMECODE — WAVE 2502                                   */
        /* ═══════════════════════════════════════════════════════════════ */

        /* ── Sync Badge (LOCKED / SEEKING) ── */
        .hub-sync-badge {
          font-size: 0.55rem;
          font-family: var(--font-mono, monospace);
          padding: 1px 6px;
          border-radius: 3px;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .hub-sync-badge--lock {
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.2);
        }

        .hub-sync-badge--seek {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);
          animation: hub-dot-pulse 1.5s ease-in-out infinite;
        }

        /* ── Clock Source Selector ── */
        .hub-sync-selector {
          padding: 4px 14px 8px;
        }

        .hub-sync-label {
          display: block;
          font-size: 0.55rem;
          font-family: var(--font-mono, monospace);
          color: rgba(255, 255, 255, 0.35);
          letter-spacing: 0.12em;
          margin-bottom: 6px;
        }

        .hub-sync-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }

        .hub-sync-option {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0.65rem;
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .hub-sync-option:hover:not(:disabled) {
          border-color: rgba(0, 240, 255, 0.3);
          color: rgba(255, 255, 255, 0.8);
          background: rgba(0, 240, 255, 0.04);
        }

        .hub-sync-option--active {
          border-color: rgba(0, 240, 255, 0.6);
          color: var(--accent-primary, #00ffff);
          background: rgba(0, 240, 255, 0.08);
          box-shadow: 0 0 12px rgba(0, 240, 255, 0.12), inset 0 0 8px rgba(0, 240, 255, 0.05);
        }

        .hub-sync-option:disabled {
          opacity: 0.4;
          cursor: wait;
        }

        .hub-sync-option-icon {
          font-size: 0.85rem;
        }

        .hub-sync-option-label {
          flex: 1;
        }

        /* ── Live Timecode Display ── */
        .hub-timecode-display {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(0, 0, 0, 0.4);
          margin: 0 10px 6px;
          border-radius: 6px;
          border: 1px solid rgba(0, 240, 255, 0.1);
        }

        .hub-timecode-value {
          font-family: var(--font-mono, 'Orbitron', 'Courier New', monospace);
          font-size: 1.3rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.25);
          letter-spacing: 0.08em;
          text-shadow: none;
          transition: all 0.3s ease;
        }

        .hub-timecode-value--active {
          color: #00ffcc;
          text-shadow: 0 0 20px rgba(0, 255, 204, 0.4), 0 0 40px rgba(0, 255, 204, 0.15);
        }

        .hub-timecode-fps {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.25);
        }

        /* ── Sync Controls (rows of label + control) ── */
        .hub-sync-controls {
          padding: 4px 14px 8px;
        }

        .hub-sync-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
        }

        .hub-sync-row:last-child {
          margin-bottom: 0;
        }

        .hub-sync-row-label {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.4);
          letter-spacing: 0.06em;
          white-space: nowrap;
          min-width: 70px;
        }

        .hub-sync-select {
          flex: 1;
          padding: 4px 6px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.4);
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          cursor: pointer;
          transition: border-color 0.15s ease;
          outline: none;
          max-width: 200px;
        }

        .hub-sync-select:focus {
          border-color: rgba(0, 240, 255, 0.4);
        }

        .hub-sync-select:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .hub-sync-select option {
          background: #0a0a14;
          color: #ccc;
        }

        .hub-sync-value {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          color: rgba(255, 255, 255, 0.5);
        }

        .hub-sync-value--mono {
          color: #60a5fa;
        }

        .hub-sync-value--on {
          color: #10b981;
        }

        /* ── VU Meter ── */
        .hub-vu-meter {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hub-vu-track {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 3px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .hub-vu-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #22d3ee);
          border-radius: 3px;
          transition: width 0.08s linear;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.3);
        }

        .hub-vu-fill--warm {
          background: linear-gradient(90deg, #10b981, #f59e0b);
          box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
        }

        .hub-vu-fill--hot {
          background: linear-gradient(90deg, #f59e0b, #ef4444);
          box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
        }

        .hub-vu-label {
          font-family: var(--font-mono, monospace);
          font-size: 0.5rem;
          color: rgba(255, 255, 255, 0.3);
          letter-spacing: 0.08em;
          min-width: 60px;
          text-align: right;
        }

        /* ── Toggle Switch (MIDI Master On/Off) ── */
        .hub-toggle-switch {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 4px;
          width: 56px;
          height: 22px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .hub-toggle-switch--on {
          border-color: rgba(16, 185, 129, 0.5);
          background: rgba(16, 185, 129, 0.12);
        }

        .hub-toggle-knob {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transition: all 0.2s ease;
          position: absolute;
          left: 4px;
        }

        .hub-toggle-switch--on .hub-toggle-knob {
          left: calc(100% - 18px);
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }

        .hub-toggle-label {
          font-family: var(--font-mono, monospace);
          font-size: 0.5rem;
          color: rgba(255, 255, 255, 0.3);
          position: absolute;
          right: 6px;
          letter-spacing: 0.05em;
        }

        .hub-toggle-switch--on .hub-toggle-label {
          left: 6px;
          right: auto;
          color: #10b981;
        }

        /* ── MIDI Master Action Button ── */
        .hub-action-btn--toggle.active {
          border-color: #10b981;
          color: #10b981;
          background: rgba(16, 185, 129, 0.08);
        }

        /* ── Panel Footer ── */
        .hub-panel-footer {
          padding: 6px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          font-family: var(--font-mono, monospace);
          font-size: 0.5rem;
          color: rgba(0, 240, 255, 0.2);
          letter-spacing: 0.15em;
          text-align: center;
        }
      `}</style>
    </>
  )
}
