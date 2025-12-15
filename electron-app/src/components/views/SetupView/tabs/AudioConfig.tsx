/**
 * 🎵 AUDIO CONFIG - Audio Input Configuration Panel
 * WAVE 26 Phase 2: DevicesTab Component
 * 
 * Features:
 * - Source selector (Simulation/System/Microphone)
 * - Large horizontal VU meter
 * - Gain slider with dB display
 * - Device persistence via setupStore
 */

import React, { useCallback, useState } from 'react'
import { useTrinity } from '../../../../providers/TrinityProvider'
import { useTruthStore, selectAudio } from '../../../../stores/truthStore'
import { useAudioStore } from '../../../../stores/audioStore'
import { useSetupStore } from '../../../../stores/setupStore'
import './AudioConfig.css'

// ============================================
// TYPES
// ============================================

type AudioSource = 'simulation' | 'system' | 'microphone'

interface SourceOption {
  id: AudioSource
  icon: string
  label: string
  description: string
}

const AUDIO_SOURCES: SourceOption[] = [
  { 
    id: 'simulation', 
    icon: '🎵', 
    label: 'Simulation', 
    description: 'Demo sin hardware' 
  },
  { 
    id: 'system', 
    icon: '🖥️', 
    label: 'System Audio', 
    description: 'Loopback del sistema' 
  },
  { 
    id: 'microphone', 
    icon: '🎤', 
    label: 'Microphone', 
    description: 'Entrada de mic' 
  },
]

// ============================================
// VU METER COMPONENT
// ============================================

interface VuMeterProps {
  energy: number      // 0-1
  bass: number        // 0-1
  mid: number         // 0-1
  treble: number      // 0-1
}

