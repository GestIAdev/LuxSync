/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ ZONE OVERLAY - WAVE 2040.27a: THE ARCHITECT'S VISION
 * "El Territorio Visual - CanonicalZone Native"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2040.27a: Layout basado en CanonicalZone (arquitectura "Fútbol"):
 * - MOVERS-LEFT  (columna izquierda) - Cyan
 * - MOVERS-RIGHT (columna derecha)   - Cyan
 * - FRONT        (franja inferior)   - Purple
 * - BACK         (franja superior)   - Blue/Purple
 * - FLOOR        (suelo/ground)      - Green
 * - CENTER       (impacto central)   - Red
 * - AIR          (atmósfera/laser)   - White alpha
 * 
 * @module components/views/StageConstructor/ZoneOverlay
 * @version 2040.27.0
 */

import React, { useMemo } from 'react'
import { Text } from '@react-three/drei'
import type { FixtureZone } from '../../../core/stage/ShowFileV2'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DEFINITIONS - 🌊 WAVE 2040.27a: CANONICAL ZONE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDefinition {
  id: FixtureZone
  name: string
  color: string
  position: [number, number, number]  // Centro de la zona [x, y, z]
  size: [number, number]              // [width, depth] en metros
  /** 🌊 WAVE 2040.27a: Canal estéreo que asigna esta zona */
  stereoChannel: 'frontL' | 'frontR' | 'backL' | 'backR' | 'moverL' | 'moverR' | 'center' | 'floor' | 'air'
}

/**
 * 🌊 WAVE 2040.27a: CANONICAL ZONE LAYOUT ("Fútbol" Architecture)
 * 
 * Layout Visual (vista desde arriba, audiencia abajo):
 * 
 *        Z- (BACK/Fondo del escenario)
 *   ┌─────────┬─────────────────┬─────────┐
 *   │         │                 │         │
 *   │ MOVERS  │      BACK       │ MOVERS  │
 *   │   Ⓛ    │   (wash/pars)   │   Ⓡ    │
 *   │         │                 │         │
 *   │         ├───────┬─────────┤         │
 *   │  (cyan) │ CENTER│  FLOOR  │ (cyan)  │
 *   │         │ (red) │ (green) │         │
 *   │         ├───────┴─────────┤         │
 *   │         │                 │         │
 *   │         │      FRONT      │         │
 *   │         │   (wash/pars)   │         │
 *   └─────────┴─────────────────┴─────────┘
 *        Z+ (FRONT/Audiencia)
 *   
 *   X-              X=0              X+
 */
const ZONE_DEFINITIONS: ZoneDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // COLUMNA IZQUIERDA - MOVERS-LEFT (Moving Heads)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'movers-left',
    name: 'MOVER Ⓛ',
    color: '#22d3ee',      // Cyan = Motion
    position: [-6, 0.02, 0],
    size: [2.5, 9],
    stereoChannel: 'moverL'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // COLUMNA DERECHA - MOVERS-RIGHT (Moving Heads)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'movers-right',
    name: 'MOVER Ⓡ',
    color: '#22d3ee',      // Cyan = Motion
    position: [6, 0.02, 0],
    size: [2.5, 9],
    stereoChannel: 'moverR'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // BACK - Franja superior (fondo del escenario, Z < -1)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'back',
    name: 'BACK',
    color: '#8b5cf6',      // Purple/Violet = Wash
    position: [0, 0.02, -2.5],  // Centro de la franja back (Z=-2.5)
    size: [9, 3],               // Ancho 9m (entre movers), profundidad 3m (Z=-4 a Z=-1)
    stereoChannel: 'backL'      // Default L, position.x determines actual stereo
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // FRONT - Franja inferior (cerca de audiencia, Z > 1)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'front',
    name: 'FRONT',
    color: '#a855f7',      // Purple = Wash
    position: [0, 0.02, 2],     // Centro de la franja front (Z=2)
    size: [9, 2],               // Ancho 9m, profundidad 2m (Z=1 a Z=3)
    stereoChannel: 'frontL'     // Default L, position.x determines actual stereo
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 2040.27b: CENTER - Zona central (X: -2 a 2, Z: -1 a 1)
  // Para strobes/blinders en el corazón del escenario
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'center',
    name: 'CENTER',
    color: '#ef4444',      // Red = Strobe/Impact
    position: [0, 0.02, 0],     // Centro exacto del escenario
    size: [4, 2],               // 4m ancho (X=-2 a X=2), 2m profundidad (Z=-1 a Z=1)
    stereoChannel: 'center'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 2040.27b: FLOOR - Zonas laterales del centro (Z: -1 a 1, X fuera de ±2)
  // Para uplights, floor PARs en los lados
  // Se divide en 2 rectángulos: LEFT y RIGHT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'floor',
    name: 'FLOOR L',
    color: '#22c55e',      // Green = Ground level
    position: [-3.5, 0.02, 0],  // Lado izquierdo (X=-5 a X=-2)
    size: [3, 2],               // 3m ancho, 2m profundidad (Z=-1 a Z=1)
    stereoChannel: 'floor'
  },
  
  // FLOOR RIGHT (para visual, mismo ID 'floor' en lógica)
  {
    id: 'floor',
    name: 'FLOOR R',
    color: '#22c55e',      // Green = Ground level
    position: [3.5, 0.02, 0],   // Lado derecho (X=2 a X=5)
    size: [3, 2],               // 3m ancho, 2m profundidad (Z=-1 a Z=1)
    stereoChannel: 'floor'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // AIR - Atmósfera (lasers, haze, aerials) - Overlay sutil
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'air',
    name: 'AIR',
    color: '#ffffff',      // White/Alpha = Atmosphere
    position: [0, 0.01, 0],  // Ligeramente más bajo para estar detrás
    size: [12, 10],
    stereoChannel: 'air'
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
