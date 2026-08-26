import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import type { ToolMode } from '../../ErebusShell'
import { useScreenToSVG } from './screenToSVG'

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
  /** Active tool mode — lasso only active in 'select' mode */
  toolMode?: ToolMode
}

export const LassoSelection: React.FC<LassoSelectionProps> = ({
  svgRef,
  stageWidth = 12,
  stageDepth = 8,
  padding = 2,
  toolMode = 'select',
}) => {
  const fixtures = useStageStore(s => s.fixtures)
  const selectMultiple = useSelectionStore(s => s.selectMultiple)
  const deselectAll = useSelectionStore(s => s.deselectAll)

  const [lasso, setLasso] = useState<LassoRect | null>(null)
  const isLassoingRef = useRef(false)

  // ── Convert screen coords to SVG meters (shared utility) ───────────────────
  const screenToSVG = useScreenToSVG(svgRef)

  // ── Start lasso on pointer down in empty space ─────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only start lasso on left click without Shift/Ctrl
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return
      // Only active in select mode
      if (toolMode !== 'select') return

      // 🩸 WAVE 7604: STRICT target filter — only start lasso on the SVG root,
      // the background rect (data-bg), or THIS component's own capture rect.
      // Fixture symbols are <g> elements with their own pointer handlers, so
      // they won't reach here. But our own transparent capture rect WILL reach
      // here, and it must be allowed through.
      const target = e.target as SVGElement
      const isSvgRoot = target.tagName === 'svg'
      const isBgRect = target.tagName === 'rect' && target.getAttribute('data-bg')
      const isOwnCaptureRect = target.tagName === 'rect' && target.getAttribute('data-lasso-capture')
      if (!isSvgRoot && !isBgRect && !isOwnCaptureRect) return

      e.preventDefault()
      e.stopPropagation()

      const { x, y } = screenToSVG(e.clientX, e.clientY)
      isLassoingRef.current = true
      setLasso({ startX: x, startY: y, endX: x, endY: y })
    },
    [screenToSVG, toolMode],
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
        // WAVE 7606: Click without drag on empty space → deselect all
        isLassoingRef.current = false
        setLasso(null)
        deselectAll()
        return
      }

      // Find fixtures within the lasso rectangle (SVG coords = 3D + offset)
      const offsetX = stageWidth / 2
      const offsetZ = stageDepth / 2
      const selectedIds: string[] = []
      for (const f of fixtures) {
        const fx = f.position.x + offsetX
        const fz = f.position.z + offsetZ
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
  }, [lasso, fixtures, selectMultiple, deselectAll, screenToSVG, stageWidth, stageDepth])

  // ── Render lasso rectangle ─────────────────────────────────────────────────
  if (!lasso) {
    // Render invisible capture rect for pointer down in empty space
    return (
      <rect
        data-lasso-capture="true"
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
        data-lasso-capture="true"
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
