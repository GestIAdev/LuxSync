/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔀 LOGIC SWITCH CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { ILogicSwitchConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const LogicSwitchConfigPanel: React.FC<ConfigPanelProps<ILogicSwitchConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Switch Threshold</label>
      <input
        type="range"
        className="cp-range"
        value={config.switchThreshold}
        min={0}
        max={1}
        step={0.01}
        onChange={(e) => onChange({ switchThreshold: parseFloat(e.target.value) })}
      />
      <span className="cp-range__value">{config.switchThreshold.toFixed(2)}</span>
    </div>
    <div className="cp-field" style={{ opacity: 0.5, fontSize: '10px', lineHeight: 1.4 }}>
      <span className="cp-label" style={{ fontStyle: 'italic' }}>
        selector &gt; {config.switchThreshold.toFixed(2)} → input_b
      </span>
    </div>
  </div>
)
