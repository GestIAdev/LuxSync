/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔍 CLIP INSPECTOR - WAVE 2040.5: VIOLET DEEP CONTROL
 *
 * Property panel for selected clips. Editable parameters
 * for vibes and effects.
 *
 * DESIGN: Hephaestus ParameterLane aesthetic — labels left, inputs right
 * ACCENT: Violet (#a855f7) — unified with Master Toolbar
 * ICONS: All LuxIcons SVGs — zero emojis
 *
 * @module chronos/ui/inspector/ClipInspector
 * @version WAVE 2040.5
 */

import React, { useCallback, useMemo, memo } from 'react'
import type { TimelineClip, VibeClip, FXClip, VibeType, FXType } from '../../core/TimelineClip'
import { VIBE_COLORS, FX_COLORS } from '../../core/TimelineClip'
import {
  ClockIcon,
  TagIcon,
  TrashIcon,
  CopyIcon,
  ChevronLeftIcon,
  ZapIcon,
  MasksIcon,
} from '../../../components/icons/LuxIcons'
import './ClipInspector.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClipInspectorProps {
  /** Selected clip (or null if nothing selected) */
  clip: TimelineClip | null
  
  /** 🔧 WAVE 2018: Number of selected clips (for multi-selection UI) */
  selectedCount?: number
  
  /** Callback to update clip properties */
  onUpdateClip: (clipId: string, updates: Partial<TimelineClip>) => void
  
  /** Callback to delete clip */
  onDeleteClip: (clipId: string) => void
  
  /** Callback to duplicate clip */
  onDuplicateClip: (clipId: string) => void
  
  /** Back to library view */
  onBackToLibrary: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PALETTE ROLES
// ═══════════════════════════════════════════════════════════════════════════

const PALETTE_ROLES = [
  { id: 'primary', label: 'PRIMARY', color: '#3b82f6' },
  { id: 'secondary', label: 'SECONDARY', color: '#22d3ee' },
  { id: 'accent', label: 'ACCENT', color: '#ec4899' },
  { id: 'warm', label: 'WARM', color: '#f59e0b' },
  { id: 'cool', label: 'COOL', color: '#6366f1' },
] as const

// ═══════════════════════════════════════════════════════════════════════════
// SLIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

const Slider: React.FC<SliderProps> = memo(({ 
  label, value, min, max, step = 1, unit = '', onChange 
}) => {
  const percentage = ((value - min) / (max - min)) * 100
  
  return (
    <div className="inspector-field slider-field">
      <div className="field-header">
        <label>{label}</label>
        <span className="field-value">{value}{unit}</span>
      </div>
      <div className="slider-container">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ 
            background: `linear-gradient(to right, #a855f7 ${percentage}%, #1e293b ${percentage}%)` 
          }}
        />
      </div>
    </div>
  )
})

Slider.displayName = 'Slider'

// ═══════════════════════════════════════════════════════════════════════════
// NUMBER INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface NumberInputProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

const NumberInput: React.FC<NumberInputProps> = memo(({
  label, value, min = 0, max = 99999, step = 1, unit = '', onChange
}) => {
  return (
    <div className="inspector-field number-field">
      <label>{label}</label>
      <div className="number-input-wrapper">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  )
})

NumberInput.displayName = 'NumberInput'

// ═══════════════════════════════════════════════════════════════════════════
// COLOR PICKER (SIMPLE)
// ═══════════════════════════════════════════════════════════════════════════

interface ColorPickerProps {
  label: string
  value: string
  options: { color: string; label: string }[]
  onChange: (color: string) => void
}

