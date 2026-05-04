/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱️ PROC DELAY CONFIG PANEL — WAVE 4548.9
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from 'react'
import type { IProcDelayConfig } from '../../../../../core/forge/types'
import type { ConfigPanelProps } from '../configPanelRegistry'
import './ConfigPanel.css'

// A 44Hz: 1 frame ≈ 22.7ms
const FRAME_MS = 1000 / 44

export const ProcDelayConfigPanel: React.FC<ConfigPanelProps<IProcDelayConfig>> = ({
  config,
  onChange,
}) => (
  <div className="config-panel">
    <div className="cp-field">
      <label className="cp-label">Delay Frames</label>
      <input
        type="number"
        className="cp-input"
        value={config.delayFrames}
        min={0}
        max={256}
        step={1}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v) && v >= 0) onChange({ delayFrames: v })
        }}
      />
    </div>
    <div className="cp-field">
      <label className="cp-label" style={{ opacity: 0.5 }}>≈ {(config.delayFrames * FRAME_MS).toFixed(0)} ms</label>
    </div>
  </div>
)
