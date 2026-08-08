/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ EnvelopeBay.tsx — Wrapper ADSR para una cámara (17 genes)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada EnvelopeBay representa una de las 6 cámaras (SubBass, Kick, Vocal,
 * Snare, HighMid, Treble). Agrupa los 17 genes del envelope en un panel
 * visual cohesivo con una curva ADSR dibujada en canvas.
 *
 * @module components/vibeLab/panels/EnvelopeBay
 * @version FASE 4.3 — THE DEEP DIVE
 */

import React, { memo, useMemo, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { GeneSlider } from '../kit'
import { ENVELOPE_GENE_RANGES, isInDangerZone } from '../../../engine/vibe/custom/GENE_RANGES'
import { useVibeLabStore, useGene } from '../../../stores/vibeLabStore'
import { resolveBaseValueNumber } from '../resolveBaseValue'
import type { BaseDNA } from '../../../types/CustomVibe'
import './envelope-bay.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface EnvelopeBayProps {
  slot: string
  slotLabel: string
  accent?: string
  isExpanded?: boolean
  onToggle?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// ADSR CANVAS — visualización simplificada de la curva
// ═══════════════════════════════════════════════════════════════════════════

const AdsrCanvas: React.FC<{ slot: string; baseDNA: string; size?: number }> = ({
  slot, baseDNA, size = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Resolve base values from the canonical profile (not hardcoded defaults)
  const baseBoost       = useMemo(() => resolveBaseValueNumber(`physics.envelopes.${slot}.boost`, baseDNA), [slot, baseDNA])
  const baseDecayBase   = useMemo(() => resolveBaseValueNumber(`physics.envelopes.${slot}.decayBase`, baseDNA), [slot, baseDNA])
  const baseDecayRange  = useMemo(() => resolveBaseValueNumber(`physics.envelopes.${slot}.decayRange`, baseDNA), [slot, baseDNA])
  const baseGateOn      = useMemo(() => resolveBaseValueNumber(`physics.envelopes.${slot}.gateOn`, baseDNA), [slot, baseDNA])
  const baseMaxIntensity= useMemo(() => resolveBaseValueNumber(`physics.envelopes.${slot}.maxIntensity`, baseDNA), [slot, baseDNA])

  // Subscribe to each gene via useGene (reflects mutations)
  const { value: boost } = useGene<number>(`physics.envelopes.${slot}.boost`, baseBoost)
  const { value: decayBase } = useGene<number>(`physics.envelopes.${slot}.decayBase`, baseDecayBase)
  const { value: decayRange } = useGene<number>(`physics.envelopes.${slot}.decayRange`, baseDecayRange)
  const { value: gateOn } = useGene<number>(`physics.envelopes.${slot}.gateOn`, baseGateOn)
  const { value: maxIntensity } = useGene<number>(`physics.envelopes.${slot}.maxIntensity`, baseMaxIntensity)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, size, size)

    // ── Grid ─────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * size
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke()
    }

    // ── Curva ADSR simplificada ──────────────────────────────────────
    // Attack: 0 → gateOn (rápido)
    // Decay: gateOn → decayBase (exponencial)
    // Sustain: decayBase ± decayRange
    // Release: al final

    const attackEnd = gateOn * size * 0.3
    const decayEnd = attackEnd + size * 0.2
    const sustainEnd = size * 0.75
    const peak = (maxIntensity ?? 0.8) * size * 0.9
    const sustainLevel = (decayBase ?? 0.5) * size * 0.7
    const decayDepth = (decayRange ?? 0.3) * size * 0.3

    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    // Attack (0,0) → (attackEnd, peak)
    ctx.moveTo(0, size - 2)
    ctx.lineTo(attackEnd, size - peak)

    // Decay (attackEnd, peak) → (decayEnd, sustainLevel)
    const decaySteps = 20
    for (let i = 1; i <= decaySteps; i++) {
      const t = i / decaySteps
      const x = attackEnd + (decayEnd - attackEnd) * t
      const y = size - peak + (size - sustainLevel - (size - peak)) * Math.pow(t, 2)
      ctx.lineTo(x, y)
    }

    // Sustain (decayEnd, sustainLevel) → (sustainEnd, sustainLevel ± decayDepth oscillation)
    const susSteps = 30
    for (let i = 1; i <= susSteps; i++) {
      const t = i / susSteps
      const x = decayEnd + (sustainEnd - decayEnd) * t
      const wobble = Math.sin(t * Math.PI * 4) * decayDepth * 0.3
      ctx.lineTo(x, size - sustainLevel + wobble)
    }

    // Release (sustainEnd, sustainLevel) → (size, 0)
    ctx.lineTo(size, size - 2)

    ctx.stroke()

    // ── Boost indicator (glow) ───────────────────────────────────────
    if (boost > 1) {
      ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = Math.min(20, (boost ?? 1) * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }, [size, boost, decayBase, decayRange, gateOn, maxIntensity])

  return <canvas ref={canvasRef} style={{ width: size, height: size * 0.4, display: 'block' }} />
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVELOPE GENE SLIDER — one gene, subscribed to the store via useGene
// ═══════════════════════════════════════════════════════════════════════════
// Must be a separate component so useGene (a hook) is called once per render,
// not inside a loop (which would violate the Rules of Hooks).

interface EnvelopeGeneSliderProps {
  path: string
  geneName: string
  baseDNA: string
  range: {
    min: number
    max: number
    step: number
    unit?: string
    tier: 'safe' | 'raw'
    danger?: readonly [number, number]
  }
}

const EnvelopeGeneSlider: React.FC<EnvelopeGeneSliderProps> = memo(
  ({ path, geneName, baseDNA, range }) => {
    const baseVal = useMemo(
      () => resolveBaseValueNumber(path, baseDNA),
      [path, baseDNA],
    )
    const { value, isMutated } = useGene<number>(path, baseVal)
    const setGene = useVibeLabStore((s) => s.setGene)
    const revertGene = useVibeLabStore((s) => s.revertGene)

    const numValue = typeof value === 'number' ? value : baseVal

    return (
      <GeneSlider
        path={path}
        label={geneName.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
        baseValue={baseVal}
        value={numValue}
        min={range.min}
        max={range.max}
        step={range.step}
        unit={range.unit}
        danger={range.danger as [number, number] | undefined}
        isMutated={isMutated}
        isInDanger={isInDangerZone(path, numValue)}
        tier={range.tier}
        onChange={(v) => setGene(path, v)}
        onRevert={() => revertGene(path)}
      />
    )
  },
)
EnvelopeGeneSlider.displayName = 'EnvelopeGeneSlider'

// ═══════════════════════════════════════════════════════════════════════════
// ENVELOPE BAY
// ═══════════════════════════════════════════════════════════════════════════

export const EnvelopeBay: React.FC<EnvelopeBayProps> = memo(
  ({ slot, slotLabel, accent = '#00e5ff', isExpanded = false, onToggle }) => {
    const draft = useVibeLabStore((s) => s.draft)
    const baseDNA = (draft?.baseDNA ?? 'techno-club') as BaseDNA

    // Los 17 genes del envelope
    const genes = useMemo(() => Object.entries(ENVELOPE_GENE_RANGES), [])

    return (
      <div className={`envelope-bay ${isExpanded ? 'expanded' : ''}`}>
        <button className="envelope-bay-header" onClick={onToggle} type="button">
          <span className="envelope-bay-label" style={{ color: accent }}>
            {slotLabel}
          </span>
          <AdsrCanvas slot={slot} baseDNA={baseDNA} size={100} />
          <ChevronDown size={12} className={`envelope-bay-chevron ${isExpanded ? 'open' : ''}`} />
        </button>

        {isExpanded && (
          <div className="envelope-bay-genes">
            {genes.map(([geneName, range]) => {
              const path = `physics.envelopes.${slot}.${geneName}`
              return (
                <EnvelopeGeneSlider
                  key={path}
                  path={path}
                  geneName={geneName}
                  baseDNA={baseDNA}
                  range={range}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  },
)

EnvelopeBay.displayName = 'EnvelopeBay'
