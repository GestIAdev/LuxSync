import React, { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// SymbolLayer — Simbología USITT
// PROYECTO EREBUS FASE 4 — Layer 5
//
// Símbolos pasivos para representar fixtures en el plano 2D.
// Trazo --obs-bright a 1px (escala metros), relleno transparente.
//
// Moving Head: círculo con cuña de orientación (yaw base)
// Wash / PAR: rectángulo con hachurado interior
// Strobe / Blinder: rombo con doble borde
// Laser: asterisco técnico en caja
// Truss: doble línea con marcas de sección
//
// Etiqueta compacta bajo el símbolo: "MH-07 · U1.121" en 8px.
// Sin interactividad — pura representación visual pasiva.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────────────────

export type FixtureSymbolType = 'moving-head' | 'wash' | 'par' | 'strobe' | 'blinder' | 'laser' | 'truss'

export interface FixtureSymbolData {
  id: string
  type: FixtureSymbolType
  x: number // meters (stage coords)
  z: number // meters (mapped to SVG Y)
  yaw?: number // degrees — for moving-head orientation wedge
  label?: string // e.g. "MH-07 · U1.121"
  /** Live DMX color ring (if show running), else null */
  liveColor?: string | null
}

interface SymbolLayerProps {
  fixtures?: FixtureSymbolData[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const STROKE = 'var(--obs-bright, #E4E9F2)'
const STROKE_WIDTH = 0.008 // ~0.8mm — 1px equivalent at typical zoom
const SYMBOL_RADIUS = 0.15 // 30cm diameter symbols
const LABEL_SIZE = 0.25 // 25cm metric — legible at full-stage zoom
const LABEL_OFFSET = 0.35 // below symbol — scaled for 0.25 fontSize

// ── Individual Symbol Components ───────────────────────────────────────────

/** Moving Head: circle with orientation wedge */
const MovingHeadSymbol: React.FC<{ data: FixtureSymbolData }> = ({ data }) => {
  const yawRad = ((data.yaw ?? 0) * Math.PI) / 180
  const wedgeEnd = {
    x: data.x + Math.cos(yawRad) * SYMBOL_RADIUS,
    y: data.z + Math.sin(yawRad) * SYMBOL_RADIUS,
  }
  const wedgeSide = {
    x: data.x + Math.cos(yawRad + 0.5) * SYMBOL_RADIUS * 0.7,
    y: data.z + Math.sin(yawRad + 0.5) * SYMBOL_RADIUS * 0.7,
  }

  return (
    <g>
      {/* Outer live-color ring (if show running) */}
      {data.liveColor && (
        <circle
          cx={data.x} cy={data.z}
          r={SYMBOL_RADIUS + 0.015}
          fill="none"
          stroke={data.liveColor}
          strokeWidth={0.006}
          opacity={0.8}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Main circle */}
      <circle
        cx={data.x} cy={data.z}
        r={SYMBOL_RADIUS}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {/* Orientation wedge */}
      <path
        d={`M ${data.x} ${data.z} L ${wedgeEnd.x} ${wedgeEnd.y} L ${wedgeSide.x} ${wedgeSide.y} Z`}
        fill={STROKE}
        fillOpacity={0.15}
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH * 0.7}
        vectorEffect="non-scaling-stroke"
      />
      {/* Label */}
      {data.label && (
        <text
          x={data.x}
          y={data.z + LABEL_OFFSET}
          dy="0.2"
          fill="var(--obs-bright, #E4E9F2)"
          fontSize={LABEL_SIZE}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {data.label}
        </text>
      )}
    </g>
  )
}

/** Wash / PAR: rectangle with interior hatching */
const WashSymbol: React.FC<{ data: FixtureSymbolData }> = ({ data }) => {
  const w = SYMBOL_RADIUS * 1.6
  const h = SYMBOL_RADIUS * 1.2
  const hatchSpacing = 0.03

  // Generate hatch lines (45° interior)
  const hatchLines = useMemo(() => {
    const lines: React.ReactNode[] = []
    const diagLen = Math.sqrt(w * w + h * h)
    const numLines = Math.floor(diagLen / hatchSpacing)
    for (let i = -numLines; i <= numLines; i++) {
      const offset = i * hatchSpacing
      lines.push(
        <line
          key={i}
          x1={data.x - w / 2 + offset}
          y1={data.z - h / 2}
          x2={data.x - w / 2 + offset + h}
          y2={data.z + h / 2}
          stroke={STROKE}
          strokeWidth={STROKE_WIDTH * 0.5}
          opacity={0.2}
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    return lines
  }, [data.x, data.z, w, h])

  return (
    <g>
      {/* Live-color ring */}
      {data.liveColor && (
        <rect
          x={data.x - w / 2 - 0.015}
          y={data.z - h / 2 - 0.015}
          width={w + 0.03}
          height={h + 0.03}
          fill="none"
          stroke={data.liveColor}
          strokeWidth={0.006}
          opacity={0.8}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Main rectangle */}
      <rect
        x={data.x - w / 2}
        y={data.z - h / 2}
        width={w}
        height={h}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {/* Interior hatching */}
      <g clipPath={`url(#wash-clip-${data.id})`}>
        {hatchLines}
      </g>
      <defs>
        <clipPath id={`wash-clip-${data.id}`}>
          <rect
            x={data.x - w / 2}
            y={data.z - h / 2}
            width={w}
            height={h}
          />
        </clipPath>
      </defs>
      {/* Label */}
      {data.label && (
        <text
          x={data.x}
          y={data.z + h / 2 + LABEL_OFFSET * 0.7}
          dy="0.2"
          fill="var(--obs-bright, #E4E9F2)"
          fontSize={LABEL_SIZE}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {data.label}
        </text>
      )}
    </g>
  )
}

/** Strobe / Blinder: diamond with double border */
const StrobeSymbol: React.FC<{ data: FixtureSymbolData }> = ({ data }) => {
  const r = SYMBOL_RADIUS
  const points = `${data.x},${data.z - r} ${data.x + r},${data.z} ${data.x},${data.z + r} ${data.x - r},${data.z}`

  return (
    <g>
      {data.liveColor && (
        <polygon
          points={points}
          fill="none"
          stroke={data.liveColor}
          strokeWidth={0.006}
          opacity={0.8}
          transform={`translate(0.015, 0.015) scale(1.1) translate(${data.x * -0.1}, ${data.z * -0.1})`}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Outer diamond */}
      <polygon
        points={points}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {/* Inner diamond (double border) */}
      <polygon
        points={`${data.x},${data.z - r * 0.7} ${data.x + r * 0.7},${data.z} ${data.x},${data.z + r * 0.7} ${data.x - r * 0.7},${data.z}`}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH * 0.7}
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      {data.label && (
        <text
          x={data.x}
          y={data.z + LABEL_OFFSET}
          dy="0.2"
          fill="var(--obs-bright, #E4E9F2)"
          fontSize={LABEL_SIZE}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {data.label}
        </text>
      )}
    </g>
  )
}

/** Laser: technical asterisk in box */
const LaserSymbol: React.FC<{ data: FixtureSymbolData }> = ({ data }) => {
  const r = SYMBOL_RADIUS
  const armLen = r * 0.6

  return (
    <g>
      {data.liveColor && (
        <rect
          x={data.x - r - 0.015}
          y={data.z - r - 0.015}
          width={(r + 0.015) * 2}
          height={(r + 0.015) * 2}
          fill="none"
          stroke={data.liveColor}
          strokeWidth={0.006}
          opacity={0.8}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* Box */}
      <rect
        x={data.x - r}
        y={data.z - r}
        width={r * 2}
        height={r * 2}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {/* Asterisk (6 arms) */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i * Math.PI) / 3
        return (
          <line
            key={i}
            x1={data.x}
            y1={data.z}
            x2={data.x + Math.cos(angle) * armLen}
            y2={data.z + Math.sin(angle) * armLen}
            stroke={STROKE}
            strokeWidth={STROKE_WIDTH * 0.7}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      {data.label && (
        <text
          x={data.x}
          y={data.z + r + LABEL_OFFSET * 0.7}
          dy="0.2"
          fill="var(--obs-bright, #E4E9F2)"
          fontSize={LABEL_SIZE}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {data.label}
        </text>
      )}
    </g>
  )
}

// ── Main Layer Component ───────────────────────────────────────────────────

export const SymbolLayer: React.FC<SymbolLayerProps> = ({ fixtures = [] }) => {
  return (
    <g>
      {fixtures.map((f) => {
        switch (f.type) {
          case 'moving-head':
            return <MovingHeadSymbol key={f.id} data={f} />
          case 'wash':
          case 'par':
            return <WashSymbol key={f.id} data={f} />
          case 'strobe':
          case 'blinder':
            return <StrobeSymbol key={f.id} data={f} />
          case 'laser':
            return <LaserSymbol key={f.id} data={f} />
          default:
            return null
        }
      })}
    </g>
  )
}

export default SymbolLayer
