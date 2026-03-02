/**
 * 🎵 AUDIO SPECTRUM TITAN - WAVE 1193: THE GREAT DIVIDE
 * 
 * Espectro de audio EXPANDIDO con:
 * - 32 bandas visuales (interpoladas desde datos base)
 * - Altura dinámica (60% del contenedor)
 * - Etiquetas de frecuencia (SUB, BASS, LOW-MID, MID, HIGH-MID, PRESENCE, AIR)
 * - Peak hold indicators
 * - Spectral flux meter
 * - Energy distribution pie
 */

import React, { memo, useMemo, useRef } from 'react'
import { useTruthAudio, useTruthBeat } from '../../../hooks/useSeleneTruth'
import { SpectrumBarsIcon, LiveDotIcon } from '../../icons/LuxIcons'
import './AudioSpectrumTitan.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BAND_COUNT = 32
const PEAK_HOLD_FRAMES = 30 // ~500ms at 60fps
const PEAK_DECAY_RATE = 0.02

// Frequency labels for display
const FREQ_LABELS = [
  { label: 'SUB', position: 0, freq: '20-60Hz' },
  { label: 'BASS', position: 4, freq: '60-250Hz' },
  { label: 'LOW-MID', position: 10, freq: '250-500Hz' },
  { label: 'MID', position: 16, freq: '500Hz-2kHz' },
  { label: 'HIGH-MID', position: 22, freq: '2-6kHz' },
  { label: 'AIR', position: 28, freq: '6-20kHz' },
]

// Colors for spectrum gradient
const SPECTRUM_COLORS = [
  '#8b5cf6', // Sub - Purple
  '#6366f1', // Bass - Indigo
  '#3b82f6', // Low-mid - Blue
  '#22d3ee', // Mid - Cyan
  '#10b981', // High-mid - Emerald
  '#f59e0b', // Presence - Amber
  '#ef4444', // Air - Red
]

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interpola 3 valores (bass, mid, high) a 32 bandas con curva suave
 */
function interpolateTo32Bands(bass: number, mid: number, high: number): number[] {
  const bands: number[] = []
  
  // Control points: sub, bass, lowMid, mid, highMid, presence, brilliance
  const controlPoints = [
    bass * 0.6,      // 0-3: Sub
    bass * 0.9,      // 4-7: Bass peak
    bass * 0.7 + mid * 0.3,  // 8-11: Low-mid transition
    mid,             // 12-15: Mid
    mid * 0.8 + high * 0.2,  // 16-19: Mid-high transition
    high * 0.7,      // 20-23: High-mid
    high * 0.9,      // 24-27: Presence
    high * 0.6,      // 28-31: Air (brilliance)
  ]
  
  // Smooth interpolation
  for (let i = 0; i < BAND_COUNT; i++) {
    const segment = i / 4 // 0-7 (8 segments)
    const segmentIndex = Math.floor(segment)
    const segmentProgress = segment - segmentIndex
    
    const current = controlPoints[Math.min(segmentIndex, controlPoints.length - 1)]
    const next = controlPoints[Math.min(segmentIndex + 1, controlPoints.length - 1)]
    
    // Smooth step interpolation
    const t = segmentProgress * segmentProgress * (3 - 2 * segmentProgress)
    const value = current + (next - current) * t
    
    // Add slight randomness for organic feel (±5%)
    const variance = (Math.sin(i * 0.5 + Date.now() * 0.001) * 0.025 + 0.025)
    bands.push(Math.max(0, Math.min(1, value + variance)))
  }
  
  return bands
}

/**
 * Get color for band index
 */
