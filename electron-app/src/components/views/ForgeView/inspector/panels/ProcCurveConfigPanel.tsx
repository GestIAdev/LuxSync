/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 〜 PROC CURVE CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcCurveConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const ProcCurveConfigPanel: React.FC<ConfigPanelProps<IProcCurveConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Curve Type</label>
      <select
        className="cp-select"
        value={config.curveType}
        onChange={(e) => onChange({ curveType: e.target.value as IProcCurveConfig['curveType'] })}
      >
        <option value="linear">Linear —</option>
        <option value="exponential">Exponential ↗</option>
        <option value="logarithmic">Logarithmic ↖</option>
        <option value="scurve">S-Curve ∫</option>
        <option value="gamma">Gamma γ</option>
      </select>
    </div>

    {config.curveType === 'exponential' && (
      <div className="cp-field">
        <label className="cp-label">Exponent</label>
        <input
          type="number"
          className="cp-input"
          value={config.exponent ?? 2}
          min={0.1}
          max={10}
          step={0.1}
          onChange={(e) => onChange({ exponent: parseFloat(e.target.value) })}
        />
      </div>
    )}

    {config.curveType === 'gamma' && (
      <div className="cp-field">
        <label className="cp-label">Gamma</label>
        <input
          type="number"
          className="cp-input"
          value={config.gamma ?? 2.2}
          min={0.1}
          max={5}
          step={0.01}
          onChange={(e) => onChange({ gamma: parseFloat(e.target.value) })}
        />
      </div>
    )}
  </div>
)
