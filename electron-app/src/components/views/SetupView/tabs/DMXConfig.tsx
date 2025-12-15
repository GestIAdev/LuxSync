/**
 * 🔌 DMX CONFIG - DMX Output Configuration Panel
 * WAVE 26 Phase 2: DevicesTab Component
 * 
 * Features:
 * - Driver selector (Virtual/USB-Serial/ArtNet)
 * - COM Port dropdown with auto-detect
 * - Auto-connect toggle
 * - Rescan button
 * - Connection status
 */

import React, { useCallback, useState, useEffect } from 'react'
import { useTruthStore, selectHardware } from '../../../../stores/truthStore'
import { useSetupStore } from '../../../../stores/setupStore'
import './DMXConfig.css'

// Helper to access dmx API (typed in preload.ts but accessed dynamically)
const getDmxApi = () => (window as any).lux?.dmx

// ============================================
// TYPES
// ============================================

type DMXDriverType = 'virtual' | 'usb-serial' | 'artnet'

interface DriverOption {
  id: DMXDriverType
  icon: string
  label: string
  description: string
}

interface DetectedPort {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
  confidence: number
  chipType?: string
}

const DMX_DRIVERS: DriverOption[] = [
  { 
    id: 'virtual', 
    icon: '🎮', 
    label: 'Virtual', 
    description: 'Demo sin hardware' 
  },
  { 
    id: 'usb-serial', 
    icon: '🔌', 
    label: 'USB DMX', 
    description: 'FTDI, CH340, Enttec' 
  },
  { 
    id: 'artnet', 
    icon: '🌐', 
    label: 'ArtNet', 
    description: 'DMX over Ethernet' 
  },
]

// ============================================
// PORT SELECTOR
// ============================================

interface PortSelectorProps {
  ports: DetectedPort[]
  selectedPort: string | null
  onSelect: (port: string) => void
  onRescan: () => void
  isScanning: boolean
  autoConnect: boolean
  onAutoConnectChange: (auto: boolean) => void
}

