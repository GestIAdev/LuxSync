/**
 * 🎵 AUDIO OSCILLOSCOPE
 * WAVE 14.3: Real-time audio visualization + Gain Control embebido
 * 
 * Shows:
 * - Bass/Mid/Treble spectrum bars
 * - Energy level with trend indicator
 * - Beat detection pulse
 * - BPM with confidence
 * - Input Gain Control (INTEGRADO)
 */

import React, { useState, useCallback } from 'react'
import { useTelemetryStore, type AudioTelemetry } from '../../../stores/telemetryStore'
import { useAudioStore } from '../../../stores/audioStore'  // 🔧 WAVE 15.1: Sync gain to store
import './AudioOscilloscope.css'

const AudioOscilloscope: React.FC = () => {
  const audio = useTelemetryStore((state) => state.audio)
  const connected = useTelemetryStore((state) => state.connected)
  
  // � WAVE 15.3: TRUTH CABLE - Datos reales de Trinity Workers
  const trinityAudio = useTelemetryStore((state) => state.trinityAudio)
  const trinityConnected = useTelemetryStore((state) => state.trinityConnected)
  const signalLost = useTelemetryStore((state) => state.signalLost)
  
  // �🔧 WAVE 15.1: Get initial gain from store (persisted from config)
  const storeGain = useAudioStore(state => state.inputGain)
  
  // Estado local para el control de ganancia - initialize from store
  const [localGain, setLocalGain] = useState(storeGain)
  
  // 📡 WAVE 15.3: Priorizar datos de Trinity (reales) sobre legacy
  // Si Trinity está conectado y no hay SIGNAL LOST, usar datos reales
  const useTrinityData = trinityConnected && !signalLost && trinityAudio
  
  // Default values if no telemetry
  const data: AudioTelemetry = useTrinityData 
    ? {
        spectrum: { 
          bass: trinityAudio.bass, 
          mid: trinityAudio.mid, 
          treble: trinityAudio.treble 
        },
        energy: { 
          current: trinityAudio.energy, 
          peak: trinityAudio.energy, 
          trend: 'stable' 
        },
        beat: { 
          detected: trinityAudio.onBeat, 
          bpm: trinityAudio.bpm, 
          confidence: 0.8, 
          phase: 0 
        },
        inputGain: storeGain,
      }
    : audio || {
        spectrum: { bass: 0, mid: 0, treble: 0 },
        energy: { current: 0, peak: 0, trend: 'stable' },
        beat: { detected: false, bpm: 0, confidence: 0, phase: 0 },
        inputGain: 1,
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
  
  // 📡 WAVE 15.3: Determinar estado de conexión para CSS
  const connectionStatus = signalLost ? 'signal-lost' : (useTrinityData ? 'trinity-connected' : (connected ? 'connected' : 'disconnected'))

  return (
    <div className={`telemetry-panel audio-oscilloscope ${connectionStatus}`}>
      <div className="panel-header">
        <h3>🎵 AUDIO {signalLost && <span className="signal-lost-badge">⚠️ SIGNAL LOST</span>}</h3>
        <span className={`beat-indicator ${data.beat.detected ? 'pulse' : ''}`}>
          {useTrinityData ? '🟢' : '●'}
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
