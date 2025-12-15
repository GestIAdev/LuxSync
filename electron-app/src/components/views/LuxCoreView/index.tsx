/**
 * 🧠 LUX CORE VIEW - Brain Surgery & Monitoring Center
 * WAVE 14.3: Reestructuración Final - 2 tabs (MONITOR & LAB | LOGS)
 * 🧠 WAVE 25.6: Migrado a truthStore para datos en tiempo real
 * 
 * Estructura:
 * - MONITOR & LAB: Grid asimétrico 1-2-1 (Audio | Hunt+Palette | DNA)
 * - LOGS: Consola táctica a pantalla completa
 */

import React, { useState } from 'react'
import { useTruthSystem, useTruthConnected } from '../../../hooks'
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
  
  // 🧠 WAVE 25.6: Use truthStore instead of telemetryStore
  const connected = useTruthConnected()
  const system = useTruthSystem()
  
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
            <span className="stat-label">FPS</span>
            <span className="stat-value">{system?.actualFPS?.toFixed(0) || '--'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Brain</span>
            <span className="stat-value">{system?.brainStatus?.toUpperCase() || 'IDLE'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Mode</span>
            <span className={`stat-value mode-${system?.mode || 'reactive'}`}>
              {system?.mode?.toUpperCase() || 'REACTIVE'}
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
