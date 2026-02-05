/**
 * ⚡ ENERGY METER - WAVE 1167
 * Barra de energía con indicador de tendencia
 */

import React from 'react'
import { TrendUpIcon, TrendDownIcon, TrendStableIcon } from '../../icons/LuxIcons'

export interface EnergyMeterProps {
  energy: number
  trend: 'rising' | 'falling' | 'stable'
}

/**
 * ⚡ Medidor de energía con tendencia
 */
export const EnergyMeter: React.FC<EnergyMeterProps> = ({ 
  energy, 
  trend 
}) => {
  const energyPercent = Math.round(energy * 100)
  
  // Seleccionar icono y color según tendencia
  const TrendIcon = trend === 'rising' 
    ? TrendUpIcon 
    : trend === 'falling' 
      ? TrendDownIcon 
      : TrendStableIcon
  
  const trendColor = trend === 'rising' 
    ? '#22c55e' 
    : trend === 'falling' 
      ? '#ef4444' 
      : '#fbbf24'

  // Color de la barra según nivel de energía
  const getEnergyColor = () => {
    if (energy > 0.8) return 'var(--accent-danger)'
    if (energy > 0.6) return 'var(--accent-warning)'
    if (energy > 0.4) return 'var(--accent-primary)'
    return 'var(--accent-secondary)'
  }

  return (
    <div className="energy-meter">
      <span className="energy-meter__label">ENERGY</span>
      <div className="energy-meter__bar">
        <div 
          className="energy-meter__fill"
          style={{ 
            width: `${energyPercent}%`,
            background: getEnergyColor(),
            boxShadow: energy > 0.7 ? `0 0 10px ${getEnergyColor()}` : 'none'
          }}
        />
        {/* Marcas de threshold */}
        <div className="energy-meter__threshold" style={{ left: '40%' }} />
        <div className="energy-meter__threshold" style={{ left: '70%' }} />
      </div>
      <span className="energy-meter__value">{energyPercent}%</span>
      <TrendIcon size={16} color={trendColor} className="energy-meter__trend" />
    </div>
  )
}

export default EnergyMeter
