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

import React, { useRef, useEffect, useCallback } from 'react'
import type { PreviewFixtureState, HephPreviewState } from './useHephPreview'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — Phosphor Noir Palette
// ═══════════════════════════════════════════════════════════════════════════

const FPS_44_MS = 1000 / 44

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

// ═══════════════════════════════════════════════════════════════════════════
// SPATIAL MATH — Pure functions for fixture positioning
// ═══════════════════════════════════════════════════════════════════════════

interface NodePosition {
  x: number
  y: number
  fixture: PreviewFixtureState
}

function computeNodePositions(
  fixtures: readonly PreviewFixtureState[],
  w: number,
  h: number,
): NodePosition[] {
  if (fixtures.length === 0) return []
  const spacing = w / (fixtures.length + 1)
  const yMargin = h * Y_MARGIN_RATIO
  const usableH = h - yMargin * 2

  return fixtures.map((fixture, i) => {
    const x = spacing * (i + 1)
    const dimmerNorm = fixture.dimmer / 255
    const y = yMargin + (1 - dimmerNorm) * usableH
    return { x, y, fixture }
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// STROBE GATE — Deterministic, frame-counter driven
// ═══════════════════════════════════════════════════════════════════════════

function strobeGate(strobe: number, frameCount: number): number {
  if (strobe <= 0) return 1
  const freq = (strobe / 255) * 0.3
  return Math.sin(frameCount * freq) > 0 ? 1 : 0.1
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
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  w: number,
  h: number,
) {
  if (positions.length < 2) {
    if (positions.length === 1) {
      const p = positions[0]
      ctx.fillStyle = WAVE_COLOR
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  // Build spline sample points
  const pts = positions.map(p => ({ x: p.x, y: p.y }))
  const samples: Array<{ x: number; y: number }> = []
  const SEGMENTS = 16

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]

    for (let j = 0; j < SEGMENTS; j++) {
      const t = j / SEGMENTS
      samples.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
      })
    }
  }
  samples.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y })

  // ── Fill membrane (energy under the wave) ──
  const yBaseline = h * (1 - Y_MARGIN_RATIO)
  ctx.beginPath()
  ctx.moveTo(samples[0].x, yBaseline)
  for (const s of samples) {
    ctx.lineTo(s.x, s.y)
  }
  ctx.lineTo(samples[samples.length - 1].x, yBaseline)
  ctx.closePath()
  const fillGrad = ctx.createLinearGradient(0, 0, 0, yBaseline)
  fillGrad.addColorStop(0, WAVE_FILL_TOP)
  fillGrad.addColorStop(1, WAVE_FILL_BOTTOM)
  ctx.fillStyle = fillGrad
  ctx.fill()

  // ── Glow underlay (wide soft) ──
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = WAVE_GLOW
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(samples[0].x, samples[0].y)
  for (const s of samples) {
    ctx.lineTo(s.x, s.y)
  }
  ctx.stroke()
  ctx.restore()

  // ── Crisp core line ──
  ctx.strokeStyle = WAVE_COLOR
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(samples[0].x, samples[0].y)
  for (const s of samples) {
    ctx.lineTo(s.x, s.y)
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
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  frameCount: number,
) {
  for (const pos of positions) {
    const f = pos.fixture
    const gate = strobeGate(f.strobe, frameCount)
    const dimmerAlpha = f.dimmer / 255
    const alpha = dimmerAlpha * gate

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
    ctx.shadowBlur = 15
    ctx.shadowColor = colorStr
    ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha * 0.5})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, NODE_RADIUS * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

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
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  selectedFixtureId: string | null,
  frameCount: number,
) {
  if (!selectedFixtureId) return
  const pos = positions.find(p => p.fixture.fixtureId === selectedFixtureId)
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
  ctx: CanvasRenderingContext2D,
  positions: readonly NodePosition[],
  selectedFixtureId: string | null,
  preview: HephPreviewState,
  w: number,
  h: number,
  durationMs: number,
) {
  const pad = 10

  // ── Top-left: Scope label ──
  ctx.font = HEADER_FONT
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255, 107, 43, 0.5)'
  ctx.fillText('SCOPE: DIMMER', pad, pad)

  // ── Top-right: Phase signature ──
  ctx.textAlign = 'right'
  ctx.fillStyle = READOUT_LABEL
  const fc = preview.fixtures.length
  ctx.fillText(`NODES: ${fc}`, w - pad, pad)

  // ── Bottom-left: Ballistic readout for selected fixture ──
  const selPos = selectedFixtureId
    ? positions.find(p => p.fixture.fixtureId === selectedFixtureId)
    : positions[0]

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
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface QuantumSpectrometerProps {
  preview: HephPreviewState
  durationMs: number
  selectedFixtureId: string | null
  onSelectFixture: (id: string | null) => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (ms: number) => void
}

export const QuantumSpectrometer: React.FC<QuantumSpectrometerProps> = ({
  preview,
  durationMs,
  selectedFixtureId,
  onSelectFixture,
  onPlay,
  onPause,
  onStop,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const frameCounterRef = useRef<number>(0)

  // Ref mirrors for the hot loop (avoid stale closures without re-subscribing)
  const previewRef = useRef(preview)
  const durationRef = useRef(durationMs)
  const selectedRef = useRef(selectedFixtureId)

  previewRef.current = preview
  durationRef.current = durationMs
  selectedRef.current = selectedFixtureId

  // ── 44Hz Render Loop (Aether Glass Standard) ──
  useEffect(() => {
    const render = () => {
      const now = performance.now()
      const elapsed = now - lastFrameTimeRef.current
      if (elapsed < FPS_44_MS) {
        rafRef.current = requestAnimationFrame(render)
        return
      }
      lastFrameTimeRef.current = now - (elapsed % FPS_44_MS)

      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height - TRANSPORT_HEIGHT)
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
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      const pv = previewRef.current
      const dur = durationRef.current
      const selId = selectedRef.current
      const fc = frameCounterRef.current

      // ── Clear with substrate ──
      ctx.fillStyle = BG_VOID
      ctx.fillRect(0, 0, w, h)

      // Subtle vignette
      const vignette = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7)
      vignette.addColorStop(0, BG_SUBSTRATE)
      vignette.addColorStop(1, BG_VOID)
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)

      // ── Compute spatial positions ──
      const positions = computeNodePositions(pv.fixtures, w, h)

      // ── L0: Math Grid ──
      drawMathGrid(ctx, w, h)

      // ── L1: Ariadne Thread ──
      drawAriadneThread(ctx, positions, w, h)

      // ── L2: Fixture Nodes ──
      drawFixtureNodes(ctx, positions, fc)

      // ── L3: Target Lock ──
      drawTargetLock(ctx, positions, selId, fc)

      // ── L4: HUD ──
      drawHUD(ctx, positions, selId, pv, w, h, dur)

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
    const fixtures = previewRef.current.fixtures
    const positions = computeNodePositions(fixtures, w, h)

    let hit: string | null = null
    let hitDist = Infinity

    for (const pos of positions) {
      const dist = Math.hypot(mx - pos.x, my - pos.y)
      if (dist < NODE_HIT_RADIUS && dist < hitDist) {
        hitDist = dist
        hit = pos.fixture.fixtureId
      }
    }

    onSelectFixture(hit)
  }, [onSeek, onSelectFixture])

  return (
    <div className="quantum-spectrometer" ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
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