/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ NEW CLIP MODAL - WAVE 2040.28: THE BUNKER OF GLASS 🛡️🍊
 * 
 * ARCHITECTURE:
 * 1. React Portal → renders directly into document.body
 *    (immune to HephaestusView re-renders from AudioEngine/DMX)
 * 2. Input Trap → stopPropagation on ALL keyboard events
 *    (Space types spaces, not pauses Chronos)
 * 3. Glass & Orange → Cyberpunk Industrial aesthetic
 * 4. Smart Zone Selector integrated → right panel matrix
 * 
 * LAYOUT:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  ⚒️ NEW AUTOMATION CLIP                                    ✖ │
 * │  NAME: [ input ]                    DURATION: [ input ] ms   │
 * │  ┌─ CATEGORY (Grid) ──────────┐  ┌─ TARGET (Matrix) ──────┐│
 * │  │ [💡] [🎨] [🔄] [🔍] [🧬]  │  │ [ALL] [MOV] [PAR] [AIR]││
 * │  └────────────────────────────┘  │ [FRT] [BCK] [FLR] [CTR]││
 * │  ┌─ ROUTING ──────────────────┐  │ [ L ] [ R ] [ODD] [EVN]││
 * │  │ [🔴 GLOB] [🟡 HTP] [🔵 ACC]│  └────────────────────────┘│
 * │  └────────────────────────────┘  [ CANCEL ]  [ CREATE ]     │
 * └──────────────────────────────────────────────────────────────┘
 * 
 * NO MOCKS. NO DEMOS. REAL FILE CREATION.
 * 
 * @module views/HephaestusView/NewClipModal
 * @version WAVE 2040.28
 */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import type { HephAutomationClip, HephCurve, HephParamId } from '../../../core/hephaestus/types'
import type { EffectCategory, EffectZone } from '../../../core/effects/types'
import { SmartZoneSelector } from './SmartZoneSelector'
import { 
  IntensityIcon, 
  ColorIcon, 
  PositionIcon, 
  BeamIcon, 
  BrainNeuralIcon,
  HephLogoIcon,
} from '../../icons/LuxIcons'

// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS CLIP CATEGORY & MIXBUS
// WAVE 2040.9a → 2040.28: PORTAL ISOLATION + GLASS & ORANGE
// ═══════════════════════════════════════════════════════════════════════════

type HephMixBus = 'global' | 'htp' | 'ambient' | 'accent'

const MIXBUS_NEON: Record<HephMixBus, string> = {
  'global':  '#ef4444',
  'htp':     '#f59e0b',
  'ambient': '#10b981',
  'accent':  '#3b82f6',
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
// CATEGORY OPTIONS - WAVE 2040.28: LuxIcon identity per category
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_OPTIONS: { value: EffectCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'physical',  label: 'Physical',  icon: <IntensityIcon size={20} color="#fbbf24" />,   desc: 'Intensity, Strobe' },
  { value: 'color',     label: 'Color',     icon: <ColorIcon size={20} color="#a855f7" />,       desc: 'Chromatic' },
  { value: 'movement',  label: 'Movement',  icon: <PositionIcon size={20} color="#3b82f6" />,    desc: 'Pan, Tilt' },
  { value: 'optics',    label: 'Optics',    icon: <BeamIcon size={20} color="#14b8a6" />,        desc: 'Zoom, Focus' },
  { value: 'composite', label: 'Composite', icon: <BrainNeuralIcon size={20} color="#f43f5e" />, desc: 'Multi-param' },
]

