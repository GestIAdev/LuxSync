/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE CONTROLS — WAVE 7001: PHASE CONFIG PRO UI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Panel de control para la distribución de fase de Hephaestus V3.
 * Two-way binding via updatePhaseInTrack recipe pattern.
 *
 * CONTROLES (PhaseConfigPro):
 * 1. Spread:    spreadDeg (0—1440º slider)
 * 2. Symmetry:  linear | mirror | center-out
 * 3. Wings:     1—8 (integer, frequency multiplier)
 * 4. Blocks:    1—16 (integer, MAtricks-style grouping)
 * 5. Shuffle:   0—1 (float) + shuffleSeed (integer)
 * 6. Direction: +1 | -1
 *
 * DESIGN: Cyberpunk Industrial — consistent with HephaestusView.css
 *
 * @module views/HephaestusView/PhaseControls
 * @version WAVE 7001
 */

import React, { useCallback } from 'react'
import type { PhaseConfigPro, PhaseSymmetryMode } from '../../../core/hephaestus/phase/PhaseConfigPro'
import { DEFAULT_PHASE_CONFIG_PRO } from '../../../core/hephaestus/phase/PhaseConfigPro'
import type { SpatialBehavior } from '../../../core/arsenal/lfxTypes'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface PhaseControlsProps {
  /** Current phase configuration (null = use defaults) */
  config: PhaseConfigPro | null
  /** Recipe-based updater: calls updatePhaseInTrack(trackId, recipe) */
  onPhaseChange: (recipe: (draft: PhaseConfigPro) => void) => void
  /** Whether controls are disabled (e.g. during save) */
  disabled?: boolean
  // ── WAVE 4811: Spatial Behavior ──
  /** Current spatialBehavior from cognitiveDNA (undefined = no DNA yet) */
  spatialBehavior?: SpatialBehavior
  /** Callback when spatialBehavior changes */
  onSpatialBehaviorChange?: (sb: SpatialBehavior) => void
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

// WAVE 4811: Spatial behavior options
const SPATIAL_OPTIONS: Array<{ value: SpatialBehavior; label: string; hint: string }> = [
  { value: 'static',          label: 'STATIC',     hint: 'No pan/tilt. Only dimmer/color/optics.' },
  { value: 'absolute',        label: 'ABSOLUTE',   hint: 'Clip controls pan/tilt directly (DMX absolute).' },
  { value: 'relative_offset', label: 'RELATIVE',   hint: 'Emits pan_offset/tilt_offset ∈ [-1,+1] over IK anchor.' },
  { value: 'spatial',         label: 'SPATIAL 3D', hint: 'Reserved: emits 3D target trajectory (future).' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const PhaseControls: React.FC<PhaseControlsProps> = ({
  config,
  onPhaseChange,
  disabled = false,
  spatialBehavior,
  onSpatialBehaviorChange,
}) => {
  const active = config ?? DEFAULT_PHASE_CONFIG_PRO

  // ── Individual field updaters (recipe-based) ───────────────────────

  const handleSpreadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const spreadDeg = parseFloat(e.target.value)
    onPhaseChange(draft => { draft.spreadDeg = spreadDeg })
  }, [onPhaseChange])

  const handleSymmetryChange = useCallback((symmetry: PhaseSymmetryMode) => {
    onPhaseChange(draft => { draft.symmetry = symmetry })
  }, [onPhaseChange])

  const handleWingsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    const wings = Math.max(1, Math.min(isNaN(raw) ? 1 : raw, 8))
    onPhaseChange(draft => { draft.wings = wings })
  }, [onPhaseChange])

  const handleBlocksChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    const blocks = Math.max(1, Math.min(isNaN(raw) ? 1 : raw, 16))
    onPhaseChange(draft => { draft.blocks = blocks })
  }, [onPhaseChange])

  const handleShuffleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const shuffle = parseFloat(e.target.value)
    onPhaseChange(draft => { draft.shuffle = shuffle })
  }, [onPhaseChange])

  const handleShuffleSeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10)
    const seed = isNaN(raw) ? 1 : Math.max(1, raw)
    onPhaseChange(draft => { draft.shuffleSeed = seed })
  }, [onPhaseChange])

  const handleDirectionToggle = useCallback(() => {
    const direction: 1 | -1 = active.direction === 1 ? -1 : 1
    onPhaseChange(draft => { draft.direction = direction })
  }, [active.direction, onPhaseChange])

  // ── Computed display values ────────────────────────────────────────
  const spreadPercent = Math.round((active.spreadDeg / 1440) * 100)
  const isActive = active.spreadDeg > 0

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

      {/* ── WAVE 4811: Spatial Behavior (if DNA available) ── */}
      {onSpatialBehaviorChange && (
        <div className="heph-phase__section heph-phase__section--spatial">
          <div className="heph-phase__section-header">SPATIAL BEHAVIOR</div>
          <div className="heph-phase__spatial-grid">
            {SPATIAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`heph-phase__spatial-btn ${spatialBehavior === opt.value ? 'heph-phase__spatial-btn--active' : ''}`}
                onClick={() => onSpatialBehaviorChange(opt.value)}
                title={opt.hint}
                disabled={disabled}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="heph-phase__spatial-hint">
            {SPATIAL_OPTIONS.find(o => o.value === (spatialBehavior ?? 'absolute'))?.hint ?? ''}
          </p>
        </div>
      )}

      {/* ── Spread Slider (0—1440º) ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">SPREAD</label>
        <div className="heph-phase__slider-wrap">
          <input
            type="range"
            className="heph-phase__slider"
            min={0}
            max={1440}
            step={1}
            value={active.spreadDeg}
            onChange={handleSpreadChange}
            disabled={disabled}
          />
          <span className="heph-phase__value">{active.spreadDeg}º</span>
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

      {/* ── Wings Input (1—8) ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">WINGS</label>
        <div className="heph-phase__wings-wrap">
          <input
            type="number"
            className="heph-phase__wings-input"
            min={1}
            max={8}
            value={active.wings}
            onChange={handleWingsChange}
            disabled={disabled}
          />
          <span className="heph-phase__wings-hint">
            {active.wings === 1 ? 'Single sweep' : `${active.wings}× freq`}
          </span>
        </div>
      </div>

      {/* ── Blocks Input (1—16, MAtricks) ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">BLOCKS</label>
        <div className="heph-phase__wings-wrap">
          <input
            type="number"
            className="heph-phase__wings-input"
            min={1}
            max={16}
            value={active.blocks}
            onChange={handleBlocksChange}
            disabled={disabled}
          />
          <span className="heph-phase__wings-hint">
            {active.blocks === 1 ? 'Individual' : `Groups of ${active.blocks}`}
          </span>
        </div>
      </div>

      {/* ── Shuffle Slider (0—1) + Seed ── */}
      <div className="heph-phase__row">
        <label className="heph-phase__label">SHUFFLE</label>
        <div className="heph-phase__slider-wrap">
          <input
            type="range"
            className="heph-phase__slider"
            min={0}
            max={1}
            step={0.01}
            value={active.shuffle}
            onChange={handleShuffleChange}
            disabled={disabled}
          />
          <span className="heph-phase__value">{Math.round(active.shuffle * 100)}%</span>
        </div>
      </div>
      <div className="heph-phase__row">
        <label className="heph-phase__label">SEED</label>
        <div className="heph-phase__wings-wrap">
          <input
            type="number"
            className="heph-phase__wings-input"
            min={1}
            value={active.shuffleSeed}
            onChange={handleShuffleSeedChange}
            disabled={disabled}
          />
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
