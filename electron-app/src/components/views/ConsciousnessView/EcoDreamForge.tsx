/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoDreamForge> — WAVE 7585: ECO-MODE FALLBACK FOR <DreamForgeComplete>
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7 (Consciousness fallbacks).
 *
 * What it kills: heavy visualizers, effect emoji animations, status badge
 * glows, and any box-shadow / transition: all on history items.
 *
 * What it keeps: the current dream effect name, status, reason, risk level,
 * and the last few dream history entries — all as plain text / flat DOM.
 *
 * Design:
 *   • Current effect + status as plain text with a flat colored border.
 *   • Reason as plain text — no text-shadow.
 *   • History as flat text rows (last 5) — no card backgrounds, no shadows.
 *   • No `box-shadow`, no `animation`, no `transition: all` on any element.
 *
 * Props: same interface as `DreamForgeComplete` — drop-in swap.
 *
 * @module components/views/ConsciousnessView/EcoDreamForge
 * @version 7585.0.0 - Eco-Mode
 */

import React, { memo } from 'react'
import type { DreamHistoryEntry, DreamForgeCompleteProps } from './DreamForgeComplete'
import './EcoDreamForge.css'

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: 'ACCEPTED', color: '#22c55e' },
  REJECTED: { label: 'REJECTED', color: '#ef4444' },
  IDLE: { label: 'IDLE', color: '#6a6a7a' },
}

function formatEffectName(name: string): string {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return `${Math.round(diff / 1000)}s`
  if (diff < 3600000) return `${Math.round(diff / 60000)}m`
  return `${Math.round(diff / 3600000)}h`
}

export const EcoDreamForge: React.FC<DreamForgeCompleteProps> = memo(({
  effectName,
  status,
  reason,
  riskLevel,
  confidence,
  dreamHistory,
}) => {
  const meta = STATUS_META[status] ?? STATUS_META.IDLE
  const history: DreamHistoryEntry[] = dreamHistory ?? []

  return (
    <div className="eco-dream">
      <div className="eco-dream__header">
        <span className="eco-dream__title">DREAM FORGE</span>
        <span className="eco-dream__status" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      <div
        className="eco-dream__current"
        style={{ borderColor: meta.color }}
      >
        <span className="eco-dream__current-name">
          {effectName ? formatEffectName(effectName) : '—'}
        </span>
        <div className="eco-dream__current-meta">
          <span className="eco-dream__meta-item">RISK {Math.round(riskLevel * 100)}%</span>
          <span className="eco-dream__meta-item">CONF {Math.round(confidence * 100)}%</span>
        </div>
      </div>

      {reason && (
        <div className="eco-dream__reason">
          <span className="eco-dream__reason-k">WHY</span>
          <span className="eco-dream__reason-v">{reason}</span>
        </div>
      )}

      {history.length > 0 && (
        <div className="eco-dream__history">
          <span className="eco-dream__history-k">HISTORY</span>
          {history.slice(0, 5).map((h, i) => (
            <div key={i} className="eco-dream__history-row">
              <span className="eco-dream__history-name">{formatEffectName(h.name)}</span>
              <span className="eco-dream__history-score">{h.score.toFixed(2)}</span>
              <span className="eco-dream__history-time">{timeAgo(h.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

EcoDreamForge.displayName = 'EcoDreamForge'

export default EcoDreamForge
