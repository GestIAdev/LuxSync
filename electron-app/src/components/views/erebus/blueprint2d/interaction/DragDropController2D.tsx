import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { snapToVoxel, VOXEL_SIZE, clampToCrystalBox } from '../../../../../core/stage/ShowFileV2'
import { useSnapStore } from '../../../../../stores/snapStore'
import type { FixtureV2, StageDimensions } from '../../../../../core/stage/ShowFileV2'
import type { ToolMode } from '../../ErebusShell'
import { useScreenToSVG } from './screenToSVG'

// ═══════════════════════════════════════════════════════════════════════════
// DragDropController2D — Arrastre y Alineación en el plano SVG
// PROYECTO EREBUS FASE 7 + FASE 8 + FASE 1 COMMIT B
//
// Motor de arrastre: recibe eventos de puntero desde SymbolLayer (no tiene
// overlays propios). Renderiza solo feedback visual durante el drag:
// línea de alineación magnética + ghost symbol.
//
// Snapping a cuadrícula de voxels (0.25m).
// Alineación magnética: <0.1m del eje X o Z de otro fixture → imán + línea.
//
// FASE 8: Integración con selectionStore — selección única, multi con Shift,
// hover global notificado al store unificado.
// ═══════════════════════════════════════════════════════════════════════════

const ALIGN_THRESHOLD = 0.1 // 10cm — distancia de activación de alineación magnética

export interface AlignmentLine {
  axis: 'x' | 'z'
  value: number // the axis value to align to
  fromFixture: string // fixture id we're aligning to
}

export interface DragState2D {
  fixtureId: string
  x: number
  z: number
  alignment: AlignmentLine | null
}

/** Handlers exposed by DragDropController2D for SymbolLayer to consume */
export interface DragHandlers {
  onFixturePointerDown: (e: React.PointerEvent, fixtureId: string) => void
  onFixturePointerEnter: (fixtureId: string) => void
  onFixturePointerLeave: () => void
  onFixtureContextMenu: (e: React.MouseEvent, fixtureId: string) => void
}

interface DragDropController2DProps {
  /** SVG element ref from BlueprintCanvas root — for coordinate conversion */
  svgRef: React.RefObject<SVGSVGElement | null>
  stageWidth?: number
  stageDepth?: number
  stageHeight?: number
  padding?: number
  /** Called every frame during drag with current state (for DimensionLayer etc.) */
  onDragUpdate?: (state: DragState2D) => void
  /** Called when drag ends */
  onDragEnd?: () => void
  /** Active tool mode — 'select' and 'move' both enable dragging (WAVE 7606) */
  toolMode?: ToolMode
  /** Called with drag handlers when the controller mounts — pass these to SymbolLayer */
  onHandlersReady?: (handlers: DragHandlers) => void
}

