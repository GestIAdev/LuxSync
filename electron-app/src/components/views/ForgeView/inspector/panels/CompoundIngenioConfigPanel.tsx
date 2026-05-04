/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 COMPOUND INGENIO CONFIG PANEL — WAVE 4548.11
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Panel de solo lectura para instancias de Ingenio compuesto.
 * La edición de la lógica interna se hace en la librería de Ingenios,
 * no en el canvas principal.
 */
import React from 'react'
import type { ICompoundIngenioConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export const CompoundIngenioConfigPanel: React.FC<ConfigPanelProps<ICompoundIngenioConfig>> = ({
  config,
}) => {
  const inputCount = config.portMapping.inputs.length
  const outputCount = config.portMapping.outputs.length

  return (
    <div className="config-panel">
      <div className="cp-field">
        <label className="cp-label">Ingenio Name</label>
        <input className="cp-input" type="text" value={config.ingenioName} readOnly />
      </div>

      <div className="cp-field">
        <label className="cp-label">Exposed Ports Summary</label>
        <div className="cp-summary-line">
          <span>Inputs</span>
          <span className="cp-summary-value">{inputCount} IN</span>
        </div>
        <div className="cp-summary-line">
          <span>Outputs</span>
          <span className="cp-summary-value">{outputCount} OUT</span>
        </div>
      </div>

      <div className="cp-readonly-note">
        La logica interna de este Ingenio es de solo lectura en este contexto.
      </div>
    </div>
  )
}
