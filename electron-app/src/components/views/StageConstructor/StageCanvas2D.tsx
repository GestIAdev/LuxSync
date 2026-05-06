/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ STAGE CANVAS 2D — WAVE 4574
 * Top-down 2D layout editor. Drag fixtures from library → assign X/Z position.
 * Y (height) is inferred from orientation (ceiling=3m, floor=0.1m, etc.).
 * No WebGL. Pure SVG + HTMLdragover events.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useStageStore } from '../../../stores/stageStore'
import type { FixtureV2, InstallationOrientation, CanonicalZone } from '../../../core/stage/ShowFileV2'

// ─── Constants ───────────────────────────────────────────────────────────────

/** Infer Y from mount orientation when dropped onto 2D canvas */
const ORIENTATION_HEIGHT: Record<InstallationOrientation, number> = {
  'ceiling':     4.0,
  'truss-front': 3.5,
  'truss-back':  3.5,
  'wall-left':   2.5,
  'wall-right':  2.5,
  'floor':       0.1,
}

/** Visual shape per fixture type */
type FixtureShape = 'triangle' | 'circle' | 'diamond' | 'rect'

function getShape(type: string): FixtureShape {
  if (type === 'moving-head') return 'triangle'
  if (type === 'laser')       return 'diamond'
  if (type === 'strobe')      return 'rect'
  return 'circle'
}

/**
 * Zone overlay regions — fraction of stage [x0, z0, x1, z1]
 * Coordinate system: X left→right (0=left, 1=right), Z top→bottom (0=back, 1=front)
 *
 * Layout canónico LiquidEngine 9.1 — 9 CanonicalZones:
 *   BACK          : franja trasera (upstage)
 *   MOVERS-LEFT   : columna lateral izquierda
 *   MOVERS-RIGHT  : columna lateral derecha
 *   CENTER        : área central elevada (strobes/blinders)
 *   FLOOR         : parche suelo (uplights) — banda inferior ancha
 *   FRONT         : franja delantera (downstage, audience-facing)
 *   AIR           : banda superior translúcida (lásers/aerials) — sin colisión con BACK
 *   AMBIENT       : corners diagonales (house lights)
 *   (unassigned)  : zona por defecto si no encaja
 *
 * Regla anti-solapamiento de labels:
 *   - Cada zona tiene posición de label fuera del centro geométrico de zonas vecinas.
 *   - FLOOR es más pequeño y etiquetado top-left interior para no pisar CENTER.
 *   - AIR y AMBIENT son bands/corners sin texto en el interior del área principal.
 */
const ZONE_REGIONS: {
  zone: string
  label: string
  labelAnchor?: 'top-left' | 'center' | 'bottom-center' | 'top-center'
  color: string
  x0: number; z0: number; x1: number; z1: number
}[] = [
  // ─ Movers laterales (columnas L/R, todo el alto)
  { zone: 'movers-left',  label: 'MOVERS L',  color: 'rgba(168,85,247,0.15)',  x0: 0.000, z0: 0.00, x1: 0.12, z1: 1.00, labelAnchor: 'center' },
  { zone: 'movers-right', label: 'MOVERS R',  color: 'rgba(168,85,247,0.15)',  x0: 0.880, z0: 0.00, x1: 1.00, z1: 1.00, labelAnchor: 'center' },
  // ─ Back (upstage) — franja trasera sin invadir movers
  { zone: 'back',         label: 'BACK',      color: 'rgba(59,130,246,0.13)',  x0: 0.12, z0: 0.00, x1: 0.88, z1: 0.25, labelAnchor: 'center' },
  // ─ Front (downstage) — franja delantera
  { zone: 'front',        label: 'FRONT',     color: 'rgba(239,68,68,0.13)',   x0: 0.12, z0: 0.75, x1: 0.88, z1: 1.00, labelAnchor: 'center' },
  // ─ Center (área media central) — sin FLOOR dentro
  { zone: 'center',       label: 'CENTER',    color: 'rgba(251,191,36,0.09)',  x0: 0.12, z0: 0.25, x1: 0.88, z1: 0.75, labelAnchor: 'top-center' },
  // ─ Floor (uplights suelo) — banda inferior, etiqueta top-left para no pisar CENTER
  { zone: 'floor',        label: 'FLOOR',     color: 'rgba(52,211,153,0.12)',  x0: 0.20, z0: 0.60, x1: 0.80, z1: 0.74, labelAnchor: 'top-left' },
  // ─ Air (lásers/aerials) — band superior muy translúcida detrás de BACK
  { zone: 'air',          label: 'AIR',       color: 'rgba(244,114,182,0.08)', x0: 0.12, z0: 0.00, x1: 0.88, z1: 0.08, labelAnchor: 'top-left' },
  // ─ Ambient (house lights) — corners diagonales, casi invisible
  { zone: 'ambient',      label: 'AMBIENT',   color: 'rgba(148,163,184,0.06)', x0: 0.00, z0: 0.00, x1: 0.12, z1: 0.15, labelAnchor: 'top-left' },
]

