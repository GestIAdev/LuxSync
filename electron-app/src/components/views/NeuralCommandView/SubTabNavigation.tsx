/**
 * 🧭 SUB-TAB NAVIGATION - WAVE 1193: THE GREAT DIVIDE
 * 
 * Navegación de sub-tabs para el Neural Command Center.
 * Divide la vista en 3 secciones especializadas:
 * - SENSORY: Lo que Selene "siente"
 * - CONSCIOUSNESS: Lo que Selene "piensa"
 * - STREAM: Lo que Selene "dice"
 * 
 * 🧠 WAVE 1195: Custom LuxIcons + CSS transitions
 * Keyboard shortcuts: 1, 2, 3
 */

import React, { useEffect, useCallback, memo } from 'react'
// 🧠 WAVE 1195: Custom LuxIcons instead of emojis
import { 
  SpectrumBarsIcon,   // SENSORY 🎛️
  BrainNeuralIcon,    // CONSCIOUSNESS 🧠
  StreamLogIcon       // STREAM 📜
} from '../../icons/LuxIcons'
import './SubTabNavigation.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SubTabId = 'sensory' | 'consciousness' | 'stream'

export interface SubTabConfig {
  id: SubTabId
  label: string
  Icon: React.FC<{ size?: number; color?: string }>
  shortcut: string
  description: string
  color: string  // 🧠 WAVE 1195: Icon color when active
}

export interface SubTabNavigationProps {
  activeTab: SubTabId
  onTabChange: (tab: SubTabId) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const SUB_TABS: SubTabConfig[] = [
  { 
    id: 'sensory', 
    label: 'SENSORY', 
    Icon: SpectrumBarsIcon,
    shortcut: '1',
    description: 'Audio & Color Input',
    color: '#22d3ee'  // Cyan
  },
  { 
    id: 'consciousness', 
    label: 'CONSCIOUSNESS', 
    Icon: BrainNeuralIcon,
    shortcut: '2',
    description: 'AI Decision Engine',
    color: '#8b5cf6'  // Violet (primary)
  },
  { 
    id: 'stream', 
    label: 'STREAM', 
    Icon: StreamLogIcon,
    shortcut: '3',
    description: 'Neural Activity Log',
    color: '#22c55e'  // Green
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const SubTabNavigation: React.FC<SubTabNavigationProps> = memo(({
  activeTab,
  onTabChange
}) => {
  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Solo si no estamos en un input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }
    
    // Map shortcuts to tabs
    if (e.key === '1') onTabChange('sensory')
    if (e.key === '2') onTabChange('consciousness')
    if (e.key === '3') onTabChange('stream')
  }, [onTabChange])

  // Register keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <nav className="subtab-nav" role="tablist" aria-label="Neural Command Sections">
      {SUB_TABS.map((tab) => {
        const isActive = activeTab === tab.id
        const IconComponent = tab.Icon
        
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            className={`subtab-nav__tab ${isActive ? 'subtab-nav__tab--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={`${tab.description} (Press ${tab.shortcut})`}
          >
            {/* 🧠 WAVE 1195: Custom LuxIcon with color transition */}
            <span className="subtab-nav__icon">
              <IconComponent 
                size={16} 
                color={isActive ? tab.color : 'var(--text-muted)'} 
              />
            </span>
            <span className="subtab-nav__label">{tab.label}</span>
            <span className="subtab-nav__shortcut">{tab.shortcut}</span>
          </button>
        )
      })}
      
      {/* Active tab indicator */}
      <div 
        className="subtab-nav__indicator"
        style={{
          '--indicator-index': SUB_TABS.findIndex(t => t.id === activeTab)
        } as React.CSSProperties}
      />
    </nav>
  )
})

SubTabNavigation.displayName = 'SubTabNavigation'

export default SubTabNavigation
