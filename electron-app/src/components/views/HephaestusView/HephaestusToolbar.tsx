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
    <div className="heph-toolbar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '48px',
      flexShrink: 0,
      width: '100%',
      minWidth: 0,
      padding: '0 20px',
      background: '#141414',
      borderBottom: '1px solid #222222',
      boxSizing: 'border-box',
      overflow: 'hidden',
      userSelect: 'none',
      /* WAVE 7576: CSS var hooks so media queries can override inline gaps */
      ['--heph-tb-gap' as string]: '24px',
      ['--heph-tb-group-gap' as string]: '8px',
      ['--heph-tb-label-size' as string]: '10px',
      gap: 'var(--heph-tb-gap)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--heph-tb-gap)', minWidth: 0, flex: '1 1 0', overflow: 'hidden' }}>

        {/* GRUPO 1: Micro-Interpolación */}
        <div className="heph-toolbar__group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--heph-tb-group-gap)' }}>
          <span style={{ color: '#666', fontSize: 'var(--heph-tb-label-size)', fontWeight: 800, letterSpacing: '0.1em' }}>INTERPOLATION</span>
          <div style={{ display: 'flex', gap: '2px', background: '#0a0a0a', padding: '2px', borderRadius: '4px', border: '1px solid #222' }}>
            {INTERP_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`heph-toolbar__btn ${selectedKf?.interpolation === opt.id ? 'active' : ''}`}
                onClick={() => handleInterpClick(opt.id)}
                disabled={selectedKeyframeIdx === null}
                title={opt.label}
                style={selectedKf?.interpolation === opt.id
                  ? { background: '#ff6600', color: '#ffffff', fontWeight: 'bold', border: '1px solid #ff6600', boxShadow: '0 0 4px rgba(255,102,0,0.4)', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }
                  : { background: 'transparent', color: '#999', border: '1px solid transparent', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }}
              >
                <span className="heph-toolbar__btn-icon">{opt.icon}</span>
                <span className="heph-toolbar__btn-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <span style={{ color: '#262626' }}>│</span>

        {/* GRUPO 2: Presets Bézier */}
        <div className="heph-toolbar__group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--heph-tb-group-gap)' }}>
          <span style={{ color: '#666', fontSize: 'var(--heph-tb-label-size)', fontWeight: 800, letterSpacing: '0.1em' }}>BEZIER</span>
          <select
            className="heph-toolbar__select"
            disabled={selectedKeyframeIdx === null || selectedKf?.interpolation !== 'bezier'}
            value=""
            onChange={handleBezierPresetChange}
            style={{ background: '#141414', color: '#ffffff', border: '1px solid #555', padding: '4px 8px', borderRadius: '3px' }}
          >
            <option value="">Preset...</option>
            {Object.keys(BEZIER_PRESETS).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <span style={{ color: '#262626' }}>│</span>

        {/* GRUPO 3: Macro Shapes */}
        <div className="heph-toolbar__group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--heph-tb-group-gap)' }}>
          <span style={{ color: '#666', fontSize: 'var(--heph-tb-label-size)', fontWeight: 800, letterSpacing: '0.1em' }}>MACRO</span>
          <select
            className="heph-toolbar__select heph-toolbar__select--template"
            disabled={!activeCurve}
            value=""
            onChange={handleTemplateChange}
            style={{ background: '#141414', color: '#ffffff', border: '1px solid #555', padding: '4px 8px', borderRadius: '3px' }}
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

        <span style={{ color: '#262626' }}>│</span>

        {/* GRUPO 4: Modos */}
        <div className="heph-toolbar__group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--heph-tb-group-gap)' }}>
          <span style={{ color: '#666', fontSize: 'var(--heph-tb-label-size)', fontWeight: 800, letterSpacing: '0.1em' }}>MODE</span>
          <div style={{ display: 'flex', gap: '2px', background: '#0a0a0a', padding: '2px', borderRadius: '4px', border: '1px solid #222' }}>
            {MODE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                className={`heph-toolbar__btn ${activeCurve?.mode === opt.id ? 'active' : ''}`}
                onClick={() => onModeChange(opt.id)}
                disabled={!activeCurve}
                title={opt.desc}
                style={activeCurve?.mode === opt.id
                  ? { background: '#ff6600', color: '#ffffff', fontWeight: 'bold', border: '1px solid #ff6600', boxShadow: '0 0 4px rgba(255,102,0,0.4)', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }
                  : { background: 'transparent', color: '#999', border: '1px solid transparent', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }}
              >
                <span className="heph-toolbar__btn-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* GHOST HINT + Keyframe Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <div className="heph-toolbar__info">
          {selectedKf ? (
            <>
              <span className="heph-toolbar__info-item" style={{ color: '#888', fontSize: '11px' }}>
                T: {selectedKf.timeMs}ms
              </span>
              <span className="heph-toolbar__info-item" style={{ color: '#888', fontSize: '11px', marginLeft: '8px' }}>
                V: {typeof selectedKf.value === 'number' ? selectedKf.value.toFixed(3) : 'HSL'}
              </span>
            </>
          ) : (
            <span className="heph-toolbar__info-hint" style={{ color: '#444', fontSize: '11px', fontStyle: 'italic' }}>
              Select a keyframe to edit
            </span>
          )}
        </div>
        <div className="heph-toolbar__hint" style={{ color: '#444', fontSize: '11px', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
          💡 Double-click on grid to add keyframe
        </div>
      </div>
    </div>
  )
}
