/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔢 INPUT CONSTANT CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IInputConstantConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const InputConstantConfigPanel: React.FC<ConfigPanelProps<IInputConstantConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Value (0.0 – 1.0)</label>
      <input
        type="range"
        className="cp-range"
        value={config.value}
        min={0}
        max={1}
        step={0.001}
        onChange={(e) => onChange({ value: parseFloat(e.target.value) })}
      />
      <span className="cp-range__value">{config.value.toFixed(3)}</span>
    </div>
    <div className="cp-field">
      <label className="cp-label">Exact Value</label>
      <input
        type="number"
        className="cp-input"
        value={config.value}
        min={0}
        max={1}
        step={0.001}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange({ value: Math.max(0, Math.min(1, v)) })
        }}
      />
    </div>
  </div>
)