/**
 * Derive CanonicalZone from drop position (fraction of stage width/depth).
 * M3: Auto-asignación nativa — movers-left/movers-right ya son zonas distintas
 * por x < 0 y x >= 0 en position.x, que el motor lee directamente con all-left/all-right.
 */
function inferZone(xFrac: number, zFrac: number): CanonicalZone {
  if (xFrac < 0.12)  return 'movers-left'
  if (xFrac > 0.88)  return 'movers-right'
  if (zFrac < 0.08)  return 'air'
  if (zFrac < 0.25)  return 'back'
  if (zFrac > 0.75)  return 'front'
  if (xFrac > 0.20 && xFrac < 0.80 && zFrac > 0.60 && zFrac < 0.74) return 'floor'
  return 'center'
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DragState {
  fixtureId: string
  offsetX: number
  offsetY: number
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FixtureGlyph({ type, color, size = 16 }: { type: string; color: string; size?: number }) {
  const shape = getShape(type)
  const s = size
  const h = s

  switch (shape) {
    case 'triangle': {
      const pts = `${s/2},2 ${s-2},${h-2} 2,${h-2}`
      return (
        <svg width={s} height={h} viewBox={`0 0 ${s} ${h}`} style={{ display: 'block' }}>
          <polygon points={pts} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </svg>
      )
    }
    case 'diamond': {
      const pts = `${s/2},2 ${s-2},${h/2} ${s/2},${h-2} 2,${h/2}`
      return (
        <svg width={s} height={h} viewBox={`0 0 ${s} ${h}`} style={{ display: 'block' }}>
          <polygon points={pts} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </svg>
      )
    }
    case 'rect':
      return (
        <svg width={s} height={h} viewBox={`0 0 ${s} ${h}`} style={{ display: 'block' }}>
          <rect x="2" y="2" width={s-4} height={h-4} rx="2" fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </svg>
      )
    default: // circle
      return (
        <svg width={s} height={h} viewBox={`0 0 ${s} ${h}`} style={{ display: 'block' }}>
          <circle cx={s/2} cy={h/2} r={s/2 - 2} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        </svg>
      )
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

const StageCanvas2D: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const updateFixture = useStageStore(state => state.updateFixture)
  const setFixtureZone = useStageStore(state => state.setFixtureZone)
  const stageWidth  = useStageStore(state => state.stage?.width  ?? 12)
  const stageDepth  = useStageStore(state => state.stage?.depth  ?? 10)

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ x: number; z: number } | null>(null)

  // Fit canvas to container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ w: Math.max(width, 400), h: Math.max(height, 300) })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Coordinate conversion ──────────────────────────────────────────────────
  // SVG stage area has 32px margin on all sides.
  const MARGIN = 40
  const stageW = canvasSize.w - MARGIN * 2
  const stageH = canvasSize.h - MARGIN * 2

  /** Stage coords (meters) → SVG pixel */
  const toSVG = useCallback((xm: number, zm: number): [number, number] => {
    // X: -stageWidth/2 → left side, +stageWidth/2 → right side
    // Z: -stageDepth/2 → top (back), +stageDepth/2 → bottom (front)
    const px = MARGIN + ((xm + stageWidth / 2) / stageWidth) * stageW
    const py = MARGIN + ((zm + stageDepth / 2) / stageDepth) * stageH
    return [px, py]
  }, [stageW, stageH, stageWidth, stageDepth, MARGIN])

  /** SVG pixel → Stage coords (meters) */
  const fromSVG = useCallback((px: number, py: number): [number, number] => {
    const xm = ((px - MARGIN) / stageW) * stageWidth - stageWidth / 2
    const zm = ((py - MARGIN) / stageH) * stageDepth - stageDepth / 2
    return [
      Math.max(-stageWidth / 2, Math.min(stageWidth / 2, xm)),
      Math.max(-stageDepth / 2, Math.min(stageDepth / 2, zm)),
    ]
  }, [stageW, stageH, stageWidth, stageDepth, MARGIN])

  /** Pixel coords → normalized [0,1] fraction of stage for zone inference */
  const toFraction = useCallback((px: number, py: number): [number, number] => {
    return [
      Math.max(0, Math.min(1, (px - MARGIN) / stageW)),
      Math.max(0, Math.min(1, (py - MARGIN) / stageH)),
    ]
  }, [stageW, stageH, MARGIN])

  // ── Fixture color ──────────────────────────────────────────────────────────
  const fixtureColor = (f: FixtureV2) => {
    const zone = f.zone ?? 'unassigned'
    const map: Record<string, string> = {
      front:        '#ef4444',
      back:         '#3b82f6',
      'movers-left':'#a855f7',
      'movers-right':'#a855f7',
      center:       '#fbbf24',
      floor:        '#34d399',
      air:          '#f472b6',
      ambient:      '#94a3b8',
    }
    return map[zone] ?? '#60a5fa'
  }

  // ── Drag from SVG (existing placed fixtures) ───────────────────────────────
  const onFixtureSVGMouseDown = useCallback((e: React.MouseEvent, fixtureId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const curX = e.clientX - rect.left
    const curY = e.clientY - rect.top
    const f = fixtures.find(fx => fx.id === fixtureId)
    if (!f) return
    const [fx, fz] = toSVG(f.position?.x ?? 0, f.position?.z ?? 0)
    setDrag({ fixtureId, offsetX: curX - fx, offsetY: curY - fz })
  }, [fixtures, toSVG])

  const onSVGMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left - drag.offsetX
    const py = e.clientY - rect.top - drag.offsetY
    const [xm, zm] = fromSVG(px, py)
    setDropTarget({ x: xm, z: zm })
  }, [drag, fromSVG])

  const onSVGMouseUp = useCallback((e: React.MouseEvent) => {
    if (!drag || !dropTarget || !svgRef.current) { setDrag(null); setDropTarget(null); return }
    const rect = svgRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left - drag.offsetX
    const py = e.clientY - rect.top - drag.offsetY
    const [xm, zm] = fromSVG(px, py)
    const [xFrac, zFrac] = toFraction(px + drag.offsetX, py + drag.offsetY)

    const f = fixtures.find(fx => fx.id === drag.fixtureId)
    const yHeight = ORIENTATION_HEIGHT[f?.orientation ?? 'ceiling'] ?? 3.0
    const zone = inferZone(xFrac, zFrac)

    updateFixture(drag.fixtureId, {
      position: { x: xm, y: yHeight, z: zm },
      isPlaced: true,
    })
    setFixtureZone(drag.fixtureId, zone as any)
    setDrag(null)
    setDropTarget(null)
  }, [drag, dropTarget, fromSVG, toFraction, fixtures, updateFixture, setFixtureZone])

  // ── Drop from external Fixture Library drag (HTML5 DnD) ───────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    // Show a live ghost so user sees where the fixture will land
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const [xm, zm] = fromSVG(px, py)
    setDropTarget({ x: xm, z: zm })
  }, [fromSVG])

  const onDragLeave = useCallback(() => {
    // Only clear ghost when there's no SVG-internal drag in progress
    if (!drag) setDropTarget(null)
  }, [drag])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(null)

    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const [xm, zm] = fromSVG(px, py)
    const [xFrac, zFrac] = toFraction(px, py)
    const zone = inferZone(xFrac, zFrac)

    // ── Path A: chip from UnplacedTray (application/fixture-id) ──────────────
    const fixtureId = e.dataTransfer.getData('application/fixture-id')
    if (fixtureId) {
      const f = fixtures.find(fx => fx.id === fixtureId)
      const yHeight = ORIENTATION_HEIGHT[f?.orientation ?? 'ceiling'] ?? 3.0
      updateFixture(fixtureId, {
        position: { x: xm, y: yHeight, z: zm },
        isPlaced: true,
      })
      setFixtureZone(fixtureId, zone)
      return
    }

    // ── Path B: fixture type drag from Library sidebar ────────────────────────
    // Library drag only carries type metadata; actual fixture creation is not
    // StageCanvas2D's responsibility. Bubble a custom event for the parent layer.
    const raw = e.dataTransfer.getData('application/fixture-type') ||
                e.dataTransfer.getData('text/plain')
    if (!raw) return

    const dropEvent = new CustomEvent('stagecanvas2d:drop', {
      bubbles: true,
      detail: { x: xm, y: ORIENTATION_HEIGHT['ceiling'], z: zm, zone, raw }
    })
    svg.dispatchEvent(dropEvent)
  }, [fromSVG, toFraction, fixtures, updateFixture, setFixtureZone])

  // ── Tick marks ────────────────────────────────────────────────────────────
  const ticks = useMemo(() => {
    const marks: { x: number; z: number; label: string }[] = []
    for (let xm = -Math.floor(stageWidth / 2); xm <= Math.ceil(stageWidth / 2); xm += 2) {
      const [px] = toSVG(xm, -stageDepth / 2)
      marks.push({ x: px, z: MARGIN - 12, label: `${xm}m` })
    }
    for (let zm = -Math.floor(stageDepth / 2); zm <= Math.ceil(stageDepth / 2); zm += 2) {
      const [, py] = toSVG(0, zm)
      marks.push({ x: MARGIN - 8, z: py, label: `${zm}m` })
    }
    return marks
  }, [stageWidth, stageDepth, toSVG, MARGIN])

  // ── Placed fixtures ───────────────────────────────────────────────────────
  const placed = fixtures.filter(f => f.isPlaced)

  const GLYPH = 26 // px — tamaño de glyph base, suficiente para ser clickeable/draggable

  return (
    <div ref={containerRef} className="stage-canvas-2d-container">
      {/* Legend bar */}
      <div className="sc2d-legend">
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#ef4444'}} />Front</span>
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#3b82f6'}} />Back</span>
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#a855f7'}} />Movers L/R</span>
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#fbbf24'}} />Center</span>
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#34d399'}} />Floor</span>
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#f472b6'}} />Air</span>
        <span className="sc2d-legend-item"><span className="sc2d-dot" style={{background:'#94a3b8'}} />Ambient</span>
        <span className="sc2d-legend-item sc2d-legend-sep" />
        <span className="sc2d-legend-hint">▲ Moving Head &nbsp; ● PAR/Wash &nbsp; ◆ Laser &nbsp; ▬ Strobe &nbsp;|&nbsp; drag chip → place</span>
      </div>

      <svg
        ref={svgRef}
        className="sc2d-svg"
        width={canvasSize.w}
        height={canvasSize.h}
        onMouseMove={onSVGMouseMove}
        onMouseUp={onSVGMouseUp}
        onMouseLeave={() => { setDrag(null); setDropTarget(null) }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{ cursor: drag ? 'grabbing' : 'default' }}
      >
        {/* Background */}
        <rect x={0} y={0} width={canvasSize.w} height={canvasSize.h} fill="rgb(8,10,18)" />

        {/* Zone overlays — layout canónico 9.1, sin solapamiento de labels */}
        {ZONE_REGIONS.map(z => {
          const x0 = MARGIN + z.x0 * stageW
          const y0 = MARGIN + z.z0 * stageH
          const w  = (z.x1 - z.x0) * stageW
          const h  = (z.z1 - z.z0) * stageH

          // Label position strategy — evita solapamiento con zonas vecinas
          let lx: number, ly: number
          let anchor: string = 'middle'
          switch (z.labelAnchor) {
            case 'top-left':
              lx = x0 + 5; ly = y0 + 11; anchor = 'start'; break
            case 'top-center':
              lx = x0 + w / 2; ly = y0 + 12; anchor = 'middle'; break
            case 'bottom-center':
              lx = x0 + w / 2; ly = y0 + h - 5; anchor = 'middle'; break
            default: // 'center'
              lx = x0 + w / 2; ly = y0 + h / 2; anchor = 'middle'; break
          }
          // Movers L/R: label rotado verticalmente para aprovechar el espacio estrecho
          const isLateral = z.zone === 'movers-left' || z.zone === 'movers-right'

          return (
            <g key={z.zone}>
              <rect x={x0} y={y0} width={w} height={h} fill={z.color} rx="2" />
              {isLateral ? (
                <text
                  x={lx}
                  y={y0 + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8"
                  fontWeight="700"
                  fill="rgba(168,85,247,0.55)"
                  transform={`rotate(-90, ${lx}, ${y0 + h / 2})`}
                  style={{ pointerEvents: 'none', userSelect: 'none', letterSpacing: '0.6px' }}
                >
                  {z.label}
                </text>
              ) : (
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor as React.SVGAttributes<SVGTextElement>['textAnchor']}
                  dominantBaseline="auto"
                  fontSize="9"
                  fontWeight="600"
                  fill="rgba(255,255,255,0.22)"
                  style={{ pointerEvents: 'none', userSelect: 'none', letterSpacing: '0.7px' }}
                >
                  {z.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Stage border */}
        <rect
          x={MARGIN} y={MARGIN}
          width={stageW} height={stageH}
          fill="none"
          stroke="rgba(0,255,180,0.35)"
          strokeWidth="1.5"
          rx="4"
        />

        {/* Audience indicator */}
        <text
          x={MARGIN + stageW / 2}
          y={MARGIN + stageH + 20}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(255,255,255,0.25)"
          style={{ userSelect: 'none' }}
        >
          ▲ AUDIENCE
        </text>
        <text
          x={MARGIN + stageW / 2}
          y={MARGIN - 20}
          textAnchor="middle"
          fontSize="10"
          fill="rgba(255,255,255,0.25)"
          style={{ userSelect: 'none' }}
        >
          UPSTAGE ▼
        </text>

        {/* Grid lines */}
        {Array.from({ length: Math.floor(stageWidth) + 1 }).map((_, i) => {
          const xm = -Math.floor(stageWidth / 2) + i
          const [px] = toSVG(xm, 0)
          return (
            <line key={`gx${i}`}
              x1={px} y1={MARGIN} x2={px} y2={MARGIN + stageH}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1"
            />
          )
        })}
        {Array.from({ length: Math.floor(stageDepth) + 1 }).map((_, i) => {
          const zm = -Math.floor(stageDepth / 2) + i
          const [, py] = toSVG(0, zm)
          return (
            <line key={`gz${i}`}
              x1={MARGIN} y1={py} x2={MARGIN + stageW} y2={py}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1"
            />
          )
        })}

        {/* Tick labels X-axis */}
        {Array.from({ length: Math.floor(stageWidth / 2) + 1 }).map((_, i) => {
          const xm = -Math.floor(stageWidth / 4) * 2 + i * 2
          const [px] = toSVG(xm, 0)
          return (
            <text key={`tx${i}`} x={px} y={MARGIN - 6}
              textAnchor="middle" fontSize="9" fill="rgba(0,255,180,0.45)"
              style={{ userSelect: 'none' }}
            >{xm}m</text>
          )
        })}
        {/* Tick labels Z-axis */}
        {Array.from({ length: Math.floor(stageDepth / 2) + 1 }).map((_, i) => {
          const zm = -Math.floor(stageDepth / 4) * 2 + i * 2
          const [, py] = toSVG(0, zm)
          return (
            <text key={`tz${i}`} x={MARGIN - 6} y={py}
              textAnchor="end" dominantBaseline="middle" fontSize="9" fill="rgba(0,255,180,0.45)"
              style={{ userSelect: 'none' }}
            >{zm}m</text>
          )
        })}

        {/* Placed fixtures */}
        {placed.map(f => {
          const pos = f.position ?? { x: 0, y: 0, z: 0 }
          const isDragging = drag?.fixtureId === f.id
          const [px, py] = isDragging && dropTarget
            ? toSVG(dropTarget.x, dropTarget.z)
            : toSVG(pos.x, pos.z)
          const color = fixtureColor(f)
          const shape = getShape(f.type ?? 'par')

          return (
            <g
              key={f.id}
              transform={`translate(${px - GLYPH / 2}, ${py - GLYPH / 2})`}
              style={{ cursor: 'grab' }}
              onMouseDown={(e) => onFixtureSVGMouseDown(e, f.id)}
            >
              {/* Selection/hover halo */}
              <circle
                cx={GLYPH / 2} cy={GLYPH / 2} r={GLYPH / 2 + 4}
                fill="transparent"
                stroke={isDragging ? 'rgba(251,191,36,0.7)' : 'transparent'}
                strokeWidth="1.5"
              />

              {/* Glyph shape */}
              {shape === 'triangle' ? (
                <polygon
                  points={`${GLYPH/2},1 ${GLYPH-1},${GLYPH-1} 1,${GLYPH-1}`}
                  fill={color}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1"
                />
              ) : shape === 'diamond' ? (
                <polygon
                  points={`${GLYPH/2},1 ${GLYPH-1},${GLYPH/2} ${GLYPH/2},${GLYPH-1} 1,${GLYPH/2}`}
                  fill={color}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1"
                />
              ) : shape === 'rect' ? (
                <rect x="1" y="1" width={GLYPH - 2} height={GLYPH - 2} rx="2"
                  fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="1"
                />
              ) : (
                <circle cx={GLYPH/2} cy={GLYPH/2} r={GLYPH/2 - 1}
                  fill={color} stroke="rgba(255,255,255,0.6)" strokeWidth="1"
                />
              )}

              {/* Name label */}
              <text
                x={GLYPH / 2}
                y={GLYPH + 9}
                textAnchor="middle"
                fontSize="8"
                fill="rgba(255,255,255,0.7)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {(f.name ?? 'FX').slice(0, 8)}
              </text>
            </g>
          )
        })}

        {/* Drop ghost — visible tanto para DnD HTML5 desde tray/library como para SVG drag */}
        {dropTarget && (
          <g style={{ pointerEvents: 'none' }}>
            <circle
              cx={toSVG(dropTarget.x, dropTarget.z)[0]}
              cy={toSVG(dropTarget.x, dropTarget.z)[1]}
              r={GLYPH / 2 + 6}
              fill="rgba(251,191,36,0.15)"
              stroke="rgba(251,191,36,0.7)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <circle
              cx={toSVG(dropTarget.x, dropTarget.z)[0]}
              cy={toSVG(dropTarget.x, dropTarget.z)[1]}
              r={3}
              fill="rgba(251,191,36,0.9)"
            />
          </g>
        )}
      </svg>

      {/* Unplaced fixtures tray */}
      <UnplacedTray />
    </div>
  )
}

// ─── Unplaced Tray ────────────────────────────────────────────────────────────
// Fixtures not yet placed — shown below the canvas as draggable chips.
// User drags them onto the SVG to position them.

const UnplacedTray: React.FC = () => {
  const fixtures = useStageStore(state => state.fixtures)
  const unplaced = fixtures.filter(f => !f.isPlaced)

  if (unplaced.length === 0) return null

  const onDragStart = (e: React.DragEvent, f: FixtureV2) => {
    e.dataTransfer.setData('application/fixture-id', f.id)
    e.dataTransfer.setData('text/plain', f.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="sc2d-tray">
      <span className="sc2d-tray-label">{unplaced.length} unplaced — drag to stage:</span>
      <div className="sc2d-tray-chips">
        {unplaced.map(f => (
          <div
            key={f.id}
            className="sc2d-chip"
            draggable
            onDragStart={(e) => onDragStart(e, f)}
            title={`Drag to place: ${f.name ?? 'Unnamed'}\nU${f.universe ?? 1}·${f.address ?? '?'}`}
          >
            <FixtureGlyph type={f.type ?? 'par'} color="#94a3b8" size={14} />
            <span>{(f.name ?? 'FX').slice(0, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StageCanvas2D
