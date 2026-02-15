/**
 * ☀️ HYPERION — HyperionMovingHead3D v2
 * 
 * CLEAN REWRITE - No más parches sobre parches
 * Moving head con SLERP suave y materiales simples que FUNCIONAN.
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D
 * @since WAVE 2042.15 (Clean Rewrite)
 */

import React, { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Fixture3DData } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PAN_AXIS = new THREE.Vector3(0, 1, 0)
const TILT_AXIS = new THREE.Vector3(1, 0, 0)
const PAN_RANGE = Math.PI * 2
const TILT_RANGE = Math.PI
const SLERP_SPEED = 2.0
const MAX_DELTA = 1 / 30
const MIN_DELTA = 1 / 144
const NEON_CYAN = '#00F0FF'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface HyperionMovingHead3DProps {
  fixture: Fixture3DData
  onSelect?: (id: string, shift: boolean, ctrl: boolean) => void
  showBeam?: boolean
  beatIntensity?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const HyperionMovingHead3D: React.FC<HyperionMovingHead3DProps> = ({
  fixture,
  onSelect,
  showBeam = true,
  beatIntensity = 0,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const yokeRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const lensMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const beamMaterialRef = useRef<THREE.MeshBasicMaterial>(null)

  // Quaternions for smooth rotation
  const targetYokeQuat = useRef(new THREE.Quaternion())
  const currentYokeQuat = useRef(new THREE.Quaternion())
  const targetHeadQuat = useRef(new THREE.Quaternion())
  const currentHeadQuat = useRef(new THREE.Quaternion())

  const { id, intensity, color, pan, tilt, zoom, selected, hasOverride } = fixture
  
  const targetPanAngle = (pan - 0.5) * PAN_RANGE
  const targetTiltAngle = -(tilt - 0.5) * TILT_RANGE
  // 🎨 WAVE 2042.15.3: ULTRA TIGHT beam for MovingHeads (precision spot)
  const beamWidth = 0.04 + zoom * 0.02
  const beamLength = 3 + intensity * 2

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const dt = Math.max(MIN_DELTA, Math.min(delta, MAX_DELTA))

    // SLERP rotation
    targetYokeQuat.current.setFromAxisAngle(PAN_AXIS, targetPanAngle)
    targetHeadQuat.current.setFromAxisAngle(TILT_AXIS, targetTiltAngle)
    
    const t = 1 - Math.exp(-SLERP_SPEED * dt)
    currentYokeQuat.current.slerp(targetYokeQuat.current, t)
    currentHeadQuat.current.slerp(targetHeadQuat.current, t)

    if (yokeRef.current) yokeRef.current.quaternion.copy(currentYokeQuat.current)
    if (headRef.current) headRef.current.quaternion.copy(currentHeadQuat.current)

    // Update lens - MORE BRIGHTNESS
    if (lensMaterialRef.current) {
      lensMaterialRef.current.color.copy(color)
      lensMaterialRef.current.opacity = 0.7 + intensity * 0.3
    }
    
    // Update beam - MORE OPACITY
    if (beamMaterialRef.current && showBeam) {
      beamMaterialRef.current.color.copy(color)
      beamMaterialRef.current.opacity = intensity * 0.25
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
      {/* BASE */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.08, 16]} />
        <meshStandardMaterial
          color={selected ? NEON_CYAN : '#0a0a14'}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* YOKE — Pan rotation */}
      <group ref={yokeRef} position={[0, 0.08, 0]}>
        <mesh position={[-0.10, -0.08, 0]}>
          <boxGeometry args={[0.015, 0.2, 0.03]} />
          <meshStandardMaterial color="#12122a" metalness={0.85} roughness={0.15} />
        </mesh>
        <mesh position={[0.10, -0.08, 0]}>
          <boxGeometry args={[0.015, 0.2, 0.03]} />
          <meshStandardMaterial color="#12122a" metalness={0.85} roughness={0.15} />
        </mesh>

        {/* HEAD — Tilt rotation */}
        <group ref={headRef} position={[0, -0.12, 0]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.08, 0.14, 16]} />
            <meshStandardMaterial
              color={hasOverride ? '#FF00E5' : '#0a0a0a'}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>

          {/* Lens — MeshBasicMaterial for bright color */}
          <mesh position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.055, 32]} />
            <meshBasicMaterial
              ref={lensMaterialRef}
              color={color}
              transparent
              opacity={1.0}
            />
          </mesh>

          {/* Beam */}
          {showBeam && intensity > 0.01 && (
            <mesh position={[0, -beamLength / 2 - 0.08, 0]}>
              <coneGeometry args={[beamWidth, beamLength, 16, 1, true]} />
              <meshBasicMaterial
                ref={beamMaterialRef}
                color={color}
                transparent
                opacity={0.12}
                side={THREE.DoubleSide}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          )}
        </group>
      </group>

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.22, 32]} />
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

export default HyperionMovingHead3D
