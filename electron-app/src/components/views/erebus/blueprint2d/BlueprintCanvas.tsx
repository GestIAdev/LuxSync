import React, { useMemo, useState, useCallback, useRef } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { useSelectionStore } from '../../../../stores/selectionStore'
import { useLibraryStore } from '../../../../stores/libraryStore'
import { useSnapStore } from '../../../../stores/snapStore'
import { createDefaultFixture } from '../../../../core/stage/ShowFileV2'
import { PaperLayer } from './layers/PaperLayer'
import { GridLayer } from './layers/GridLayer'
import { ArchitectureLayer } from './layers/ArchitectureLayer'
import { ZoneLayer } from './layers/ZoneLayer'
import { SymbolLayer, type FixtureSymbolData } from './layers/SymbolLayer'
import { DimensionLayer } from './layers/DimensionLayer'
import { DragDropController2D, type DragState2D, type DragHandlers } from './interaction/DragDropController2D'
import { LassoSelection } from './interaction/LassoSelection'
import { CoverageRing } from './interaction/CoverageRing'
import { ElevationScrubber, type ElevationState } from './elevation/ElevationScrubber'
import { SectionProfileGhost } from './elevation/SectionProfileGhost'
import { RigPlanLayer } from './layers/RigPlanLayer'
import { MeasureLayer2D } from './interaction/MeasureLayer2D'
import { useScreenToSVG } from './interaction/screenToSVG'
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
  const addFixture = useStageStore(s => s.addFixture)
  const deselectAll = useSelectionStore(s => s.deselectAll)
  const snap = useSnapStore(s => s.snap)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // ── FASE 7: Interaction state ─────────────────────────────────────────────
  const [dragState, setDragState] = useState<DragState2D | null>(null)
  const [elevationState, setElevationState] = useState<ElevationState | null>(null)
  const [dragHandlers, setDragHandlers] = useState<DragHandlers | null>(null)

  // ── Shared coordinate conversion (DOM → SVG user space) ──────────────────
  const screenToSVG = useScreenToSVG(svgRef)

  // ── Drop handler for new fixtures from tool panel ──────────────────────────
  // Uses screenToSVG (getScreenCTM) for pixel-perfect placement, then applies
  // the inverse offset to convert SVG top-left coords → 3D center-origin.
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const libraryId = e.dataTransfer.getData('application/x-fixture-library-id')
      if (!libraryId) return

      const libState = useLibraryStore.getState()
      const libFixture = [...libState.systemFixtures, ...libState.userFixtures].find(
        f => f.id === libraryId,
      )
      if (!libFixture) return

      // Convert screen pixels → SVG user space (meters, top-left origin)
      const { x: svgX, y: svgZ } = screenToSVG(e.clientX, e.clientY)

      // SVG top-left origin → 3D center-origin
      const worldX = snap(svgX - stageWidth / 2)
      const worldZ = snap(svgZ - stageDepth / 2)

      const fixtureCount = useStageStore.getState().fixtures.length
      const newFixture = createDefaultFixture(
        `fix-${Date.now()}`,
        fixtureCount * 4 + 1,
        {
          name: libFixture.name,
          model: libFixture.name,
          manufacturer: libFixture.manufacturer,
          type: libFixture.type as any,
          profileId: libFixture.id,
          channelCount: libFixture.channels?.length ?? 1,
          position: { x: worldX, y: 3, z: worldZ },
          isPlaced: true,
          placementMode: '3d',
        },
      )
      addFixture(newFixture)
    },
    [screenToSVG, snap, stageWidth, stageDepth, addFixture],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragUpdate = useCallback((state: DragState2D) => setDragState(state), [])
  const handleDragEnd = useCallback(() => setDragState(null), [])
  const handleElevationChange = useCallback((state: ElevationState | null) => setElevationState(state), [])

  // Neighbor positions for DimensionLayer
  const neighborPositions = useMemo(
    () => fixtures.map(f => ({
      id: f.id,
      x: f.position.x + stageWidth / 2,
      z: f.position.z + stageDepth / 2,
    })),
    [fixtures, stageWidth, stageDepth],
  )

  // Map fixtures to symbol data for SymbolLayer
  // Transform from 3D center-origin (0,0 = stage center) to SVG top-left-origin
  // (0,0 = top-left corner of stage rect)
  const symbolFixtures = useMemo<FixtureSymbolData[]>(
    () =>
      fixtures.map(f => ({
        id: f.id,
        type: (f.type === 'bar' ? 'wash' : f.type) as FixtureSymbolData['type'],
        x: f.position.x + stageWidth / 2,
        z: f.position.z + stageDepth / 2,
        yaw: f.rotation.yaw,
        name: f.name,
        dmx: `U${f.universe}.${f.address}`,
      })),
    [fixtures, stageWidth, stageDepth],
  )

  // viewBox — tight framing: 1.5m padding around stage so it dominates viewport
  // Grid (GridLayer) still draws beyond this to its own overscan, but the
  // viewBox crops to this tighter frame for a closer default zoom.
  const VIEWBOX_PADDING = 1.5
  const viewBox = useMemo(
    () => ({
      x: -VIEWBOX_PADDING,
      y: -VIEWBOX_PADDING,
      w: stageWidth + VIEWBOX_PADDING * 2,
      h: stageDepth + VIEWBOX_PADDING * 2,
    }),
    [stageWidth, stageDepth],
  )

  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`

  return (
    <svg
      ref={svgRef}
      className="blueprint-canvas"
      viewBox={viewBoxStr}
      preserveAspectRatio="xMidYMid meet"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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

      {/* Layer 4b: Lasso capture rect — BELOW symbols so fixture clicks don't trigger lasso */}
      <LassoSelection
        svgRef={svgRef}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        toolMode={toolMode}
      />

      {/* Layer 5: Symbols (fixture simbology) — interactive, receives pointer events */}
      <SymbolLayer
        fixtures={symbolFixtures}
        onFixturePointerDown={dragHandlers?.onFixturePointerDown}
        onFixturePointerEnter={dragHandlers?.onFixturePointerEnter}
        onFixturePointerLeave={dragHandlers?.onFixturePointerLeave}
        onFixtureContextMenu={dragHandlers?.onFixtureContextMenu}
      />

      {/* Layer 5b: Rig Plan (trusses + totems in 2D) */}
      <RigPlanLayer />

      {/* Layer 6: Drag feedback (alignment line + ghost) — above symbols, pointerEvents none */}
      <DragDropController2D
        svgRef={svgRef}
        stageWidth={stageWidth}
        stageDepth={stageDepth}
        padding={padding}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
        toolMode={toolMode}
        onHandlersReady={setDragHandlers}
      />

      {/* Measure Tool (2D) */}
      <MeasureLayer2D
        svgRef={svgRef}
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
