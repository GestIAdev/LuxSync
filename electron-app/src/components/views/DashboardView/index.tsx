/**
 * 🎛️ DASHBOARD VIEW - WAVE 1201: THE GREAT SWAP
 * 
 * Layout: INVERTED — Hardware Left, Data Right
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ [POWER]  MISSION CONTROL                          ● SYSTEMS READY  │
 * ├──────────────────────────────────┬──────────────────────────────────┤
 * │   SYSTEMS CHECK (40%)            │  ACTIVE SESSION (header)         │
 * │   Audio + DMX (Legacy Buttons)   ├──────────────────────────────────┤
 * │   ArtNet/USB Config Panel        │  TACTICAL PATCH BAY (flex-grow)  │
 * ├──────────────────────────────────┤  Lista de fixtures con scroll    │
 * │   LAUNCHPAD (Dock Mode)          │  infinito — nunca rompe nada     │
 * │   Compacto, abajo                │                                  │
 * ├──────────────────────────────────┴──────────────────────────────────┤
 * │                     DATA CARDS (BPM, FPS, Uptime)                   │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 1201: Great Swap (Left=Hardware, Right=Data), Legacy Buttons
 */

import React from 'react'
import { SystemsCheck } from './components/SystemsCheck'
import { ActiveSession } from './components/ActiveSession'
import { TacticalPatchBay } from './components/TacticalPatchBay'
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

      {/* Mission Control Grid — SWAPPED: Hardware Left, Data Right */}
      <main className="mission-grid">
        {/* LEFT COLUMN: Hardware & Navigation (40%) */}
        <div className="grid-column-left">
          <section className="grid-cell cell-systems">
            <SystemsCheck />
          </section>
          <section className="grid-cell cell-launchpad">
            <Launchpad />
          </section>
        </div>

        {/* RIGHT COLUMN: Data & Management (60%) */}
        <div className="grid-column-right">
          <section className="grid-cell cell-session">
            <ActiveSession />
          </section>
          <section className="grid-cell cell-patchbay">
            <TacticalPatchBay />
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
