/**
 * ⚖️ ETHICS COUNCIL EXPANDED - WAVE 1194: CONSCIOUSNESS UNLEASHED
 * 
 * "La Democracia Visible" - Dejamos de esconder la lógica. Mostramos la democracia.
 * 
 * Visual: 3 Tarjetas de Voto ("Beauty 🦋", "Energy 🦊", "Calm 🐋")
 * Feedback: Verás quién vota a favor y quién en contra.
 * Metric: "Consensus Score" visible.
 */

import React, { memo, useMemo } from 'react'
import { 
  CouncilGavelIcon,
  ButterflyBeautyIcon,
  FoxEnergyIcon,
  WhaleCalmIcon,
  VoteForIcon,
  VoteAgainstIcon,
  VoteAbstainIcon
} from '../../icons/LuxIcons'
import './EthicsCouncilExpanded.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

// 🧠 WAVE 1195: Backend council vote structure
export interface BackendCouncilVote {
  vote: 'for' | 'against' | 'abstain'
  confidence: number
  reason: string
}

export interface BackendCouncilVotes {
  beauty: BackendCouncilVote
  energy: BackendCouncilVote
  calm: BackendCouncilVote
}

export interface EthicsCouncilExpandedProps {
  ethicsFlags: string[]
  energyOverrideActive: boolean
  beautyScore: number
  confidence: number
  // 🧠 WAVE 1195: Real votes from backend
  councilVotes?: BackendCouncilVotes
  consensusScore?: number
}

type VoteStatus = 'for' | 'against' | 'abstain'

