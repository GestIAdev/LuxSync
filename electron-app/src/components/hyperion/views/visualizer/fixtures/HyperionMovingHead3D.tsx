/**
 * ☀️ HYPERION — HyperionMovingHead3D v3.2
 * 
 * WAVE 2088.2: Physics-Aligned Render + Visual Smoothing + Sane Angular Range
 * 
 * v2 (old):     Raw `pan` + SLERP = double interpolation, erratic.
 * v3 (broken):  physicalPan DIRECT, no smoothing = hydra effect.
 * v3.1:         physicalPan + exponential smoothing = no more hydra BUT
 *               PAN_RANGE=2π (±180°) and TILT_RANGE=π (±90°) = epileptic
 *               because 2D views use only ±81°. Same data, 2.2x more rotation.
 * v3.2 (this):  Sane angular ranges aligned with real fixtures:
 *               PAN ±135° (270° total), TILT ±67.5° (135° total).
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D
 * @since WAVE 2042.15, WAVE 2088-2088.2
 */

import React, { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Fixture3DData } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🛡️ WAVE 2088.2: ANGULAR RANGE — Aligned with real fixtures & 2D views
 * 
 * BEFORE: PAN_RANGE = 2π (±180°), TILT_RANGE = π (±90°)
 *   → A physicalPan sweep from 0→1 rotated 360° in 3D — INSANE.
 *   → TacticalCanvas and Cinema only use ±81° (Math.PI * 0.45).
 *   → Same data looked 2.2x more aggressive in 3D vs 2D.
 * 
 * NOW: Matched to professional moving head specs:
 *   Pan:  ±135° (270° total) — Standard for Clay Paky, Robe, etc.
 *   Tilt: ±67.5° (135° total) — Typical tilt arc for yoke fixtures.
 * 
 * These are visual/cosmetic — they don't affect DMX output.
 * The 2D views use ±81° because that's appropriate for a top-down view.
 * The 3D uses wider range because you SEE the full mechanical rotation.
 */
const PAN_RANGE = Math.PI * 1.5    // ±135° (270° total sweep)
const TILT_RANGE = Math.PI * 0.75  // ±67.5° (135° total arc)
const NEON_CYAN = '#00F0FF'

/**
 * 🛡️ WAVE 2088.1: VISUAL SMOOTHING — Same pattern as TacticalCanvas (0.10)
 * and useFixtureRender (0.30). The store updates at 60fps with micro-steps;
 * without smoothing, R3F's useFrame renders every micro-step as a hard jump.
 * 
 * This is NOT physics interpolation (that's FixturePhysicsDriver's job).
 * This is purely COSMETIC — "la mentira piadosa" that hides IPC jitter.
 * 
 * 0.08 = heavy/cinematic (slightly slower than TacticalCanvas's 0.10)
 * because 3D feels more jarring than 2D at the same speed.
 */
const VISUAL_SMOOTH = 0.12

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
  // 🛡️ WAVE 2088.1: Visual smoothing state — persistent across renders.
  // Same exponential-smoothing pattern as TacticalCanvas & useFixtureRender.
  // Smooths the NORMALIZED values (0-1) before converting to quaternion.
  // ═══════════════════════════════════════════════════════════════════════
  const smoothPan = useRef<number | null>(null)
  const smoothTilt = useRef<number | null>(null)
  const yokeQuat = useRef(new THREE.Quaternion())
  const headQuat = useRef(new THREE.Quaternion())

  const { id, intensity, color, physicalPan, physicalTilt, zoom, selected, hasOverride } = fixture

  // 🎨 WAVE 2042.15.3: ULTRA TIGHT beam for MovingHeads (precision spot)
  const beamWidth = 0.04 + zoom * 0.02
  const beamLength = 3 + intensity * 2

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2088.1: EXPONENTIAL SMOOTHING on normalized values
    //
    // physicalPan arrives from the store at ~60fps with micro-steps.
    // Without smoothing, each micro-step renders as a hard angular jump
    // (the "hydra" effect — multiple beams flashing in random directions).
    //
    // Solution: same pattern TacticalCanvas uses (SMOOTHING_FACTOR = 0.10).
    // Smooth the 0-1 value BEFORE converting to quaternion.
    // First frame: snap to current position (no animation from 0).
    // ═══════════════════════════════════════════════════════════════════════
    if (smoothPan.current === null) {
      // First frame: initialize — no interpolation, just snap
      smoothPan.current = physicalPan
      smoothTilt.current = physicalTilt
    } else {
      // Exponential smoothing: chase the target gradually
      smoothPan.current += (physicalPan - smoothPan.current) * VISUAL_SMOOTH
      smoothTilt.current! += (physicalTilt - smoothTilt.current!) * VISUAL_SMOOTH
    }

    // Convert smoothed 0-1 to radians
    const panAngle = (smoothPan.current - 0.5) * PAN_RANGE
    const tiltAngle = -(smoothTilt.current! - 0.5) * TILT_RANGE

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
