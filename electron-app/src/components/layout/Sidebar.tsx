/**
 * 📱 SIDEBAR - Commander Navigation Panel
 * WAVE 35: Cleaned up - Status moved to Dashboard
 */

import React from 'react'
import { useNavigationStore, TABS, TabId } from '../../stores/navigationStore'
import { Activity, Monitor, Settings, LucideIcon, Brain } from 'lucide-react'
import './Sidebar.css'

// Colores por tab
const TAB_COLORS: Record<TabId, string> = {
  'live': '#00fff0',     // Cian
  'setup': '#a855f7',    // Violeta  
  'simulate': '#ff00ff', // Magenta
  'core': '#f59e0b'      // Naranja (Orange-Amber) - LUX CORE
}

// 🎨 WAVE 10.6: Pro Icons (Lucide React)
const TAB_ICONS: Record<string, LucideIcon> = {
  'activity': Activity,
  'monitor': Monitor,
  'settings': Settings,
  'brain': Brain,
}

const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore()

  return (
    <aside className="sidebar">
      {/* Logo Area */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <span className="logo-moon">🌙</span>
          <span className="logo-stars">✨</span>
        </div>
        <h1 className="logo-text">LUXSYNC</h1>
        <span className="logo-version">v1.0</span>
      </div>

      {/* Navigation Tabs */}
      <nav className="sidebar-nav">
        {TABS.map((tab) => {
          const IconComponent = TAB_ICONS[tab.icon]
          return (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={`${tab.description} (${tab.shortcut})`}
              style={{
                '--tab-color': TAB_COLORS[tab.id]
              } as React.CSSProperties}
            >
              <span className="nav-icon">
                {IconComponent ? <IconComponent size={20} /> : tab.icon}
              </span>
              <span className="nav-label">{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Spacer to push footer down */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="footer-text">LuxSync v1.0</span>
      </div>
    </aside>
  )
}

export default Sidebar
