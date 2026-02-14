/**
 * ☀️ HYPERION — HyperionTruss
 * 
 * Estructura de truss 3D con glow neon.
 * Marco visual que contextualiza la posición de los fixtures.
 * 
 * @module components/hyperion/views/visualizer/environment/HyperionTruss
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import React, { useMemo } from 'react'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const TRUSS_RADIUS = 0.05  // Tube radius
const TRUSS_COLOR = '#1a1a2e'
const NEON_CYAN = '#00F0FF'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HyperionTrussProps {
  width?: number
  depth?: number
  height?: number
  showGlow?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: TrussBeam
// ═══════════════════════════════════════════════════════════════════════════

interface TrussBeamProps {
  start: [number, number, number]
  end: [number, number, number]
  radius?: number
  showGlow?: boolean
}

const TrussBeam: React.FC<TrussBeamProps> = ({
  start,
  end,
  radius = TRUSS_RADIUS,
  showGlow = true,
}) => {
  const { position, rotation, length } = useMemo(() => {
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const midpoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5)
    const direction = new THREE.Vector3().subVectors(endVec, startVec)
    const len = direction.length()
    
    // Calculate rotation to align cylinder with direction
    const quaternion = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    quaternion.setFromUnitVectors(up, direction.normalize())
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    
    return {
      position: [midpoint.x, midpoint.y, midpoint.z] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
      length: len,
    }
  }, [start, end])

  return (
    <group position={position} rotation={rotation}>
      {/* Main truss tube */}
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 8]} />
        <meshStandardMaterial
          color={TRUSS_COLOR}
          metalness={0.8}
          roughness={0.3}
          emissive={showGlow ? NEON_CYAN : TRUSS_COLOR}
          emissiveIntensity={showGlow ? 0.03 : 0}
        />
      </mesh>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const HyperionTruss: React.FC<HyperionTrussProps> = ({
  width = 12,
  depth = 8,
  height = 5,
  showGlow = true,
}) => {
  const halfWidth = width / 2
  const halfDepth = depth / 2

  // Corner positions
  const corners = useMemo(() => ({
    // Back corners (z = -depth/2)
    backLeft: [-halfWidth, height, -halfDepth] as [number, number, number],
    backRight: [halfWidth, height, -halfDepth] as [number, number, number],
    // Front corners (z = +depth/2)
    frontLeft: [-halfWidth, height, halfDepth * 0.3] as [number, number, number],
    frontRight: [halfWidth, height, halfDepth * 0.3] as [number, number, number],
  }), [halfWidth, halfDepth, height])

  return (
    <group>
      {/* ═══════════════════════════════════════════════════════════════════
       * HORIZONTAL TRUSS BEAMS (Top frame)
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Back truss (main) */}
      <TrussBeam 
        start={corners.backLeft} 
        end={corners.backRight} 
        showGlow={showGlow} 
      />
      
      {/* Front truss (shorter, closer) */}
      <TrussBeam 
        start={corners.frontLeft} 
        end={corners.frontRight} 
        showGlow={showGlow} 
      />
      
      {/* Side trusses (connecting front to back) */}
      <TrussBeam 
        start={corners.backLeft} 
        end={corners.frontLeft} 
        showGlow={showGlow} 
      />
      <TrussBeam 
        start={corners.backRight} 
        end={corners.frontRight} 
        showGlow={showGlow} 
      />

      {/* ═══════════════════════════════════════════════════════════════════
       * VERTICAL SUPPORTS (Legs)
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Back left leg */}
      <TrussBeam 
        start={[-halfWidth, 0, -halfDepth]} 
        end={corners.backLeft} 
        showGlow={showGlow} 
      />
      
      {/* Back right leg */}
      <TrussBeam 
        start={[halfWidth, 0, -halfDepth]} 
        end={corners.backRight} 
        showGlow={showGlow} 
      />

      {/* ═══════════════════════════════════════════════════════════════════
       * CORNER NODES (Visual joints)
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {Object.values(corners).map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[TRUSS_RADIUS * 1.5, 8, 8]} />
          <meshStandardMaterial
            color={TRUSS_COLOR}
            metalness={0.9}
            roughness={0.2}
            emissive={NEON_CYAN}
            emissiveIntensity={showGlow ? 0.1 : 0}
          />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════════════════════════════════
       * ACCENT LINES (Neon edge highlights)
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Back truss neon line */}
      <mesh position={[0, height + 0.06, -halfDepth]}>
        <boxGeometry args={[width, 0.015, 0.015]} />
        <meshBasicMaterial color={NEON_CYAN} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

export default HyperionTruss
