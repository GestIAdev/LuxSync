/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ➕ MATH CONFIG PANEL — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcMathConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const MathConfigPanel: React.FC<ConfigPanelProps<IProcMathConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Operation</label>
      <select
        className="cp-select"
        value={config.operation}
        onChange={(e) => onChange({ operation: e.target.value as IProcMathConfig['operation'] })}
      >
        <option value="add">Add  (+)</option>
        <option value="subtract">Subtract  (−)</option>
        <option value="multiply">Multiply  (×)</option>
        <option value="divide">Divide  (÷)</option>
        <option value="modulo">Modulo  (%)</option>
        <option value="power">Power  (^)</option>
      </select>
    </div>
  </div>
)
