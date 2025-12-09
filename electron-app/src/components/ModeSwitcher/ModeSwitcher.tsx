/**
 * 🎚️ MODE SWITCHER - WAVE 13.6
 * Big visual mode selector (Flow, Selene, Locked)
 * Layout compacto para grid 2-1, iconos Lucide modernos
 * ✅ Conectado a seleneStore para persistencia entre vistas
 */

import React, { useEffect } from 'react'
import { Waves, Brain, Lock, LucideIcon } from 'lucide-react'
import { useSeleneStore } from '../../stores/seleneStore'
import './ModeSwitcher.css'

type SeleneMode = 'flow' | 'selene' | 'locked'

interface ModeOption {
  id: SeleneMode
  label: string
  Icon: LucideIcon
  color: string
  description: string
}

const MODES: ModeOption[] = [
  {
    id: 'flow',
    label: 'FLOW',
    Icon: Waves,
    color: '#00fff0', // Cyan
    description: 'Reactive - Beat sync'
  },
  {
    id: 'selene',
    label: 'SELENE',
    Icon: Brain,
    color: '#a855f7', // Purple
    description: 'AI - Musical consciousness'
  },
  {
    id: 'locked',
    label: 'LOCKED',
    Icon: Lock,
    color: '#64748b', // Slate
    description: 'Manual control'
  }
]

const ModeSwitcher: React.FC = () => {
  // 🔗 Conectar al store global de Selene (SOLO LECTURA - el backend actualiza vía IPC)
  const currentMode = useSeleneStore((state) => state.mode)

  // 🎯 Sincronizar con backend al montar
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const state = await window.lux.getFullState()
        if (state.selene.mode) {
          // Sincronizar modo inicial desde backend
          useSeleneStore.getState().setMode(state.selene.mode as SeleneMode)
          console.log(`[ModeSwitcher] 🔄 Synced initial mode from backend: ${state.selene.mode}`)
        }
      } catch (error) {
        console.warn('[ModeSwitcher] Could not fetch initial mode:', error)
      }
    }
    fetchMode()
  }, [])

  const handleModeChange = async (mode: SeleneMode) => {
    console.log(`[ModeSwitcher] 🎚️ Requesting mode change: ${currentMode} → ${mode}`)
    
    try {
      // 🎯 STATE OF TRUTH: Solo enviamos el comando, NO cambiamos el estado local
      // El estado solo cambiará cuando el Backend confirme vía evento IPC 'selene:mode-changed'
      const result = await window.lux.setMode(mode)
      
      if (result.success) {
        console.log(`[ModeSwitcher] ⏳ Mode change sent to backend, waiting for confirmation...`)
      } else {
        console.error('[ModeSwitcher] ❌ Backend rejected mode change:', result.error)
      }
    } catch (error) {
      console.error('[ModeSwitcher] ❌ Error sending mode change:', error)
    }
  }

  const activeMode = MODES.find(m => m.id === currentMode)

  return (
    <div className="mode-switcher">
      <div className="mode-switcher-header">
        <span className="mode-switcher-title">CONTROL MODE</span>
        <div className="mode-indicator" style={{ '--active-color': activeMode?.color } as React.CSSProperties}>
          <span className="active-label">ACTIVE:</span>
          <span className="active-value">{currentMode.toUpperCase()}</span>
        </div>
      </div>

      <div className="mode-options">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id
          const IconComponent = mode.Icon
          
          return (
            <button
              key={mode.id}
              className={`mode-option ${isActive ? 'active' : ''}`}
              onClick={() => handleModeChange(mode.id)}
              style={{ '--mode-color': mode.color } as React.CSSProperties}
            >
              <div className="mode-icon-wrapper">
                <IconComponent 
                  size={36} 
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className="mode-icon"
                />
              </div>
              <div className="mode-text">
                <span className="mode-label">{mode.label}</span>
                <span className="mode-description">{mode.description}</span>
              </div>
              
              {isActive && (
                <div className="active-indicator">
                  <span className="pulse-dot" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ModeSwitcher
