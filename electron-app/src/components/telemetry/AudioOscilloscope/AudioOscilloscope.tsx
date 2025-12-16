/**
 * 🎵 AUDIO OSCILLOSCOPE
 * WAVE 14.3: Real-time audio visualization + Gain Control embebido
 * 🧠 WAVE 25.6: Migrado a truthStore
 * 
 * Shows:
 * - Bass/Mid/Treble spectrum bars
 * - Energy level with trend indicator
 * - Beat detection pulse
 * - BPM with confidence
 * - Input Gain Control (INTEGRADO)
 */

import React from 'react'
import { useTruthSensory, useTruthConnected } from '../../../hooks'
import './AudioOscilloscope.css'

/**
 * 🎵 AUDIO OSCILLOSCOPE - MONITOR ONLY
 * WAVE 29: Refactorizado para Selene Lux Core
 * * - Spectrum Bars (Bass/Mid/Treble)
 * - Energy Level & Trend
 * - Beat Pulse & BPM
 * - SIN CONTROL DE GANANCIA (Movido a Setup)
 */

const AudioOscilloscope: React.FC = () => {
  const sensory = useTruthSensory()
  const connected = useTruthConnected()
  
  // Datos directos del Truth Store
  const data = {
    spectrum: { 
      bass: sensory?.audio?.bass ?? 0, 
      mid: sensory?.audio?.mid ?? 0, 
      treble: sensory?.audio?.high ?? 0 
    },
    energy: { 
      current: sensory?.audio?.energy ?? 0, 
      peak: sensory?.audio?.peak ?? 0, 
      trend: 'stable' as const // TODO: Implementar tendencia real en backend si es necesario
    },
    beat: { 
      detected: sensory?.beat?.onBeat ?? false, 
      bpm: sensory?.beat?.bpm ?? 0, 
      confidence: sensory?.beat?.confidence ?? 0
    }
  }
  
  const getTrendIcon = (trend: string) => {
    if (trend === 'rising') return '↗'
    if (trend === 'falling') return '↘'
    return '→'
  }
  
  return (
    <div className={`audio-scope-panel ${connected ? 'online' : 'offline'}`}>
      {/* HEADER */}
      <div className="scope-header">
        <div className="scope-title">
          <span className="icon">🎵</span>
          <span>AUDIO SENSORY</span>
        </div>
        <div className={`scope-pulse ${data.beat.detected ? 'active' : ''}`} />
      </div>
      
      {/* SPECTRUM VISUALIZER */}
      <div className="scope-visualizer">
        {/* BASS */}
        <div className="freq-column">
          <div className="freq-bar-track">
            <div 
              className="freq-bar-fill bass" 
              style={{ height: `${data.spectrum.bass * 100}%` }}
            />
          </div>
          <div className="freq-info">
            <span className="freq-label">BASS</span>
            <span className="freq-val">{Math.round(data.spectrum.bass * 100)}</span>
          </div>
        </div>

        {/* MID */}
        <div className="freq-column">
          <div className="freq-bar-track">
            <div 
              className="freq-bar-fill mid" 
              style={{ height: `${data.spectrum.mid * 100}%` }}
            />
          </div>
          <div className="freq-info">
            <span className="freq-label">MID</span>
            <span className="freq-val">{Math.round(data.spectrum.mid * 100)}</span>
          </div>
        </div>

        {/* TREBLE */}
        <div className="freq-column">
          <div className="freq-bar-track">
            <div 
              className="freq-bar-fill treble" 
              style={{ height: `${data.spectrum.treble * 100}%` }}
            />
          </div>
          <div className="freq-info">
            <span className="freq-label">HIGH</span>
            <span className="freq-val">{Math.round(data.spectrum.treble * 100)}</span>
          </div>
        </div>
      </div>
      
      {/* METRICS FOOTER */}
      <div className="scope-metrics">
        
        {/* ENERGY BAR */}
        <div className="metric-group energy-group">
          <div className="metric-header">
            <span className="metric-name">ENERGY</span>
            <span className="metric-trend">{getTrendIcon(data.energy.trend)}</span>
          </div>
          <div className="energy-meter-track">
            <div 
              className="energy-meter-fill"
              style={{ width: `${data.energy.current * 100}%` }}
            />
            {/* Peak indicator */}
            <div 
              className="energy-meter-peak"
              style={{ left: `${data.energy.peak * 100}%` }}
            />
          </div>
        </div>
        
        {/* BPM DISPLAY */}
        <div className="metric-group bpm-group">
          <span className="bpm-number">{Math.round(data.beat.bpm)}</span>
          <span className="bpm-label">BPM</span>
          <div className="confidence-dots">
            {/* 3 puntos de confianza */}
            <div className={`dot ${data.beat.confidence > 0.3 ? 'on' : ''}`} />
            <div className={`dot ${data.beat.confidence > 0.6 ? 'on' : ''}`} />
            <div className={`dot ${data.beat.confidence > 0.9 ? 'on' : ''}`} />
          </div>
        </div>

      </div>
    </div>
  )
}

export default AudioOscilloscope