const ColorPicker: React.FC<ColorPickerProps> = memo(({
  label, value, options, onChange
}) => {
  return (
    <div className="inspector-field color-field">
      <label>{label}</label>
      <div className="color-options">
        {options.map(opt => (
          <button
            key={opt.color}
            className={`color-option ${value === opt.color ? 'selected' : ''}`}
            style={{ backgroundColor: opt.color }}
            onClick={() => onChange(opt.color)}
            title={opt.label}
          >
            {value === opt.color && <span className="check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  )
})

ColorPicker.displayName = 'ColorPicker'

// ═══════════════════════════════════════════════════════════════════════════
// VIBE INSPECTOR
// ═══════════════════════════════════════════════════════════════════════════

interface VibeInspectorProps {
  clip: VibeClip
  onUpdate: (updates: Partial<VibeClip>) => void
}

const VibeInspector: React.FC<VibeInspectorProps> = memo(({ clip, onUpdate }) => {
  const colorOptions = useMemo(() => 
    Object.entries(VIBE_COLORS).map(([type, color]) => ({
      color,
      label: type.toUpperCase().replace('-', ' ')
    }))
  , [])
  
  // 🔧 WAVE 2018: Calculate duration for display
  const durationMs = clip.endMs - clip.startMs
  
  return (
    <div className="inspector-section vibe-inspector">
      <div className="section-header">
        <span className="section-icon"><MasksIcon size={14} /></span>
        <span className="section-title">VIBE SETTINGS</span>
      </div>
      
      <div className="inspector-field text-field">
        <label>NAME</label>
        <input
          type="text"
          value={clip.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Clip name..."
        />
      </div>
      
      <ColorPicker
        label="COLOR"
        value={clip.color}
        options={colorOptions}
        onChange={(color) => onUpdate({ color })}
      />
      
      <Slider
        label="INTENSITY"
        value={Math.round(clip.intensity * 100)}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => onUpdate({ intensity: v / 100 })}
      />
      
      {/* 🔧 WAVE 2018: Precision positioning */}
      <div className="inspector-row">
        <NumberInput
          label="START"
          value={Math.round(clip.startMs)}
          min={0}
          max={3600000}
          step={100}
          unit="ms"
          onChange={(v) => onUpdate({ startMs: v, endMs: v + durationMs })}
        />
        <NumberInput
          label="DURATION"
          value={Math.round(durationMs)}
          min={100}
          max={300000}
          step={100}
          unit="ms"
          onChange={(v) => onUpdate({ endMs: clip.startMs + v })}
        />
      </div>
      
      <div className="inspector-row">
        <NumberInput
          label="FADE IN"
          value={clip.fadeInMs}
          min={0}
          max={5000}
          step={100}
          unit="ms"
          onChange={(v) => onUpdate({ fadeInMs: v })}
        />
        <NumberInput
          label="FADE OUT"
          value={clip.fadeOutMs}
          min={0}
          max={5000}
          step={100}
          unit="ms"
          onChange={(v) => onUpdate({ fadeOutMs: v })}
        />
      </div>
    </div>
  )
})

VibeInspector.displayName = 'VibeInspector'

// ═══════════════════════════════════════════════════════════════════════════
// FX INSPECTOR
// ═══════════════════════════════════════════════════════════════════════════

interface FXInspectorProps {
  clip: FXClip
  onUpdate: (updates: Partial<FXClip>) => void
}

const FXInspector: React.FC<FXInspectorProps> = memo(({ clip, onUpdate }) => {
  const colorOptions = useMemo(() => 
    Object.entries(FX_COLORS).map(([type, color]) => ({
      color,
      label: type.toUpperCase().replace('-', ' ')
    }))
  , [])
  
  // Get speed param if exists
  const speed = (clip.params?.speed as number) ?? 1
  const intensity = (clip.params?.intensity as number) ?? 1
  
  // 🔧 WAVE 2018: Calculate duration for display
  const durationMs = clip.endMs - clip.startMs
  
  const handleParamChange = useCallback((param: string, value: number) => {
    onUpdate({ 
      params: { ...clip.params, [param]: value }
    })
  }, [clip.params, onUpdate])
  
  return (
    <div className="inspector-section fx-inspector">
      <div className="section-header">
        <span className="section-icon"><ZapIcon size={14} /></span>
        <span className="section-title">EFFECT SETTINGS</span>
      </div>
      
      <div className="inspector-field text-field">
        <label>NAME</label>
        <input
          type="text"
          value={clip.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Effect name..."
        />
      </div>
      
      <ColorPicker
        label="COLOR"
        value={clip.color}
        options={colorOptions}
        onChange={(color) => onUpdate({ color })}
      />
      
      <Slider
        label="SPEED"
        value={Math.round(speed * 100)}
        min={10}
        max={500}
        unit="%"
        onChange={(v) => handleParamChange('speed', v / 100)}
      />
      
      <Slider
        label="INTENSITY"
        value={Math.round(intensity * 100)}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => handleParamChange('intensity', v / 100)}
      />
      
      {/* 🔧 WAVE 2018: Precision positioning */}
      <div className="inspector-row">
        <NumberInput
          label="START"
          value={Math.round(clip.startMs)}
          min={0}
          max={3600000}
          step={100}
          unit="ms"
          onChange={(v) => onUpdate({ startMs: v, endMs: v + durationMs })}
        />
        <NumberInput
          label="DURATION"
          value={Math.round(durationMs)}
          min={100}
          max={30000}
          step={100}
          unit="ms"
          onChange={(v) => onUpdate({ endMs: clip.startMs + v })}
        />
      </div>
      
      {/* Palette Role Selector */}
      <div className="inspector-field role-field">
        <label>PALETTE ROLE</label>
        <div className="role-options">
          {PALETTE_ROLES.map(role => (
            <button
              key={role.id}
              className={`role-option ${clip.params?.paletteRole === role.id ? 'selected' : ''}`}
              onClick={() => handleParamChange('paletteRole', role.id as unknown as number)}
            >
              <span className="role-dot" style={{ backgroundColor: role.color }} />
              <span className="role-label">{role.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
})

FXInspector.displayName = 'FXInspector'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN INSPECTOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ClipInspector: React.FC<ClipInspectorProps> = ({
  clip,
  selectedCount = 0,
  onUpdateClip,
  onDeleteClip,
  onDuplicateClip,
  onBackToLibrary,
}) => {
  // 🔧 WAVE 2018: Multi-selection state
  if (selectedCount > 1) {
    return (
      <div className="clip-inspector multi-selection">
        <div className="empty-state">
          <span className="empty-icon"><CopyIcon size={28} color="var(--text-tertiary)" /></span>
          <span className="empty-text">{selectedCount} CLIPS SELECTED</span>
          <span className="empty-hint">Select a single clip to edit properties</span>
        </div>
      </div>
    )
  }
  
  if (!clip) {
    return (
      <div className="clip-inspector empty">
        <div className="empty-state">
          <span className="empty-icon"><TagIcon size={28} color="var(--text-tertiary)" /></span>
          <span className="empty-text">Select a clip to edit</span>
        </div>
      </div>
    )
  }
  
  const handleUpdate = useCallback((updates: Partial<TimelineClip>) => {
    onUpdateClip(clip.id, updates)
  }, [clip.id, onUpdateClip])
  
  const durationMs = clip.endMs - clip.startMs
  const durationSec = (durationMs / 1000).toFixed(2)
  
  return (
    <div className="clip-inspector">
      {/* Header */}
      <div className="inspector-header">
        <button className="back-button" onClick={onBackToLibrary}>
          <ChevronLeftIcon size={12} /> LIBRARY
        </button>
        <span className="header-title">INSPECTOR</span>
      </div>
      
      {/* Clip Overview */}
      <div className="clip-overview">
        <div 
          className="clip-preview" 
          style={{ backgroundColor: clip.color }}
        >
          <span className="preview-icon">
            {clip.type === 'vibe' ? <MasksIcon size={20} color="#fff" /> : <ZapIcon size={20} color="#fff" />}
          </span>
        </div>
        <div className="clip-info">
          <span className="clip-name">{clip.label}</span>
          <span className="clip-type">{clip.type.toUpperCase()}</span>
          <span className="clip-duration"><ClockIcon size={11} /> {durationSec}s</span>
        </div>
      </div>
      
      {/* Type-specific inspector */}
      {clip.type === 'vibe' ? (
        <VibeInspector clip={clip as VibeClip} onUpdate={handleUpdate} />
      ) : (
        <FXInspector clip={clip as FXClip} onUpdate={handleUpdate} />
      )}
      
      {/* Actions */}
      <div className="inspector-actions">
        <button 
          className="action-button duplicate"
          onClick={() => onDuplicateClip(clip.id)}
        >
          <CopyIcon size={13} />
          DUPLICATE
        </button>
        <button 
          className="action-button delete"
          onClick={() => onDeleteClip(clip.id)}
        >
          <TrashIcon size={13} />
          DELETE
        </button>
      </div>
      
      {/* Keyboard hints */}
      <div className="keyboard-hints">
        <div className="hint"><kbd>Ctrl+D</kbd> Duplicate</div>
        <div className="hint"><kbd>Del</kbd> Delete</div>
        <div className="hint"><kbd>Ctrl+C</kbd> Copy</div>
        <div className="hint"><kbd>Ctrl+V</kbd> Paste</div>
      </div>
    </div>
  )
}

export default ClipInspector
