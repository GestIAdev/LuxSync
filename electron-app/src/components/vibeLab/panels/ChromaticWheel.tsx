/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 ChromaticWheel.tsx — Rueda HSL 360° con arcos forbidden/allowed
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SVG circular de 360° que pinta:
 *   - Arcos rojos: forbiddenHueRanges (zonas prohibidas)
 *   - Arcos verdes: allowedHueRanges (zonas permitidas)
 *   - La rueda HSL completa de fondo
 *
 * Los arcos son arrastrables (drag para rotar/resize — Fase 3.2 básica:
 * click para añadir, drag para mover bordes).
 *
 * @module components/vibeLab/panels/ChromaticWheel
 * @version FASE 3.2
 */

import React, { memo, useState, useCallback, useMemo, useRef } from 'react'
import { useVibeLabStore, useGene } from '../../../stores/vibeLabStore'
import { COLOR_CONSTITUTIONS } from '../../../engine/color/colorConstitutions'
import './chromatic-wheel.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HueRange {
  start: number
  end: number
}

interface ChromaticWheelProps {
  size?: number
  accent?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// TUPLE ↔ HueRange CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/** Convierte [number, number][] (formato constitution) a HueRange[] (formato UI). */
function tuplesToRanges(tuples: [number, number][] | undefined): HueRange[] {
  if (!tuples || !Array.isArray(tuples)) return []
  return tuples.map(([start, end]) => ({ start, end }))
}

/** Convierte HueRange[] (formato UI) a [number, number][] (formato constitution). */
function rangesToTuples(ranges: HueRange[]): [number, number][] {
  return ranges.map((r) => [r.start, r.end])
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Convierte un ángulo (0-360°) a coordenadas x,y en el círculo. */
function polarToCart(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Crea un path SVG de arco (donut slice). */
function arcPath(
  cx: number, cy: number, rInner: number, rOuter: number,
  startDeg: number, endDeg: number,
): string {
  const startOuter = polarToCart(cx, cy, rOuter, endDeg)
  const endOuter = polarToCart(cx, cy, rOuter, startDeg)
  const startInner = polarToCart(cx, cy, rInner, startDeg)
  const endInner = polarToCart(cx, cy, rInner, endDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

/** HSL a color string para el fondo de la rueda. */
function hueToColor(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const ChromaticWheel: React.FC<ChromaticWheelProps> = memo(
  ({ size = 220, accent = '#ff2fd0' }) => {
    const svgRef = useRef<SVGSVGElement>(null)
    const draft = useVibeLabStore((s) => s.draft)
    const setGene = useVibeLabStore((s) => s.setGene)

    // Resolver baseDNA y constitution para los valores base
    const baseDNA = draft?.baseDNA ?? 'techno-club'
    const constitution = COLOR_CONSTITUTIONS[baseDNA as keyof typeof COLOR_CONSTITUTIONS]
    const baseForbidden: [number, number][] = constitution?.forbiddenHueRanges ?? []
    const baseAllowed: [number, number][] = constitution?.allowedHueRanges ?? [[0, 360]]

    // 🧬 useGene lee del draft override (color.hue.forbiddenHueRanges) o cae al base
    // El resolver mapea color.hue.forbiddenHueRanges → colorConstitution.forbiddenHueRanges
    const { value: forbiddenRaw } = useGene<[number, number][]>(
      'color.hue.forbiddenHueRanges',
      baseForbidden,
    )
    const { value: allowedRaw } = useGene<[number, number][]>(
      'color.hue.allowedHueRanges',
      baseAllowed,
    )

    // Convertir tuplas a HueRange[] para el rendering
    const forbidden = useMemo(() => tuplesToRanges(forbiddenRaw), [forbiddenRaw])
    const allowed = useMemo(() => tuplesToRanges(allowedRaw), [allowedRaw])

    const cx = size / 2
    const cy = size / 2
    const rOuter = size / 2 - 4
    const rInner = rOuter * 0.55

    // Generar 36 segmentos de 10° para el fondo HSL
    const hueSegments = useMemo(() => {
      const segs: { path: string; fill: string }[] = []
      for (let h = 0; h < 360; h += 10) {
        segs.push({
          path: arcPath(cx, cy, rInner, rOuter, h, h + 10),
          fill: hueToColor(h, 80, 50),
        })
      }
      return segs
    }, [cx, cy, rInner, rOuter])

    // ── Drag state para mover bordes de arcos ──────────────────────────
    const [dragState, setDragState] = useState<{
      type: 'forbidden' | 'allowed'
      index: number
      edge: 'start' | 'end'
    } | null>(null)

    const handleMouseDown = useCallback(
      (type: 'forbidden' | 'allowed', index: number, edge: 'start' | 'end') =>
        (e: React.MouseEvent) => {
          e.stopPropagation()
          setDragState({ type, index, edge })
        },
      [],
    )

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        if (!dragState || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        const px = e.clientX - rect.left - cx
        const py = e.clientY - rect.top - cy
        let angle = Math.atan2(py, px) * 180 / Math.PI + 90
        if (angle < 0) angle += 360
        angle = Math.round(angle)

        const ranges = dragState.type === 'forbidden' ? [...forbidden] : [...allowed]
        if (!ranges[dragState.index]) return
        ranges[dragState.index] = { ...ranges[dragState.index], [dragState.edge]: angle }
        // Validar start < end
        if (ranges[dragState.index].start > ranges[dragState.index].end) {
          ranges[dragState.index] = {
            start: ranges[dragState.index].end,
            end: ranges[dragState.index].start,
          }
        }
        // Escribir de vuelta como tuplas [number, number][]
        const path = dragState.type === 'forbidden'
          ? 'color.hue.forbiddenHueRanges'
          : 'color.hue.allowedHueRanges'
        setGene(path, rangesToTuples(ranges))
      },
      [dragState, forbidden, allowed, cx, cy, setGene],
    )

    const handleMouseUp = useCallback(() => setDragState(null), [])

    return (
      <div className="chromatic-wheel" style={{ '--cw-accent': accent } as React.CSSProperties}>
        <svg
          ref={svgRef}
          width={size}
          height={size}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* ── Fondo: rueda HSL ─────────────────────────────────────── */}
          {hueSegments.map((seg, i) => (
            <path key={i} d={seg.path} fill={seg.fill} opacity={0.5} />
          ))}

          {/* ── Allowed arcs (verde) ─────────────────────────────────── */}
          {allowed.map((range, i) => (
            <g key={`allowed-${i}`}>
              <path
                d={arcPath(cx, cy, rInner + 2, rOuter - 2, range.start, range.end)}
                fill="rgba(0, 255, 100, 0.25)"
                stroke="rgba(0, 255, 100, 0.6)"
                strokeWidth={1}
              />
              {/* Drag handles */}
              <DragHandle
                pos={polarToCart(cx, cy, rOuter - 2, range.start)}
                onMouseDown={handleMouseDown('allowed', i, 'start')}
                color="rgba(0, 255, 100, 0.8)"
              />
              <DragHandle
                pos={polarToCart(cx, cy, rOuter - 2, range.end)}
                onMouseDown={handleMouseDown('allowed', i, 'end')}
                color="rgba(0, 255, 100, 0.8)"
              />
            </g>
          ))}

          {/* ── Forbidden arcs (rojo) ────────────────────────────────── */}
          {forbidden.map((range, i) => (
            <g key={`forbidden-${i}`}>
              <path
                d={arcPath(cx, cy, rInner + 2, rOuter - 2, range.start, range.end)}
                fill="rgba(255, 50, 50, 0.3)"
                stroke="rgba(255, 50, 50, 0.7)"
                strokeWidth={1.5}
              />
              <DragHandle
                pos={polarToCart(cx, cy, rOuter - 2, range.start)}
                onMouseDown={handleMouseDown('forbidden', i, 'start')}
                color="rgba(255, 50, 50, 0.9)"
              />
              <DragHandle
                pos={polarToCart(cx, cy, rOuter - 2, range.end)}
                onMouseDown={handleMouseDown('forbidden', i, 'end')}
                color="rgba(255, 50, 50, 0.9)"
              />
            </g>
          ))}

          {/* ── Centro ───────────────────────────────────────────────── */}
          <circle cx={cx} cy={cy} r={rInner - 4} fill="rgba(15, 16, 22, 0.9)" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fill="rgba(255,255,255,0.4)"
            fontSize={9}
            fontFamily="monospace"
          >
            HUE
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            fill={accent}
            fontSize={8}
            fontFamily="monospace"
          >
            360°
          </text>
        </svg>
        <div className="chromatic-wheel-legend">
          <span className="cw-legend-item forbidden">■ Forbidden</span>
          <span className="cw-legend-item allowed">■ Allowed</span>
        </div>
      </div>
    )
  },
)

// ═══════════════════════════════════════════════════════════════════════════
// DRAG HANDLE
// ═══════════════════════════════════════════════════════════════════════════

const DragHandle: React.FC<{
  pos: { x: number; y: number }
  onMouseDown: (e: React.MouseEvent) => void
  color: string
}> = ({ pos, onMouseDown, color }) => (
  <circle
    cx={pos.x}
    cy={pos.y}
    r={5}
    fill={color}
    stroke="white"
    strokeWidth={1}
    style={{ cursor: 'grab' }}
    onMouseDown={onMouseDown}
  />
)

ChromaticWheel.displayName = 'ChromaticWheel'
