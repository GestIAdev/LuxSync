import React, { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// RulerLayer — CAD-style measurement rulers for the 2D BlueprintCanvas
// WAVE 7647-EREBUS-RULER + 7648-LOD + 7649-INTERACTIVE + 7651 + 7655-PATH
//
// Renders tick marks and metric labels along the top (X-axis) and left
// (Z-axis) edges of the canvas. The rulers are positioned at the current
// viewBox edges (screen-fixed), so they stay visible during pan/zoom while
// showing the correct world coordinates.
//
// WAVE 7655: Tick marks are consolidated into single <path> elements per
//   ruler axis (minor ticks path + major ticks path). Text labels remain
//   individual <text> nodes (they need unique positions/transforms). This
//   reduces ~450 <line> React nodes to ~4 <path> nodes.
//
// WAVE 7651 FIX: Rulers are drawn INWARDS from the viewBox edges (downwards
// for X-axis, rightwards for Z-axis). The previous version drew them
// OUTWARDS (above/left of the viewBox), which caused them to be clipped by
// the SVG's overflow:hidden. Now the ruler bands sit just inside the
// viewport, overlapping the top/left margin of the content.
//
// Coordinate system (center-origin):
//   worldX = svgX - stageWidth/2  (left = negative, right = positive)
//   worldZ = svgZ - stageDepth/2  (back/top = negative, front/bottom = positive)
//
// WAVE 7648: All visual constants are in SCREEN PIXELS, converted to world
// space via pixelsPerMeter. This ensures ticks, text, and ruler thickness
// remain legible regardless of stage dimensions or zoom level.
//
// WAVE 7649: Dynamic LOD — label spacing is computed from pixelsPerMeter so
// labels NEVER overlap. Ticks are only generated for the visible viewBox
// range, not the entire stage. React.memo prevents re-renders from mouse
// moves that don't change the viewport.
//
// All <path>/<line> elements use vectorEffect="non-scaling-stroke".
// ═══════════════════════════════════════════════════════════════════════════

interface RulerLayerProps {
  /** Visible viewBox X (world meters, top-left origin) */
  viewBoxX: number
  /** Visible viewBox Z (world meters, top-left origin) */
  viewBoxZ: number
  /** Visible viewBox width (world meters) */
  viewBoxWidth: number
  /** Visible viewBox height (world meters) */
  viewBoxHeight: number
  /** Stage width for center-origin label calculation */
  stageWidth: number
  /** Stage depth for center-origin label calculation */
  stageDepth: number
  /** Screen pixels per world meter (scales with zoom) */
  pixelsPerMeter: number
}

// ── Visual constants (SCREEN PIXELS) ──────────────────────────────────────
const RULER_THICKNESS_PX = 28
const MAJOR_TICK_LEN_PX = 10
const MINOR_TICK_LEN_PX = 5
const EMPHASIS_TICK_LEN_PX = 16
const LABEL_FONT_SIZE_PX = 11
const STROKE_PX = 1
const MINOR_STROKE_PX = 0.5

// ── LOD: minimum screen pixels between labels ─────────────────────────────
const MIN_LABEL_SPACING_PX = 24  // labels need at least this many screen px
const MIN_MINOR_TICK_PX = 8      // minor ticks need at least this many screen px

// ── Candidate label spacings (world meters), ascending ────────────────────
const LABEL_SPACING_CANDIDATES = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]

/**
 * Picks the smallest label spacing where labels won't overlap at the current
 * zoom level. This ensures labels are always legible — dense when zoomed in,
 * sparse when zoomed out.
 */
function pickLabelSpacing(pxPerM: number): number {
  for (const spacing of LABEL_SPACING_CANDIDATES) {
    if (spacing * pxPerM >= MIN_LABEL_SPACING_PX) return spacing
  }
  return 100
}

/**
 * Formats a world coordinate as a label string, stripping trailing zeros.
 *   0      → "0"
 *   5      → "5m"
 *   0.25   → "0.25m"
 *   1.5    → "1.5m"
 */
function formatLabel(world: number, spacing: number): string {
  if (world === 0) return '0'
  const decimals = spacing < 1 ? 2 : 0
  return `${parseFloat(world.toFixed(decimals))}m`
}

