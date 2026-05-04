/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⊕ PROC MERGE CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcMergeConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const ProcMergeConfigPanel: React.FC<ConfigPanelProps<IProcMergeConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Merge Strategy</label>
      <select
        className="cp-select"
        value={config.strategy}
        onChange={(e) => onChange({ strategy: e.target.value as IProcMergeConfig['strategy'] })}
      >
        <option value="max">Max — Highest wins</option>
        <option value="min">Min — Lowest wins</option>
        <option value="average">Average — Mean of all</option>
        <option value="sum">Sum — Additive (clipped)</option>
      </select>
    </div>
  </div>
)
