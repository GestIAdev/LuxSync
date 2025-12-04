/**
 * 🎛️ LIVE VIEW - Main Control View
 * WAVE 9.2: Paletas, movimiento y control en tiempo real
 * Conectado a Selene Brain via stores
 */

import React from 'react'
import PaletteReactor from '../../PaletteReactor'
import MovementControl from '../../MovementControl'
import BigSwitch from '../../BigSwitch'
import { useSeleneStore } from '../../../stores/seleneStore'
import { useAudioStore } from '../../../stores/audioStore'
import './LiveView.css'

const LiveView: React.FC = () => {
  // Conectar con stores reales
  const { 
    currentMode, 
    confidence, 
    beautyScore, 
    patternsLearned,
    sessionPatterns,
    brainConnected 
  } = useSeleneStore()
  
  const { bpm, bass, mid, treble } = useAudioStore()

  // Formatear modo para display
  const modeDisplay = currentMode === 'intelligent' ? 'INTELLIGENT' : 'REACTIVE'
  const modeColor = currentMode === 'intelligent' ? '#a855f7' : '#00fff0'

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

          {/* Brain Preview - Ahora con datos reales */}
          <section className="panel brain-panel">
            <div className="panel-header">
              <h3>🧠 BRAIN PREVIEW</h3>
              <span className={`brain-status ${brainConnected ? 'connected' : 'disconnected'}`}>
                {brainConnected ? '● LIVE' : '○ OFFLINE'}
              </span>
            </div>
            <div className="brain-preview-content">
              <div className="brain-mode" style={{ color: modeColor }}>
                MODE: {modeDisplay}
              </div>
              
              <div className="brain-metric">
                <span>Beauty:</span>
                <div className="metric-bar">
                  <div 
                    className="metric-fill beauty" 
                    style={{ width: `${beautyScore * 100}%` }} 
                  />
                </div>
                <span>{(beautyScore * 100).toFixed(0)}%</span>
              </div>
              
              <div className="brain-metric">
                <span>Confidence:</span>
                <div className="metric-bar">
                  <div 
                    className="metric-fill confidence" 
                    style={{ width: `${confidence * 100}%` }} 
                  />
                </div>
                <span>{(confidence * 100).toFixed(0)}%</span>
              </div>

              {/* Audio Spectrum Mini */}
              <div className="audio-spectrum-mini">
                <div className="spectrum-bar bass" style={{ height: `${bass * 100}%` }} title="Bass" />
                <div className="spectrum-bar mid" style={{ height: `${mid * 100}%` }} title="Mid" />
                <div className="spectrum-bar treble" style={{ height: `${treble * 100}%` }} title="Treble" />
              </div>
              
              <div className="brain-stats">
                <div className="stat-row">
                  <span>🎵 BPM:</span>
                  <span className="stat-value">{bpm.toFixed(0)}</span>
                </div>
                <div className="stat-row">
                  <span>📊 Patterns:</span>
                  <span className="stat-value">{patternsLearned} learned</span>
                </div>
                <div className="stat-row">
                  <span>✨ Session:</span>
                  <span className="stat-value">{sessionPatterns} new</span>
                </div>
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