const VuMeter: React.FC<VuMeterProps> = ({ energy, bass, mid, treble }) => {
  // Convert to percentage
  const energyPct = Math.min(100, energy * 100)
  
  // Color based on level
  const getBarColor = (level: number): string => {
    if (level > 0.9) return '#ff4444'  // Clipping - red
    if (level > 0.7) return '#ffaa00'  // Hot - orange
    if (level > 0.4) return '#00ff88'  // Good - green
    return '#00aa66'                    // Low - dim green
  }
  
  return (
    <div className="vu-meter-container">
      {/* Main energy bar */}
      <div className="vu-meter-main">
        <div className="vu-meter-track">
          <div 
            className="vu-meter-fill"
            style={{ 
              width: `${energyPct}%`,
              backgroundColor: getBarColor(energy),
              boxShadow: `0 0 20px ${getBarColor(energy)}40`
            }}
          />
          {/* Peak indicator */}
          <div 
            className="vu-meter-peak"
            style={{ left: `${energyPct}%` }}
          />
        </div>
        
        {/* dB scale */}
        <div className="vu-meter-scale">
          <span>-60</span>
          <span>-40</span>
          <span>-20</span>
          <span>-12</span>
          <span>-6</span>
          <span>0</span>
        </div>
      </div>
      
      {/* Band indicators */}
      <div className="vu-bands">
        <div className="vu-band">
          <div 
            className="vu-band-fill bass"
            style={{ height: `${bass * 100}%` }}
          />
          <span className="vu-band-label">BASS</span>
        </div>
        <div className="vu-band">
          <div 
            className="vu-band-fill mid"
            style={{ height: `${mid * 100}%` }}
          />
          <span className="vu-band-label">MID</span>
        </div>
        <div className="vu-band">
          <div 
            className="vu-band-fill treble"
            style={{ height: `${treble * 100}%` }}
          />
          <span className="vu-band-label">HIGH</span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// GAIN SLIDER
// ============================================

interface GainSliderProps {
  value: number      // 0.1 - 4.0
  onChange: (value: number) => void
}

const GainSlider: React.FC<GainSliderProps> = ({ value, onChange }) => {
  // Convert to percentage for display
  const percentage = Math.round(value * 100)
  
  // Convert to dB for pro display
  const dB = value === 0 ? -Infinity : 20 * Math.log10(value)
  const dBDisplay = dB === -Infinity ? '-∞' : `${dB >= 0 ? '+' : ''}${dB.toFixed(1)}`
  
  return (
    <div className="gain-slider-container">
      <label className="gain-label">
        <span className="gain-title">INPUT GAIN</span>
        <span className="gain-value">{percentage}%</span>
        <span className="gain-db">{dBDisplay} dB</span>
      </label>
      
      <input
        type="range"
        className="gain-slider"
        min="10"
        max="400"
        step="10"
        value={percentage}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      
      <div className="gain-marks">
        <span>10%</span>
        <span>100%</span>
        <span>200%</span>
        <span>400%</span>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export const AudioConfig: React.FC = () => {
  const trinity = useTrinity()
  const audio = useTruthStore(selectAudio)
  const { inputGain, setInputGain } = useAudioStore()
  const { setAudioSource: setStoreSource, audioSource } = useSetupStore()
  
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Current active source from store or detect from trinity
  const currentSource: AudioSource | null = audioSource as AudioSource | null
  
  // Handle source selection
  const handleSourceSelect = useCallback(async (source: AudioSource) => {
    setError(null)
    setIsConnecting(true)
    
    try {
      if (source === 'simulation') {
        trinity.setSimulating(true)
        setStoreSource('simulation')
        
        // Save to config
        if (window.lux?.saveConfig) {
          await window.lux.saveConfig({ audio: { source: 'simulation' } } as any)
        }
        
      } else if (source === 'system') {
        await trinity.startSystemAudio()
        trinity.setSimulating(false)
        setStoreSource('system')
        
        if (window.lux?.saveConfig) {
          await window.lux.saveConfig({ audio: { source: 'system' } } as any)
        }
        
      } else if (source === 'microphone') {
        await trinity.startMicrophone()
        trinity.setSimulating(false)
        setStoreSource('microphone')
        
        if (window.lux?.saveConfig) {
          await window.lux.saveConfig({ audio: { source: 'microphone' } } as any)
        }
      }
      
    } catch (err) {
      console.warn('[AudioConfig] Source selection failed:', err)
      setError('Permiso denegado. Usando simulación.')
      trinity.setSimulating(true)
      setStoreSource('simulation')
      
    } finally {
      setIsConnecting(false)
    }
  }, [trinity, setStoreSource])
  
  // Handle gain change
  const handleGainChange = useCallback((gain: number) => {
    setInputGain(gain)
    
    // Persist
    if (window.lux?.saveConfig) {
      window.lux.saveConfig({ audio: { inputGain: gain } } as any)
    }
  }, [setInputGain])
  
  return (
    <div className="audio-config-panel">
      <div className="config-header">
        <h3>🎵 AUDIO INPUT</h3>
        {trinity.state.isAudioActive && (
          <span className="status-badge active">ACTIVE</span>
        )}
      </div>
      
      {/* Source Selector */}
      <div className="source-selector">
        {AUDIO_SOURCES.map((source) => (
          <button
            key={source.id}
            className={`source-btn ${currentSource === source.id ? 'active' : ''} ${isConnecting ? 'loading' : ''}`}
            onClick={() => handleSourceSelect(source.id)}
            disabled={isConnecting}
          >
            <span className="source-icon">{source.icon}</span>
            <div className="source-info">
              <span className="source-label">{source.label}</span>
              <span className="source-desc">{source.description}</span>
            </div>
            {currentSource === source.id && (
              <span className="source-check">✓</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      {/* VU Meter */}
      <VuMeter 
        energy={audio.energy}
        bass={audio.bass}
        mid={audio.mid}
        treble={audio.high}
      />
      
      {/* Gain Slider */}
      <GainSlider 
        value={inputGain}
        onChange={handleGainChange}
      />
    </div>
  )
}

export default AudioConfig
