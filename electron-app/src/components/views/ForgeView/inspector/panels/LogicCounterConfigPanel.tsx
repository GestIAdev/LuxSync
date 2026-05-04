/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔢 LOGIC COUNTER CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { ILogicCounterConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const LogicCounterConfigPanel: React.FC<ConfigPanelProps<ILogicCounterConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Modulo (reset at N)</label>
      <input
        type="number"
        className="cp-input"
        value={config.modulo}
        min={1}
        max={1024}
        step={1}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= 1) onChange({ modulo: v })
        }}
      />
    </div>
    <div className="cp-field">
      <label className="cp-label">Emit Normalized</label>
      <label className="cp-toggle">
        <input
          type="checkbox"
          checked={config.emitNormalized}
          onChange={(e) => onChange({ emitNormalized: e.target.checked })}
        />
        <span className="cp-toggle__track" />
        <span className="cp-toggle__text">
          {config.emitNormalized ? 'count ÷ modulo (0–1)' : 'raw count'}
        </span>
      </label>
    </div>
  </div>
)
