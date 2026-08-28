import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ArchitectureLayer — Borde del Escenario + Achurado Exterior
// PROYECTO EREBUS — Capa 2
// WAVE 7656-PATTERN + 7657-FIX
//
// Doble línea técnica delimitando el escenario:
//   - Línea exterior: --obs-line, stroke 2px
//   - Línea interior: --obs-line, stroke 1.5px, offset 0.1m
// Achurado 45° en el exterior marcando "fuera de sala".
//
// WAVE 7656: Exterior hatching rendered via SVG <pattern> with
//   patternTransform="rotate(45)" filling an outer frame <rect>.
//
// WAVE 7657 FIX: `vector-effect="non-scaling-stroke"` REMOVED from pattern
//   contents. This property is broken inside <pattern> in Chromium/Electron —
//   it causes GPU fallback to CPU rasterization or invisible strokes.
//   Stroke width is computed mathematically: worldWidth = screenPx / pxPerM.
//
//   The frame is drawn as 2 <rect> elements: outer frame with hatch pattern
//   fill, inner stage rect with solid floor color to "cut out" the hatch.
// ═══════════════════════════════════════════════════════════════════════════

interface ArchitectureLayerProps {
  stageWidth: number
  stageDepth: number
  padding: number
  /** Screen pixels per world meter — from BlueprintCanvas (scales with zoom) */
  pixelsPerMeter?: number
}

const HATCH_SPACING = 0.5
const BORDER_OFFSET = 0.1

// WAVE 7657: Screen-pixel stroke widths
const HATCH_STROKE_PX = 1
const OUTER_BORDER_STROKE_PX = 2
const INNER_BORDER_STROKE_PX = 1.5

export const ArchitectureLayer: React.FC<ArchitectureLayerProps> = ({
  stageWidth,
  stageDepth,
  padding,
  pixelsPerMeter = 20,
}) => {
  // WAVE 7657: Mathematical stroke widths — screen px → world meters
  const pxPerM = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0
    ? pixelsPerMeter
    : 1
  const hatchStroke = HATCH_STROKE_PX / pxPerM
  const outerBorderStroke = OUTER_BORDER_STROKE_PX / pxPerM
  const innerBorderStroke = INNER_BORDER_STROKE_PX / pxPerM

  // Outer frame bounds (stage + padding)
  const outerX = -padding
  const outerZ = -padding
  const outerW = stageWidth + padding * 2
  const outerH = stageDepth + padding * 2

  return (
    <g className="architecture-layer" style={{ pointerEvents: 'none' }}>
      {/* ═══ WAVE 7656/7657: Hatch pattern — rotated 45°, GPU-tiled, no vector-effect ═══ */}
      <defs>
        <pattern
          id="stage-hatch"
          x={0}
          y={0}
          width={HATCH_SPACING}
          height={HATCH_SPACING}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          {/* A single vertical line per tile — rotation makes it 45° */}
          <line
            x1={0} y1={0}
            x2={0} y2={HATCH_SPACING}
            stroke="var(--obs-line, #2A3040)"
            strokeWidth={hatchStroke}
            opacity={0.15}
          />
        </pattern>
      </defs>

      {/* WAVE 7656: Exterior hatching via pattern fill.
          Fill the entire outer frame with the hatch pattern, then overlay
          the stage interior with a solid fill to "cut out" the hatch. */}
      <rect
        x={outerX}
        y={outerZ}
        width={outerW}
        height={outerH}
        fill="url(#stage-hatch)"
      />
      {/* Cut out the stage interior — solid floor color over the hatch */}
      <rect
        x={0}
        y={0}
        width={stageWidth}
        height={stageDepth}
        fill="var(--obs-floor, #14171F)"
      />

      {/* Outer border (thick) — WAVE 7657: mathematical stroke width */}
      <rect
        x={0}
        y={0}
        width={stageWidth}
        height={stageDepth}
        fill="none"
        stroke="var(--obs-line, #2A3040)"
        strokeWidth={outerBorderStroke}
        vectorEffect="non-scaling-stroke"
      />

      {/* Inner border (thin, offset) — WAVE 7657: mathematical stroke width */}
      <rect
        x={-BORDER_OFFSET}
        y={-BORDER_OFFSET}
        width={stageWidth + BORDER_OFFSET * 2}
        height={stageDepth + BORDER_OFFSET * 2}
        fill="none"
        stroke="var(--obs-line, #2A3040)"
        strokeWidth={innerBorderStroke}
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
}

export default ArchitectureLayer
