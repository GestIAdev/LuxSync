import React, { useMemo } from 'react'
import { PaperLayer } from './layers/PaperLayer'
import { GridLayer } from './layers/GridLayer'
import { SymbolLayer } from './layers/SymbolLayer'

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — El Viewport SVG
// PROYECTO EREBUS FASE 4
//
// Contenedor raíz del lienzo 2D (Blueprint Mode).
// Ocupa el 100% del espacio bajo el HUD.
// viewBox en METROS — paridad matemática exacta con R3F.
//
// Coordinate system (matches 3D):
//   X: Left (-) to Right (+) — stage width
//   Z: Back (-) to Front (+) — stage depth
//   SVG Y axis = 3D Z axis (top-down view)
// ═══════════════════════════════════════════════════════════════════════════

interface BlueprintCanvasProps {
  /** Stage width in meters (default 12) */
  stageWidth?: number
  /** Stage depth in meters (default 8) */
  stageDepth?: number
  /** Padding around stage in meters (default 2) */
  padding?: number
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
}) => {
  // viewBox spans from (-padding) to (stageWidth + padding) on X
  // and from (-padding) to (stageDepth + padding) on Z (mapped to SVG Y)
  const viewBox = useMemo(
    () => ({
      x: -padding,
      y: -padding,
      w: stageWidth + padding * 2,
      h: stageDepth + padding * 2,
    }),
    [stageWidth, stageDepth, padding],
  )

  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`

  return (
    <svg
      className="blueprint-canvas"
      viewBox={viewBoxStr}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'var(--obs-floor)',
        zIndex: 1,
      }}
    >
      {/* Layer 0: Paper (background + noise) */}
      <PaperLayer width={viewBox.w} height={viewBox.h} x={viewBox.x} y={viewBox.y} />

      {/* Layer 1: Grid (dual trama + crosshairs) */}
      <GridLayer
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />

      {/* Layer 5: Symbols (fixture simbology) */}
      <SymbolLayer />
    </svg>
  )
}

export default BlueprintCanvas
