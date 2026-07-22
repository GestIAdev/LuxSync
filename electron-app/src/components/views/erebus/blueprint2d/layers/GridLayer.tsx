import React, { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// GridLayer — Trama Técnica
// PROYECTO EREBUS FASE 4 — Layer 1
//
// Doble trama vectorial:
//   Fina: cada 0.25m, opacidad 4%, --obs-line
//   Maestra: cada 1m, opacidad 10%, --obs-line
//   Cruces (+) cada 5m en intersecciones maestras
//
// Hairlines perfectas — stroke-width en metros para escalado correcto.
// ═══════════════════════════════════════════════════════════════════════════

interface GridLayerProps {
  stageWidth: number
  stageDepth: number
  padding: number
}

const FINE_SPACING = 0.25 // meters
const MASTER_SPACING = 1.0 // meters
const CROSSHAIR_SPACING = 5.0 // meters
const FINE_WIDTH = 1 // 1px screen pixel — non-scaling-stroke
const MASTER_WIDTH = 1.5 // 1.5px screen pixel
const CROSS_WIDTH = 2 // 2px screen pixel

export const GridLayer: React.FC<GridLayerProps> = ({
  stageWidth,
  stageDepth,
  padding,
}) => {
  const { fineLines, masterLines, crosshairs } = useMemo(() => {
    const xStart = -padding
    const xEnd = stageWidth + padding
    const zStart = -padding
    const zEnd = stageDepth + padding

    // Fine grid lines (vertical = constant X, horizontal = constant Z)
    const fine: React.ReactNode[] = []
    for (let x = Math.ceil(xStart / FINE_SPACING) * FINE_SPACING; x <= xEnd; x += FINE_SPACING) {
      fine.push(
        <line
          key={`fv-${x}`}
          x1={x} y1={zStart}
          x2={x} y2={zEnd}
          stroke="var(--obs-line, #2A3040)"
          strokeWidth={FINE_WIDTH}
          opacity={0.08}
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    for (let z = Math.ceil(zStart / FINE_SPACING) * FINE_SPACING; z <= zEnd; z += FINE_SPACING) {
      fine.push(
        <line
          key={`fh-${z}`}
          x1={xStart} y1={z}
          x2={xEnd} y2={z}
          stroke="var(--obs-line, #2A3040)"
          strokeWidth={FINE_WIDTH}
          opacity={0.08}
          vectorEffect="non-scaling-stroke"
        />
      )
    }

    // Master grid lines
    const master: React.ReactNode[] = []
    for (let x = Math.ceil(xStart / MASTER_SPACING) * MASTER_SPACING; x <= xEnd; x += MASTER_SPACING) {
      master.push(
        <line
          key={`mv-${x}`}
          x1={x} y1={zStart}
          x2={x} y2={zEnd}
          stroke="var(--obs-line, #2A3040)"
          strokeWidth={MASTER_WIDTH}
          opacity={0.18}
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    for (let z = Math.ceil(zStart / MASTER_SPACING) * MASTER_SPACING; z <= zEnd; z += MASTER_SPACING) {
      master.push(
        <line
          key={`mh-${z}`}
          x1={xStart} y1={z}
          x2={xEnd} y2={z}
          stroke="var(--obs-line, #2A3040)"
          strokeWidth={MASTER_WIDTH}
          opacity={0.18}
          vectorEffect="non-scaling-stroke"
        />
      )
    }

    // Crosshair markers (+) every 5m at master intersections
    const crosses: React.ReactNode[] = []
    const crossSize = 0.08 // 8cm half-size
    for (let x = Math.ceil(xStart / CROSSHAIR_SPACING) * CROSSHAIR_SPACING; x <= xEnd; x += CROSSHAIR_SPACING) {
      for (let z = Math.ceil(zStart / CROSSHAIR_SPACING) * CROSSHAIR_SPACING; z <= zEnd; z += CROSSHAIR_SPACING) {
        crosses.push(
          <g key={`cross-${x}-${z}`}>
            <line
              x1={x - crossSize} y1={z}
              x2={x + crossSize} y2={z}
              stroke="var(--obs-line, #2A3040)"
              strokeWidth={CROSS_WIDTH}
              opacity={0.22}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x} y1={z - crossSize}
              x2={x} y2={z + crossSize}
              stroke="var(--obs-line, #2A3040)"
              strokeWidth={CROSS_WIDTH}
              opacity={0.22}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      }
    }

    return { fineLines: fine, masterLines: master, crosshairs: crosses }
  }, [stageWidth, stageDepth, padding])

  return (
    <g>
      {/* Fine grid (rendered first, lowest opacity) */}
      {fineLines}

      {/* Master grid (on top of fine) */}
      {masterLines}

      {/* Crosshair markers (top) */}
      {crosshairs}
    </g>
  )
}

export default GridLayer
