/**
 * 🎛️ SYSTEMS CHECK - WAVE 1003
 * "Mission Control Pre-Flight Check"
 * 
 * Quick status verification of Audio Input + DMX Output
 * NOW WITH FULL TRINITY AUDIO INTEGRATION!
 * 
 * Features:
 * - Audio device dropdown WITH REAL TRINITY CONNECTION
 * - DMX driver dropdown with connection status
 * - INLINE ArtNet configuration
 * - USB DMX panel with port detection
 * - High z-index dropdowns (overlay friendly)
 * 
 * WAVE 686: Initial ArtNet config panel
 * WAVE 1003: Trinity audio integration + USB DMX driver
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useTruthStore, selectAudio, selectHardware } from '../../../../stores/truthStore'
import { useSetupStore } from '../../../../stores/setupStore'
import { useTrinityOptional } from '../../../../providers/TrinityProvider'
import { AudioWaveIcon, NetworkIcon } from '../../../icons/LuxIcons'
import './SystemsCheck.css'

// 🎨 WAVE 686: ArtNet API access
const getArtnetApi = () => (window as any).luxsync?.artnet
const getDmxApi = () => (window as any).lux?.dmx

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type AudioSource = 'simulation' | 'system' | 'microphone'
type DMXDriver = 'virtual' | 'usb-serial' | 'artnet'

interface SystemStatus {
  audio: 'online' | 'offline' | 'error'
  dmx: 'online' | 'offline' | 'error'
}

interface ArtNetStatus {
  state: 'disconnected' | 'ready' | 'sending' | 'error'
  ip: string
  port: number
  universe: number
  framesSent: number
  packetsDropped: number
  avgLatency: number
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI AUDIO VISUALIZER
// ═══════════════════════════════════════════════════════════════════════════

const MiniVisualizer: React.FC = () => {
  const audio = useTruthStore(selectAudio)
  const energy = audio?.energy || 0
  const bass = audio?.bass || 0
  const mid = audio?.mid || 0
  const treble = audio?.high || 0
  
  // Convert to bar heights (0-100%)
  const bars = [
    { height: bass * 100, color: '#ff0066' },
    { height: energy * 80, color: '#ff00ff' },
    { height: mid * 100, color: '#00ffff' },
    { height: energy * 90, color: '#00ff88' },
    { height: treble * 100, color: '#ffff00' },
  ]
  
  return (
    <div className="mini-visualizer">
      {bars.map((bar, i) => (
        <div 
          key={i}
          className="viz-bar"
          style={{ 
            height: `${Math.max(10, bar.height)}%`,
            backgroundColor: bar.color,
            boxShadow: `0 0 8px ${bar.color}60`
          }}
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 686: COMPACT ARTNET CONFIG PANEL
// ═══════════════════════════════════════════════════════════════════════════

const ArtNetPanel: React.FC = () => {
  const [ip, setIp] = useState<string>('255.255.255.255')
  const [port, setPort] = useState<number>(6454)
  const [universe, setUniverse] = useState<number>(1)
  const [status, setStatus] = useState<ArtNetStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // 🎯 WAVE 686.9: FIXED - Backend returns status directly, not wrapped in {success:...}
  useEffect(() => {
    const pollStatus = async () => {
      const artnetApi = getArtnetApi()
      if (artnetApi?.getStatus) {
        try {
          const result = await artnetApi.getStatus()
          // Backend returns status directly: {state, ip, port, universe, ...}
          // NOT wrapped in {success: true, ...}
          if (result && result.state) {
            const artnetStatus = result as ArtNetStatus
            setStatus(artnetStatus)
            
            // 🔥 Sync fields when backend is connected
            if (artnetStatus.state === 'ready' || artnetStatus.state === 'sending') {
              setIp(artnetStatus.ip)
              setPort(artnetStatus.port)
              setUniverse(artnetStatus.universe)
            }
          }
        } catch (err) {
          // Silent - polling error
        }
      }
    }
    
    // Poll immediately and then every 2s
    pollStatus()
    const interval = setInterval(pollStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    const artnetApi = getArtnetApi()
    if (artnetApi?.start) {
      try {
        await artnetApi.configure({ ip, port, universe })
        const result = await artnetApi.start()
        
        if (result.success) {
          setStatus(result.status)
        } else {
          setError(result.error || 'Failed to start ArtNet')
        }
      } catch (err) {
        setError('Failed: ' + String(err))
      }
    }

    setIsConnecting(false)
  }

  const handleDisconnect = async () => {
    const artnetApi = getArtnetApi()
    if (artnetApi?.stop) {
      await artnetApi.stop()
      setStatus(null)
    }
  }

  const isConnected = status?.state === 'ready' || status?.state === 'sending'

  return (
    <div className="artnet-panel">
      <div className="artnet-panel-row">
        <div className="artnet-field">
          <label>IP</label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="255.255.255.255"
            disabled={isConnected}
          />
        </div>
        <div className="artnet-field small">
          <label>Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            disabled={isConnected}
          />
        </div>
        <div className="artnet-field small">
          <label>Universe</label>
          <input
            type="number"
            value={universe}
            onChange={(e) => setUniverse(Number(e.target.value))}
            min={0}
            max={32767}
            disabled={isConnected}
          />
        </div>
      </div>

      {error && <div className="artnet-error">⚠️ {error}</div>}

      <div className="artnet-panel-footer">
        {!isConnected ? (
          <button 
            className="artnet-btn connect"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? '🔄' : '🚀'} {isConnecting ? 'Connecting...' : 'Start'}
          </button>
        ) : (
          <button 
            className="artnet-btn disconnect"
            onClick={handleDisconnect}
          >
            🛑 Stop
          </button>
        )}
        
        {status && isConnected && (
          <div className="artnet-stats">
            <span className="stat">📡 {status.framesSent.toLocaleString()}</span>
            <span className="stat">⚡ {status.avgLatency.toFixed(1)}ms</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 WAVE 686: COMPACT USB DMX PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface DetectedPort {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
  confidence: number
  chipType?: string
}

const UsbDmxPanel: React.FC = () => {
  const { dmxComPort, detectedDmxPorts, isDmxScanning, setDmxPort, setDetectedDmxPorts, setDmxScanning } = useSetupStore()
  const [autoConnect, setAutoConnect] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleRescan = useCallback(async () => {
    setDmxScanning(true)
    setError(null)
    
    try {
      const dmxApi = getDmxApi()
      if (dmxApi?.listDevices) {
        const devices = await dmxApi.listDevices()
        setDetectedDmxPorts(devices || [])
      }
    } catch (err) {
      setError('Scan failed')
    } finally {
      setDmxScanning(false)
    }
  }, [setDmxScanning, setDetectedDmxPorts])

  const handlePortSelect = useCallback(async (portPath: string) => {
    if (!portPath) return
    
    setDmxPort(portPath)
    setError(null)
    
    const dmxApi = getDmxApi()
    try {
      if (dmxApi?.connect) {
        await dmxApi.connect(portPath)
      }
    } catch (err) {
      setError(`Connect failed`)
    }
  }, [setDmxPort])

  const handleAutoConnectChange = useCallback(async (auto: boolean) => {
    setAutoConnect(auto)
    
    const dmxApi = getDmxApi()
    if (auto && dmxApi?.autoConnect) {
      try {
        await dmxApi.autoConnect()
      } catch (err) {
        console.warn('[UsbDmxPanel] Auto-connect failed:', err)
      }
    }
  }, [])

  // Auto-scan on mount
  useEffect(() => {
    if (detectedDmxPorts.length === 0) {
      handleRescan()
    }
  }, [])

  return (
    <div className="usb-panel">
      <div className="usb-panel-header">
        <label>COM PORT</label>
        <button 
          className={`usb-rescan-btn ${isDmxScanning ? 'scanning' : ''}`}
          onClick={handleRescan}
          disabled={isDmxScanning}
        >
          {isDmxScanning ? '🔄' : '🔍'}
        </button>
      </div>
      
      <label className="usb-auto-toggle">
        <input
          type="checkbox"
          checked={autoConnect}
          onChange={(e) => handleAutoConnectChange(e.target.checked)}
        />
        <span className="usb-toggle-slider" />
        <span className="usb-toggle-label">Auto-connect</span>
      </label>
      
      <select 
        className="usb-port-dropdown"
        value={dmxComPort || ''}
        onChange={(e) => handlePortSelect(e.target.value)}
        disabled={autoConnect || detectedDmxPorts.length === 0}
      >
        <option value="">-- Select Port --</option>
        {detectedDmxPorts.map((port) => (
          <option key={port.path} value={port.path}>
            {port.path} - {port.chipType || port.manufacturer || 'Unknown'}
          </option>
        ))}
      </select>
      
      {error && <div className="usb-error">⚠️ {error}</div>}
      
      {detectedDmxPorts.length === 0 && !isDmxScanning && (
        <div className="usb-no-ports">
          No DMX devices found
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEMS CHECK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SystemsCheck: React.FC = () => {
  // 🔥 WAVE 1003: Trinity integration for REAL audio connection
  const trinity = useTrinityOptional()
  const { audioSource, dmxDriver, setAudioSource, setDmxDriver } = useSetupStore()
  const hardware = useTruthStore(selectHardware)
  
  const [audioDropdownOpen, setAudioDropdownOpen] = useState(false)
  const [dmxDropdownOpen, setDmxDropdownOpen] = useState(false)
  const [isAudioConnecting, setIsAudioConnecting] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  
  // Connection status
  const [status, setStatus] = useState<SystemStatus>({
    audio: 'online',
    dmx: hardware?.dmx?.connected ? 'online' : 'offline'
  })
  
  // Update DMX status from truth
  useEffect(() => {
    setStatus(prev => ({
      ...prev,
      dmx: hardware?.dmx?.connected ? 'online' : 'offline'
    }))
  }, [hardware?.dmx?.connected])
  
  // 🔥 WAVE 1003: Update audio status from Trinity
  useEffect(() => {
    if (trinity?.state) {
      setStatus(prev => ({
        ...prev,
        audio: trinity.state.isAudioActive ? 'online' : 'offline'
      }))
    }
  }, [trinity?.state?.isAudioActive])
  
  // Audio source options
  const audioOptions: { id: AudioSource; label: string; icon: string }[] = [
    { id: 'simulation', label: 'Simulation', icon: '🎵' },
    { id: 'system', label: 'System Audio', icon: '🖥️' },
    { id: 'microphone', label: 'Microphone', icon: '🎤' },
  ]
  
  // DMX driver options
  const dmxOptions: { id: DMXDriver; label: string; icon: string }[] = [
    { id: 'virtual', label: 'Virtual', icon: '🎮' },
    { id: 'usb-serial', label: 'USB DMX', icon: '🔌' },
    { id: 'artnet', label: 'ArtNet', icon: '🌐' },
  ]
  
  // 🔥 WAVE 1003: REAL AUDIO CONNECTION VIA TRINITY!
  const handleAudioChange = useCallback(async (source: AudioSource) => {
    setAudioDropdownOpen(false)
    setAudioError(null)
    
    // Guard: Trinity not ready
    if (!trinity) {
      console.warn('[SystemsCheck] Trinity not ready, storing selection only')
      setAudioSource(source)
      return
    }
    
    setIsAudioConnecting(true)
    
    try {
      if (source === 'simulation') {
        // 🎵 Simulation mode - no hardware needed
        trinity.setSimulating(true)
        setAudioSource('simulation')
        console.log('[SystemsCheck] 🎵 Simulation mode activated')
        
      } else if (source === 'system') {
        // 🖥️ System Audio - WASAPI loopback
        await trinity.startSystemAudio()
        trinity.setSimulating(false)
        setAudioSource('system')
        console.log('[SystemsCheck] 🖥️ System Audio connected!')
        
      } else if (source === 'microphone') {
        // 🎤 Microphone input
        await trinity.startMicrophone()
        trinity.setSimulating(false)
        setAudioSource('microphone')
        console.log('[SystemsCheck] 🎤 Microphone connected!')
      }
      
      // Persist to config file
      if (window.lux?.saveConfig) {
        await window.lux.saveConfig({ audio: { source } } as any)
      }
      
    } catch (err) {
      console.error('[SystemsCheck] Audio connection failed:', err)
      setAudioError('Connection failed - using simulation')
      trinity.setSimulating(true)
      setAudioSource('simulation')
      
    } finally {
      setIsAudioConnecting(false)
    }
  }, [trinity, setAudioSource])
  
  // 🔥 WAVE 1003: DMX DRIVER CHANGE WITH FULL CONNECTION
  const handleDmxChange = useCallback(async (driver: DMXDriver) => {
    setDmxDriver(driver)
    setDmxDropdownOpen(false)
    console.log(`[SystemsCheck] DMX driver: ${driver}`)
    
    const dmxApi = getDmxApi()
    
    if (driver === 'virtual') {
      // 🎮 Virtual = instant connect
      try {
        if (dmxApi?.connect) {
          await dmxApi.connect('virtual')
          console.log('[SystemsCheck] 🎮 Virtual DMX connected')
        }
      } catch (err) {
        console.error('[SystemsCheck] Virtual connect failed:', err)
      }
    } else if (driver === 'usb-serial') {
      // 🔌 USB Serial - auto-scan and show panel
      try {
        if (dmxApi?.listDevices) {
          const devices = await dmxApi.listDevices()
          console.log('[SystemsCheck] 🔌 USB DMX scan found:', devices?.length || 0, 'devices')
          // UsbDmxPanel will handle the rest
        }
      } catch (err) {
        console.error('[SystemsCheck] USB scan failed:', err)
      }
    }
    // ArtNet: user configures in ArtNetPanel and clicks Start
    
    // Persist to config
    if (window.lux?.saveConfig) {
      await window.lux.saveConfig({ dmx: { driver } } as any)
    }
  }, [setDmxDriver])
  
  const currentAudio = audioOptions.find(o => o.id === audioSource) || audioOptions[0]
  const currentDmx = dmxOptions.find(o => o.id === dmxDriver) || dmxOptions[0]
  
  return (
    <div className="systems-check">
      <div className="systems-header">
        <span className="systems-icon">🛰️</span>
        <span className="systems-label">SYSTEMS CHECK</span>
      </div>
      
      {/* AUDIO INPUT SECTION - TOP */}
      <div className="system-row audio-system">
        <div className="system-info">
          <div className="system-icon-badge audio">
            <AudioWaveIcon size={16} />
          </div>
          <span className="system-name">AUDIO IN</span>
        </div>
        
        <div className="system-control">
          <div className="dropdown-wrapper">
            <button 
              className={`dropdown-trigger ${isAudioConnecting ? 'connecting' : ''}`}
              onClick={() => {
                setAudioDropdownOpen(!audioDropdownOpen)
                setDmxDropdownOpen(false)
              }}
              disabled={isAudioConnecting}
            >
              <span className="trigger-icon">
                {isAudioConnecting ? '🔄' : currentAudio.icon}
              </span>
              <span className="trigger-label">{currentAudio.label}</span>
              <span className="trigger-arrow">▼</span>
            </button>
            
            {audioDropdownOpen && (
              <div className="dropdown-menu">
                {audioOptions.map(opt => (
                  <button
                    key={opt.id}
                    className={`dropdown-item ${opt.id === audioSource ? 'active' : ''}`}
                    onClick={() => handleAudioChange(opt.id)}
                  >
                    <span className="item-icon">{opt.icon}</span>
                    <span className="item-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Audio Connection Status */}
        <div className={`status-indicator ${status.audio}`}>
          <span className="status-dot" />
          <span className="status-text">
            {status.audio === 'online' ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
      </div>
      
      {/* Audio Error Display */}
      {audioError && (
        <div className="system-error audio-error">
          ⚠️ {audioError}
        </div>
      )}
      
      {/* Mini Visualizer - Always visible */}
      <div className="audio-visualizer-row">
        <MiniVisualizer />
      </div>
      
      {/* DMX OUTPUT SECTION - MIDDLE (safe dropdown space) */}
      <div className="system-row dmx-system">
        <div className="system-info">
          <div className="system-icon-badge dmx">
            <NetworkIcon size={16} />
          </div>
          <span className="system-name">DMX OUT</span>
        </div>
        
        <div className="system-control">
          <div className="dropdown-wrapper">
            <button 
              className="dropdown-trigger"
              onClick={() => {
                setDmxDropdownOpen(!dmxDropdownOpen)
                setAudioDropdownOpen(false)
              }}
            >
              <span className="trigger-icon">{currentDmx.icon}</span>
              <span className="trigger-label">{currentDmx.label}</span>
              <span className="trigger-arrow">▼</span>
            </button>
            
            {dmxDropdownOpen && (
              <div className="dropdown-menu">
                {dmxOptions.map(opt => (
                  <button
                    key={opt.id}
                    className={`dropdown-item ${opt.id === dmxDriver ? 'active' : ''}`}
                    onClick={() => handleDmxChange(opt.id)}
                  >
                    <span className="item-icon">{opt.icon}</span>
                    <span className="item-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Connection Status */}
        <div className={`status-indicator ${status.dmx}`}>
          <span className="status-dot" />
          <span className="status-text">
            {status.dmx === 'online' ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
      
      {/* 🎨 WAVE 686: Config Panels - Show based on selected driver */}
      {dmxDriver === 'artnet' && <ArtNetPanel />}
      {dmxDriver === 'usb-serial' && <UsbDmxPanel />}
    </div>
  )
}

export default SystemsCheck
