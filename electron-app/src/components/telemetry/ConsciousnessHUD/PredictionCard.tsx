/**
 * 🔮 PREDICTION CARD - WAVE 1169/1172/1176/1184
 * "The Oracle" - La Money Card que tiene que verse VIVA
 * 
 * WAVE 1169: Si no hay predicción, muestra tendencia de energía
 * WAVE 1172: Si energyTrend === 'rising', mostrar "⚠️ ENERGY BUILDING"
 * WAVE 1176: OPERATION SNIPER - Mostrar slope crudo para debugging
 * 
 * 🔮 WAVE 1184: THE NEURAL BINDING - El Oráculo que Vende
 * - DROP_INCOMING: ROJO PARPADEANTE + Countdown estimado
 * - ENERGY_SPIKE: FLASH AMARILLO ("Impact Detected")
 * - BUILDUP: BARRA DE PROGRESO subiendo
 * - STABLE: "MONITORING FLOW..." con tendencia pequeña
 * - Log al NeuralStream cuando cambia el estado
 */

import React, { useMemo, useEffect, useRef, useState } from 'react'
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

// 🔮 WAVE 1184: Tipos de predicción con estados visuales
type PredictionState = 'drop_incoming' | 'energy_spike' | 'buildup' | 'breakdown' | 'stable'

// 🔮 WAVE 1184: Configuración visual por estado
const PREDICTION_VISUALS: Record<PredictionState, {
  icon: string
  label: string
  color: string
  bgClass: string
  animate: boolean
}> = {
  drop_incoming: {
    icon: '🔥',
    label: 'DROP INCOMING',
    color: '#ef4444',
    bgClass: 'prediction-card--drop-incoming',
    animate: true  // Parpadeo
  },
  energy_spike: {
    icon: '⚡',
    label: 'IMPACT DETECTED',
    color: '#fbbf24',
    bgClass: 'prediction-card--spike',
    animate: true
  },
  buildup: {
    icon: '📈',
    label: 'BUILDUP',
    color: '#22c55e',
    bgClass: 'prediction-card--buildup',
    animate: false
  },
  breakdown: {
    icon: '📉',
    label: 'BREAKDOWN',
    color: '#8b5cf6',
    bgClass: 'prediction-card--breakdown',
    animate: false
  },
  stable: {
    icon: '🔮',
    label: 'MONITORING FLOW',
    color: '#64748b',
    bgClass: 'prediction-card--stable',
    animate: false
  }
}

/**
 * 🔮 Card mostrando predicciones activas - LA MONEY CARD
 * WAVE 1184: El Oráculo que Vende
 */
