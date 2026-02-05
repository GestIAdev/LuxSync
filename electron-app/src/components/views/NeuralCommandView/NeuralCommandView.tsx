/**
 * 🧠 NEURAL COMMAND VIEW - WAVE 1167
 * 
 * Centro de mando neural de Selene - Reemplaza LuxCoreView.
 * Conecta todos los paneles de telemetría nuevos:
 * - AudioSpectrumPanel
 * - ConsciousnessHUD  
 * - ChromaticCorePanel
 * - ContextMatrixPanel
 * - NeuralStreamLog
 */

import { useState, memo } from 'react'
import { useTruthSystem, useTruthConnected } from '../../../hooks'

// Nuevos componentes de telemetría WAVE 1167
import { AudioSpectrumPanel } from '../../telemetry/AudioSpectrumPanel'
import { ConsciousnessHUD } from '../../telemetry/ConsciousnessHUD'
import { ChromaticCorePanel } from '../../telemetry/ChromaticCorePanel'
import { ContextMatrixPanel } from '../../telemetry/ContextMatrixPanel'
import { NeuralStreamLog } from '../../telemetry/NeuralStreamLog'

// Icons
import { BrainNeuralIcon, LiveDotIcon, StreamLogIcon } from '../../icons/LuxIcons'

import './NeuralCommandView.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ViewTab = 'command' | 'logs'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function getModeColor(mode: string): string {
  switch (mode) {
    case 'selene': return 'var(--accent-primary)'
    case 'flow': return 'var(--accent-success)'
    case 'manual': return 'var(--accent-warning)'
    case 'off': return 'var(--text-muted)'
    default: return 'var(--text-secondary)'
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const NeuralCommandView = memo(() => {
  const [activeTab, setActiveTab] = useState<ViewTab>('command')
  
  // Truth Store
  const connected = useTruthConnected()
  const system = useTruthSystem()
  
  const fps = system?.actualFPS?.toFixed(0) || '--'
  const mode = system?.mode?.toUpperCase() || 'OFFLINE'
  const uptime = system?.uptime ? formatUptime(system.uptime) : '0s'
  
  return (
    <div className="neural-command-view">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="ncv-header">
        <div className="ncv-header__left">
          <BrainNeuralIcon size={24} color="var(--accent-primary)" />
          <h1 className="ncv-header__title">NEURAL COMMAND</h1>
          
          {/* Connection Status */}
          <div className={`ncv-status ${connected ? 'ncv-status--online' : 'ncv-status--offline'}`}>
            <LiveDotIcon size={8} color={connected ? 'var(--accent-success)' : 'var(--text-muted)'} />
            <span>{connected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
        
        <div className="ncv-header__stats">
          <div className="ncv-stat">
            <span className="ncv-stat__value">{fps}</span>
            <span className="ncv-stat__label">FPS</span>
          </div>
          <div className="ncv-stat">
            <span 
              className="ncv-stat__value" 
              style={{ color: getModeColor(system?.mode || '') }}
            >
              {mode}
            </span>
            <span className="ncv-stat__label">MODE</span>
          </div>
          <div className="ncv-stat">
            <span className="ncv-stat__value">{uptime}</span>
            <span className="ncv-stat__label">UPTIME</span>
          </div>
        </div>
      </header>
      
      {/* ═══════════════════════════════════════════════════════════════════
          TAB NAVIGATION
          ═══════════════════════════════════════════════════════════════════ */}
      <nav className="ncv-tabs">
        <button
          className={`ncv-tab ${activeTab === 'command' ? 'ncv-tab--active' : ''}`}
          onClick={() => setActiveTab('command')}
        >
          <BrainNeuralIcon size={14} />
          <span>COMMAND CENTER</span>
        </button>
        <button
          className={`ncv-tab ${activeTab === 'logs' ? 'ncv-tab--active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <StreamLogIcon size={14} />
          <span>NEURAL STREAM</span>
        </button>
      </nav>
      
      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT
          ═══════════════════════════════════════════════════════════════════ */}
      <main className="ncv-content">
        {activeTab === 'command' && (
          <div className="ncv-grid">
            {/* Row 1: Audio Spectrum + Consciousness HUD */}
            <div className="ncv-grid__row ncv-grid__row--top">
              <div className="ncv-grid__cell ncv-grid__cell--audio">
                <AudioSpectrumPanel />
              </div>
              <div className="ncv-grid__cell ncv-grid__cell--consciousness">
                <ConsciousnessHUD />
              </div>
            </div>
            
            {/* Row 2: Chromatic Core + Context Matrix */}
            <div className="ncv-grid__row ncv-grid__row--bottom">
              <div className="ncv-grid__cell ncv-grid__cell--chromatic">
                <ChromaticCorePanel />
              </div>
              <div className="ncv-grid__cell ncv-grid__cell--context">
                <ContextMatrixPanel />
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'logs' && (
          <div className="ncv-logs">
            <NeuralStreamLog />
          </div>
        )}
      </main>
    </div>
  )
})

NeuralCommandView.displayName = 'NeuralCommandView'

export default NeuralCommandView
