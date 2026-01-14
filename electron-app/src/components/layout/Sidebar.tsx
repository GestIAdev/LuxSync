/**
 * 📱 SIDEBAR - WAVE 428: OPERATION NEON POLISH
 * Cyberpunk Industrial Navigation
 * 
 * Layout: Flex column 100%
 *   ┌─ LOGO ─────────────────────┐
 *   ├─ STAGES (4) ───────────────┤ flex-start
 *   │  COMMAND → LIVE → CALIBRATE│
 *   │                            │
 *   ├─ SPACER ───────────────────┤ flex-grow: 1
 *   │                            │
 *   ├─ TOOLS (2) ────────────────┤ flex-end
 *   │  BUILD → LUX CORE → SETUP  │
 *   └────────────────────────────┘
 */

import React from 'react'
import { useNavigationStore, TABS, TabId, TabConfig } from '../../stores/navigationStore'
import { 
  IconDashboard, 
  IconConstruct,
  IconLiveStage, 
  IconCalibration,
  IconSetup,
  IconLuxCore 
} from './NavigationIcons'
import './Sidebar.css'

// WAVE 428: Colores por tab - Cyberpunk palette
const TAB_COLORS: Record<TabId, string> = {
  'dashboard': '#00fff0',    // Cian (Command Center)
  'live': '#ff00ff',         // Magenta (Performance) 
  'calibration': '#22d3ee',  // Cyan-400 (Hardware)
  'constructor': '#a855f7',  // Purple (Build)
  'core': '#f59e0b',         // Naranja (AI Monitor)
  'setup': '#84cc16',        // Lime (Config)
}

// WAVE 428: Custom SVG Icons mapping
const TAB_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'bolt': IconDashboard,      // Dashboard (Command lightning)
  'construct': IconConstruct, // Constructor (wrench + fixture)
  'monitor': IconLiveStage,   // Live Stage (spotlights)
  'target': IconCalibration,  // Calibration (crosshair)
  'settings': IconSetup,      // Setup (gear + audio)
  'brain': IconLuxCore,       // LUX CORE (neural network)
}

// Separar tabs por tipo
const STAGE_TABS = TABS.filter(t => t.type === 'stage')
const TOOL_TABS = TABS.filter(t => t.type === 'tool')

// Componente de Tab Individual
interface NavTabProps {
  tab: TabConfig
  isActive: boolean
  onClick: () => void
  variant: 'stage' | 'tool'
}

const NavTab: React.FC<NavTabProps> = ({ tab, isActive, onClick, variant }) => {
  const IconComponent = TAB_ICONS[tab.icon]
  
  return (
    <button
      className={`nav-tab ${variant} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={`${tab.description} (${tab.shortcut})`}
      style={{ '--tab-color': TAB_COLORS[tab.id] } as React.CSSProperties}
    >
      <span className="nav-glow" />
      <span className="nav-icon">
        {IconComponent ? <IconComponent size={18} /> : tab.icon}
      </span>
      <span className="nav-label">{tab.label}</span>
      {isActive && <span className="nav-indicator" />}
    </button>
  )
}

const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useNavigationStore()

  return (
    <aside className="sidebar">
      {/* ═══ LOGO ═══ */}
      <div className="sidebar-logo">
        <div className="logo-badge">
          <span className="logo-glyph">◈</span>
        </div>
        <div className="logo-text-group">
          <h1 className="logo-text">LUXSYNC</h1>
          <span className="logo-version">COMMANDER v1.0</span>
        </div>
      </div>

      {/* ═══ STAGES (Primary Navigation) ═══ */}
      <nav className="nav-block stages">
        <div className="nav-block-header">
          <span className="block-label">STAGES</span>
          <span className="block-line" />
        </div>
        <div className="nav-items">
          {STAGE_TABS.map((tab) => (
            <NavTab
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant="stage"
            />
          ))}
        </div>
      </nav>

      {/* ═══ SPACER ═══ */}
      <div className="nav-spacer" />

      {/* ═══ TOOLS (Secondary Navigation) ═══ */}
      <nav className="nav-block tools">
        <div className="nav-block-header">
          <span className="block-label">TOOLS</span>
          <span className="block-line" />
        </div>
        <div className="nav-items">
          {TOOL_TABS.map((tab) => (
            <NavTab
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant="tool"
            />
          ))}
        </div>
      </nav>

      {/* ═══ FOOTER ═══ */}
      <div className="sidebar-footer">
        <span className="footer-status">● ONLINE</span>
      </div>
    </aside>
  )
}

export default Sidebar
