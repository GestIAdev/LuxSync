/**
 * 📱 SIDEBAR - WAVE 428: Full System Navigation
 * 4 Stages + 2 Tools Architecture
 * Custom SVG icons - cyberpunk HUD aesthetic
 */

import React from 'react'
import { useNavigationStore, TABS, TabId } from '../../stores/navigationStore'
import { 
  IconDashboard, 
  IconConstruct,
  IconLiveStage, 
  IconCalibration,
  IconSetup,
  IconLuxCore 
} from './NavigationIcons'
import './Sidebar.css'

// WAVE 428: Colores por tab - 4 Stages + 2 Tools
const TAB_COLORS: Record<TabId, string> = {
  'dashboard': '#00fff0',    // Cian (Command Center)
  'constructor': '#a855f7',  // Purple (Build)
  'live': '#ff00ff',         // Magenta (Performance)
  'calibration': '#22d3ee',  // Cyan-400 (Hardware)
  'setup': '#84cc16',        // Lime (Config)
  'core': '#f59e0b',         // Naranja (AI Monitor)
}

// WAVE 428: Custom SVG Icons - 6 tabs
const TAB_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'bolt': IconDashboard,      // Dashboard (Command lightning)
  'construct': IconConstruct, // Constructor (wrench + fixture)
  'monitor': IconLiveStage,   // Live Stage (spotlights)
  'target': IconCalibration,  // Calibration (crosshair)
  'settings': IconSetup,      // Setup (gear + audio)
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
