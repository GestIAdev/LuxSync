/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ NEW CLIP MODAL - WAVE 2030.26
 * Modal for creating new Hephaestus automation clips
 * 
 * FIELDS:
 * - Name: Clip display name
 * - Duration: Clip duration in ms (with BPM-aware presets)
 * - Category: Effect category selection
 * 
 * Creates a clean HephAutomationClip and saves immediately to disk.
 * NO MOCKS. NO DEMOS. REAL FILE CREATION.
 * 
 * WAVE 2030.26: 
 *  - Form state fully isolated inside modal (no external re-render triggers)
 *  - Duration input uses text mode + onBlur validation (no mid-typing erasure)
 *  - Fresh state on every open (useEffect reset)
 * 
 * @module views/HephaestusView/NewClipModal
 * @version WAVE 2030.26
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react'
import type { HephAutomationClip, HephCurve, HephParamId } from '../../../core/hephaestus/types'
import type { EffectCategory } from '../../../core/effects/types'
import { 
  IntensityIcon, 
  ColorIcon, 
  PositionIcon, 
  BeamIcon, 
  BrainNeuralIcon 
} from '../../icons/LuxIcons'

// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS CLIP CATEGORY & MIXBUS
// WAVE 2040.9a → 2040.20: TYPE UNIFICATION + LUXICON IDENTITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WAVE 2040.9a: MixBus type for Hephaestus clips.
 * Determines which FX track the clip routes to in Chronos.
 */
type HephMixBus = 'global' | 'htp' | 'ambient' | 'accent'

/**
 * ⚒️ WAVE 2040.20: Official MixBus neon colors — must match MIXBUS_CLIP_COLORS
 * in TimelineClip.ts for visual coherence across the entire pipeline.
 */
