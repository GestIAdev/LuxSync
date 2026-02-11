/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS TOOLBAR - WAVE 2030.3
 * Bottom toolbar for interpolation type, bezier presets, and curve mode
 * 
 * @module views/HephaestusView/HephaestusToolbar
 * @version WAVE 2030.3
 */

import React, { useCallback } from 'react'
import { BEZIER_PRESETS } from '../../../core/hephaestus/types'
import type { HephCurve, HephInterpolation, HephCurveMode } from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HephaestusToolbarProps {
  activeCurve: HephCurve | null
  selectedKeyframeIdx: number | null
  onInterpolationChange: (index: number, interpolation: HephInterpolation) => void
  onModeChange: (mode: HephCurveMode) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERPOLATION BUTTONS
// ═══════════════════════════════════════════════════════════════════════════

const INTERP_OPTIONS: { id: HephInterpolation; label: string; icon: string }[] = [
  { id: 'hold',   label: 'HOLD',   icon: '⊟' },
  { id: 'linear', label: 'LINEAR', icon: '╱' },
  { id: 'bezier', label: 'BEZIER', icon: '∿' },
]

const MODE_OPTIONS: { id: HephCurveMode; label: string; desc: string }[] = [
  { id: 'absolute', label: 'ABS',  desc: 'Replace base value' },
  { id: 'relative', label: 'REL',  desc: 'Multiply base value' },
  { id: 'additive', label: 'ADD',  desc: 'Sum to base value' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const HephaestusToolbar: React.FC<HephaestusToolbarProps> = ({
  activeCurve,
  selectedKeyframeIdx,
  onInterpolationChange,
  onModeChange,
}) => {
  const selectedKf = activeCurve && selectedKeyframeIdx !== null
    ? activeCurve.keyframes[selectedKeyframeIdx]
    : null

  const handleInterpClick = useCallback((interp: HephInterpolation) => {
    if (selectedKeyframeIdx === null) return
    onInterpolationChange(selectedKeyframeIdx, interp)
  }, [selectedKeyframeIdx, onInterpolationChange])

  return (
    <div className="heph-toolbar">
      {/* ── Interpolation Type ── */}
      <div className="heph-toolbar__group">
        <span className="heph-toolbar__group-label">INTERPOLATION</span>
        <div className="heph-toolbar__buttons">
          {INTERP_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`heph-toolbar__btn ${selectedKf?.interpolation === opt.id ? 'active' : ''}`}
              onClick={() => handleInterpClick(opt.id)}
              disabled={selectedKeyframeIdx === null}
              title={opt.label}
            >
              <span className="heph-toolbar__btn-icon">{opt.icon}</span>
              <span className="heph-toolbar__btn-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="heph-toolbar__divider" />

      {/* ── Bezier Presets ── */}
      <div className="heph-toolbar__group">
        <span className="heph-toolbar__group-label">PRESET</span>
        <select
          className="heph-toolbar__select"
          disabled={selectedKeyframeIdx === null || selectedKf?.interpolation !== 'bezier'}
          value=""
          onChange={(e) => {
            if (selectedKeyframeIdx === null || !e.target.value) return
            const preset = BEZIER_PRESETS[e.target.value]
            if (preset) {
              // Apply preset handles
              onInterpolationChange(selectedKeyframeIdx, 'bezier')
            }
          }}
        >
          <option value="">Select preset...</option>
          {Object.keys(BEZIER_PRESETS).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* ── Divider ── */}
      <div className="heph-toolbar__divider" />

      {/* ── Curve Mode ── */}
      <div className="heph-toolbar__group">
        <span className="heph-toolbar__group-label">MODE</span>
        <div className="heph-toolbar__buttons">
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`heph-toolbar__btn ${activeCurve?.mode === opt.id ? 'active' : ''}`}
              onClick={() => onModeChange(opt.id)}
              disabled={!activeCurve}
              title={opt.desc}
            >
              <span className="heph-toolbar__btn-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Keyframe Info ── */}
      <div className="heph-toolbar__spacer" />
      <div className="heph-toolbar__info">
        {selectedKf ? (
          <>
            <span className="heph-toolbar__info-item">
              T: {selectedKf.timeMs}ms
            </span>
            <span className="heph-toolbar__info-item">
              V: {typeof selectedKf.value === 'number' ? selectedKf.value.toFixed(3) : 'HSL'}
            </span>
          </>
        ) : (
          <span className="heph-toolbar__info-hint">
            Select a keyframe to edit
          </span>
        )}
      </div>
    </div>
  )
}
