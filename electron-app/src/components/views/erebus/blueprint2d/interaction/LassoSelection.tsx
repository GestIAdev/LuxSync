import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// LassoSelection — Selección Múltiple por Lazo (2D)
// PROYECTO EREBUS FASE 9
//
// Mecánica: click y arrastre en vacío (no sobre un fixture) dibuja un
// rectángulo con relleno --obs-ghost y borde sólido. Al soltar, selecciona
// todas las entidades que intersectan el rectángulo.
//
// Diseño visual: Rectángulo con relleno --obs-ghost y borde que se
// solidifica al cerrar.
// ═══════════════════════════════════════════════════════════════════════════

interface LassoRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface LassoSelectionProps {
  /** SVG element ref for coordinate conversion */
  svgRef: React.RefObject<SVGSVGElement | null>
  stageWidth?: number
  stageDepth?: number
  padding?: number
}

export const LassoSelection: React.FC<LassoSelectionProps> = ({
  svgRef,
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const selectMultiple = useSelectionStore(s => s.selectMultiple)
  const deselectAll = useSelectionStore(s => s.deselectAll)

  const [lasso, setLasso] = useState<LassoRect | null>(null)
  const isLassoingRef = useRef(false)

  // ── Convert screen coords to SVG meters ────────────────────────────────────
  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }, [svgRef])

  // ── Start lasso on pointer down in empty space ─────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only start lasso on left click without Shift/Ctrl
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return

      // Check if clicking on empty space (not on a fixture circle)
      const target = e.target as SVGElement
      if (target.tagName !== 'svg' && target.tagName !== 'rect' && target.tagName !== 'g') return

      e.preventDefault()
      e.stopPropagation()

      const { x, y } = screenToSVG(e.clientX, e.clientY)
      isLassoingRef.current = true
      setLasso({ startX: x, startY: y, endX: x, endY: y })
    },
    [screenToSVG],
  )

  // ── Update lasso on pointer move ───────────────────────────────────────────
  useEffect(() => {
    if (!isLassoingRef.current) return

    const handleMove = (e: PointerEvent) => {
      if (!isLassoingRef.current || !lasso) return
      const { x, y } = screenToSVG(e.clientX, e.clientY)
      setLasso(prev => prev ? { ...prev, endX: x, endY: y } : null)
    }

    const handleUp = () => {
      if (!isLassoingRef.current || !lasso) {
        isLassoingRef.current = false
        return
      }

      // Calculate bounding box
      const minX = Math.min(lasso.startX, lasso.endX)
      const maxX = Math.max(lasso.startX, lasso.endX)
      const minY = Math.min(lasso.startY, lasso.endY)
      const maxY = Math.max(lasso.startY, lasso.endY)

      // Only select if lasso is big enough (avoid accidental clicks)
      const MIN_SIZE = 0.1
      if (maxX - minX < MIN_SIZE || maxY - minY < MIN_SIZE) {
        isLassoingRef.current = false
        setLasso(null)
        return
      }

      // Find fixtures within the lasso rectangle
      const selectedIds: string[] = []
      for (const f of fixtures) {
        const fx = f.position.x
        const fz = f.position.z
        if (fx >= minX && fx <= maxX && fz >= minY && fz <= maxY) {
          selectedIds.push(f.id)
        }
      }

      if (selectedIds.length > 0) {
        selectMultiple(selectedIds, 'replace')
      } else {
        deselectAll()
      }

      isLassoingRef.current = false
      setLasso(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [lasso, fixtures, selectMultiple, deselectAll, screenToSVG])

  // ── Render lasso rectangle ─────────────────────────────────────────────────
  if (!lasso) {
    // Render invisible capture rect for pointer down in empty space
    return (
      <rect
        x={-padding}
        y={-padding}
        width={stageWidth + padding * 2}
        height={stageDepth + padding * 2}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
      />
    )
  }

  const x = Math.min(lasso.startX, lasso.endX)
  const y = Math.min(lasso.startY, lasso.endY)
  const w = Math.abs(lasso.endX - lasso.startX)
  const h = Math.abs(lasso.endY - lasso.startY)

  return (
    <>
      {/* Invisible capture rect */}
      <rect
        x={-padding}
        y={-padding}
        width={stageWidth + padding * 2}
        height={stageDepth + padding * 2}
        fill="transparent"
        style={{ pointerEvents: 'all' }}
        onPointerDown={handlePointerDown}
      />

      {/* Visible lasso rectangle */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="var(--obs-ghost)"
        stroke="var(--obs-accent)"
        strokeWidth={0.006}
        pointerEvents="none"
        style={{
          animation: 'erebus-lasso-pulse 0.3s ease-out',
        }}
      />
    </>
  )
}

export default LassoSelection
