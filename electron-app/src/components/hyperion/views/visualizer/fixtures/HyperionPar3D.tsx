/**
 * ☀️ HYPERION — HyperionPar3D
 * 
 * PAR fixture simple con materiales emissive neon.
 * Diseñado para ser usado tanto individualmente como en InstancedMesh.
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionPar3D
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import React, { useRef, useMemo } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Fixture3DData } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const NEON_CYAN = '#00F0FF'
const NEON_MAGENTA = '#FF00E5'

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
  const beamRef = useRef<THREE.Mesh>(null)
  
  // 🛡️ WAVE 2042.13.17: Material refs to update properties in useFrame
  const lensMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
  const beamMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  
  const { id, intensity, color, selected, hasOverride } = fixture

  // ── Materials ─────────────────────────────────────────────────────────────
  const bodyMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#1a1a2e"
      metalness={0.8}
      roughness={0.2}
      emissive={selected ? NEON_CYAN : (hasOverride ? NEON_MAGENTA : '#1a1a2e')}
      emissiveIntensity={selected ? 0.4 : (hasOverride ? 0.2 : 0)}
    />
  ), [selected, hasOverride])

  // 🛡️ WAVE 2042.13.17: lensMaterial and beamMaterial removed from useMemo
  // Now using refs + direct property updates in useFrame for real-time reactivity

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {
    // Update beam visibility and scale
    if (beamRef.current && showBeam) {
      const beamScale = 1 + beatIntensity * 0.15
      beamRef.current.scale.set(beamScale, 1, beamScale)
      beamRef.current.visible = intensity > 0.01
    }
    
    // 🛡️ WAVE 2042.13.17: Update material properties directly every frame
    // 🎨 WAVE 2042.14: NEON TUNING - Balanced emissive for HDR bloom
    if (lensMaterialRef.current) {
      lensMaterialRef.current.color.copy(color)
      lensMaterialRef.current.emissive.copy(color)
      // PARs slightly brighter than movers (they're wash lights)
      lensMaterialRef.current.emissiveIntensity = 0.6 + intensity * 1.2 + beatIntensity * 0.3
      lensMaterialRef.current.opacity = 0.6 + intensity * 0.4
    }
    
    if (beamMaterialRef.current) {
      // 🎨 WAVE 2042.14: Beam opacity tuned for additive blending
      beamMaterialRef.current.color.copy(color)
      beamMaterialRef.current.opacity = intensity * 0.12 + beatIntensity * 0.04
    }
  })

  // ── Event Handlers ────────────────────────────────────────────────────────
  // 🛡️ WAVE 2042.13.14: Fixed ThreeEvent type for R3F v9
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect?.(id, e.shiftKey, e.ctrlKey || e.metaKey)
  }

  const beamLength = 1.5 + intensity * 1.5

  return (
    <group 
      ref={groupRef} 
      position={[fixture.x, fixture.y, fixture.z]}
      onClick={handleClick}
      userData={{ fixtureId: id }}
    >
      {/* PAR Body — Cylinder */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.10, 16]} />
        {bodyMaterial}
      </mesh>

      {/* Lens — Front face */}
      <mesh position={[0, 0, 0.06]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.11, 32]} />
        <meshStandardMaterial
          ref={lensMaterialRef}
          color={color}
          emissive={color}
          emissiveIntensity={intensity * 2.5 + beatIntensity * 0.5}
          transparent
          opacity={0.4 + intensity * 0.6}
          toneMapped={false}
        />
      </mesh>

      {/* Beam cone — Pointing down (default PAR orientation) */}
      {showBeam && intensity > 0.01 && (
        <mesh
          ref={beamRef}
          position={[0, -beamLength / 2 - 0.05, 0]}
          rotation={[0, 0, 0]}
        >
          <coneGeometry args={[0.3 + intensity * 0.2, beamLength, 16, 1, true]} />
          <meshBasicMaterial
            ref={beamMaterialRef}
            color={color}
            transparent
            opacity={intensity * 0.3}
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
