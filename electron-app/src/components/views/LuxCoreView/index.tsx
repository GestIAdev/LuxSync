/**
 * 🧠 LUX CORE VIEW - Brain Surgery & Monitoring Center
 * WAVE 14.3: Reestructuración Final - 2 tabs (MONITOR & LAB | LOGS)
 * 
 * Estructura:
 * - MONITOR & LAB: Grid asimétrico 1-2-1 (Audio | Hunt+Palette | DNA)
 * - LOGS: Consola táctica a pantalla completa
 */

import React, { useState, useEffect } from 'react'
import { initializeTelemetryIPC, useTelemetryStore } from '../../../stores/telemetryStore'
import { 
  AudioOscilloscope, 
  MusicalDNAPanel, 
  HuntMonitor, 
  PalettePreview 
} from '../../telemetry'
import { TacticalLog } from './TacticalLog'
import './LuxCoreView.css'

type SubTab = 'monitor-lab' | 'logs'

const LuxCoreView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('monitor-lab')
  const connected = useTelemetryStore((state) => state.connected)
  const session = useTelemetryStore((state) => state.session)
  
  // Initialize telemetry IPC on mount
  useEffect(() => {
    const cleanup = initializeTelemetryIPC()
    return cleanup
  }, [])
  
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000) % 60
    const minutes = Math.floor(ms / 60000) % 60
    const hours = Math.floor(ms / 3600000)
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  }

  return (
    <div className="lux-core-view">
      {/* Header */}
      <header className="core-header">
        <div className="header-left">
          <h1 className="core-title">
            <span className="title-icon">🧠</span>
            LUX CORE
          </h1>
          <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '● CONNECTED' : '○ OFFLINE'}
          </span>
        </div>
        
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-label">Uptime</span>
            <span className="stat-value">{formatUptime(session?.uptime || 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Frames</span>
            <span className="stat-value">{(session?.framesProcessed || 0).toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Mode</span>
            <span className={`stat-value mode-${session?.brainMode || 'reactive'}`}>
              {session?.brainMode?.toUpperCase() || 'REACTIVE'}
            </span>
          </div>
        </div>
      </header>
      
      {/* Sub-Tab Navigation */}
      <nav className="subtab-nav">
        <button 
          className={`subtab-btn ${activeSubTab === 'monitor-lab' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('monitor-lab')}
        >
          <span className="subtab-icon">📊</span>
          MONITOR & CONTROL
        </button>
        <button 
          className={`subtab-btn ${activeSubTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('logs')}
        >
          <span className="subtab-icon">📜</span>
          SYSTEM LOGS
        </button>
      </nav>
      
      {/* Content */}
      <div className="core-content">
        {activeSubTab === 'monitor-lab' && (
          <div className="monitor-lab-grid">
            {/* Col 1: Palette (NEW - Tiene TODO el espacio vertical) */}
            <div className="column-audio">
              <PalettePreview />
            </div>
            
            {/* Col 2-3: Cerebro (Hunt + Audio) */}
            <div className="column-cerebro">
              <div className="cerebro-top">
                <HuntMonitor />
              </div>
              <div className="cerebro-bottom">
                <AudioOscilloscope />
              </div>
            </div>
            
            {/* Col 4: Contexto (DNA) */}
            <div className="column-contexto">
              <MusicalDNAPanel />
            </div>
          </div>
        )}
        
        {activeSubTab === 'logs' && (
          <div className="logs-full">
            <TacticalLog />
          </div>
        )}
      </div>
    </div>
  )
}

export default LuxCoreView
