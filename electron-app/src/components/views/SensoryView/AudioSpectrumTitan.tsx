/**
 * 🎵 AUDIO SPECTRUM TITAN - WAVE UX-3: THE GC PAUSE ANNIHILATION
 * 
 * ARCHITECTURE: Imperative RAF engine — ZERO React re-renders, ZERO GC pressure.
 * 
 * React renders the static DOM skeleton exactly ONCE on mount.
 * A requestAnimationFrame loop reads the Zustand store imperatively via getState()
 * and mutates DOM elements directly through refs.
 * 
 * Memory model:
 * - Pre-allocated Float64Arrays for bands, peaks, counters (no per-frame allocation)
 * - Pre-computed color strings assigned at mount (no per-frame string creation)
 * - All style mutations via element.style.height / .bottom / .width (no object allocation)
 * - Stats text updated via textContent (no JSX reconciliation)
 * 
 * Result: 0 renders/sec, 0 GC pauses, pure 60fps DOM manipulation.
 */

import React, { memo, useRef, useEffect } from 'react'
import { getTransientTruth } from '../../../stores/transientStore'
import { SpectrumBarsIcon, LiveDotIcon } from '../../icons/LuxIcons'
import './AudioSpectrumTitan.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const BAND_COUNT = 32
const PEAK_HOLD_FRAMES = 30
const PEAK_DECAY_RATE = 0.02

const FREQ_LABELS = [
  { label: 'SUB', position: 0, freq: '20-60Hz' },
  { label: 'BASS', position: 4, freq: '60-250Hz' },
  { label: 'LOW-MID', position: 10, freq: '250-500Hz' },
  { label: 'MID', position: 16, freq: '500Hz-2kHz' },
  { label: 'HIGH-MID', position: 22, freq: '2-6kHz' },
  { label: 'AIR', position: 28, freq: '6-20kHz' },
]

const SPECTRUM_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#22d3ee',
  '#10b981', '#f59e0b', '#ef4444',
]

// Pre-computed: color for each of the 32 bands (allocated once, never again)
const BAND_COLORS: string[] = new Array(BAND_COUNT)
for (let i = 0; i < BAND_COUNT; i++) {
  const segment = (i / BAND_COUNT) * (SPECTRUM_COLORS.length - 1)
  BAND_COLORS[i] = SPECTRUM_COLORS[Math.floor(segment)]
}

// Pre-computed: frequency label left positions as CSS strings
const FREQ_LABEL_POSITIONS = FREQ_LABELS.map(f => `${(f.position / BAND_COUNT) * 100}%`)

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL POINTS SCRATCH BUFFER — 8 floats, allocated once
// ═══════════════════════════════════════════════════════════════════════════
const _cp = new Float64Array(8)

// ═══════════════════════════════════════════════════════════════════════════
// ZERO-ALLOC INTERPOLATION — mutates target buffer in-place
// ═══════════════════════════════════════════════════════════════════════════

