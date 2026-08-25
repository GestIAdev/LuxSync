/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌿 <EcoChromaticCore> — WAVE 7584: ECO-MODE FALLBACK FOR <ChromaticCoreComplete>
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Spec source: `hyperion_performance_audit2.md` §3.7.2.
 *
 * What it kills (vs `ChromaticCoreComplete`):
 *   • The `conic-gradient` color wheel + `radial-gradient` mask re-raster at
 *     10 Hz — the heaviest single element in the panel.
 *   • Multi-layer `box-shadow` glows on 5 elements.
 *   • `text-shadow` on mood labels.
 *
 * What it keeps:
 *   • The operator can still see the current 4-color palette.
 *   • Kelvin temperature, musical key/chord, and harmony strategy as text.
 *   • Mood indicator (single colored dot + label).
 *
 * Design (audit §3.7.2):
 *   • Static 4-swatch row — four `<div>` blocks with `background: hsl(...)`.
 *     No gradient, no mask, no shadow. A flat `background-color` change is a
 *     cheap compositor op (no blur, no mask).
 *   • Kelvin / key / harmony as plain text — no `text-shadow`.
 *   • Mood indicator is a single 6px colored dot (flat `background`) + text.
 *   • No `box-shadow`, no `conic-gradient`, no `mask`, no `text-shadow`,
 *     no `filter` on any element.
 *
 * Data: subscribes via `useThrottledTruthSelector` at 5 Hz. The palette is
 * already throttled to ~1 Hz by `useTruthPaletteThrottled` in the HQ path, so
 * 5 Hz here is more than enough; the shallow-equality gate in the hook skips
 * `setState` when the palette hasn't changed, so a static section produces zero
 * re-renders after paint.
 *
 * @module components/views/SensoryView/EcoChromaticCore
 * @version 7584.0.0 - Eco-Mode
 */

import React, { memo } from 'react'
import { useThrottledTruthSelector } from '../../../hooks/useThrottledTruthSelector'
import type { SeleneTruth } from '../../../core/protocol/SeleneProtocol'
import type { HSLColor } from '../../../core/protocol/LightingIntent'
import './EcoChromaticCore.css'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

interface PaletteRole {
  key: 'primary' | 'secondary' | 'accent' | 'ambient'
  label: string
  short: string
}

const PALETTE_ROLES: PaletteRole[] = [
  { key: 'primary', label: 'Primary', short: 'PRI' },
  { key: 'secondary', label: 'Secondary', short: 'SEC' },
  { key: 'accent', label: 'Accent', short: 'ACC' },
  { key: 'ambient', label: 'Ambient', short: 'AMB' },
]

