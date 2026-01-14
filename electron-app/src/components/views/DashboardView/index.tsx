/**
 * 🎛️ DASHBOARD VIEW - WAVE 428: Redesigned Layout
 * 
 * STAGE 1: Command Center - Session Management
 * 
 * Layout: 3-Column Bento Grid
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ [POWER]  COMMAND CENTER                                             │
 * ├───────────────┬────────────────────────────┬────────────────────────┤
 * │  SHOW SELECT  │     AUDIO REACTOR          │    QUICK LINKS         │
 * │  (compact)    │     (medium, centered)     │    [LIVE][BUILD][...]  │
 * ├───────────────┴────────────────────────────┴────────────────────────┤
 * │                     DATA CARDS (status)                             │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 428 Changes:
 * - NEW: ShowSelector panel (left)
 * - RESIZE: AudioReactor now medium size (center)
 * - MOVE: QuickLinks to right column
 * - FIX: Proportional 3-column layout
 */

import React from 'react'
import AudioReactorRing from './components/AudioReactorRing'
import DataCards from './components/DataCards'
import PowerButton from './components/PowerButton'
import QuickLinks from './components/QuickLinks'
import { ShowSelector } from './components/ShowSelector'
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

      {/* Bento Grid Main Area - WAVE 428: 3-Column Layout */}
      <main className="dashboard-bento">
        {/* Left: Show Selector */}
        <section className="bento-cell cell-shows">
          <div className="cell-header">
            <span className="cell-icon">📁</span>
            <span className="cell-label">SHOWS</span>
          </div>
          <ShowSelector />
        </section>

        {/* Center: Audio Reactor Ring (smaller) */}
        <section className="bento-cell cell-reactor">
          <div className="cell-header">
            <span className="cell-icon">
              <IconAudioWave size={18} />
            </span>
            <span className="cell-label">AUDIO CORE</span>
          </div>
          <div className="reactor-container">
            <AudioReactorRing />
          </div>
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
