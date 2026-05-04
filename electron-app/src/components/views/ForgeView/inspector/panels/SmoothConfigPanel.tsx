/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 〜 SMOOTH CONFIG PANEL — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcSmoothConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const SmoothConfigPanel: React.FC<ConfigPanelProps<IProcSmoothConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Attack (ms)</label>
      <input
        type="number"
        className="cp-input"
        value={config.attackMs}
        min={0}
        max={5000}
        step={1}
        onChange={(e) => onChange({ attackMs: parseInt(e.target.value, 10) })}
      />
    </div>
    <div className="cp-field">
      <label className="cp-label">Release (ms)</label>
      <input
        type="number"
        className="cp-input"
        value={config.releaseMs}
        min={0}
        max={5000}
        step={1}
        onChange={(e) => onChange({ releaseMs: parseInt(e.target.value, 10) })}
      />
    </div>
  </div>
)
