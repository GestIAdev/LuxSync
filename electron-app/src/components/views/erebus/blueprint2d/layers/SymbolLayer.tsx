import React, { useMemo } from 'react'
import { useSelectionStore } from '../../../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// SymbolLayer — Simbología USITT
// PROYECTO EREBUS FASE 4 — Layer 5
//
// Símbolos interactivos para representar fixtures en el plano 2D.
// Trazo --obs-bright a 1px (non-scaling-stroke), relleno transparente.
// Eventos de puntero nativos en el <g> raíz de cada símbolo.
// Feedback visual de selección (anillo cyan) y hover (stroke tenue).
//
// Moving Head: círculo con cuña de orientación (yaw base)
// Wash / PAR: rectángulo con hachurado interior
// Strobe / Blinder: rombo con doble borde
// Laser: asterisco técnico en caja
// Truss: doble línea con marcas de sección
//
// Etiqueta compacta multilínea bajo el símbolo (pointerEvents: none).
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────────────────

export type FixtureSymbolType = 'moving-head' | 'wash' | 'par' | 'strobe' | 'blinder' | 'laser' | 'truss'

export interface FixtureSymbolData {
  id: string
  type: FixtureSymbolType
  x: number // meters (stage coords)
  z: number // meters (mapped to SVG Y)
  yaw?: number // degrees — for moving-head orientation wedge
  /** Short fixture name (will be truncated to 12 chars) */
  name?: string
  /** DMX address string, e.g. "U0.21" */
  dmx?: string
  /** Legacy single-line label (deprecated, use name+dmx) */
  label?: string
  /** Live DMX color ring (if show running), else null */
  liveColor?: string | null
}

interface SymbolLayerProps {
  fixtures?: FixtureSymbolData[]
  /** Pointer down on a fixture symbol (select / start drag) */
  onFixturePointerDown?: (e: React.PointerEvent, fixtureId: string) => void
  /** Pointer enter on a fixture symbol (hover) */
  onFixturePointerEnter?: (fixtureId: string) => void
  /** Pointer leave from a fixture symbol (clear hover) */
  onFixturePointerLeave?: () => void
  /** Context menu (right-click) on a fixture */
  onFixtureContextMenu?: (e: React.MouseEvent, fixtureId: string) => void
}

// ── Constants ──────────────────────────────────────────────────────────────

const STROKE = 'var(--obs-bright, #E4E9F2)'
const STROKE_WIDTH = 1 // 1px screen pixel — non-scaling-stroke
const SYMBOL_RADIUS = 0.15 // 30cm diameter symbols
const LABEL_SIZE = 0.14 // 14cm metric — compact CAD label
const DMX_SIZE = 0.11 // 11cm metric — smaller DMX sub-label
const LABEL_OFFSET = 0.35 // below symbol — vertical offset
const MAX_NAME_LEN = 12 // truncate fixture names to this many chars
const SELECT_RING_RADIUS = 0.22 // selection ring radius (slightly larger than symbol)
const SELECT_STROKE = 'var(--obs-accent, #5EEAD4)'
const HOVER_OPACITY = 0.6

/** Truncate name to MAX_NAME_LEN with ellipsis */
function truncateName(name: string): string {
  return name.length > MAX_NAME_LEN ? name.slice(0, MAX_NAME_LEN) + '\u2026' : name
}

/** Compact multiline label: line 1 = truncated name, line 2 = DMX address */
const FixtureLabel: React.FC<{ data: FixtureSymbolData; y: number }> = ({ data, y }) => {
  const displayName = data.name ? truncateName(data.name) : (data.label ?? '')
  const dmx = data.dmx ?? ''
  if (!displayName && !dmx) return null
  return (
    <text
      x={data.x}
      y={y}
      textAnchor="middle"
      pointerEvents="none"
    >
      {displayName && (
        <tspan
          x={data.x}
          dy="0"
          fill="var(--obs-bright, #E4E9F2)"
          fontSize={LABEL_SIZE}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={500}
        >
          {displayName}
        </tspan>
      )}
      {dmx && (
        <tspan
          x={data.x}
          dy={LABEL_SIZE * 1.4}
          fill="var(--obs-accent, #4FC3F7)"
          fontSize={DMX_SIZE}
          fontFamily="monospace"
        >
          {dmx}
        </tspan>
      )}
    </text>
  )
}

// ── Individual Symbol Components ───────────────────────────────────────────

