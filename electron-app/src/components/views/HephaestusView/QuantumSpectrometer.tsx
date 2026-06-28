/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️ QUANTUM SPECTROMETER — WAVE 7024: PROJECT GREENFIELD
 * Canvas 2D Phase Visualizer — "Phosphor Noir" Aether Glass Architecture
 *
 * Replaces HephRadar.tsx entirely. Renders the evaluated phase distribution
 * as a living oscilloscope waveform (the "Ariadne Thread") at a strict 44Hz
 * tick rate, matching the Aether Glass engine cadence.
 *
 * Render Layers:
 *   L0 — Math Grid (reticle + zero axis)
 *   L1 — Ariadne Thread (Catmull-Rom spline through fixture dimmer values)
 *   L2 — Fixture Nodes (phosphor glyphs with strobe-gated bloom)
 *   L3 — Target Lock (selection reticle)
 *   L4 — HUD Telemetry (corner readouts + transport)
 *
 * @module views/HephaestusView/QuantumSpectrometer
 * @version WAVE 7024
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { PreviewFixtureState, HephPreviewState, HephPreviewData } from './useHephPreview'
import type { PhaseConfigPro } from '../../../core/hephaestus/phase/PhaseConfigPro'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — Phosphor Noir Palette
// ═══════════════════════════════════════════════════════════════════════════

const FPS_44_MS = 1000 / 44
const FPS_IDLE_MS = 1000 / 12  // ── P1-B: Idle animations at 12 Hz, not 44 Hz

const BG_VOID = '#06070C'
const BG_SUBSTRATE = '#08080D'

const GRID_COLOR = 'rgba(120, 140, 180, 0.06)'
const GRID_AXIS_COLOR = 'rgba(120, 140, 180, 0.16)'
const GRID_DIVISIONS = 8

const WAVE_COLOR = '#FF6B2B'
const WAVE_GLOW = 'rgba(255, 107, 43, 0.4)'
const WAVE_FILL_TOP = 'rgba(255, 107, 43, 0.18)'
const WAVE_FILL_BOTTOM = 'rgba(255, 107, 43, 0)'

const LOCK_COLOR = '#00E5FF'

const READOUT_FONT = '11px "JetBrains Mono", "IBM Plex Mono", monospace'
const READOUT_LABEL = 'rgba(160, 170, 190, 0.4)'
const READOUT_VALUE = '#FF6B2B'
const HEADER_FONT = '10px "Rajdhani", "Eurostile", "Orbitron", sans-serif'

const NODE_RADIUS = 4
const NODE_HIT_RADIUS = 12
const Y_MARGIN_RATIO = 0.1
const TRANSPORT_HEIGHT = 36

// ── P2-C: Per-instance buffers (were module-level globals) ────────────────
const MAX_FIXTURES = 512
const ARIADNE_SEGMENTS = 16
const MAX_SAMPLES = (MAX_FIXTURES - 1) * ARIADNE_SEGMENTS + 1

interface SpectrometerBuffers {
  nodePositions: NodePosition[]
  nodePositionsCount: number
  sampleX: Float64Array
  sampleY: Float64Array
  sampleCount: number
}

function createBuffers(): SpectrometerBuffers {
  return {
    nodePositions: Array.from({ length: MAX_FIXTURES }, () => ({
      x: 0, y: 0, fixture: null as unknown as PreviewFixtureState,
    })),
    nodePositionsCount: 0,
    sampleX: new Float64Array(MAX_SAMPLES),
    sampleY: new Float64Array(MAX_SAMPLES),
    sampleCount: 0,
  }
}

// ── P2#2: shadowBlur only for small rigs (≤ SHADOW_BLUR_THRESHOLD) ──────
const SHADOW_BLUR_THRESHOLD = 60

// ═══════════════════════════════════════════════════════════════════════════
// SPATIAL MATH — Pure functions for fixture positioning
// ═══════════════════════════════════════════════════════════════════════════

interface NodePosition {
  x: number
  y: number
  fixture: PreviewFixtureState
}

