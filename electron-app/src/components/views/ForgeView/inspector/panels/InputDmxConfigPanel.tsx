/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📥 INPUT DMX CONFIG PANEL — WAVE 4548.8g
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IInputDmxConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

const COMMON_CHANNEL_KEYS = [
  'dimmer', 'red', 'green', 'blue', 'white', 'amber', 'uv',
  'pan', 'pan_fine', 'tilt', 'tilt_fine',
  'shutter', 'strobe', 'zoom', 'focus', 'gobo', 'prism',
  'color_wheel', 'speed', 'macro', 'control', 'rotation',
]

export const InputDmxConfigPanel: React.FC<ConfigPanelProps<IInputDmxConfig>> = ({
  config,
  onChange,
}) => {
  const usesCustomKey = !COMMON_CHANNEL_KEYS.includes(config.channelKey)
  const selectedKey = usesCustomKey ? '__custom__' : config.channelKey

  return (
    <div className="config-panel">
      <div className="cp-field">
        <label className="cp-label">Intent Channel</label>
        <select
          className="cp-select"
          value={selectedKey}
          onChange={(e) => {
            const value = e.target.value
            if (value === '__custom__') {
              onChange({ channelKey: config.channelKey || 'custom' })
              return
            }

            onChange({ channelKey: value })
          }}
        >
          {COMMON_CHANNEL_KEYS.map((channelKey) => (
            <option key={channelKey} value={channelKey}>{channelKey}</option>
          ))}
          <option value="__custom__">custom</option>
        </select>
      </div>

      {usesCustomKey && (
        <div className="cp-field">
          <label className="cp-label">Custom Channel Key</label>
          <input
            type="text"
            className="cp-input"
            value={config.channelKey}
            maxLength={48}
            onChange={(e) => onChange({ channelKey: e.target.value.trim() || 'custom' })}
          />
        </div>
      )}
    </div>
  )
}