const MIXBUS_NEON: Record<HephMixBus, string> = {
  'global':  '#ef4444',  // Red — FX1
  'htp':     '#f59e0b',  // Orange — FX2
  'ambient': '#10b981',  // Green — FX3
  'accent':  '#3b82f6',  // Blue — FX4
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY → DEFAULT PARAMS MAPPING
// WAVE 2030.9: Each category creates sensible default parameters
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_PARAMS_BY_CATEGORY: Record<EffectCategory, HephParamId[]> = {
  physical: ['intensity', 'strobe'],
  color: ['color'],
  movement: ['pan', 'tilt'],
  optics: ['zoom', 'focus', 'iris'],
  composite: ['intensity', 'color', 'pan', 'tilt'],
}

/**
 * Create a default curve for a parameter
 */
function createDefaultCurve(paramId: HephParamId, durationMs: number): HephCurve {
  const isColor = paramId === 'color'
  return {
    paramId,
    valueType: isColor ? 'color' : 'number',
    range: [0, 1] as [number, number],
    defaultValue: isColor ? { h: 0, s: 100, l: 50 } : 0,
    keyframes: [
      { 
        timeMs: 0, 
        value: isColor ? { h: 0, s: 100, l: 50 } : 0, 
        interpolation: 'linear' as const 
      },
      { 
        timeMs: durationMs, 
        value: isColor ? { h: 360, s: 100, l: 50 } : 1, 
        interpolation: 'hold' as const 
      },
    ],
    mode: 'absolute',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY OPTIONS - WAVE 2040.20: LuxIcon identity per category
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_OPTIONS: { value: EffectCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'physical', label: 'Physical', icon: <IntensityIcon size={20} color="#fbbf24" />, desc: 'Intensity, Strobe' },
  { value: 'color', label: 'Color', icon: <ColorIcon size={20} color="#a855f7" />, desc: 'Chromatic' },
  { value: 'movement', label: 'Movement', icon: <PositionIcon size={20} color="#3b82f6" />, desc: 'Pan, Tilt' },
  { value: 'optics', label: 'Optics', icon: <BeamIcon size={20} color="#14b8a6" />, desc: 'Zoom, Focus, Iris, Gobo, Prism' },
  { value: 'composite', label: 'Composite', icon: <BrainNeuralIcon size={20} color="#f43f5e" />, desc: 'Multi-parameter' },
]

/**
 * ⚒️ WAVE 2040.20: MixBus routing with official neon colors.
 * Each button uses its track's neon color for immediate visual association.
 */
const MIXBUS_OPTIONS: { value: HephMixBus; label: string; color: string; desc: string }[] = [
  { value: 'global', label: 'Global', color: MIXBUS_NEON.global, desc: 'FX1 — Full takeover (strobes, blinders)' },
  { value: 'htp', label: 'HTP', color: MIXBUS_NEON.htp, desc: 'FX2 — High-priority transitional (sweeps, chases)' },
  { value: 'ambient', label: 'Ambient', color: MIXBUS_NEON.ambient, desc: 'FX3 — Atmospheric background (washes, fades)' },
  { value: 'accent', label: 'Accent', color: MIXBUS_NEON.accent, desc: 'FX4 — Short punchy accents (sparks, hits)' },
]

// Duration presets (in ms)
const DURATION_PRESETS = [
  { label: '1 bar', value: 2000, tooltip: '~2s @ 120bpm' },
  { label: '2 bars', value: 4000, tooltip: '~4s @ 120bpm' },
  { label: '4 bars', value: 8000, tooltip: '~8s @ 120bpm' },
  { label: '8 bars', value: 16000, tooltip: '~16s @ 120bpm' },
  { label: '16 bars', value: 32000, tooltip: '~32s @ 120bpm' },
]

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface NewClipModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (clip: HephAutomationClip) => void
}

/**
 * ⚒️ WAVE 2040.20: Wrapped in React.memo to prevent re-renders from
 * AudioEngine/DMX store changes in the parent HephaestusView.
 * The modal only re-renders when its own props change (isOpen, onClose, onCreate).
 */
export const NewClipModal: React.FC<NewClipModalProps> = memo(({
  isOpen,
  onClose,
  onCreate,
}) => {
  // ── WAVE 2030.26: Fully isolated form state ──
  // Text-mode duration string — user types freely, we validate onBlur
  const [name, setName] = useState('')
  const [durationText, setDurationText] = useState('4000')
  const [durationMs, setDurationMs] = useState(4000)
  const [category, setCategory] = useState<EffectCategory>('physical')
  const [mixBus, setMixBus] = useState<HephMixBus>('htp')
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset form every time modal opens (prevents stale state)
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDurationText('4000')
      setDurationMs(4000)
      setCategory('physical')
      setMixBus('htp')
      // Auto-focus name input after mount
      requestAnimationFrame(() => nameRef.current?.focus())
    }
  }, [isOpen])

  // Validation — name must have content, duration >= 100ms
  const isValid = name.trim().length > 0 && durationMs >= 100

  // Commit duration text → number (onBlur or preset click)
  const commitDuration = useCallback((text: string) => {
    const parsed = parseInt(text, 10)
    if (!isNaN(parsed) && parsed >= 100) {
      setDurationMs(parsed)
      setDurationText(String(parsed))
    } else {
      // Revert to last valid value
      setDurationText(String(durationMs))
    }
  }, [durationMs])

  const handleDurationPreset = useCallback((value: number) => {
    setDurationMs(value)
    setDurationText(String(value))
  }, [])

  const handleCreate = useCallback(() => {
    if (!isValid) return

    // Generate unique ID
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const id = `heph_${timestamp}_${randomSuffix}`

    // WAVE 2040.9a: Create curves based on category (unified types)
    const defaultParams = DEFAULT_PARAMS_BY_CATEGORY[category]
    const curves = new Map<HephParamId, HephCurve>()
    for (const paramId of defaultParams) {
      curves.set(paramId, createDefaultCurve(paramId, durationMs))
    }

    // WAVE 2040.9a: Category IS the EffectCategory — no mapping needed
    // MixBus is selected by the user — full 4-value spectrum

    // Create automation clip with category-appropriate params
    const newClip: HephAutomationClip = {
      id,
      name: name.trim(),
      author: 'LuxSync User',
      category,
      tags: [],
      vibeCompat: [],
      zones: ['all'],
      mixBus,
      priority: 50,
      durationMs,
      effectType: 'heph_custom',
      curves,
      staticParams: {},
    }

    onCreate(newClip)
    onClose()
  }, [name, durationMs, category, mixBus, isValid, onCreate, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    // ⚒️ WAVE 2040.20: GHOST FIX — Only close on direct overlay click,
    // never on bubbled clicks from inside the modal
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // ⚒️ WAVE 2040.20: Stop ALL events from propagating to parent view.
  // This prevents AudioEngine/DMX store re-renders from stealing focus
  // or causing the modal to flicker/close during input.
  const stopEventPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation() // ⚒️ WAVE 2040.20: Prevent parent keyboard handlers
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && isValid) {
      handleCreate()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="heph-modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="heph-modal" 
        role="dialog" 
        aria-modal="true"
        onClick={stopEventPropagation}
        onMouseDown={stopEventPropagation}
        onPointerDown={stopEventPropagation}
      >
        <header className="heph-modal__header">
          <h2 className="heph-modal__title">
            <span className="heph-modal__icon">⚒️</span>
            NEW AUTOMATION CLIP
          </h2>
          <button 
            className="heph-modal__close" 
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="heph-modal__body">
          {/* Name input */}
          <div className="heph-modal__field">
            <label htmlFor="clip-name" className="heph-modal__label">
              Name
            </label>
            <input
              id="clip-name"
              type="text"
              className="heph-modal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Effect"
              ref={nameRef}
            />
          </div>

          {/* Duration input */}
          <div className="heph-modal__field">
            <label htmlFor="clip-duration" className="heph-modal__label">
              Duration
            </label>
            <div className="heph-modal__duration-row">
              <input
                id="clip-duration"
                type="text"
                inputMode="numeric"
                className="heph-modal__input heph-modal__input--number"
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                onBlur={(e) => commitDuration(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDuration(durationText)
                }}
              />
              <span className="heph-modal__unit">ms</span>
            </div>
            <div className="heph-modal__presets">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`heph-modal__preset ${durationMs === preset.value ? 'heph-modal__preset--active' : ''}`}
                  onClick={() => handleDurationPreset(preset.value)}
                  title={preset.tooltip}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category select */}
          <div className="heph-modal__field">
            <label htmlFor="clip-category" className="heph-modal__label">
              Category
            </label>
            <div className="heph-modal__categories">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={`heph-modal__category ${category === cat.value ? 'heph-modal__category--active' : ''}`}
                  onClick={() => setCategory(cat.value)}
                >
                  <span className="heph-modal__category-icon">{cat.icon}</span>
                  <span className="heph-modal__category-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ⚒️ WAVE 2040.20: MixBus routing with official neon colors */}
          <div className="heph-modal__field">
            <label htmlFor="clip-mixbus" className="heph-modal__label">
              Track Routing
            </label>
            <div className="heph-modal__categories">
              {MIXBUS_OPTIONS.map((bus) => (
                <button
                  key={bus.value}
                  type="button"
                  className={`heph-modal__mixbus-btn ${mixBus === bus.value ? 'heph-modal__mixbus-btn--active' : ''}`}
                  onClick={() => setMixBus(bus.value)}
                  title={bus.desc}
                  style={{ 
                    '--bus-color': bus.color,
                    '--bus-color-dim': `${bus.color}33`,
                    '--bus-color-glow': `${bus.color}40`,
                  } as React.CSSProperties}
                >
                  <span 
                    className="heph-modal__mixbus-dot" 
                    style={{ background: bus.color }}
                  />
                  <span className="heph-modal__mixbus-label">{bus.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="heph-modal__footer">
          <button
            type="button"
            className="heph-modal__btn heph-modal__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="heph-modal__btn heph-modal__btn--create"
            onClick={handleCreate}
            disabled={!isValid}
          >
            Create Clip
          </button>
        </footer>
      </div>
    </div>
  )
})

NewClipModal.displayName = 'NewClipModal'
