/**
 * 🎨 DREAM FORGE COMPLETE - WAVE 1194: CONSCIOUSNESS UNLEASHED
 * 
 * "El Historial de Sueños"
 * 
 * Features:
 * - Header: Efecto actual + status badge
 * - Why Block: Texto explicativo de POR QUÉ se eligió
 * - History Queue: Últimos 5 efectos con timestamp
 */

import React, { memo, useState, useEffect, useRef, useMemo } from 'react'
import { 
  DreamCloudIcon,
  ScrollHistoryIcon,
  WhyQuestionIcon
} from '../../icons/LuxIcons'
import './DreamForgeComplete.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// 🧠 WAVE 1195: Backend dream history entry
export interface DreamHistoryEntry {
  name: string
  score: number
  timestamp: number
  reason: string
}

export interface DreamForgeCompleteProps {
  effectName: string | null
  status: 'ACCEPTED' | 'REJECTED' | 'IDLE'
  reason: string
  riskLevel: number
  confidence: number
  // 🧠 WAVE 1195: Real dream history from backend
  dreamHistory?: DreamHistoryEntry[]
}

interface HistoryItem {
  id: number
  effectName: string
  status: 'CAST' | 'BLOCKED'
  timestamp: number // ms ago
}

const SUCCESS_KEYWORDS = ['execute', 'approved', 'casting', 'firing', 'proceed', 'go']
const EFFECT_EMOJIS: Record<string, string> = {
  shimmer: '💫',
  wave: '🌊',
  sparkle: '✨',
  strobe: '⚡',
  wash: '🎨',
  pulse: '💓',
  burst: '💥',
  bloom: '🌸',
  fade: '🌅',
  sweep: '🔄',
  default: '🎭'
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getEffectEmoji(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, emoji] of Object.entries(EFFECT_EMOJIS)) {
    if (lower.includes(key)) return emoji
  }
  return EFFECT_EMOJIS.default
}

function formatEffectName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

function parseRealStatus(status: string, reason: string): 'SUCCESS' | 'BLOCKED' | 'IDLE' {
  if (status === 'IDLE') return 'IDLE'
  const reasonLower = reason.toLowerCase()
  const hasSuccessKeyword = SUCCESS_KEYWORDS.some(kw => reasonLower.includes(kw))
  if (status === 'ACCEPTED' || hasSuccessKeyword) return 'SUCCESS'
  return 'BLOCKED'
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const DreamForgeComplete: React.FC<DreamForgeCompleteProps> = memo(({
  effectName,
  status,
  reason,
  riskLevel,
  confidence,
  dreamHistory
}) => {
  // 🧠 WAVE 1195: Use backend history if available, otherwise simulate
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>([])
  const historyIdRef = useRef(0)
  const lastEffectRef = useRef<string | null>(null)
  
  // Convert backend history to display format
  const history = useMemo((): HistoryItem[] => {
    if (dreamHistory && dreamHistory.length > 0) {
      // Use real backend data
      const now = Date.now()
      return dreamHistory.slice(0, 3).map((entry, idx) => ({
        id: idx,
        effectName: entry.name,
        status: entry.score > 0.5 ? 'CAST' as const : 'BLOCKED' as const,
        timestamp: now - entry.timestamp
      }))
    }
    // Fallback to local simulation
    return localHistory
  }, [dreamHistory, localHistory])
  
  // Add to local history when effect changes (only if no backend history)
  useEffect(() => {
    if (!dreamHistory || dreamHistory.length === 0) {
      if (effectName && effectName !== lastEffectRef.current && status !== 'IDLE') {
        lastEffectRef.current = effectName
        const realStatus = parseRealStatus(status, reason)
        
        setLocalHistory(prev => {
          const newItem: HistoryItem = {
            id: historyIdRef.current++,
            effectName,
            status: realStatus === 'SUCCESS' ? 'CAST' : 'BLOCKED',
            timestamp: 0
          }
          return [newItem, ...prev.slice(0, 4)]
        })
      }
    }
  }, [effectName, status, reason, dreamHistory])
  
  // Update timestamps every second (only for local history)
  useEffect(() => {
    if (!dreamHistory || dreamHistory.length === 0) {
      const interval = setInterval(() => {
        setLocalHistory(prev => prev.map(item => ({
          ...item,
          timestamp: item.timestamp + 1000
        })))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [dreamHistory])
  
  const realStatus = parseRealStatus(status, reason)
  const displayName = effectName ? formatEffectName(effectName) : 'Waiting...'
  const emoji = effectName ? getEffectEmoji(effectName) : '💤'
  
  const statusColor = realStatus === 'SUCCESS' 
    ? '#22c55e' 
    : realStatus === 'BLOCKED' 
      ? '#ef4444' 
      : '#64748b'
  
  const statusLabel = realStatus === 'SUCCESS'
    ? 'CASTING'
    : realStatus === 'BLOCKED'
      ? 'BLOCKED'
      : 'IDLE'

  return (
    <div className="dream-forge">
      {/* HEADER */}
      <div className="dream-forge__header">
        <DreamCloudIcon size={16} color="#ec4899" />
        <span className="dream-forge__title">DREAM FORGE</span>
      </div>
      
      {/* CURRENT DREAM */}
      <div className="dream-forge__current">
        <div className="dream-forge__current-main">
          <span className="dream-forge__current-emoji">{emoji}</span>
          <span className="dream-forge__current-name">{displayName}</span>
          <span 
            className="dream-forge__current-status"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {statusLabel}
          </span>
        </div>
        
        {/* Confidence meter */}
        {realStatus !== 'IDLE' && (
          <div className="dream-forge__confidence">
            <span className="dream-forge__confidence-label">Priority</span>
            <div className="dream-forge__confidence-bar">
              <div 
                className="dream-forge__confidence-fill"
                style={{ 
                  width: `${Math.round(confidence * 100)}%`,
                  backgroundColor: statusColor
                }}
              />
            </div>
            <span className="dream-forge__confidence-value">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
      </div>
      
      {/* WHY BLOCK */}
      <div className="dream-forge__why">
        <div className="dream-forge__why-header">
          <WhyQuestionIcon size={14} color="var(--text-muted)" />
          <span>WHY THIS DREAM?</span>
        </div>
        <div className="dream-forge__why-text">
          {reason || 'Analyzing the musical landscape...'}
        </div>
      </div>
      
      {/* HISTORY */}
      <div className="dream-forge__history">
        <div className="dream-forge__history-header">
          <ScrollHistoryIcon size={14} color="var(--text-muted)" />
          <span>HISTORY</span>
        </div>
        <div className="dream-forge__history-list">
          {history.length === 0 ? (
            <div className="dream-forge__history-empty">
              No dreams yet...
            </div>
          ) : (
            history.map(item => (
              <div 
                key={item.id}
                className={`dream-forge__history-item dream-forge__history-item--${item.status.toLowerCase()}`}
              >
                <span className="dream-forge__history-emoji">
                  {getEffectEmoji(item.effectName)}
                </span>
                <span className="dream-forge__history-name">
                  {formatEffectName(item.effectName)}
                </span>
                <span className="dream-forge__history-time">
                  {formatTimeAgo(item.timestamp)}
                </span>
                <span 
                  className="dream-forge__history-status"
                  style={{ 
                    color: item.status === 'CAST' ? '#22c55e' : '#ef4444'
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
})

DreamForgeComplete.displayName = 'DreamForgeComplete'

export default DreamForgeComplete