interface CouncilVote {
  id: string
  name: string
  emoji: string
  Icon: React.FC<{ size?: number; color?: string }>
  color: string
  status: VoteStatus
  reason: string
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIC: Calculate votes based on current state
// ═══════════════════════════════════════════════════════════════════════════

function calculateVotes(
  ethicsFlags: string[], 
  energyOverrideActive: boolean,
  beautyScore: number,
  confidence: number
): CouncilVote[] {
  // Flags que indican problemas
  const hasStrobeRisk = ethicsFlags.some(f => 
    f.toLowerCase().includes('strobe') || f.toLowerCase().includes('epilep')
  )
  const hasIntensityAbuse = ethicsFlags.some(f => 
    f.toLowerCase().includes('intensity') || f.toLowerCase().includes('fatigue')
  )
  const hasColorChaos = ethicsFlags.some(f => 
    f.toLowerCase().includes('color') || f.toLowerCase().includes('chaos')
  )
  const hasBassFlooding = ethicsFlags.some(f => 
    f.toLowerCase().includes('bass') || f.toLowerCase().includes('flood')
  )
  
  // 🦋 BEAUTY - Vota basado en estética y color
  const beautyStatus: VoteStatus = hasColorChaos 
    ? 'against' 
    : beautyScore > 0.6 
      ? 'for' 
      : 'abstain'
  const beautyReason = hasColorChaos 
    ? 'Color chaos detected'
    : beautyScore > 0.6 
      ? 'Aesthetic harmony achieved'
      : 'Waiting for beauty signal'
  
  // 🦊 ENERGY - Vota basado en energía y patrones
  const energyStatus: VoteStatus = energyOverrideActive || hasIntensityAbuse
    ? 'against'
    : confidence > 0.7
      ? 'for'
      : 'abstain'
  const energyReason = energyOverrideActive
    ? 'Energy override active'
    : hasIntensityAbuse
      ? 'Intensity abuse detected'
      : confidence > 0.7
        ? 'Energy pattern approved'
        : 'Analyzing energy levels'
  
  // 🐋 CALM - Vota basado en seguridad
  const calmStatus: VoteStatus = hasStrobeRisk || hasBassFlooding
    ? 'against'
    : ethicsFlags.length === 0
      ? 'for'
      : 'abstain'
  const calmReason = hasStrobeRisk
    ? 'Strobe safety concern'
    : hasBassFlooding
      ? 'Bass flooding warning'
      : ethicsFlags.length === 0
        ? 'Environment is safe'
        : 'Monitoring conditions'
  
  return [
    {
      id: 'beauty',
      name: 'BEAUTY',
      emoji: '🦋',
      Icon: ButterflyBeautyIcon,
      color: '#ec4899',
      status: beautyStatus,
      reason: beautyReason
    },
    {
      id: 'energy',
      name: 'ENERGY',
      emoji: '🦊',
      Icon: FoxEnergyIcon,
      color: '#f97316',
      status: energyStatus,
      reason: energyReason
    },
    {
      id: 'calm',
      name: 'CALM',
      emoji: '🐋',
      Icon: WhaleCalmIcon,
      color: '#3b82f6',
      status: calmStatus,
      reason: calmReason
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const EthicsCouncilExpanded: React.FC<EthicsCouncilExpandedProps> = memo(({
  ethicsFlags,
  energyOverrideActive,
  beautyScore,
  confidence,
  councilVotes,
  consensusScore
}) => {
  // 🧠 WAVE 1195: Use backend votes if available, otherwise calculate
  const votes = useMemo(() => {
    if (councilVotes) {
      // Use real backend data
      return [
        {
          id: 'beauty',
          name: 'BEAUTY',
          emoji: '🦋',
          Icon: ButterflyBeautyIcon,
          color: '#ec4899',
          status: councilVotes.beauty.vote,
          reason: councilVotes.beauty.reason,
          confidence: councilVotes.beauty.confidence
        },
        {
          id: 'energy',
          name: 'ENERGY',
          emoji: '🦊',
          Icon: FoxEnergyIcon,
          color: '#f97316',
          status: councilVotes.energy.vote,
          reason: councilVotes.energy.reason,
          confidence: councilVotes.energy.confidence
        },
        {
          id: 'calm',
          name: 'CALM',
          emoji: '🐋',
          Icon: WhaleCalmIcon,
          color: '#3b82f6',
          status: councilVotes.calm.vote,
          reason: councilVotes.calm.reason,
          confidence: councilVotes.calm.confidence
        }
      ]
    }
    // Fallback to calculated votes
    return calculateVotes(ethicsFlags, energyOverrideActive, beautyScore, confidence)
  }, [councilVotes, ethicsFlags, energyOverrideActive, beautyScore, confidence])
  
  // Calculate consensus - use backend value if available
  const forCount = votes.filter(v => v.status === 'for').length
  const againstCount = votes.filter(v => v.status === 'against').length
  const consensusPercent = consensusScore !== undefined 
    ? Math.round(consensusScore * 100)
    : Math.round((forCount / 3) * 100)
  
  const verdict = againstCount >= 2 
    ? 'BLOCKED' 
    : forCount >= 2 
      ? 'APPROVED' 
      : 'PENDING'
  
  const verdictColor = verdict === 'BLOCKED' 
    ? '#ef4444' 
    : verdict === 'APPROVED' 
      ? '#22c55e' 
      : '#fbbf24'

  return (
    <div className="ethics-council">
      {/* HEADER */}
      <div className="ethics-council__header">
        <CouncilGavelIcon size={16} color="var(--accent-secondary)" />
        <span className="ethics-council__title">ETHICS COUNCIL</span>
      </div>
      
      {/* VOTE CARDS */}
      <div className="ethics-council__votes">
        {votes.map(vote => {
          const VoteIcon = vote.status === 'for' 
            ? VoteForIcon 
            : vote.status === 'against' 
              ? VoteAgainstIcon 
              : VoteAbstainIcon
          
          const voteColor = vote.status === 'for'
            ? '#22c55e'
            : vote.status === 'against'
              ? '#ef4444'
              : '#64748b'
          
          return (
            <div 
              key={vote.id}
              className={`ethics-council__vote-card ethics-council__vote-card--${vote.status}`}
              style={{ borderColor: vote.color }}
            >
              {/* Advisor Icon & Name */}
              <div className="ethics-council__advisor">
                <vote.Icon size={24} color={vote.color} />
                <span 
                  className="ethics-council__advisor-name"
                  style={{ color: vote.color }}
                >
                  {vote.name}
                </span>
              </div>
              
              {/* Vote Status */}
              <div className="ethics-council__vote-status">
                <VoteIcon size={20} color={voteColor} />
                <span 
                  className="ethics-council__vote-label"
                  style={{ color: voteColor }}
                >
                  {vote.status === 'for' ? 'FOR' : vote.status === 'against' ? 'AGAINST' : 'ABSTAIN'}
                </span>
              </div>
              
              {/* Reason */}
              <div className="ethics-council__reason" title={vote.reason}>
                {vote.reason}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* CONSENSUS FOOTER */}
      <div className="ethics-council__footer">
        {/* Consensus Bar */}
        <div className="ethics-council__consensus">
          <span className="ethics-council__consensus-label">CONSENSUS</span>
          <div className="ethics-council__consensus-bar">
            <div 
              className="ethics-council__consensus-fill"
              style={{ 
                width: `${consensusPercent}%`,
                backgroundColor: verdictColor
              }}
            />
          </div>
          <span className="ethics-council__consensus-value">{consensusPercent}%</span>
        </div>
        
        {/* Verdict */}
        <div 
          className="ethics-council__verdict"
          style={{ color: verdictColor, borderColor: verdictColor }}
        >
          {verdict}
        </div>
      </div>
    </div>
  )
})

EthicsCouncilExpanded.displayName = 'EthicsCouncilExpanded'

export default EthicsCouncilExpanded
