/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ MODE SWITCHER SLEEK - WAVE 35: Cyberpunk Dashboard
 * Horizontal spaceship-style mode selector
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useControlStore, GlobalMode } from '../../../../stores/controlStore'
import './ModeSwitcherSleek.css'

interface ModeOption {
  id: GlobalMode
  label: string
  icon: string
  description: string
  color: string
}

const MODES: ModeOption[] = [
  {
    id: 'manual',
    label: 'MANUAL',
    icon: '🎚️',
    description: 'Direct Control',
    color: '#ffa500'
  },
  {
    id: 'flow',
    label: 'FLOW',
    icon: '🌊',
    description: 'Pattern Engine',
    color: '#00ffff'
  },
  {
    id: 'selene',
    label: 'SELENE',
    icon: '🌙',
    description: 'AI Intelligence',
    color: '#8a2be2'
  }
]

export const ModeSwitcherSleek: React.FC<{ className?: string }> = ({ className = '' }) => {
  const globalMode = useControlStore(state => state.globalMode)
  const setGlobalMode = useControlStore(state => state.setGlobalMode)
  
  return (
    <div className={`mode-switcher-sleek ${className}`}>
      <div className="switcher-label">CONTROL MODE</div>
      
      <div className="switcher-track">
        {/* Sliding indicator */}
        <div 
          className="switcher-indicator"
          style={{
            '--indicator-color': MODES.find(m => m.id === globalMode)?.color || '#00ffff',
            transform: `translateX(${MODES.findIndex(m => m.id === globalMode) * 100}%)`
          } as React.CSSProperties}
        />
        
        {/* Mode buttons */}
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-button ${globalMode === mode.id ? 'active' : ''}`}
            onClick={() => setGlobalMode(mode.id)}
            style={{ '--mode-color': mode.color } as React.CSSProperties}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-label">{mode.label}</span>
            <span className="mode-desc">{mode.description}</span>
          </button>
        ))}
      </div>
      
      {/* Active mode indicator line */}
      <div className="switcher-power-line">
        <div 
          className="power-fill"
          style={{ 
            '--power-color': MODES.find(m => m.id === globalMode)?.color || '#00ffff'
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

export default ModeSwitcherSleek
