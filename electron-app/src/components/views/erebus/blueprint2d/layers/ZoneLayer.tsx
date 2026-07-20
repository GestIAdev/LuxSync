import React, { useState, useCallback, useEffect } from 'react'

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

// Canonical zones — relative to stage coordinate system (meters)
const CANONICAL_ZONES: ZoneDef[] = [
  { id: 'front', name: 'FRONT', x: 0, y: 5.5, width: 12, height: 2.5 },
  { id: 'mid', name: 'MID', x: 0, y: 2.5, width: 12, height: 3 },
  { id: 'back', name: 'BACK', x: 0, y: 0, width: 12, height: 2.5 },
  { id: 'left', name: 'STAGE LEFT', x: -1.5, y: 0, width: 1.5, height: 8 },
  { id: 'right', name: 'STAGE RIGHT', x: 12, y: 0, width: 1.5, height: 8 },
]

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

      {CANONICAL_ZONES.map(zone => {
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
              strokeWidth={0.008}
              strokeDasharray="0.15 0.08"
              style={{
                animation: isHighlighted
                  ? 'none'
                  : 'erebus-zone-dash 60s linear infinite',
              }}
            />

            {/* Zone label — technical typography */}
            <text
              x={zone.x + 0.15}
              y={zone.y + 0.25}
              fill="var(--obs-ink)"
              fontSize={0.09}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={600}
              letterSpacing="0.15em"
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
