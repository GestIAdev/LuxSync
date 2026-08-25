/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoEthicsCouncil> — WAVE 7585: ECO-MODE FALLBACK FOR <EthicsCouncilExpanded>
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7.4.
 *
 * What it kills: the `transition: all 0.2s ease` on vote cards and the inset
 * `box-shadow` re-rasters on vote status change.
 *
 * What it keeps: the 3 votes (Beauty/Energy/Calm) and the consensus score.
 *
 * Design (audit §3.7.4):
 *   • Three vote cards as plain text rows: `🦋 BEAUTY: FOR (0.82)`.
 *     No card backgrounds, no inset shadows, no transitions.
 *   • Consensus score is a single percentage text — no progress bar fill
 *     animation.
 *   • Vote status changes are instant (no `transition: all`). A text color
 *     change (green/red/gray) is a cheap compositor op.
 *   • No `box-shadow`, no `transition: all` on any element.
 *
 * Props: same interface as `EthicsCouncilExpanded` — drop-in swap.
 *
 * @module components/views/ConsciousnessView/EcoEthicsCouncil
 * @version 7585.0.0 - Eco-Mode
 */

import React, { memo } from 'react'
import type { BackendCouncilVotes, BackendCouncilVote } from './EthicsCouncilExpanded'
import './EcoEthicsCouncil.css'

export interface EcoEthicsCouncilProps {
  ethicsFlags: string[]
  energyOverrideActive: boolean
  beautyScore: number
  confidence: number
  councilVotes?: BackendCouncilVotes
  consensusScore?: number
}

const VOTE_META: { key: keyof BackendCouncilVotes; emoji: string; label: string }[] = [
  { key: 'beauty', emoji: '🦋', label: 'BEAUTY' },
  { key: 'energy', emoji: '🦊', label: 'ENERGY' },
  { key: 'calm', emoji: '🐋', label: 'CALM' },
]

function voteClass(v: BackendCouncilVote): string {
  if (v.vote === 'for') return 'eco-ethics__vote--for'
  if (v.vote === 'against') return 'eco-ethics__vote--against'
  return 'eco-ethics__vote--abstain'
}

function voteLabel(v: BackendCouncilVote): string {
  return v.vote.toUpperCase()
}

export const EcoEthicsCouncil: React.FC<EcoEthicsCouncilProps> = memo(({
  councilVotes,
  consensusScore,
  ethicsFlags,
  energyOverrideActive,
}) => {
  const consensus = consensusScore ?? 0.33
  const hasFlags = ethicsFlags.length > 0 || energyOverrideActive

  return (
    <div className="eco-ethics">
      <div className="eco-ethics__header">
        <span className="eco-ethics__title">ETHICS COUNCIL</span>
        <span className="eco-ethics__consensus">{Math.round(consensus * 100)}%</span>
      </div>

      <div className="eco-ethics__votes">
        {VOTE_META.map(({ key, emoji, label }) => {
          const vote = councilVotes?.[key]
          const status = vote ? voteLabel(vote) : '—'
          const conf = vote ? vote.confidence : 0
          return (
            <div key={key} className="eco-ethics__vote-row">
              <span className="eco-ethics__vote-emoji">{emoji}</span>
              <span className="eco-ethics__vote-label">{label}</span>
              <span className={`eco-ethics__vote-status ${vote ? voteClass(vote) : ''}`}>
                {status}
              </span>
              <span className="eco-ethics__vote-conf">
                {vote ? `(${conf.toFixed(2)})` : ''}
              </span>
            </div>
          )
        })}
      </div>

      {hasFlags && (
        <div className="eco-ethics__flags">
          {energyOverrideActive && (
            <span className="eco-ethics__flag">⚠ ENERGY OVERRIDE</span>
          )}
          {ethicsFlags.slice(0, 2).map((f, i) => (
            <span key={i} className="eco-ethics__flag">⚠ {f}</span>
          ))}
        </div>
      )}
    </div>
  )
})

EcoEthicsCouncil.displayName = 'EcoEthicsCouncil'

export default EcoEthicsCouncil
