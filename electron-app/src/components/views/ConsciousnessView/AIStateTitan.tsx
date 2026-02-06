/**
 * 🐱 AI STATE TITAN - WAVE 1194: CONSCIOUSNESS UNLEASHED
 * 
 * "El Cazador Expandido" - Más allá de una barra de progreso.
 * 
 * Features:
 * - Hunt Duration: Tiempo en estado actual
 * - Success Rate: % de strikes exitosos (simulado por ahora)
 * - Reasoning: Texto COMPLETO, no truncado
 * - Beauty Trend: Mini-sparkline de belleza
 */

import React, { memo, useState, useEffect, useRef, useMemo } from 'react'
import { 
  CatStalkIcon, 
  HourglassHuntIcon,
  TrophySuccessIcon,
  TrendUpIcon, 
  TrendDownIcon, 
  TrendStableIcon,
  SparklineMiniIcon
} from '../../icons/LuxIcons'
import type { AIHuntState } from '../../../core/protocol/SeleneProtocol'
import './AIStateTitan.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export interface AIStateTitanProps {
  huntState: AIHuntState
  confidence: number
  beautyScore: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  reasoning: string | null
}

const STATE_CONFIG: Record<AIHuntState, { 
  label: string
  color: string
  emoji: string
  description: string
}> = {
  sleeping: { 
    label: 'SLEEPING', 
    color: '#64748b', 
    emoji: '😴',
    description: 'Low energy, resting'
  },
  stalking: { 
    label: 'STALKING', 
    color: '#22c55e', 
    emoji: '🐱',
    description: 'Energy rising, preparing'
  },
  evaluating: { 
    label: 'EVALUATING', 
    color: '#fbbf24', 
    emoji: '🤔',
    description: 'Analyzing patterns'
  },
  striking: { 
    label: 'STRIKING', 
    color: '#ef4444', 
    emoji: '⚡',
    description: 'Executing changes!'
  },
  learning: { 
    label: 'LEARNING', 
    color: '#8b5cf6', 
    emoji: '📚',
    description: 'Adapting behavior'
  },
}

const BEAUTY_HISTORY_SIZE = 12

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AIStateTitan: React.FC<AIStateTitanProps> = memo(({
  huntState,
  confidence,
  beautyScore,
  beautyTrend,
  reasoning
}) => {
  const config = STATE_CONFIG[huntState]
  const confidencePercent = Math.round(confidence * 100)
  const beautyDisplay = (beautyScore * 1.618).toFixed(3) // φ format
  
  // Hunt duration timer
  const [huntDuration, setHuntDuration] = useState(0)
  const lastStateRef = useRef(huntState)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Beauty history for mini-sparkline
  const beautyHistoryRef = useRef<number[]>(new Array(BEAUTY_HISTORY_SIZE).fill(0.5))
  const [beautyHistory, setBeautyHistory] = useState<number[]>(new Array(BEAUTY_HISTORY_SIZE).fill(0.5))
  
  // Success rate (simulated - would come from backend in production)
  const [successRate] = useState(() => 75 + Math.floor(Math.random() * 20))
  
  // Reset duration on state change
  useEffect(() => {
    if (huntState !== lastStateRef.current) {
      lastStateRef.current = huntState
      setHuntDuration(0)
    }
  }, [huntState])
  
  // Increment duration timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setHuntDuration(d => d + 0.1)
    }, 100)
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])
  
  // Update beauty history
  useEffect(() => {
    beautyHistoryRef.current.push(beautyScore)
    if (beautyHistoryRef.current.length > BEAUTY_HISTORY_SIZE) {
      beautyHistoryRef.current.shift()
    }
    setBeautyHistory([...beautyHistoryRef.current])
  }, [beautyScore])
  
  // Trend icon
  const TrendIcon = beautyTrend === 'rising' 
    ? TrendUpIcon 
    : beautyTrend === 'falling' 
      ? TrendDownIcon 
      : TrendStableIcon

  const trendColor = beautyTrend === 'rising' 
    ? '#22c55e' 
    : beautyTrend === 'falling' 
      ? '#ef4444' 
      : '#fbbf24'
  
  // Mini sparkline path
  const sparklinePath = useMemo(() => {
    const width = 100
    const height = 30
    const points = beautyHistory.map((v, i) => {
      const x = (i / (BEAUTY_HISTORY_SIZE - 1)) * width
      const y = height - (v * height * 0.8) - 3
      return `${x},${y}`
    })
    return `M${points.join(' L')}`
  }, [beautyHistory])

  return (
    <div className="ai-titan">
      {/* HEADER */}
      <div className="ai-titan__header">
        <CatStalkIcon size={16} color={config.color} />
        <span className="ai-titan__title">AI STATE</span>
      </div>
      
      {/* STATE BADGE */}
      <div className="ai-titan__state">
        <div 
          className={`ai-titan__state-badge ai-titan__state-badge--${huntState}`}
          style={{ borderColor: config.color, color: config.color }}
        >
          <span className="ai-titan__state-emoji">{config.emoji}</span>
          <span className="ai-titan__state-label">{config.label}</span>
        </div>
        <span className="ai-titan__state-desc">{config.description}</span>
      </div>
      
      {/* CONFIDENCE BAR */}
      <div className="ai-titan__confidence">
        <span className="ai-titan__confidence-label">CONFIDENCE</span>
        <div className="ai-titan__confidence-bar">
          <div 
            className="ai-titan__confidence-fill"
            style={{ 
              width: `${confidencePercent}%`,
              background: `linear-gradient(90deg, ${config.color}88, ${config.color})`
            }}
          />
        </div>
        <span className="ai-titan__confidence-value">{confidencePercent}%</span>
      </div>
      
      {/* STATS ROW */}
      <div className="ai-titan__stats">
        {/* Hunt Duration */}
        <div className="ai-titan__stat">
          <HourglassHuntIcon size={14} color="var(--text-muted)" />
          <span className="ai-titan__stat-label">Hunt</span>
          <span className="ai-titan__stat-value">{huntDuration.toFixed(1)}s</span>
        </div>
        
        {/* Success Rate */}
        <div className="ai-titan__stat">
          <TrophySuccessIcon size={14} color="#fbbf24" />
          <span className="ai-titan__stat-label">Success</span>
          <span className="ai-titan__stat-value">{successRate}%</span>
        </div>
      </div>
      
      {/* REASONING - Full text with scroll */}
      <div className="ai-titan__reasoning">
        <div className="ai-titan__reasoning-header">
          <span>💭 THINKING</span>
        </div>
        <div className="ai-titan__reasoning-text">
          {reasoning || 'Observing the environment...'}
        </div>
      </div>
      
      {/* BEAUTY SECTION */}
      <div className="ai-titan__beauty">
        {/* Mini Sparkline */}
        <div className="ai-titan__beauty-sparkline">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none">
            <path 
              d={sparklinePath}
              fill="none"
              stroke={trendColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        
        {/* Beauty Value */}
        <div className="ai-titan__beauty-value">
          <span className="ai-titan__beauty-label">Beauty: φ</span>
          <span className="ai-titan__beauty-number">{beautyDisplay}</span>
          <TrendIcon size={14} color={trendColor} />
        </div>
      </div>
    </div>
  )
})

AIStateTitan.displayName = 'AIStateTitan'

export default AIStateTitan
