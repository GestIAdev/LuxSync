/**
 * 💭 DREAM FORGE CARD - WAVE 1169/1184
 * "The Simulator" - Muestra resultado del último sueño
 * 
 * Estados:
 * - IDLE: "💤 Waiting for trigger..."
 * - ACCEPTED: Verde. "✨ CASTING: [EffectName]"
 * - MODIFY: Amarillo. "⚡ CASTING (modified): [EffectName]"
 * - REJECTED: Rojo. "🚫 BLOCKED: [Reason]"
 * 
 * WAVE 1169 FIX: Si reason contiene "Execute" o approved keywords, es SUCCESS
 * 
 * 🔮 WAVE 1184: THE NEURAL BINDING
 * - Ghost Data: Si IDLE pero hubo sueño hace < 3s, mantener último resultado
 * - Sub-data: Mostrar Reason real del backend (Context too Warm, Cooldown Active, etc.)
 * - DNA percentage visible
 */

import React, { useEffect, useRef, useState } from 'react'
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

// 🔮 WAVE 1184: Ghost Data duration
const GHOST_DATA_DURATION_MS = 3000

// Formatear nombre de efecto para display
const formatEffectName = (name: string): string => {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// 🔮 WAVE 1184: Formatear reason para display compacto
const formatReason = (reason: string): string => {
  // Mapear razones comunes a versiones cortas
  const reasonMap: Record<string, string> = {
    'context too warm': 'Context: Too Warm',
    'context too cold': 'Context: Too Cold',
    'cooldown active': 'Cooldown Active',
    'cooldown': 'Cooldown Active',
    'texture mismatch': 'Texture Mismatch',
    'texture reject': 'Texture Reject',
    'zone protect': 'Zone Protected',
    'mood blocked': 'Mood Blocked',
    'energy insufficient': 'Low Energy',
    'ethics block': 'Ethics Block',
    'no simulation yet': 'Waiting...',
    'consciousness offline': 'AI Offline',
  }
  
  const lowerReason = reason.toLowerCase()
  for (const [key, value] of Object.entries(reasonMap)) {
    if (lowerReason.includes(key)) {
      return value
    }
  }
  
  // Truncar si es muy largo
  return reason.length > 25 ? reason.slice(0, 25) + '...' : reason
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

// 🔮 WAVE 1184: Tipo para Ghost Data
interface GhostData {
  effectName: string | null
  status: 'ACCEPTED' | 'REJECTED' | 'IDLE'
  reason: string
  confidence: number
  timestamp: number
}

/**
 * 💭 Card mostrando resultado del Dream Simulator
 * WAVE 1184: Con Ghost Data de 3s para que no parpadee en IDLE
 */
export const DreamForgeCard: React.FC<DreamForgeCardProps> = ({
  effectName,
  status,
  reason,
  riskLevel,
  confidence = 0
}) => {
  // 🔮 WAVE 1184: Ghost Data state
  const [ghostData, setGhostData] = useState<GhostData | null>(null)
  const ghostTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Actualizar ghost data cuando hay un resultado real (no IDLE)
  useEffect(() => {
    if (status !== 'IDLE' && effectName) {
      // Nuevo resultado real - guardar como ghost y resetear timer
      setGhostData({
        effectName,
        status,
        reason,
        confidence,
        timestamp: Date.now()
      })
      
      // Cancelar timer anterior
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current)
      }
      
      // Crear timer para limpiar ghost data
      ghostTimerRef.current = setTimeout(() => {
        setGhostData(null)
      }, GHOST_DATA_DURATION_MS)
    }
    
    return () => {
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current)
      }
    }
  }, [status, effectName, reason, confidence])
  
  // Determinar qué datos mostrar (actual o ghost)
  const displayData = status !== 'IDLE' 
    ? { effectName, status, reason, confidence }
    : ghostData 
      ? { ...ghostData, isGhost: true }
      : { effectName: null, status: 'IDLE' as const, reason: 'Waiting for trigger...', confidence: 0 }
  
  const isGhostMode = status === 'IDLE' && ghostData !== null
  
  // WAVE 1169: Usar lógica corregida
  const realStatus = parseRealStatus(displayData.status, displayData.reason)
  
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
  
  // 🔮 WAVE 1184: DNA percentage display
  const dnaPercent = Math.round(displayData.confidence * 100)
  
  return (
    <div className={`consciousness-card dream-forge-card dream-forge-card--${statusClass} ${isGhostMode ? 'dream-forge-card--ghost' : ''}`}>
      <div className="consciousness-card__header">
        <DreamCloudIcon size={14} color="var(--cat-dream)" />
        <span>DREAM FORGE</span>
        {/* 🔮 WAVE 1184: Ghost indicator */}
        {isGhostMode && <span className="dream-forge-card__ghost-badge">RECENT</span>}
      </div>

      <div className="consciousness-card__body">
        {/* IDLE State */}
        {isIdle && !isGhostMode && (
          <div className="dream-forge-card__idle">
            <span className="dream-forge-card__idle-icon">💤</span>
            <span className="dream-forge-card__idle-text">Waiting for trigger...</span>
          </div>
        )}

        {/* SUCCESS State - Verde puro */}
        {isSuccess && displayData.effectName && (
          <div className="dream-forge-card__success">
            <div className="dream-forge-card__result dream-forge-card__result--accepted">
              <span className="dream-forge-card__result-icon">✨</span>
              <span className="dream-forge-card__result-label">CASTING:</span>
            </div>
            <div className="dream-forge-card__effect-name" style={{ color: statusColor }}>
              {formatEffectName(displayData.effectName)}
            </div>
            {/* 🔮 WAVE 1184: DNA percentage */}
            {dnaPercent > 0 && (
              <div className="dream-forge-card__confidence">
                <span className="neural-label">DNA:</span>
                <span className="dream-forge-card__confidence-value">{dnaPercent}%</span>
              </div>
            )}
          </div>
        )}

        {/* MODIFY State - Amarillo, ejecuta CON condiciones */}
        {isModify && displayData.effectName && (
          <div className="dream-forge-card__modify">
            <div className="dream-forge-card__result dream-forge-card__result--modify">
              <span className="dream-forge-card__result-icon">⚡</span>
              <span className="dream-forge-card__result-label">CASTING:</span>
            </div>
            <div className="dream-forge-card__effect-name" style={{ color: statusColor }}>
              {formatEffectName(displayData.effectName)}
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
            {displayData.effectName && (
              <div className="dream-forge-card__effect-name dream-forge-card__effect-name--blocked">
                {formatEffectName(displayData.effectName)}
              </div>
            )}
            {/* 🔮 WAVE 1184: Reason formateada */}
            <div className="dream-forge-card__reason" title={displayData.reason}>
              {formatReason(displayData.reason)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DreamForgeCard
