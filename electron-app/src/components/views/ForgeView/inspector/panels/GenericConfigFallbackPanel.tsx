import React from 'react'
import type { IForgeNodeConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

export interface GenericConfigFallbackPanelProps {
  config: IForgeNodeConfig
  onChange?: (partial: Partial<IForgeNodeConfig>) => void
  warning?: string
}

export const GenericConfigFallbackPanel: React.FC<GenericConfigFallbackPanelProps> = ({
  config,
  warning,
}) => {
  const entries = Object.entries(config ?? {})

  return (
    <div className="ni-generic-config">
      {warning ? (
        <p className="ni-generic-config__notice" style={{ color: '#ffb800' }}>
          {warning}
        </p>
      ) : (
        <p className="ni-generic-config__notice">
          No dedicated panel yet for this node type. Showing raw config snapshot.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="ni-generic-config__empty">This node has no config fields.</p>
      ) : (
        <div className="ni-generic-config__list">
          {entries.map(([key, value]) => (
            <div className="ni-generic-config__row" key={key}>
              <span className="ni-generic-config__key">{key}</span>
              <span className="ni-generic-config__value">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const InputBeatFallbackPanel: React.FC<ConfigPanelProps<any>> = (props) => (
  <GenericConfigFallbackPanel {...props} warning="Beat panel en construcción" />
)

export const InputBpmFallbackPanel: React.FC<ConfigPanelProps<any>> = (props) => (
  <GenericConfigFallbackPanel {...props} warning="BPM panel en construcción" />
)

export const InputEnergyFallbackPanel: React.FC<ConfigPanelProps<any>> = (props) => (
  <GenericConfigFallbackPanel {...props} warning="Energy panel en construcción" />
)

export const InputTimeFallbackPanel: React.FC<ConfigPanelProps<any>> = (props) => (
  <GenericConfigFallbackPanel {...props} warning="Time panel en construcción" />
)
