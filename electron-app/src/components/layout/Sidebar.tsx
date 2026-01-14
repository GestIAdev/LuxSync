/**
 * 📱 SIDEBAR - WAVE 423: Stage System Navigation
 * 3 Stages + 1 Tool Architecture
 * WAVE 423.1: Custom SVG icons - cyberpunk HUD aesthetic
 */

import React from 'react'
import { useNavigationStore, TABS, TabId } from '../../stores/navigationStore'
import { 
  IconDashboard, 
  IconLiveStage, 
  IconCalibration, 
  IconLuxCore 
} from './NavigationIcons'
import './Sidebar.css'

// WAVE 423: Colores por tab - 3 Stages + 1 Tool
const TAB_COLORS: Record<TabId, string> = {
  'dashboard': '#00fff0',    // Cian (Command Center)
  'live': '#ff00ff',         // Magenta (Performance)
  'calibration': '#22d3ee',  // Cyan-400 (Hardware)
  'core': '#f59e0b',         // Naranja (AI Monitor)
}

// WAVE 423.1: Custom SVG Icons - NO Lucide genéricos
const TAB_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'bolt': IconDashboard,      // Dashboard (Command lightning)
  'monitor': IconLiveStage,   // Live Stage (spotlights)
  'target': IconCalibration,  // Calibration (crosshair)
  'brain': IconLuxCore,       // LUX CORE (neural network)
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
