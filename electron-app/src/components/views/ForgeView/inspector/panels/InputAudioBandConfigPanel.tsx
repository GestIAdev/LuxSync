/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎵 INPUT AUDIO BAND CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IInputAudioBandConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

const BAND_LABELS: Record<IInputAudioBandConfig['band'], string> = {
  subBass:  'Sub Bass (20–60 Hz)',
  bass:     'Bass (60–250 Hz)',
  lowMid:   'Low Mid (250–500 Hz)',
  mid:      'Mid (500–2k Hz)',
  highMid:  'High Mid (2k–6k Hz)',
  treble:   'Treble (6k–16k Hz)',
  ultraAir: 'Ultra Air (16k–22k Hz)',
}

export const InputAudioBandConfigPanel: React.FC<ConfigPanelProps<IInputAudioBandConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Frequency Band</label>
      <select
        className="cp-select"
        value={config.band}
        onChange={(e) => onChange({ band: e.target.value as IInputAudioBandConfig['band'] })}
      >
        {(Object.keys(BAND_LABELS) as IInputAudioBandConfig['band'][]).map((band) => (
          <option key={band} value={band}>
            {BAND_LABELS[band]}
          </option>
        ))}
      </select>
    </div>
  </div>
)
