/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ LOGIC THRESHOLD CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { ILogicThresholdConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const LogicThresholdConfigPanel: React.FC<ConfigPanelProps<ILogicThresholdConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Threshold (0.0 – 1.0)</label>
      <input
        type="range"
        className="cp-range"
        value={config.threshold}
        min={0}
        max={1}
        step={0.01}
        onChange={(e) => onChange({ threshold: parseFloat(e.target.value) })}
      />
      <span className="cp-range__value">{config.threshold.toFixed(2)}</span>
    </div>
    <div className="cp-field">
      <label className="cp-label">Hysteresis (dead zone)</label>
      <input
        type="range"
        className="cp-range"
        value={config.hysteresis}
        min={0}
        max={0.2}
        step={0.005}
        onChange={(e) => onChange({ hysteresis: parseFloat(e.target.value) })}
      />
      <span className="cp-range__value">{config.hysteresis.toFixed(3)}</span>
    </div>
  </div>
)
