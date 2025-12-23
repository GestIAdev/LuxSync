/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ MODE SWITCHER SLEEK - WAVE 63.9: Power Interlock
 * Horizontal spaceship-style mode selector with power state awareness
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useControlStore, GlobalMode } from '../../../../stores/controlStore'
import { useSystemPower } from '../../../../hooks/useSystemPower'
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
  
  // 🔌 WAVE 63.9: Power state interlock
  const { isOnline } = useSystemPower()
  
  // When system is OFF, no mode is visually active
  const visualActiveMode = isOnline ? globalMode : null
  
  // Handle mode selection - only works when system is ON
  const handleModeClick = (modeId: GlobalMode) => {
    if (!isOnline) return
    setGlobalMode(modeId)
  }
  
  return (
    <div className={`mode-switcher-sleek ${className} ${!isOnline ? 'system-offline' : ''}`}>
      <div className="switcher-label">CONTROL MODE</div>
      
      <div className="switcher-track">
        {/* Sliding indicator - hidden when offline */}
        {isOnline && visualActiveMode && (
          <div 
            className="switcher-indicator"
            style={{
              '--indicator-color': MODES.find(m => m.id === visualActiveMode)?.color || '#00ffff',
              transform: `translateX(${MODES.findIndex(m => m.id === visualActiveMode) * 100}%)`
            } as React.CSSProperties}
          />
        )}
        
        {/* Mode buttons */}
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-button ${visualActiveMode === mode.id ? 'active' : ''} ${!isOnline ? 'disabled' : ''}`}
            onClick={() => handleModeClick(mode.id)}
            disabled={!isOnline}
            style={{ '--mode-color': isOnline ? mode.color : '#444' } as React.CSSProperties}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-label">{mode.label}</span>
            <span className="mode-desc">{mode.description}</span>
          </button>
        ))}
      </div>
      
      {/* Active mode indicator line - dimmed when offline */}
      <div className="switcher-power-line">
        <div 
          className="power-fill"
          style={{ 
            '--power-color': isOnline && visualActiveMode 
              ? (MODES.find(m => m.id === visualActiveMode)?.color || '#00ffff')
              : '#222'
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

export default ModeSwitcherSleek
