import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { useScreenToSVG } from './screenToSVG'

// ═══════════════════════════════════════════════════════════════════════════
// MeasureLayer2D — Cotas entre fixtures (Measure Tool, 2D)
// PROYECTO EREBUS — Measure Tool
//
// En toolMode='measure':
//   - Click fixture A → marca primer punto
//   - Click fixture B → dibuja línea de cota con distancia 2D (XZ)
//   - Esc o click vacío → reset
//
// Muestra distancia euclidiana en el plano XZ + desglose DX/DZ.
// ═══════════════════════════════════════════════════════════════════════════

interface MeasureLayer2DProps {
  /** SVG element ref from BlueprintCanvas root — for coordinate conversion */
  svgRef: React.RefObject<SVGSVGElement | null>
  stageWidth?: number
  stageDepth?: number
  padding?: number
  toolMode: string
}

interface MeasurePoint {
  x: number
  z: number
  id: string
}

const ACCENT = 'var(--obs-accent, #5EEAD4)'
const INK = 'var(--obs-ink, #8B94A8)'
const AMBER = 'var(--obs-amber, #F5B04D)'
const STROKE_WIDTH = 0.006
const FONT_SIZE = 0.08
const ARROW_SIZE = 0.04

export const MeasureLayer2D: React.FC<MeasureLayer2DProps> = ({
  svgRef,
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
  toolMode,
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const select = useSelectionStore(s => s.select)
  const screenToSVG = useScreenToSVG(svgRef)
  const [pointA, setPointA] = useState<MeasurePoint | null>(null)
  const [pointB, setPointB] = useState<MeasurePoint | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; z: number } | null>(null)

  // ── Offset between SVG top-left origin and 3D center-origin ───────────────
  const offsetX = stageWidth / 2
  const offsetZ = stageDepth / 2

  // Reset when leaving measure mode
  useEffect(() => {
    if (toolMode !== 'measure') {
      setPointA(null)
      setPointB(null)
      setHoverPos(null)
    }
  }, [toolMode])

  // Esc to reset
  useEffect(() => {
    if (toolMode !== 'measure') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPointA(null)
        setPointB(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toolMode])

  const handleFixtureClick = useCallback(
    (e: React.PointerEvent, fixtureId: string) => {
      if (toolMode !== 'measure') return
      e.stopPropagation()
      const f = fixtures.find(fx => fx.id === fixtureId)
      if (!f) return

      const pt = { x: f.position.x, z: f.position.z, id: fixtureId }

      if (!pointA) {
        setPointA(pt)
      } else if (pointA.id === fixtureId) {
        // Click same fixture → reset
        setPointA(null)
      } else {
        setPointB(pt)
      }
    },
    [toolMode, fixtures, pointA],
  )

  const handleBackgroundClick = useCallback(
    (e: React.PointerEvent) => {
      if (toolMode !== 'measure') return
      if (e.target !== e.currentTarget) return
      setPointA(null)
      setPointB(null)
    },
    [toolMode],
  )

  const handleMouseMove = useCallback(
    (e: React.PointerEvent) => {
      if (toolMode !== 'measure' || !pointA || pointB) return
      const { x, y } = screenToSVG(e.clientX, e.clientY)
      // SVG coords → 3D center-origin for measure display
      setHoverPos({ x: x - offsetX, z: y - offsetZ })
    },
    [toolMode, pointA, pointB, screenToSVG, offsetX, offsetZ],
  )

  // Compute distance
  const measure = useMemo(() => {
    const a = pointA
    const b = pointB ?? hoverPos
    if (!a || !b) return null
    const dx = b.x - a.x
    const dz = b.z - a.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    return { dx, dz, dist, ax: a.x, az: a.z, bx: b.x, bz: b.z }
  }, [pointA, pointB, hoverPos])

  if (toolMode !== 'measure') return null

  return (
    <g className="measure-layer-2d">
      <defs>
        <marker
          id="measure-arrow"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE / 2}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <path d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`} fill={ACCENT} />
        </marker>
      </defs>

      {/* Interaction overlay */}
      <rect
        x={-padding}
        y={-padding}
        width={stageWidth + padding * 2}
        height={stageDepth + padding * 2}
        fill="transparent"
        onPointerDown={handleBackgroundClick}
        onPointerMove={handleMouseMove}
        style={{ pointerEvents: 'all' }}
      />

      {/* Click targets on fixtures (SVG coords = 3D + offset) */}
      {fixtures.map(f => (
        <circle
          key={f.id}
          cx={f.position.x + offsetX}
          cy={f.position.z + offsetZ}
          r={0.2}
          fill="transparent"
          onPointerDown={(e) => handleFixtureClick(e, f.id)}
          style={{
            pointerEvents: 'all',
            cursor: 'crosshair',
            stroke: pointA?.id === f.id ? ACCENT : 'transparent',
            strokeWidth: 1.5,
          }}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Measure line */}
      {measure && (
        <g pointerEvents="none">
          {/* Main line (SVG coords = 3D + offset) */}
          <line
            x1={measure.ax + offsetX}
            y1={measure.az + offsetZ}
            x2={measure.bx + offsetX}
            y2={measure.bz + offsetZ}
            stroke={ACCENT}
            strokeWidth={STROKE_WIDTH}
            markerStart="url(#measure-arrow)"
            markerEnd="url(#measure-arrow)"
          />
          {/* Endpoint markers */}
          <circle cx={measure.ax + offsetX} cy={measure.az + offsetZ} r={0.04} fill={ACCENT} />
          <circle cx={measure.bx + offsetX} cy={measure.bz + offsetZ} r={0.04} fill={pointB ? ACCENT : AMBER} opacity={pointB ? 1 : 0.5} />

          {/* Distance label */}
          <text
            x={(measure.ax + measure.bx) / 2 + offsetX}
            y={(measure.az + measure.bz) / 2 + offsetZ - FONT_SIZE * 0.5}
            fill={ACCENT}
            fontSize={FONT_SIZE}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {measure.dist.toFixed(2)}m
          </text>

          {/* DX/DZ breakdown */}
          {pointB && (
            <text
              x={(measure.ax + measure.bx) / 2 + offsetX}
              y={(measure.az + measure.bz) / 2 + offsetZ + FONT_SIZE * 0.8}
              fill={INK}
              fontSize={FONT_SIZE * 0.75}
              fontFamily="monospace"
              textAnchor="middle"
            >
              ΔX:{measure.dx.toFixed(2)} ΔZ:{measure.dz.toFixed(2)}
            </text>
          )}
        </g>
      )}
    </g>
  )
}

export default MeasureLayer2D
