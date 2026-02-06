/**
 * 🧭 SUB-TAB NAVIGATION - WAVE 1193: THE GREAT DIVIDE
 * 
 * Navegación de sub-tabs para el Neural Command Center.
 * Divide la vista en 3 secciones especializadas:
 * - SENSORY: Lo que Selene "siente"
 * - CONSCIOUSNESS: Lo que Selene "piensa"
 * - STREAM: Lo que Selene "dice"
 * 
 * Keyboard shortcuts: 1, 2, 3
 */

import React, { useEffect, useCallback, memo } from 'react'
import './SubTabNavigation.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SubTabId = 'sensory' | 'consciousness' | 'stream'

export interface SubTabConfig {
  id: SubTabId
  label: string
  icon: string
  shortcut: string
  description: string
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
    icon: '🎛️', 
    shortcut: '1',
    description: 'Audio & Color Input'
  },
  { 
    id: 'consciousness', 
    label: 'CONSCIOUSNESS', 
    icon: '🧠', 
    shortcut: '2',
    description: 'AI Decision Engine'
  },
  { 
    id: 'stream', 
    label: 'STREAM', 
    icon: '📜', 
    shortcut: '3',
    description: 'Neural Activity Log'
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
            <span className="subtab-nav__icon">{tab.icon}</span>
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
