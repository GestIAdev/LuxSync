/**
 * 🎛️ SYSTEMS CHECK - WAVE 437.2
 * "Mission Control Pre-Flight Check"
 * 
 * Quick status verification of Audio Input + DMX Output
 * NOW WITH RESURRECTED AUDIO REACTOR CORE!
 * 
 * Features:
 * - Audio device dropdown
 * - AUDIO REACTOR RING (The Heart!)
 * - DMX driver dropdown with connection status
 * - High z-index dropdowns (overlay friendly)
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useTruthStore, selectAudio, selectHardware } from '../../../../stores/truthStore'
import { useSetupStore } from '../../../../stores/setupStore'
import { AudioWaveIcon, NetworkIcon } from '../../../icons/LuxIcons'
import AudioReactorRing from './AudioReactorRing'
import './SystemsCheck.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type AudioSource = 'simulation' | 'system' | 'microphone'
type DMXDriver = 'virtual' | 'usb-serial' | 'artnet'

interface SystemStatus {
  audio: 'online' | 'offline' | 'error'
  dmx: 'online' | 'offline' | 'error'
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
// SYSTEMS CHECK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SystemsCheck: React.FC = () => {
  const { audioSource, dmxDriver, setAudioSource, setDmxDriver } = useSetupStore()
  const hardware = useTruthStore(selectHardware)
  
  const [audioDropdownOpen, setAudioDropdownOpen] = useState(false)
  const [dmxDropdownOpen, setDmxDropdownOpen] = useState(false)
  
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
  
  const handleAudioChange = useCallback((source: AudioSource) => {
    setAudioSource(source)
    setAudioDropdownOpen(false)
    // TODO: Connect to actual audio system via IPC
    console.log(`[SystemsCheck] Audio source: ${source}`)
  }, [setAudioSource])
  
  const handleDmxChange = useCallback((driver: DMXDriver) => {
    setDmxDriver(driver)
    setDmxDropdownOpen(false)
    // TODO: Connect to actual DMX system via IPC
    console.log(`[SystemsCheck] DMX driver: ${driver}`)
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
              className="dropdown-trigger"
              onClick={() => {
                setAudioDropdownOpen(!audioDropdownOpen)
                setDmxDropdownOpen(false)
              }}
            >
              <span className="trigger-icon">{currentAudio.icon}</span>
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
        
        {/* Mini Visualizer */}
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
      
      {/* ☢️ REACTOR CORE - BOTTOM (fills remaining space) - WAVE 437.5 */}
      <div className="reactor-core">
        <AudioReactorRing size={150} />
      </div>
    </div>
  )
}

export default SystemsCheck
