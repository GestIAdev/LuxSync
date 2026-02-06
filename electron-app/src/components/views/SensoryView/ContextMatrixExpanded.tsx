/**
 * 📊 CONTEXT MATRIX EXPANDED - WAVE 1193: THE GREAT DIVIDE
 * 
 * Matriz de contexto expandida con:
 * - 8 cards grandes y legibles
 * - Mini-sparklines de tendencia
 * - Valores secundarios visibles
 * - Sin scroll, todo visible
 */

import React, { memo, useMemo, useState, useEffect, useRef } from 'react'
import { useTruthContext, useTruthCognitive, useTruthAudio, useTruthBeat } from '../../../hooks/useSeleneTruth'
import { ContextMatrixIcon } from '../../icons/LuxIcons'
import type { SectionType, MusicalKey, MusicalMode } from '../../../core/protocol/MusicalContext'
import type { VibeId } from '../../../core/protocol/SeleneProtocol'
import './ContextMatrixExpanded.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SPARKLINE_HISTORY_SIZE = 30 // 30 samples

const KEY_DISPLAY: Record<MusicalKey, string> = {
  'C': 'C', 'C#': 'C♯', 'D': 'D', 'D#': 'D♯', 'E': 'E', 'F': 'F',
  'F#': 'F♯', 'G': 'G', 'G#': 'G♯', 'A': 'A', 'A#': 'A♯', 'B': 'B',
}

const MODE_CONFIG: Record<MusicalMode, { label: string; color: string }> = {
  'major': { label: 'Major', color: '#22c55e' },
  'minor': { label: 'Minor', color: '#f97316' },
  'unknown': { label: '?', color: '#64748b' },
}

const SECTION_CONFIG: Record<SectionType, { label: string; emoji: string; color: string }> = {
  'intro': { label: 'INTRO', emoji: '🌅', color: '#60a5fa' },
  'verse': { label: 'VERSE', emoji: '📖', color: '#a78bfa' },
  'chorus': { label: 'CHORUS', emoji: '🎤', color: '#f472b6' },
  'bridge': { label: 'BRIDGE', emoji: '🌉', color: '#facc15' },
  'breakdown': { label: 'BREAKDOWN', emoji: '⬇️', color: '#818cf8' },
  'buildup': { label: 'BUILDUP', emoji: '📈', color: '#fbbf24' },
  'drop': { label: 'DROP', emoji: '💥', color: '#ef4444' },
  'outro': { label: 'OUTRO', emoji: '🌙', color: '#64748b' },
  'unknown': { label: 'SCANNING', emoji: '🔍', color: '#475569' },
}

const ENERGY_ZONE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  'peak': { label: 'PEAK', emoji: '🔥', color: '#ef4444' },
  'rising': { label: 'RISING', emoji: '📈', color: '#f97316' },
  'calm': { label: 'CALM', emoji: '🌿', color: '#22c55e' },
  'falling': { label: 'FALLING', emoji: '📉', color: '#3b82f6' },
  'idle': { label: 'IDLE', emoji: '💤', color: '#64748b' },
}

const VIBE_CONFIG: Record<VibeId, { label: string; color: string; emoji: string }> = {
  'techno-club': { label: 'Techno Club', color: '#ef4444', emoji: '🎛️' },
  'fiesta-latina': { label: 'Fiesta Latina', color: '#f97316', emoji: '💃' },
  'pop-rock': { label: 'Pop Rock', color: '#8b5cf6', emoji: '🎸' },
  'chill-lounge': { label: 'Chill Lounge', color: '#06b6d4', emoji: '🍸' },
  'idle': { label: 'Idle', color: '#64748b', emoji: '💤' },
  'custom': { label: 'Custom', color: '#a855f7', emoji: '✨' },
}

// ═══════════════════════════════════════════════════════════════════════════
// SPARKLINE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SparklineProps {
  data: number[]
  color: string
  height?: number
}

const Sparkline: React.FC<SparklineProps> = memo(({ data, color, height = 20 }) => {
  if (data.length < 2) return null
  
  const width = 60
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (val * height)
    return `${x},${y}`
  }).join(' ')
  
  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="context-matrix-expanded__sparkline"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
})

Sparkline.displayName = 'Sparkline'

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ContextCardProps {
  label: string
  value: string
  subValue?: string
  emoji?: string
  color: string
  sparklineData?: number[]
}

const ContextCard: React.FC<ContextCardProps> = memo(({ 
  label, 
  value, 
  subValue, 
  emoji, 
  color,
  sparklineData 
}) => {
  return (
    <div className="context-matrix-expanded__card">
      <div className="context-matrix-expanded__card-header">
        {emoji && <span className="context-matrix-expanded__card-emoji">{emoji}</span>}
        <span className="context-matrix-expanded__card-label">{label}</span>
      </div>
      <div className="context-matrix-expanded__card-body">
        <span 
          className="context-matrix-expanded__card-value"
          style={{ color }}
        >
          {value}
        </span>
        {subValue && (
          <span className="context-matrix-expanded__card-subvalue">
            {subValue}
          </span>
        )}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="context-matrix-expanded__card-sparkline">
          <Sparkline data={sparklineData} color={color} />
        </div>
      )}
    </div>
  )
})

