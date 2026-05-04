/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️  LFO CONFIG PANEL — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcLfoConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const LfoConfigPanel: React.FC<ConfigPanelProps<IProcLfoConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Waveform</label>
      <select
        className="cp-select"
        value={config.waveform}
        onChange={(e) => onChange({ waveform: e.target.value as IProcLfoConfig['waveform'] })}
      >
        <option value="sine">Sine ∿</option>
        <option value="triangle">Triangle △</option>
        <option value="sawtooth">Sawtooth /</option>
        <option value="square">Square □</option>
        <option value="random_hold">Random Hold ⌐</option>
      </select>
    </div>

    <div className="cp-field">
      <label className="cp-label">BPM Sync</label>
      <label className="cp-toggle">
        <input
          type="checkbox"
          checked={config.syncToBpm}
          onChange={(e) => onChange({ syncToBpm: e.target.checked })}
        />
        <span className="cp-toggle__track" />
        <span className="cp-toggle__text">{config.syncToBpm ? 'ON' : 'OFF'}</span>
      </label>
    </div>

    {config.syncToBpm ? (
      <div className="cp-field">
        <label className="cp-label">BPM Divisor</label>
        <input
          type="number"
          className="cp-input"
          value={config.bpmDivisor}
          min={0.125}
          max={32}
          step={0.125}
          onChange={(e) => onChange({ bpmDivisor: parseFloat(e.target.value) })}
        />
      </div>
    ) : (
      <div className="cp-field">
        <label className="cp-label">Frequency (Hz)</label>
        <input
          type="number"
          className="cp-input"
          value={config.frequencyHz}
          min={0.01}
          max={100}
          step={0.01}
          onChange={(e) => onChange({ frequencyHz: parseFloat(e.target.value) })}
        />
      </div>
    )}

    <div className="cp-field">
      <label className="cp-label">Phase (0–1)</label>
      <input
        type="range"
        className="cp-range"
        value={config.phase}
        min={0}
        max={1}
        step={0.01}
        onChange={(e) => onChange({ phase: parseFloat(e.target.value) })}
      />
      <span className="cp-range__value">{config.phase.toFixed(2)}</span>
    </div>
  </div>
)