export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  probability,
  timeMs,
  energyTrend = 'stable',
  energyZone = 'calm',
  energyVelocity = 0
}) => {
  // 🔮 WAVE 1184: Track previous state for logging
  const prevStateRef = useRef<PredictionState>('stable')
  const [flashActive, setFlashActive] = useState(false)
  
  const hasPrediction = prediction !== null && probability > 0.3
  const probabilityPercent = Math.round(probability * 100)
  
  // 🔮 WAVE 1184: Parse prediction type from backend string
  const parsePredictionType = (pred: string | null): PredictionState => {
    if (!pred) return 'stable'
    const lower = pred.toLowerCase()
    
    if (lower.includes('drop') || lower.includes('incoming')) return 'drop_incoming'
    if (lower.includes('spike') || lower.includes('impact')) return 'energy_spike'
    if (lower.includes('build') || lower.includes('rising')) return 'buildup'
    if (lower.includes('break') || lower.includes('down')) return 'breakdown'
    
    return 'stable'
  }
  
  // Determinar estado de predicción
  const predictionState: PredictionState = useMemo(() => {
    if (hasPrediction) {
      return parsePredictionType(prediction)
    }
    
    // Si no hay predicción pero hay trend activo
    if (energyTrend === 'spike') return 'energy_spike'
    if (energyTrend === 'rising' && energyVelocity > 0.01) return 'buildup'
    
    return 'stable'
  }, [hasPrediction, prediction, energyTrend, energyVelocity])
  
  // 🔮 WAVE 1184: Log when state changes
  useEffect(() => {
    if (prevStateRef.current !== predictionState) {
      console.log(`[PredictionCard 🔮] STATE CHANGE: ${prevStateRef.current} → ${predictionState} | prob=${probabilityPercent}% | velocity=${energyVelocity.toFixed(4)}`)
      prevStateRef.current = predictionState
      
      // Flash effect on state change
      setFlashActive(true)
      setTimeout(() => setFlashActive(false), 300)
    }
  }, [predictionState, probabilityPercent, energyVelocity])
  
  // Convertir ms a beats aproximados (asumiendo 120 BPM = 500ms/beat)
  const beatsETA = useMemo(() => {
    if (timeMs <= 0) return 'NOW!'
    const beats = Math.round(timeMs / 500) // ~120 BPM
    if (beats <= 0) return 'NOW!'
    if (beats <= 4) return `${beats} beats`
    if (beats <= 16) return `~${Math.round(beats / 4)} bars`
    return `~${Math.round(timeMs / 1000)}s`
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

  // Get visual config for current state
  const visual = PREDICTION_VISUALS[predictionState]

  // WAVE 1169: Zone config
  const zoneConfig: Record<string, { label: string; color: string; emoji: string }> = {
    calm: { label: 'CALM', color: '#64748b', emoji: '🌊' },
    rising: { label: 'RISING', color: '#22c55e', emoji: '📈' },
    peak: { label: 'PEAK', color: '#ef4444', emoji: '🔥' },
    falling: { label: 'FALLING', color: '#fbbf24', emoji: '📉' }
  }
  const zone = zoneConfig[energyZone] || zoneConfig.calm

  return (
    <div className={`consciousness-card prediction-card ${visual.bgClass} ${visual.animate ? 'prediction-card--animate' : ''} ${flashActive ? 'prediction-card--flash' : ''}`}>
      <div className="consciousness-card__header">
        <PredictionOrbIcon size={14} color="var(--accent-primary)" />
        <span>PREDICTION</span>
      </div>

      <div className="consciousness-card__body">
        {hasPrediction ? (
          <>
            {/* 🔮 WAVE 1184: Estado principal con icono dinámico */}
            <div className="prediction-card__main-state">
              <span className="prediction-card__state-icon" style={{ color: visual.color }}>
                {visual.icon}
              </span>
              <span className="prediction-card__state-label" style={{ color: visual.color }}>
                {visual.label}
              </span>
            </div>

            {/* Probabilidad - Barra de progreso */}
            <div className="prediction-card__probability">
              <div className="prediction-card__progress">
                <div 
                  className="prediction-card__progress-fill"
                  style={{ 
                    width: `${probabilityPercent}%`,
                    background: urgency === 'high' 
                      ? 'linear-gradient(90deg, #ef4444, #f97316)' 
                      : `linear-gradient(90deg, ${visual.color}, ${visual.color}88)`
                  }}
                />
              </div>
              <span className="prediction-card__probability-value">{probabilityPercent}%</span>
            </div>

            {/* ETA - Countdown */}
            <div className="prediction-card__eta">
              <span className="neural-label">ETA:</span>
              <span 
                className={`prediction-card__time ${urgency === 'high' ? 'prediction-card__time--urgent' : ''}`}
                style={{ color: urgency === 'high' ? '#ef4444' : visual.color }}
              >
                {beatsETA}
              </span>
            </div>
          </>
        ) : (
          /* 🔮 WAVE 1184: Estado sin predicción - muestra tendencia */
          <div className="prediction-card__analyzing">
            <div 
              className={`prediction-card__analyzing-header ${
                predictionState !== 'stable' ? 'prediction-card__analyzing-header--active' : ''
              }`}
            >
              <span className="prediction-card__analyzing-icon">{visual.icon}</span>
              <span 
                className="prediction-card__analyzing-text"
                style={{ color: visual.color }}
              >
                {visual.label}...
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
              <span className="neural-label">Flow:</span>
              <span className="prediction-card__trend-value" style={{ color: visual.color }}>
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
                  ({energyVelocity >= 0 ? '+' : ''}{energyVelocity.toFixed(3)})
                </span>
              </span>
              <TrendIcon size={14} color={visual.color} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PredictionCard
