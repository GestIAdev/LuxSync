/**
 * 🎵 AUDIO SPECTRUM TITAN - WAVE UX-3: THE GC PAUSE ANNIHILATION
 * 🧨 WAVE 7759: ZERO-ALLOC AUDIT — Canvas refactor
 * 
 * ARCHITECTURE: Canvas-based RAF engine — ZERO React re-renders, ZERO GC pressure.
 * 
 * React renders the static DOM skeleton (header + stats) exactly ONCE on mount.
 * A requestAnimationFrame loop reads the Zustand store imperatively via getState()
 * and draws 32 bars + peaks directly on a <canvas> element.
 * 
 * Memory model:
 * - Pre-allocated Float32Arrays for bands, peaks, counters (no per-frame allocation)
 * - Pre-computed color strings assigned at module level (interned by V8, never re-alloc'd)
 * - Pre-computed PERCENT_STRINGS[0..100] lookup table — eliminates all `${n}%` template literals
 * - Canvas fillRect with numeric args (zero string allocation per frame)
 * - Stats DOM updated via dirty-checking (textContent/style only when integer value changes)
 * 
 * Result: 0 renders/sec, 0 string allocations/frame, pure 60fps canvas rendering.
 */

import React, { memo, useRef, useEffect } from 'react'
import { getTransientTruth, getAudioMatrixTelemetry } from '../../../stores/transientStore'
import { SpectrumBarsIcon, LiveDotIcon } from '../../icons/LuxIcons'
import './AudioSpectrumTitan.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BAND_COUNT = 32
const PEAK_HOLD_FRAMES = 30
const PEAK_DECAY_RATE = 0.02
const AUDIO_LERP = 0.35  // Converge en ~5 frames (83ms)

const FREQ_LABELS = [
  { label: 'SUB', position: 0, freq: '20-60Hz' },
  { label: 'BASS', position: 4, freq: '60-250Hz' },
  { label: 'LOW-MID', position: 10, freq: '250-500Hz' },
  { label: 'MID', position: 16, freq: '500Hz-2kHz' },
  { label: 'HIGH-MID', position: 22, freq: '2-6kHz' },
  { label: 'AIR', position: 28, freq: '6-20kHz' },
]

// ═══════════════════════════════════════════════════════════════════════════
// PRE-COMPUTED STRINGS — module-level, interned by V8, never re-allocated
// ═══════════════════════════════════════════════════════════════════════════

// PERCENT_STRINGS[0] = "0%", ..., PERCENT_STRINGS[100] = "100%"
// Eliminates ALL `${n}%` template literals in the hot loop.
const PERCENT_STRINGS: string[] = new Array(101)
for (let i = 0; i <= 100; i++) PERCENT_STRINGS[i] = `${i}%`

// Band colors — 7-color gradient mapped to 32 bands (allocated once, never again)
const SPECTRUM_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#22d3ee',
  '#10b981', '#f59e0b', '#ef4444',
]

const BAND_COLORS: string[] = new Array(BAND_COUNT)
for (let i = 0; i < BAND_COUNT; i++) {
  const segment = (i / BAND_COUNT) * (SPECTRUM_COLORS.length - 1)
  BAND_COLORS[i] = SPECTRUM_COLORS[Math.floor(segment)]
}

// Pre-computed frequency label left positions as CSS strings
const FREQ_LABEL_POSITIONS = FREQ_LABELS.map(f => `${(f.position / BAND_COUNT) * 100}%`)

// Energy gradient strings — pre-computed, never allocated per frame
const ENERGY_GRADIENT_HIGH = 'linear-gradient(90deg, #f97316, #ef4444)'
const ENERGY_GRADIENT_NORMAL = 'linear-gradient(90deg, #22c55e, #10b981)'

// Grid line color — interned string literal
const GRID_COLOR = 'rgba(255,255,255,0.06)'

