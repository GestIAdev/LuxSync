/**
 * 🎛️ LIVE VIEW - Main Control View
 * WAVE 9: Paletas, movimiento y control en tiempo real
 */

import React from 'react'
// Import from root components folder
import PaletteReactor from '../../PaletteReactor'
import MovementControl from '../../MovementControl'
import BigSwitch from '../../BigSwitch'
import './LiveView.css'

const LiveView: React.FC = () => {
  return (
    <div className="live-view">
      <header className="view-header">
        <h2 className="view-title">🎛️ LIVE MODE</h2>
        {/* BigSwitch compacto al lado del título */}
        <div className="header-switch">
          <BigSwitch />
        </div>
      </header>

      <div className="live-content">
        {/* Main Controls Grid */}
        <div className="live-panels">
          {/* Palette Reactor */}
          <section className="panel palette-panel">
            <PaletteReactor />
          </section>

          {/* Brain Preview (placeholder for now) */}
          <section className="panel brain-panel">
            <div className="panel-header">
              <h3>🧠 BRAIN PREVIEW</h3>
            </div>
            <div className="brain-preview-content">
              <div className="brain-mode">MODE: INTELLIGENT</div>
              <div className="brain-metric">
                <span>Beauty:</span>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: '82%' }} />
                </div>
                <span>82%</span>
              </div>
              <div className="brain-metric">
                <span>Confidence:</span>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: '65%' }} />
                </div>
                <span>65%</span>
              </div>
              <div className="brain-stats">
                <div>Patterns: 47 learned</div>
                <div>Session: 15 new</div>
              </div>
            </div>
          </section>
        </div>

        {/* Movement Control */}
        <section className="movement-section">
          <MovementControl />
        </section>
      </div>
    </div>
  )
}

export default LiveView
