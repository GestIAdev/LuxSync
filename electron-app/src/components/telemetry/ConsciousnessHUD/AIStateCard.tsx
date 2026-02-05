/**
 * 🐱 AI STATE CARD - WAVE 1167
 * Estado de caza de la gata Selene
 */

import React from 'react'
import { 
  CatStalkIcon, 
  TrendUpIcon, 
  TrendDownIcon, 
  TrendStableIcon 
} from '../../icons/LuxIcons'
import type { AIHuntState } from '../../../core/protocol/SeleneProtocol'

export interface AIStateCardProps {
  huntState: AIHuntState
  confidence: number
  beautyScore: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  reasoning: string | null
}

// Configuración visual para cada estado
const STATE_CONFIG: Record<AIHuntState, { 
  label: string
  color: string
  emoji: string
  description: string
}> = {
  sleeping: { 
    label: 'SLEEPING', 
    color: 'var(--state-sleeping)', 
    emoji: '😴',
    description: 'Low energy, resting'
  },
  stalking: { 
    label: 'STALKING', 
    color: 'var(--state-stalking)', 
    emoji: '🐱',
    description: 'Energy rising, preparing'
  },
  evaluating: { 
    label: 'EVALUATING', 
    color: 'var(--state-evaluating)', 
    emoji: '🤔',
    description: 'Analyzing patterns'
  },
  striking: { 
    label: 'STRIKING', 
    color: 'var(--state-striking)', 
    emoji: '⚡',
    description: 'Executing changes!'
  },
  learning: { 
    label: 'LEARNING', 
    color: 'var(--state-learning)', 
    emoji: '📚',
    description: 'Adapting behavior'
  },
}

/**
 * 🐱 Card mostrando estado de caza
 */
export const AIStateCard: React.FC<AIStateCardProps> = ({
  huntState,
  confidence,
  beautyScore,
  beautyTrend,
  reasoning
}) => {
  const config = STATE_CONFIG[huntState]
  const confidencePercent = Math.round(confidence * 100)
  const beautyDisplay = (beautyScore * 1.618).toFixed(3) // φ format

  // Icono de tendencia
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

  return (
    <div className="consciousness-card ai-state-card">
      <div className="consciousness-card__header">
        <CatStalkIcon size={14} color={config.color} />
        <span>AI STATE</span>
      </div>

      <div className="consciousness-card__body">
        {/* Estado badge */}
        <div 
          className={`state-badge state-badge--${huntState}`}
          style={{ borderColor: config.color }}
        >
          <span>{config.emoji}</span>
          <span>{config.label}</span>
        </div>

        {/* Barra de confidence */}
        <div className="ai-state-card__confidence">
          <div className="neural-gauge">
            <div 
              className="neural-gauge-fill"
              style={{ 
                width: `${confidencePercent}%`,
                '--gauge-start': config.color,
                '--gauge-end': config.color,
                '--gauge-glow': config.color,
              } as React.CSSProperties}
            />
          </div>
          <span className="ai-state-card__confidence-value">{confidencePercent}%</span>
        </div>

        {/* Reasoning (si existe) */}
        {reasoning && (
          <div className="ai-state-card__reasoning">
            <span className="neural-label">Reason:</span>
            <p>"{reasoning}"</p>
          </div>
        )}

        {/* Beauty score */}
        <div className="ai-state-card__beauty">
          <span className="neural-label">Beauty: φ</span>
          <span className="ai-state-card__beauty-value">{beautyDisplay}</span>
          <TrendIcon size={14} color={trendColor} />
        </div>
      </div>
    </div>
  )
}

export default AIStateCard
