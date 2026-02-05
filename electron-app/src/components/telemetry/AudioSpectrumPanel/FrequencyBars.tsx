/**
 * 📊 FREQUENCY BARS - WAVE 1167
 * Visualización de 7 bandas de frecuencia con animación
 */

import React from 'react'

export interface FrequencyBarsProps {
  spectrum: {
    subBass: number
    bass: number
    lowMid: number
    mid: number
    highMid: number
    presence: number
    brilliance: number
  }
  onBeat: boolean
}

const BANDS = [
  { key: 'subBass', label: 'SUB', color: '#6366f1' },
  { key: 'bass', label: 'BAS', color: '#8b5cf6' },
  { key: 'lowMid', label: 'L-M', color: '#a855f7' },
  { key: 'mid', label: 'MID', color: '#d946ef' },
  { key: 'highMid', label: 'H-M', color: '#ec4899' },
  { key: 'presence', label: 'PRS', color: '#f43f5e' },
  { key: 'brilliance', label: 'BRL', color: '#ef4444' },
] as const

/**
 * 📊 7 barras de espectro de frecuencia
 */
export const FrequencyBars: React.FC<FrequencyBarsProps> = ({ 
  spectrum, 
  onBeat 
}) => {
  return (
    <div className={`frequency-bars ${onBeat ? 'frequency-bars--on-beat' : ''}`}>
      <div className="frequency-bars__container">
        {BANDS.map(({ key, label, color }) => {
          const value = spectrum[key]
          const height = Math.max(4, value * 100) // Min 4% para visibilidad
          
          return (
            <div key={key} className="frequency-bar">
              <div className="frequency-bar__track">
                <div 
                  className="frequency-bar__fill"
                  style={{ 
                    height: `${height}%`,
                    background: `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`,
                    boxShadow: value > 0.7 ? `0 0 12px ${color}` : 'none'
                  }}
                />
              </div>
              <span className="frequency-bar__label">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FrequencyBars
