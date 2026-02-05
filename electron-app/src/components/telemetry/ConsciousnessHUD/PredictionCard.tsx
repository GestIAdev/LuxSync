/**
 * 🔮 PREDICTION CARD - WAVE 1169/1172/1176/1184/1185/1186/1189
 * "The Oracle" - La Money Card que tiene que verse VIVA
 * 
 * WAVE 1184: THE NEURAL BINDING - Estados visuales dinámicos
 * WAVE 1185: VISUAL SENSITIVITY - Micro-trend basado en slope
 * WAVE 1186: VISUAL SMOOTHING & UI CANDY
 * 
 * 🎯 WAVE 1189: SILENT ORACLE FIX
 * - Fallback Cascade: prediction → physical trend → idle
 * - Dynamic Labels: No más "SCANNING" - muestra tendencias reales
 * - energyZone como criterio para buildup/breakdown
 */

import React, { useMemo, useEffect, useRef, useState } from 'react'
import { PredictionOrbIcon, TrendUpIcon, TrendDownIcon, TrendStableIcon } from '../../icons/LuxIcons'

export interface PredictionCardProps {
  prediction: string | null
  probability: number
  timeMs: number
  energyTrend?: 'rising' | 'falling' | 'stable' | 'spike'
  energyZone?: 'calm' | 'rising' | 'peak' | 'falling'
  energyVelocity?: number
  /** 🔮 WAVE 1186: Energy value for sparkline (0-1) */
  energyValue?: number
}

// 🔮 WAVE 1186: Rolling Average Buffer Size (30 frames @ 60fps = 0.5s)
const ROLLING_BUFFER_SIZE = 30
// 🔮 WAVE 1186: Sparkline history (10s @ 60fps = 600, pero muestreamos cada 10 = 60 puntos)
const SPARKLINE_POINTS = 60
const SPARKLINE_SAMPLE_INTERVAL = 10 // cada 10 frames

type PredictionState = 'drop_incoming' | 'energy_spike' | 'buildup' | 'breakdown' | 'stable'

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
    animate: true
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
    color: '#a855f7',
    bgClass: 'prediction-card--breakdown',
    animate: false
  },
  stable: {
    icon: '🎵',
    label: 'TRACKING STRUCTURE',
    color: '#64748b',
    bgClass: 'prediction-card--stable',
    animate: false
  }
}

/**
 * 🔮 Card mostrando predicciones activas - LA MONEY CARD
 * WAVE 1186: Con anti-jitter, trend gauge y sparkline
 */
