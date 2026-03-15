/**
 * ☀️ HYPERION — NeonFloor
 * 
 * Floor con grid neon estático cyberpunk.
 * Grid CYAN constante — sin pulso, sin reactividad al beat.
 * Elegante, limpio, profesional.
 * 
 * 🔧 WAVE 2205: STATIC GRID — Eliminada TODA modulación reactiva al audio.
 *   El parpadeo con el beat mareaba al usuario.
 *   Grid ahora es estático con opacidad y color fijos.
 * 
 * @module components/hyperion/views/visualizer/environment/NeonFloor
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 * @updated WAVE 2205 — Static Grid: Zero beat reactivity
 */

import React, { useMemo } from 'react'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const GRID_SIZE = 0.5  // Grid cell size in meters
const GRID_DIVISIONS_X = 24
const GRID_DIVISIONS_Z = 16

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface NeonFloorProps {
  width?: number
  depth?: number
  showGrid?: boolean
  beatIntensity?: number
  primaryColor?: string
  secondaryColor?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const NeonFloor: React.FC<NeonFloorProps> = ({
  width = 12,
  depth = 8,
  showGrid = true,
  beatIntensity = 0,
  primaryColor = '#00F0FF',
  secondaryColor = '#FF00E5',
}) => {
  const floorRef = null  // Keep for JSX ref compatibility

  // ── Grid Geometry ─────────────────────────────────────────────────────────
  const gridGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    const halfWidth = width / 2
    const halfDepth = depth / 2

    // Vertical lines (X direction)
    for (let i = 0; i <= GRID_DIVISIONS_X; i++) {
      const x = -halfWidth + (i * width / GRID_DIVISIONS_X)
      points.push(new THREE.Vector3(x, 0.01, -halfDepth))
      points.push(new THREE.Vector3(x, 0.01, halfDepth))
    }

    // Horizontal lines (Z direction)
    for (let i = 0; i <= GRID_DIVISIONS_Z; i++) {
      const z = -halfDepth + (i * depth / GRID_DIVISIONS_Z)
      points.push(new THREE.Vector3(-halfWidth, 0.01, z))
      points.push(new THREE.Vector3(halfWidth, 0.01, z))
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    return geometry
  }, [width, depth])

  // ── Materials ─────────────────────────────────────────────────────────────
  // 🛡️ WAVE 2042.15.2: Floor MUST be SOLID to block beam cones
  const floorMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#080810"
      metalness={0.3}
      roughness={0.8}
      depthWrite={true}
      depthTest={true}
    />
  ), [])

  // 🔧 WAVE 2205: Opacidad FIJA 0.2 — sin beatIntensity. Grid estático cyberpunk.
  const gridMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.2,
      linewidth: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  }, [primaryColor])

  // 🔧 WAVE 2205: Grid es completamente estático. Sin useFrame. Sin modulación.
  //    Opacidad y color fijos en el material.

  return (
    <group>
      {/* Floor plane - SOLID, renders first to block beams */}
      <mesh 
        ref={floorRef} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
        renderOrder={-1}
      >
        <planeGeometry args={[width, depth]} />
        {floorMaterial}
      </mesh>

      {/* Neon grid lines */}
      {showGrid && (
        <lineSegments geometry={gridGeometry} material={gridMaterial} />
      )}

      {/* Center cross highlight — estático */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.05, 0.08, 4]} />
        <meshBasicMaterial 
          color={primaryColor} 
          transparent 
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* Stage line (front of stage) */}
      <mesh position={[0, 0.02, depth / 2 - 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 1, 0.05]} />
        <meshBasicMaterial color={primaryColor} transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

export default NeonFloor
