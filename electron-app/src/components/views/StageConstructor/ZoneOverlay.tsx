/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ ZONE OVERLAY - WAVE 363 + WAVE 1036: 6-ZONE LAYOUT
 * "El Territorio Visual - Ver para Dominar"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1036: Simplificado a 6 zonas claras para arquitectura estéreo:
 * - MOVER LEFT (columna izquierda)
 * - FRONT LEFT / FRONT RIGHT (centro superior)
 * - BACK LEFT / BACK RIGHT (centro inferior)  
 * - MOVER RIGHT (columna derecha)
 * 
 * @module components/views/StageConstructor/ZoneOverlay
 * @version 1036.0.0
 */

import React, { useMemo } from 'react'
import { Text } from '@react-three/drei'
import type { FixtureZone } from '../../../core/stage/ShowFileV2'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DEFINITIONS - 🌊 WAVE 1036: 6-ZONE STEREO LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDefinition {
  id: FixtureZone
  name: string
  color: string
  position: [number, number, number]  // Centro de la zona [x, y, z]
  size: [number, number]              // [width, depth] en metros
  /** 🌊 WAVE 1036: Canal estéreo que asigna esta zona */
  stereoChannel: 'frontL' | 'frontR' | 'backL' | 'backR' | 'moverL' | 'moverR'
}

/**
 * 🌊 WAVE 1036: 6-ZONE STEREO LAYOUT
 * 
 * Layout Visual (vista desde arriba, audiencia abajo):
 * 
 *        Z- (BACK/Fondo)
 *   ┌─────┬───────┬───────┬─────┐
 *   │     │ BACK  │ BACK  │     │
 *   │ MOV │  Ⓛ   │  Ⓡ   │ MOV │
 *   │  Ⓛ  │       │       │  Ⓡ  │
 *   │     ├───────┼───────┤     │
 *   │     │ FRONT │ FRONT │     │
 *   │     │  Ⓛ   │  Ⓡ   │     │
 *   └─────┴───────┴───────┴─────┘
 *        Z+ (FRONT/Audiencia)
 *   
 *   X-          X=0          X+
 */
const ZONE_DEFINITIONS: ZoneDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // COLUMNA IZQUIERDA - MOVER LEFT (Expanded +50%)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'ceiling-left',
    name: 'MOVER Ⓛ',
    color: '#22d3ee',      // Cyan
    position: [-7, 0.02, 0],
    size: [3, 9],          // Was [2, 6] - Now +50%
    stereoChannel: 'moverL'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // BLOQUE CENTRAL - 4 CUADRANTES STEREO (Expanded +50%)
  // ═══════════════════════════════════════════════════════════════════════
  
  // BACK LEFT (arriba-izquierda = fondo del escenario, lado izquierdo)
  {
    id: 'floor-back',      // Reusing existing zone ID for compatibility
    name: 'BACK Ⓛ',
    color: '#a855f7',      // Purple
    position: [-2.5, 0.02, -2.5],
    size: [5, 4],          // Was [3.5, 2.5] - Now +40%
    stereoChannel: 'backL'
  },
  
  // BACK RIGHT (arriba-derecha = fondo del escenario, lado derecho)
  {
    id: 'ceiling-back',    // Reusing existing zone ID for compatibility
    name: 'BACK Ⓡ',
    color: '#d946ef',      // Fuchsia
    position: [2.5, 0.02, -2.5],
    size: [5, 4],          // Was [3.5, 2.5] - Now +40%
    stereoChannel: 'backR'
  },
  
  // FRONT LEFT (abajo-izquierda = cerca de audiencia, lado izquierdo)
  {
    id: 'floor-front',     // Reusing existing zone ID for compatibility
    name: 'FRONT Ⓛ',
    color: '#a855f7',      // Purple
    position: [-2.5, 0.02, 2],
    size: [5, 4],          // Was [3.5, 2.5] - Now +40%
    stereoChannel: 'frontL'
  },
  
  // FRONT RIGHT (abajo-derecha = cerca de audiencia, lado derecho)
  {
    id: 'ceiling-front',   // Reusing existing zone ID for compatibility
    name: 'FRONT Ⓡ',
    color: '#d946ef',      // Fuchsia
    position: [2.5, 0.02, 2],
    size: [5, 4],          // Was [3.5, 2.5] - Now +40%
    stereoChannel: 'frontR'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // COLUMNA DERECHA - MOVER RIGHT (Expanded +50%)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'ceiling-right',
    name: 'MOVER Ⓡ',
    color: '#22d3ee',      // Cyan
    position: [7, 0.02, 0],
    size: [3, 9],          // Was [2, 6] - Now +50%
    stereoChannel: 'moverR'
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
 * 🌊 WAVE 1036: Obtiene el canal estéreo para una posición dada
 * Esto es lo que determina qué intensidad recibe el fixture
 */
export function getStereoChannelAtPosition(x: number, z: number): ZoneDefinition['stereoChannel'] | null {
  for (const zone of ZONE_DEFINITIONS) {
    const [cx, , cz] = zone.position
    const [width, depth] = zone.size
    
    const halfWidth = width / 2
    const halfDepth = depth / 2
    
    if (
      x >= cx - halfWidth && x <= cx + halfWidth &&
      z >= cz - halfDepth && z <= cz + halfDepth
    ) {
      return zone.stereoChannel
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
 * 🌊 WAVE 1036: Obtiene el canal estéreo de una zona por ID
 */
export function getZoneStereoChannel(zoneId: FixtureZone): ZoneDefinition['stereoChannel'] | null {
  const zone = ZONE_DEFINITIONS.find(z => z.id === zoneId)
  return zone?.stereoChannel || null
}

/**
 * Exportar las definiciones para uso externo
 */
export { ZONE_DEFINITIONS }
export type { ZoneDefinition }