const MIXBUS_OPTIONS: { value: HephMixBus; label: string; color: string; desc: string }[] = [
  { value: 'global',  label: 'Global',  color: MIXBUS_NEON.global,  desc: 'FX1 — Full takeover' },
  { value: 'htp',     label: 'HTP',     color: MIXBUS_NEON.htp,     desc: 'FX2 — Transitional' },
  { value: 'ambient', label: 'Ambient', color: MIXBUS_NEON.ambient, desc: 'FX3 — Atmospheric' },
  { value: 'accent',  label: 'Accent',  color: MIXBUS_NEON.accent,  desc: 'FX4 — Punchy accents' },
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
 * ⚒️ WAVE 2040.28: THE BUNKER OF GLASS
 * 
 * - React Portal: Rendered into document.body, immune to parent re-renders
 * - Input Trap: ALL keyboard events stopped at modal boundary
 * - Glass & Orange: Cyberpunk Industrial aesthetic
 * - Smart Zone Selector: Matrix targeting right panel
 */
export const NewClipModal: React.FC<NewClipModalProps> = memo(({
  isOpen,
  onClose,
  onCreate,
}) => {
  // ── Fully isolated form state ──
  const [name, setName] = useState('')
  const [durationText, setDurationText] = useState('4000')
  const [durationMs, setDurationMs] = useState(4000)
  const [category, setCategory] = useState<EffectCategory>('physical')
  const [mixBus, setMixBus] = useState<HephMixBus>('htp')
  const [zones, setZones] = useState<EffectZone[]>([])
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset form every time modal opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDurationText('4000')
      setDurationMs(4000)
      setCategory('physical')
      setMixBus('htp')
      setZones([])
      requestAnimationFrame(() => nameRef.current?.focus())
    }
  }, [isOpen])

  const isValid = name.trim().length > 0 && durationMs >= 100

  const commitDuration = useCallback((text: string) => {
    const parsed = parseInt(text, 10)
    if (!isNaN(parsed) && parsed >= 100) {
      setDurationMs(parsed)
      setDurationText(String(parsed))
    } else {
      setDurationText(String(durationMs))
    }
  }, [durationMs])

  const handleDurationPreset = useCallback((value: number) => {
    setDurationMs(value)
    setDurationText(String(value))
  }, [])

  const handleCreate = useCallback(() => {
    if (!isValid) return

    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const id = `heph_${timestamp}_${randomSuffix}`

    const defaultParams = DEFAULT_PARAMS_BY_CATEGORY[category]
    const curves = new Map<HephParamId, HephCurve>()
    for (const paramId of defaultParams) {
      curves.set(paramId, createDefaultCurve(paramId, durationMs))
    }

    const newClip: HephAutomationClip = {
      id,
      name: name.trim(),
      author: 'LuxSync User',
      category,
      tags: [],
      vibeCompat: [],
      zones: zones.length > 0 ? zones : ['all'],
      mixBus,
      priority: 50,
      durationMs,
      effectType: 'heph_custom',
      curves,
      staticParams: {},
    }

    onCreate(newClip)
    onClose()
  }, [name, durationMs, category, mixBus, zones, isValid, onCreate, onClose])

  // ── 🛡️ THE BUNKER: Event isolation ──

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  /**
   * WAVE 2040.28: INPUT TRAP
   * Stop ALL events from escaping the modal.
   * Prevents Space from pausing Chronos, arrows from moving timeline, etc.
   */
  const trapEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && isValid) {
      handleCreate()
    }
  }

  if (!isOpen) return null

  // ── 🛡️ REACT PORTAL: Render outside HephaestusView hierarchy ──
  const modalContent = (
    <div 
      className="heph-bunker-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      onKeyUp={trapEvent}
      onKeyPress={trapEvent}
    >
      <div 
        className="heph-bunker" 
        role="dialog" 
        aria-modal="true"
        aria-label="New Automation Clip"
        onClick={trapEvent}
        onMouseDown={trapEvent}
        onPointerDown={trapEvent}
      >
        {/* ── HEADER ── */}
        <header className="heph-bunker__header">
          <div className="heph-bunker__title">
            <HephLogoIcon size={20} color="#f97316" />
            <span>NEW AUTOMATION CLIP</span>
          </div>
          <button 
            className="heph-bunker__close" 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {/* ── BODY: Two-column layout ── */}
        <div className="heph-bunker__body">
          {/* LEFT COLUMN: Form fields */}
          <div className="heph-bunker__left">
            {/* Name */}
            <div className="heph-bunker__field">
              <label className="heph-bunker__label">NAME</label>
              <input
                type="text"
                className="heph-bunker__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={trapEvent}
                onKeyUp={trapEvent}
                placeholder="My Killer Drop"
                ref={nameRef}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Duration */}
            <div className="heph-bunker__field">
              <label className="heph-bunker__label">DURATION</label>
              <div className="heph-bunker__duration-row">
                <input
                  type="text"
                  inputMode="numeric"
                  className="heph-bunker__input heph-bunker__input--duration"
                  value={durationText}
                  onChange={(e) => setDurationText(e.target.value)}
                  onBlur={(e) => commitDuration(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitDuration(durationText)
                  }}
                  onKeyUp={trapEvent}
                />
                <span className="heph-bunker__unit">ms</span>
              </div>
              <div className="heph-bunker__presets">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`heph-bunker__preset ${durationMs === preset.value ? 'heph-bunker__preset--active' : ''}`}
                    onClick={() => handleDurationPreset(preset.value)}
                    title={preset.tooltip}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category — Uniform Grid */}
            <div className="heph-bunker__field">
              <label className="heph-bunker__label">CATEGORY</label>
              <div className="heph-bunker__cat-grid">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`heph-bunker__cat-tile ${category === cat.value ? 'heph-bunker__cat-tile--active' : ''}`}
                    onClick={() => setCategory(cat.value)}
                    title={cat.desc}
                  >
                    <span className="heph-bunker__cat-icon">{cat.icon}</span>
                    <span className="heph-bunker__cat-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Routing — MixBus with neon colors */}
            <div className="heph-bunker__field">
              <label className="heph-bunker__label">ROUTING</label>
              <div className="heph-bunker__route-grid">
                {MIXBUS_OPTIONS.map((bus) => (
                  <button
                    key={bus.value}
                    type="button"
                    className={`heph-bunker__route-btn ${mixBus === bus.value ? 'heph-bunker__route-btn--active' : ''}`}
                    onClick={() => setMixBus(bus.value)}
                    title={bus.desc}
                    style={{ 
                      '--bus-color': bus.color,
                      '--bus-color-dim': `${bus.color}33`,
                      '--bus-color-glow': `${bus.color}40`,
                    } as React.CSSProperties}
                  >
                    <span 
                      className="heph-bunker__route-dot" 
                      style={{ background: bus.color }}
                    />
                    <span className="heph-bunker__route-label">{bus.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Smart Zone Selector */}
          <div className="heph-bunker__right">
            <label className="heph-bunker__label">TARGET ZONES</label>
            <SmartZoneSelector
              selectedZones={zones}
              onZonesChange={setZones}
            />
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="heph-bunker__footer">
          <button
            type="button"
            className="heph-bunker__btn heph-bunker__btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="heph-bunker__btn heph-bunker__btn--create"
            onClick={handleCreate}
            disabled={!isValid}
          >
            Create Clip
          </button>
        </footer>
      </div>
    </div>
  )

  // ⚒️ PORTAL: Render into document.body, outside React tree
  return createPortal(modalContent, document.body)
})

NewClipModal.displayName = 'NewClipModal'
