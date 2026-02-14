/**
 * ☀️ HYPERION — HyperionMovingHead3D
 * 
 * Moving head 3D con Quaternion SLERP para rotaciones suaves sin gimbal lock.
 * Materiales emissive neon que brillan con la intensidad del fixture.
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 */

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Fixture3DData } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Rotation axes */
const PAN_AXIS = new THREE.Vector3(0, 1, 0)   // Y-axis for PAN
const TILT_AXIS = new THREE.Vector3(1, 0, 0)  // X-axis for TILT

/** Pan range: 0-1 normalized → -180° to +180° */
const PAN_RANGE = Math.PI * 2  // 360°

/** Tilt range: 0-1 normalized → -90° to +90° */
const TILT_RANGE = Math.PI     // 180°

/** SLERP interpolation speed (higher = snappier) */
const SLERP_SPEED = 8.0

/** Neon colors */
const NEON_CYAN = '#00F0FF'
const NEON_MAGENTA = '#FF00E5'

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
  // ── Refs ──────────────────────────────────────────────────────────────────
  const groupRef = useRef<THREE.Group>(null)
  const yokeRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const lensRef = useRef<THREE.Mesh>(null)

  // Quaternion refs for SLERP interpolation
  const targetYokeQuat = useRef(new THREE.Quaternion())
  const currentYokeQuat = useRef(new THREE.Quaternion())
  const targetHeadQuat = useRef(new THREE.Quaternion())
  const currentHeadQuat = useRef(new THREE.Quaternion())

  // ── Derived Values ────────────────────────────────────────────────────────
  const { id, intensity, color, pan, tilt, zoom, selected, hasOverride } = fixture

  // Convert normalized pan/tilt to radians
  const targetPanAngle = (pan - 0.5) * PAN_RANGE   // -180° to +180°
  const targetTiltAngle = -(tilt - 0.5) * TILT_RANGE // -90° to +90° (negated for correct direction)

  // Beam width based on zoom (0=tight spot, 1=wide wash)
  const beamWidth = useMemo(() => 0.05 + zoom * 0.2, [zoom])
  const beamLength = useMemo(() => 3 + intensity * 2, [intensity])

  // ── Materials ─────────────────────────────────────────────────────────────
  const baseMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#0a0a14"
      metalness={0.9}
      roughness={0.1}
      emissive={selected ? NEON_CYAN : '#0a0a14'}
      emissiveIntensity={selected ? 0.3 : 0}
    />
  ), [selected])

  const yokeMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#12122a"
      metalness={0.85}
      roughness={0.15}
      emissive={NEON_CYAN}
      emissiveIntensity={0.05}
    />
  ), [])

  const headMaterial = useMemo(() => (
    <meshStandardMaterial
      color="#0a0a0a"
      metalness={0.9}
      roughness={0.2}
      emissive={hasOverride ? NEON_MAGENTA : '#0a0a0a'}
      emissiveIntensity={hasOverride ? 0.2 : 0}
    />
  ), [hasOverride])

  const lensMaterial = useMemo(() => {
    const baseColor = color.clone()
    const emissiveColor = baseColor.clone().multiplyScalar(intensity)
    
    return (
      <meshStandardMaterial
        color={baseColor}
        emissive={emissiveColor}
        emissiveIntensity={intensity * 2.0 + beatIntensity * 0.5}
        transparent
        opacity={0.3 + intensity * 0.7}
        toneMapped={false}
      />
    )
  }, [color, intensity, beatIntensity])

  const beamMaterial = useMemo(() => {
    const beamColor = color.clone()
    
    return (
      <meshBasicMaterial
        color={beamColor}
        transparent
        opacity={intensity * 0.4}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    )
  }, [color, intensity])

  // ── Animation Frame ───────────────────────────────────────────────────────
  useFrame((_, delta) => {
    // Calculate target quaternions from angles
    targetYokeQuat.current.setFromAxisAngle(PAN_AXIS, targetPanAngle)
    targetHeadQuat.current.setFromAxisAngle(TILT_AXIS, targetTiltAngle)

    // SLERP interpolation — smooth, no gimbal lock
    // Exponential decay for frame-independent smoothing
    const t = 1 - Math.exp(-SLERP_SPEED * delta)

    currentYokeQuat.current.slerp(targetYokeQuat.current, t)
    currentHeadQuat.current.slerp(targetHeadQuat.current, t)

    // Apply quaternions (NOT euler angles)
    if (yokeRef.current) {
      yokeRef.current.quaternion.copy(currentYokeQuat.current)
    }
    if (headRef.current) {
      headRef.current.quaternion.copy(currentHeadQuat.current)
    }

    // Update beam scale with intensity + beat
    if (beamRef.current && showBeam) {
      const beatScale = 1 + beatIntensity * 0.1
      beamRef.current.scale.set(
        (beamWidth + beatIntensity * 0.02) * beatScale,
        beamLength * intensity,
        (beamWidth + beatIntensity * 0.02) * beatScale
      )
      beamRef.current.visible = intensity > 0.01
    }
  })

  // ── Event Handlers ────────────────────────────────────────────────────────
  const handleClick = (e: { stopPropagation: () => void; nativeEvent?: { shiftKey?: boolean; ctrlKey?: boolean } }) => {
    e.stopPropagation()
    onSelect?.(id, e.nativeEvent?.shiftKey ?? false, e.nativeEvent?.ctrlKey ?? false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <group 
      ref={groupRef} 
      position={[fixture.x, fixture.y, fixture.z]}
      onClick={handleClick}
      userData={{ fixtureId: id }}
    >
      {/* BASE — The mounting bracket */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.08, 16]} />
        {baseMaterial}
      </mesh>

      {/* YOKE — Rotates on Y (pan) */}
      <group ref={yokeRef} position={[0, 0.08, 0]}>
        {/* Left arm */}
        <mesh position={[-0.10, -0.08, 0]}>
          <boxGeometry args={[0.015, 0.2, 0.03]} />
          {yokeMaterial}
        </mesh>
        {/* Right arm */}
        <mesh position={[0.10, -0.08, 0]}>
          <boxGeometry args={[0.015, 0.2, 0.03]} />
          {yokeMaterial}
        </mesh>

        {/* HEAD — Rotates on X (tilt) */}
        <group ref={headRef} position={[0, -0.12, 0]}>
          {/* Main body */}
          <mesh>
            <cylinderGeometry args={[0.06, 0.08, 0.14, 16]} />
            {headMaterial}
          </mesh>

          {/* Lens — Emits light */}
          <mesh ref={lensRef} position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.055, 32]} />
            {lensMaterial}
          </mesh>

          {/* Beam cone — Only visible when light is on */}
          {showBeam && intensity > 0.01 && (
            <mesh
              ref={beamRef}
              position={[0, -beamLength / 2 - 0.1, 0]}
              rotation={[0, 0, 0]}
            >
              <coneGeometry args={[beamWidth, beamLength, 16, 1, true]} />
              {beamMaterial}
            </mesh>
          )}
        </group>
      </group>

      {/* Selection ring — visible when selected */}
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
