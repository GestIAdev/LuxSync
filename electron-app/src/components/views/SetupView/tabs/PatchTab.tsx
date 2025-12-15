/**
 * 💡 PATCH TAB - Fixture Patching & Configuration
 * WAVE 26 Phase 1: Placeholder
 * 
 * TODO Phase 2:
 * - Visual patch grid
 * - Fixture list with live colors
 * - DMX address assignment
 * - Fixture test mode (ramp colors)
 * - Import from file (.fxt)
 */

import React from 'react'
import './TabPlaceholder.css'

export const PatchTab: React.FC = () => {
  return (
    <div className="tab-placeholder">
      <div className="placeholder-icon">💡</div>
      <h2 className="placeholder-title">PATCH</h2>
      <p className="placeholder-subtitle">Fixture Patching & Configuration</p>
      
      <div className="placeholder-roadmap">
        <h3>Coming in Phase 2:</h3>
        <ul>
          <li>🎨 Visual Patch Grid</li>
          <li>💡 Fixture List with Live Colors</li>
          <li>🔢 DMX Address Assignment</li>
          <li>🧪 Fixture Test Mode</li>
        </ul>
      </div>
      
      <div className="placeholder-badge">Work in Progress</div>
    </div>
  )
}

export default PatchTab
