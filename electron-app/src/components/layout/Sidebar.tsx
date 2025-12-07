/**
 * 📱 SIDEBAR - Commander Navigation Panel
 * WAVE 10.6: Night Shift Polish - Pro Icons + Real Data
 */

import React, { useEffect, useState } from 'react'
import { useNavigationStore, TABS, TabId } from '../../stores/navigationStore'
import { useAudioStore } from '../../stores/audioStore'
import { useDMXStore } from '../../stores/dmxStore'
import { useSeleneStore } from '../../stores/seleneStore'
import { Activity, Monitor, Sparkles, Settings, LucideIcon } from 'lucide-react'
import './Sidebar.css'

// Colores por tab
const TAB_COLORS: Record<TabId, string> = {
  'live': '#00fff0',     // Cian
  'setup': '#a855f7',    // Violeta  
  'simulate': '#ff00ff', // Magenta
  'selene': '#00ff88'    // Verde Selene
}

// 🎨 WAVE 10.6: Pro Icons (Lucide React)
const TAB_ICONS: Record<string, LucideIcon> = {
  'activity': Activity,
  'monitor': Monitor,
  'sparkles': Sparkles,
  'settings': Settings,
}

const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore()
  const { bpm, isConnected: audioConnected, level } = useAudioStore()
  const { isConnected: dmxConnected } = useDMXStore()
  const { brainConnected, mode } = useSeleneStore() // Use 'mode' instead of 'currentMode'
  
  // 🌪️ WAVE 11: DMX Watchdog status from IPC
  const [dmxStatus, setDmxStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
  const [dmxDeviceName, setDmxDeviceName] = useState<string | null>(null)
  
  // Suscribirse a eventos DMX
  useEffect(() => {
    if (!window.luxsync?.dmx?.onStatus) return
    
    const unsubscribe = window.luxsync.dmx.onStatus((status) => {
      setDmxStatus(status.state as any)
      if (status.device?.friendlyName) {
        setDmxDeviceName(status.device.friendlyName)
      }
    })
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])
  
  // Determinar estado DMX real (combina store + watchdog)
  const isDmxOk = dmxConnected || dmxStatus === 'connected'

  return (
    <aside className="sidebar">
      {/* Logo Area */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <span className="logo-moon">🌙</span>
          <span className="logo-stars">✨</span>
        </div>
        <h1 className="logo-text">LUXSYNC</h1>
        <span className="logo-version">v1.0</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="sidebar-nav">
        {TABS.map((tab) => {
          const IconComponent = TAB_ICONS[tab.icon]
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={`${tab.description} (${tab.shortcut})`}
              style={{
                '--tab-color': TAB_COLORS[tab.id]
              } as React.CSSProperties}
            >
              <span className="nav-icon">
                {IconComponent ? <IconComponent size={20} /> : tab.icon}
              </span>
              <span className="nav-label">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="sidebar-divider" />

      {/* Status Panel */}
      <div className="status-panel">
        <h3 className="status-title">STATUS</h3>
        
        {/* BPM Display */}
        <div className="status-item">
          <div className="status-item-row">
            <span className="status-icon">♪</span>
            <span className="status-value">{bpm.toFixed(0)} BPM</span>
          </div>
          <div className="mini-bar">
            <div 
              className="mini-bar-fill bpm-pulse" 
              style={{ width: `${Math.min(100, (bpm / 180) * 100)}%` }}
            />
          </div>
        </div>

        {/* Audio Level - REAL DATA */}
        <div className="status-item">
          <div className="status-item-row">
            <span className="status-icon">🎤</span>
            <span className={`status-value ${audioConnected ? 'active' : ''}`}>
              {level.toFixed(0)} dB
            </span>
          </div>
          <div className="mini-bar">
            <div 
              className="mini-bar-fill audio-level" 
              style={{ 
                width: `${Math.max(0, Math.min(100, ((level + 60) / 60) * 100))}%`,
                background: level > -10 ? '#ff4444' : level > -30 ? '#ffd700' : '#00ff88'
              }}
            />
          </div>
        </div>

        {/* DMX Status - REAL WATCHDOG */}
        <div className={`status-item dmx-status ${isDmxOk ? 'ok' : dmxStatus === 'reconnecting' ? 'reconnecting' : 'error'}`}>
          <div className="status-item-row">
            <span className={`status-dot ${isDmxOk ? 'connected' : dmxStatus === 'reconnecting' ? 'reconnecting' : 'disconnected'}`}>◉</span>
            <span className="status-label">
              {isDmxOk ? (dmxDeviceName || 'DMX OK') : 
               dmxStatus === 'reconnecting' ? 'Reconnecting...' : 'DMX OFF'}
            </span>
          </div>
        </div>

        {/* Selene Status */}
        <div className="status-item">
          <div className="status-item-row">
            <span className="status-icon">🌙</span>
            <span className={`status-value ${brainConnected ? 'active' : 'inactive'}`}>
              {brainConnected ? (mode === 'selene' ? 'SELENE' : mode === 'flow' ? 'FLOW' : 'LOCKED') : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="footer-text">LuxSync v1.0</span>
      </div>
    </aside>
  )
}

export default Sidebar