export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  probability,
  timeMs,
  energyTrend = 'stable',
  energyZone = 'calm',
  energyVelocity = 0,
  energyValue = 0.5
}) => {
  const prevStateRef = useRef<PredictionState>('stable')
  const [flashActive, setFlashActive] = useState(false)
  
  // 🔮 WAVE 1186: Rolling average buffer para anti-jitter
  const velocityBufferRef = useRef<number[]>([])
  const [smoothedVelocity, setSmoothedVelocity] = useState(0)
  
  // 🔮 WAVE 1186: Sparkline history
  const sparklineRef = useRef<number[]>(new Array(SPARKLINE_POINTS).fill(0.5))
  const frameCountRef = useRef(0)
  const [sparklineData, setSparklineData] = useState<number[]>(new Array(SPARKLINE_POINTS).fill(0.5))
  
  // 🔮 WAVE 1186: Update rolling average
  useEffect(() => {
    velocityBufferRef.current.push(energyVelocity)
    if (velocityBufferRef.current.length > ROLLING_BUFFER_SIZE) {
      velocityBufferRef.current.shift()
    }
    
    // Calcular promedio
    const avg = velocityBufferRef.current.reduce((a, b) => a + b, 0) / velocityBufferRef.current.length
    setSmoothedVelocity(avg)
    
    // 🔮 WAVE 1186: Update sparkline (sample every N frames)
    frameCountRef.current++
    if (frameCountRef.current >= SPARKLINE_SAMPLE_INTERVAL) {
      frameCountRef.current = 0
      sparklineRef.current.push(energyValue)
      if (sparklineRef.current.length > SPARKLINE_POINTS) {
        sparklineRef.current.shift()
      }
      setSparklineData([...sparklineRef.current])
    }
  }, [energyVelocity, energyValue])
  
  const hasPrediction = prediction !== null && probability > 0.3
  const probabilityPercent = Math.round(probability * 100)
  
  const parsePredictionType = (pred: string | null): PredictionState => {
    if (!pred) return 'stable'
    const lower = pred.toLowerCase()
    
    if (lower.includes('drop') || lower.includes('incoming')) return 'drop_incoming'
    if (lower.includes('spike') || lower.includes('impact')) return 'energy_spike'
    if (lower.includes('build') || lower.includes('rising')) return 'buildup'
    if (lower.includes('break') || lower.includes('down')) return 'breakdown'
    
    return 'stable'
  }
  
  const predictionState: PredictionState = useMemo(() => {
    // 🔮 WAVE 1189: FALLBACK CASCADE - El oráculo ya no calla
    // Prioridad 1: Predicción explícita (Drop/Buildup) si prob > 0.3
    if (hasPrediction) {
      return parsePredictionType(prediction)
    }
    // Prioridad 2: Tendencia física cuando no hay predicción fuerte
    if (energyTrend === 'spike') return 'energy_spike'
    if (energyTrend === 'rising' && energyZone !== 'calm') return 'buildup'
    if (energyTrend === 'falling' && energyZone === 'falling') return 'breakdown'
    return 'stable'
  }, [hasPrediction, prediction, energyTrend, energyZone])
  
  useEffect(() => {
    if (prevStateRef.current !== predictionState) {
      console.log(`[PredictionCard 🔮] STATE: ${prevStateRef.current} → ${predictionState} | vel=${smoothedVelocity.toFixed(4)}`)
      prevStateRef.current = predictionState
      setFlashActive(true)
      setTimeout(() => setFlashActive(false), 300)
    }
  }, [predictionState, smoothedVelocity])
  
  const beatsETA = useMemo(() => {
    if (timeMs <= 0) return 'NOW!'
    const beats = Math.round(timeMs / 500)
    if (beats <= 0) return 'NOW!'
    if (beats <= 4) return `${beats} beats`
    if (beats <= 16) return `~${Math.round(beats / 4)} bars`
    return `~${Math.round(timeMs / 1000)}s`
  }, [timeMs])

  const urgency = useMemo(() => {
    if (!hasPrediction) return 'none'
    if (probability > 0.7 && timeMs < 2000) return 'high'
    if (probability > 0.5) return 'medium'
    return 'low'
  }, [hasPrediction, probability, timeMs])

  const TrendIcon = energyTrend === 'rising' || energyTrend === 'spike'
    ? TrendUpIcon 
    : energyTrend === 'falling' ? TrendDownIcon : TrendStableIcon

  const visual = PREDICTION_VISUALS[predictionState]

  // 🔮 WAVE 1189: DYNAMIC LABELS - El oráculo habla con claridad
  // No más "SCANNING" estático - mostrar lo que realmente está pasando
  const displayLabel = useMemo(() => {
    // Si hay un estado activo (no stable), usar su label
    if (predictionState !== 'stable') {
      return visual.label
    }
    // En stable, mostrar tendencia física
    if (energyTrend === 'rising') return 'ENERGY RISING'
    if (energyTrend === 'falling') return 'ENERGY FADING'
    if (energyTrend === 'spike') return 'SPIKE DETECTED'
    // Solo si es plano total
    return 'MONITORING FLOW'
  }, [predictionState, energyTrend, visual.label])

  const zoneConfig: Record<string, { label: string; color: string; emoji: string }> = {
    calm: { label: 'CALM', color: '#64748b', emoji: '🌊' },
    rising: { label: 'RISING', color: '#22c55e', emoji: '📈' },
    peak: { label: 'PEAK', color: '#ef4444', emoji: '🔥' },
    falling: { label: 'FALLING', color: '#fbbf24', emoji: '📉' }
  }
  const zone = zoneConfig[energyZone] || zoneConfig.calm

  // 🔮 WAVE 1186: Trend Gauge calculation
  // smoothedVelocity típicamente en rango [-0.01, 0.01]
  // Normalizar a [-1, 1] para el gauge
  const normalizedTrend = Math.max(-1, Math.min(1, smoothedVelocity * 100))
  const gaugePercent = Math.abs(normalizedTrend) * 50 // 0-50% del lado
  const isRising = normalizedTrend > 0.01
  const isFalling = normalizedTrend < -0.01
  
  // 🔮 WAVE 1186: Generate sparkline SVG path
  const sparklinePath = useMemo(() => {
    if (sparklineData.length < 2) return ''
    const width = 100
    const height = 20
    const points = sparklineData.map((val, i) => {
      const x = (i / (sparklineData.length - 1)) * width
      const y = height - (val * height)
      return `${x},${y}`
    })
    return `M ${points.join(' L ')}`
  }, [sparklineData])

  return (
    <div className={`consciousness-card prediction-card ${visual.bgClass} ${visual.animate ? 'prediction-card--animate' : ''} ${flashActive ? 'prediction-card--flash' : ''}`}>
      <div className="consciousness-card__header">
        <PredictionOrbIcon size={14} color="var(--accent-primary)" />
        <span>PREDICTION</span>
      </div>

      <div className="consciousness-card__body">
        {hasPrediction ? (
          <>
            <div className="prediction-card__main-state">
              <span className="prediction-card__state-icon" style={{ color: visual.color }}>
                {visual.icon}
              </span>
              <span className="prediction-card__state-label" style={{ color: visual.color }}>
                {displayLabel}
              </span>
            </div>

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
          /* 🔮 WAVE 1186: Estado sin predicción - Trend Gauge + Sparkline */
          <div className="prediction-card__analyzing">
            {/* Header con estado */}
            <div className={`prediction-card__analyzing-header ${predictionState !== 'stable' ? 'prediction-card__analyzing-header--active' : ''}`}>
              <span className="prediction-card__analyzing-icon">{visual.icon}</span>
              <span className="prediction-card__analyzing-text" style={{ color: visual.color }}>
                {displayLabel}
              </span>
              <span className="prediction-card__zone-mini" style={{ color: zone.color }}>
                {zone.emoji}
              </span>
            </div>

            {/* 🔮 WAVE 1186: TREND GAUGE - Barra central bidireccional */}
            <div className="prediction-card__trend-gauge">
              <span className="prediction-card__gauge-label prediction-card__gauge-label--left">↘</span>
              <div className="prediction-card__gauge-track">
                {/* Lado izquierdo (falling - purple) */}
                <div 
                  className="prediction-card__gauge-fill prediction-card__gauge-fill--left"
                  style={{ 
                    width: isFalling ? `${gaugePercent}%` : '0%',
                    background: 'linear-gradient(270deg, #a855f7, #7c3aed)'
                  }}
                />
                {/* Centro marker */}
                <div className="prediction-card__gauge-center" />
                {/* Lado derecho (rising - cyan) */}
                <div 
                  className="prediction-card__gauge-fill prediction-card__gauge-fill--right"
                  style={{ 
                    width: isRising ? `${gaugePercent}%` : '0%',
                    background: 'linear-gradient(90deg, #22d3ee, #06b6d4)'
                  }}
                />
              </div>
              <span className="prediction-card__gauge-label prediction-card__gauge-label--right">↗</span>
            </div>

            {/* Delta numérico */}
            <div className="prediction-card__delta">
              <span 
                className="prediction-card__delta-value"
                style={{ 
                  color: isRising ? '#22d3ee' : isFalling ? '#a855f7' : '#64748b'
                }}
              >
                δ {smoothedVelocity >= 0 ? '+' : ''}{smoothedVelocity.toFixed(4)}
              </span>
            </div>

            {/* 🔮 WAVE 1186: SPARKLINE - Mini gráfico de energía */}
            <div className="prediction-card__sparkline">
              <svg 
                viewBox="0 0 100 20" 
                preserveAspectRatio="none"
                className="prediction-card__sparkline-svg"
              >
                {/* Grid lines */}
                <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                {/* Energy line */}
                <path 
                  d={sparklinePath}
                  fill="none"
                  stroke="url(#sparklineGradient)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Gradient definition */}
                <defs>
                  <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="prediction-card__sparkline-label">10s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PredictionCard
