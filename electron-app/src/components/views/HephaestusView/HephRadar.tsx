/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPH RADAR — WAVE 2030.25: THE HEPHAESTUS LAB
 * Canvas 2D Standalone Preview — "Radar Mode"
 * 
 * Visualizes the clip output in real-time on a 2D Canvas:
 *   - Grid background (like an oscilloscope / radar)
 *   - Fixture dot(s) positioned by Pan/Tilt
 *   - Color = RGB from clip, Alpha = dimmer × strobe gate
 *   - Numeric readouts in corners (P: T: D: W: etc.)
 *   - Transport controls (▶ ⏸ ⏹) + progress bar
 * 
 * Completely isolated — no TitanOrchestrator, no HAL, no DMX.
 * 
 * @module views/HephaestusView/HephRadar
 * @version WAVE 2030.25
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { PreviewFixtureState, HephPreviewState } from './useHephPreview'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const GRID_COLOR = 'rgba(255, 107, 43, 0.08)'
const GRID_CENTER_COLOR = 'rgba(255, 107, 43, 0.18)'
const GRID_SUBDIVISIONS = 8
const DOT_RADIUS_SINGLE = 18
const DOT_RADIUS_MULTI = 12
const LABEL_FONT = '10px monospace'
const READOUT_FONT = '11px monospace'
const READOUT_COLOR = 'rgba(255, 255, 255, 0.6)'
const READOUT_VALUE_COLOR = '#ff6b2b'
const BG_COLOR = '#08080d'
const SCANLINE_ALPHA = 0.03

// ═══════════════════════════════════════════════════════════════════════════
// RADAR RENDERER — Pure canvas drawing, zero DOM
// ═══════════════════════════════════════════════════════════════════════════

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const stepX = w / GRID_SUBDIVISIONS
  const stepY = h / GRID_SUBDIVISIONS
  const cx = w / 2
  const cy = h / 2

  // Grid lines
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 1
  for (let i = 0; i <= GRID_SUBDIVISIONS; i++) {
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

  // Center crosshair (brighter)
  ctx.strokeStyle = GRID_CENTER_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, h)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.stroke()
  ctx.setLineDash([])

  // Scanlines for CRT feel
  ctx.fillStyle = `rgba(0, 0, 0, ${SCANLINE_ALPHA})`
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1)
  }
}

