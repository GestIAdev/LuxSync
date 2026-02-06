/**
 * 🔮 ORACLE HYBRID - WAVE 1194: CONSCIOUSNESS UNLEASHED
 * 
 * "La Joya de la Corona" - Se acabó elegir entre alerta o gráfica.
 * LO QUEREMOS TODO.
 * 
 * Layout:
 * - Top (20%): Banner de Alerta (Solo aparece si hay Drop/Buildup)
 * - Mid (50%): Sparkline Gigante (Siempre visible, 60 puntos)
 * - Bottom (30%): Trend Gauge Bidireccional + Métricas de Zona
 * 
 * Beneficio: Estabilidad total. El ojo humano ve la tendencia 
 * y la alerta sin cambios bruscos de layout.
 */

import React, { memo, useEffect, useRef, useState, useMemo } from 'react'
import { 
  OracleEyeIcon, 
  TrendUpIcon, 
  TrendDownIcon, 
  TrendStableIcon,
  DropImpactIcon
} from '../../icons/LuxIcons'
import './OracleHybrid.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export interface OracleHybridProps {
  prediction: string | null
  probability: number
  energyTrend: 'rising' | 'falling' | 'stable' | 'spike'
  energyZone: 'calm' | 'rising' | 'peak' | 'falling'
  energyVelocity: number
  energyValue: number
}

type AlertType = 'drop' | 'spike' | 'buildup' | 'breakdown' | null

const SPARKLINE_POINTS = 60
const SPARKLINE_SAMPLE_INTERVAL = 10

const ZONE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  calm: { label: 'CALM', color: '#3b82f6', emoji: '🌊' },
  rising: { label: 'RISING', color: '#22c55e', emoji: '📈' },
  peak: { label: 'PEAK', color: '#ef4444', emoji: '🔥' },
  falling: { label: 'FALLING', color: '#a855f7', emoji: '📉' },
}

const ALERT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  drop: { label: 'DROP INCOMING', color: '#ef4444', icon: '🔥' },
  spike: { label: 'IMPACT DETECTED', color: '#fbbf24', icon: '⚡' },
  buildup: { label: 'BUILDUP', color: '#22c55e', icon: '📈' },
  breakdown: { label: 'BREAKDOWN', color: '#a855f7', icon: '📉' },
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Parse prediction to alert type
// ═══════════════════════════════════════════════════════════════════════════

