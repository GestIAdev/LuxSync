import React, { useMemo, useState, useCallback, useRef } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { PaperLayer } from './layers/PaperLayer'
import { GridLayer } from './layers/GridLayer'
import { ArchitectureLayer } from './layers/ArchitectureLayer'
import { ZoneLayer } from './layers/ZoneLayer'
import { SymbolLayer, type FixtureSymbolData } from './layers/SymbolLayer'
import { DimensionLayer } from './layers/DimensionLayer'
import { DragDropController2D, type DragState2D } from './interaction/DragDropController2D'
import { LassoSelection } from './interaction/LassoSelection'
import { CoverageRing } from './interaction/CoverageRing'
import { ElevationScrubber, type ElevationState } from './elevation/ElevationScrubber'
import { SectionProfileGhost } from './elevation/SectionProfileGhost'
import { RigPlanLayer } from './layers/RigPlanLayer'
import { MeasureLayer2D } from './interaction/MeasureLayer2D'
import type { ToolMode } from '../ErebusShell'

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
  /** Active tool mode */
  toolMode?: ToolMode
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
  style,
  toolMode = 'select',
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const deselectAll = useSelectionStore(s => s.deselectAll)
  const svgRef = useRef<SVGSVGElement | null>(null)

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

  // Map fixtures to symbol data for SymbolLayer
  const symbolFixtures = useMemo<FixtureSymbolData[]>(
    () =>
      fixtures.map(f => ({
        id: f.id,
        type: (f.type === 'bar' ? 'wash' : f.type) as FixtureSymbolData['type'],
        x: f.position.x,
        z: f.position.z,
        yaw: f.rotation.yaw,
        label: `${f.name} · U${f.universe}.${f.address}`,
      })),
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
      ref={svgRef}
      className="blueprint-canvas"
      viewBox={viewBoxStr}
      preserveAspectRatio="xMidYMid meet"
      onClick={(e) => {
        // Only deselect if clicking the SVG background itself (not a child element)
        if (e.target === e.currentTarget) deselectAll()
      }}
      style={{
        ...style,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'var(--obs-floor)',
        zIndex: 1,
      }}
    >
      {/* ═══ Global <defs> — declarados una sola vez en la raíz del SVG ═══ */}
      <defs>
        {/* Zone dot fill — for hover/drag-over highlight */}
        <pattern id="zone-dot-fill" x="0" y="0" width="0.3" height="0.3" patternUnits="userSpaceOnUse">
          <circle cx="0.15" cy="0.15" r="0.015" fill="var(--obs-accent)" opacity="0.03" />
        </pattern>
      </defs>

      {/* Layer 0: Paper (background + noise) — sin defs propios */}
      <PaperLayer width={viewBox.w} height={viewBox.h} x={viewBox.x} y={viewBox.y} />

      {/* Layer 1: Grid (dual trama + crosshairs) */}
      <GridLayer
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />

      {/* Layer 2: Architecture (stage border + exterior hatching) */}
      <ArchitectureLayer
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
      />

      {/* Layer 3: Zones (canonical architectural zones) */}
      <ZoneLayer
        stageWidth={stageWidth}
        stageDepth={stageDepth}
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
      <SymbolLayer fixtures={symbolFixtures} />

      {/* Layer 5b: Rig Plan (trusses + totems in 2D) */}
      <RigPlanLayer />

      {/* FASE 7: Drag & Drop 2D + Elevation Scrubber */}
      <DragDropController2D
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
        toolMode={toolMode}
      />
      <LassoSelection
        svgRef={svgRef}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        toolMode={toolMode}
      />

      {/* Measure Tool (2D) */}
      <MeasureLayer2D
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        toolMode={toolMode}
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
