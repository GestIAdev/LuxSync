/**
 * 🎛️ LIVE VIEW - Main Control View
 * WAVE 9.2: Paletas, movimiento y control en tiempo real
 * WAVE 13.6: ModeSwitcher gigante integrado (DEBAJO de panels)
 * WAVE 14.4: Iconos Lucide + Brain Preview optimizado
 * Conectado a Selene Brain via stores
 */

import React from 'react'
import { BrainCircuit, Activity, Zap, Sparkles, Music } from 'lucide-react'
import PaletteReactor from '../../PaletteReactor'
import MovementControl from '../../MovementControl'
import ModeSwitcher from '../../ModeSwitcher'
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
      {/* Header simple */}
      <header className="view-header">
        <h2 className="view-title">🎛️ LIVE MODE</h2>
      </header>

      <div className="live-content">
        {/* Fila 1: Palette Reactor + Brain Preview (2 columnas) */}
        <div className="live-panels">
          {/* Palette Reactor */}
          <section className="panel palette-panel">
            <PaletteReactor />
          </section>

          {/* Brain Preview */}
          <section className="panel brain-panel">
            <div className="panel-header">
              <h3><BrainCircuit size={16} className="inline mr-2" />BRAIN PREVIEW</h3>
              <span className={`brain-status ${brainConnected ? 'connected' : 'disconnected'}`}>
                {brainConnected ? '● LIVE' : '○ OFFLINE'}
              </span>
            </div>
            <div className="brain-preview-content">
              <div className="brain-mode" style={{ color: modeColor }}>
                MODE: {modeDisplay}
              </div>
              
              <div className="brain-metric">
                <Sparkles size={12} className="metric-icon" />
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
                <Activity size={12} className="metric-icon" />
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
                  <Music size={12} className="inline mr-1" />
                  <span>BPM:</span>
                  <span className="stat-value">{bpm.toFixed(0)}</span>
                </div>
                <div className="stat-row">
                  <Activity size={12} className="inline mr-1" />
                  <span>Patterns:</span>
                  <span className="stat-value">{patternsLearned} learned</span>
                </div>
                <div className="stat-row">
                  <Sparkles size={12} className="inline mr-1" />
                  <span>Session:</span>
                  <span className="stat-value">{sessionPatterns} new</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Fila 2: Movement Control (ocupa todo el ancho) */}
        <section className="movement-section">
          <MovementControl />
        </section>

        {/* Fila 3: ModeSwitcher (ocupa todo el ancho) */}
        <section className="mode-switcher-section">
          <ModeSwitcher />
        </section>
      </div>
    </div>
  )
}

export default LiveView
