/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE CONTROLS — WAVE 2403: THE PHASER UI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Panel de control para la distribución de fase de Hephaestus.
 * Two-way binding: mover estos controles actualiza el PhaseConfig
 * del clip actual → re-render del preview en tiempo real.
 *
 * CONTROLES:
 * 1. Spread Slider:    0% — 100% (config.spread)
 * 2. Symmetry Buttons: linear | mirror | center-out
 * 3. Wings Input:      1 — N (integer)
 * 4. Direction Toggle: Forward (+1) | Reverse (-1)
 *
 * DESIGN: Cyberpunk Industrial — consistent with HephaestusView.css
 *
 * @module views/HephaestusView/PhaseControls
 * @version WAVE 2403
 */

import React, { useCallback } from 'react'
import type { PhaseConfig, PhaseSymmetryMode, PhaseDirection } from '../../../core/hephaestus/types'
import { DEFAULT_PHASE_CONFIG } from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PhaseControlsProps {
  /** Current phase configuration (null = use defaults) */
  config: PhaseConfig | null
  /** Callback when config changes — triggers preview re-render */
  onChange: (config: PhaseConfig) => void
  /** Number of active zones/fixtures (for wings max limit) */
  fixtureCount: number
  /** Whether controls are disabled (e.g. during save) */
  disabled?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// SYMMETRY META
// ═══════════════════════════════════════════════════════════════════════════

const SYMMETRY_MODES: Array<{
  id: PhaseSymmetryMode
  label: string
  icon: string
  hint: string
}> = [
  { id: 'linear',     label: 'LINEAR',     icon: '📐', hint: 'Wave chase — sequential offset' },
  { id: 'mirror',     label: 'MIRROR',     icon: '🪞', hint: 'Fold from edges — breathing effect' },
  { id: 'center-out', label: 'CENTER',     icon: '🎯', hint: 'Pulse from center — radial expansion' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PhaseControls: React.FC<PhaseControlsProps> = ({
  config,
  onChange,
  fixtureCount,
  disabled = false,
}) => {
  const active = config ?? DEFAULT_PHASE_CONFIG

  // ── Individual field updaters ──────────────────────────────────────

  const handleSpreadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const spread = parseFloat(e.target.value)
    onChange({ ...active, spread })
  }, [active, onChange])

  const handleSymmetryChange = useCallback((symmetry: PhaseSymmetryMode) => {
    onChange({ ...active, symmetry })
  }, [active, onChange])

  const handleWingsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    const wings = Math.max(1, Math.min(isNaN(raw) ? 1 : raw, fixtureCount || 1))
    onChange({ ...active, wings })
  }, [active, onChange, fixtureCount])

  const handleDirectionToggle = useCallback(() => {
    const direction: PhaseDirection = active.direction === 1 ? -1 : 1
    onChange({ ...active, direction })
  }, [active, onChange])

  // ── Computed display values ────────────────────────────────────────
  const spreadPercent = Math.round(active.spread * 100)
  const isActive = active.spread > 0

  return (
    <div className={`heph-phase ${isActive ? 'heph-phase--active' : ''} ${disabled ? 'heph-phase--disabled' : ''}`}>
      {/* ── Header ── */}
      <div className="heph-phase__header">
        <span className="heph-phase__icon">🌊</span>
        <span className="heph-phase__title">PHASE DISTRIBUTION</span>
        {isActive && (
          <span className="heph-phase__badge">{spreadPercent}%</span>
        )}
      </div>

      {/* ── Spread Slider ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">SPREAD</label>
        <div className="heph-phase__slider-wrap">
          <input
            type="range"
            className="heph-phase__slider"
            min={0}
            max={1}
            step={0.01}
            value={active.spread}
            onChange={handleSpreadChange}
            disabled={disabled}
          />
          <span className="heph-phase__value">{spreadPercent}%</span>
        </div>
      </div>

      {/* ── Symmetry Buttons ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">SYMMETRY</label>
        <div className="heph-phase__btn-group">
          {SYMMETRY_MODES.map(mode => (
            <button
              key={mode.id}
              className={`heph-phase__sym-btn ${active.symmetry === mode.id ? 'heph-phase__sym-btn--active' : ''}`}
              onClick={() => handleSymmetryChange(mode.id)}
              title={mode.hint}
              disabled={disabled}
              type="button"
            >
              <span className="heph-phase__sym-icon">{mode.icon}</span>
              <span className="heph-phase__sym-label">{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Wings Input ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">WINGS</label>
        <div className="heph-phase__wings-wrap">
          <input
            type="number"
            className="heph-phase__wings-input"
            min={1}
            max={Math.max(1, fixtureCount)}
            value={active.wings}
            onChange={handleWingsChange}
            disabled={disabled}
          />
          <span className="heph-phase__wings-hint">
            {active.wings === 1 ? 'No split' : `${active.wings} groups`}
          </span>
        </div>
      </div>

      {/* ── Direction Toggle ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">DIRECTION</label>
        <button
          className={`heph-phase__dir-btn ${active.direction === -1 ? 'heph-phase__dir-btn--reverse' : ''}`}
          onClick={handleDirectionToggle}
          title={active.direction === 1 ? 'Forward: fixture 0 first' : 'Reverse: fixture N first'}
          disabled={disabled}
          type="button"
        >
          <span className="heph-phase__dir-arrow">
            {active.direction === 1 ? '→' : '←'}
          </span>
          <span className="heph-phase__dir-label">
            {active.direction === 1 ? 'FORWARD' : 'REVERSE'}
          </span>
        </button>
      </div>
    </div>
  )
}

export default PhaseControls
