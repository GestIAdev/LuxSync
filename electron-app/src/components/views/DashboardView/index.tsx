/**
 * 🎛️ DASHBOARD VIEW - WAVE 437: MISSION CONTROL
 * 
 * Transformed from "Command Center" to "Mission Control"
 * Pre-flight check + Quick navigation
 * 
 * Layout: Mission Control Grid
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ [POWER]  MISSION CONTROL                                            │
 * ├──────────────────┬──────────────────────────────────────────────────┤
 * │                  │        ACTIVE SESSION (horizontal card)          │
 * │   SYSTEMS CHECK  ├──────────────────────────────────────────────────┤
 * │   (Audio + DMX)  │        LAUNCHPAD (3 big cards)                   │
 * │                  │        [LIVE]    [CALIBRATE]    [CONSTRUCT]      │
 * ├──────────────────┴──────────────────────────────────────────────────┤
 * │                     DATA CARDS (BPM, FPS, Uptime)                   │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 437 Changes:
 * - NEW: SystemsCheck widget (Audio + DMX selectors)
 * - NEW: ActiveSession widget (horizontal show card)
 * - NEW: Launchpad widget (big navigation cards)
 * - KEEP: DataCards in footer
 * - REMOVE: Old AudioReactorRing, ShowSelector, QuickLinks
 */

import React from 'react'
import { SystemsCheck } from './components/SystemsCheck'
import { ActiveSession } from './components/ActiveSession'
import { Launchpad } from './components/Launchpad'
import DataCards from './components/DataCards'
import PowerButton from './components/PowerButton'
import { BoltIcon } from '../../icons/LuxIcons'
import './DashboardView.css'

const DashboardView: React.FC = () => {
  return (
    <div className="dashboard-mission-control">
      {/* Header Strip */}
      <header className="mission-header">
        <div className="header-left">
          <PowerButton />
          <div className="header-title">
            <span className="title-icon">
              <BoltIcon size={22} color="#00ffff" />
            </span>
            <h1>MISSION CONTROL</h1>
          </div>
        </div>
        <div className="header-status">
          <span className="status-badge online">● SYSTEMS READY</span>
        </div>
      </header>

      {/* Mission Control Grid */}
      <main className="mission-grid">
        {/* Left Column: Systems Check */}
        <section className="grid-cell cell-systems">
          <SystemsCheck />
        </section>

        {/* Right Column: Session + Launchpad */}
        <div className="grid-column-right">
          {/* Top: Active Session */}
          <section className="grid-cell cell-session">
            <ActiveSession />
          </section>

          {/* Bottom: Launchpad */}
          <section className="grid-cell cell-launchpad">
            <Launchpad />
          </section>
        </div>
      </main>

      {/* Bottom Data Deck */}
      <footer className="mission-deck">
        <DataCards />
      </footer>

      {/* Ambient Effects */}
      <div className="mission-glow-overlay" />
      <div className="mission-scanlines" />
    </div>
  )
}

export default DashboardView
