import React, { useState, useCallback, useEffect, useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// ZoneLayer — Zonas Arquitectónicas (Capa 3 del SVG)
// PROYECTO EREBUS FASE 9
//
// Contornos de línea discontinua con tipografía técnica condensada
// (mayúsculas, tracking amplio, 9px) en la esquina interior.
//
// Microinteracción:
//   - Relleno de trama de puntos al 3% solo en hover o cuando se arrastra
//     un fixture sobre ellas.
//   - El contorno discontinuo "camina" (dash-offset animado lentísimo).
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDef {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

// Canonical lighting zones — operator nomenclature
function computeZones(stageWidth: number, stageDepth: number): ZoneDef[] {
  const sideWidth = Math.max(1.5, stageWidth * 0.2) // 20% flanks for movers
  const centerWidth = stageWidth - sideWidth * 2
  const airHeight = stageDepth * 0.35 // back 35% — contras/aerial effects
  const ambientHeight = stageDepth * 0.35 // front 35% — ambient/wash
  const centerHeight = stageDepth - airHeight - ambientHeight // mid 30% — center/flash/strobe

  return [
    { id: 'movers-left', name: 'MOVERS LEFT', x: 0, y: 0, width: sideWidth, height: stageDepth },
    { id: 'movers-right', name: 'MOVERS RIGHT', x: stageWidth - sideWidth, y: 0, width: sideWidth, height: stageDepth },
    { id: 'center', name: 'CENTER / FLASH / STROBE', x: sideWidth, y: airHeight, width: centerWidth, height: centerHeight },
    { id: 'ambient', name: 'AMBIENT', x: sideWidth, y: airHeight + centerHeight, width: centerWidth, height: ambientHeight },
    { id: 'air', name: 'AIR', x: sideWidth, y: 0, width: centerWidth, height: airHeight },
  ]
}

interface ZoneLayerProps {
  stageWidth?: number
  stageDepth?: number
}

export const ZoneLayer: React.FC<ZoneLayerProps> = ({
  stageWidth = 12,
  stageDepth = 8,
}) => {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const [dragOverZone, setDragOverZone] = useState<string | null>(null)

  const zones = useMemo(
    () => computeZones(stageWidth, stageDepth),
    [stageWidth, stageDepth],
  )

  // ── Listen for drag-over-zone events from DragDropController2D ────────────
  useEffect(() => {
    const handleDragOverZone = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setDragOverZone(detail?.zoneId ?? null)
    }
    const handleDragEnd = () => setDragOverZone(null)

    window.addEventListener('erebus:drag-over-zone', handleDragOverZone)
    window.addEventListener('erebus:drag-end', handleDragEnd)
    return () => {
      window.removeEventListener('erebus:drag-over-zone', handleDragOverZone)
      window.removeEventListener('erebus:drag-end', handleDragEnd)
    }
  }, [])

  return (
    <g className="zone-layer" style={{ pointerEvents: 'none' }}>
      <defs>
        {/* Dot pattern for hover/drag fill — 3% opacity */}
        <pattern
          id="zone-dot-fill"
          x="0"
          y="0"
          width="0.3"
          height="0.3"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="0.15" cy="0.15" r="0.015" fill="var(--obs-accent)" opacity="0.03" />
        </pattern>
      </defs>

      {zones.map(zone => {
        const isHighlighted = hoveredZone === zone.id || dragOverZone === zone.id
        return (
          <g
            key={zone.id}
            onPointerEnter={() => setHoveredZone(zone.id)}
            onPointerLeave={() => setHoveredZone(null)}
            style={{ pointerEvents: 'all', cursor: 'default' }}
          >
            {/* Zone rectangle */}
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              fill={isHighlighted ? 'url(#zone-dot-fill)' : 'transparent'}
              stroke="var(--obs-line)"
              strokeWidth={0.015}
              strokeDasharray="0.2 0.1"
              vectorEffect="non-scaling-stroke"
              style={{
                animation: isHighlighted
                  ? 'none'
                  : 'erebus-zone-dash 60s linear infinite',
              }}
            />

            {/* Zone label — technical typography */}
            <text
              x={zone.x + 0.3}
              y={zone.y + 0.5}
              fill="var(--obs-bright, #E4E9F2)"
              fontSize={0.15}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={700}
              letterSpacing="0.1em"
              opacity={0.75}
              style={{ textTransform: 'uppercase' }}
              pointerEvents="none"
            >
              {zone.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export default ZoneLayer