function getBandColor(index: number): string {
  const segment = (index / BAND_COUNT) * (SPECTRUM_COLORS.length - 1)
  const colorIndex = Math.floor(segment)
  const nextIndex = Math.min(colorIndex + 1, SPECTRUM_COLORS.length - 1)
  
  // Return the base color for the segment
  return SPECTRUM_COLORS[colorIndex]
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AudioSpectrumTitan: React.FC = memo(() => {
  const audio = useTruthAudio()
  const beat = useTruthBeat()
  
  // Peak hold — refs only, no state (avoids double-render per audio frame)
  const peakHoldRef = useRef<number[]>(new Array(BAND_COUNT).fill(0))
  const peakHoldCounterRef = useRef<number[]>(new Array(BAND_COUNT).fill(0))
  
  // Interpolate to 32 bands AND compute peaks in a single memo pass
  const { bands, peaks } = useMemo(() => {
    const interpolated = interpolateTo32Bands(audio.bass, audio.mid, audio.high)
    
    // Peak hold update — mutating refs inside useMemo is safe here because
    // the computation is idempotent per unique input triple and refs are 
    // frame-persistent scratch space, not React state.
    const currentPeaks = peakHoldRef.current
    const counters = peakHoldCounterRef.current
    
    for (let i = 0; i < BAND_COUNT; i++) {
      const value = interpolated[i]
      if (value > currentPeaks[i]) {
        currentPeaks[i] = value
        counters[i] = PEAK_HOLD_FRAMES
      } else if (counters[i] > 0) {
        counters[i]--
      } else {
        currentPeaks[i] = Math.max(0, currentPeaks[i] - PEAK_DECAY_RATE)
      }
    }
    
    // Snapshot peaks for this render (slice to avoid aliasing the ref array)
    return { bands: interpolated, peaks: currentPeaks.slice() }
  }, [audio.bass, audio.mid, audio.high])
  
  // Calculate spectral flux (how much the spectrum is changing)
  const spectralFlux = useMemo(() => {
    const changes = bands.reduce((sum, val, i) => 
      sum + Math.abs(val - (peakHoldRef.current[i] || 0)), 0)
    return Math.min(1, changes / BAND_COUNT * 5)
  }, [bands])
  
  // Energy distribution
  const energyDist = useMemo(() => ({
    sub: bands.slice(0, 4).reduce((a, b) => a + b, 0) / 4,
    bass: bands.slice(4, 10).reduce((a, b) => a + b, 0) / 6,
    mid: bands.slice(10, 20).reduce((a, b) => a + b, 0) / 10,
    high: bands.slice(20, 32).reduce((a, b) => a + b, 0) / 12,
  }), [bands])
  
  // Dominant band
  const dominantBand = useMemo(() => {
    const max = Math.max(energyDist.sub, energyDist.bass, energyDist.mid, energyDist.high)
    if (max === energyDist.sub) return 'SUB'
    if (max === energyDist.bass) return 'BASS'
    if (max === energyDist.mid) return 'MID'
    return 'HIGH'
  }, [energyDist])

  return (
    <div className={`titan-card audio-spectrum-titan ${beat.onBeat ? 'audio-spectrum-titan--beat' : ''}`}>
      {/* Header */}
      <div className="titan-card__header">
        <div className="titan-card__title">
          <SpectrumBarsIcon size={18} color="var(--accent-primary)" />
          <span>AUDIO SPECTRUM</span>
          <span className="titan-card__subtitle">32 BANDS</span>
        </div>
        <div className="titan-card__status">
          <LiveDotIcon size={10} color="var(--accent-success)" />
          <span>LIVE</span>
        </div>
      </div>
      
      {/* Main spectrum visualization */}
      <div className="audio-spectrum-titan__visualizer">
        {/* Frequency labels */}
        <div className="audio-spectrum-titan__freq-labels">
          {FREQ_LABELS.map(({ label, position, freq }) => (
            <div 
              key={label}
              className="audio-spectrum-titan__freq-label"
              style={{ left: `${(position / BAND_COUNT) * 100}%` }}
              title={freq}
            >
              {label}
            </div>
          ))}
        </div>
        
        {/* Bars container */}
        <div className="audio-spectrum-titan__bars">
          {bands.map((value, i) => (
            <div 
              key={i}
              className="audio-spectrum-titan__bar-container"
            >
              {/* Peak indicator */}
              <div 
                className="audio-spectrum-titan__peak"
                style={{ 
                  bottom: `${peaks[i] * 100}%`,
                  backgroundColor: getBandColor(i),
                }}
              />
              
              {/* Main bar */}
              <div 
                className="audio-spectrum-titan__bar"
                style={{ 
                  height: `${value * 100}%`,
                  backgroundColor: getBandColor(i),
                }}
              />
            </div>
          ))}
        </div>
        
        {/* Grid lines */}
        <div className="audio-spectrum-titan__grid">
          <div className="audio-spectrum-titan__grid-line" style={{ bottom: '25%' }}>
            <span>25%</span>
          </div>
          <div className="audio-spectrum-titan__grid-line" style={{ bottom: '50%' }}>
            <span>50%</span>
          </div>
          <div className="audio-spectrum-titan__grid-line" style={{ bottom: '75%' }}>
            <span>75%</span>
          </div>
        </div>
      </div>
      
      {/* Bottom stats bar */}
      <div className="audio-spectrum-titan__stats">
        {/* BPM */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">BPM</span>
          <span className={`audio-spectrum-titan__stat-value ${beat.onBeat ? 'audio-spectrum-titan__stat-value--pulse' : ''}`}>
            {beat.bpm || '--'}
          </span>
          <div className="audio-spectrum-titan__confidence-bar">
            <div 
              className="audio-spectrum-titan__confidence-fill"
              style={{ width: `${(beat.confidence || 0) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Energy */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">ENERGY</span>
          <span className="audio-spectrum-titan__stat-value">
            {Math.round(audio.energy * 100)}%
          </span>
          <div className="audio-spectrum-titan__energy-bar">
            <div 
              className="audio-spectrum-titan__energy-fill"
              style={{ 
                width: `${audio.energy * 100}%`,
                background: audio.energy > 0.7 
                  ? 'linear-gradient(90deg, #f97316, #ef4444)' 
                  : 'linear-gradient(90deg, #22c55e, #10b981)'
              }}
            />
          </div>
        </div>
        
        {/* Spectral Flux */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">FLUX</span>
          <span className="audio-spectrum-titan__stat-value">
            {spectralFlux > 0.6 ? 'HIGH' : spectralFlux > 0.3 ? 'MED' : 'LOW'}
          </span>
          <div className="audio-spectrum-titan__flux-bar">
            <div 
              className="audio-spectrum-titan__flux-fill"
              style={{ width: `${spectralFlux * 100}%` }}
            />
          </div>
        </div>
        
        {/* Dominant */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">DOMINANT</span>
          <span className="audio-spectrum-titan__stat-value audio-spectrum-titan__stat-value--dominant">
            {dominantBand}
          </span>
        </div>
        
        {/* Energy Distribution Mini */}
        <div className="audio-spectrum-titan__stat audio-spectrum-titan__stat--distribution">
          <span className="audio-spectrum-titan__stat-label">DISTRIBUTION</span>
          <div className="audio-spectrum-titan__distribution">
            <div 
              className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--sub"
              style={{ width: `${energyDist.sub * 100}%` }}
              title={`Sub: ${Math.round(energyDist.sub * 100)}%`}
            />
            <div 
              className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--bass"
              style={{ width: `${energyDist.bass * 100}%` }}
              title={`Bass: ${Math.round(energyDist.bass * 100)}%`}
            />
            <div 
              className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--mid"
              style={{ width: `${energyDist.mid * 100}%` }}
              title={`Mid: ${Math.round(energyDist.mid * 100)}%`}
            />
            <div 
              className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--high"
              style={{ width: `${energyDist.high * 100}%` }}
              title={`High: ${Math.round(energyDist.high * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

AudioSpectrumTitan.displayName = 'AudioSpectrumTitan'

export default AudioSpectrumTitan
