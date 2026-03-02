/**
 * 🧠 NEURAL COMMAND VIEW - WAVE 1167/1193/1194: CONSCIOUSNESS UNLEASHED
 * 
 * Centro de mando neural de Selene - Ahora con 3 sub-vistas especializadas:
 * 
 * 🎛️ SENSORY: Lo que Selene "siente" (Audio, Color, Context)
 * 🧠 CONSCIOUSNESS: Lo que Selene "piensa" (AI, Prediction, Dream, Ethics)
 * 📜 STREAM: Lo que Selene "dice" (Neural Log)
 * 
 * WAVE 1193: THE GREAT DIVIDE - Cada vista tiene el 100% del espacio disponible
 * WAVE 1194: CONSCIOUSNESS UNLEASHED - ConsciousnessView reemplaza al HUD legado
 */

import { useState, memo, useCallback, useEffect } from 'react'
import { useTruthSystem, useTruthConnected } from '../../../hooks'

// WAVE 1193: Sub-tab navigation
import { SubTabNavigation, type SubTabId } from './SubTabNavigation'

// WAVE 1193/1194: Specialized views
import { SensoryView } from '../SensoryView'
import { ConsciousnessView } from '../ConsciousnessView'

// Legacy components (NeuralStreamLog stays as-is)
import { NeuralStreamLog } from '../../telemetry/NeuralStreamLog'

// Icons
import { BrainNeuralIcon, LiveDotIcon } from '../../icons/LuxIcons'

import './NeuralCommandView.css'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${totalSeconds % 60}s`
  return `${totalSeconds}s`
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
  // WAVE 1193: Default to consciousness (the "brain" view)
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('consciousness')
  
  // Truth Store
  const connected = useTruthConnected()
  const system = useTruthSystem()
  
  const fps = system?.actualFPS?.toFixed(0) || '--'
  const mode = system?.mode?.toUpperCase() || 'OFFLINE'
  const uptime = system?.uptime ? formatUptime(system.uptime) : '0s'
  
  // Tab change handler
  const handleTabChange = useCallback((tab: SubTabId) => {
    setActiveSubTab(tab)
  }, [])
  
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
          WAVE 1193: SUB-TAB NAVIGATION
          ═══════════════════════════════════════════════════════════════════ */}
      <SubTabNavigation 
        activeTab={activeSubTab}
        onTabChange={handleTabChange}
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT - WAVE 1193: THE GREAT DIVIDE
          Each view gets 100% of available space
          ═══════════════════════════════════════════════════════════════════ */}
      <main className="ncv-content">
        {/* 🎛️ SENSORY VIEW */}
        {activeSubTab === 'sensory' && (
          <div className="ncv-view ncv-view--sensory" role="tabpanel" id="panel-sensory">
            <SensoryView />
          </div>
        )}
        
        {/* 🧠 CONSCIOUSNESS VIEW - WAVE 1194: UNLEASHED */}
        {activeSubTab === 'consciousness' && (
          <div className="ncv-view ncv-view--consciousness" role="tabpanel" id="panel-consciousness">
            <ConsciousnessView />
          </div>
        )}
        
        {/* 📜 STREAM VIEW */}
        {activeSubTab === 'stream' && (
          <div className="ncv-view ncv-view--stream" role="tabpanel" id="panel-stream">
            <NeuralStreamLog />
          </div>
        )}
      </main>
    </div>
  )
})

NeuralCommandView.displayName = 'NeuralCommandView'

export default NeuralCommandView