/** Shared interaction props for all symbol components */
interface SymbolInteractionProps {
  isSelected: boolean
  isHovered: boolean
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

/** Selection ring — rendered around selected fixtures */
const SelectionRing: React.FC<{ data: FixtureSymbolData }> = ({ data }) => (
  <circle
    cx={data.x}
    cy={data.z}
    r={SELECT_RING_RADIUS}
    fill="none"
    stroke={SELECT_STROKE}
    strokeWidth={1.5}
    opacity={0.8}
    vectorEffect="non-scaling-stroke"
    pointerEvents="none"
  />
)

/** Moving Head: circle with orientation wedge */
const MovingHeadSymbol: React.FC<{ data: FixtureSymbolData } & SymbolInteractionProps> = ({
  data,
  isSelected,
  isHovered,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
}) => {
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
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer', opacity: isHovered && !isSelected ? HOVER_OPACITY : 1 }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {/* Selection ring */}
      {isSelected && <SelectionRing data={data} />}
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
        stroke={isSelected ? SELECT_STROKE : STROKE}
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {/* Orientation wedge */}
      <path
        d={`M ${data.x} ${data.z} L ${wedgeEnd.x} ${wedgeEnd.y} L ${wedgeSide.x} ${wedgeSide.y} Z`}
        fill={STROKE}
        fillOpacity={0.15}
        stroke={STROKE}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {/* Label — multiline: name + DMX */}
      <FixtureLabel data={data} y={data.z + LABEL_OFFSET} />
    </g>
  )
}

/** Wash / PAR: rectangle with interior hatching */
const WashSymbol: React.FC<{ data: FixtureSymbolData } & SymbolInteractionProps> = ({
  data,
  isSelected,
  isHovered,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
}) => {
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
          strokeWidth={1}
          opacity={0.2}
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    return lines
  }, [data.x, data.z, w, h])

  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer', opacity: isHovered && !isSelected ? HOVER_OPACITY : 1 }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {/* Selection ring */}
      {isSelected && <SelectionRing data={data} />}
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
        stroke={isSelected ? SELECT_STROKE : STROKE}
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
      {/* Label — multiline: name + DMX */}
      <FixtureLabel data={data} y={data.z + h / 2 + LABEL_OFFSET * 0.7} />
    </g>
  )
}

/** Strobe / Blinder: diamond with double border */
const StrobeSymbol: React.FC<{ data: FixtureSymbolData } & SymbolInteractionProps> = ({
  data,
  isSelected,
  isHovered,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
}) => {
  const r = SYMBOL_RADIUS
  const points = `${data.x},${data.z - r} ${data.x + r},${data.z} ${data.x},${data.z + r} ${data.x - r},${data.z}`

  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer', opacity: isHovered && !isSelected ? HOVER_OPACITY : 1 }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {/* Selection ring */}
      {isSelected && <SelectionRing data={data} />}
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
        stroke={isSelected ? SELECT_STROKE : STROKE}
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      {/* Inner diamond (double border) */}
      <polygon
        points={`${data.x},${data.z - r * 0.7} ${data.x + r * 0.7},${data.z} ${data.x},${data.z + r * 0.7} ${data.x - r * 0.7},${data.z}`}
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      {/* Label — multiline: name + DMX */}
      <FixtureLabel data={data} y={data.z + LABEL_OFFSET} />
    </g>
  )
}

/** Laser: technical asterisk in box */
const LaserSymbol: React.FC<{ data: FixtureSymbolData } & SymbolInteractionProps> = ({
  data,
  isSelected,
  isHovered,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onContextMenu,
}) => {
  const r = SYMBOL_RADIUS
  const armLen = r * 0.6

  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'pointer', opacity: isHovered && !isSelected ? HOVER_OPACITY : 1 }}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
    >
      {/* Selection ring */}
      {isSelected && <SelectionRing data={data} />}
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
        stroke={isSelected ? SELECT_STROKE : STROKE}
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
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
      {/* Label — multiline: name + DMX */}
      <FixtureLabel data={data} y={data.z + r + LABEL_OFFSET * 0.7} />
    </g>
  )
}

// ── Main Layer Component ───────────────────────────────────────────────────

export const SymbolLayer: React.FC<SymbolLayerProps> = ({
  fixtures = [],
  onFixturePointerDown,
  onFixturePointerEnter,
  onFixturePointerLeave,
  onFixtureContextMenu,
}) => {
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const hoveredId = useSelectionStore(s => s.hoveredId)

  return (
    <g className="symbol-layer">
      {fixtures.map((f) => {
        const isSelected = selectedIds.has(f.id)
        const isHovered = hoveredId === f.id

        const interactionProps = {
          isSelected,
          isHovered,
          onPointerDown: onFixturePointerDown
            ? (e: React.PointerEvent) => { e.stopPropagation(); onFixturePointerDown(e, f.id) }
            : undefined,
          onPointerEnter: onFixturePointerEnter
            ? () => onFixturePointerEnter(f.id)
            : undefined,
          onPointerLeave: onFixturePointerLeave,
          onContextMenu: onFixtureContextMenu
            ? (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onFixtureContextMenu(e, f.id) }
            : undefined,
        }

        switch (f.type) {
          case 'moving-head':
            return <MovingHeadSymbol key={f.id} data={f} {...interactionProps} />
          case 'wash':
          case 'par':
            return <WashSymbol key={f.id} data={f} {...interactionProps} />
          case 'strobe':
          case 'blinder':
            return <StrobeSymbol key={f.id} data={f} {...interactionProps} />
          case 'laser':
            return <LaserSymbol key={f.id} data={f} {...interactionProps} />
          default:
            return null
        }
      })}
    </g>
  )
}

export default SymbolLayer
