/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoOracle> — WAVE 7584: ECO-MODE FALLBACK FOR <OracleHybrid>
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7.3.
 *
 * What it kills (vs `OracleHybrid`):
 *   • The 60-point SVG sparkline + `setSparklineData` state updates.
 *   • The infinite `point-pulse` SVG animation.
 *   • The `backdrop-filter: blur(4px)` on the energy badge.
 *   • The `alert-pulse` infinite animation on the alert container.
 *   • The `transition: all` amplifier.
 *
 * What it keeps:
 *   • The operator can still see the current prediction and its probability.
 *   • The energy zone (CALM / RISING / PEAK / FALLING).
 *   • The trend direction (↑ RISING / ↓ FALLING / → STABLE) — derived from
 *     `energyVelocity`, conveying the same information as the sparkline at
 *     zero rendering cost.
 *   • Alerts — as a static colored border on the panel, no animation.
 *
 * Design (audit §3.7.3):
 *   • Replace the sparkline with a 3-level trend indicator: a single text
 *     element showing `↑ RISING`, `↓ FALLING`, or `→ STABLE` based on
 *     `energyVelocity`. No SVG, no path computation, no `setSparklineData`.
 *   • Energy value badge is plain text with a solid `background: rgba(0,0,0,0.6)`
 *     — no `backdrop-filter`.
 *   • Zone indicator is a colored text label — no glow, no animation.
 *   • Alerts are a static colored border on the panel — no `alert-pulse`, no
 *     `transition: all`. Border color changes at 5 Hz; a border-color change
 *     is a cheap compositor op.
 *
 * Props: same interface as `OracleHybrid` — the swap in `ConsciousnessView`
 * is a drop-in. The component also reads the freshest `energyVelocity` from
 * the transient store via `useThrottledTruthSelector` (5 Hz) so the trend
 * indicator reflects real-time dynamics, not the ~2 Hz `useTruthAI` cadence.
 *
 * @module components/views/ConsciousnessView/EcoOracle
 * @version 7584.0.0 - Eco-Mode
 */

import React, { memo, useMemo } from 'react'
import { useThrottledTruthSelector } from '../../../hooks/useThrottledTruthSelector'
import type { SeleneTruth } from '../../../core/protocol/SeleneProtocol'
import './EcoOracle.css'

// ═══════════════════════════════════════════════════════════════════════════════
// PROPS — identical to OracleHybridProps (drop-in swap)
// ═══════════════════════════════════════════════════════════════════════════════

