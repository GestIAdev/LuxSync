/**
 * ☀️ HYPERION — HyperionPar3D v2
 * 
 * CLEAN REWRITE - No más parches sobre parches
 * Simple PAR fixture con geometría básica y materiales que FUNCIONAN.
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionPar3D
 * @since WAVE 2042.15 (Clean Rewrite)
 */

import React, { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Fixture3DData } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const NEON_CYAN = '#00F0FF'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HyperionPar3DProps {
  fixture: Fixture3DData
  onSelect?: (id: string, shift: boolean, ctrl: boolean) => void
  showBeam?: boolean
  beatIntensity?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const HyperionPar3D: React.FC<HyperionPar3DProps> = ({
  fixture,
  onSelect,
  showBeam = true,
  beatIntensity = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const lensMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const beamMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  
  const { id, intensity, color, selected, hasOverride } = fixture
  const beamLength = 1.5 + intensity * 1.5

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {
    // Update lens - simple MeshBasicMaterial with color modulation
    if (lensMaterialRef.current) {
      lensMaterialRef.current.color.copy(color)
      lensMaterialRef.current.opacity = 0.3 + intensity * 0.7
    }
    
    // Update beam - additive blending
    if (beamMaterialRef.current && showBeam) {
      beamMaterialRef.current.color.copy(color)
      beamMaterialRef.current.opacity = intensity * 0.15
    }
  })

  // ── Event Handlers ────────────────────────────────────────────────────────
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect?.(id, e.shiftKey, e.ctrlKey || e.metaKey)
  }

  return (
    <group 
      ref={groupRef} 
      position={[fixture.x, fixture.y, fixture.z]}
      onClick={handleClick}
      userData={{ fixtureId: id }}
    >
      {/* PAR Body — Simple cylinder */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.10, 16]} />
        <meshStandardMaterial
          color={selected ? NEON_CYAN : (hasOverride ? '#FF00E5' : '#1a1a2e')}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Lens — Bright colored circle (MeshBasicMaterial = no lighting calculations) */}
      <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.11, 32]} />
        <meshBasicMaterial
          ref={lensMaterialRef}
          color={color}
          transparent
          opacity={1.0}
        />
      </mesh>

      {/* Beam cone — AdditiveBlending for glow effect 
          🎨 WAVE 2042.15.1: Tight beam - reduced width for more focused look */}
      {showBeam && intensity > 0.01 && (
        <mesh
          position={[0, -beamLength / 2 - 0.06, 0]}
          rotation={[0, 0, 0]}
        >
          <coneGeometry args={[0.15 + intensity * 0.1, beamLength, 16, 1, true]} />
          <meshBasicMaterial
            ref={beamMaterialRef}
            color={color}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0, 0.08]} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.14, 0.17, 32]} />
          <meshBasicMaterial 
            color={NEON_CYAN} 
            transparent 
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

export default HyperionPar3D
