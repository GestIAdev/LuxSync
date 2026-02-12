/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ CURVE EDITOR - WAVE 2030.3: THE FORGE CANVAS
 * SVG-native keyframe curve editor with bezier support
 * 
 * FEATURES:
 * - Full responsive SVG canvas (fills container)
 * - Bezier, linear, and hold interpolation rendering
 * - Keyframe drag & drop (constrained to bounds)
 * - Double-click to add keyframe
 * - Right-click to delete keyframe
 * - Beat grid with snap
 * - Zoom (wheel) and Pan (middle-click drag)
 * - Playhead indicator
 * - Bezier handle visualization and dragging
 * 
 * ARCHITECTURE:
 * - Pure SVG, no canvas/visx/d3 — DOM events come free
 * - All coordinates computed from curve data + viewport transform
 * - Immutable: all mutations via callbacks to parent
 * 
 * PERFORMANCE:
 * - Max ~50 keyframes per curve — SVG handles this effortlessly
 * - No requestAnimationFrame loop — only re-renders on data change
 * 
 * @module views/HephaestusView/CurveEditor
 * @version WAVE 2030.3
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import type { HephCurve, HephInterpolation, HephAudioBinding, HephKeyframe } from '../../../core/hephaestus/types'
import { KeyframeContextMenu } from './KeyframeContextMenu'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PADDING = { top: 32, right: 24, bottom: 40, left: 56 }
const KEYFRAME_RADIUS = 6
const HANDLE_RADIUS = 4
const GRID_LINES_Y = 10 // Horizontal grid divisions (0.0 to 1.0)
const MIN_ZOOM = 0.2
const MAX_ZOOM = 8

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface CurveEditorProps {
  curve: HephCurve
  durationMs: number
  selectedKeyframeIdx: number | null
  playheadMs?: number
  onKeyframeAdd: (timeMs: number, value: number) => void
  onKeyframeMove: (index: number, timeMs: number, value: number) => void
  onKeyframeDelete: (index: number) => void
  onInterpolationChange: (index: number, interpolation: HephInterpolation) => void
  onBezierHandleMove: (index: number, handles: [number, number, number, number]) => void
  onKeyframeSelect: (index: number | null) => void
  onAudioBindingChange: (index: number, binding: HephAudioBinding | undefined) => void
}

/** WAVE 2030.14: Context menu state */
interface ContextMenuState {
  x: number
  y: number
  keyframeIndex: number
}

interface DragState {
  type: 'keyframe' | 'handle-cp1' | 'handle-cp2' | 'pan'
  index: number
  startX: number
  startY: number
  startTimeMs: number
  startValue: number
  startPanOffset: number
}

