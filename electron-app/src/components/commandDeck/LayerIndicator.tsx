/**
 * 🎚️ LAYER INDICATOR - WAVE 375
 * Shows which layer is currently controlling: AI or Manual
 */

import React from 'react'
import { Bot, SlidersHorizontal } from 'lucide-react'
import './CommandDeck.css'

interface LayerIndicatorProps {
  hasManualOverrides: boolean
  onKillAll: () => void
}

export const LayerIndicator: React.FC<LayerIndicatorProps> = ({
  hasManualOverrides,
  onKillAll
}) => {
  return (
    <div className="layer-indicator">
      <div className="layer-title">SOURCE</div>
      
      <div className="layer-buttons">
        {/* AI Layer */}
        <div className={`layer-btn ${!hasManualOverrides ? 'active ai' : ''}`}>
          <Bot size={18} />
          <span>AI</span>
        </div>
        
        {/* Manual Layer */}
        <div className={`layer-btn ${hasManualOverrides ? 'active manual' : ''}`}>
          <SlidersHorizontal size={18} />
          <span>MANUAL</span>
        </div>
      </div>
      
      {/* Kill All Button */}
      <button 
        className="kill-all-btn"
        onClick={onKillAll}
        disabled={!hasManualOverrides}
        title="Release All Manual Overrides [ESC]"
      >
        KILL ALL
        <span className="shortcut">ESC</span>
      </button>
    </div>
  )
}
