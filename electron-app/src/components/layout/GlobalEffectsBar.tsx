/**
 * ⚡ GLOBAL EFFECTS BAR - Always Visible Bottom Bar
 * WAVE 9: Efectos instantáneos + Blackout Master
 */

import React from 'react'
import { useEffectsStore, EFFECTS, EffectId } from '../../stores/effectsStore'
import './GlobalEffectsBar.css'

const GlobalEffectsBar: React.FC = () => {
  const { blackout, activeEffects, toggleEffect, toggleBlackout } = useEffectsStore()

  return (
    <footer className="effects-bar">
      {/* Effect Buttons */}
      <div className="effects-buttons">
        {EFFECTS.map((effect) => (
          <button
            key={effect.id}
            className={`effect-btn ${activeEffects.has(effect.id) ? 'active' : ''} ${blackout ? 'disabled' : ''}`}
            onClick={() => toggleEffect(effect.id)}
            disabled={blackout}
            title={`${effect.description} [${effect.shortcut}]`}
          >
            <span className="effect-icon">{effect.icon}</span>
            <span className="effect-label">{effect.label}</span>
            <span className="effect-shortcut">[{effect.shortcut}]</span>
          </button>
        ))}
      </div>

      {/* Blackout Master Button */}
      <button
        className={`blackout-btn ${blackout ? 'active' : ''}`}
        onClick={toggleBlackout}
        title="BLACKOUT - All lights off [SPACE]"
      >
        <span className="blackout-icon">███</span>
        <span className="blackout-label">BLACKOUT</span>
        <span className="blackout-shortcut">[SPACE]</span>
      </button>
    </footer>
  )
}

export default GlobalEffectsBar
