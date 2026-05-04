/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚪 LOGIC GATE CONFIG PANEL — WAVE 4548.10
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Panel para nodos logic_gate: configura el umbral de apertura de la puerta.
 * Si gate > threshold → señal pasa sin cambios.
 * Si gate ≤ threshold → emite 0.
 *
 * @module components/views/ForgeView/inspector/panels/LogicGateConfigPanel
 */
import React from 'react'
import type { ILogicGateConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const LogicGateConfigPanel: React.FC<ConfigPanelProps<ILogicGateConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">
        Gate Threshold
        <span className="cp-range__value">{config.threshold.toFixed(2)}</span>
      </label>
      <input
        type="range"
        className="cp-range"
        min={0}
        max={1}
        step={0.01}
        value={config.threshold}
        onChange={(e) => onChange({ threshold: parseFloat(e.target.value) })}
      />
      <span className="cp-label" style={{ fontSize: '10px', opacity: 0.55 }}>
        gate &gt; {config.threshold.toFixed(2)} → señal pasa · si no → 0
      </span>
    </div>
  </div>
)
