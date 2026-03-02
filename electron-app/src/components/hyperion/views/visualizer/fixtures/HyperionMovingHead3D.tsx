/**
 * ☀️ HYPERION — HyperionMovingHead3D v3
 * 
 * WAVE 2088: Physics-Aligned Render
 * 
 * BEFORE (v2): Used raw `pan` (TARGET) + SLERP interpolation in the render.
 * This caused DOUBLE interpolation (physics + SLERP) and erratic movement
 * because the SLERP was chasing a target that jumped every frame.
 * 
 * NOW (v3): Uses `physicalPan` (ACTUAL position from FixturePhysicsDriver).
 * The physics engine already handles smooth interpolation with speed limits.
 * The render just FOLLOWS — no extra smoothing, no double interpolation.
 * 
 * This aligns the 3D view with the 2D views (TacticalView, Cinema) which
 * already use physicalPan correctly and look smooth.
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D
 * @since WAVE 2042.15 (Clean Rewrite), WAVE 2088 (Physics Alignment)
 */

import React, { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Fixture3DData } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Pan range: 0-1 → -180° to +180° (full 360° sweep) */
const PAN_RANGE = Math.PI * 2
/** Tilt range: 0-1 → -90° to +90° (full 180° arc) */
const TILT_RANGE = Math.PI
const NEON_CYAN = '#00F0FF'

// Quaternion axes (allocated once, shared across instances)
const PAN_AXIS = new THREE.Vector3(0, 1, 0)
const TILT_AXIS = new THREE.Vector3(1, 0, 0)

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

  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2088: Quaternions set DIRECTLY from physicalPan/physicalTilt.
  // No SLERP — the FixturePhysicsDriver already interpolated the position.
  // ═══════════════════════════════════════════════════════════════════════
  const yokeQuat = useRef(new THREE.Quaternion())
  const headQuat = useRef(new THREE.Quaternion())

  const { id, intensity, color, physicalPan, physicalTilt, zoom, selected, hasOverride } = fixture
  
  // Convert normalized 0-1 to radians
  const panAngle = (physicalPan - 0.5) * PAN_RANGE
  const tiltAngle = -(physicalTilt - 0.5) * TILT_RANGE

  // 🎨 WAVE 2042.15.3: ULTRA TIGHT beam for MovingHeads (precision spot)
  const beamWidth = 0.04 + zoom * 0.02
  const beamLength = 3 + intensity * 2

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2088: DIRECT QUATERNION — No SLERP
    //
    // BEFORE: targetQuat.setFromAxisAngle(...) → currentQuat.slerp(target, t)
    //   Problem: DOUBLE interpolation. Physics already smoothed the position.
    //   The SLERP was chasing a smoothed-target that ALSO moved smoothly,
    //   creating lag + overshoot + erratic "jenízaro" movement.
    //
    // NOW: physicalPan IS the smooth position. Set quaternion directly.
    //   Result: 3D render matches 2D render perfectly. Physics owns smoothing.
    // ═══════════════════════════════════════════════════════════════════════
    yokeQuat.current.setFromAxisAngle(PAN_AXIS, panAngle)
    headQuat.current.setFromAxisAngle(TILT_AXIS, tiltAngle)

    if (yokeRef.current) yokeRef.current.quaternion.copy(yokeQuat.current)
    if (headRef.current) headRef.current.quaternion.copy(headQuat.current)

    // Update lens
    if (lensMaterialRef.current) {
      lensMaterialRef.current.color.copy(color)
      lensMaterialRef.current.opacity = 0.7 + intensity * 0.3
    }
    
    // Update beam
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
