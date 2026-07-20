import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { snapToVoxel, VOXEL_SIZE, clampToCrystalBox } from '../../../../../core/stage/ShowFileV2'
import type { FixtureV2, StageDimensions } from '../../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// DragDropController2D — Arrastre y Alineación en el plano SVG
// PROYECTO EREBUS FASE 7 + FASE 8
//
// Intercepta eventos de puntero SVG para mover fixtures en el plano XZ.
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

interface DragDropController2DProps {
  stageWidth?: number
  stageDepth?: number
  stageHeight?: number
  padding?: number
  /** Called every frame during drag with current state (for DimensionLayer etc.) */
  onDragUpdate?: (state: DragState2D) => void
  /** Called when drag ends */
  onDragEnd?: () => void
}

export const DragDropController2D: React.FC<DragDropController2DProps> = ({
  stageWidth = 12,
  stageDepth = 8,
  stageHeight = 6,
  padding = 2,
  onDragUpdate,
  onDragEnd,
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const placeFixture2D = useStageStore(s => s.placeFixture2D)
  const updateFixturePosition = useStageStore(s => s.updateFixturePosition)

  // FASE 8: selectionStore integration
  const select = useSelectionStore(s => s.select)
  const setHovered = useSelectionStore(s => s.setHovered)
  const deselectAll = useSelectionStore(s => s.deselectAll)
  const selectedIds = useSelectionStore(s => s.selectedIds)

  const [dragging, setDragging] = useState<DragState2D | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState2D | null>(null)

  const stageDims = useMemo<StageDimensions>(
    () => ({ width: stageWidth, depth: stageDepth, height: stageHeight, gridSize: VOXEL_SIZE }),
    [stageWidth, stageDepth, stageHeight],
  )

  // ── Convert screen coords to SVG meters ──────────────────────────────────
  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, z: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, z: 0 }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, z: svgPt.y }
  }, [])

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
      e.preventDefault()

      const fixture = fixtures.find(f => f.id === fixtureId)
      if (!fixture) return

      // FASE 8: Notify selectionStore (Shift = add, plain = replace)
      if (!e.shiftKey && !selectedIds.has(fixtureId)) {
        select(fixtureId, 'replace')
      } else if (e.shiftKey) {
        select(fixtureId, 'add')
      }

      const { x, z } = screenToSVG(e.clientX, e.clientY)
      const snappedX = snapToVoxel(x)
      const snappedZ = snapToVoxel(z)

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
    [fixtures, screenToSVG, onDragUpdate, select, selectedIds],
  )

  // ── Drag move ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return

    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const { x, z } = screenToSVG(e.clientX, e.clientY)

      let snappedX = snapToVoxel(x)
      let snappedZ = snapToVoxel(z)

      // Clamp to Crystal Box
      const clamped = clampToCrystalBox(
        { x: snappedX, y: 0, z: snappedZ },
        stageDims,
      )
      snappedX = clamped.x
      snappedZ = clamped.z

      // Magnetic alignment
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
  }, [dragging, screenToSVG, findAlignment, stageDims, fixtures, placeFixture2D, onDragUpdate, onDragEnd])

  // ── Render: invisible interaction overlays on each fixture ─────────────────
  // We render transparent circles over each fixture position to capture pointer events
  return (
    <g className="drag-drop-controller-2d" style={{ pointerEvents: dragging ? 'none' : 'auto' }}>
      {fixtures.map(f => (
        <circle
          key={f.id}
          cx={f.position.x}
          cy={f.position.z}
          r={0.2}
          fill="transparent"
          style={{
            cursor: 'grab',
            pointerEvents: 'all',
            stroke: selectedIds.has(f.id) ? 'var(--obs-accent, #5EEAD4)' : 'transparent',
            strokeWidth: 0.004,
          }}
          onPointerDown={(e) => handlePointerDown(e, f.id)}
          onPointerEnter={() => setHovered(f.id)}
          onPointerLeave={() => setHovered(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            select(f.id, 'replace')
            window.dispatchEvent(new CustomEvent('erebus:radial-menu', {
              detail: { clientX: e.clientX, clientY: e.clientY, fixtureId: f.id },
            }))
          }}
        />
      ))}

      {/* Alignment line during drag */}
      {dragging?.alignment && (
        <line
          x1={dragging.alignment.axis === 'x' ? dragging.alignment.value : -padding}
          y1={dragging.alignment.axis === 'x' ? -padding : dragging.alignment.value}
          x2={dragging.alignment.axis === 'x' ? dragging.alignment.value : stageWidth + padding}
          y2={dragging.alignment.axis === 'x' ? stageDepth + padding : dragging.alignment.value}
          stroke="var(--obs-accent, #5EEAD4)"
          strokeWidth={0.004}
          strokeDasharray="0.05 0.05"
          opacity={0.7}
          pointerEvents="none"
        />
      )}

      {/* Ghost symbol during drag */}
      {dragging && (
        <circle
          cx={dragging.x}
          cy={dragging.z}
          r={0.15}
          fill="var(--obs-ghost, rgba(94,234,212,0.12))"
          stroke="var(--obs-accent, #5EEAD4)"
          strokeWidth={0.006}
          pointerEvents="none"
        />
      )}
    </g>
  )
}

export default DragDropController2D