export interface EcoOracleProps {
  prediction: string | null
  probability: number
  energyTrend: 'rising' | 'falling' | 'stable' | 'spike'
  energyZone: 'calm' | 'rising' | 'peak' | 'falling'
  energyVelocity: number
  energyValue: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

type AlertType = 'drop' | 'spike' | 'buildup' | 'breakdown' | null

const ZONE_CONFIG: Record<string, { label: string; color: string }> = {
  calm: { label: 'CALM', color: '#3b82f6' },
  rising: { label: 'RISING', color: '#22c55e' },
  peak: { label: 'PEAK', color: '#ef4444' },
  falling: { label: 'FALLING', color: '#a855f7' },
}

const ALERT_CONFIG: Record<string, { label: string; color: string }> = {
  drop: { label: 'DROP INCOMING', color: '#ef4444' },
  spike: { label: 'IMPACT DETECTED', color: '#fbbf24' },
  buildup: { label: 'BUILDUP', color: '#22c55e' },
  breakdown: { label: 'BREAKDOWN', color: '#a855f7' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function parseAlertType(
  prediction: string | null,
  probability: number,
  energyTrend: string,
  energyZone: string,
): AlertType {
  if (prediction && probability > 0.3) {
    const lower = prediction.toLowerCase()
    if (lower.includes('drop') || lower.includes('incoming')) return 'drop'
    if (lower.includes('spike') || lower.includes('impact')) return 'spike'
    if (lower.includes('build') || lower.includes('rising')) return 'buildup'
    if (lower.includes('break') || lower.includes('down')) return 'breakdown'
  }
  if (energyTrend === 'spike') return 'spike'
  if (energyTrend === 'rising' && energyZone !== 'calm') return 'buildup'
  if (energyTrend === 'falling' && energyZone === 'falling') return 'breakdown'
  return null
}

/** Derive a 3-level trend from energyVelocity (audit §3.7.3). */
function deriveTrend(velocity: number): { arrow: string; label: string; color: string } {
  // Threshold: 0.002 is ~1% energy change per second — below that is "stable".
  if (velocity > 0.002) return { arrow: '↑', label: 'RISING', color: '#22c55e' }
  if (velocity < -0.002) return { arrow: '↓', label: 'FALLING', color: '#ef4444' }
  return { arrow: '→', label: 'STABLE', color: '#fbbf24' }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR — read the freshest energyVelocity from the transient store at 5 Hz
// ═══════════════════════════════════════════════════════════════════════════════

function selectEnergyVelocity(truth: SeleneTruth): number {
  return truth.consciousness?.ai?.energyVelocity ?? 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const EcoOracle: React.FC<EcoOracleProps> = memo(({
  prediction,
  probability,
  energyTrend,
  energyZone,
  energyVelocity,
  energyValue,
}) => {
  // Read the freshest energyVelocity from the transient store at 5 Hz — this
  // drives the trend indicator with real-time dynamics, not the ~2 Hz
  // useTruthAI cadence the parent passes via props.
  const liveVelocity = useThrottledTruthSelector(selectEnergyVelocity, 200)
  const velocity = liveVelocity ?? energyVelocity

  const alertType = useMemo(
    () => parseAlertType(prediction, probability, energyTrend, energyZone),
    [prediction, probability, energyTrend, energyZone],
  )
  const alertConfig = alertType ? ALERT_CONFIG[alertType] : null
  const zoneConfig = ZONE_CONFIG[energyZone] ?? ZONE_CONFIG.calm
  const trend = deriveTrend(velocity)

  // Static colored border for alerts — no animation, no transition: all.
  const alertBorderColor = alertConfig ? alertConfig.color : 'var(--border-subtle, #2a2a3a)'

  return (
    <div
      className="eco-oracle"
      style={{ borderColor: alertBorderColor }}
    >
      {/* Header */}
      <div className="eco-oracle__header">
        <span className="eco-oracle__title">THE ORACLE</span>
        {alertConfig ? (
          <span className="eco-oracle__alert" style={{ color: alertConfig.color }}>
            {alertConfig.label} {Math.round(probability * 100)}%
          </span>
        ) : (
          <span className="eco-oracle__alert eco-oracle__alert--idle">TRACKING</span>
        )}
      </div>

      {/* Energy value — plain text badge, solid background, no backdrop-filter */}
      <div className="eco-oracle__energy">
        <span className="eco-oracle__energy-value">{(energyValue * 100).toFixed(0)}</span>
        <span className="eco-oracle__energy-unit">%</span>
      </div>

      {/* Trend indicator — 3-level text, replaces the SVG sparkline */}
      <div className="eco-oracle__trend" style={{ color: trend.color }}>
        <span className="eco-oracle__trend-arrow">{trend.arrow}</span>
        <span className="eco-oracle__trend-label">{trend.label}</span>
      </div>

      {/* Zone + velocity — colored text labels, no glow */}
      <div className="eco-oracle__zone-row">
        <span className="eco-oracle__zone" style={{ color: zoneConfig.color }}>
          {zoneConfig.label}
        </span>
        <span className="eco-oracle__velocity" style={{ color: trend.color }}>
          {velocity >= 0 ? '+' : ''}{(velocity * 100).toFixed(1)}/s
        </span>
      </div>
    </div>
  )
})

EcoOracle.displayName = 'EcoOracle'

export default EcoOracle
