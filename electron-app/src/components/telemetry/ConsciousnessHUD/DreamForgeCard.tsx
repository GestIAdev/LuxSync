/**
 * 💭 DREAM FORGE CARD - WAVE 1169
 * "The Simulator" - Muestra resultado del último sueño
 * 
 * Estados:
 * - IDLE: "💤 Waiting for trigger..."
 * - ACCEPTED: Verde. "✨ CASTING: [EffectName]"
 * - MODIFY: Amarillo. "⚡ CASTING (modified): [EffectName]"
 * - REJECTED: Rojo. "🚫 BLOCKED: [Reason]"
 * 
 * WAVE 1169 FIX: Si reason contiene "Execute" o approved keywords, es SUCCESS
 */

import React from 'react'
import { DreamCloudIcon } from '../../icons/LuxIcons'

export interface DreamForgeCardProps {
  /** Nombre del efecto que se intentó (null si idle) */
  effectName: string | null
  /** Estado del último sueño */
  status: 'ACCEPTED' | 'REJECTED' | 'IDLE'
  /** Razón del resultado */
  reason: string
  /** Nivel de riesgo (0-1) */
  riskLevel: number
  /** Confidence del dream (opcional) */
  confidence?: number
}

// Formatear nombre de efecto para display
const formatEffectName = (name: string): string => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// WAVE 1169: Detectar si reason indica éxito (aunque status diga REJECTED)
const SUCCESS_KEYWORDS = ['execute', 'approved', 'casting', 'firing', 'proceed', 'go']
const MODIFY_KEYWORDS = ['reduce', 'lower', 'adjust', 'modify', 'limit', 'cap']

const parseRealStatus = (status: string, reason: string): 'SUCCESS' | 'MODIFY' | 'BLOCKED' | 'IDLE' => {
  if (status === 'IDLE') return 'IDLE'
  
  const reasonLower = reason.toLowerCase()
  
  // Si la reason dice execute/approved, es SUCCESS aunque el backend diga REJECTED
  const hasSuccessKeyword = SUCCESS_KEYWORDS.some(kw => reasonLower.includes(kw))
  const hasModifyKeyword = MODIFY_KEYWORDS.some(kw => reasonLower.includes(kw))
  
  if (status === 'ACCEPTED' || hasSuccessKeyword) {
    return hasModifyKeyword ? 'MODIFY' : 'SUCCESS'
  }
  
  return 'BLOCKED'
}

/**
 * 💭 Card mostrando resultado del Dream Simulator
 */
export const DreamForgeCard: React.FC<DreamForgeCardProps> = ({
  effectName,
  status,
  reason,
  riskLevel,
  confidence = 0
}) => {
  // WAVE 1169: Usar lógica corregida
  const realStatus = parseRealStatus(status, reason)
  
  const isIdle = realStatus === 'IDLE'
  const isSuccess = realStatus === 'SUCCESS'
  const isModify = realStatus === 'MODIFY'
  const isBlocked = realStatus === 'BLOCKED'
  
  // Colores según estado REAL
  const statusColor = isSuccess 
    ? 'var(--accent-success, #22c55e)' 
    : isModify
      ? 'var(--accent-warning, #fbbf24)'
      : isBlocked 
        ? 'var(--accent-error, #ef4444)' 
        : 'var(--text-muted, #64748b)'
  
  // Class modifier
  const statusClass = isSuccess ? 'accepted' : isModify ? 'modify' : isBlocked ? 'rejected' : 'idle'
  
  return (
    <div className={`consciousness-card dream-forge-card dream-forge-card--${statusClass}`}>
      <div className="consciousness-card__header">
        <DreamCloudIcon size={14} color="var(--cat-dream)" />
        <span>DREAM FORGE</span>
      </div>

      <div className="consciousness-card__body">
        {/* IDLE State */}
        {isIdle && (
          <div className="dream-forge-card__idle">
            <span className="dream-forge-card__idle-icon">💤</span>
            <span className="dream-forge-card__idle-text">Waiting for trigger...</span>
          </div>
        )}

        {/* SUCCESS State - Verde puro */}
        {isSuccess && effectName && (
          <div className="dream-forge-card__success">
            <div className="dream-forge-card__result dream-forge-card__result--accepted">
              <span className="dream-forge-card__result-icon">✨</span>
              <span className="dream-forge-card__result-label">CASTING:</span>
            </div>
            <div className="dream-forge-card__effect-name" style={{ color: statusColor }}>
              {formatEffectName(effectName)}
            </div>
            {/* Confidence si existe */}
            {confidence > 0 && (
              <div className="dream-forge-card__confidence">
                <span className="neural-label">Confidence:</span>
                <span className="dream-forge-card__confidence-value">{Math.round(confidence * 100)}%</span>
              </div>
            )}
          </div>
        )}

        {/* MODIFY State - Amarillo, ejecuta CON condiciones */}
        {isModify && effectName && (
          <div className="dream-forge-card__modify">
            <div className="dream-forge-card__result dream-forge-card__result--modify">
              <span className="dream-forge-card__result-icon">⚡</span>
              <span className="dream-forge-card__result-label">CASTING:</span>
            </div>
            <div className="dream-forge-card__effect-name" style={{ color: statusColor }}>
              {formatEffectName(effectName)}
            </div>
            {/* Mostrar la modificación aplicada */}
            <div className="dream-forge-card__modification">
              <span className="dream-forge-card__mod-badge">MODIFIED</span>
            </div>
          </div>
        )}

        {/* BLOCKED State - Rojo */}
        {isBlocked && (
          <div className="dream-forge-card__blocked">
            <div className="dream-forge-card__result dream-forge-card__result--rejected">
              <span className="dream-forge-card__result-icon">🚫</span>
              <span className="dream-forge-card__result-label">BLOCKED</span>
            </div>
            {effectName && (
              <div className="dream-forge-card__effect-name dream-forge-card__effect-name--blocked">
                {formatEffectName(effectName)}
              </div>
            )}
            <div className="dream-forge-card__reason" title={reason}>
              {reason.length > 40 ? reason.slice(0, 40) + '...' : reason}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DreamForgeCard
