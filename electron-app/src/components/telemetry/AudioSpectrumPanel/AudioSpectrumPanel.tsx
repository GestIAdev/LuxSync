/**
 * 🎵 AUDIO SPECTRUM PANEL - WAVE 1167
 * Visualización de espectro de 7 bandas + BPM gauge + Energy meter
 * 
 * Reemplaza al legacy AudioOscilloscope (WAVE 29)
 * 
 * Datos consumidos:
 * - sensory.audio: { energy, bass, mid, high, peak, average }
 * - sensory.beat: { bpm, onBeat, confidence, beatPhase, barPhase }
 */

import React, { useMemo } from 'react'
import { useTruthAudio, useTruthBeat } from '../../../hooks/useSeleneTruth'
import { SpectrumBarsIcon, LiveDotIcon } from '../../icons/LuxIcons'
import { FrequencyBars } from './FrequencyBars'
import { BPMGauge } from './BPMGauge'
import { EnergyMeter } from './EnergyMeter'
import './AudioSpectrumPanel.css'

export interface AudioSpectrumPanelProps {
  className?: string
}

/**
 * 🎵 Panel principal de espectro de audio
 * Muestra 7 bandas de frecuencia, BPM con confidence, y energía total
 */
export const AudioSpectrumPanel: React.FC<AudioSpectrumPanelProps> = ({ 
  className = '' 
}) => {
  const audio = useTruthAudio()
  const beat = useTruthBeat()

  // Derivar 7 bandas desde los 3 valores base (bass, mid, high)
  const spectrum = useMemo(() => ({
    subBass: Math.min(1, audio.bass * 0.6),      // 20-60Hz
    bass: audio.bass,                             // 60-250Hz  
    lowMid: Math.min(1, audio.mid * 0.7),        // 250-500Hz
    mid: audio.mid,                               // 500Hz-2kHz
    highMid: Math.min(1, audio.mid * 1.2),       // 2-4kHz
    presence: Math.min(1, audio.high * 0.8),     // 4-6kHz
    brilliance: audio.high,                       // 6-20kHz
  }), [audio.bass, audio.mid, audio.high])

  // Calcular tendencia de energía basada en peak vs average
  const energyTrend = useMemo(() => {
    const diff = audio.peak - audio.average
    if (diff > 0.15) return 'rising'
    if (diff < -0.1) return 'falling'
    return 'stable'
  }, [audio.peak, audio.average])

  return (
    <div className={`neural-card audio-spectrum-panel ${className}`}>
      {/* Header */}
      <div className="neural-card-header">
        <div className="neural-card-title">
          <SpectrumBarsIcon size={16} color="var(--accent-primary)" />
          <span>AUDIO SPECTRUM</span>
        </div>
        <div className="neural-card-status">
          <LiveDotIcon size={12} />
          <span>LIVE</span>
        </div>
      </div>

      {/* Body */}
      <div className="neural-card-body">
        {/* Barras de frecuencia - 7 bandas */}
        <FrequencyBars 
          spectrum={spectrum} 
          onBeat={beat.onBeat}
        />

        {/* BPM Gauge con confidence */}
        <BPMGauge 
          bpm={beat.bpm}
          confidence={beat.confidence}
          onBeat={beat.onBeat}
          beatPhase={beat.beatPhase}
        />

        {/* Energy Meter */}
        <EnergyMeter 
          energy={audio.energy}
          trend={energyTrend}
        />
      </div>
    </div>
  )
}

export default AudioSpectrumPanel
