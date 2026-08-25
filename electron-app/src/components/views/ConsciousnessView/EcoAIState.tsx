/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoAIState> — WAVE 7585: ECO-MODE FALLBACK FOR <AIStateTitan>
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7 (Consciousness fallbacks).
 *
 * What it kills: complex layout, state-transition animations, the mini
 * sparkline of beauty trend, and any box-shadow / text-shadow glow.
 *
 * What it keeps: the current hunt state, confidence, beauty score, hunt
 * duration, success rate, and reasoning — all as plain text.
 *
 * Design:
 *   • Core state shown as a colored text label (no glow, no animation).
 *   • Stats (duration, targets, success rate) as plain text rows.
 *   • Reasoning as plain text, truncated — no text-shadow.
 *   • No `box-shadow`, no `animation`, no `transition: all` on any element.
 *
 * Props: same interface as `AIStateTitan` — drop-in swap.
 *
 * @module components/views/ConsciousnessView/EcoAIState
 * @version 7585.0.0 - Eco-Mode
 */

import React, { memo } from 'react'
import type { AIHuntState } from '../../../core/protocol/SeleneProtocol'
import type { HuntStats } from './AIStateTitan'
import './EcoAIState.css'

export interface EcoAIStateProps {
  huntState: AIHuntState
  confidence: number
  beautyScore: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  reasoning: string | null
  huntStats?: HuntStats
}

const STATE_META: Record<AIHuntState, { label: string; color: string }> = {
  sleeping: { label: 'SLEEPING', color: '#64748b' },
  stalking: { label: 'STALKING', color: '#22c55e' },
  evaluating: { label: 'EVALUATING', color: '#fbbf24' },
  striking: { label: 'STRIKING', color: '#ef4444' },
  learning: { label: 'LEARNING', color: '#8b5cf6' },
}

const TREND_ARROW: Record<string, string> = {
  rising: '↑',
  falling: '↓',
  stable: '→',
}

export const EcoAIState: React.FC<EcoAIStateProps> = memo(({
  huntState,
  confidence,
  beautyScore,
  beautyTrend,
  reasoning,
  huntStats,
}) => {
  const meta = STATE_META[huntState] ?? STATE_META.sleeping
  const stats = huntStats ?? { duration: 0, targetsAcquired: 0, successRate: 0 }

  return (
    <div className="eco-ai">
      <div className="eco-ai__header">
        <span className="eco-ai__title">AI STATE</span>
        <span className="eco-ai__state" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      <div className="eco-ai__stats">
        <div className="eco-ai__stat">
          <span className="eco-ai__stat-k">CONF</span>
          <span className="eco-ai__stat-v">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="eco-ai__stat">
          <span className="eco-ai__stat-k">BEAUTY</span>
          <span className="eco-ai__stat-v">
            {(beautyScore * 100).toFixed(0)} {TREND_ARROW[beautyTrend] ?? '→'}
          </span>
        </div>
        <div className="eco-ai__stat">
          <span className="eco-ai__stat-k">DURATION</span>
          <span className="eco-ai__stat-v">{Math.round(stats.duration)}s</span>
        </div>
        <div className="eco-ai__stat">
          <span className="eco-ai__stat-k">TARGETS</span>
          <span className="eco-ai__stat-v">{stats.targetsAcquired}</span>
        </div>
        <div className="eco-ai__stat">
          <span className="eco-ai__stat-k">SUCCESS</span>
          <span className="eco-ai__stat-v">{Math.round(stats.successRate * 100)}%</span>
        </div>
      </div>

      {reasoning && (
        <div className="eco-ai__reasoning">
          <span className="eco-ai__reasoning-k">REASONING</span>
          <span className="eco-ai__reasoning-v">{reasoning}</span>
        </div>
      )}
    </div>
  )
})

EcoAIState.displayName = 'EcoAIState'

export default EcoAIState
