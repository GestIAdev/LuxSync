/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS TOOLBAR - WAVE 2030.8
 * Bottom toolbar for interpolation type, bezier presets, curve templates,
 * and curve mode selection.
 * 
 * WAVE 2030.8: Connected curve templates dropdown for preset generation
 * 
 * @module views/HephaestusView/HephaestusToolbar
 * @version WAVE 2030.8
 */

import React, { useCallback } from 'react'
import { BEZIER_PRESETS } from '../../../core/hephaestus/types'
import type { HephCurve, HephInterpolation, HephCurveMode, HephKeyframe } from '../../../core/hephaestus/types'
import { CURVE_TEMPLATES, createCurveFromTemplate, getCategoryIcon } from './curveTemplates'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HephaestusToolbarProps {
  activeCurve: HephCurve | null
  selectedKeyframeIdx: number | null
  clipDurationMs: number  // WAVE 2030.8: Needed for template generation
  onInterpolationChange: (index: number, interpolation: HephInterpolation) => void
  onModeChange: (mode: HephCurveMode) => void
  onApplyBezierPreset: (index: number, handles: [number, number, number, number]) => void  // WAVE 2030.8
  onApplyTemplate: (keyframes: HephKeyframe[]) => void  // WAVE 2030.8: Apply template to active curve
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
  clipDurationMs,
  onInterpolationChange,
  onModeChange,
  onApplyBezierPreset,
  onApplyTemplate,
}) => {
  const selectedKf = activeCurve && selectedKeyframeIdx !== null
    ? activeCurve.keyframes[selectedKeyframeIdx]
    : null

  const handleInterpClick = useCallback((interp: HephInterpolation) => {
    if (selectedKeyframeIdx === null) return
    onInterpolationChange(selectedKeyframeIdx, interp)
  }, [selectedKeyframeIdx, onInterpolationChange])

  // WAVE 2030.8: Handle bezier preset selection
  const handleBezierPresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (selectedKeyframeIdx === null || !e.target.value) return
    const preset = BEZIER_PRESETS[e.target.value]
    if (preset) {
      onApplyBezierPreset(selectedKeyframeIdx, preset)
    }
  }, [selectedKeyframeIdx, onApplyBezierPreset])

  // WAVE 2030.8: Handle curve template selection
  const handleTemplateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!activeCurve || !e.target.value) return
    const templateId = e.target.value
    
    // Find the template by ID
    const template = CURVE_TEMPLATES.find(t => t.id === templateId)
    if (!template) return
    
    // Generate curve from template using active curve's paramId
    // Use 1 cycle by default, 64 resolution for smooth curves
    const generatedCurve = createCurveFromTemplate(
      template, 
      activeCurve.paramId, 
      clipDurationMs, 
      1,   // cycles
      64   // resolution - smooth curves
    )
    if (generatedCurve.keyframes.length > 0) {
      onApplyTemplate(generatedCurve.keyframes)
    }
    
    // Reset select to placeholder
    e.target.value = ''
  }, [activeCurve, clipDurationMs, onApplyTemplate])

  // Group templates by category for the dropdown
  const groupedTemplates = CURVE_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = []
    }
    acc[template.category].push(template)
    return acc
  }, {} as Record<string, typeof CURVE_TEMPLATES>)

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
        <span className="heph-toolbar__group-label">BEZIER</span>
        <select
          className="heph-toolbar__select"
          disabled={selectedKeyframeIdx === null || selectedKf?.interpolation !== 'bezier'}
          value=""
          onChange={handleBezierPresetChange}
        >
          <option value="">Preset...</option>
          {Object.keys(BEZIER_PRESETS).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* ── Divider ── */}
      <div className="heph-toolbar__divider" />

      {/* ── Curve Templates - WAVE 2030.8 ── */}
      <div className="heph-toolbar__group">
        <span className="heph-toolbar__group-label">TEMPLATE</span>
        <select
          className="heph-toolbar__select heph-toolbar__select--template"
          disabled={!activeCurve}
          value=""
          onChange={handleTemplateChange}
        >
          <option value="">Apply shape...</option>
          {Object.entries(groupedTemplates).map(([category, templates]) => (
            <optgroup key={category} label={`${getCategoryIcon(category)} ${category.toUpperCase()}`}>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </optgroup>
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