const PortSelector: React.FC<PortSelectorProps> = ({
  ports,
  selectedPort,
  onSelect,
  onRescan,
  isScanning,
  autoConnect,
  onAutoConnectChange,
}) => {
  return (
    <div className="port-selector">
      <div className="port-header">
        <label className="port-label">COM PORT</label>
        <button 
          className={`rescan-btn ${isScanning ? 'scanning' : ''}`}
          onClick={onRescan}
          disabled={isScanning}
        >
          {isScanning ? '🔄' : '🔍'} {isScanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>
      
      {/* Auto-connect toggle */}
      <label className="auto-connect-toggle">
        <input
          type="checkbox"
          checked={autoConnect}
          onChange={(e) => onAutoConnectChange(e.target.checked)}
        />
        <span className="toggle-slider" />
        <span className="toggle-label">Auto-connect best device</span>
      </label>
      
      {/* Port dropdown */}
      <select 
        className="port-dropdown"
        value={selectedPort || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={autoConnect || ports.length === 0}
      >
        <option value="">-- Select Port --</option>
        {ports.map((port) => (
          <option key={port.path} value={port.path}>
            {port.path} - {port.chipType || port.manufacturer || 'Unknown'} 
            ({Math.round(port.confidence * 100)}%)
          </option>
        ))}
      </select>
      
      {ports.length === 0 && !isScanning && (
        <div className="no-ports-message">
          No DMX devices found. Click Rescan to search.
        </div>
      )}
    </div>
  )
}

// ============================================
// CONNECTION STATUS
// ============================================

interface ConnectionStatusProps {
  connected: boolean
  driver: string
  universe: number
  frameRate: number
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connected,
  driver,
  universe,
  frameRate,
}) => {
  return (
    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-indicator">
        <div className={`status-dot ${connected ? 'pulse' : ''}`} />
        <span className="status-text">
          {connected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>
      
      {connected && (
        <div className="status-details">
          <span className="detail-item">
            <span className="detail-label">Driver:</span>
            <span className="detail-value">{driver}</span>
          </span>
          <span className="detail-item">
            <span className="detail-label">Universe:</span>
            <span className="detail-value">{universe}</span>
          </span>
          <span className="detail-item">
            <span className="detail-label">FPS:</span>
            <span className="detail-value">{frameRate}</span>
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export const DMXConfig: React.FC = () => {
  const hardware = useTruthStore(selectHardware)
  const { 
    dmxDriver, 
    dmxComPort,
    detectedDmxPorts,
    isDmxScanning,
    setDmxDriver,
    setDmxPort,
    setDetectedDmxPorts,
    setDmxScanning,
  } = useSetupStore()
  
  const [autoConnect, setAutoConnect] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Current driver type
  const currentDriver = dmxDriver as DMXDriverType | null
  
  // Scan for ports
  const handleRescan = useCallback(async () => {
    setDmxScanning(true)
    setError(null)
    
    try {
      const dmxApi = getDmxApi()
      if (dmxApi?.listDevices) {
        const devices = await dmxApi.listDevices()
        console.log('[DMXConfig] Found devices:', devices)
        setDetectedDmxPorts(devices || [])
      }
    } catch (err) {
      console.error('[DMXConfig] Scan failed:', err)
      setError('Failed to scan for devices')
    } finally {
      setDmxScanning(false)
    }
  }, [setDmxScanning, setDetectedDmxPorts])
  
  // Auto-scan on mount
  useEffect(() => {
    if (currentDriver === 'usb-serial' && detectedDmxPorts.length === 0) {
      handleRescan()
    }
  }, [currentDriver])
  
  // Handle driver selection
  const handleDriverSelect = useCallback(async (driver: DMXDriverType) => {
    setDmxDriver(driver)
    setError(null)
    
    const dmxApi = getDmxApi()
    
    if (driver === 'virtual') {
      // Virtual = instant connect
      try {
        if (dmxApi?.connect) {
          await dmxApi.connect('virtual')
        }
        console.log('[DMXConfig] Virtual DMX connected')
      } catch (err) {
        console.error('[DMXConfig] Virtual connect failed:', err)
      }
      
    } else if (driver === 'usb-serial') {
      // Trigger scan
      handleRescan()
      
      // Try auto-connect if enabled
      if (autoConnect && dmxApi?.autoConnect) {
        try {
          const result = await dmxApi.autoConnect()
          console.log('[DMXConfig] Auto-connect result:', result)
        } catch (err) {
          console.warn('[DMXConfig] Auto-connect failed:', err)
        }
      }
      
    } else if (driver === 'artnet') {
      setError('ArtNet not yet implemented')
    }
  }, [setDmxDriver, autoConnect, handleRescan])
  
  // Handle port selection
  const handlePortSelect = useCallback(async (portPath: string) => {
    if (!portPath) return
    
    setDmxPort(portPath)
    setError(null)
    
    const dmxApi = getDmxApi()
    
    try {
      if (dmxApi?.connect) {
        await dmxApi.connect(portPath)
        console.log('[DMXConfig] Connected to:', portPath)
      }
    } catch (err) {
      console.error('[DMXConfig] Connect failed:', err)
      setError(`Failed to connect to ${portPath}`)
    }
  }, [setDmxPort])
  
  // Handle auto-connect toggle
  const handleAutoConnectChange = useCallback(async (auto: boolean) => {
    setAutoConnect(auto)
    
    const dmxApi = getDmxApi()
    
    if (auto && dmxApi?.autoConnect) {
      try {
        await dmxApi.autoConnect()
      } catch (err) {
        console.warn('[DMXConfig] Auto-connect failed:', err)
      }
    }
  }, [])
  
  return (
    <div className="dmx-config-panel">
      <div className="config-header">
        <h3>🔌 DMX OUTPUT</h3>
        <ConnectionStatus 
          connected={hardware.dmx.connected}
          driver={hardware.dmx.driver}
          universe={hardware.dmx.universe}
          frameRate={hardware.dmx.frameRate}
        />
      </div>
      
      {/* Driver Selector */}
      <div className="driver-selector">
        {DMX_DRIVERS.map((driver) => (
          <button
            key={driver.id}
            className={`driver-btn ${currentDriver === driver.id ? 'active' : ''}`}
            onClick={() => handleDriverSelect(driver.id)}
          >
            <span className="driver-icon">{driver.icon}</span>
            <div className="driver-info">
              <span className="driver-label">{driver.label}</span>
              <span className="driver-desc">{driver.description}</span>
            </div>
            {currentDriver === driver.id && (
              <span className="driver-check">✓</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      {/* Port selector (only for USB-Serial) */}
      {currentDriver === 'usb-serial' && (
        <PortSelector
          ports={detectedDmxPorts}
          selectedPort={dmxComPort}
          onSelect={handlePortSelect}
          onRescan={handleRescan}
          isScanning={isDmxScanning}
          autoConnect={autoConnect}
          onAutoConnectChange={handleAutoConnectChange}
        />
      )}
      
      {/* ArtNet placeholder */}
      {currentDriver === 'artnet' && (
        <div className="artnet-placeholder">
          <span>🌐 ArtNet configuration coming in WAVE 28</span>
        </div>
      )}
    </div>
  )
}

export default DMXConfig
