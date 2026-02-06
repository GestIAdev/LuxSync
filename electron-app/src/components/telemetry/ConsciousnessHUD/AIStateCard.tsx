/**
 * 🐱 AI STATE CARD - WAVE 1169/1192
 * Estado de caza de la gata Selene
 * 
 * WAVE 1169: Muerte al scrollbar, truncate del reasoning
 * 💊 WAVE 1192: VISUAL VALIUM - Eliminada barra de Target (redundante con PredictionCard)
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
  /** @deprecated 💊 WAVE 1192: Ya no se renderiza, usar PredictionCard */
  target?: string | null
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

// WAVE 1169: Truncate reasoning para evitar scroll
const truncateReasoning = (text: string, maxLen: number = 45): string => {
  if (!text || text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

/**
 * 🐱 Card mostrando estado de caza
 */
export const AIStateCard: React.FC<AIStateCardProps> = ({
  huntState,
  confidence,
  beautyScore,
  beautyTrend,
  reasoning,
  target
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

        {/* 💊 WAVE 1192: Target display ELIMINADO - Redundante con PredictionCard */}
        {/* La información de target ahora se muestra únicamente en la PredictionCard */}

        {/* Reasoning - TRUNCATED (tooltip shows full) */}
        {reasoning && (
          <div className="ai-state-card__reasoning" title={reasoning}>
            <span className="ai-state-card__reasoning-text">
              {truncateReasoning(reasoning)}
            </span>
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