ContextCard.displayName = 'ContextCard'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ContextMatrixExpanded: React.FC = memo(() => {
  const context = useTruthContext()
  const cognitive = useTruthCognitive()
  const audio = useTruthAudio()
  const beat = useTruthBeat()
  
  // Sparkline histories
  const bpmHistoryRef = useRef<number[]>([])
  const energyHistoryRef = useRef<number[]>([])
  const [bpmHistory, setBpmHistory] = useState<number[]>([])
  const [energyHistory, setEnergyHistory] = useState<number[]>([])
  
  // Update sparkline data
  useEffect(() => {
    // BPM history (normalized 0-1 in range 60-180)
    const normalizedBpm = Math.max(0, Math.min(1, (beat.bpm - 60) / 120))
    bpmHistoryRef.current.push(normalizedBpm)
    if (bpmHistoryRef.current.length > SPARKLINE_HISTORY_SIZE) {
      bpmHistoryRef.current.shift()
    }
    setBpmHistory([...bpmHistoryRef.current])
    
    // Energy history
    energyHistoryRef.current.push(audio.energy)
    if (energyHistoryRef.current.length > SPARKLINE_HISTORY_SIZE) {
      energyHistoryRef.current.shift()
    }
    setEnergyHistory([...energyHistoryRef.current])
  }, [beat.bpm, audio.energy])
  
  // Extract values
  const key = context.key || 'C'
  const mode = context.mode || 'unknown'
  const section = context.section?.type || 'unknown'
  const sectionConf = context.section?.confidence || 0
  const vibe = cognitive.vibe?.active || 'idle'
  const energyZone = cognitive.ai?.energyZone || 'idle'
  
  // Configs
  const modeInfo = MODE_CONFIG[mode]
  const sectionInfo = SECTION_CONFIG[section]
  const vibeInfo = VIBE_CONFIG[vibe]
  const energyInfo = ENERGY_ZONE_CONFIG[energyZone] || ENERGY_ZONE_CONFIG['idle']
  
  // Calculate trend direction
  const energyTrend = useMemo(() => {
    if (energyHistory.length < 10) return 'stable'
    const recent = energyHistory.slice(-5).reduce((a, b) => a + b, 0) / 5
    const older = energyHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
    const diff = recent - older
    if (diff > 0.05) return '↗ Rising'
    if (diff < -0.05) return '↘ Falling'
    return '→ Stable'
  }, [energyHistory])

  return (
    <div className="titan-card context-matrix-expanded">
      {/* Header */}
      <div className="titan-card__header">
        <div className="titan-card__title">
          <ContextMatrixIcon size={18} color="var(--accent-primary)" />
          <span>CONTEXT MATRIX</span>
        </div>
      </div>
      
      {/* Grid of 8 cards */}
      <div className="context-matrix-expanded__grid">
        {/* Row 1 */}
        <ContextCard
          label="BPM"
          value={beat.bpm?.toString() || '--'}
          subValue={`±${Math.round((1 - beat.confidence) * 5)} drift`}
          emoji="🎵"
          color="var(--accent-primary)"
          sparklineData={bpmHistory}
        />
        
        <ContextCard
          label="KEY"
          value={`${KEY_DISPLAY[key]}${mode === 'minor' ? 'm' : ''}`}
          subValue={modeInfo.label}
          emoji="🎹"
          color={modeInfo.color}
        />
        
        <ContextCard
          label="SECTION"
          value={sectionInfo.label}
          subValue={`${Math.round(sectionConf * 100)}% conf`}
          emoji={sectionInfo.emoji}
          color={sectionInfo.color}
        />
        
        <ContextCard
          label="ENERGY"
          value={`${Math.round(audio.energy * 100)}%`}
          subValue={energyInfo.label}
          emoji="⚡"
          color={energyInfo.color}
          sparklineData={energyHistory}
        />
        
        {/* Row 2 */}
        <ContextCard
          label="VIBE"
          value={vibeInfo.label}
          emoji={vibeInfo.emoji}
          color={vibeInfo.color}
        />
        
        <ContextCard
          label="TREND"
          value={energyTrend}
          emoji="📈"
          color={energyTrend.includes('Rising') ? '#22c55e' : energyTrend.includes('Falling') ? '#ef4444' : '#64748b'}
        />
        
        <ContextCard
          label="ZONE"
          value={energyInfo.label}
          emoji={energyInfo.emoji}
          color={energyInfo.color}
        />
        
        <ContextCard
          label="CONFIDENCE"
          value={`${Math.round(beat.confidence * 100)}%`}
          subValue="Beat detection"
          emoji="🎯"
          color={beat.confidence > 0.7 ? '#22c55e' : beat.confidence > 0.4 ? '#f97316' : '#ef4444'}
        />
      </div>
    </div>
  )
})

ContextMatrixExpanded.displayName = 'ContextMatrixExpanded'

export default ContextMatrixExpanded
