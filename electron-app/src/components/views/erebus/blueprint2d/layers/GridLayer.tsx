import React, { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// GridLayer — Trama Técnica
// PROYECTO EREBUS FASE 4 — Layer 1
// WAVE 7648-LOD + 7656-PATTERN + 7657-FIX + 7658-MACRO-TILE
//
// Doble trama vectorial:
//   Fina: cada 0.25m, opacidad 8%, --obs-line
//   Maestra: cada 1m, opacidad 18%, --obs-line
//   Cruces (+) cada 5m en intersecciones maestras
//
// WAVE 7658: All three grids (fine, master, crosshair) are consolidated into
//   a SINGLE 5m × 5m macro-pattern tile. This reduces GPU compositing from
//   ~21,300 micro-tiles (0.25m) to just 50 macro-tiles for a 50×25m stage —
//   a 426x reduction in texture cache pressure.
//
//   The 5m tile contains:
//     - Fine lines at 0.25m intervals (excluding 1m multiples — those are
//       drawn by the master path)
//     - Master lines at 1m intervals
//     - A crosshair (+) at the tile center (2.5, 2.5)
//
//   Path strings are pre-computed at module scope (zero runtime cost, zero
//   dependencies). Only stroke widths are computed at render time from
//   pixelsPerMeter (WAVE 7657: no vector-effect inside patterns).
//
// WAVE 7649: React.memo prevents re-render on mouse moves that don't change
//   the viewport. LOD hides the fine grid when zoomed out.
// ═══════════════════════════════════════════════════════════════════════════

interface GridLayerProps {
  stageWidth: number
  stageDepth: number
  padding: number
  /** Screen pixels per world meter — from BlueprintCanvas (scales with zoom) */
  pixelsPerMeter?: number
}

const FINE_SPACING = 0.25 // meters
const MASTER_SPACING = 1.0 // meters
const CROSSHAIR_SPACING = 5.0 // meters
const GRID_OVERSCAN = 3 // meters beyond architecture padding

// WAVE 7657: Screen-pixel stroke widths — converted to world meters at render
const FINE_STROKE_PX = 1     // 1px screen pixel
const MASTER_STROKE_PX = 1.5 // 1.5px screen pixel
const CROSS_STROKE_PX = 2    // 2px screen pixel

// WAVE 7648: Screen-pixel constants for inverse-scaled elements
const CROSS_SIZE_PX = 6       // crosshair half-size in screen px
const CENTER_LABEL_PX = 12    // CENTER text in screen px

// WAVE 7649: LOD thresholds (screen pixels per meter)
const LOD_SHOW_FINE_GRID = 8  // hide 0.25m fine grid below this (sub-pixel)

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 7658: Pre-computed path strings for a 5m × 5m macro-tile.
// Computed once at module load — zero runtime cost, zero dependencies.
// The tile spans [0,0] to [5,5] in world meters.
// ═══════════════════════════════════════════════════════════════════════════

/** Fine grid lines at 0.25m intervals within the 5m tile.
 *  Excludes multiples of 1.0m (those are drawn by the master path).
 *  Vertical lines at x=0.25,0.5,0.75,1.25,1.5,1.75,...,4.75
 *  Horizontal lines at z=0.25,0.5,0.75,1.25,1.5,1.75,...,4.75
 *  Note: x=0 and z=0 are the tile edges — the pattern tile boundary itself
 *  acts as the line at 0, so we don't draw it (it would double up with the
 *  adjacent tile's right/bottom edge). */
const FINE_TILE_PATH = (() => {
  let d = ''
  // Vertical lines (constant x, full height 0→5)
  for (let x = FINE_SPACING; x < CROSSHAIR_SPACING; x += FINE_SPACING) {
    // Skip multiples of 1.0m — master path handles those
    if (Math.abs(x % MASTER_SPACING) < 0.001) continue
    d += `M ${x} 0 L ${x} ${CROSSHAIR_SPACING} `
  }
  // Horizontal lines (constant z, full width 0→5)
  for (let z = FINE_SPACING; z < CROSSHAIR_SPACING; z += FINE_SPACING) {
    if (Math.abs(z % MASTER_SPACING) < 0.001) continue
    d += `M 0 ${z} L ${CROSSHAIR_SPACING} ${z} `
  }
  return d
})()

/** Master grid lines at 1m intervals within the 5m tile.
 *  Vertical lines at x=1,2,3,4 (x=0 is tile boundary, x=5 is next tile's 0)
 *  Horizontal lines at z=1,2,3,4 */
const MASTER_TILE_PATH = (() => {
  let d = ''
  for (let x = MASTER_SPACING; x < CROSSHAIR_SPACING; x += MASTER_SPACING) {
    d += `M ${x} 0 L ${x} ${CROSSHAIR_SPACING} `
  }
  for (let z = MASTER_SPACING; z < CROSSHAIR_SPACING; z += MASTER_SPACING) {
    d += `M 0 ${z} L ${CROSSHAIR_SPACING} ${z} `
  }
  return d
})()

/** Crosshair (+) marker at the center of the 5m tile (2.5, 2.5).
 *  The cross size is dynamic (inverse-scaled), so this path is computed
 *  at render time, not at module scope. */
function buildCrossPath(crossSize: number): string {
  const cx = CROSSHAIR_SPACING / 2
  const cy = CROSSHAIR_SPACING / 2
  return `M ${cx - crossSize} ${cy} L ${cx + crossSize} ${cy} M ${cx} ${cy - crossSize} L ${cx} ${cy + crossSize}`
}

const GridLayerComponent: React.FC<GridLayerProps> = ({
  stageWidth,
  stageDepth,
  padding,
  pixelsPerMeter = 20,
}) => {
  // WAVE 7654: Guard against NaN/0
  const pxPerM = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0
    ? pixelsPerMeter
    : 1

  // WAVE 7657: Mathematical stroke widths — screen px → world meters
  const fineStroke = FINE_STROKE_PX / pxPerM
  const masterStroke = MASTER_STROKE_PX / pxPerM
  const crossStroke = CROSS_STROKE_PX / pxPerM

  const crossSize = CROSS_SIZE_PX / pxPerM
  const centerFontSize = CENTER_LABEL_PX / pxPerM
  const showFineGrid = pxPerM >= LOD_SHOW_FINE_GRID

  // Crosshair path for the macro-tile center (depends on crossSize)
  const crossPathD = useMemo(() => buildCrossPath(crossSize), [crossSize])

  // Grid coverage rect — spans the stage + padding + overscan
  const gridX = -(padding + GRID_OVERSCAN)
  const gridZ = -(padding + GRID_OVERSCAN)
  const gridW = stageWidth + (padding + GRID_OVERSCAN) * 2
  const gridH = stageDepth + (padding + GRID_OVERSCAN) * 2

  // CENTER label offset — inverse-scaled
  const centerLabelOffset = centerFontSize * 1.5

  return (
    <g>
      {/* ═══ WAVE 7658: Single 5m macro-pattern — all 3 grids in one tile ═══ */}
      <defs>
        <pattern
          id="grid-macro"
          x={0}
          y={0}
          width={CROSSHAIR_SPACING}
          height={CROSSHAIR_SPACING}
          patternUnits="userSpaceOnUse"
        >
          {/* Fine grid lines (0.25m) — LOD-gated via opacity */}
          {showFineGrid && (
            <path
              d={FINE_TILE_PATH}
              stroke="var(--obs-line, #2A3040)"
              strokeWidth={fineStroke}
              opacity={0.08}
              fill="none"
            />
          )}
          {/* Master grid lines (1m) */}
          <path
            d={MASTER_TILE_PATH}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={masterStroke}
            opacity={0.18}
            fill="none"
          />
          {/* Crosshair (+) at tile center (2.5, 2.5) */}
          <path
            d={crossPathD}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={crossStroke}
            opacity={0.22}
            fill="none"
          />
        </pattern>
      </defs>

      {/* WAVE 7658: Single <rect> with macro-pattern fill.
          Was 3 <rect> elements with 3 separate patterns (~21,300 GPU tiles).
          Now 1 <rect> with 1 pattern (~50 GPU tiles for 50×25m stage). */}
      <rect
        x={gridX}
        y={gridZ}
        width={gridW}
        height={gridH}
        fill="url(#grid-macro)"
      />

      {/* WAVE 7606: Visual Center Line — X=0 (stage center in SVG coords) */}
      {/* Highly visible vertical line separating Left from Right */}
      <line
        x1={stageWidth / 2} y1={-(padding + GRID_OVERSCAN)}
        x2={stageWidth / 2} y2={stageDepth + padding + GRID_OVERSCAN}
        stroke="var(--obs-accent, #5EEAD4)"
        strokeWidth={2.5}
        opacity={0.45}
        strokeDasharray="0.5 0.25"
        vectorEffect="non-scaling-stroke"
      />
      {/* Center line label — inverse-scaled fontSize */}
      <text
        x={stageWidth / 2 + centerLabelOffset}
        y={-(padding + GRID_OVERSCAN) + centerLabelOffset}
        fill="var(--obs-accent, #5EEAD4)"
        fontSize={centerFontSize}
        fontFamily="monospace"
        opacity={0.6}
        pointerEvents="none"
      >
        CENTER
      </text>

      {/* WAVE 7659/7660: Absolute Origin Crosshairs — X=0 (horizontal) and Z=0 (vertical)
          These mark the world coordinate origin (0,0) in SVG space.
          SVG top-left origin: world X=0 → svgX=stageWidth/2, world Z=0 → svgZ=stageDepth/2.
          WAVE 7660 FIX: Use amber color (not teal) to distinguish from the CENTER line
          which is at the same X position. Solid stroke (not dashed) for emphasis. */}
      {/* Z-axis origin line (vertical, at world X=0 → svgX=stageWidth/2) */}
      <line
        x1={stageWidth / 2} y1={-padding}
        x2={stageWidth / 2} y2={stageDepth + padding}
        stroke="var(--obs-amber, #F5B04D)"
        strokeWidth={2}
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {/* X-axis origin line (horizontal, at world Z=0 → svgZ=stageDepth/2) */}
      <line
        x1={-padding} y1={stageDepth / 2}
        x2={stageWidth + padding} y2={stageDepth / 2}
        stroke="var(--obs-amber, #F5B04D)"
        strokeWidth={2}
        opacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      {/* Origin label — offset from the intersection */}
      <text
        x={stageWidth / 2 + 0.5}
        y={stageDepth / 2 - 0.5}
        fill="var(--obs-amber, #F5B04D)"
        fontSize={centerFontSize}
        fontFamily="monospace"
        opacity={0.8}
        pointerEvents="none"
      >
        0,0
      </text>
    </g>
  )
}

// WAVE 7649: React.memo prevents re-render on mouse moves that don't change
// the viewport. Props are all primitives, so memo shallow-compare is exact.
export const GridLayer = React.memo(GridLayerComponent)
export default GridLayer
