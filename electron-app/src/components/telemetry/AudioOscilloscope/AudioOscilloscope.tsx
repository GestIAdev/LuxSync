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

import React, { useState, useCallback } from 'react'
import { useTruthSensory, useTruthConnected } from '../../../hooks'
import { useAudioStore } from '../../../stores/audioStore'
import './AudioOscilloscope.css'

const AudioOscilloscope: React.FC = () => {
  // 🧠 WAVE 25.6: Use truthStore
  const sensory = useTruthSensory()
  const connected = useTruthConnected()
  
  // 🔧 WAVE 15.1: Get initial gain from store (persisted from config)
  const storeGain = useAudioStore(state => state.inputGain)
  
  // Estado local para el control de ganancia - initialize from store
  const [localGain, setLocalGain] = useState(storeGain)
  
  // Build audio data from truth
  const data = {
    spectrum: { 
      bass: sensory?.audio?.bass ?? 0, 
      mid: sensory?.audio?.mid ?? 0, 
      treble: sensory?.audio?.high ?? 0 
    },
    energy: { 
      current: sensory?.audio?.energy ?? 0, 
      peak: sensory?.audio?.peak ?? 0, 
      trend: 'stable' as const
    },
    beat: { 
      detected: sensory?.beat?.onBeat ?? false, 
      bpm: sensory?.beat?.bpm ?? 0, 
      confidence: sensory?.beat?.confidence ?? 0, 
      phase: sensory?.beat?.beatPhase ?? 0 
    },
    inputGain: storeGain,
  }
  
  // Handler para cambio de ganancia
  // 🔧 WAVE 15.1: Update BOTH local state AND audioStore for useAudioCapture
  const setStoreGain = useAudioStore(state => state.setInputGain)
  
  const handleGainChange = useCallback((value: number) => {
    setLocalGain(value)
    setStoreGain(value)  // 🔧 WAVE 15.1: Sync to audioStore (used by useAudioCapture)
    window.lux?.setInputGain?.(value)  // Persist to main process
    console.log('[AUDIO] Gain changed:', value, '→ Store + IPC synced')
  }, [setStoreGain])
  
  const getTrendIcon = (trend: 'rising' | 'falling' | 'stable') => {
    switch (trend) {
      case 'rising': return '↗️'
      case 'falling': return '↘️'
      default: return '→'
    }
  }
  
  const getTrendClass = (trend: 'rising' | 'falling' | 'stable') => {
    switch (trend) {
      case 'rising': return 'trend-rising'
      case 'falling': return 'trend-falling'
      default: return 'trend-stable'
    }
  }
  
  // 🧠 WAVE 25.6: Estado de conexión simplificado
  const connectionStatus = connected ? 'connected' : 'disconnected'

  return (
    <div className={`telemetry-panel audio-oscilloscope ${connectionStatus}`}>
      <div className="panel-header">
        <h3>🎵 AUDIO</h3>
        <span className={`beat-indicator ${data.beat.detected ? 'pulse' : ''}`}>
          {connected ? '🟢' : '●'}
        </span>
      </div>
      
      {/* Spectrum Bars */}
      <div className="spectrum-section">
        <div className="spectrum-bars">
          <div className="spectrum-bar-container">
            <div 
              className="spectrum-bar bass" 
              style={{ height: `${data.spectrum.bass * 100}%` }}
            >
              <span className="bar-fill" />
            </div>
            <span className="bar-label">BASS</span>
            <span className="bar-value">{Math.round(data.spectrum.bass * 100)}</span>
          </div>
          
          <div className="spectrum-bar-container">
            <div 
              className="spectrum-bar mid" 
              style={{ height: `${data.spectrum.mid * 100}%` }}
            >
              <span className="bar-fill" />
            </div>
            <span className="bar-label">MID</span>
            <span className="bar-value">{Math.round(data.spectrum.mid * 100)}</span>
          </div>
          
          <div className="spectrum-bar-container">
            <div 
              className="spectrum-bar treble" 
              style={{ height: `${data.spectrum.treble * 100}%` }}
            >
              <span className="bar-fill" />
            </div>
            <span className="bar-label">TREBLE</span>
            <span className="bar-value">{Math.round(data.spectrum.treble * 100)}</span>
          </div>
        </div>
      </div>
      
      {/* Energy & BPM */}
      <div className="metrics-section">
        <div className="metric-row">
          <span className="metric-label">Energy</span>
          <div className="metric-bar">
            <div 
              className="metric-fill energy"
              style={{ width: `${data.energy.current * 100}%` }}
            />
            <div 
              className="metric-peak"
              style={{ left: `${data.energy.peak * 100}%` }}
            />
          </div>
          <span className={`metric-trend ${getTrendClass(data.energy.trend)}`}>
            {getTrendIcon(data.energy.trend)}
          </span>
        </div>
        
        <div className="bpm-row">
          <span className="bpm-value">{Math.round(data.beat.bpm)}</span>
          <span className="bpm-label">BPM</span>
          <div className="bpm-confidence">
            <div 
              className="confidence-fill"
              style={{ width: `${data.beat.confidence * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      {/* Input Gain Control - INTEGRADO */}
      <div className="gain-control">
        <div className="gain-header">
          <span className="gain-label">🎚️ GAIN</span>
          <span className="gain-value">{localGain.toFixed(1)}x</span>
        </div>
        <div className="gain-slider-container">
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={localGain}
            onChange={(e) => handleGainChange(parseFloat(e.target.value))}
            className="gain-slider"
          />
          <div className="gain-quick-btns">
            {[0.5, 1.0, 1.5, 2.0].map((val) => (
              <button
                key={val}
                className={`gain-quick ${localGain === val ? 'active' : ''}`}
                onClick={() => handleGainChange(val)}
              >
                {val}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AudioOscilloscope
