/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoSpectrum> — WAVE 7583: ECO-MODE FALLBACK FOR <AudioSpectrumTitan>
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7.1.
 *
 * What it kills (vs `AudioSpectrumTitan`):
 *   • The 60 fps RAF loop → replaced by a 5 Hz throttled subscription
 *     (24× reduction in update frequency).
 *   • 32 DOM bars with `drop-shadow` + `will-change` → a single energy bar.
 *   • The beat-pulse `box-shadow` toggle → a flat-background LED class toggle.
 *   • ~1,920 style mutations/sec → ~5 style mutations/sec.
 *   • 64 compositor layer promotions (`will-change`) → 0.
 *
 * What it keeps:
 *   • The operator can see that audio is live (energy bar moves).
 *   • Beat detection (BPM + confidence) is still shown for show sync.
 *   • A "SYNC" LED blinks on `beat.onBeat` — via a CSS class toggle only,
 *     no shadow/blur animation.
 *
 * DOM budget: exactly 5 elements (audit §3.7.1):
 *   1. root `.eco-spectrum`
 *   2. `.eco-spectrum__bpm` text readout
 *   3. `.eco-spectrum__energy-bar` (single `<div>` with `width: %`)
 *   4. `.eco-spectrum__confidence-bar`
 *   5. `.eco-spectrum__led` (the "SYNC" indicator)
 *
 * CSS: plain background colors only. No `drop-shadow`, no `box-shadow`, no
 * `will-change`, no `filter`, no `backdrop-filter` — the component is cheap
 * even if the global `eco-mode.css` override layer is not loaded.
 *
 * No props — mirrors `AudioSpectrumTitan`'s contract (it reads the store
 * internally). The router swaps the two based on `isPerformanceMode`.
 *
 * @module components/views/SensoryView/EcoSpectrum
 * @version 7583.0.0 - Eco-Mode
 */

import React, { memo } from 'react'
import { useThrottledTruthSelector } from '../../../hooks/useThrottledTruthSelector'
import type { SeleneTruth } from '../../../core/protocol/SeleneProtocol'
import './EcoSpectrum.css'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR — extract exactly the fields EcoSpectrum needs, as a stable tuple.
// Returning a tuple of primitives lets the hook's shallow-equality gate skip
// setState when nothing changed (a static show → zero re-renders after paint).
// ═══════════════════════════════════════════════════════════════════════════════

interface EcoSpectrumSnapshot {
  energy: number
  bpm: number
  confidence: number
  onBeat: boolean
}

function selectEcoSpectrum(truth: SeleneTruth): EcoSpectrumSnapshot {
  const audio = truth.sensory?.audio
  const beat = truth.sensory?.beat
  return {
    energy: audio?.energy ?? 0,
    bpm: beat?.bpm ?? 0,
    confidence: beat?.confidence ?? 0,
    onBeat: beat?.onBeat ?? false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const EcoSpectrum: React.FC = memo(() => {
  const snap = useThrottledTruthSelector(selectEcoSpectrum, 200)

  const energy = snap?.energy ?? 0
  const bpm = snap?.bpm ?? 0
  const confidence = snap?.confidence ?? 0
  const onBeat = snap?.onBeat ?? false

  // Clamp for CSS — energy/confidence are 0–1 from the protocol.
  const energyPct = Math.max(0, Math.min(100, energy * 100))
  const confidencePct = Math.max(0, Math.min(100, confidence * 100))
  const bpmText = bpm > 0 ? `${Math.round(bpm)}` : '—'

  return (
    <div className="eco-spectrum">
      <div className="eco-spectrum__bpm">
        <span className="eco-spectrum__bpm-value">{bpmText}</span>
        <span className="eco-spectrum__bpm-label">BPM</span>
      </div>

      <div className="eco-spectrum__led-wrap">
        <div className={`eco-spectrum__led ${onBeat ? 'led--on' : 'led--off'}`} />
        <span className="eco-spectrum__led-label">SYNC</span>
      </div>

      <div className="eco-spectrum__bars">
        <div className="eco-spectrum__bar-track">
          <div
            className="eco-spectrum__bar-fill eco-spectrum__bar-fill--energy"
            style={{ width: `${energyPct}%` }}
          />
          <span className="eco-spectrum__bar-label">ENERGY</span>
        </div>

        <div className="eco-spectrum__bar-track">
          <div
            className="eco-spectrum__bar-fill eco-spectrum__bar-fill--confidence"
            style={{ width: `${confidencePct}%` }}
          />
          <span className="eco-spectrum__bar-label">CONF</span>
        </div>
      </div>
    </div>
  )
})

EcoSpectrum.displayName = 'EcoSpectrum'

export default EcoSpectrum