const RulerLayerComponent: React.FC<RulerLayerProps> = ({
  viewBoxX,
  viewBoxZ,
  viewBoxWidth,
  viewBoxHeight,
  stageWidth,
  stageDepth,
  pixelsPerMeter,
}) => {
  // WAVE 7654: Guard against NaN
  const pxPerM = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0
    ? pixelsPerMeter
    : 1
  const toWorld = (px: number) => px / pxPerM

  const rulerThickness = toWorld(RULER_THICKNESS_PX)
  const majorTickLen = toWorld(MAJOR_TICK_LEN_PX)
  const minorTickLen = toWorld(MINOR_TICK_LEN_PX)
  const emphasisTickLen = toWorld(EMPHASIS_TICK_LEN_PX)
  const labelFontSize = toWorld(LABEL_FONT_SIZE_PX)

  // ── Dynamic LOD ──────────────────────────────────────────────────────────
  const labelSpacing = pickLabelSpacing(pxPerM)
  const minorSpacing = labelSpacing / 5
  const showMinorTicks = minorSpacing * pxPerM >= MIN_MINOR_TICK_PX

  // ── X-axis ruler (top edge, horizontal) — drawn INWARDS ──────────────────
  // WAVE 7651: The ruler band starts at viewBoxZ (top edge) and extends
  // DOWNWARDS (into the content). Ticks point down from the bottom edge of
  // the band. This prevents clipping by SVG overflow:hidden.
  //
  // WAVE 7655: Minor and major tick lines are consolidated into path strings.
  //   xMinorPathD: all minor ticks as one <path>
  //   xMajorPathD: all major ticks as one <path>
  //   xLabels: individual <text> nodes (need unique positions)
  const { xMinorPathD, xMajorPathD, xLabels } = useMemo(() => {
    const rulerY = viewBoxZ                    // top edge of viewBox
    const tickBaseY = viewBoxZ + rulerThickness // bottom edge of ruler band
    const halfW = stageWidth / 2

    const xStart = viewBoxX
    const xEnd = viewBoxX + viewBoxWidth

    // Minor ticks path string (LOD-gated)
    let minorPath = ''
    if (showMinorTicks) {
      const firstMinor = Math.ceil(xStart / minorSpacing) * minorSpacing
      for (let x = firstMinor; x <= xEnd; x += minorSpacing) {
        if (Math.abs(x % labelSpacing) < 0.001) continue
        minorPath += `M ${x} ${tickBaseY} L ${x} ${tickBaseY + minorTickLen} `
      }
    }

    // Major ticks path string + labels
    let majorPath = ''
    const labels: React.ReactNode[] = []
    const firstMajor = Math.ceil(xStart / labelSpacing) * labelSpacing
    let labelIdx = 0
    for (let x = firstMajor; x <= xEnd; x += labelSpacing) {
      const worldX = x - halfW
      const isEmphasis = labelSpacing >= 5 || Math.abs(worldX % (labelSpacing * 5)) < 0.01
      const tickLen = isEmphasis ? emphasisTickLen : majorTickLen

      majorPath += `M ${x} ${tickBaseY} L ${x} ${tickBaseY + tickLen} `

      // Label centered in the ruler band
      const label = formatLabel(worldX, labelSpacing)
      labels.push(
        <text
          key={`x-label-${labelIdx++}`}
          x={x}
          y={rulerY + rulerThickness / 2}
          fill={isEmphasis ? 'var(--obs-accent, #5EEAD4)' : 'var(--obs-ink, #8B94A8)'}
          fontSize={labelFontSize}
          fontFamily="monospace"
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={isEmphasis ? 0.9 : 0.55}
          pointerEvents="none"
        >
          {label}
        </text>
      )
    }

    return { xMinorPathD: minorPath, xMajorPathD: majorPath, xLabels: labels }
  }, [viewBoxX, viewBoxZ, viewBoxWidth, stageWidth, rulerThickness,
      majorTickLen, minorTickLen, emphasisTickLen, labelFontSize,
      showMinorTicks, minorSpacing, labelSpacing])

  // ── Z-axis ruler (left edge, vertical) — drawn INWARDS ───────────────────
  // WAVE 7651: The ruler band starts at viewBoxX (left edge) and extends
  // RIGHTWARDS (into the content). Ticks point right from the right edge of
  // the band.
  //
  // WAVE 7655: Same path consolidation as X-axis.
  const { zMinorPathD, zMajorPathD, zLabels } = useMemo(() => {
    const rulerX = viewBoxX                     // left edge of viewBox
    const tickBaseX = viewBoxX + rulerThickness  // right edge of ruler band
    const halfD = stageDepth / 2

    const zStart = viewBoxZ
    const zEnd = viewBoxZ + viewBoxHeight

    // Minor ticks path string (LOD-gated)
    let minorPath = ''
    if (showMinorTicks) {
      const firstMinor = Math.ceil(zStart / minorSpacing) * minorSpacing
      for (let z = firstMinor; z <= zEnd; z += minorSpacing) {
        if (Math.abs(z % labelSpacing) < 0.001) continue
        minorPath += `M ${tickBaseX} ${z} L ${tickBaseX + minorTickLen} ${z} `
      }
    }

    // Major ticks path string + labels
    let majorPath = ''
    const labels: React.ReactNode[] = []
    const firstMajor = Math.ceil(zStart / labelSpacing) * labelSpacing
    let labelIdx = 0
    for (let z = firstMajor; z <= zEnd; z += labelSpacing) {
      const worldZ = z - halfD
      const isEmphasis = labelSpacing >= 5 || Math.abs(worldZ % (labelSpacing * 5)) < 0.01
      const tickLen = isEmphasis ? emphasisTickLen : majorTickLen

      majorPath += `M ${tickBaseX} ${z} L ${tickBaseX + tickLen} ${z} `

      // WAVE 7649/7651: Z-axis label with correct transform.
      // Position: center of ruler band horizontally, at tick vertically.
      // text-anchor="middle" + dominantBaseline="middle" centers the text
      // on the point. rotate(-90) makes it read bottom-to-top.
      const label = formatLabel(worldZ, labelSpacing)
      const labelX = rulerX + rulerThickness / 2
      labels.push(
        <text
          key={`z-label-${labelIdx++}`}
          x={labelX}
          y={z}
          fill={isEmphasis ? 'var(--obs-accent, #5EEAD4)' : 'var(--obs-ink, #8B94A8)'}
          fontSize={labelFontSize}
          fontFamily="monospace"
          textAnchor="middle"
          dominantBaseline="middle"
          opacity={isEmphasis ? 0.9 : 0.55}
          pointerEvents="none"
          transform={`rotate(-90 ${labelX} ${z})`}
        >
          {label}
        </text>
      )
    }

    return { zMinorPathD: minorPath, zMajorPathD: majorPath, zLabels: labels }
  }, [viewBoxX, viewBoxZ, viewBoxHeight, stageDepth, rulerThickness,
      majorTickLen, minorTickLen, emphasisTickLen, labelFontSize,
      showMinorTicks, minorSpacing, labelSpacing])

  // ── Corner square (fills the gap at top-left intersection) ───────────────
  // WAVE 7651: Corner is at the viewBox top-left, extending inwards.
  const cornerX = viewBoxX
  const cornerY = viewBoxZ

  return (
    <g pointerEvents="none">
      {/* Corner fill — covers the intersection of X and Z ruler bands */}
      <rect
        x={cornerX}
        y={cornerY}
        width={rulerThickness}
        height={rulerThickness}
        fill="var(--obs-panel, #1A1D28)"
        opacity={0.9}
      />

      {/* X-axis ruler (top, drawn inwards/downwards) */}
      {/* Ruler background band */}
      <rect
        x={viewBoxX}
        y={viewBoxZ}
        width={viewBoxWidth}
        height={rulerThickness}
        fill="var(--obs-panel, #1A1D28)"
        opacity={0.85}
      />
      {/* WAVE 7655: Minor ticks — single <path> (was ~137 <line> nodes) */}
      {xMinorPathD && (
        <path
          d={xMinorPathD}
          stroke="var(--obs-ink, #8B94A8)"
          strokeWidth={MINOR_STROKE_PX}
          opacity={0.3}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* WAVE 7655: Major ticks — single <path> (was ~27 <line> nodes) */}
      {xMajorPathD && (
        <path
          d={xMajorPathD}
          stroke="var(--obs-ink, #8B94A8)"
          strokeWidth={STROKE_PX}
          opacity={0.45}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* X-axis labels (individual <text> nodes) */}
      {xLabels}

      {/* Z-axis ruler (left, drawn inwards/rightwards) */}
      {/* Ruler background band */}
      <rect
        x={viewBoxX}
        y={viewBoxZ}
        width={rulerThickness}
        height={viewBoxHeight}
        fill="var(--obs-panel, #1A1D28)"
        opacity={0.85}
      />
      {/* WAVE 7655: Minor ticks — single <path> (was ~75 <line> nodes) */}
      {zMinorPathD && (
        <path
          d={zMinorPathD}
          stroke="var(--obs-ink, #8B94A8)"
          strokeWidth={MINOR_STROKE_PX}
          opacity={0.3}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* WAVE 7655: Major ticks — single <path> (was ~15 <line> nodes) */}
      {zMajorPathD && (
        <path
          d={zMajorPathD}
          stroke="var(--obs-ink, #8B94A8)"
          strokeWidth={STROKE_PX}
          opacity={0.45}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Z-axis labels (individual <text> nodes) */}
      {zLabels}
    </g>
  )
}

// WAVE 7649: React.memo prevents re-render on mouse moves that don't change
// the viewport. Props are all primitives, so memo shallow-compare is exact.
export const RulerLayer = React.memo(RulerLayerComponent)
export default RulerLayer