type ScopeType = 'DIMMER' | 'PAN' | 'TILT'

function computeNodePositions(
  buf: SpectrometerBuffers,
  fixtures: readonly PreviewFixtureState[],
  w: number,
  h: number,
  activeScope: ScopeType,
): readonly NodePosition[] {
  const count = Math.min(fixtures.length, MAX_FIXTURES)
  if (count === 0) { buf.nodePositionsCount = 0; return buf.nodePositions }
  const spacing = w / (count + 1)
  const yMargin = h * Y_MARGIN_RATIO
  const usableH = h - yMargin * 2

  for (let i = 0; i < count; i++) {
    const fixture = fixtures[i]
    const np = buf.nodePositions[i]
    np.x = spacing * (i + 1)
    let val = 0
    if (activeScope === 'DIMMER') val = fixture.dimmer
    else if (activeScope === 'PAN') val = fixture.pan
    else if (activeScope === 'TILT') val = fixture.tilt
    const valNorm = val / 255
    np.y = yMargin + (1 - valNorm) * usableH
    np.fixture = fixture
  }
  buf.nodePositionsCount = count
  return buf.nodePositions as readonly NodePosition[]
}

// ═══════════════════════════════════════════════════════════════════════════
// STROBE GATE — Deterministic, frame-counter driven
// ═══════════════════════════════════════════════════════════════════════════

// Returns 1 (flash on) or 0 (flash off). Binary square wave — psycho strobe.
function strobeGate(strobe: number, frameCount: number): number {
  if (strobe <= 0) return 1
  // Map 0-255 to 1-25 Hz. At 44fps, frameCount increments ~44/s.
  const hz = (strobe / 255) * 25
  const periodFrames = 44 / hz // frames per full cycle
  const phase = (frameCount % periodFrames) / periodFrames
  // 50% duty cycle — hard on/off
  return phase < 0.5 ? 1 : 0
}

// Global strobe flash: returns intensity 0-1 if any fixture is strobing this frame
function computeGlobalStrobeFlash(buf: SpectrometerBuffers, positions: readonly NodePosition[], frameCount: number): number {
  let maxFlash = 0
  for (let i = 0; i < buf.nodePositionsCount; i++) {
    const pos = positions[i]
    if (pos.fixture.strobe <= 0) continue
    const gate = strobeGate(pos.fixture.strobe, frameCount)
    if (gate > 0) {
      maxFlash = Math.max(maxFlash, pos.fixture.dimmer / 255)
    }
  }
  return maxFlash
}

// ═══════════════════════════════════════════════════════════════════════════
// CATMULL-ROM SPLINE — Smooth wave through fixture points
// ═══════════════════════════════════════════════════════════════════════════