function drawFixtureDot(
  ctx: CanvasRenderingContext2D,
  fixture: PreviewFixtureState,
  w: number,
  h: number,
  radius: number,
  frameCount: number,
) {
  // ── 1. BASE: Posición física en la sala (radarX/radarY, zona y layout espacial) ──
  // WAVE 2403.2: radarX/radarY = distribución normalizada 0-1 del fixture en el venue
  const baseX = fixture.radarX * w
  const baseY = fixture.radarY * h

  // ── 2. TARGET: Hacia dónde apunta el haz (Pan/Tilt DMX reales 0-255) ──
  // 🔥 WAVE 2213: Pan/Tilt restaurado — la posición del punto en pantalla
  //   refleja el movimiento real del mover, no solo su posición en la sala
  const targetX = (fixture.pan / 255) * w
  const targetY = (fixture.tilt / 255) * h

  // Alpha = dimmer normalized × strobe gate
  const dimmerAlpha = fixture.dimmer / 255
  // Strobe: 0 = no strobe (full on), >0 = flashing.
  // For preview, simulate gate: strobe>0 blinks. We use a simple threshold.
  const strobeGate = fixture.strobe > 0
    ? (Math.sin(frameCount * (fixture.strobe / 255) * 0.3) > 0 ? 1 : 0.1)
    : 1
  const alpha = dimmerAlpha * strobeGate

  // Determine color: mix RGB + white + amber
  // ⚒️ WAVE 2040.20: Sanitize against NaN (color curves can produce NaN
  // when hslToRgb receives undefined/null from incomplete evaluation)
  let fr = isNaN(fixture.r) ? 0 : fixture.r
  let fg = isNaN(fixture.g) ? 0 : fixture.g
  let fb = isNaN(fixture.b) ? 0 : fixture.b

  // White adds to all channels equally
  if (fixture.white > 0) {
    const wAdd = fixture.white * 0.7  // Warm white is slightly warm
    fr = Math.min(255, fr + wAdd)
    fg = Math.min(255, fg + wAdd * 0.95)
    fb = Math.min(255, fb + wAdd * 0.85)
  }

  // Amber adds warm orange
  if (fixture.amber > 0) {
    fr = Math.min(255, fr + fixture.amber * 0.9)
    fg = Math.min(255, fg + fixture.amber * 0.5)
  }

  // No color, no white, no amber → show dimmer as warm white
  if (fr === 0 && fg === 0 && fb === 0 && fixture.dimmer > 0) {
    fr = 255
    fg = 230
    fb = 200
  }

  // ── ANCLA BASE (Punto de anclaje de la estructura física) ──
  ctx.fillStyle = `rgba(255, 255, 255, 0.2)`
  ctx.fillRect(baseX - 3, baseY - 3, 6, 6)

  // ── HAZ DE LUZ (Beam: Base → Target) ──
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.lineTo(targetX, targetY)
  const beamGrad = ctx.createLinearGradient(baseX, baseY, targetX, targetY)
  beamGrad.addColorStop(0, `rgba(${fr}, ${fg}, ${fb}, ${alpha * 0.15})`)
  beamGrad.addColorStop(1, `rgba(${fr}, ${fg}, ${fb}, ${alpha * 0.5})`)
  ctx.strokeStyle = beamGrad
  ctx.lineWidth = radius * 0.4
  ctx.stroke()

  // ── 3. Dot position: baseX/baseY (physical fixture position) ──
  // The beam shows where the haz points; the dot stays at the fixture's spatial location
  const x = baseX
  const y = baseY

  // ── GLOW (outer) ──
  const glowRadius = radius * 2.5
  const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius)
  glow.addColorStop(0, `rgba(${fr}, ${fg}, ${fb}, ${alpha * 0.4})`)
  glow.addColorStop(1, `rgba(${fr}, ${fg}, ${fb}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2)
  ctx.fill()

  // ── CORE DOT ──
  ctx.fillStyle = `rgba(${Math.round(fr)}, ${Math.round(fg)}, ${Math.round(fb)}, ${alpha})`
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  // ── INNER BRIGHT SPOT ──
  const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.5)
  innerGlow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.6})`)
  innerGlow.addColorStop(1, `rgba(255, 255, 255, 0)`)
  ctx.fillStyle = innerGlow
  ctx.beginPath()
  ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2)
  ctx.fill()

  // ── ZONE LABEL ──
  if (fixture.label !== 'ALL') {
    ctx.font = LABEL_FONT
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.3, alpha * 0.8)})`
    ctx.textAlign = 'center'
    ctx.fillText(fixture.label, x, y + radius + 14)
  }
}

function drawReadouts(
  ctx: CanvasRenderingContext2D,
  fixture: PreviewFixtureState,
  w: number,
  h: number,
  progress: number,
  playheadMs: number,
  durationMs: number,
) {
  const pad = 10
  ctx.font = READOUT_FONT
  ctx.textBaseline = 'top'

  // ── TOP-LEFT: Movement ──
  ctx.textAlign = 'left'
  const panLabel = `P:${fixture.pan.toString().padStart(3, ' ')}`
  const panFineLabel = `.${fixture.panFine.toString().padStart(3, ' ')}`
  const tiltLabel = `T:${fixture.tilt.toString().padStart(3, ' ')}`
  const tiltFineLabel = `.${fixture.tiltFine.toString().padStart(3, ' ')}`

  drawReadoutLine(ctx, pad, pad, 'PAN ', panLabel, panFineLabel)
  drawReadoutLine(ctx, pad, pad + 16, 'TILT', tiltLabel, tiltFineLabel)

  // ── TOP-RIGHT: Color ──
  ctx.textAlign = 'right'
  const rLabel = `R:${fixture.r.toString().padStart(3, ' ')}`
  const gLabel = `G:${fixture.g.toString().padStart(3, ' ')}`
  const bLabel = `B:${fixture.b.toString().padStart(3, ' ')}`

  ctx.fillStyle = `rgb(${Math.min(255, fixture.r + 60)}, 80, 80)`
  ctx.fillText(rLabel, w - pad, pad)
  ctx.fillStyle = `rgb(80, ${Math.min(255, fixture.g + 60)}, 80)`
  ctx.fillText(gLabel, w - pad, pad + 16)
  ctx.fillStyle = `rgb(80, 80, ${Math.min(255, fixture.b + 60)})`
  ctx.fillText(bLabel, w - pad, pad + 32)

  // ── BOTTOM-LEFT: Intensity/Channels ──
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'

  ctx.fillStyle = READOUT_COLOR
  ctx.fillText('DIM', pad, h - pad - 48)
  ctx.fillStyle = READOUT_VALUE_COLOR
  ctx.fillText(` ${fixture.dimmer.toString().padStart(3, ' ')}`, pad + 26, h - pad - 48)

  ctx.fillStyle = READOUT_COLOR
  ctx.fillText('WHT', pad, h - pad - 32)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText(` ${fixture.white.toString().padStart(3, ' ')}`, pad + 26, h - pad - 32)

  ctx.fillStyle = READOUT_COLOR
  ctx.fillText('AMB', pad, h - pad - 16)
  ctx.fillStyle = '#f97316'
  ctx.fillText(` ${fixture.amber.toString().padStart(3, ' ')}`, pad + 26, h - pad - 16)

  ctx.fillStyle = READOUT_COLOR
  ctx.fillText('STR', pad, h - pad)
  ctx.fillStyle = fixture.strobe > 0 ? '#ef4444' : READOUT_COLOR
  ctx.fillText(` ${fixture.strobe.toString().padStart(3, ' ')}`, pad + 26, h - pad)

  // ── BOTTOM-RIGHT: Optics + Time ──
  ctx.textAlign = 'right'

  ctx.fillStyle = READOUT_COLOR
  ctx.fillText(`ZM:${fixture.zoom.toString().padStart(3, ' ')}`, w - pad, h - pad - 32)
  ctx.fillText(`FC:${fixture.focus.toString().padStart(3, ' ')}`, w - pad, h - pad - 16)

  // Time display
  const currentSec = (playheadMs / 1000).toFixed(2)
  const totalSec = (durationMs / 1000).toFixed(1)
  ctx.fillStyle = READOUT_VALUE_COLOR
  ctx.fillText(`${currentSec}s / ${totalSec}s`, w - pad, h - pad)
}

function drawReadoutLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  coarseVal: string,
  fineVal: string,
) {
  ctx.fillStyle = READOUT_COLOR
  ctx.fillText(label, x, y)
  ctx.fillStyle = READOUT_VALUE_COLOR
  ctx.fillText(coarseVal, x + 36, y)
  ctx.fillStyle = 'rgba(255, 107, 43, 0.45)'
  ctx.fillText(fineVal, x + 76, y)
}

function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
) {
  const barH = 3
  const y = h - barH

  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.fillRect(0, y, w, barH)

  // Fill
  ctx.fillStyle = '#ff6b2b'
  ctx.fillRect(0, y, w * progress, barH)

  // Glow at playhead
  const px = w * progress
  const glowGrad = ctx.createRadialGradient(px, y, 0, px, y, 8)
  glowGrad.addColorStop(0, 'rgba(255, 107, 43, 0.8)')
  glowGrad.addColorStop(1, 'rgba(255, 107, 43, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(px - 8, y - 4, 16, barH + 8)
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface HephRadarProps {
  preview: HephPreviewState
  durationMs: number
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (ms: number) => void
}

export const HephRadar: React.FC<HephRadarProps> = ({
  preview,
  durationMs,
  onPlay,
  onPause,
  onStop,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const frameCounterRef = useRef<number>(0)
  const previewRef = useRef(preview)
  const durationRef = useRef(durationMs)
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null)
  const selectedFixtureIdRef = useRef<string | null>(null)

  previewRef.current = preview
  durationRef.current = durationMs
  selectedFixtureIdRef.current = selectedFixtureId

  // ── Render Loop (rAF continuo, DPR canónico) ──
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height - 36)
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(render)
        return
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      const pv = previewRef.current
      const dur = durationRef.current
      const fc = frameCounterRef.current

      // Clear
      ctx.fillStyle = BG_COLOR
      ctx.fillRect(0, 0, w, h)

      // Grid
      drawGrid(ctx, w, h)

      // Fixtures
      const fixtures = pv.fixtures
      const radius = fixtures.length > 1 ? DOT_RADIUS_MULTI : DOT_RADIUS_SINGLE
      const selId = selectedFixtureIdRef.current

      for (const fixture of fixtures) {
        drawFixtureDot(ctx, fixture, w, h, radius, fc)

        // ── Selection ring (laser sight) ──
        if (fixture.fixtureId === selId) {
          const sx = fixture.radarX * w
          const sy = fixture.radarY * h
          ctx.save()
          ctx.strokeStyle = '#ff6600'
          ctx.lineWidth = 2
          ctx.shadowColor = '#ff6600'
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.arc(sx, sy, radius + 5, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        }
      }

      // Readouts — use selected fixture or fallback to first
      const activeReadout = fixtures.find(f => f.fixtureId === selId) ?? fixtures[0]
      if (activeReadout) {
        drawReadouts(ctx, activeReadout, w, h, pv.progress, pv.playheadMs, dur)
      }

      // Progress bar
      drawProgressBar(ctx, w, h, pv.progress)

      ctx.restore()
      frameCounterRef.current++
      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Click: fixture hit-test + seek fallback ──
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const h = rect.height

    // Seek zone: bottom 12px
    if (my >= h - 12) {
      const ratio = Math.max(0, Math.min(1, mx / rect.width))
      onSeek(ratio * durationMs)
      return
    }

    // Hit-test: find closest fixture dot
    const fixtures = previewRef.current.fixtures
    const radius = fixtures.length > 1 ? DOT_RADIUS_MULTI : DOT_RADIUS_SINGLE
    let hit: string | null = null
    let hitDist = Infinity

    for (const fixture of fixtures) {
      const fx = fixture.radarX * rect.width
      const fy = fixture.radarY * rect.height
      const dist = Math.hypot(mx - fx, my - fy)
      if (dist < radius + 6 && dist < hitDist) {
 hitDist = dist
        hit = fixture.fixtureId
      }
    }

    if (hit) {
      setSelectedFixtureId(hit)
    } else {
      setSelectedFixtureId(null)
    }
  }, [durationMs, onSeek])

  return (
    <div className="heph-radar" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="heph-radar__canvas"
        onMouseDown={handleCanvasMouseDown}
      />
      <div className="heph-radar__transport">
        <button
          className="heph-radar__btn"
          onClick={preview.isPlaying ? onPause : onPlay}
          title={preview.isPlaying ? 'Pause' : 'Play'}
        >
          {preview.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="heph-radar__btn"
          onClick={onStop}
          title="Stop"
        >
          ⏹
        </button>
        <div className="heph-radar__status">
          {preview.isPlaying ? (
            <span className="heph-radar__live">● LIVE</span>
          ) : (
            <span className="heph-radar__paused">◌ PAUSED</span>
          )}
          <span className="heph-radar__frame">
            F:{preview.frameCount}
          </span>
        </div>
      </div>
      {/* ── Inspection telemetry panel ── */}
      {(() => {
        const sel = preview.fixtures.find(f => f.fixtureId === selectedFixtureId) ?? preview.fixtures[0]
        if (!sel) return null
        const phaseOffset = sel.fixtureId !== preview.fixtures[0]?.fixtureId
          ? `${((sel.pan / 255) * 360).toFixed(0)}º`
          : '0º'
        return (
          <div style={{
            position: 'absolute',
            bottom: '40px',
            right: '8px',
            background: 'rgba(8, 8, 13, 0.85)',
            border: '1px solid #2a2a2a',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '9px',
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.6)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: '120px',
          }}>
            <div style={{ color: '#ff6600', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.08em' }}>
              {sel.fixtureId.toUpperCase()}
            </div>
            <div>ID: <span style={{ color: '#ff6b2b' }}>{sel.label}</span></div>
            <div>DIM: <span style={{ color: '#ff6b2b' }}>{sel.dimmer}</span></div>
            <div>X: <span style={{ color: '#ff6b2b' }}>{(sel.radarX * 100).toFixed(1)}</span> Y: <span style={{ color: '#ff6b2b' }}>{(sel.radarY * 100).toFixed(1)}</span></div>
            <div>PAN: <span style={{ color: '#ff6b2b' }}>{sel.pan}</span> TILT: <span style={{ color: '#ff6b2b' }}>{sel.tilt}</span></div>
            <div>PHASE: <span style={{ color: '#ff6b2b' }}>{phaseOffset}</span></div>
          </div>
        )
      })()}
    </div>
  )
}
