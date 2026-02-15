/**
 * ☀️ HYPERION — NeonFloor
 * 
 * Floor con grid neon que pulsa con el beat.
 * Grid cyberpunk con líneas cyan y magenta.
 * 
 * @module components/hyperion/views/visualizer/environment/NeonFloor
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
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
  const floorRef = useRef<THREE.Mesh>(null)
  const gridRef = useRef<THREE.LineSegments>(null)

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
  // 🛡️ WAVE 2042.14.3: Floor MUST be opaque to block beam cones
  const floorMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#080810"
      metalness={0.3}
      roughness={0.8}
    />
  ), [])

  const gridMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.15 + beatIntensity * 0.2,
      linewidth: 1,
    })
  }, [primaryColor, beatIntensity])

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {
    if (gridRef.current) {
      const material = gridRef.current.material as THREE.LineBasicMaterial
      material.opacity = 0.15 + beatIntensity * 0.25
      
      // Subtle color shift on beat
      if (beatIntensity > 0.5) {
        material.color.set(secondaryColor)
      } else {
        material.color.set(primaryColor)
      }
    }
  })

  return (
    <group>
      {/* Floor plane */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        {floorMaterial}
      </mesh>

      {/* Neon grid lines */}
      {showGrid && (
        <lineSegments ref={gridRef} geometry={gridGeometry} material={gridMaterial} />
      )}

      {/* Center cross highlight */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.05, 0.08, 4]} />
        <meshBasicMaterial 
          color={secondaryColor} 
          transparent 
          opacity={0.4 + beatIntensity * 0.3}
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
