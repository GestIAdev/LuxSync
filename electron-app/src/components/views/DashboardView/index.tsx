/**
 * 🎛️ DASHBOARD VIEW - WAVE 1199: MISSION CONTROL FINAL POLISH
 * 
 * Layout: 60/40 Grid — Systems dominates, Launchpad compact
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ [POWER]  MISSION CONTROL                          ● SYSTEMS READY  │
 * ├──────────────────────────────────┬──────────────────────────────────┤
 * │                                  │  ACTIVE SESSION (thin card)      │
 * │   SYSTEMS CHECK (60-65%)         ├──────────────────────────────────┤
 * │   Audio + DMX + Patch Bay        │  LAUNCHPAD (5 compact cards)     │
 * │                                  │  2-col grid, ~80px each          │
 * ├──────────────────────────────────┴──────────────────────────────────┤
 * │                     DATA CARDS (BPM, FPS, Uptime)                   │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 1199: Layout Rebalance, Tactical Patch Bay, 5-Card Launchpad
 * ALL CYBERPUNK CYAN (#22d3ee). No violet. No magenta borders.
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
      {/* Header Strip — Clean, minimal */}
      <header className="mission-header">
        <div className="header-left">
          <PowerButton />
          <div className="header-title">
            <span className="title-icon">
              <BoltIcon size={20} color="#22d3ee" />
            </span>
            <h1>MISSION CONTROL</h1>
          </div>
        </div>
        <div className="header-status">
          <span className="status-badge online">● SYSTEMS READY</span>
        </div>
      </header>

      {/* Mission Control Grid — 60/40 split */}
      <main className="mission-grid">
        {/* Left Column: Systems Check + Patch Bay (60-65%) */}
        <section className="grid-cell cell-systems">
          <SystemsCheck />
        </section>

        {/* Right Column: Thin Session + Compact Launchpad (35-40%) */}
        <div className="grid-column-right">
          <section className="grid-cell cell-session">
            <ActiveSession />
          </section>
          <section className="grid-cell cell-launchpad">
            <Launchpad />
          </section>
        </div>
      </main>

      {/* Bottom Data Deck */}
      <footer className="mission-deck">
        <DataCards />
      </footer>

      {/* Ambient — Cyan only */}
      <div className="mission-glow-overlay" />
      <div className="mission-scanlines" />
    </div>
  )
}

export default DashboardView