interface Viewport {
  panOffsetMs: number // How many ms are scrolled left
  zoom: number        // 1.0 = normal, 2.0 = zoomed in 2x
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚒️ WAVE 2030.22: VALUE EXTRACTION HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract the plottable numeric value from a keyframe value.
 * For color curves: uses hue (0-360) normalized to 0-1.
 * For numeric curves: returns the value directly.
 * 
 * This prevents NaN in all coordinate calculations.
 */
function getPlotValue(value: number | { h: number; s: number; l: number }, valueType: 'number' | 'color'): number {
  if (valueType === 'color' && typeof value === 'object' && 'h' in value) {
    // Normalize hue: 0-360 → 0-1 for canvas plotting
    return value.h / 360
  }
  // Numeric value
  return value as number
}

// ═══════════════════════════════════════════════════════════════════════════
// CURVE PATH BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function buildCurvePath(
  curve: HephCurve,
  toX: (timeMs: number) => number,
  toY: (value: number | { h: number; s: number; l: number }) => number,
): string {
  const kfs = curve.keyframes
  if (kfs.length === 0) return ''

  let path = `M ${toX(kfs[0].timeMs)} ${toY(kfs[0].value)}`

  for (let i = 0; i < kfs.length - 1; i++) {
    const kf0 = kfs[i]
    const kf1 = kfs[i + 1]
    const x0 = toX(kf0.timeMs)
    const y0 = toY(kf0.value)
    const x1 = toX(kf1.timeMs)
    const y1 = toY(kf1.value)

    switch (kf0.interpolation) {
      case 'hold':
        // Step function: horizontal then vertical
        path += ` L ${x1} ${y0} L ${x1} ${y1}`
        break

      case 'linear':
        path += ` L ${x1} ${y1}`
        break

      case 'bezier': {
        const h = kf0.bezierHandles ?? [0.42, 0, 0.58, 1]
        const cp1x = x0 + (x1 - x0) * h[0]
        const cp1y = y0 + (y1 - y0) * h[1]
        const cp2x = x0 + (x1 - x0) * h[2]
        const cp2y = y0 + (y1 - y0) * h[3]
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`
        break
      }

      default:
        path += ` L ${x1} ${y1}`
    }
  }

  return path
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTimeLabel(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${ms}ms`
}

function generateTimeGridLines(
  visibleStartMs: number,
  visibleEndMs: number,
  targetCount: number,
): number[] {
  const range = visibleEndMs - visibleStartMs
  // Choose a "nice" interval
  const rawInterval = range / targetCount
  const niceIntervals = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]
  const interval = niceIntervals.find(i => i >= rawInterval) ?? rawInterval
  const lines: number[] = []
  const start = Math.ceil(visibleStartMs / interval) * interval
  for (let t = start; t <= visibleEndMs; t += interval) {
    lines.push(t)
  }
  return lines
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const CurveEditor: React.FC<CurveEditorProps> = ({
  curve,
  durationMs,
  selectedKeyframeIdx,
  playheadMs = 0,
  onKeyframeAdd,
  onKeyframeMove,
  onKeyframeDelete,
  onInterpolationChange,
  onBezierHandleMove,
  onKeyframeSelect,
  onAudioBindingChange,
}) => {
  // ── Refs ──
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Resize state ──
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 })

  // ── Viewport (zoom/pan) ──
  const [viewport, setViewport] = useState<Viewport>({ panOffsetMs: 0, zoom: 1 })

  // ── Drag state ──
  const [drag, setDrag] = useState<DragState | null>(null)

  // ── WAVE 2030.11: Color picker state ──
  const [colorPickerOpen, setColorPickerOpen] = useState<{ keyframeIdx: number; hsl: typeof curve.keyframes[0]['value'] } | null>(null)

  // ── WAVE 2030.14: Context menu state ──
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ── ResizeObserver ──
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ── Coordinate transforms ──
  const { width, height } = dimensions
  const plotW = width - PADDING.left - PADDING.right
  const plotH = height - PADDING.top - PADDING.bottom
  const [rangeMin, rangeMax] = curve.range
  const rangeSpan = rangeMax - rangeMin || 1
  const isColorCurve = curve.valueType === 'color'

  const visibleDurationMs = durationMs / viewport.zoom
  const visibleStartMs = viewport.panOffsetMs
  const visibleEndMs = visibleStartMs + visibleDurationMs

  const toX = useCallback((timeMs: number) => {
    return PADDING.left + ((timeMs - visibleStartMs) / visibleDurationMs) * plotW
  }, [visibleStartMs, visibleDurationMs, plotW])

  // ⚒️ WAVE 2030.22: Unified Y transform using getPlotValue
  const toY = useCallback((value: number | typeof curve.keyframes[0]['value']) => {
    const plotValue = getPlotValue(value, curve.valueType)
    // For color curves, plotValue is already 0-1 normalized hue
    // For numeric curves, we need to map range to canvas
    if (isColorCurve) {
      // plotValue is 0-1 → map to canvas height
      return PADDING.top + plotH - plotValue * plotH
    }
    // Standard numeric range transform
    return PADDING.top + plotH - ((plotValue - rangeMin) / rangeSpan) * plotH
  }, [plotH, rangeMin, rangeSpan, isColorCurve, curve.valueType])

  const fromX = useCallback((px: number) => {
    return visibleStartMs + ((px - PADDING.left) / plotW) * visibleDurationMs
  }, [visibleStartMs, visibleDurationMs, plotW])

  // WAVE 2030.11: Color-aware inverse Y transform
  const fromY = useCallback((py: number) => {
    const normalized = 1 - (py - PADDING.top) / plotH
    if (isColorCurve) {
      // Denormalize: 0-1 → 0-360 (hue only, S/L unchanged)
      return normalized * 360
    }
    return rangeMin + normalized * rangeSpan
  }, [plotH, rangeMin, rangeSpan, isColorCurve])

  // ── SVG Path ──
  const curvePath = useMemo(
    () => buildCurvePath(curve, toX, toY),
    [curve, toX, toY]
  )

  // ── Grid lines ──
  const timeGridLines = useMemo(
    () => generateTimeGridLines(visibleStartMs, visibleEndMs, 12),
    [visibleStartMs, visibleEndMs]
  )

  const valueGridLines = useMemo(() => {
    const lines: number[] = []
    for (let i = 0; i <= GRID_LINES_Y; i++) {
      lines.push(rangeMin + (i / GRID_LINES_Y) * rangeSpan)
    }
    return lines
  }, [rangeMin, rangeSpan])

  // ── Get cursor position relative to SVG ──
  const getSVGPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Double-click: Add keyframe ──
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const pt = getSVGPoint(e)
    const timeMs = Math.max(0, Math.min(fromX(pt.x), durationMs))
    const value = Math.max(rangeMin, Math.min(fromY(pt.y), rangeMax))
    onKeyframeAdd(Math.round(timeMs), parseFloat(value.toFixed(4)))
  }, [getSVGPoint, fromX, fromY, durationMs, rangeMin, rangeMax, onKeyframeAdd])

  // ── Click on empty space: Deselect ──
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only if clicking directly on the background (not a keyframe)
    if ((e.target as HTMLElement).classList.contains('heph-curve-bg')) {
      onKeyframeSelect(null)
    }
  }, [onKeyframeSelect])

  // ── Keyframe mousedown: Start drag ──
  const handleKeyframeMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    e.preventDefault()

    // WAVE 2030.14: Right-click = open context menu
    if (e.button === 2) {
      setContextMenu({ x: e.clientX, y: e.clientY, keyframeIndex: index })
      return
    }

    onKeyframeSelect(index)

    const pt = getSVGPoint(e)
    const kf = curve.keyframes[index]
    setDrag({
      type: 'keyframe',
      index,
      startX: pt.x,
      startY: pt.y,
      startTimeMs: kf.timeMs,
      startValue: kf.value as number,
      startPanOffset: viewport.panOffsetMs,
    })
  }, [getSVGPoint, curve.keyframes, onKeyframeSelect, viewport.panOffsetMs])

  // ── Bezier handle mousedown ──
  const handleBezierHandleMouseDown = useCallback((
    e: React.MouseEvent,
    index: number,
    handleType: 'handle-cp1' | 'handle-cp2',
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const pt = getSVGPoint(e)
    const kf = curve.keyframes[index]
    setDrag({
      type: handleType,
      index,
      startX: pt.x,
      startY: pt.y,
      startTimeMs: kf.timeMs,
      startValue: kf.value as number,
      startPanOffset: viewport.panOffsetMs,
    })
  }, [getSVGPoint, curve.keyframes, viewport.panOffsetMs])

  // ── Middle-click: Start pan ──
  const handleMiddleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return
    e.preventDefault()
    const pt = getSVGPoint(e)
    setDrag({
      type: 'pan',
      index: -1,
      startX: pt.x,
      startY: 0,
      startTimeMs: 0,
      startValue: 0,
      startPanOffset: viewport.panOffsetMs,
    })
  }, [getSVGPoint, viewport.panOffsetMs])

  // ── Global mousemove ──
  useEffect(() => {
    if (!drag) return

    const handleMouseMove = (e: MouseEvent) => {
      const pt = getSVGPoint(e)

      if (drag.type === 'keyframe') {
        const deltaXMs = ((pt.x - drag.startX) / plotW) * visibleDurationMs
        const deltaYVal = -((pt.y - drag.startY) / plotH) * rangeSpan
        const newTimeMs = Math.max(0, Math.min(drag.startTimeMs + deltaXMs, durationMs))
        const newValue = Math.max(rangeMin, Math.min(drag.startValue + deltaYVal, rangeMax))
        onKeyframeMove(drag.index, Math.round(newTimeMs), parseFloat(newValue.toFixed(4)))
      }

      if (drag.type === 'handle-cp1' || drag.type === 'handle-cp2') {
        const kf = curve.keyframes[drag.index]
        const nextKf = curve.keyframes[drag.index + 1]
        if (!nextKf) return

        const segDx = toX(nextKf.timeMs) - toX(kf.timeMs)
        // ⚒️ WAVE 2030.22: Use getPlotValue instead of casting to number
        const kfPlotValue = getPlotValue(kf.value, curve.valueType)
        const nextKfPlotValue = getPlotValue(nextKf.value, curve.valueType)
        const segDy = toY(nextKf.value) - toY(kf.value)
        if (segDx === 0) return

        const currentHandles = kf.bezierHandles ?? [0.42, 0, 0.58, 1]
        const newHandles: [number, number, number, number] = [...currentHandles]

        if (drag.type === 'handle-cp1') {
          // CP1 position relative to segment
          const relX = (pt.x - toX(kf.timeMs)) / segDx
          const relY = segDy !== 0
            ? (pt.y - toY(kf.value)) / segDy
            : 0
          newHandles[0] = Math.max(0, Math.min(1, relX))
          newHandles[1] = relY
        } else {
          // CP2 position relative to segment
          const relX = (pt.x - toX(kf.timeMs)) / segDx
          const relY = segDy !== 0
            ? (pt.y - toY(kf.value)) / segDy
            : 1
          newHandles[2] = Math.max(0, Math.min(1, relX))
          newHandles[3] = relY
        }

        onBezierHandleMove(drag.index, newHandles)
      }

      if (drag.type === 'pan') {
        const deltaXMs = -((pt.x - drag.startX) / plotW) * visibleDurationMs
        const newPan = Math.max(0, Math.min(
          drag.startPanOffset + deltaXMs,
          durationMs - visibleDurationMs,
        ))
        setViewport(prev => ({ ...prev, panOffsetMs: newPan }))
      }
    }

    const handleMouseUp = () => {
      setDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag, plotW, plotH, visibleDurationMs, rangeSpan, rangeMin, rangeMax, durationMs, curve.keyframes, toX, toY, onKeyframeMove, onBezierHandleMove, getSVGPoint])

  // ── Wheel: Zoom ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setViewport(prev => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(prev.zoom * delta, MAX_ZOOM))
      // Zoom toward cursor position
      const pt = getSVGPoint(e)
      const cursorTimeMs = fromX(pt.x)
      const newVisibleDuration = durationMs / newZoom
      const newPan = Math.max(0, Math.min(
        cursorTimeMs - (cursorTimeMs - prev.panOffsetMs) * (newVisibleDuration / visibleDurationMs),
        durationMs - newVisibleDuration,
      ))
      return { zoom: newZoom, panOffsetMs: Math.max(0, newPan) }
    })
  }, [getSVGPoint, fromX, durationMs, visibleDurationMs])

  // ── Right-click prevention ──
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // ── WAVE 2030.11: Color picker handlers ──
  const hslToHex = useCallback((h: number, s: number, l: number): string => {
    l /= 100
    const a = s * Math.min(l, 1 - l) / 100
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }, [])

  const hexToHSL = useCallback((hex: string): { h: number; s: number; l: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return { h: 0, s: 0, l: 0 }
    
    let r = parseInt(result[1], 16) / 255
    let g = parseInt(result[2], 16) / 255
    let b = parseInt(result[3], 16) / 255
    
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }
    
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }, [])

  const handleKeyframeDoubleClick = useCallback((kfIdx: number, kfValue: typeof curve.keyframes[0]['value']) => {
    if (typeof kfValue === 'object' && 'h' in kfValue) {
      setColorPickerOpen({ keyframeIdx: kfIdx, hsl: kfValue })
    }
  }, [])

  const handleColorChange = useCallback((hex: string) => {
    if (!colorPickerOpen) return
    const hsl = hexToHSL(hex)
    onKeyframeMove(colorPickerOpen.keyframeIdx, curve.keyframes[colorPickerOpen.keyframeIdx].timeMs, hsl as any)
    setColorPickerOpen({ keyframeIdx: colorPickerOpen.keyframeIdx, hsl })
  }, [colorPickerOpen, hexToHSL, onKeyframeMove, curve.keyframes])

  // ── Get lane color ──
  const PARAM_COLORS: Record<string, string> = {
    intensity: '#fbbf24', color: '#a855f7', white: '#e2e8f0', amber: '#f97316',
    speed: '#22d3ee', pan: '#3b82f6', tilt: '#6366f1', zoom: '#14b8a6',
    strobe: '#ef4444', globalComp: '#8b5cf6', width: '#06b6d4', direction: '#10b981',
  }
  const curveColor = PARAM_COLORS[curve.paramId] ?? '#00fff0'

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div ref={containerRef} className="heph-curve-editor">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="heph-curve-svg"
        onDoubleClick={handleDoubleClick}
        onClick={handleBackgroundClick}
        onMouseDown={handleMiddleMouseDown}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        <defs>
          {/* Glow filter for neon curve */}
          <filter id="heph-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle grid pattern */}
          <pattern id="heph-grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.06)" />
          </pattern>
        </defs>

        {/* ═══ BACKGROUND ═══ */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="var(--bg-deepest, #0a0a0f)"
          className="heph-curve-bg"
        />

        {/* ═══ PLOT AREA BACKGROUND ═══ */}
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotW}
          height={plotH}
          fill="rgba(10, 10, 20, 0.8)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
          rx="2"
          className="heph-curve-bg"
        />

        {/* ═══ GRID DOTS ═══ */}
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotW}
          height={plotH}
          fill="url(#heph-grid-dots)"
        />

        {/* ═══ HORIZONTAL GRID LINES (value axis) ═══ */}
        {valueGridLines.map((v, i) => {
          const y = toY(v)
          return (
            <g key={`hgrid-${i}`}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + plotW}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                className="heph-grid-label"
                fill="rgba(255,255,255,0.25)"
                fontSize="10"
                fontFamily="monospace"
              >
                {v.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* ═══ VERTICAL GRID LINES (time axis) ═══ */}
        {timeGridLines.map((t, i) => {
          const x = toX(t)
          if (x < PADDING.left || x > PADDING.left + plotW) return null
          return (
            <g key={`vgrid-${i}`}>
              <line
                x1={x}
                y1={PADDING.top}
                x2={x}
                y2={PADDING.top + plotH}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <text
                x={x}
                y={height - PADDING.bottom + 16}
                textAnchor="middle"
                className="heph-grid-label"
                fill="rgba(255,255,255,0.25)"
                fontSize="10"
                fontFamily="monospace"
              >
                {formatTimeLabel(t)}
              </text>
            </g>
          )
        })}

        {/* ═══ CURVE PATH (glow layer) ═══ */}
        <path
          d={curvePath}
          fill="none"
          stroke={curveColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#heph-glow)"
          opacity="0.4"
        />

        {/* ═══ CURVE PATH (main) ═══ */}
        <path
          d={curvePath}
          fill="none"
          stroke={curveColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ═══ BEZIER HANDLES ═══ */}
        {curve.keyframes.map((kf, i) => {
          if (kf.interpolation !== 'bezier' || i >= curve.keyframes.length - 1) return null
          const nextKf = curve.keyframes[i + 1]
          const handles = kf.bezierHandles ?? [0.42, 0, 0.58, 1]

          const x0 = toX(kf.timeMs)
          const y0 = toY(kf.value)
          const x1 = toX(nextKf.timeMs)
          const y1 = toY(nextKf.value)

          const cp1x = x0 + (x1 - x0) * handles[0]
          const cp1y = y0 + (y1 - y0) * handles[1]
          const cp2x = x0 + (x1 - x0) * handles[2]
          const cp2y = y0 + (y1 - y0) * handles[3]

          const isSelected = selectedKeyframeIdx === i

          return (
            <g key={`handles-${i}`} opacity={isSelected ? 1 : 0.3}>
              {/* Handle lines */}
              <line
                x1={x0} y1={y0} x2={cp1x} y2={cp1y}
                stroke={curveColor} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
              />
              <line
                x1={x1} y1={y1} x2={cp2x} y2={cp2y}
                stroke={curveColor} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
              />

              {/* CP1 handle */}
              <circle
                cx={cp1x} cy={cp1y} r={HANDLE_RADIUS}
                fill="transparent"
                stroke={curveColor}
                strokeWidth="1.5"
                className="heph-handle"
                onMouseDown={(e) => handleBezierHandleMouseDown(e, i, 'handle-cp1')}
              />

              {/* CP2 handle */}
              <circle
                cx={cp2x} cy={cp2y} r={HANDLE_RADIUS}
                fill="transparent"
                stroke={curveColor}
                strokeWidth="1.5"
                className="heph-handle"
                onMouseDown={(e) => handleBezierHandleMouseDown(e, i, 'handle-cp2')}
              />
            </g>
          )
        })}

        {/* ═══ KEYFRAME NODES ═══ */}
        {curve.keyframes.map((kf, i) => {
          const x = toX(kf.timeMs)
          const y = toY(kf.value)
          const isSelected = selectedKeyframeIdx === i

          // WAVE 2030.11: Color keyframes render with their actual HSL color
          const isColorValue = typeof kf.value === 'object' && 'h' in kf.value
          const fillColor = isColorValue && typeof kf.value === 'object' && 'h' in kf.value
            ? `hsl(${kf.value.h}, ${kf.value.s}%, ${kf.value.l}%)`
            : (isSelected ? curveColor : 'var(--bg-deepest, #0a0a0f)')

          // WAVE 2030.14: Audio-bound keyframes get cyan glow
          const hasAudioBinding = kf.audioBinding && kf.audioBinding.source !== 'none'
          const keyframeClass = `heph-keyframe${hasAudioBinding ? ' heph-keyframe--audio-bound' : ''}`

          // Clip to plot area
          if (x < PADDING.left - KEYFRAME_RADIUS || x > PADDING.left + plotW + KEYFRAME_RADIUS) return null

          return (
            <g key={`kf-${i}`}>
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={x} cy={y} r={KEYFRAME_RADIUS + 4}
                  fill="none"
                  stroke={curveColor}
                  strokeWidth="1"
                  opacity="0.4"
                  className="heph-kf-ring"
                />
              )}

              {/* Keyframe node */}
              <circle
                cx={x}
                cy={y}
                r={KEYFRAME_RADIUS}
                fill={fillColor}
                stroke={curveColor}
                strokeWidth="2"
                className={keyframeClass}
                onMouseDown={(e) => handleKeyframeMouseDown(e, i)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  handleKeyframeDoubleClick(i, kf.value)
                }}
                onContextMenu={(e) => e.preventDefault()}
              />

              {/* Interpolation type indicator */}
              {kf.interpolation === 'hold' && (
                <rect
                  x={x - 3} y={y - 3} width={6} height={6}
                  fill={curveColor} opacity="0.6"
                  pointerEvents="none"
                />
              )}
            </g>
          )
        })}

        {/* ═══ PLAYHEAD ═══ */}
        {playheadMs >= visibleStartMs && playheadMs <= visibleEndMs && (
          <g>
            <line
              x1={toX(playheadMs)}
              y1={PADDING.top}
              x2={toX(playheadMs)}
              y2={PADDING.top + plotH}
              stroke="#ef4444"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <polygon
              points={`${toX(playheadMs) - 5},${PADDING.top} ${toX(playheadMs) + 5},${PADDING.top} ${toX(playheadMs)},${PADDING.top + 8}`}
              fill="#ef4444"
              opacity="0.8"
            />
          </g>
        )}

        {/* ═══ AXIS LABELS ═══ */}
        <text
          x={PADDING.left + plotW / 2}
          y={height - 4}
          textAnchor="middle"
          fill="rgba(255,255,255,0.15)"
          fontSize="10"
          fontFamily="monospace"
          letterSpacing="2"
        >
          TIME
        </text>
        <text
          x={12}
          y={PADDING.top + plotH / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.15)"
          fontSize="10"
          fontFamily="monospace"
          letterSpacing="2"
          transform={`rotate(-90, 12, ${PADDING.top + plotH / 2})`}
        >
          VALUE
        </text>

        {/* ═══ ZOOM INDICATOR ═══ */}
        <text
          x={width - PADDING.right}
          y={PADDING.top - 8}
          textAnchor="end"
          fill="rgba(255,255,255,0.2)"
          fontSize="9"
          fontFamily="monospace"
        >
          {viewport.zoom.toFixed(1)}x
        </text>

        {/* ═══ UX HINTS - WAVE 2030.9 ═══ */}
        <text
          x={PADDING.left + plotW / 2}
          y={height - PADDING.bottom + 28}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="500"
          letterSpacing="0.5"
        >
          Double-click to add • Drag to move • Right-click to delete
        </text>
      </svg>

      {/* ═══ COLOR PICKER MODAL - WAVE 2030.11 ═══ */}
      {colorPickerOpen && typeof colorPickerOpen.hsl === 'object' && 'h' in colorPickerOpen.hsl && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-surface, #1c1c1e)',
            border: '1px solid var(--accent-primary, #ff6b2b)',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            zIndex: 10000,
          }}
        >
          <div style={{ marginBottom: '12px', color: '#e2e8f0', fontSize: '12px', fontWeight: 500 }}>
            Edit Color (Keyframe {colorPickerOpen.keyframeIdx + 1})
          </div>
          <input
            type="color"
            value={hslToHex(colorPickerOpen.hsl.h, colorPickerOpen.hsl.s, colorPickerOpen.hsl.l)}
            onChange={(e) => handleColorChange(e.target.value)}
            style={{ width: '200px', height: '40px', cursor: 'pointer', border: 'none', borderRadius: '4px' }}
          />
          <button
            onClick={() => setColorPickerOpen(null)}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '8px',
              background: 'var(--accent-primary, #ff6b2b)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* ═══ WAVE 2030.14: KEYFRAME CONTEXT MENU ═══ */}
      {contextMenu && curve.keyframes[contextMenu.keyframeIndex] && (
        <KeyframeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentInterpolation={curve.keyframes[contextMenu.keyframeIndex].interpolation}
          currentAudioBinding={curve.keyframes[contextMenu.keyframeIndex].audioBinding}
          onClose={() => setContextMenu(null)}
          onDelete={() => {
            onKeyframeDelete(contextMenu.keyframeIndex)
            setContextMenu(null)
          }}
          onInterpolationChange={(interp) => {
            onInterpolationChange(contextMenu.keyframeIndex, interp)
            setContextMenu(null)
          }}
          onAudioBind={(source) => {
            if (source === 'none') {
              onAudioBindingChange(contextMenu.keyframeIndex, undefined)
            } else {
              onAudioBindingChange(contextMenu.keyframeIndex, {
                source,
                inputRange: [0, 1],
                outputRange: [0, 1],
                smoothing: 0.1,
              })
            }
            setContextMenu(null)
          }}
        />
      )}
    </div>
  )
}
