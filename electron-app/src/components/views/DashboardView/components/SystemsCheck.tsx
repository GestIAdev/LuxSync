/**
 * 🎛️ SYSTEMS CHECK - WAVE 1203: THE ACCORDION MANEUVER
 * "Mission Control Pre-Flight Check"
 * 
 * WAVE 1203: Accordion Mutex behavior
 * - Audio/DMX sections are mutually exclusive (click to toggle)
 * - Visualizer ALWAYS visible in Audio header
 * - Recovers vertical space for 1080p
 * 
 * WAVE 1201: Segmented Controls instead of dropdowns
 * - Audio: [ SIMULATION ] [ SYSTEM ] [ MIC ]
 * - DMX: [ VIRTUAL ] [ USB ] [ ARTNET ]
 * - Config panels push content (no floating dropdowns)
 * 
 * WAVE 1003: Trinity audio integration
 * WAVE 686: ArtNet/USB panels
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useHardware, useAudio } from '../../../../stores/truthStore'
import { useSetupStore, selectUsbDmxPanel, selectSystemsCheckConfig } from '../../../../stores/setupStore'
import { useTrinityOptional } from '../../../../providers/TrinityProvider'
import { AudioWaveIcon, NetworkIcon, ControlsIcon } from '../../../icons/LuxIcons'
import { useShallow } from 'zustand/shallow'
import './SystemsCheck.css'

// 🎨 WAVE 686: ArtNet API access
const getArtnetApi = () => (window as any).luxsync?.artnet
const getDmxApi = () => (window as any).luxsync?.dmx

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type AudioSource = 'simulation' | 'system' | 'microphone' | 'off'
type DMXDriver = 'virtual' | 'usb-serial' | 'artnet'
type AccordionSection = 'audio' | 'dmx'

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
  // 🛡️ WAVE 2042.12: Use stable hook to prevent infinite loops (audio mutates every frame)
  const audio = useAudio()
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
  // 🛡️ WAVE 2042.13.2: Use stable selector to prevent infinite loops
  const { dmxComPort, detectedDmxPorts: rawDetectedPorts, isDmxScanning, setDmxPort, setDetectedDmxPorts, setDmxScanning } = useSetupStore(useShallow(selectUsbDmxPanel))
  // 🔥 Defensive: ensure detectedDmxPorts is always an array
  const detectedDmxPorts = Array.isArray(rawDetectedPorts) ? rawDetectedPorts : []
  const [autoConnect, setAutoConnect] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleRescan = useCallback(async () => {
    setDmxScanning(true)
    setError(null)
    
    try {
      const dmxApi = getDmxApi()
      if (dmxApi?.listDevices) {
        const response = await dmxApi.listDevices()
        
        // 🔥 Abrimos el sobre: Si viene con 'success', sacamos el array 'devices'.
        // Si por alguna razón histórica viene directo el array, lo tomamos tal cual.
        const portList = response?.success ? response.devices : (Array.isArray(response) ? response : [])
        
        setDetectedDmxPorts(portList || [])
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
      {/* WAVE 1203: Compact header - Auto-connect + Rescan inline */}
      <div className="usb-controls">
        <label className="usb-auto-toggle">
          <input
            type="checkbox"
            checked={autoConnect}
            onChange={(e) => handleAutoConnectChange(e.target.checked)}
          />
          <span className="usb-toggle-slider" />
          <span className="usb-toggle-label">Auto-connect</span>
        </label>
        
        <button 
          className={`usb-rescan-btn ${isDmxScanning ? 'scanning' : ''}`}
          onClick={handleRescan}
          disabled={isDmxScanning}
          title="Rescan ports"
        >
          {isDmxScanning ? '🔄' : '🔍'}
        </button>
      </div>
      
      <select 
        className="usb-port-dropdown"
        value={dmxComPort || ''}
        onChange={(e) => handlePortSelect(e.target.value)}
        disabled={autoConnect || detectedDmxPorts.length === 0}
      >
        <option value="">-- Select Port --</option>
        {detectedDmxPorts.map((port) => (
          <option key={port.path} value={port.path}>
            {port.path} {port.chipType ? `(${port.chipType})` : ''}
          </option>
        ))}
      </select>
      
      {error && <div className="usb-error">⚠️ {error}</div>}
      
      {detectedDmxPorts.length === 0 && !isDmxScanning && (
        <div className="usb-no-ports">No DMX devices found</div>
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
  // 🛡️ WAVE 2042.13.3: React 19 fix - Use stable selector to prevent infinite loops
  const { audioSource, dmxDriver, setAudioSource, setDmxDriver } = useSetupStore(useShallow(selectSystemsCheckConfig))
  // 🛡️ WAVE 2042.12: React 19 fix - Use stable hook to prevent infinite loops
  const hardware = useHardware()
  
  // 🪗 WAVE 1203: ACCORDION STATE (Mutex behavior - null = todas cerradas)
  const [activeSection, setActiveSection] = useState<AccordionSection | null>('dmx')
  
  const [isAudioConnecting, setIsAudioConnecting] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  
  // Connection status
  const [status, setStatus] = useState<SystemStatus>({
    audio: 'offline',
    dmx: hardware?.dmx?.connected ? 'online' : 'offline'
  })

  // 👻 WAVE 2021.1: Protocol badge (PRO / WORKER / OPEN-DMX)
  const [dmxProtocol, setDmxProtocol] = useState<string | null>(null)
  const [isDmxDisconnecting, setIsDmxDisconnecting] = useState(false)
  const [isDmxReconnecting, setIsDmxReconnecting] = useState(false)
  
  // 🪗 WAVE 1203: Toggle accordion (click mismo = cierra)
  const toggleSection = useCallback((section: AccordionSection) => {
    setActiveSection(prev => prev === section ? null : section)
  }, [])
  
  // 🔌 WAVE 3000 + 2021.1: Sync DMX status + protocol from REAL driver state via IPC
  useEffect(() => {
    const dmxApi = getDmxApi()

    const syncStatus = async () => {
      if (!dmxApi?.getStatus) return
      try {
        const res = await dmxApi.getStatus() as { connected: boolean; protocol?: string }
        setStatus(prev => ({ ...prev, dmx: res?.connected ? 'online' : 'offline' }))
        setDmxProtocol(res?.protocol ?? null)
      } catch { /* ignore */ }
    }

    syncStatus()
    
    // Live events from backend
    if (dmxApi?.onConnected) {
      dmxApi.onConnected(() => {
        setStatus(prev => ({ ...prev, dmx: 'online' }))
        syncStatus()  // re-query para obtener el protocolo detectado
      })
    }
    if (dmxApi?.onDisconnected) {
      dmxApi.onDisconnected(() => {
        setStatus(prev => ({ ...prev, dmx: 'offline' }))
        setDmxProtocol(null)
      })
    }
  }, [])
  
  // Update DMX status from truth (fallback for backends that push truth)
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
  
  // DMX driver options
  const dmxOptions: { id: DMXDriver; label: string; icon: string }[] = [
    { id: 'virtual', label: 'Virtual', icon: '🎮' },
    { id: 'usb-serial', label: 'USB DMX', icon: '🔌' },
    { id: 'artnet', label: 'ArtNet', icon: '🌐' },
  ]
  
  // 🔥 WAVE 1003: REAL AUDIO CONNECTION VIA TRINITY!
  const handleAudioChange = useCallback(async (source: AudioSource) => {
    setAudioError(null)
    
    // Guard: Trinity not ready
    if (!trinity) {
      console.warn('[SystemsCheck] Trinity not ready, storing selection only')
      setAudioSource(source)
      return
    }
    
    setIsAudioConnecting(true)
    
    try {
      if (source === 'off') {
        // ⛔ OFF — detener toda captura de audio. DMX sigue vivo para control manual.
        if (trinity) {
          trinity.stopAudio()
          trinity.setSimulating(false)
        }
        setAudioSource('off')
        console.log('[SystemsCheck] ⛔ Audio OFF — DMX remains LIVE')

      } else if (source === 'simulation') {
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
  
  // ─── WAVE 2021.1: DMX STOP / RECONNECT ──────────────────────────────────
  const handleDmxStop = useCallback(async () => {
    const dmxApi = getDmxApi()
    if (!dmxApi?.disconnect) return
    setIsDmxDisconnecting(true)
    try {
      await dmxApi.disconnect()
      setStatus(prev => ({ ...prev, dmx: 'offline' }))
      setDmxProtocol(null)
    } catch (err) {
      console.error('[SystemsCheck] DMX disconnect failed:', err)
    } finally {
      setIsDmxDisconnecting(false)
    }
  }, [])

  const handleDmxReconnect = useCallback(async () => {
    const dmxApi = getDmxApi()
    if (!dmxApi?.autoConnect) return
    setIsDmxReconnecting(true)
    try {
      await dmxApi.autoConnect()
      // El evento dmx:connected disparará syncStatus y actualizará el badge
    } catch (err) {
      console.error('[SystemsCheck] DMX reconnect failed:', err)
    } finally {
      setIsDmxReconnecting(false)
    }
  }, [])

  // 🔥 WAVE 1003: DMX DRIVER CHANGE WITH FULL CONNECTION
  const handleDmxChange = useCallback(async (driver: DMXDriver) => {
    setDmxDriver(driver)
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

  // Audio source options (sin 'off' — eso lo maneja el toggle master)
  const audioSourceOptions: { id: Exclude<AudioSource, 'off'>; label: string; icon: string }[] = [
    { id: 'simulation', label: 'Simulation', icon: '🎵' },
    { id: 'system', label: 'System Audio', icon: '🖥️' },
    { id: 'microphone', label: 'Microphone', icon: '🎤' },
  ]

  // KILL AUTO-AUDIO: ¿está el audio encendido? audioSource !== 'off' es el estado master.
  const isAudioOn = audioSource !== 'off'

  // Toggle master ON/OFF del audio
  const handleAudioToggle = useCallback(async () => {
    if (isAudioOn) {
      await handleAudioChange('off')
    } else {
      // Encender con la última fuente real, o simulation si venía de 'off'
      const lastRealSource: AudioSource =
        audioSource === 'off' ? 'simulation' : audioSource
      await handleAudioChange(lastRealSource)
    }
  }, [isAudioOn, audioSource, handleAudioChange])
  
  return (
    <div className="systems-check">
      {/* WAVE 1206: ICONIC HIERARCHY - Cyan ControlsIcon */}
      <div className="systems-header">
        <ControlsIcon size={16} color="#22d3ee" />
        <span className="systems-label">SYSTEMS CHECK</span>
      </div>
      
      {/* ════════════════════════════════════════════════════════════════════
          🎵 AUDIO INPUT — TOGGLE DURO ON/OFF + ACORDEÓN DE FUENTE
          El acordeón solo se abre si el audio está ON.
          OFF es el estado por defecto — sin auto-start.
          ════════════════════════════════════════════════════════════════════ */}
      <div className={`system-section ${isAudioOn ? 'audio-on' : 'audio-off'}`}>
        <div className="section-header audio-header">
          <div className="section-icon-badge audio">
            <AudioWaveIcon size={16} />
          </div>
          <span className={`section-title ${isAudioOn ? '' : 'dimmed'}`}>AUDIO IN</span>
          {/* Visualizer solo activo cuando hay captura */}
          {isAudioOn && (
            <div className="header-visualizer">
              <MiniVisualizer />
            </div>
          )}
          {/* TOGGLE MASTER ON/OFF — toda la lógica pasa por aquí */}
          <button
            className={`audio-power-toggle ${isAudioOn ? 'on' : 'off'} ${isAudioConnecting ? 'connecting' : ''}`}
            onClick={handleAudioToggle}
            disabled={isAudioConnecting}
            title={isAudioOn ? 'Apagar audio' : 'Activar audio'}
          >
            <span className="toggle-label">{isAudioConnecting ? '...' : isAudioOn ? 'ON' : 'OFF'}</span>
          </button>
          {/* Acordeón de fuente: solo cuando está ON */}
          {isAudioOn && (
            <span
              className={`accordion-arrow ${activeSection === 'audio' ? 'active' : ''}`}
              onClick={() => toggleSection('audio')}
            >
              {activeSection === 'audio' ? '▼' : '▶'}
            </span>
          )}
        </div>

        {/* Fuente de audio: solo accesible cuando está ON */}
        <div className={`section-content ${isAudioOn && activeSection === 'audio' ? 'expanded' : 'collapsed'}`}>
          <div className="legacy-button-group">
            {audioSourceOptions.map(opt => (
              <button
                key={opt.id}
                className={`legacy-btn ${audioSource === opt.id ? 'active' : ''} ${isAudioConnecting && audioSource === opt.id ? 'connecting' : ''}`}
                onClick={() => handleAudioChange(opt.id)}
                disabled={isAudioConnecting}
              >
                <span className="btn-icon">{opt.icon}</span>
                <span className="btn-label">{opt.label}</span>
              </button>
            ))}
          </div>

          {audioError && (
            <div className="system-error">⚠️ {audioError}</div>
          )}
        </div>
      </div>
      
      {/* ════════════════════════════════════════════════════════════════════
          📡 DMX OUTPUT — WAVE 1203: ACCORDION WITH CONFIG PANELS
          ════════════════════════════════════════════════════════════════════ */}
      <div className="system-section">
        <div 
          className={`section-header clickable ${activeSection === 'dmx' ? 'active' : 'inactive'}`}
          onClick={() => toggleSection('dmx')}
        >
          <div className="section-icon-badge dmx">
            <NetworkIcon size={16} />
          </div>
          <span className="section-title">DMX OUT</span>
          <div className={`status-indicator ${status.dmx}`}>
            <span className="status-dot" />
            <span className="status-text">
              {status.dmx === 'online' ? 'ONLINE' : 'OFFLINE'}
            </span>
            {/* 👻 WAVE 2021.1: Protocol badge */}
            {status.dmx === 'online' && dmxProtocol && (
              <span className={`dmx-protocol-badge dmx-protocol-badge--${dmxProtocol.toLowerCase()}`}>
                {dmxProtocol}
              </span>
            )}
          </div>
          {/* STOP / RESET DMX button — visible solo cuando está online */}
          {status.dmx === 'online' && (
            <button
              className="dmx-stop-btn"
              onClick={(e) => { e.stopPropagation(); handleDmxStop() }}
              disabled={isDmxDisconnecting}
              title="Kill DMX output — terminates Phantom Worker thread"
            >
              {isDmxDisconnecting
                ? <span className="dmx-stop-spinner">...</span>
                : <><span className="dmx-stop-icon">⏹</span><span className="dmx-stop-label">STOP</span></>}
            </button>
          )}
          {/* RECONNECT button — visible solo cuando está offline */}
          {status.dmx === 'offline' && (
            <button
              className="dmx-reconnect-btn"
              onClick={(e) => { e.stopPropagation(); handleDmxReconnect() }}
              disabled={isDmxReconnecting}
              title="Auto-reconnect DMX"
            >
              {isDmxReconnecting
                ? <span>🔄</span>
                : <><span className="dmx-reconnect-icon">↺</span><span className="dmx-reconnect-label">RESET</span></>}
            </button>
          )}
          <span className="accordion-arrow">{activeSection === 'dmx' ? '▼' : '▶'}</span>
        </div>
        
        {/* Collapsible Content */}
        <div className={`section-content ${activeSection === 'dmx' ? 'expanded' : 'collapsed'}`}>
          {/* Legacy Segmented Control */}
          <div className="legacy-button-group">
            {dmxOptions.map(opt => (
              <button
                key={opt.id}
                className={`legacy-btn ${dmxDriver === opt.id ? 'active' : ''}`}
                onClick={() => handleDmxChange(opt.id)}
              >
                <span className="btn-icon">{opt.icon}</span>
                <span className="btn-label">{opt.label}</span>
              </button>
            ))}
          </div>
          
          {/* Config Panels — Inside accordion */}
          {dmxDriver === 'artnet' && <ArtNetPanel />}
          {dmxDriver === 'usb-serial' && <UsbDmxPanel />}
        </div>
      </div>
    </div>
  )
}

export default SystemsCheck
