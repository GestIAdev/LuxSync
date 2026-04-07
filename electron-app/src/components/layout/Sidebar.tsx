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
import { useNavigationStore, TABS, TabId, TabConfig, selectSidebarNav } from '../../stores/navigationStore'
import { useLicenseStore } from '../../stores/licenseStore' // 🔒 WAVE 2500: Still needed for tab access control
import { useShallow } from 'zustand/shallow'
import { 
  IconDashboard, 
  IconConstruct,
  IconLiveStage, 
  IconCalibration,
  IconSetup,
  IconLuxCore,
  IconForge,        // 🔨 WAVE 1110: Forge icon
  IconChronos,      // ⏱️ WAVE 2004: Chronos icon
  IconHephaestus,   // ⚒️ WAVE 2030.3: Hephaestus icon
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
  'hephaestus': '#ff6b2b',   // Deep Orange/Ember (The God Forge) - WAVE 2030.3
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
  'hephaestus': IconHephaestus, // Hephaestus (anvil + bezier curves) - WAVE 2030.3
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
  locked?: boolean // 🔒 WAVE 2490: Tier-locked tab
}

const NavTab: React.FC<NavTabProps> = ({ tab, isActive, onClick, variant, locked }) => {
  const IconComponent = TAB_ICONS[tab.icon]
  
  return (
    <button
      className={`nav-tab ${variant} ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`}
      onClick={locked ? undefined : onClick}
      title={locked ? `🔒 ${tab.label} — Requiere Full Suite` : `${tab.description} (${tab.shortcut})`}
      style={{ '--tab-color': locked ? '#444' : TAB_COLORS[tab.id] } as React.CSSProperties}
      disabled={locked}
    >
      <span className="nav-glow" />
      <span className="nav-icon">
        {IconComponent ? <IconComponent size={18} /> : tab.icon}
      </span>
      <span className="nav-label">{tab.label}</span>
      {locked && <span className="nav-lock">🔒</span>}
      {isActive && !locked && <span className="nav-indicator" />}
    </button>
  )
}

const Sidebar: React.FC = () => {
  // 🛡️ WAVE 2042.13.4: Use stable selector to prevent infinite loops
  const { activeTab, setActiveTab } = useNavigationStore(useShallow(selectSidebarNav))
  // 🔒 WAVE 2490: License tier check — still needed for tab access control
  const isTabAllowed = useLicenseStore(s => s.isTabAllowed)

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
  /* ⚡ WAVE 2497: overflow hidden en el contenedor raíz — el scroll va
     en .sidebar-nav-scroll para que el footer con margin-top:auto
     se pegue siempre al fondo sin depender de position:sticky */
  overflow: hidden;
}

/* ⚡ WAVE 2497: Wrapper scrollable para los nav blocks.
   flex:1 consume todo el espacio sobrante entre el logo y el footer.
   El footer queda SIEMPRE visible en el último pixel sin scroll. */
.sidebar-nav-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Scanner FULMINADO - Ya no existe */

.sidebar-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  background: linear-gradient(180deg, rgba(0, 255, 240, 0.05) 0%, transparent 100%);
  flex-shrink: 0;
}

.sidebar-header img {
  width: 100%;
  max-width: 220px;
  height: auto;
  object-fit: contain;
}
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

/* 🔒 WAVE 2490: LOCKED TABS — Tier Separation */
.nav-tab.locked {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.nav-tab.locked .nav-icon {
  filter: grayscale(1);
}

.nav-lock {
  font-size: 0.6rem;
  margin-left: auto;
  opacity: 0.6;
}

/* ═══ FOOTER ═══ */
.sidebar-footer {
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(10, 10, 10, 0.95);
  /* ⚡ WAVE 2497: margin-top:auto + flex-shrink:0 = footer siempre en el fondo
     del contenedor flex principal. No depende de position:sticky ni de scroll. */
  flex-shrink: 0;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

/* 🔒 WAVE 2494: Badge inline (above TOOLS) */
.license-badge-inline {
  margin: 0 14px 6px;
}

.footer-status {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 1px;
  color: #22c55e;
  text-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

/* ═══ LICENSE BADGE — WAVE 2493: VISIBLE BY DESIGN ═══ */
.license-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.55);
  cursor: default;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.license-badge:hover {
  background: rgba(0, 0, 0, 0.75);
}

.license-badge.tier-full {
  border-color: rgba(0, 229, 255, 0.55);
  background: rgba(0, 229, 255, 0.06);
}

.license-badge.tier-full:hover {
  border-color: rgba(0, 229, 255, 0.8);
  background: rgba(0, 229, 255, 0.1);
}

.license-badge.tier-founder {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.06);
}

.license-badge.tier-founder:hover {
  border-color: rgba(251, 191, 36, 0.8);
  background: rgba(251, 191, 36, 0.1);
}

.license-badge.tier-loading {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  opacity: 0.5;
}

/* 🔒 WAVE 2496: Badge en footer — el nav-spacer empuja el footer al fondo */
.nav-block.tools {
  margin-top: 0;
}

/* El badge dentro del footer no necesita margin extra */
.sidebar-footer .license-badge {
  flex-shrink: 0;
}

.license-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: indicatorPulse 2.5s ease-in-out infinite;
}

.tier-full .license-dot {
  background: #00e5ff;
  box-shadow: 0 0 8px #00e5ff, 0 0 16px rgba(0, 229, 255, 0.4);
}

.tier-founder .license-dot {
  background: #fbbf24;
  box-shadow: 0 0 8px #fbbf24, 0 0 16px rgba(251, 191, 36, 0.4);
}

.license-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.license-tier {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  line-height: 1;
}

.tier-full .license-tier { color: #00e5ff; text-shadow: 0 0 6px rgba(0, 229, 255, 0.6); }
.tier-founder .license-tier { color: #fbbf24; text-shadow: 0 0 6px rgba(251, 191, 36, 0.6); }

.license-label {
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.8px;
  text-transform: uppercase;
  line-height: 1;
}

.license-key-icon {
  margin-left: auto;
  font-size: 0.8rem;
  opacity: 0.85;
}

/* ═══ GESTIADEV SEAL ═══ */
.gestiadev-seal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding-top: 4px;
  border-top: 1px solid rgba(255,255,255,0.04);
  opacity: 0.25;
  transition: opacity 0.2s ease;
}

.gestiadev-seal:hover {
  opacity: 0.5;
}

.seal-text {
  font-size: 0.45rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: #fff;
  text-transform: uppercase;
}

.seal-dot {
  width: 3px;
  height: 3px;
  background: rgba(255,255,255,0.4);
  border-radius: 50%;
}
      `}</style>
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* ═══ HEADER (Imagen completa con texto integrado) ═══ */}
      <div className="sidebar-header" style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <img 
          src="../public/interpreted_vector_logo.png" 
          alt="Selene Lux Core" 
          style={{ width: '100%', maxWidth: '220px', height: 'auto', objectFit: 'contain' }} 
        />
      </div>

      {/* ═══ NAV SCROLL WRAPPER ═══ */}
      <div className="sidebar-nav-scroll" style={{ flex: 1, overflowY: 'auto' }}>

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
              locked={!isTabAllowed(tab.id)}
            />
          ))}
        </div>
      </nav>

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
              locked={!isTabAllowed(tab.id)}
            />
          ))}
        </div>
      </nav>

      </div>{/* fin sidebar-nav-scroll */}

      {/* WAVE 2500: Footer removed — License badge relocated to DataCards telemetry */}
    </aside>
    </>
  )
}

export default Sidebar