function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function drawAriadneThread(
  buf: SpectrometerBuffers,
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  w: number,
  h: number,
  frameCount: number,
  strobeFlash: number,
) {
  if (buf.nodePositionsCount < 2) {
    if (buf.nodePositionsCount === 1) {
      const p = positions[0]
      ctx.fillStyle = WAVE_COLOR
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  // ── P2#2: Write into pre-allocated Float64Arrays (zero-alloc) ────────
  const SEGMENTS = ARIADNE_SEGMENTS
  const yFloor = h * (1 - Y_MARGIN_RATIO)
  const yCeil = h * Y_MARGIN_RATIO
  const clampY = (rawY: number) => Math.max(yCeil, Math.min(rawY, yFloor))

  let si = 0
  for (let i = 0; i < buf.nodePositionsCount - 1; i++) {
    const p0 = positions[Math.max(0, i - 1)]
    const p1 = positions[i]
    const p2 = positions[i + 1]
    const p3 = positions[Math.min(buf.nodePositionsCount - 1, i + 2)]

    for (let j = 0; j < SEGMENTS; j++) {
      const t = j / SEGMENTS
      buf.sampleX[si] = catmullRom(p0.x, p1.x, p2.x, p3.x, t)
      buf.sampleY[si] = clampY(catmullRom(p0.y, p1.y, p2.y, p3.y, t))
      si++
    }
  }
  buf.sampleX[si] = positions[buf.nodePositionsCount - 1].x
  buf.sampleY[si] = clampY(positions[buf.nodePositionsCount - 1].y)
  si++
  buf.sampleCount = si

  // ── Strobe-driven wave flash: boost brightness when strobing ──
  const flashBoost = 1 + strobeFlash * 1.5

  // ── Fill membrane (energy under the wave) ──
  const yBaseline = yFloor
  ctx.beginPath()
  ctx.moveTo(buf.sampleX[0], yBaseline)
  for (let s = 0; s < buf.sampleCount; s++) {
    ctx.lineTo(buf.sampleX[s], buf.sampleY[s])
  }
  ctx.lineTo(buf.sampleX[buf.sampleCount - 1], yBaseline)
  ctx.closePath()
  const fillGrad = ctx.createLinearGradient(0, 0, 0, yBaseline)
  fillGrad.addColorStop(0, WAVE_FILL_TOP)
  fillGrad.addColorStop(1, WAVE_FILL_BOTTOM)
  ctx.fillStyle = fillGrad
  ctx.globalAlpha = Math.min(1, flashBoost)
  ctx.fill()
  ctx.globalAlpha = 1

  // ── Glow underlay (wide soft) ──
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = WAVE_GLOW
  ctx.lineWidth = 6 + strobeFlash * 4
  ctx.beginPath()
  ctx.moveTo(buf.sampleX[0], buf.sampleY[0])
  for (let s = 0; s < buf.sampleCount; s++) {
    ctx.lineTo(buf.sampleX[s], buf.sampleY[s])
  }
  ctx.stroke()
  ctx.restore()

  // ── Crisp core line ──
  ctx.strokeStyle = WAVE_COLOR
  ctx.lineWidth = 2 + strobeFlash * 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(buf.sampleX[0], buf.sampleY[0])
  for (let s = 0; s < buf.sampleCount; s++) {
    ctx.lineTo(buf.sampleX[s], buf.sampleY[s])
  }
  ctx.stroke()
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 0 — MATH GRID
// ═══════════════════════════════════════════════════════════════════════════

function drawMathGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const stepX = w / GRID_DIVISIONS
  const stepY = h / GRID_DIVISIONS

  // Fine grid
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1
  for (let i = 0; i <= GRID_DIVISIONS; i++) {
    const x = Math.round(i * stepX) + 0.5
    const y = Math.round(i * stepY) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  // Zero axis (center horizontal)
  ctx.strokeStyle = GRID_AXIS_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()
  ctx.setLineDash([])
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2 — FIXTURE NODES
// ═══════════════════════════════════════════════════════════════════════════

function drawFixtureNodes(
  buf: SpectrometerBuffers,
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  frameCount: number,
) {
  // ── P2#2: Adaptive shadowBlur — only for small rigs to avoid GPU bottleneck ──
  const useShadow = buf.nodePositionsCount <= SHADOW_BLUR_THRESHOLD

  for (let i = 0; i < buf.nodePositionsCount; i++) {
    const pos = positions[i]
    const f = pos.fixture
    const gate = strobeGate(f.strobe, frameCount)
    const dimmerAlpha = f.dimmer / 255
    // Binary strobe: full brightness when on, near-zero when off
    const alpha = f.strobe > 0 ? dimmerAlpha * gate : dimmerAlpha

    let r = isNaN(f.r) ? 0 : f.r
    let g = isNaN(f.g) ? 0 : f.g
    let b = isNaN(f.b) ? 0 : f.b

    if (f.white > 0) {
      r = Math.min(255, r + f.white * 0.7)
      g = Math.min(255, g + f.white * 0.95)
      b = Math.min(255, b + f.white * 0.85)
    }
    if (f.amber > 0) {
      r = Math.min(255, r + f.amber * 0.9)
      g = Math.min(255, g + f.amber * 0.5)
    }
    if (r === 0 && g === 0 && b === 0 && f.dimmer > 0) {
      r = 255; g = 230; b = 200
    }

    const colorStr = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 1)`

    // ── Drop line (plumb line to X axis) ──
    ctx.strokeStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha * 0.2})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.lineTo(pos.x, pos.y + 30)
    ctx.stroke()

    // ── Glow halo ──
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    if (useShadow) {
      ctx.shadowBlur = 15 + (f.strobe > 0 && gate > 0 ? 25 : 0)
      ctx.shadowColor = colorStr
    }
    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha * 0.5})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, NODE_RADIUS * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // ── Strobe flash burst: brightness pulse on strobe-on frames (preserves color) ──
    if (f.strobe > 0 && gate > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${dimmerAlpha * 0.5})`
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, NODE_RADIUS * 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // ── Core node ──
    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2)
    ctx.fill()

    // ── Inner bright spot ──
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, NODE_RADIUS * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3 — TARGET LOCK
// ═══════════════════════════════════════════════════════════════════════════

function drawTargetLock(
  buf: SpectrometerBuffers,
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  selectedFixtureId: string | null,
  frameCount: number,
) {
  if (!selectedFixtureId) return
  let pos: NodePosition | null = null
  for (let i = 0; i < buf.nodePositionsCount; i++) {
    if (positions[i].fixture.fixtureId === selectedFixtureId) {
      pos = positions[i]
      break
    }
  }
  if (!pos) return

  const pulse = 1 + Math.sin(frameCount * 0.15) * 0.15
  const ringR = NODE_RADIUS * 3 * pulse

  ctx.save()
  ctx.strokeStyle = LOCK_COLOR
  ctx.lineWidth = 1.5
  ctx.shadowBlur = 8
  ctx.shadowColor = LOCK_COLOR

  // Rotating reticle brackets (4 arcs)
  const rot = frameCount * 0.02
  for (let i = 0; i < 4; i++) {
    const a0 = rot + (i * Math.PI / 2) + 0.3
    const a1 = rot + (i * Math.PI / 2) + Math.PI / 2 - 0.3
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, ringR, a0, a1)
    ctx.stroke()
  }
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4 — HUD TELEMETRY
// ═══════════════════════════════════════════════════════════════════════════

function drawHUD(
  buf: SpectrometerBuffers,
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  selectedFixtureId: string | null,
  preview: HephPreviewData,
  w: number,
  h: number,
  durationMs: number,
) {
  const pad = 10

  // ── Top-right: Phase signature ──
  ctx.textAlign = 'right'
  ctx.fillStyle = READOUT_LABEL
  const fc = buf.nodePositionsCount
  ctx.fillText(`NODES: ${fc}`, w - pad, pad)

  // ── Bottom-left: Ballistic readout for selected fixture ──
  let selPos: NodePosition | undefined
  if (selectedFixtureId) {
    for (let i = 0; i < buf.nodePositionsCount; i++) {
      if (positions[i].fixture.fixtureId === selectedFixtureId) {
        selPos = positions[i]
        break
      }
    }
  }
  if (!selPos && buf.nodePositionsCount > 0) selPos = positions[0]

  if (selPos) {
    const f = selPos.fixture
    ctx.font = READOUT_FONT
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'

    let yCur = h - pad
    const lineH = 14

    ctx.fillStyle = READOUT_LABEL
    ctx.fillText('STR', pad, yCur)
    ctx.fillStyle = f.strobe > 0 ? '#FF1744' : READOUT_LABEL
    ctx.fillText(` ${f.strobe.toString().padStart(3, ' ')}`, pad + 26, yCur)
    yCur -= lineH

    ctx.fillStyle = READOUT_LABEL
    ctx.fillText('DIM', pad, yCur)
    ctx.fillStyle = READOUT_VALUE
    ctx.fillText(` ${f.dimmer.toString().padStart(3, ' ')}`, pad + 26, yCur)
    yCur -= lineH

    ctx.fillStyle = READOUT_LABEL
    ctx.fillText('TILT', pad, yCur)
    ctx.fillStyle = READOUT_VALUE
    ctx.fillText(` ${f.tilt.toString().padStart(3, ' ')}`, pad + 26, yCur)
    yCur -= lineH

    ctx.fillStyle = READOUT_LABEL
    ctx.fillText('PAN', pad, yCur)
    ctx.fillStyle = READOUT_VALUE
    ctx.fillText(` ${f.pan.toString().padStart(3, ' ')}`, pad + 26, yCur)

    // ── Phase offset (hero metric) ──
    yCur -= lineH + 4
    ctx.fillStyle = LOCK_COLOR
    ctx.font = 'bold 12px "JetBrains Mono", monospace'
    const phaseDeg = ((f.phaseOffsetMs / durationMs) * 360).toFixed(1)
    ctx.fillText(`φ ${f.phaseOffsetMs >= 0 ? '+' : ''}${f.phaseOffsetMs.toFixed(0)}ms · ${phaseDeg}°`, pad, yCur)
  }

  // ── Bottom-right: Time + transport info ──
  ctx.font = READOUT_FONT
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  const currentSec = (preview.playheadMs / 1000).toFixed(2)
  const totalSec = (durationMs / 1000).toFixed(1)
  ctx.fillStyle = READOUT_VALUE
  ctx.fillText(`${currentSec}s / ${totalSec}s`, w - pad, h - pad)
  ctx.fillStyle = READOUT_LABEL
  ctx.fillText(`F:${preview.frameCount}`, w - pad, h - pad - 14)

  // ── Progress bar ──
  const barH = 2
  const barY = h - barH
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.fillRect(0, barY, w, barH)
  ctx.fillStyle = WAVE_COLOR
  ctx.fillRect(0, barY, w * preview.progress, barH)
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1 — SPECTRUM FIELD (WAVE 7029: Harmonic Spectrum)
// ═══════════════════════════════════════════════════════════════════════════

function drawSpectrumField(ctx: CanvasRenderingContext2D, w: number, h: number, phaseConfig: PhaseConfigPro | null, frameCount: number) {
  if (!phaseConfig) return;
  const BARS = 64;
  const barWidth = w / BARS;
  const { wings = 1, shuffle = 0, blocks = 1, symmetry = 'linear' } = phaseConfig;

  ctx.fillStyle = 'rgba(124, 77, 255, 0.12)';

  for (let i = 0; i < BARS; i++) {
    // Normalizar U de 0 a 1 (espacio de PhaseConfigPro)
    const u = i / (BARS - 1);

    // Aplicar simetría — misma matemática que applySymmetry() en PhaseConfigPro
    let s = u;
    if (symmetry === 'mirror') s = 1 - Math.abs(2 * u - 1);       // pico al centro
    else if (symmetry === 'center-out') s = Math.abs(2 * u - 1);   // valle al centro

    // Cuantización por bloques
    if (blocks > 1) {
      s = Math.floor(s * (16 / blocks)) / (16 / blocks);
    }

    // Mapear s (0..1) a nx (-1..1) para el cálculo armónico
    const nx = s * 2 - 1;

    let energy = Math.pow(Math.cos(nx * Math.PI * wings), 4);

    const noise = (Math.sin(i * 12.9898 + frameCount * 0.1) * 43758.5453) % 1;
    energy = energy * (1 - shuffle) + Math.abs(noise) * shuffle;

    const barHeight = energy * (h * 0.4);
    ctx.fillRect(i * barWidth, h - barHeight, barWidth - 1, barHeight);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface QuantumSpectrometerProps {
  preview: HephPreviewState
  previewDataRef: React.RefObject<HephPreviewData>
  durationMs: number
  selectedFixtureId: string | null
  onSelectFixture: (id: string | null) => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (ms: number) => void
  phaseConfig?: PhaseConfigPro | null
}

export const QuantumSpectrometer: React.FC<QuantumSpectrometerProps> = ({
  preview,
  previewDataRef,
  durationMs,
  selectedFixtureId,
  onSelectFixture,
  onPlay,
  onPause,
  onStop,
  onSeek,
  phaseConfig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const frameCounterRef = useRef<number>(0)
  const buffersRef = useRef<SpectrometerBuffers>(createBuffers())

  // ── P1-B: Cached dimensions (ResizeObserver, no getBoundingClientRect per frame)
  const dimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  // ── P1-B: Cached vignette gradient (recreate only on resize)
  const vignetteRef = useRef<CanvasGradient | null>(null)
  const vignetteDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })

  // ── P1-B: Dirty flag — forces a render even when paused (seek, clip change, etc.)
  const dirtyRef = useRef<boolean>(true)

  // ── P1-B: isPlaying ref for the render loop
  const isPlayingRef = useRef(preview.isPlaying)
  isPlayingRef.current = preview.isPlaying

  const [activeScope, setActiveScope] = useState<ScopeType>('DIMMER')
  const scopeRef = useRef(activeScope)
  scopeRef.current = activeScope

  const phaseRef = useRef(phaseConfig)
  phaseRef.current = phaseConfig

  // Ref mirrors for the hot loop (avoid stale closures without re-subscribing)
  const durationRef = useRef(durationMs)
  const selectedRef = useRef(selectedFixtureId)

  durationRef.current = durationMs
  selectedRef.current = selectedFixtureId

  // ── P1-B: Mark dirty on state changes (seek, pause, scope switch, selection) ──
  useEffect(() => { dirtyRef.current = true }, [preview, selectedFixtureId, activeScope, phaseConfig])

  // ── P1-B: ResizeObserver — replaces per-frame getBoundingClientRect ──
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height - TRANSPORT_HEIGHT)
      if (w > 0 && h > 0 && (w !== dimsRef.current.w || h !== dimsRef.current.h)) {
        dimsRef.current = { w, h }
        dirtyRef.current = true  // force redraw on resize
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // ── P1-B: Gated Render Loop — 44 Hz when playing, 12 Hz when idle ──
  useEffect(() => {
    const render = () => {
      const now = performance.now()
      const elapsed = now - lastFrameTimeRef.current

      // ── P1-B: Dynamic throttle — 44 Hz when playing, 12 Hz when idle ──
      const isPlaying = isPlayingRef.current
      const minInterval = isPlaying ? FPS_44_MS : FPS_IDLE_MS

      if (elapsed < minInterval) {
        rafRef.current = requestAnimationFrame(render)
        return
      }
      lastFrameTimeRef.current = now - (elapsed % minInterval)

      // ── P1-B: Skip render entirely if paused and not dirty ──
      if (!isPlaying && !dirtyRef.current) {
        rafRef.current = requestAnimationFrame(render)
        return
      }
      dirtyRef.current = false  // consume dirty flag

      const canvas = canvasRef.current
      if (!canvas) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      const { w, h } = dimsRef.current
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
        dirtyRef.current = true  // canvas was resized, need another paint
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      const pv = previewDataRef.current
      const dur = durationRef.current
      const selId = selectedRef.current
      const fc = frameCounterRef.current

      // ── Clear with substrate ──
      ctx.fillStyle = BG_VOID
      ctx.fillRect(0, 0, w, h)

      // ── P1-B: Cached vignette — recreate only when dimensions change ──
      if (!vignetteRef.current || vignetteDimsRef.current.w !== w || vignetteDimsRef.current.h !== h) {
        const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7)
        vignette.addColorStop(0, BG_SUBSTRATE)
        vignette.addColorStop(1, BG_VOID)
        vignetteRef.current = vignette
        vignetteDimsRef.current = { w, h }
      }
      ctx.fillStyle = vignetteRef.current
      ctx.fillRect(0, 0, w, h)

      const buf = buffersRef.current

      // ── Compute spatial positions ──
      const positions = computeNodePositions(buf, pv.fixtures, w, h, scopeRef.current)

      // ── Compute global strobe flash intensity for this frame ──
      const strobeFlash = computeGlobalStrobeFlash(buf, positions, fc)

      // ── L0: Math Grid ──
      drawMathGrid(ctx, w, h)

      // ── L0.5: Spectrum Field (harmonic fingerprint) ──
      drawSpectrumField(ctx, w, h, phaseRef.current ?? null, fc)

      // ── L1: Ariadne Thread (strobe-reactive) ──
      drawAriadneThread(buf, ctx, positions, w, h, fc, strobeFlash)

      // ── L2: Fixture Nodes ──
      drawFixtureNodes(buf, ctx, positions, fc)

      // ── L3: Target Lock ──
      drawTargetLock(buf, ctx, positions, selId, fc)

      // ── L4: HUD ──
      drawHUD(buf, ctx, positions, selId, pv, w, h, dur)

      ctx.restore()
      frameCounterRef.current++
      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Hit-Testing: logical spatial computation on-the-fly ──
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const w = rect.width
    const h = rect.height
    const dur = durationRef.current

    // Seek zone: bottom 12px
    if (my >= h - 12) {
      const ratio = Math.max(0, Math.min(1, mx / w))
      onSeek(ratio * dur)
      return
    }

    // Hit-test against computed positions
    const buf = buffersRef.current
    const fixtures = previewDataRef.current.fixtures
    const positions = computeNodePositions(buf, fixtures, w, h, scopeRef.current)

    let hit: string | null = null
    let hitDist = Infinity

    for (let i = 0; i < buf.nodePositionsCount; i++) {
      const pos = positions[i]
      const dist = Math.hypot(mx - pos.x, my - pos.y)
      if (dist < NODE_HIT_RADIUS && dist < hitDist) {
        hitDist = dist
        hit = pos.fixture.fixtureId
      }
    }

    onSelectFixture(hit)
  }, [onSeek, onSelectFixture])

  return (
    <div className="quantum-spectrometer" ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
        <button
          onClick={() => setActiveScope(s => s === 'DIMMER' ? 'PAN' : s === 'PAN' ? 'TILT' : 'DIMMER')}
          style={{
            background: 'rgba(14, 15, 22, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 107, 43, 0.25)',
            color: '#FF6B2B',
            fontFamily: '"Rajdhani", "Eurostile", sans-serif',
            fontSize: '10px',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
            letterSpacing: '0.12em',
          }}
        >
          SCOPE: {activeScope} ◂
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="quantum-spectrometer__canvas"
        onMouseDown={handleCanvasMouseDown}
        style={{ display: 'block', cursor: 'crosshair' }}
      />
      <div
        className="quantum-spectrometer__transport"
        style={{
          height: `${TRANSPORT_HEIGHT}px`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 10px',
          background: '#0a0a0f',
          borderTop: '1px solid #1a1a22',
          flexShrink: 0,
        }}
      >
        <button
          className="qs-btn"
          onClick={preview.isPlaying ? onPause : onPlay}
          title={preview.isPlaying ? 'Pause' : 'Play'}
          style={{
            background: 'none',
            border: '1px solid #2a2a2a',
            borderRadius: '4px',
            color: preview.isPlaying ? '#FF6B2B' : 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 10px',
            transition: 'all 0.12s ease',
          }}
        >
          {preview.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="qs-btn"
          onClick={onStop}
          title="Stop"
          style={{
            background: 'none',
            border: '1px solid #2a2a2a',
            borderRadius: '4px',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 10px',
            transition: 'all 0.12s ease',
          }}
        >
          ⏹
        </button>
        <div style={{ flex: 1 }} />
        {preview.isPlaying ? (
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#39FF14', letterSpacing: '0.1em' }}>
            ● LIVE
          </span>
        ) : (
          <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
            ◌ PAUSED
          </span>
        )}
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          F:{preview.frameCount}
        </span>
      </div>
    </div>
  )
}

export default QuantumSpectrometer