function parseAlertType(prediction: string | null, probability: number, energyTrend: string, energyZone: string): AlertType {
  if (prediction && probability > 0.3) {
    const lower = prediction.toLowerCase()
    if (lower.includes('drop') || lower.includes('incoming')) return 'drop'
    if (lower.includes('spike') || lower.includes('impact')) return 'spike'
    if (lower.includes('build') || lower.includes('rising')) return 'buildup'
    if (lower.includes('break') || lower.includes('down')) return 'breakdown'
  }
  
  // Fallback a física
  if (energyTrend === 'spike') return 'spike'
  if (energyTrend === 'rising' && energyZone !== 'calm') return 'buildup'
  if (energyTrend === 'falling' && energyZone === 'falling') return 'breakdown'
  
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const OracleHybrid: React.FC<OracleHybridProps> = memo(({
  prediction,
  probability,
  energyTrend,
  energyZone,
  energyVelocity,
  energyValue
}) => {
  // Sparkline history
  const sparklineRef = useRef<number[]>(new Array(SPARKLINE_POINTS).fill(0.5))
  const frameCountRef = useRef(0)
  const [sparklineData, setSparklineData] = useState<number[]>(new Array(SPARKLINE_POINTS).fill(0.5))
  
  // Update sparkline
  useEffect(() => {
    frameCountRef.current++
    if (frameCountRef.current >= SPARKLINE_SAMPLE_INTERVAL) {
      frameCountRef.current = 0
      sparklineRef.current.push(energyValue)
      if (sparklineRef.current.length > SPARKLINE_POINTS) {
        sparklineRef.current.shift()
      }
      setSparklineData([...sparklineRef.current])
    }
  }, [energyValue])
  
  // Parse alert
  const alertType = useMemo(() => 
    parseAlertType(prediction, probability, energyTrend, energyZone), 
    [prediction, probability, energyTrend, energyZone]
  )
  
  const alertConfig = alertType ? ALERT_CONFIG[alertType] : null
  const zoneConfig = ZONE_CONFIG[energyZone] || ZONE_CONFIG.calm
  
  // Trend gauge: -100 to +100
  const gaugePercent = Math.max(-100, Math.min(100, energyVelocity * 500))
  
  // SVG sparkline path
  const sparklinePath = useMemo(() => {
    const width = 100
    const height = 100
    const points = sparklineData.map((v, i) => {
      const x = (i / (SPARKLINE_POINTS - 1)) * width
      const y = height - (v * height * 0.9) - 5
      return `${x},${y}`
    })
    return `M${points.join(' L')}`
  }, [sparklineData])
  
  // Gradient ID para sparkline
  const gradientId = 'oracle-sparkline-gradient'
  
  // Trend icon
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

  return (
    <div className="oracle-hybrid">
      {/* HEADER */}
      <div className="oracle-hybrid__header">
        <OracleEyeIcon size={16} color="var(--accent-primary)" />
        <span className="oracle-hybrid__title">THE ORACLE</span>
      </div>
      
      {/* TOP 20%: ALERT BANNER (conditional) */}
      <div className={`oracle-hybrid__alert ${alertType ? 'oracle-hybrid__alert--active' : ''}`}>
        {alertConfig ? (
          <>
            <span className="oracle-hybrid__alert-icon">{alertConfig.icon}</span>
            <span 
              className="oracle-hybrid__alert-label"
              style={{ color: alertConfig.color }}
            >
              {alertConfig.label}
            </span>
            <span className="oracle-hybrid__alert-prob">
              {Math.round(probability * 100)}%
            </span>
          </>
        ) : (
          <span className="oracle-hybrid__alert-idle">TRACKING STRUCTURE</span>
        )}
      </div>
      
      {/* MID 50%: GIANT SPARKLINE (always visible) */}
      <div className="oracle-hybrid__sparkline">
        <svg 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
          className="oracle-hybrid__sparkline-svg"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
            </linearGradient>
            {/* Area fill gradient */}
            <linearGradient id={`${gradientId}-fill`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
          
          {/* Area fill */}
          <path 
            d={`${sparklinePath} L100,100 L0,100 Z`}
            fill={`url(#${gradientId}-fill)`}
          />
          
          {/* Main line */}
          <path 
            d={sparklinePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Current point */}
          <circle 
            cx="100" 
            cy={100 - (energyValue * 90) - 5}
            r="3"
            fill={zoneConfig.color}
            className="oracle-hybrid__current-point"
          />
        </svg>
        
        {/* Energy value overlay */}
        <div className="oracle-hybrid__energy-value">
          <span className="oracle-hybrid__energy-number">
            {(energyValue * 100).toFixed(0)}
          </span>
          <span className="oracle-hybrid__energy-unit">%</span>
        </div>
      </div>
      
      {/* BOTTOM 30%: TREND GAUGE + ZONE METRICS */}
      <div className="oracle-hybrid__metrics">
        {/* Trend Gauge */}
        <div className="oracle-hybrid__gauge">
          <span className="oracle-hybrid__gauge-label oracle-hybrid__gauge-label--left">◄ FALL</span>
          <div className="oracle-hybrid__gauge-track">
            <div className="oracle-hybrid__gauge-center" />
            <div 
              className="oracle-hybrid__gauge-thumb"
              style={{ 
                left: `${50 + gaugePercent / 2}%`,
                backgroundColor: trendColor
              }}
            />
          </div>
          <span className="oracle-hybrid__gauge-label oracle-hybrid__gauge-label--right">RISE ►</span>
        </div>
        
        {/* Zone & Velocity */}
        <div className="oracle-hybrid__zone-row">
          <div 
            className="oracle-hybrid__zone-badge"
            style={{ borderColor: zoneConfig.color, color: zoneConfig.color }}
          >
            <span>{zoneConfig.emoji}</span>
            <span>{zoneConfig.label}</span>
          </div>
          
          <div className="oracle-hybrid__velocity">
            <TrendIcon size={14} color={trendColor} />
            <span style={{ color: trendColor }}>
              {energyVelocity >= 0 ? '+' : ''}{(energyVelocity * 100).toFixed(1)}/s
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

OracleHybrid.displayName = 'OracleHybrid'

export default OracleHybrid
