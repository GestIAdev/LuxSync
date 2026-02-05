/**
 * 💭 DREAM FORGE CARD - WAVE 1167
 * Qué está "imaginando" Selene
 */

import React from 'react'
import { DreamCloudIcon } from '../../icons/LuxIcons'
import type { DreamType, DreamRecommendation } from '../../../core/protocol/SeleneProtocol'

export interface DreamForgeCardProps {
  isActive: boolean
  currentType: DreamType
  currentThought: string
  projectedBeauty: number
  lastRecommendation: DreamRecommendation
}

// Labels para tipos de sueño (sin null)
const DREAM_TYPE_LABELS: Record<NonNullable<DreamType>, string> = {
  palette_change: 'Palette Shift',
  intensity_shift: 'Intensity Change',
  movement_change: 'Movement Pattern',
  effect_activation: 'Effect Activation',
  mood_transition: 'Mood Transition',
  strike_execution: 'Strike Execution',
  full_scene_change: 'Full Scene Change',
}

// Config para recomendaciones (sin null)
const RECOMMENDATION_CONFIG: Record<NonNullable<DreamRecommendation>, { 
  icon: string
  label: string
  color: string 
}> = {
  execute: { icon: '✅', label: 'EXECUTE', color: '#22c55e' },
  modify: { icon: '🔧', label: 'MODIFY', color: '#fbbf24' },
  abort: { icon: '⏭️', label: 'ABORT', color: '#64748b' },
}

/**
 * 💭 Card mostrando estado del Dream Engine
 */
export const DreamForgeCard: React.FC<DreamForgeCardProps> = ({
  isActive,
  currentType,
  currentThought,
  projectedBeauty,
  lastRecommendation
}) => {
  const recConfig = lastRecommendation ? RECOMMENDATION_CONFIG[lastRecommendation] : null
  const beautyPercent = Math.round(projectedBeauty * 100)
  const typeLabel = currentType ? DREAM_TYPE_LABELS[currentType] : 'Unknown'

  return (
    <div className={`consciousness-card dream-forge-card ${isActive ? 'dream-forge-card--active' : ''}`}>
      <div className="consciousness-card__header">
        <DreamCloudIcon size={14} color="var(--cat-dream)" />
        <span>DREAM FORGE</span>
      </div>

      <div className="consciousness-card__body">
        {/* Status */}
        <div className="dream-forge-card__status">
          <span className={`dream-forge-card__indicator ${isActive ? 'dream-forge-card__indicator--active' : ''}`}>
            {isActive ? '💭 SIMULATING' : '😴 IDLE'}
          </span>
        </div>

        {isActive && (
          <>
            {/* Tipo de sueño */}
            <div className="dream-forge-card__type">
              <span className="neural-label">Type:</span>
              <span>{typeLabel}</span>
            </div>

            {/* Pensamiento actual */}
            {currentThought && (
              <div className="dream-forge-card__thought">
                <span className="neural-label">Thought:</span>
                <p>"{currentThought}"</p>
              </div>
            )}

            {/* Belleza proyectada */}
            <div className="dream-forge-card__projected">
              <span className="neural-label">Projected:</span>
              <span className="dream-forge-card__beauty">{beautyPercent}%</span>
            </div>

            {/* Recomendación */}
            {recConfig && (
              <div 
                className="dream-forge-card__recommendation"
                style={{ color: recConfig.color }}
              >
                <span>{recConfig.icon}</span>
                <span>{recConfig.label}</span>
              </div>
            )}
          </>
        )}

        {!isActive && (
          <div className="dream-forge-card__idle">
            <span>No active simulation</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DreamForgeCard
