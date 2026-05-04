/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📐 PROC CLAMP CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcClampConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const ProcClampConfigPanel: React.FC<ConfigPanelProps<IProcClampConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-row">
      <div className="cp-field cp-field--half">
        <label className="cp-label">Min</label>
        <input
          type="number"
          className="cp-input"
          value={config.min}
          min={0}
          max={config.max}
          step={0.01}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ min: Math.min(v, config.max) })
          }}
        />
      </div>
      <div className="cp-field cp-field--half">
        <label className="cp-label">Max</label>
        <input
          type="number"
          className="cp-input"
          value={config.max}
          min={config.min}
          max={1}
          step={0.01}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ max: Math.max(v, config.min) })
          }}
        />
      </div>
    </div>
  </div>
)
