/**
 * 🎚️ MODE SWITCHER - WAVE 13.6
 * Big visual mode selector (Flow, Selene, Locked)
 * Layout compacto para grid 2-1, iconos Lucide modernos
 * ✅ Conectado a seleneStore para persistencia entre vistas
 */

import React from 'react'
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
  
  // � HOTFIX: Prevenir clics duplicados/rápidos
  const [isChanging, setIsChanging] = React.useState(false)
  const lastClickTime = React.useRef(0)
  
  // �🐛 DEBUG: Log re-renders con stack trace
  const renderCount = React.useRef(0)
  renderCount.current++
  
  if (renderCount.current > 5) {
    console.warn(`[ModeSwitcher] 🔥 LOOP DETECTED! Render #${renderCount.current}`)
    console.trace('[ModeSwitcher] Stack trace:')
  } else {
    console.log(`[ModeSwitcher] 🔄 Render #${renderCount.current} with mode:`, currentMode)
  }

  // 🎯 NOTE: Sincronización inicial la hace TrinityProvider, NO este componente
  // Evita loops infinitos y duplicación de lógica

  const handleModeChange = async (mode: SeleneMode) => {
    // 🔥 HOTFIX: Prevenir clics duplicados (debounce 500ms)
    const now = Date.now()
    if (isChanging || (now - lastClickTime.current) < 500) {
      console.warn(`[ModeSwitcher] ⏸️ Ignoring duplicate click (too fast)`)
      return
    }
    
    lastClickTime.current = now
    setIsChanging(true)
    
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
    } finally {
      // Desbloquear después de 500ms
      setTimeout(() => setIsChanging(false), 500)
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
              disabled={isChanging}
              style={{ 
                '--mode-color': mode.color,
                opacity: isChanging ? 0.5 : 1,
                cursor: isChanging ? 'wait' : 'pointer'
              } as React.CSSProperties}
            >
              <div className="mode-icon-wrapper">
                <IconComponent 
                  size={32} 
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

// 🔥 HOTFIX: Usar React.memo para evitar re-renders innecesarios
// El parent component (LiveView, etc.) se re-renderiza a 30fps por los frames de audio
export default React.memo(ModeSwitcher)
