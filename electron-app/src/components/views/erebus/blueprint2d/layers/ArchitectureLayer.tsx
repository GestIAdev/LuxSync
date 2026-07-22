import React, { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ArchitectureLayer — Borde del Escenario + Achurado Exterior
// PROYECTO EREBUS — Capa 2
//
// Doble línea técnica delimitando el escenario:
//   - Línea exterior: --obs-line, stroke 0.015
//   - Línea interior: --obs-line, stroke 0.005, offset 0.1m
// Achurado 45° en el exterior marcando "fuera de sala".
// vector-effect="non-scaling-stroke" en toda la geometría.
// ═══════════════════════════════════════════════════════════════════════════

interface ArchitectureLayerProps {
  stageWidth: number
  stageDepth: number
  padding: number
}

const HATCH_SPACING = 0.5
const HATCH_OFFSET = 0.3
const BORDER_OFFSET = 0.1

export const ArchitectureLayer: React.FC<ArchitectureLayerProps> = ({
  stageWidth,
  stageDepth,
  padding,
}) => {
  // ── Exterior hatching (45° lines outside the stage boundary) ──────────────
  const hatchLines = useMemo(() => {
    const lines: React.ReactNode[] = []
    const xStart = -padding
    const xEnd = stageWidth + padding
    const zStart = -padding
    const zEnd = stageDepth + padding

    // We draw diagonal lines at 45° that cover the padding ring around the stage.
    // Only render lines in the "frame" area (outside the stage rect).
    const diagLen = Math.max(xEnd - xStart, zEnd - zStart) * 2
    const numLines = Math.ceil(diagLen / HATCH_SPACING)

    for (let i = -numLines; i <= numLines; i++) {
      const offset = i * HATCH_SPACING
      // Each 45° line goes from (xStart + offset, zStart) to (xStart + offset + diagLen, zStart + diagLen)
      // We clip by drawing segments only in the padding ring
      // Top edge: z in [zStart, 0]
      const x1t = xStart + offset
      const z1t = zStart
      const x2t = x1t + (0 - zStart)
      const z2t = 0
      if (x2t > xStart && x1t < xEnd) {
        lines.push(
          <line
            key={`h-t-${i}`}
            x1={Math.max(x1t, xStart)}
            y1={z1t}
            x2={Math.min(x2t, xEnd)}
            y2={z2t}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={1}
            opacity={0.15}
            vectorEffect="non-scaling-stroke"
          />
        )
      }
      // Bottom edge: z in [stageDepth, zEnd]
      const x1b = xStart + offset - (stageDepth - zStart)
      const z1b = stageDepth
      const x2b = x1b + (zEnd - stageDepth)
      const z2b = zEnd
      if (x2b > xStart && x1b < xEnd) {
        lines.push(
          <line
            key={`h-b-${i}`}
            x1={Math.max(x1b, xStart)}
            y1={z1b}
            x2={Math.min(x2b, xEnd)}
            y2={z2b}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={1}
            opacity={0.15}
            vectorEffect="non-scaling-stroke"
          />
        )
      }
      // Left edge: x in [xStart, 0]
      const z1l = zStart + offset
      const z2l = z1l + (0 - xStart)
      if (z2l > zStart && z1l < zEnd) {
        lines.push(
          <line
            key={`h-l-${i}`}
            x1={xStart}
            y1={Math.max(z1l, zStart)}
            x2={0}
            y2={Math.min(z2l, zEnd)}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={1}
            opacity={0.15}
            vectorEffect="non-scaling-stroke"
          />
        )
      }
      // Right edge: x in [stageWidth, xEnd]
      const z1r = zStart + offset - (stageWidth - xStart)
      const z2r = z1r + (xEnd - stageWidth)
      if (z2r > zStart && z1r < zEnd) {
        lines.push(
          <line
            key={`h-r-${i}`}
            x1={stageWidth}
            y1={Math.max(z1r, zStart)}
            x2={xEnd}
            y2={Math.min(z2r, zEnd)}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={1}
            opacity={0.15}
            vectorEffect="non-scaling-stroke"
          />
        )
      }
    }

    return lines
  }, [stageWidth, stageDepth, padding])

  return (
    <g className="architecture-layer" style={{ pointerEvents: 'none' }}>
      {/* Exterior hatching */}
      {hatchLines}

      {/* Outer border (thick) */}
      <rect
        x={0}
        y={0}
        width={stageWidth}
        height={stageDepth}
        fill="none"
        stroke="var(--obs-line, #2A3040)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />

      {/* Inner border (thin, offset) */}
      <rect
        x={-BORDER_OFFSET}
        y={-BORDER_OFFSET}
        width={stageWidth + BORDER_OFFSET * 2}
        height={stageDepth + BORDER_OFFSET * 2}
        fill="none"
        stroke="var(--obs-line, #2A3040)"
        strokeWidth={1.5}
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
}

export default ArchitectureLayer
