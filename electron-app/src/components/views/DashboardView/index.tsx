/**
 * 🎛️ DASHBOARD VIEW - WAVE 63.8: Zero State & Power Control
 * 
 * NO SCROLL - 100% viewport
 * TitleBar is now GLOBAL (in MainLayout)
 * 
 * Layout: CSS Grid (auto | 1fr | auto)
 * ┌─────────────────────────────────────────────────────┐
 * │ [POWER]  COMMAND CENTER              MODE SWITCHER  │
 * ├──────────────────────┬──────────────────────────────┤
 * │   AUDIO REACTOR      │      SELENE BRAIN (logs)     │
 * │                      ├──────────────────────────────┤
 * │                      │      VIBE SELECTOR           │
 * ├──────────────────────┴──────────────────────────────┤
 * │              DATA CARDS (deck)                      │
 * └─────────────────────────────────────────────────────┘
 */

import React from 'react'
import AudioReactorRing from './components/AudioReactorRing'
import SeleneBrain from './components/SeleneBrain'
import DataCards from './components/DataCards'
import PowerButton from './components/PowerButton'
import { VibeSelector } from './components/VibeSelector'
import { IconAudioWave, IconNeuralBrain } from './components/HudIcons'
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

      {/* Bento Grid Main Area */}
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

        {/* Right Column: Brain + Context */}
        <div className="bento-right-column">
          {/* Top: Selene Brain (logs only) */}
          <section className="bento-cell cell-brain">
            <div className="cell-header">
              <span className="cell-icon">
                <IconNeuralBrain size={18} />
              </span>
              <span className="cell-label">SELENE AI</span>
            </div>
            <SeleneBrain />
          </section>

          {/* Bottom: Vibe Context Selector */}
          <section className="bento-cell cell-context">
            <div className="cell-header">
              <span className="cell-icon">🎛️</span>
              <span className="cell-label">VIBE CONTEXT</span>
            </div>
            <VibeSelector />
          </section>
        </div>
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
