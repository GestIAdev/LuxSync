/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ ZONE OVERLAY - WAVE 363
 * "El Territorio Visual - Ver para Dominar"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Renderiza las zonas como rectángulos semitransparentes en el grid 3D.
 * Permite:
 * - Visualización de territorios de cada zona
 * - Feedback visual al arrastrar fixtures sobre zonas
 * - Color coding por zona
 * 
 * INTEGRACIÓN:
 * - Se renderiza dentro de StageGrid3D
 * - Lee zonas desde la configuración del stage
 * - Responde a eventos de hover/drop
 * 
 * @module components/views/StageConstructor/ZoneOverlay
 * @version 363.0.0
 */

import React, { useMemo } from 'react'
import { Text } from '@react-three/drei'
import type { FixtureZone } from '../../../core/stage/ShowFileV2'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDefinition {
  id: FixtureZone
  name: string
  color: string
  position: [number, number, number]  // Centro de la zona [x, y, z]
  size: [number, number]              // [width, depth] en metros
}

/**
 * Definiciones de zonas predefinidas
 * Estas zonas se renderizan en el suelo del stage
 * 
 * Coordinate System:
 * - X: Left (-) to Right (+) desde perspectiva audiencia
 * - Y: Up (siempre 0.02 para estar sobre el grid)
 * - Z: Back (-) to Front (+) (audiencia está en Z positivo)
 */
const ZONE_DEFINITIONS: ZoneDefinition[] = [
  // Stage zones (nivel de escenario, Z negativo = atrás)
  {
    id: 'stage-left',
    name: 'Stage Left',
    color: '#ef4444',      // Red
    position: [-3, 0.02, -1],
    size: [2, 4]
  },
  {
    id: 'stage-center',
    name: 'Stage Center',
    color: '#22d3ee',      // Cyan
    position: [0, 0.02, -1],
    size: [3, 4]
  },
  {
    id: 'stage-right',
    name: 'Stage Right',
    color: '#a855f7',      // Purple
    position: [3, 0.02, -1],
    size: [2, 4]
  },
  // Front zones (frente, hacia audiencia)
  {
    id: 'floor-front',
    name: 'Floor Front',
    color: '#84cc16',      // Lime
    position: [0, 0.02, 2],
    size: [8, 2]
  },
  // Back zones (atrás)
  {
    id: 'floor-back',
    name: 'Floor Back',
    color: '#f97316',      // Orange
    position: [0, 0.02, -4],
    size: [8, 2]
  },
  // Ceiling zones (altura elevada, Y > 0)
  {
    id: 'ceiling-front',
    name: 'Ceiling Front',
    color: '#06b6d4',      // Teal (más oscuro)
    position: [0, 0.03, 1],
    size: [6, 2]
  },
  {
    id: 'ceiling-back',
    name: 'Ceiling Back',
    color: '#8b5cf6',      // Violet
    position: [0, 0.03, -3],
    size: [6, 2]
  },
  {
    id: 'ceiling-left',
    name: 'Ceiling Left',
    color: '#ec4899',      // Pink
    position: [-4, 0.03, -1],
    size: [1.5, 4]
  },
  {
    id: 'ceiling-right',
    name: 'Ceiling Right',
    color: '#d946ef',      // Fuchsia
    position: [4, 0.03, -1],
    size: [1.5, 4]
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// ZONE PLANE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ZonePlaneProps {
  zone: ZoneDefinition
  isHighlighted: boolean
  onClick?: () => void
}

const ZonePlane: React.FC<ZonePlaneProps> = ({ zone, isHighlighted, onClick }) => {
  // Crear geometría del rectángulo
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(zone.size[0], zone.size[1])
  }, [zone.size])
  
  // Color con transparencia
  const color = useMemo(() => {
    return new THREE.Color(zone.color)
  }, [zone.color])
  
  return (
    <group position={zone.position}>
      {/* Plano de la zona */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]}  // Rotar para que quede horizontal
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
      >
        <planeGeometry args={[zone.size[0], zone.size[1]]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isHighlighted ? 0.35 : 0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Borde de la zona */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial 
          color={zone.color} 
          transparent 
          opacity={isHighlighted ? 0.8 : 0.4}
          linewidth={1}
        />
      </lineSegments>
      
      {/* Label de la zona */}
      <Text
        position={[0, 0.05, zone.size[1] / 2 - 0.3]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.25}
        color={zone.color}
        anchorX="center"
        anchorY="middle"
        fillOpacity={isHighlighted ? 1 : 0.5}
      >
        {zone.name}
      </Text>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneOverlayProps {
  /** ID de zona actualmente resaltada (hover de fixture sobre ella) */
  highlightedZone?: FixtureZone | null
  
  /** Callback cuando se hace click en una zona */
  onZoneClick?: (zoneId: FixtureZone) => void
  
  /** Si se deben mostrar las zonas */
  visible?: boolean
  
  /** Filtrar solo ciertas zonas */
  visibleZones?: FixtureZone[]
}

const ZoneOverlay: React.FC<ZoneOverlayProps> = ({
  highlightedZone = null,
  onZoneClick,
  visible = true,
  visibleZones
}) => {
  if (!visible) return null
  
  // Filtrar zonas si se especificaron
  const zones = useMemo(() => {
    if (visibleZones && visibleZones.length > 0) {
      return ZONE_DEFINITIONS.filter(z => visibleZones.includes(z.id))
    }
    return ZONE_DEFINITIONS
  }, [visibleZones])
  
  return (
    <group name="zone-overlay">
      {zones.map(zone => (
        <ZonePlane
          key={zone.id}
          zone={zone}
          isHighlighted={highlightedZone === zone.id}
          onClick={() => onZoneClick?.(zone.id)}
        />
      ))}
    </group>
  )
}

export default ZoneOverlay

// ═══════════════════════════════════════════════════════════════════════════
// HELPER EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determina en qué zona está un punto dado
 * Útil para auto-asignar zona cuando se suelta un fixture
 */
export function getZoneAtPosition(x: number, z: number): FixtureZone | null {
  for (const zone of ZONE_DEFINITIONS) {
    const [cx, , cz] = zone.position
    const [width, depth] = zone.size
    
    const halfWidth = width / 2
    const halfDepth = depth / 2
    
    if (
      x >= cx - halfWidth && x <= cx + halfWidth &&
      z >= cz - halfDepth && z <= cz + halfDepth
    ) {
      return zone.id
    }
  }
  return null
}

/**
 * Obtiene el color de una zona
 */
export function getZoneColor(zoneId: FixtureZone): string {
  const zone = ZONE_DEFINITIONS.find(z => z.id === zoneId)
  return zone?.color || '#6b7280'
}

/**
 * Obtiene el nombre legible de una zona
 */
export function getZoneName(zoneId: FixtureZone): string {
  const zone = ZONE_DEFINITIONS.find(z => z.id === zoneId)
  return zone?.name || zoneId
}

/**
 * Exportar las definiciones para uso externo
 */
export { ZONE_DEFINITIONS }
export type { ZoneDefinition }