function interpolateTo32BandsInPlace(
  bass: number, mid: number, high: number,
  target: Float64Array, time: number
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
// ENERGY GRADIENT STRINGS — pre-computed, never allocated per frame
// ═══════════════════════════════════════════════════════════════════════════
const ENERGY_GRADIENT_HIGH = 'linear-gradient(90deg, #f97316, #ef4444)'
const ENERGY_GRADIENT_NORMAL = 'linear-gradient(90deg, #22c55e, #10b981)'

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT — renders ONCE, then RAF takes over
// ═══════════════════════════════════════════════════════════════════════════

export const AudioSpectrumTitan: React.FC = memo(() => {
  // ─── DOM Refs ──────────────────────────────────────────────────────────
  const barsRef = useRef<(HTMLDivElement | null)[]>(new Array(BAND_COUNT).fill(null))
  const peaksRef = useRef<(HTMLDivElement | null)[]>(new Array(BAND_COUNT).fill(null))
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Stats text refs
  const statBpmRef = useRef<HTMLSpanElement | null>(null)
  const statConfidenceRef = useRef<HTMLDivElement | null>(null)
  const statEnergyValueRef = useRef<HTMLSpanElement | null>(null)
  const statEnergyFillRef = useRef<HTMLDivElement | null>(null)
  const statFluxValueRef = useRef<HTMLSpanElement | null>(null)
  const statFluxFillRef = useRef<HTMLDivElement | null>(null)
  const statDominantRef = useRef<HTMLSpanElement | null>(null)

  // Distribution segment refs
  const distSubRef = useRef<HTMLDivElement | null>(null)
  const distBassRef = useRef<HTMLDivElement | null>(null)
  const distMidRef = useRef<HTMLDivElement | null>(null)
  const distHighRef = useRef<HTMLDivElement | null>(null)

  // ─── Ref assignment callbacks (stable, never re-created) ───────────────
  const barRefCallbacks = useRef<((el: HTMLDivElement | null) => void)[]>([])
  const peakRefCallbacks = useRef<((el: HTMLDivElement | null) => void)[]>([])

  if (barRefCallbacks.current.length === 0) {
    for (let i = 0; i < BAND_COUNT; i++) {
      const idx = i
      barRefCallbacks.current[i] = (el) => { barsRef.current[idx] = el }
      peakRefCallbacks.current[i] = (el) => { peaksRef.current[idx] = el }
    }
  }

  // ─── Pre-allocated scratch buffers ─────────────────────────────────────
  const bandsBuffer = useRef(new Float64Array(BAND_COUNT))
  const peakValues = useRef(new Float64Array(BAND_COUNT))
  const peakCounters = useRef(new Float64Array(BAND_COUNT))
  // Track last beat state to toggle class without React
  const lastBeatRef = useRef(false)

  // 🎵 WAVE 3250: TEMPORAL LERP — Suavizar transiciones entre updates IPC (22Hz→60fps)
  // Los datos de audio llegan cada ~45ms. Sin LERP, las barras se congelan 2-3 frames.
  // Con LERP exponencial local, cada frame RAF interpola suavemente hacia el valor target.
  const smoothBass = useRef(0)
  const smoothMid = useRef(0)
  const smoothHigh = useRef(0)
  const AUDIO_LERP = 0.35  // Converge en ~5 frames (83ms) — idéntico al 3D

  // ─── THE RAF ENGINE ────────────────────────────────────────────────────
  useEffect(() => {
    let frameId: number

    const tick = (now: number) => {
      // 🔥 WAVE 2405: Read TRANSIENT store — updated every IPC frame
      // 🎵 WAVE 3250: Ahora actualizado a 22Hz (hot-frame incluye audio bands)
      const truth = getTransientTruth()
      if (!truth) { frameId = requestAnimationFrame(tick); return }
      const audio = truth.sensory.audio
      const beat = truth.sensory.beat

      // 🎵 WAVE 3250: TEMPORAL LERP — exponential smoothing local
      smoothBass.current += (audio.bass - smoothBass.current) * AUDIO_LERP
      smoothMid.current += (audio.mid - smoothMid.current) * AUDIO_LERP
      smoothHigh.current += (audio.high - smoothHigh.current) * AUDIO_LERP

      // ── Interpolate bands (zero allocation) ──
      interpolateTo32BandsInPlace(
        smoothBass.current, smoothMid.current, smoothHigh.current,
        bandsBuffer.current, now
      )

      const bands = bandsBuffer.current
      const peaks = peakValues.current
      const counters = peakCounters.current

      // ── Peak hold + DOM mutation in one pass ──
      let fluxAccum = 0
      let subAccum = 0, bassAccum = 0, midAccum = 0, highAccum = 0

      for (let i = 0; i < BAND_COUNT; i++) {
        const value = bands[i]

        // Peak logic
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

        // ── DIRECT DOM MUTATION ──
        const bar = barsRef.current[i]
        if (bar) bar.style.height = `${(value * 100) | 0}%`

        const peak = peaksRef.current[i]
        if (peak) peak.style.bottom = `${(peaks[i] * 100) | 0}%`
      }

      // ── Beat pulse class toggle ──
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

      // ── Stats: BPM ──
      if (statBpmRef.current) {
        statBpmRef.current.textContent = beat.bpm ? String(beat.bpm) : '--'
      }
      if (statConfidenceRef.current) {
        statConfidenceRef.current.style.width = `${((beat.confidence || 0) * 100) | 0}%`
      }

      // ── Stats: Energy ──
      const energyPct = (audio.energy * 100) | 0
      if (statEnergyValueRef.current) {
        statEnergyValueRef.current.textContent = `${energyPct}%`
      }
      if (statEnergyFillRef.current) {
        statEnergyFillRef.current.style.width = `${energyPct}%`
        statEnergyFillRef.current.style.background =
          audio.energy > 0.7 ? ENERGY_GRADIENT_HIGH : ENERGY_GRADIENT_NORMAL
      }

      // ── Stats: Spectral Flux ──
      let flux = (fluxAccum / BAND_COUNT) * 5
      if (flux > 1) flux = 1
      if (statFluxValueRef.current) {
        statFluxValueRef.current.textContent =
          flux > 0.6 ? 'HIGH' : flux > 0.3 ? 'MED' : 'LOW'
      }
      if (statFluxFillRef.current) {
        statFluxFillRef.current.style.width = `${(flux * 100) | 0}%`
      }

      // ── Stats: Dominant band ──
      const eSub = subAccum / 4
      const eBass = bassAccum / 6
      const eMid = midAccum / 10
      const eHigh = highAccum / 12
      if (statDominantRef.current) {
        const max = Math.max(eSub, eBass, eMid, eHigh)
        statDominantRef.current.textContent =
          max === eSub ? 'SUB' : max === eBass ? 'BASS' : max === eMid ? 'MID' : 'HIGH'
      }

      // ── Stats: Distribution bars ──
      if (distSubRef.current) distSubRef.current.style.width = `${(eSub * 100) | 0}%`
      if (distBassRef.current) distBassRef.current.style.width = `${(eBass * 100) | 0}%`
      if (distMidRef.current) distMidRef.current.style.width = `${(eMid * 100) | 0}%`
      if (distHighRef.current) distHighRef.current.style.width = `${(eHigh * 100) | 0}%`

      // ── Next frame ──
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
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

      {/* Visualizer */}
      <div className="audio-spectrum-titan__visualizer">
        {/* Frequency labels — static */}
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

        {/* 32 Bars — rendered once, mutated by RAF */}
        <div className="audio-spectrum-titan__bars">
          {BAND_COLORS.map((color, i) => (
            <div key={i} className="audio-spectrum-titan__bar-container">
              <div
                className="audio-spectrum-titan__peak"
                ref={peakRefCallbacks.current[i]}
                style={{ bottom: '0%', backgroundColor: color }}
              />
              <div
                className="audio-spectrum-titan__bar"
                ref={barRefCallbacks.current[i]}
                style={{ height: '0%', backgroundColor: color }}
              />
            </div>
          ))}
        </div>

        {/* Grid lines — static */}
        <div className="audio-spectrum-titan__grid">
          <div className="audio-spectrum-titan__grid-line" style={{ bottom: '25%' }}>
            <span>25%</span>
          </div>
          <div className="audio-spectrum-titan__grid-line" style={{ bottom: '50%' }}>
            <span>50%</span>
          </div>
          <div className="audio-spectrum-titan__grid-line" style={{ bottom: '75%' }}>
            <span>75%</span>
          </div>
        </div>
      </div>

      {/* Stats bar — text updated by RAF via refs */}
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
      </div>
    </div>
  )
})

AudioSpectrumTitan.displayName = 'AudioSpectrumTitan'

export default AudioSpectrumTitan
