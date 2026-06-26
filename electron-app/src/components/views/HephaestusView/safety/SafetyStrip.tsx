/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡 WAVE 4811 — SAFETY STRIP · G1–G7 BADGES
 * Header-embedded safety indicators. Always visible. Reactive.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useMemo, useState, useEffect, useRef } from 'react'
import type { HephAutomationClipV3 } from '../../../../core/hephaestus/types'
import { evaluateGates, autoFixGate } from './gateEvaluators'
import type { GateResult, GateId, GateStatus } from './gateEvaluators'
import './SafetyStrip.css'

// ─── PROPS ──────────────────────────────────────────────────────────────────

interface SafetyStripProps {
  clip: HephAutomationClipV3
  onClipPatch: (patch: Partial<HephAutomationClipV3>) => void
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<GateStatus, string> = {
  pass: '#4ade80',
  warn: '#fbbf24',
  fail: '#f87171',
  na:   'rgba(255,255,255,0.18)',
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export const SafetyStrip: React.FC<SafetyStripProps> = ({ clip, onClipPatch }) => {
  const [showDetail, setShowDetail] = useState(false)
  const [focusGate, setFocusGate] = useState<GateId | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const gates = useMemo(() => evaluateGates(clip), [clip])

  const failCount = gates.filter(g => g.status === 'fail').length
  const warnCount = gates.filter(g => g.status === 'warn').length
  const allPass   = failCount === 0 && warnCount === 0

  // Close on outside click
  useEffect(() => {
    if (!showDetail) return
    const handler = (e: MouseEvent) => {
      if (detailRef.current && !detailRef.current.contains(e.target as Node)) {
        setShowDetail(false)
        setFocusGate(null)
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler) }
  }, [showDetail])

  const handleBadgeClick = (id: GateId) => {
    if (focusGate === id && showDetail) {
      setShowDetail(false)
      setFocusGate(null)
    } else {
      setFocusGate(id)
      setShowDetail(true)
    }
  }

  const handleAutoFix = (id: GateId) => {
    const patch = autoFixGate(id, clip)
    if (Object.keys(patch).length > 0) {
      onClipPatch(patch)
    }
  }

  return (
    <div className="heph-safety" ref={detailRef}>
      {/* ── 7 Badges ── */}
      <div className="heph-safety__strip" title="Safety Gates — click for detail">
        {gates.map(gate => (
          <button
            key={gate.id}
            className={`heph-safety__badge ${focusGate === gate.id && showDetail ? 'heph-safety__badge--focus' : ''}`}
            style={{ '--gate-color': STATUS_COLOR[gate.status] } as React.CSSProperties}
            onClick={() => handleBadgeClick(gate.id)}
            title={`${gate.id}: ${gate.label} — ${gate.description}`}
            type="button"
          >
            <span className="heph-safety__badge-dot" />
            <span className="heph-safety__badge-id">{gate.id}</span>
          </button>
        ))}
        {/* Summary indicator */}
        <span className={`heph-safety__summary ${allPass ? 'heph-safety__summary--ok' : failCount > 0 ? 'heph-safety__summary--fail' : 'heph-safety__summary--warn'}`}>
          {allPass ? '🛡' : failCount > 0 ? `${failCount}✗` : `${warnCount}⚠`}
        </span>
      </div>

      {/* ── Detail Overlay ── */}
      {showDetail && (
        <div className="heph-safety__detail">
          <div className="heph-safety__detail-header">
            <span className="heph-safety__detail-title">🛡 SAFETY GATES</span>
            <button
              className="heph-safety__detail-close"
              onClick={() => { setShowDetail(false); setFocusGate(null) }}
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="heph-safety__detail-list">
            {gates.map(gate => (
              <div
                key={gate.id}
                className={`heph-safety__gate-row ${focusGate === gate.id ? 'heph-safety__gate-row--focus' : ''}`}
                style={{ '--gate-color': STATUS_COLOR[gate.status] } as React.CSSProperties}
              >
                <div className="heph-safety__gate-left">
                  <span className="heph-safety__gate-dot" />
                  <span className="heph-safety__gate-id">{gate.id}</span>
                  <span className="heph-safety__gate-label">{gate.label}</span>
                </div>
                <span className="heph-safety__gate-desc">{gate.description}</span>
                {gate.autoFixable && gate.status !== 'pass' && gate.status !== 'na' && (
                  <button
                    className="heph-safety__gate-fix"
                    onClick={() => handleAutoFix(gate.id)}
                    type="button"
                  >
                    AUTO-FIX
                  </button>
                )}
              </div>
            ))}
          </div>
          {!allPass && (
            <div className="heph-safety__detail-footer">
              <span className="heph-safety__detail-hint">
                {failCount > 0 ? `${failCount} gate(s) failing — resolve before save` : `${warnCount} warning(s) — can save but review`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