const STRATEGY_LABELS: Record<string, string> = {
  'analogous': 'ANALOGOUS',
  'complementary': 'COMPLEMENTARY',
  'triadic': 'TRIADIC',
  'monochromatic': 'MONO',
  'split-complementary': 'SPLIT',
  'prism': 'PRISM',
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — pure, no allocation in render hot path
// ═══════════════════════════════════════════════════════════════════════════════

function hslToCSS(c: HSLColor): string {
  return `hsl(${Math.round(c.h * 360)}, ${Math.round(c.s * 100)}%, ${Math.round(c.l * 100)}%)`
}

function hueToTemperature(hue: number): number {
  const h = hue * 360
  if (h < 60) return 2000 + (h / 60) * 2000
  if (h < 180) return 4000 + ((h - 60) / 120) * 2500
  if (h < 270) return 6500 + ((h - 180) / 90) * 3500
  return 2000 + ((360 - h) / 90) * 2000
}

/** Clamp HSL to visually safe ranges — prevents black/white flashes. */
function safeColor(c: HSLColor): HSLColor {
  return { h: c.h, s: Math.max(0.2, c.s), l: Math.max(0.15, Math.min(0.85, c.l)) }
}

const MOOD_COLORS: Record<string, string> = {
  BRIGHT: '#fbbf24',
  DARK: '#a855f7',
  NEUTRAL: '#6a6a7a',
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTOR — extract exactly the fields we need as a stable object
// ═══════════════════════════════════════════════════════════════════════════════

interface EcoChromaticSnapshot {
  /** 4 CSS color strings — pre-computed so render is allocation-free */
  swatches: [string, string, string, string]
  strategy: string
  kelvin: number
  key: string | null
  mode: string
  mood: string
}

function selectEcoChromatic(truth: SeleneTruth): EcoChromaticSnapshot {
  const palette = truth.intent?.palette
  const context = truth.context
  const consciousness = truth.consciousness

  const swatches: [string, string, string, string] = ['transparent', 'transparent', 'transparent', 'transparent']
  if (palette) {
    const p = safeColor(palette.primary)
    const s = safeColor(palette.secondary)
    const a = safeColor(palette.accent)
    const am = safeColor(palette.ambient)
    swatches[0] = hslToCSS(p)
    swatches[1] = hslToCSS(s)
    swatches[2] = hslToCSS(a)
    swatches[3] = hslToCSS(am)
  }

  return {
    swatches,
    strategy: palette?.strategy ?? 'analogous',
    kelvin: palette ? hueToTemperature(safeColor(palette.primary).h) : 5000,
    key: context?.key ?? null,
    mode: context?.mode ?? 'unknown',
    mood: consciousness?.stableEmotion ?? 'NEUTRAL',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const EcoChromaticCore: React.FC = memo(() => {
  const snap = useThrottledTruthSelector(selectEcoChromatic, 200)

  const swatches = snap?.swatches ?? (['transparent', 'transparent', 'transparent', 'transparent'] as [string, string, string, string])
  const strategy = snap?.strategy ?? 'analogous'
  const kelvin = snap?.kelvin ?? 5000
  const key = snap?.key ?? null
  const mode = snap?.mode ?? 'unknown'
  const mood = snap?.mood ?? 'NEUTRAL'

  const strategyLabel = STRATEGY_LABELS[strategy] ?? strategy.toUpperCase()
  const moodColor = MOOD_COLORS[mood] ?? MOOD_COLORS.NEUTRAL
  const keyText = key ? `${key}${mode === 'minor' ? 'm' : ''}` : '—'
  const modeText = mode === 'minor' ? 'Minor' : mode === 'major' ? 'Major' : '—'
  const tempLabel = kelvin < 4000 ? 'Warm' : kelvin < 6000 ? 'Neutral' : 'Cool'

  return (
    <div className="eco-chromatic">
      <div className="eco-chromatic__header">
        <span className="eco-chromatic__title">CHROMATIC</span>
        <span className="eco-chromatic__strategy">{strategyLabel}</span>
      </div>

      {/* 4-swatch row — flat background colors, no gradient/mask/shadow */}
      <div className="eco-chromatic__swatches">
        {PALETTE_ROLES.map((role, i) => (
          <div
            key={role.key}
            className="eco-chromatic__swatch"
            style={{ backgroundColor: swatches[i] }}
          >
            <span className="eco-chromatic__swatch-label">{role.short}</span>
          </div>
        ))}
      </div>

      {/* Kelvin + Key — plain text, no text-shadow */}
      <div className="eco-chromatic__info">
        <div className="eco-chromatic__info-item">
          <span className="eco-chromatic__info-k">TEMP</span>
          <span className="eco-chromatic__info-v">{Math.round(kelvin)}K</span>
          <span className="eco-chromatic__info-d">{tempLabel}</span>
        </div>
        <div className="eco-chromatic__info-item">
          <span className="eco-chromatic__info-k">KEY</span>
          <span className="eco-chromatic__info-v">{keyText}</span>
          <span className="eco-chromatic__info-d">{modeText}</span>
        </div>
      </div>

      {/* Mood — single 6px dot + text, no glow */}
      <div className="eco-chromatic__mood">
        <div
          className="eco-chromatic__mood-dot"
          style={{ backgroundColor: moodColor }}
        />
        <span className="eco-chromatic__mood-label">{mood}</span>
      </div>
    </div>
  )
})

EcoChromaticCore.displayName = 'EcoChromaticCore'

export default EcoChromaticCore
