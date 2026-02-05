/**
 * 🔮 PREDICTION CARD - WAVE 1169/1172/1176
 * Predicciones activas con countdown
 * 
 * WAVE 1169: Si no hay predicción, muestra tendencia de energía
 * WAVE 1172: Si energyTrend === 'rising', mostrar "⚠️ ENERGY BUILDING"
 * WAVE 1176: OPERATION SNIPER - Mostrar slope crudo para debugging
 */

import React, { useMemo } from 'react'
import { PredictionOrbIcon, LightningStrikeIcon, TrendUpIcon, TrendDownIcon, TrendStableIcon } from '../../icons/LuxIcons'

export interface PredictionCardProps {
  prediction: string | null
  probability: number
  timeMs: number
  /** WAVE 1169: Energy trend para cuando no hay predicción */
  energyTrend?: 'rising' | 'falling' | 'stable' | 'spike'
  /** WAVE 1169: Energy zone actual */
  energyZone?: 'calm' | 'rising' | 'peak' | 'falling'
  /** 🔥 WAVE 1176: OPERATION SNIPER - Raw velocity/slope for debugging */
  energyVelocity?: number
}

/**
 * 🔮 Card mostrando predicciones activas
 */
export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  probability,
  timeMs,
  energyTrend = 'stable',
  energyZone = 'calm',
  energyVelocity = 0
}) => {
  const hasPrediction = prediction !== null && probability > 0.3
  const probabilityPercent = Math.round(probability * 100)
  
  // Convertir ms a beats aproximados (asumiendo 120 BPM = 500ms/beat)
  const beatsETA = useMemo(() => {
    if (timeMs <= 0) return 'NOW'
    const beats = Math.round(timeMs / 500) // ~120 BPM
    if (beats <= 0) return 'NOW'
    return `~${beats} beats`
  }, [timeMs])

  // Determinar urgencia basada en tiempo y probabilidad
  const urgency = useMemo(() => {
    if (!hasPrediction) return 'none'
    if (probability > 0.7 && timeMs < 2000) return 'high'
    if (probability > 0.5) return 'medium'
    return 'low'
  }, [hasPrediction, probability, timeMs])

  // WAVE 1169: Trend icon y color
  const TrendIcon = energyTrend === 'rising' || energyTrend === 'spike'
    ? TrendUpIcon 
    : energyTrend === 'falling' 
      ? TrendDownIcon 
      : TrendStableIcon

  const trendColor = energyTrend === 'rising' || energyTrend === 'spike'
    ? '#22c55e' 
    : energyTrend === 'falling' 
      ? '#ef4444' 
      : '#fbbf24'

  // WAVE 1169: Zone config
  const zoneConfig: Record<string, { label: string; color: string; emoji: string }> = {
    calm: { label: 'CALM', color: '#64748b', emoji: '🌊' },
    rising: { label: 'RISING', color: '#22c55e', emoji: '📈' },
    peak: { label: 'PEAK', color: '#ef4444', emoji: '🔥' },
    falling: { label: 'FALLING', color: '#fbbf24', emoji: '📉' }
  }
  const zone = zoneConfig[energyZone] || zoneConfig.calm

  // 🔮 WAVE 1172: Header dinámico basado en trend
  const analyzingHeader = useMemo(() => {
    if (energyTrend === 'spike') {
      return { icon: '⚡', text: 'ENERGY SPIKE DETECTED', color: '#ef4444' }
    }
    if (energyTrend === 'rising') {
      return { icon: '⚠️', text: 'ENERGY BUILDING', color: '#22c55e' }
    }
    if (energyTrend === 'falling') {
      return { icon: '📉', text: 'ENERGY DROPPING', color: '#fbbf24' }
    }
    return { icon: '🔮', text: 'ANALYZING FLOW...', color: '#64748b' }
  }, [energyTrend])

  return (
    <div className={`consciousness-card prediction-card prediction-card--urgency-${urgency}`}>
      <div className="consciousness-card__header">
        <PredictionOrbIcon size={14} color="var(--accent-primary)" />
        <span>PREDICTION</span>
      </div>

      <div className="consciousness-card__body">
        {hasPrediction ? (
          <>
            {/* Tipo de predicción */}
            <div className="prediction-card__type">
              <LightningStrikeIcon 
                size={16} 
                color={urgency === 'high' ? '#ef4444' : '#fbbf24'} 
              />
              <span className="prediction-card__label">{prediction}</span>
            </div>

            {/* Probabilidad */}
            <div className="prediction-card__probability">
              <span className="neural-label">Probability:</span>
              <span className="prediction-card__value">{probabilityPercent}%</span>
            </div>

            {/* ETA */}
            <div className="prediction-card__eta">
              <span className="neural-label">ETA:</span>
              <span className={`prediction-card__time ${urgency === 'high' ? 'prediction-card__time--urgent' : ''}`}>
                {beatsETA}
              </span>
            </div>

            {/* Barra de progreso */}
            <div className="prediction-card__progress">
              <div 
                className="prediction-card__progress-fill"
                style={{ 
                  width: `${probabilityPercent}%`,
                  background: urgency === 'high' 
                    ? 'linear-gradient(90deg, #ef4444, #f97316)' 
                    : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
                }}
              />
            </div>
          </>
        ) : (
          /* 🔮 WAVE 1172: Header dinámico según trend */
          <div className="prediction-card__analyzing">
            <div 
              className={`prediction-card__analyzing-header ${
                energyTrend === 'rising' || energyTrend === 'spike' ? 'prediction-card__analyzing-header--active' : ''
              }`}
            >
              <span className="prediction-card__analyzing-icon">{analyzingHeader.icon}</span>
              <span 
                className="prediction-card__analyzing-text"
                style={{ color: analyzingHeader.color }}
              >
                {analyzingHeader.text}
              </span>
            </div>

            {/* Energy Zone */}
            <div className="prediction-card__zone">
              <span className="neural-label">Zone:</span>
              <span className="prediction-card__zone-badge" style={{ color: zone.color }}>
                {zone.emoji} {zone.label}
              </span>
            </div>

            {/* Energy Trend - 🔥 WAVE 1176: Ahora con slope */}
            <div className="prediction-card__trend">
              <span className="neural-label">Energy:</span>
              <span className="prediction-card__trend-value" style={{ color: trendColor }}>
                {energyTrend.toUpperCase()}
                <span 
                  className="prediction-card__slope" 
                  style={{ 
                    fontSize: '0.7em', 
                    opacity: 0.8, 
                    marginLeft: '4px',
                    fontFamily: 'monospace'
                  }}
                >
                  ({energyVelocity >= 0 ? '+' : ''}{energyVelocity.toFixed(4)})
                </span>
              </span>
              <TrendIcon size={14} color={trendColor} />
            </div>

            {/* Mini hint - WAVE 1172: Dinámico */}
            <div className="prediction-card__hint">
              {energyTrend === 'rising' || energyTrend === 'spike' 
                ? 'Potential drop incoming...'
                : 'Listening for patterns...'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PredictionCard
