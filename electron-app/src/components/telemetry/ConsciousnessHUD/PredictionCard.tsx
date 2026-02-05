/**
 * 🔮 PREDICTION CARD - WAVE 1167
 * Predicciones activas con countdown
 */

import React, { useMemo } from 'react'
import { PredictionOrbIcon, LightningStrikeIcon } from '../../icons/LuxIcons'

export interface PredictionCardProps {
  prediction: string | null
  probability: number
  timeMs: number
}

/**
 * 🔮 Card mostrando predicciones activas
 */
export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  probability,
  timeMs
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

            {/* Preparing action */}
            <div className="prediction-card__preparing">
              <span className="neural-label">Preparing:</span>
              <span>Intensity boost</span>
            </div>
          </>
        ) : (
          <div className="prediction-card__idle">
            <span>🔮</span>
            <span>No prediction</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PredictionCard
