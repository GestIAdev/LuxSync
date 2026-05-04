/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ↔ MAP RANGE CONFIG PANEL — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcMapRangeConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const MapRangeConfigPanel: React.FC<ConfigPanelProps<IProcMapRangeConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-row">
      <div className="cp-field cp-field--half">
        <label className="cp-label">In Min</label>
        <input
          type="number" className="cp-input" value={config.inputMin}
          step={0.01} onChange={(e) => onChange({ inputMin: parseFloat(e.target.value) })}
        />
      </div>
      <div className="cp-field cp-field--half">
        <label className="cp-label">In Max</label>
        <input
          type="number" className="cp-input" value={config.inputMax}
          step={0.01} onChange={(e) => onChange({ inputMax: parseFloat(e.target.value) })}
        />
      </div>
    </div>
    <div className="cp-row">
      <div className="cp-field cp-field--half">
        <label className="cp-label">Out Min</label>
        <input
          type="number" className="cp-input" value={config.outputMin}
          step={0.01} onChange={(e) => onChange({ outputMin: parseFloat(e.target.value) })}
        />
      </div>
      <div className="cp-field cp-field--half">
        <label className="cp-label">Out Max</label>
        <input
          type="number" className="cp-input" value={config.outputMax}
          step={0.01} onChange={(e) => onChange({ outputMax: parseFloat(e.target.value) })}
        />
      </div>
    </div>
  </div>
)
