import React, { useMemo, useState, useCallback } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { PaperLayer } from './layers/PaperLayer'
import { GridLayer } from './layers/GridLayer'
import { SymbolLayer } from './layers/SymbolLayer'
import { DimensionLayer } from './layers/DimensionLayer'
import { DragDropController2D, type DragState2D } from './interaction/DragDropController2D'
import { CoverageRing } from './interaction/CoverageRing'
import { ElevationScrubber, type ElevationState } from './elevation/ElevationScrubber'
import { SectionProfileGhost } from './elevation/SectionProfileGhost'

// ═══════════════════════════════════════════════════════════════════════════
// BlueprintCanvas — El Viewport SVG
// PROYECTO EREBUS — FASE 4 + FASE 7
//
// Contenedor raíz del lienzo 2D (Blueprint Mode).
// Ocupa el 100% del espacio bajo el HUD.
// viewBox en METROS — paridad matemática exacta con R3F.
//
// Coordinate system (matches 3D):
//   X: Left (-) to Right (+) — stage width
//   Z: Back (-) to Front (+) — stage depth
//   SVG Y axis = 3D Z axis (top-down view)
//
// FASE 7: Drag & Drop 2D, Cotas Vivas, Elevación Latente, Coverage Ring.
// ═══════════════════════════════════════════════════════════════════════════

interface BlueprintCanvasProps {
  /** Stage width in meters (default 12) */
  stageWidth?: number
  /** Stage depth in meters (default 8) */
  stageDepth?: number
  /** Padding around stage in meters (default 2) */
  padding?: number
  /** Inline style override (for crossfade opacity during transition) */
  style?: React.CSSProperties
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
  style,
}) => {
  const fixtures = useStageStore(s => s.fixtures)

  // ── FASE 7: Interaction state ─────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState2D | null>(null)
  const [elevationState, setElevationState] = useState<ElevationState | null>(null)

  const handleDragUpdate = useCallback((state: DragState2D) => setDragState(state), [])
  const handleDragEnd = useCallback(() => setDragState(null), [])
  const handleElevationChange = useCallback((state: ElevationState | null) => setElevationState(state), [])

  // Neighbor positions for DimensionLayer
  const neighborPositions = useMemo(
    () => fixtures.map(f => ({ id: f.id, x: f.position.x, z: f.position.z })),
    [fixtures],
  )

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
        ...style,
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

      {/* Layer 4: Cotas Vivas (only during drag) */}
      <DimensionLayer
        dragState={dragState}
        neighborPositions={neighborPositions}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />

      {/* Coverage Ring (only during elevation scrubbing) */}
      <CoverageRing elevationState={elevationState} />

      {/* Layer 5: Symbols (fixture simbology) */}
      <SymbolLayer />

      {/* FASE 7: Drag & Drop 2D + Elevation Scrubber */}
      <DragDropController2D
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
      />
      <ElevationScrubber
        fixtures={fixtures}
        onElevationChange={handleElevationChange}
      />

      {/* Section Profile Ghost (only during elevation scrubbing) */}
      <SectionProfileGhost
        elevationState={elevationState}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />
    </svg>
  )
}

export default BlueprintCanvas
