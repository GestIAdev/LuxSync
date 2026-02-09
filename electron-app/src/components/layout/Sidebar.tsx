/**
 * 📱 SIDEBAR - WAVE 1110: THE GREAT UNBUNDLING
 * Cyberpunk Industrial Navigation - 7 Tabs (Forge as first-class citizen)
 * 
 * Layout: Flex column 100%
 *   ┌─ LOGO ─────────────────────┐
 *   ├─ STAGES (3) ───────────────┤ flex-start
 *   │  COMMAND → LIVE → CALIBRATE│
 *   │                            │
 *   ├─ SPACER ───────────────────┤ flex-grow: 1
 *   │                            │
 *   ├─ TOOLS (4) ────────────────┤ flex-end
 *   │  BUILD → FORGE → SETUP →   │
 *   │  LUX CORE                  │
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
  IconLuxCore,
  IconForge,  // 🔨 WAVE 1110: Forge icon
  IconChronos  // ⏱️ WAVE 2004: Chronos icon
} from './NavigationIcons'
import './Sidebar.css'

// WAVE 1110: Colores por tab - Cyberpunk palette (Forge = Amber/Orange)
// WAVE 2004: Chronos = Electric Blue (temporal/studio feel)
const TAB_COLORS: Record<TabId, string> = {
  'dashboard': '#00fff0',    // Cian (Command Center)
  'live': '#ff00ff',         // Magenta (Performance) 
  'calibration': '#22d3ee',  // Cyan-400 (Hardware)
  'chronos': '#3b82f6',      // Blue-500 (Chronos Studio) - WAVE 2004
  'constructor': '#a855f7',  // Purple (Build)
  'forge': '#f97316',        // Orange (The Blacksmith) - WAVE 1110
  'core': '#f59e0b',         // Amber (AI Monitor)
  'nexus': '#ef4444',
}

// WAVE 1110: Custom SVG Icons mapping (added forge)
// WAVE 2004: Added chronos icon
const TAB_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'bolt': IconDashboard,      // Dashboard (Command lightning)
  'construct': IconConstruct, // Constructor (wrench + fixture)
  'monitor': IconLiveStage,   // Live Stage (spotlights)
  'target': IconCalibration,  // Calibration (crosshair)
  'chronos': IconChronos,     // Chronos (clock + timeline) - WAVE 2004
  'plug': IconSetup,          // Nexus (reusing setup icon)
  'brain': IconLuxCore,       // LUX CORE (neural network)
  'forge': IconForge,         // Forge (hammer + anvil) - WAVE 1110
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
    <>
      {/* WAVE 428.6: INLINE CSS - Zen Mode compatible */}
      <style>{`
/* ═══ WAVE 428.6: ANCLAJE FORZADO + ZEN MODE FIX ═══ */
.sidebar-container {
  width: 240px !important;
  min-width: 240px !important;
  max-width: 240px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease !important;
}

/* WAVE 428.6: Zen Mode - Colapsar sidebar */
.sidebar-container.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.sidebar-container > * {
  width: 240px !important;
  min-width: 240px !important;
  max-width: 240px !important;
}

.main-layout {
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
}

/* WAVE 428.6: Layout content debe expandirse en Zen Mode */
.layout-content {
  flex: 1 !important;
  min-width: 0 !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* Zen Mode active - contenido full width */
.app-layout.zen-mode .layout-content {
  width: 100% !important;
}

/* ═══ SIDEBAR - CYBERPUNK INDUSTRIAL (WAVE 428.5: NO SCANNER) ═══ */
.sidebar {
  width: 240px !important;
  min-width: 240px !important;
  max-width: 240px !important;
  flex-shrink: 0;
  height: 100vh;
  background: #0a0a0a;
  border-right: 1px solid #1a1a1a;
  display: flex;
  flex-direction: column;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Scanner FULMINADO - Ya no existe */

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: linear-gradient(180deg, rgba(0, 255, 240, 0.05) 0%, transparent 100%);
  flex-shrink: 0;
}

.logo-badge {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #00fff0 0%, #00a8a0 100%);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  flex-shrink: 0;
}

.logo-glyph {
  font-size: 16px;
  color: #000;
  font-weight: 900;
}

.logo-text-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.logo-text {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 3px;
  color: #00fff0;
  text-shadow: 0 0 20px rgba(0, 255, 240, 0.4);
  margin: 0;
  line-height: 1;
}

.logo-version {
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 1.5px;
  font-weight: 500;
  text-transform: uppercase;
}

/* ═══ NAV BLOCKS - FIXED GAP ═══ */
.nav-block {
  padding: 12px 12px;
  flex-shrink: 0;
}

.nav-block.stages {
  padding-top: 16px;
}

.nav-block.tools {
  padding-bottom: 8px;
  margin-top: 30px;
  border-top: 2px solid rgba(0, 255, 240, 0.2);
  background: linear-gradient(180deg, rgba(0, 255, 240, 0.05) 0%, transparent 20%);
  position: relative;
}

/* Divider glow para TOOLS */
.nav-block.tools::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 20%;
  right: 20%;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #00fff0 50%, transparent 100%);
  box-shadow: 0 0 8px rgba(0, 255, 240, 0.6);
}

.nav-block-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 0 8px;
}

.block-label {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.25);
  text-transform: uppercase;
  white-space: nowrap;
}

.block-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* SPACER - REDUCIDO */
.nav-spacer {
  flex: 1;
  min-height: 20px;
  max-height: 40px;
}

/* ═══ NAV TABS ═══ */
.nav-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
  text-align: left;
}

.nav-glow {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 0;
  background: var(--tab-color, #00fff0);
  opacity: 0;
  transition: all 0.2s ease;
}

.nav-tab:hover {
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.7);
  border-left-color: rgba(255, 255, 255, 0.1);
}

.nav-tab:hover .nav-glow {
  width: 100%;
  opacity: 0.05;
}

.nav-tab.active {
  background: rgba(0, 255, 255, 0.08);
  border-left-color: var(--tab-color, #00fff0);
  border-left-width: 3px;
  color: var(--tab-color, #00fff0);
  box-shadow: inset 3px 0 0 var(--tab-color, #00fff0);
}

.nav-tab.active .nav-glow {
  width: 60%;
  opacity: 0.08;
}

.nav-tab.active .nav-icon {
  filter: drop-shadow(0 0 6px #00fff0);
  opacity: 1;
}

.nav-indicator {
  position: absolute;
  right: 8px;
  width: 4px;
  height: 4px;
  background: var(--tab-color, #00fff0);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--tab-color, #00fff0);
  animation: indicatorPulse 2s ease-in-out infinite;
}

@keyframes indicatorPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  transition: all 0.15s ease;
}

.nav-icon svg {
  width: 18px;
  height: 18px;
}

.nav-label {
  text-transform: uppercase;
  flex: 1;
}

.nav-tab.tool {
  padding: 10px 12px;
  font-size: 0.7rem;
}

.nav-tab.tool .nav-icon svg {
  width: 16px;
  height: 16px;
}

/* ═══ FOOTER ═══ */
.sidebar-footer {
  padding: 12px 16px;
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.footer-status {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: #22c55e;
  text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}
      `}</style>
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
    </>
  )
}

export default Sidebar
