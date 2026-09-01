import React, { useState, useEffect, useMemo } from 'react'
import { type CanonicalZone } from '../../../../../core/zones/ZoneMapper'
import { CANONICAL_ZONES } from '../../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// ZoneLayer — Zonas Arquitectónicas Dinámicas (Capa 3 del SVG)
// PROYECTO EREBUS — OBSIDIAN STUDIO V3
//
// Las zonas se derivan DINÁMICAMENTE de los fixtures del show.
// Cada zona canónica activa (con fixtures asignados) se renderiza como
// un contorno de línea discontinua — como habitaciones en un plano.
//
// Microinteracción:
//   - Relleno de trama de puntos al 3% solo en hover o drag-over.
//   - El contorno discontinuo "camina" (dash-offset animado lentísimo).
//
// Tipografía: técnica condensada, mayúsculas, tracking amplio, 9px.
// vector-effect="non-scaling-stroke" en toda la geometría.
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDef {
  id: CanonicalZone
  name: string
  x: number
  y: number
  width: number
  height: number
}

// Zone display names — clean, no emojis (CAD style)
const ZONE_DISPLAY_NAMES: Record<CanonicalZone, string> = {
  'front': 'FRONT',
  'back': 'BACK',
  'floor': 'FLOOR',
  'movers-left': 'MOVERS LEFT',
  'movers-right': 'MOVERS RIGHT',
  'strobe': 'STROBE',
  'air': 'AIR',
  'ambient': 'AMBIENT',
  'unassigned': 'UNASSIGNED',
}

// Compute spatial layout for a given set of active canonical zones.
// The layout adapts to which zones are present in the show.
function computeZoneLayout(
  activeZones: CanonicalZone[],
  stageWidth: number,
  stageDepth: number,
): ZoneDef[] {
  if (activeZones.length === 0) return []

  const hasMoversLeft = activeZones.includes('movers-left')
  const hasMoversRight = activeZones.includes('movers-right')
  const hasStrobe = activeZones.includes('strobe')
  const hasAir = activeZones.includes('air')
  const hasAmbient = activeZones.includes('ambient')
  const hasFront = activeZones.includes('front')
  const hasBack = activeZones.includes('back')
  const hasFloor = activeZones.includes('floor')

  const sideWidth = Math.max(1.5, stageWidth * 0.2)
  const hasSides = hasMoversLeft || hasMoversRight
  const centerStartX = hasSides ? sideWidth : 0
  const centerWidth = hasSides ? stageWidth - sideWidth * 2 : stageWidth

  // Vertical layout: back/air at top, center in middle, front/ambient at bottom
  const verticalCount = [hasBack, hasAir, hasStrobe, hasAmbient, hasFront, hasFloor].filter(Boolean).length
  const sectionHeight = verticalCount > 0 ? stageDepth / verticalCount : stageDepth

  const defs: ZoneDef[] = []
  let currentY = 0

  // Sides span full height
  if (hasMoversLeft) {
    defs.push({
      id: 'movers-left',
      name: ZONE_DISPLAY_NAMES['movers-left'],
      x: 0, y: 0, width: sideWidth, height: stageDepth,
    })
  }
  if (hasMoversRight) {
    defs.push({
      id: 'movers-right',
      name: ZONE_DISPLAY_NAMES['movers-right'],
      x: stageWidth - sideWidth, y: 0, width: sideWidth, height: stageDepth,
    })
  }

  // Center column — stacked vertically by zone type
  if (hasBack) {
    defs.push({ id: 'back', name: ZONE_DISPLAY_NAMES['back'], x: centerStartX, y: currentY, width: centerWidth, height: sectionHeight })
    currentY += sectionHeight
  }
  if (hasAir) {
    defs.push({ id: 'air', name: ZONE_DISPLAY_NAMES['air'], x: centerStartX, y: currentY, width: centerWidth, height: sectionHeight })
    currentY += sectionHeight
  }
  if (hasStrobe) {
    defs.push({ id: 'strobe', name: ZONE_DISPLAY_NAMES['strobe'], x: centerStartX, y: currentY, width: centerWidth, height: sectionHeight })
    currentY += sectionHeight
  }
  if (hasAmbient) {
    defs.push({ id: 'ambient', name: ZONE_DISPLAY_NAMES['ambient'], x: centerStartX, y: currentY, width: centerWidth, height: sectionHeight })
    currentY += sectionHeight
  }
  if (hasFront) {
    defs.push({ id: 'front', name: ZONE_DISPLAY_NAMES['front'], x: centerStartX, y: currentY, width: centerWidth, height: sectionHeight })
    currentY += sectionHeight
  }
  if (hasFloor) {
    defs.push({ id: 'floor', name: ZONE_DISPLAY_NAMES['floor'], x: centerStartX, y: currentY, width: centerWidth, height: sectionHeight })
    currentY += sectionHeight
  }

  return defs
}

interface ZoneLayerProps {
  stageWidth?: number
  stageDepth?: number
  /** Screen pixels per world meter — for inverse-scaled labels */
  pixelsPerMeter?: number
}

export const ZoneLayer: React.FC<ZoneLayerProps> = ({
  stageWidth = 12,
  stageDepth = 8,
  pixelsPerMeter = 20,
}) => {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const [dragOverZone, setDragOverZone] = useState<string | null>(null)

  // WAVE 7659: Inverse-scale zone labels for zoom legibility.
  // Base size: 14 screen px → world meters. Clamp to a minimum world size
  // so labels don't get absurdly large when zoomed out.
  const pxPerM = Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0 ? pixelsPerMeter : 1
  const zoneLabelFontSize = Math.max(14 / pxPerM, 0.12)
  const zoneLabelOffset = Math.max(6 / pxPerM, 0.05)

  // ── Always show all 8 canonical zones (excluding 'unassigned') ──────────
  // The architectural plan must display the full spatial matrix regardless
  // of whether fixtures are currently assigned to each zone.
  const allZones = useMemo(
    () => CANONICAL_ZONES.filter(z => z !== 'unassigned') as CanonicalZone[],
    [],
  )

  const zones = useMemo(
    () => computeZoneLayout(allZones, stageWidth, stageDepth),
    [allZones, stageWidth, stageDepth],
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
      {zones.map(zone => {
        const isHighlighted = hoveredZone === zone.id || dragOverZone === zone.id
        return (
          <g
            key={zone.id}
            onPointerEnter={() => setHoveredZone(zone.id)}
            onPointerLeave={() => setHoveredZone(null)}
            style={{ pointerEvents: 'all', cursor: 'default' }}
          >
            {/* Zone rectangle — dashed outline like rooms in an architect's plan */}
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              fill={isHighlighted ? 'url(#zone-dot-fill)' : 'transparent'}
              stroke="var(--obs-line)"
              strokeWidth={1.5}
              strokeDasharray="0.2 0.1"
              vectorEffect="non-scaling-stroke"
            />

            {/* Zone label — WAVE 7659: inverse-scaled for zoom legibility */}
            <text
              x={zone.x + zoneLabelOffset}
              y={zone.y + zoneLabelOffset + zoneLabelFontSize}
              fill="var(--obs-ink, #8B94A8)"
              fontSize={zoneLabelFontSize}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={600}
              letterSpacing="0.15em"
              opacity={0.7}
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