export const DragDropController2D: React.FC<DragDropController2DProps> = ({
  svgRef,
  stageWidth = 12,
  stageDepth = 8,
  stageHeight = 6,
  padding = 2,
  onDragUpdate,
  onDragEnd,
  toolMode = 'select',
  onHandlersReady,
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const placeFixture2D = useStageStore(s => s.placeFixture2D)
  const updateFixturePosition = useStageStore(s => s.updateFixturePosition)
  const snap = useSnapStore(s => s.snap)

  // FASE 8: selectionStore integration
  const select = useSelectionStore(s => s.select)
  const setHovered = useSelectionStore(s => s.setHovered)
  const deselectAll = useSelectionStore(s => s.deselectAll)
  const selectedIds = useSelectionStore(s => s.selectedIds)

  const [dragging, setDragging] = useState<DragState2D | null>(null)
  const dragRef = useRef<DragState2D | null>(null)

  const stageDims = useMemo<StageDimensions>(
    () => ({ width: stageWidth, depth: stageDepth, height: stageHeight, gridSize: VOXEL_SIZE }),
    [stageWidth, stageDepth, stageHeight],
  )

  // ── Shared coordinate conversion (DOM → SVG user space) ──────────────────
  const screenToSVG = useScreenToSVG(svgRef)

  // ── Offset between SVG top-left origin and 3D center-origin ───────────────
  // SVG coords: (0,0) = top-left corner of stage rect
  // 3D coords:  (0,0) = center of stage
  // Transform: svgX = worldX + stageWidth/2, svgZ = worldZ + stageDepth/2
  const offsetX = stageWidth / 2
  const offsetZ = stageDepth / 2

  // ── Find alignment target ─────────────────────────────────────────────────
  const findAlignment = useCallback(
    (x: number, z: number, excludeId: string): AlignmentLine | null => {
      for (const f of fixtures) {
        if (f.id === excludeId) continue
        // Check X axis alignment
        if (Math.abs(x - f.position.x) < ALIGN_THRESHOLD) {
          return { axis: 'x', value: f.position.x, fromFixture: f.id }
        }
        // Check Z axis alignment
        if (Math.abs(z - f.position.z) < ALIGN_THRESHOLD) {
          return { axis: 'z', value: f.position.z, fromFixture: f.id }
        }
      }
      return null
    },
    [fixtures],
  )

  // ── Start drag ─────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, fixtureId: string) => {
      e.stopPropagation()

      // Selection logic (works in all modes)
      if (e.ctrlKey || e.metaKey) {
        select(fixtureId, 'toggle')
      } else if (e.shiftKey) {
        select(fixtureId, 'add')
      } else if (!selectedIds.has(fixtureId)) {
        select(fixtureId, 'replace')
      }

      // WAVE 7606: SMART POINTER — allow drag-to-move in both 'select' and 'move' modes.
      // The 'move'-only restriction is a 3D concern. In 2D, clicking a fixture should
      // both select it AND allow immediate dragging (fluid UX).
      // Other modes ('rig', 'calibrate', 'measure') still block dragging.
      if (toolMode !== 'select' && toolMode !== 'move') return

      e.preventDefault()

      const fixture = fixtures.find(f => f.id === fixtureId)
      if (!fixture) return

      const { x, y } = screenToSVG(e.clientX, e.clientY)
      // SVG coords → 3D center-origin for store
      const worldX = x - offsetX
      const worldZ = y - offsetZ
      const snappedX = snap(worldX)
      const snappedZ = snap(worldZ)

      const state: DragState2D = {
        fixtureId,
        x: snappedX,
        z: snappedZ,
        alignment: null,
      }
      dragRef.current = state
      setDragging(state)
      onDragUpdate?.(state)
    },
    [fixtures, screenToSVG, onDragUpdate, select, selectedIds, toolMode],
  )

  // ── Context menu handler (exposed for SymbolLayer) ─────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, fixtureId: string) => {
      e.preventDefault()
      e.stopPropagation()
      select(fixtureId, 'replace')
      window.dispatchEvent(new CustomEvent('erebus:radial-menu', {
        detail: { clientX: e.clientX, clientY: e.clientY, fixtureId },
      }))
    },
    [select],
  )

  // ── Expose handlers to parent (BlueprintCanvas → SymbolLayer) ──────────────
  useEffect(() => {
    onHandlersReady?.({
      onFixturePointerDown: handlePointerDown,
      onFixturePointerEnter: setHovered,
      onFixturePointerLeave: () => setHovered(null),
      onFixtureContextMenu: handleContextMenu,
    })
  }, [onHandlersReady, handlePointerDown, setHovered, handleContextMenu])

  // ── Drag move ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return

    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const { x, y } = screenToSVG(e.clientX, e.clientY)
      // SVG coords → 3D center-origin for store/clamp
      const worldX = x - offsetX
      const worldZ = y - offsetZ

      let snappedX = snap(worldX)
      let snappedZ = snap(worldZ)

      // Clamp to Crystal Box (operates in 3D center-origin)
      const clamped = clampToCrystalBox(
        { x: snappedX, y: 0, z: snappedZ },
        stageDims,
      )
      snappedX = clamped.x
      snappedZ = clamped.z

      // Magnetic alignment (operates in 3D center-origin)
      const alignment = findAlignment(snappedX, snappedZ, dragRef.current.fixtureId)
      if (alignment) {
        if (alignment.axis === 'x') snappedX = alignment.value
        else snappedZ = alignment.value
      }

      const newState: DragState2D = {
        ...dragRef.current,
        x: snappedX,
        z: snappedZ,
        alignment,
      }
      dragRef.current = newState
      setDragging(newState)
      onDragUpdate?.(newState)
    }

    const handleUp = () => {
      if (!dragRef.current) return
      const ds = dragRef.current
      const fixture = fixtures.find(f => f.id === ds.fixtureId)
      if (fixture) {
        // Use placeFixture2D for the unified pipeline
        placeFixture2D(ds.fixtureId, ds.x, ds.z, fixture.orientation, fixture.rigId)
      }
      dragRef.current = null
      setDragging(null)
      onDragEnd?.()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragging, screenToSVG, findAlignment, stageDims, fixtures, placeFixture2D, onDragUpdate, onDragEnd, snap, offsetX, offsetZ])

  // ── Render: drag feedback only (alignment line + ghost symbol) ────────────
  // No overlay circles — interaction is handled by SymbolLayer's native events
  return (
    <g className="drag-drop-controller-2d" style={{ pointerEvents: 'none' }}>
      {/* Alignment line during drag (SVG coords = 3D + offset) */}
      {dragging?.alignment && (
        <line
          x1={dragging.alignment.axis === 'x' ? dragging.alignment.value + offsetX : -padding}
          y1={dragging.alignment.axis === 'x' ? -padding : dragging.alignment.value + offsetZ}
          x2={dragging.alignment.axis === 'x' ? dragging.alignment.value + offsetX : stageWidth + padding}
          y2={dragging.alignment.axis === 'x' ? stageDepth + padding : dragging.alignment.value + offsetZ}
          stroke="var(--obs-accent, #5EEAD4)"
          strokeWidth={1.5}
          strokeDasharray="0.05 0.05"
          opacity={0.7}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Ghost symbol during drag (SVG coords = 3D + offset) */}
      {dragging && (
        <circle
          cx={dragging.x + offsetX}
          cy={dragging.z + offsetZ}
          r={0.15}
          fill="var(--obs-ghost, rgba(94,234,212,0.12))"
          stroke="var(--obs-accent, #5EEAD4)"
          strokeWidth={1.5}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  )
}

export default DragDropController2D
