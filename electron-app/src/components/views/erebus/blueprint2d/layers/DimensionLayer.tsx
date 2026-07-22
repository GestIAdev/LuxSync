import React, { useMemo } from 'react'
import type { DragState2D } from '../interaction/DragDropController2D'

// ═══════════════════════════════════════════════════════════════════════════
// DimensionLayer — Cotas Vivas (Layer 4)
// PROYECTO EREBUS FASE 7
//
// Líneas de cota dinámicas durante el arrastre de un fixture.
// Dibuja líneas temporales desde los bordes del foco hasta:
//   - Los límites del escenario (bordes más cercanos)
//   - Los focos vecinos más cercanos
//
// Tipografía monoespaciada, color --obs-ink.
// Valor activo en --obs-accent.
// ═══════════════════════════════════════════════════════════════════════════

interface DimensionLayerProps {
  /** Current drag state (null when not dragging) */
  dragState: DragState2D | null
  /** Other fixtures for neighbor distance calculation */
  neighborPositions?: Array<{ id: string; x: number; z: number }>
  /** Stage bounds */
  stageWidth?: number
  stageDepth?: number
  padding?: number
}

const INK = 'var(--obs-ink, #8B94A8)'
const ACCENT = 'var(--obs-accent, #5EEAD4)'
const STROKE_WIDTH = 0.004
const FONT_SIZE = 0.08
const ARROW_SIZE = 0.03
const TICK_OFFSET = 0.15

export const DimensionLayer: React.FC<DimensionLayerProps> = ({
  dragState,
  neighborPositions = [],
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
}) => {
  if (!dragState) return null

  const { x, z } = dragState

  // ── Compute distances to stage edges ──────────────────────────────────────
  const distLeft = x - (-padding)
  const distRight = (stageWidth + padding) - x
  const distTop = z - (-padding)
  const distBottom = (stageDepth + padding) - z

  // Pick 2 closest edges
  const edges = [
    { label: 'L', dist: distLeft, axis: 'x' as const, fixed: -padding, from: -padding, to: x },
    { label: 'R', dist: distRight, axis: 'x' as const, fixed: stageWidth + padding, from: x, to: stageWidth + padding },
    { label: 'T', dist: distTop, axis: 'z' as const, fixed: -padding, from: -padding, to: z },
    { label: 'B', dist: distBottom, axis: 'z' as const, fixed: stageDepth + padding, from: z, to: stageDepth + padding },
  ].sort((a, b) => a.dist - b.dist).slice(0, 2)

  // ── Find nearest neighbor ──────────────────────────────────────────────────
  let nearestNeighbor: { id: string; x: number; z: number; dist: number } | null = null
  for (const n of neighborPositions) {
    if (n.id === dragState.fixtureId) continue
    const dx = x - n.x
    const dz = z - n.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (!nearestNeighbor || dist < nearestNeighbor.dist) {
      nearestNeighbor = { ...n, dist }
    }
  }

  // ── Arrow marker def ───────────────────────────────────────────────────────
  return (
    <g className="dimension-layer" pointerEvents="none">
      <defs>
        <marker
          id="dim-arrow"
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE}
          refX={ARROW_SIZE / 2}
          refY={ARROW_SIZE / 2}
          orient="auto"
        >
          <path
            d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`}
            fill={INK}
          />
        </marker>
      </defs>

      {/* Edge dimension lines */}
      {edges.map((edge, i) => {
        if (edge.axis === 'x') {
          // Horizontal dimension line at z + offset
          const lineZ = z + (i === 0 ? -TICK_OFFSET : TICK_OFFSET)
          return (
            <g key={`edge-${i}`}>
              <line
                x1={edge.from} y1={lineZ}
                x2={edge.to} y2={lineZ}
                stroke={INK}
                strokeWidth={STROKE_WIDTH}
                markerStart="url(#dim-arrow)"
                markerEnd="url(#dim-arrow)"
              />
              {/* Extension lines */}
              <line x1={edge.from} y1={z} x2={edge.from} y2={lineZ} stroke={INK} strokeWidth={STROKE_WIDTH * 0.5} opacity={0.4} />
              <line x1={edge.to} y1={z} x2={edge.to} y2={lineZ} stroke={INK} strokeWidth={STROKE_WIDTH * 0.5} opacity={0.4} />
              <text
                x={(edge.from + edge.to) / 2}
                y={lineZ - FONT_SIZE * 0.5}
                fill={ACCENT}
                fontSize={FONT_SIZE}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {edge.dist.toFixed(2)}m
              </text>
            </g>
          )
        } else {
          // Vertical dimension line at x + offset
          const lineX = x + (i === 0 ? TICK_OFFSET : -TICK_OFFSET)
          return (
            <g key={`edge-${i}`}>
              <line
                x1={lineX} y1={edge.from}
                x2={lineX} y2={edge.to}
                stroke={INK}
                strokeWidth={STROKE_WIDTH}
                markerStart="url(#dim-arrow)"
                markerEnd="url(#dim-arrow)"
              />
              <line x1={x} y1={edge.from} x2={lineX} y2={edge.from} stroke={INK} strokeWidth={STROKE_WIDTH * 0.5} opacity={0.4} />
              <line x1={x} y1={edge.to} x2={lineX} y2={edge.to} stroke={INK} strokeWidth={STROKE_WIDTH * 0.5} opacity={0.4} />
              <text
                x={lineX + FONT_SIZE * 0.5}
                y={(edge.from + edge.to) / 2}
                fill={ACCENT}
                fontSize={FONT_SIZE}
                fontFamily="monospace"
                textAnchor="start"
              >
                {edge.dist.toFixed(2)}m
              </text>
            </g>
          )
        }
      })}

      {/* Neighbor distance line */}
      {nearestNeighbor && nearestNeighbor.dist < 5 && (
        <g key="neighbor">
          <line
            x1={x} y1={z}
            x2={nearestNeighbor.x} y2={nearestNeighbor.z}
            stroke={INK}
            strokeWidth={STROKE_WIDTH * 0.7}
            strokeDasharray="0.04 0.04"
            opacity={0.5}
          />
          <text
            x={(x + nearestNeighbor.x) / 2}
            y={(z + nearestNeighbor.z) / 2 - FONT_SIZE * 0.5}
            fill={INK}
            fontSize={FONT_SIZE}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {nearestNeighbor.dist.toFixed(2)}m
          </text>
        </g>
      )}
    </g>
  )
}

export default DimensionLayer
