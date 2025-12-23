/**
 * 🔌 POWER BUTTON - WAVE 63.8
 * 
 * Botón de encendido global del sistema Selene.
 * 
 * Estados visuales:
 * - OFFLINE: Rojo pulsante (invita a presionar)
 * - STARTING: Amarillo con spin
 * - ONLINE: Cyan/Verde fijo (sistema activo)
 */

import React from 'react'
import { useSystemPower } from '../../../../hooks/useSystemPower'
import './PowerButton.css'

export const PowerButton: React.FC = () => {
  const { powerState, isStarting, togglePower } = useSystemPower()
  
  const stateClass = powerState.toLowerCase()
  
  return (
    <button
      className={`power-button power-${stateClass}`}
      onClick={togglePower}
      disabled={isStarting}
      title={
        powerState === 'OFFLINE' 
          ? 'Click to power ON' 
          : powerState === 'STARTING'
          ? 'Starting...'
          : 'Click to power OFF'
      }
    >
      <div className="power-icon">
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Power icon: vertical line + arc */}
          <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" />
          <path 
            d="M18.36 6.64A9 9 0 0 1 12 21a9 9 0 0 1-6.36-2.64A9 9 0 0 1 5.64 6.64" 
            stroke="currentColor"
            fill="none"
          />
        </svg>
      </div>
      
      {/* Glow ring for pulsing effect */}
      <div className="power-glow" />
      
      {/* Spinner for starting state */}
      {isStarting && <div className="power-spinner" />}
    </button>
  )
}

export default PowerButton
