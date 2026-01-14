/**
 * 🎛️ DASHBOARD VIEW - WAVE 424: Dashboard Simplify
 * 
 * STAGE 1: Command Center - Session Management
 * 
 * NO SCROLL - 100% viewport
 * TitleBar is now GLOBAL (in MainLayout)
 * 
 * Layout: CSS Grid
 * ┌─────────────────────────────────────────────────────┐
 * │ [POWER]  COMMAND CENTER                             │
 * ├────────────────────┬────────────────────────────────┤
 * │   AUDIO REACTOR    │      QUICK LINKS               │
 * │                    │  [LIVE] [CALIBRATE] [CORE]     │
 * ├────────────────────┴────────────────────────────────┤
 * │              DATA CARDS (status)                    │
 * └─────────────────────────────────────────────────────┘
 * 
 * WAVE 424 Changes:
 * - REMOVED: VibeSelector (→ moved to CommandDeck in Phase 5)
 * - REMOVED: SeleneBrain (→ available in LUX CORE)
 * - ADDED: QuickLinks navigation cards
 */

import React from 'react'
import AudioReactorRing from './components/AudioReactorRing'
import DataCards from './components/DataCards'
import PowerButton from './components/PowerButton'
import QuickLinks from './components/QuickLinks'
import { IconAudioWave } from './components/HudIcons'
import './DashboardView.css'

const DashboardView: React.FC = () => {
  return (
    <div className="dashboard-cyberpunk">
      {/* Header Strip */}
      <header className="dashboard-header">
        <div className="header-left">
          <PowerButton />
          <div className="header-title">
            <span className="title-icon">
              <IconDmxBoltHeader />
            </span>
            <h1>COMMAND CENTER</h1>
          </div>
        </div>
        {/* WAVE 422: ModeSwitcher ELIMINADO - Sistema Auto-Override */}
      </header>

      {/* Bento Grid Main Area - WAVE 424: Simplified */}
      <main className="dashboard-bento">
        {/* Left: Audio Reactor Ring */}
        <section className="bento-cell cell-reactor">
          <div className="cell-header">
            <span className="cell-icon">
              <IconAudioWave size={18} />
            </span>
            <span className="cell-label">AUDIO CORE</span>
          </div>
          <AudioReactorRing />
        </section>

        {/* Right: Quick Links Navigation */}
        <section className="bento-cell cell-quicklinks">
          <QuickLinks />
        </section>
      </main>

      {/* Bottom Data Deck */}
      <footer className="dashboard-deck">
        <DataCards />
      </footer>

      {/* Ambient Effects */}
      <div className="dashboard-glow-overlay" />
      <div className="dashboard-scanlines" />
    </div>
  )
}

/** Inline lightning bolt for header */
const IconDmxBoltHeader: React.FC = () => (
  <svg 
    width={22} 
    height={22} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="#00ffff"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" />
  </svg>
)

export default DashboardView
