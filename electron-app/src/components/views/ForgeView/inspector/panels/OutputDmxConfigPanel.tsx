/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📤 OUTPUT DMX CONFIG PANEL — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IOutputDmxConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

const CHANNEL_TYPES = [
  'dimmer', 'red', 'green', 'blue', 'white', 'amber', 'uv',
  'pan', 'pan_fine', 'tilt', 'tilt_fine',
  'shutter', 'strobe', 'zoom', 'focus', 'gobo', 'prism',
  'color_wheel', 'speed', 'macro', 'control', 'rotation', 'custom',
]

export const OutputDmxConfigPanel: React.FC<ConfigPanelProps<IOutputDmxConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Channel Type</label>
      <select
        className="cp-select"
        value={config.channelType}
        onChange={(e) =>
          onChange({ channelType: e.target.value as IOutputDmxConfig['channelType'] })
        }
      >
        {CHANNEL_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>

    <div className="cp-field">
      <label className="cp-label">DMX Offset</label>
      <input
        type="number"
        className="cp-input"
        value={config.dmxOffset}
        min={0}
        max={511}
        step={1}
        onChange={(e) => onChange({ dmxOffset: parseInt(e.target.value, 10) })}
      />
    </div>

    <div className="cp-field">
      <label className="cp-label">Default (0–255)</label>
      <input
        type="number"
        className="cp-input"
        value={config.defaultDmxValue}
        min={0}
        max={255}
        step={1}
        onChange={(e) => onChange({ defaultDmxValue: parseInt(e.target.value, 10) })}
      />
    </div>

    <div className="cp-field">
      <label className="cp-label">16-bit</label>
      <label className="cp-toggle">
        <input
          type="checkbox"
          checked={!!config.is16bit}
          onChange={(e) => onChange({ is16bit: e.target.checked })}
        />
        <span className="cp-toggle__track" />
        <span className="cp-toggle__text">{config.is16bit ? 'YES' : 'NO'}</span>
      </label>
    </div>

    {config.channelType === 'custom' && (
      <div className="cp-field">
        <label className="cp-label">Channel Name</label>
        <input
          type="text"
          className="cp-input"
          value={config.channelName ?? ''}
          maxLength={32}
          onChange={(e) => onChange({ channelName: e.target.value })}
        />
      </div>
    )}
  </div>
)
