/**
 * 🔌 DEVICES TAB - Audio & DMX Configuration
 * WAVE 26 Phase 1: Placeholder
 * 
 * TODO Phase 2:
 * - Audio source selector (Mic/System/Simulation)
 * - Audio device dropdown
 * - Peak meter with gain staging
 * - DMX driver selector
 * - COM port dropdown
 * - Auto-detect button
 */

import React from 'react'
import './TabPlaceholder.css'

export const DevicesTab: React.FC = () => {
  return (
    <div className="tab-placeholder">
      <div className="placeholder-icon">🔌</div>
      <h2 className="placeholder-title">DEVICES</h2>
      <p className="placeholder-subtitle">Audio & DMX Configuration</p>
      
      <div className="placeholder-roadmap">
        <h3>Coming in Phase 2:</h3>
        <ul>
          <li>🎤 Audio Source Selector</li>
          <li>📊 Peak Meter + Gain Staging</li>
          <li>🔌 DMX Driver Selection</li>
          <li>📡 COM Port Auto-Detect</li>
        </ul>
      </div>
      
      <div className="placeholder-badge">Work in Progress</div>
    </div>
  )
}

export default DevicesTab