// Ring buffer color thresholds — interned string literals
const RING_COLOR_RED = '#ef4444'
const RING_COLOR_YELLOW = '#fbbf24'
const RING_COLOR_CYAN = '#22d3ee'
const RING_COLOR_IDLE = 'rgba(255,255,255,0.2)'

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL POINTS SCRATCH BUFFER — 8 floats, allocated once
// ═══════════════════════════════════════════════════════════════════════════
const _cp = new Float64Array(8)

// ═══════════════════════════════════════════════════════════════════════════
// ZERO-ALLOC INTERPOLATION — mutates target buffer in-place
// ═══════════════════════════════════════════════════════════════════════════

function interpolateTo32BandsInPlace(
  bass: number, mid: number, high: number,
  target: Float32Array, time: number
): void {
  _cp[0] = bass * 0.6
  _cp[1] = bass * 0.9
  _cp[2] = bass * 0.7 + mid * 0.3
  _cp[3] = mid
  _cp[4] = mid * 0.8 + high * 0.2
  _cp[5] = high * 0.7
  _cp[6] = high * 0.9
  _cp[7] = high * 0.6

  for (let i = 0; i < BAND_COUNT; i++) {
    const segment = i * 0.25 // i / 4
    const si = segment | 0   // Math.floor via bitwise
    const sp = segment - si

    const cur = _cp[si < 7 ? si : 7]
    const nxt = _cp[si < 6 ? si + 1 : 7]

    const t = sp * sp * (3 - 2 * sp) // smoothstep
    const value = cur + (nxt - cur) * t

    // Deterministic organic variance via sin — no Math.random()
    const variance = Math.sin(i * 0.5 + time * 0.001) * 0.025 + 0.025
    let v = value + variance
    if (v < 0) v = 0
    if (v > 1) v = 1
    target[i] = v
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT — renders ONCE, then RAF takes over
// ═══════════════════════════════════════════════════════════════════════════

export const AudioSpectrumTitan: React.FC = memo(() => {
  // ─── Canvas Ref ─────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // ─── DOM Refs (stats only — bars are on canvas now) ────────────────────
  const rootRef = useRef<HTMLDivElement | null>(null)
  const statBpmRef = useRef<HTMLSpanElement | null>(null)
  const statConfidenceRef = useRef<HTMLDivElement | null>(null)
  const statEnergyValueRef = useRef<HTMLSpanElement | null>(null)
  const statEnergyFillRef = useRef<HTMLDivElement | null>(null)
  const statFluxValueRef = useRef<HTMLSpanElement | null>(null)
  const statFluxFillRef = useRef<HTMLDivElement | null>(null)
  const statDominantRef = useRef<HTMLSpanElement | null>(null)
  const distSubRef = useRef<HTMLDivElement | null>(null)
  const distBassRef = useRef<HTMLDivElement | null>(null)
  const distMidRef = useRef<HTMLDivElement | null>(null)
  const distHighRef = useRef<HTMLDivElement | null>(null)
  const ringFillRef = useRef<HTMLDivElement | null>(null)
  const ringLabelRef = useRef<HTMLSpanElement | null>(null)
  const sourceTagRef = useRef<HTMLSpanElement | null>(null)

  // ─── Pre-allocated scratch buffers (Float32Array per directive) ────────
  const bandsBuffer = useRef(new Float32Array(BAND_COUNT))
  const peakValues = useRef(new Float32Array(BAND_COUNT))
  const peakCounters = useRef(new Float32Array(BAND_COUNT))

  // 🌊 WAVE 7759.1: LIQUID MOTION — smoothed bar heights (per-bar LERP).
  // Replaces the CSS `transition: height 0.05s ease-out` lost in the canvas
  // refactor. Without this, bars snap to raw interpolated values every frame,
  // producing a jittery/stuttering motion. The LERP factor 0.25 converges in
  // ~12 frames (~200ms @ 60fps) — visually equivalent to the old 50ms CSS ease
  // but applied per-bar in pure numeric space (zero allocation).
  const smoothedValues = useRef(new Float32Array(BAND_COUNT))
  const BAR_LERP = 0.25

  // ─── LERP smoothing refs ───────────────────────────────────────────────
  const smoothBass = useRef(0)
  const smoothMid = useRef(0)
  const smoothHigh = useRef(0)

  // ─── Beat state ────────────────────────────────────────────────────────
  const lastBeatRef = useRef(false)

  // ─── Dirty-check refs for stats (avoid redundant DOM writes) ───────────
  const lastBpmRef = useRef(-1)
  const lastEnergyPctRef = useRef(-1)
  const lastEnergyHighRef = useRef(false)
  const lastConfidencePctRef = useRef(-1)
  const lastFluxCategoryRef = useRef('')
  const lastFluxPctRef = useRef(-1)
  const lastDominantRef = useRef('')
  const lastDistSubRef = useRef(-1)
  const lastDistBassRef = useRef(-1)
  const lastDistMidRef = useRef(-1)
  const lastDistHighRef = useRef(-1)
  const lastRingFillPctRef = useRef(-1)
  const lastRingColorRef = useRef('')
  const lastSourceRef = useRef('')

  // ─── Canvas sizing cache ───────────────────────────────────────────────
  const canvasSizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  // ─── THE RAF ENGINE ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── Size canvas to match CSS pixels × devicePixelRatio ──
    // 🎯 WAVE 7759.1: DPI SCALING — capture DPR with fallback to 2 (retina-class)
    // to eliminate blurriness on high-DPI displays. The backing store is sized
    // to physical pixels; the transform scales drawing coords back to logical
    // pixels so the rest of the code uses CSS pixel space.
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 2
      canvas.width = (rect.width * dpr) | 0
      canvas.height = (rect.height * dpr) | 0
      canvasSizeRef.current.w = rect.width
      canvasSizeRef.current.h = rect.height
      canvasSizeRef.current.dpr = dpr
      // setTransform replaces any prior transform (avoids compounding scale on re-resize)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    let frameId: number

    const tick = (now: number) => {
      // 🕵️ WAVE 7570.3: Skip when document hidden
      if (document.hidden) { frameId = requestAnimationFrame(tick); return }

      const truth = getTransientTruth()
      if (!truth) { frameId = requestAnimationFrame(tick); return }
      const audio = truth.sensory.audio
      const beat = truth.sensory.beat

      // ── TEMPORAL LERP — exponential smoothing (zero alloc) ──
      smoothBass.current += (audio.bass - smoothBass.current) * AUDIO_LERP
      smoothMid.current += (audio.mid - smoothMid.current) * AUDIO_LERP
      smoothHigh.current += (audio.high - smoothHigh.current) * AUDIO_LERP

      // ── Interpolate bands (zero allocation, in-place mutation) ──
      interpolateTo32BandsInPlace(
        smoothBass.current, smoothMid.current, smoothHigh.current,
        bandsBuffer.current, now
      )

      const bands = bandsBuffer.current
      const peaks = peakValues.current
      const counters = peakCounters.current
      const smoothed = smoothedValues.current

      // ── Canvas dimensions ──
      const cw = canvasSizeRef.current.w
      const ch = canvasSizeRef.current.h
      if (cw === 0 || ch === 0) { frameId = requestAnimationFrame(tick); return }

      const gap = 3
      const barW = (cw - gap * (BAND_COUNT - 1)) / BAND_COUNT

      // ── Clear canvas ──
      ctx.clearRect(0, 0, cw, ch)

      // ── Grid lines (25%, 50%, 75% from bottom) — pixel-snapped ──
      ctx.fillStyle = GRID_COLOR
      const grid25 = (ch * 0.75) | 0
      const grid50 = (ch * 0.50) | 0
      const grid75 = (ch * 0.25) | 0
      ctx.fillRect(0, grid25, cw | 0, 1)
      ctx.fillRect(0, grid50, cw | 0, 1)
      ctx.fillRect(0, grid75, cw | 0, 1)

      // ── Peak hold + canvas draw in one pass ──
      let fluxAccum = 0
      let subAccum = 0, bassAccum = 0, midAccum = 0, highAccum = 0

      for (let i = 0; i < BAND_COUNT; i++) {
        const value = bands[i]

        // Peak logic (in-place mutation, zero alloc)
        if (value > peaks[i]) {
          peaks[i] = value
          counters[i] = PEAK_HOLD_FRAMES
        } else if (counters[i] > 0) {
          counters[i]--
        } else {
          peaks[i] -= PEAK_DECAY_RATE
          if (peaks[i] < 0) peaks[i] = 0
        }

        // Flux accumulator
        fluxAccum += Math.abs(value - peaks[i])

        // Energy distribution accumulators
        if (i < 4) subAccum += value
        else if (i < 10) bassAccum += value
        else if (i < 20) midAccum += value
        else highAccum += value

        // 🌊 WAVE 7759.1: LIQUID MOTION — per-bar LERP toward raw value.
        // Replaces the CSS `transition: height 0.05s ease-out` lost in the
        // canvas refactor. Converges in ~12 frames (~200ms @ 60fps).
        smoothed[i] += (value - smoothed[i]) * BAR_LERP

        // 🎯 WAVE 7759.1: PIXEL SNAPPING — round all coords to integers before
        // fillRect. Eliminates sub-pixel anti-aliasing that smears bar edges
        // into a blurry mess on high-DPI displays.
        const x = (i * (barW + gap)) | 0
        const w = barW | 0
        let barH = (smoothed[i] * ch) | 0
        if (barH < 2) barH = 2  // min-height equivalent
        const barY = (ch - barH) | 0

        // Bar (alpha 1.0)
        ctx.globalAlpha = 1.0
        ctx.fillStyle = BAND_COLORS[i]  // module-level constant, interned
        ctx.fillRect(x, barY, w, barH)

        // Peak indicator (alpha 0.8, 3px tall) — pixel-snapped
        const peakY = (ch - peaks[i] * ch) | 0
        ctx.globalAlpha = 0.8
        ctx.fillRect(x, peakY, w, 3)
      }

      // Reset alpha after bar loop
      ctx.globalAlpha = 1.0

      // ── Beat pulse class toggle (zero alloc — classList add/remove) ──
      const onBeat = beat.onBeat
      if (onBeat !== lastBeatRef.current) {
        lastBeatRef.current = onBeat
        if (rootRef.current) {
          if (onBeat) {
            rootRef.current.classList.add('audio-spectrum-titan--beat')
          } else {
            rootRef.current.classList.remove('audio-spectrum-titan--beat')
          }
        }
      }

      // ═════════════════════════════════════════════════════════════════════
      // STATS — dirty-checked DOM updates (zero alloc when values unchanged)
      // ═════════════════════════════════════════════════════════════════════

      // ── BPM ──
      const bpmInt = beat.bpm | 0
      if (bpmInt !== lastBpmRef.current) {
        lastBpmRef.current = bpmInt
        if (statBpmRef.current) {
          statBpmRef.current.textContent = bpmInt > 0 ? String(bpmInt) : '--'
        }
      }

      // ── Confidence ──
      const confidencePct = ((beat.confidence || 0) * 100) | 0
      if (confidencePct !== lastConfidencePctRef.current) {
        lastConfidencePctRef.current = confidencePct
        if (statConfidenceRef.current) {
          statConfidenceRef.current.style.width = PERCENT_STRINGS[confidencePct]
        }
      }

      // ── Energy ──
      const energyPct = (audio.energy * 100) | 0
      if (energyPct !== lastEnergyPctRef.current) {
        lastEnergyPctRef.current = energyPct
        if (statEnergyValueRef.current) {
          statEnergyValueRef.current.textContent = PERCENT_STRINGS[energyPct]
        }
        if (statEnergyFillRef.current) {
          statEnergyFillRef.current.style.width = PERCENT_STRINGS[energyPct]
        }
      }
      const isHighEnergy = audio.energy > 0.7
      if (isHighEnergy !== lastEnergyHighRef.current) {
        lastEnergyHighRef.current = isHighEnergy
        if (statEnergyFillRef.current) {
          statEnergyFillRef.current.style.background =
            isHighEnergy ? ENERGY_GRADIENT_HIGH : ENERGY_GRADIENT_NORMAL
        }
      }

      // ── Spectral Flux ──
      let flux = (fluxAccum / BAND_COUNT) * 5
      if (flux > 1) flux = 1
      const fluxCategory = flux > 0.6 ? 'HIGH' : flux > 0.3 ? 'MED' : 'LOW'
      if (fluxCategory !== lastFluxCategoryRef.current) {
        lastFluxCategoryRef.current = fluxCategory
        if (statFluxValueRef.current) {
          statFluxValueRef.current.textContent = fluxCategory
        }
      }
      const fluxPct = (flux * 100) | 0
      if (fluxPct !== lastFluxPctRef.current) {
        lastFluxPctRef.current = fluxPct
        if (statFluxFillRef.current) {
          statFluxFillRef.current.style.width = PERCENT_STRINGS[fluxPct]
        }
      }

      // ── Dominant band ──
      const eSub = subAccum / 4
      const eBass = bassAccum / 6
      const eMid = midAccum / 10
      const eHigh = highAccum / 12
      const maxEnergy = Math.max(eSub, eBass, eMid, eHigh)
      const dominant =
        maxEnergy === eSub ? 'SUB'
        : maxEnergy === eBass ? 'BASS'
        : maxEnergy === eMid ? 'MID'
        : 'HIGH'
      if (dominant !== lastDominantRef.current) {
        lastDominantRef.current = dominant
        if (statDominantRef.current) {
          statDominantRef.current.textContent = dominant
        }
      }

      // ── Distribution bars ──
      const distSubPct = (eSub * 100) | 0
      if (distSubPct !== lastDistSubRef.current) {
        lastDistSubRef.current = distSubPct
        if (distSubRef.current) distSubRef.current.style.width = PERCENT_STRINGS[distSubPct]
      }
      const distBassPct = (eBass * 100) | 0
      if (distBassPct !== lastDistBassRef.current) {
        lastDistBassRef.current = distBassPct
        if (distBassRef.current) distBassRef.current.style.width = PERCENT_STRINGS[distBassPct]
      }
      const distMidPct = (eMid * 100) | 0
      if (distMidPct !== lastDistMidRef.current) {
        lastDistMidRef.current = distMidPct
        if (distMidRef.current) distMidRef.current.style.width = PERCENT_STRINGS[distMidPct]
      }
      const distHighPct = (eHigh * 100) | 0
      if (distHighPct !== lastDistHighRef.current) {
        lastDistHighRef.current = distHighPct
        if (distHighRef.current) distHighRef.current.style.width = PERCENT_STRINGS[distHighPct]
      }

      // ── Ring Buffer Gauge ──
      const matrix = getAudioMatrixTelemetry()
      const fill = matrix.ringBufferFillLevel
      const fillPct = (fill * 100) | 0
      if (fillPct !== lastRingFillPctRef.current) {
        lastRingFillPctRef.current = fillPct
        if (ringFillRef.current) {
          ringFillRef.current.style.height = PERCENT_STRINGS[fillPct]
        }
        if (ringLabelRef.current) {
          ringLabelRef.current.textContent = PERCENT_STRINGS[fillPct]
        }
      }
      const ringColor =
        fill > 0.85 ? RING_COLOR_RED
        : fill > 0.6 ? RING_COLOR_YELLOW
        : fill > 0.01 ? RING_COLOR_CYAN
        : RING_COLOR_IDLE
      if (ringColor !== lastRingColorRef.current) {
        lastRingColorRef.current = ringColor
        if (ringFillRef.current) {
          ringFillRef.current.style.background = ringColor
        }
      }
      const source = matrix.activeAudioSource ?? 'NONE'
      if (source !== lastSourceRef.current) {
        lastSourceRef.current = source
        if (sourceTagRef.current) {
          sourceTagRef.current.textContent = source
        }
      }

      // ── Next frame ──
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, []) // Empty deps — mount once, run forever

  // ─── STATIC JSX SKELETON — rendered exactly ONCE ──────────────────────
  return (
    <div className="titan-card audio-spectrum-titan" ref={rootRef}>
      {/* Header — static, never changes */}
      <div className="titan-card__header">
        <div className="titan-card__title">
          <SpectrumBarsIcon size={18} color="var(--accent-primary)" />
          <span>AUDIO SPECTRUM</span>
          <span className="titan-card__subtitle">32 BANDS</span>
        </div>
        <div className="titan-card__status">
          <LiveDotIcon size={10} color="var(--accent-success)" />
          <span>LIVE</span>
        </div>
      </div>

      {/* Visualizer — canvas replaces 32 DOM bars + 32 peaks */}
      <div className="audio-spectrum-titan__visualizer">
        {/* Frequency labels — static, rendered once */}
        <div className="audio-spectrum-titan__freq-labels">
          {FREQ_LABELS.map(({ label, freq }, idx) => (
            <div
              key={label}
              className="audio-spectrum-titan__freq-label"
              style={{ left: FREQ_LABEL_POSITIONS[idx] }}
              title={freq}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Canvas — 32 bars + peaks drawn by RAF, zero DOM mutations per frame */}
        <canvas ref={canvasRef} className="audio-spectrum-titan__canvas" />
      </div>

      {/* Stats bar — text updated by RAF via dirty-checked refs */}
      <div className="audio-spectrum-titan__stats">
        {/* BPM */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">BPM</span>
          <span className="audio-spectrum-titan__stat-value" ref={statBpmRef}>--</span>
          <div className="audio-spectrum-titan__confidence-bar">
            <div className="audio-spectrum-titan__confidence-fill" ref={statConfidenceRef} />
          </div>
        </div>

        {/* Energy */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">ENERGY</span>
          <span className="audio-spectrum-titan__stat-value" ref={statEnergyValueRef}>0%</span>
          <div className="audio-spectrum-titan__energy-bar">
            <div className="audio-spectrum-titan__energy-fill" ref={statEnergyFillRef} />
          </div>
        </div>

        {/* Spectral Flux */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">FLUX</span>
          <span className="audio-spectrum-titan__stat-value" ref={statFluxValueRef}>LOW</span>
          <div className="audio-spectrum-titan__flux-bar">
            <div className="audio-spectrum-titan__flux-fill" ref={statFluxFillRef} />
          </div>
        </div>

        {/* Dominant */}
        <div className="audio-spectrum-titan__stat">
          <span className="audio-spectrum-titan__stat-label">DOMINANT</span>
          <span
            className="audio-spectrum-titan__stat-value audio-spectrum-titan__stat-value--dominant"
            ref={statDominantRef}
          >
            --
          </span>
        </div>

        {/* Energy Distribution */}
        <div className="audio-spectrum-titan__stat audio-spectrum-titan__stat--distribution">
          <span className="audio-spectrum-titan__stat-label">DISTRIBUTION</span>
          <div className="audio-spectrum-titan__distribution">
            <div className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--sub" ref={distSubRef} />
            <div className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--bass" ref={distBassRef} />
            <div className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--mid" ref={distMidRef} />
            <div className="audio-spectrum-titan__dist-segment audio-spectrum-titan__dist-segment--high" ref={distHighRef} />
          </div>
        </div>

        {/* WAVE 3403: Ring Buffer Gauge — fill indicator mutated by RAF */}
        <div className="audio-spectrum-titan__stat audio-spectrum-titan__stat--ring-buffer">
          <span className="audio-spectrum-titan__stat-label">RING BUFFER</span>
          <div className="audio-spectrum-titan__ring-gauge">
            <div className="audio-spectrum-titan__ring-fill" ref={ringFillRef} />
          </div>
          <span className="audio-spectrum-titan__stat-value" ref={ringLabelRef}>0%</span>
          <span className="audio-spectrum-titan__source-tag" ref={sourceTagRef}>NONE</span>
        </div>
      </div>
    </div>
  )
})

AudioSpectrumTitan.displayName = 'AudioSpectrumTitan'

export default AudioSpectrumTitan
