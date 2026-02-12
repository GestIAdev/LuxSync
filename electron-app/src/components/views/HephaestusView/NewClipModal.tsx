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

import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { HephAutomationClip, HephCurve, HephParamId } from '../../../core/hephaestus/types'
import type { EffectCategory } from '../../../core/effects/types'

// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS CLIP CATEGORY
// WAVE 2030.9: Extended categories for Hephaestus clips
// ═══════════════════════════════════════════════════════════════════════════

/** 
 * Hephaestus uses extended categories beyond EffectCategory.
 * Maps to EffectCategory for storage but provides more granular options.
 */
type HephClipCategory = 'physical' | 'color' | 'movement' | 'control'

/** Map HephClipCategory to EffectCategory for storage */
const HEPH_TO_EFFECT_CATEGORY: Record<HephClipCategory, EffectCategory> = {
  physical: 'physical',
  color: 'color',
  movement: 'movement',
  control: 'physical',  // Control maps to physical for storage
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY → DEFAULT PARAMS MAPPING
// WAVE 2030.9: Each category creates sensible default parameters
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_PARAMS_BY_CATEGORY: Record<HephClipCategory, HephParamId[]> = {
  physical: ['intensity', 'strobe'],
  color: ['color'],
  movement: ['pan', 'tilt', 'zoom'],
  control: ['speed', 'width'],
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
// CATEGORY OPTIONS - WAVE 2030.9: All 4 Hephaestus categories
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_OPTIONS: { value: HephClipCategory; label: string; icon: string; desc: string }[] = [
  { value: 'physical', label: 'Physical', icon: '💡', desc: 'Intensity, Strobe' },
  { value: 'color', label: 'Color', icon: '🎨', desc: 'Chromatic' },
  { value: 'movement', label: 'Movement', icon: '🔄', desc: 'Pan, Tilt, Zoom' },
  { value: 'control', label: 'Control', icon: '🎛', desc: 'Speed, Width' },
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

export const NewClipModal: React.FC<NewClipModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  // ── WAVE 2030.26: Fully isolated form state ──
  // Text-mode duration string — user types freely, we validate onBlur
  const [name, setName] = useState('')
  const [durationText, setDurationText] = useState('4000')
  const [durationMs, setDurationMs] = useState(4000)
  const [category, setCategory] = useState<HephClipCategory>('physical')
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset form every time modal opens (prevents stale state)
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDurationText('4000')
      setDurationMs(4000)
      setCategory('physical')
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

    // WAVE 2030.9: Create curves based on category
    const defaultParams = DEFAULT_PARAMS_BY_CATEGORY[category]
    const curves = new Map<HephParamId, HephCurve>()
    for (const paramId of defaultParams) {
      curves.set(paramId, createDefaultCurve(paramId, durationMs))
    }

    // Map HephClipCategory to EffectCategory for storage
    const effectCategory = HEPH_TO_EFFECT_CATEGORY[category]

    // Create automation clip with category-appropriate params
    const newClip: HephAutomationClip = {
      id,
      name: name.trim(),
      author: 'LuxSync User',
      category: effectCategory,
      tags: [`heph:${category}`],  // WAVE 2030.9: Preserve Heph category in tags
      vibeCompat: [],
      zones: ['all'],
      mixBus: 'htp',
      priority: 50,
      durationMs,
      effectType: 'heph_custom',
      curves,
      staticParams: {},
    }

    onCreate(newClip)
    onClose()
  }, [name, durationMs, category, isValid, onCreate, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      <div className="heph-modal" role="dialog" aria-modal="true">
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
}
