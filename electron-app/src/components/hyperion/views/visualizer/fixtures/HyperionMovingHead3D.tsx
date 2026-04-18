/**
 * ☀️ HYPERION — HyperionMovingHead3D v3.5
 * 
 * WAVE 2088.12: VIBE-AWARE BEAM CONE — Dynamic zoom visualization
 * 
 * v3.3:         TILT_REST_ANGLE fixed
 * v3.4:         Beam cone width driven LIVE by zoom DMX from store.
 * v3.5 (this):  HDR BLOOM RESURRECTION (WAVE 2204)
 *               Lens y beam multiplican color a rango HDR proporcional al dimmer.
 *               multiplyScalar(1.0 + intensity * 2.0) → luminance ~3.0 a full dimmer.
 *               Esto rompe el luminanceThreshold (0.85) del Bloom post-processing.
 *               Beam opacity subida de 0.25 → 0.4 para visibilidad del haz.
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D
 * @since WAVE 2042.15, WAVE 2088-2088.2
 * @updated WAVE 2204 — HDR Bloom Resurrection
 */

import React, { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { getTransientFixture, getVibeGeneration } from '../../../../../stores/transientStore'
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
 * 🛡️ WAVE 2088.11: TILT REST ANGLE — THE GEOMETRIC FIX
 * 
 * BUG: The beam cone hangs in -Y (perpendicular to floor). When tilt=0.5
 *   (DMX center), tiltAngle=0 → beam points STRAIGHT DOWN at floor.
 *   Pan rotates the yoke, but the beam spins on its own axis — visually
 *   NOTHING moves. The 2D view doesn't have this problem because it
 *   projects pan directly onto the horizontal plane.
 * 
 * FIX: Real moving heads mounted on truss naturally point ~45° forward
 *   into the audience/stage. The REST angle is the tilt when DMX=center.
 *   We add this offset so that tilt=0.5 → beam points ~45° forward,
 *   making PAN sweeps clearly visible as the beam sweeps the floor.
 * 
 * MATH: tiltAngle = -(tilt - 0.5) * TILT_RANGE + TILT_REST_ANGLE
 *   - tilt=0.5 → tiltAngle = +45° → beam 45° forward from vertical
 *   - tilt=0.0 → tiltAngle = +45° + 50.6° = +95.6° → beam nearly horizontal (back)
 *   - tilt=1.0 → tiltAngle = +45° - 50.6° = -5.6° → beam nearly vertical (down)
 */
const TILT_REST_ANGLE = Math.PI * 0.25  // 45° forward from vertical

/**
 * � WAVE 2088.12: VIBE-AWARE BEAM CONE
 * 
 * The cone radius in 3D represents the zoom of the fixture.
 * Zoom is 0-255 DMX where 0=Beam(tight), 255=Wash(wide).
 * 
 * Visual mapping (cone base radius in scene units):
 *   BEAM_MIN = 0.03  → Sable láser techno (zoom≈30, DMX 0-80)
 *   BEAM_MAX = 0.45  → Baño de luz chill  (zoom≈255, DMX 200-255)
 *
 * The beam length stays fixed at 3.5 units — only the WIDTH changes.
 * This makes techno look like a laser cutting through smoke,
 * and chill look like a warm wash flooding the stage.
 */
const BEAM_RADIUS_MIN = 0.03   // Tight beam (techno sable láser)
const BEAM_RADIUS_MAX = 0.45   // Wide wash (chill baño de luz)
const ZOOM_SMOOTH = 0.15       // Slower than pan/tilt — zoom transitions should feel organic

/**
 * �🛡️ WAVE 2088.1 + 2088.8: VISUAL SMOOTHING
 * 
 * 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
 * ANTES: VISUAL_SMOOTH=0.12. Combinado con snapFactor=0.35 del PhysicsDriver,
 * el 3D mostraba movimiento al ~4% de la señal original (0.35 × 0.12 = 0.042).
 * Los patrones eran blobs informes.
 *
 * AHORA: 0.35 — mucho más responsivo. El PhysicsDriver ya suaviza la señal;
 * el Visual Smooth solo necesita filtrar jitter IPC, no añadir más inercia.
 * A 60fps con 0.35: convergencia visual en ~5 frames (83ms) — fluido y definido.
 */
const VISUAL_SMOOTH = 0.35

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
  const beamMeshRef = useRef<THREE.Mesh>(null)

  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2088.1: Visual smoothing state — persistent across renders.
  // Smooths the NORMALIZED values (0-1) before converting to quaternion.
  // ═══════════════════════════════════════════════════════════════════════
  const smoothPan = useRef<number | null>(null)
  const smoothTilt = useRef<number | null>(null)
  const smoothZoom = useRef<number | null>(null)
  const yokeQuat = useRef(new THREE.Quaternion())
  const headQuat = useRef(new THREE.Quaternion())

  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 2088.9: DIRECT STORE ACCESS — THE REAL FIX
  //
  // BEFORE (BUG): physicalPan came from React props. React re-renders at
  //   10-30fps under load, but useFrame runs at 60fps. The smoothing in
  //   useFrame was interpolating between STALE prop values — creating
  //   jerky, stuttering movement that didn't match the patterns.
  //
  // NOW: We read physicalPan DIRECTLY from the Zustand store inside
  //   useFrame using getState(). This gives us the LATEST value at 60fps,
  //   completely bypassing React's render cycle. The store updates at
  //   60fps from IPC, and now the 3D render reads at 60fps too.
  //
  // This is the canonical R3F pattern for high-frequency data.
  // ═══════════════════════════════════════════════════════════════════════
  const fixtureId = fixture.id

  // Static values from props (don't need 60fps updates)
  const { id, selected, hasOverride } = fixture

  // Reusable THREE.Color for useFrame (no allocations per frame)
  const liveColor = useRef(new THREE.Color())

  // 🪞 WAVE 3260: Track vibe generation to detect vibe changes
  const localVibeGen = useRef(0)

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2236: READ LIVE DATA FROM TRANSIENT STORE — zero React cost
    //
    // BEFORE (WAVE 2088.9): useTruthStore.getState() — Zustand getState()
    //   called 60fps inside useFrame, then .find() on entire fixtures array.
    //   Zustand getState() is cheap but not free (proxy snapshot + ref).
    //
    // NOW: getTransientFixture() reads from a mutable ref (transientStore).
    //   Pure object property access — zero proxies, zero snapshots.
    //   transientStore receives EVERY IPC frame at 30fps.
    // ═══════════════════════════════════════════════════════════════════════
    const fixtureState = getTransientFixture(fixtureId)

    // 🪞 WAVE 3260 Fix F: VIBE SNAP — Detect vibe change → reset smooth refs
    // Without this, a vibe change causes the 3D movers to slowly lerp (163ms)
    // to the new position, creating visible desync with the physical output.
    const currentVibeGen = getVibeGeneration()
    if (currentVibeGen !== localVibeGen.current) {
      localVibeGen.current = currentVibeGen
      smoothPan.current = null  // Forces snap on next smoothing block
    }

    // 🪞 WAVE 3260 Fix E: ANTI-ZOMBIE — No fixture state → kill the light
    // Before: fell back to stale React props from mount → zombie fixtures
    // Now: no data = no light. The 3D mirror must reflect reality.
    if (!fixtureState) {
      if (beamMeshRef.current) beamMeshRef.current.visible = false
      if (lensMaterialRef.current) lensMaterialRef.current.color.setScalar(0)
      return
    }

    const livePan = fixtureState.physicalPan ?? fixtureState.pan ?? 0.5
    const liveTilt = fixtureState.physicalTilt ?? fixtureState.tilt ?? 0.5
    const liveIntensity = fixtureState.dimmer ?? 0

    // 🔦 WAVE 2088.12: Live zoom from store (0-255 DMX) → normalized 0-1
    // Zoom is sent as raw DMX 0-255 from TitanOrchestrator.
    // 0 = beam (tight), 255 = wash (wide)
    const rawZoom = fixtureState?.zoom ?? 127
    const liveZoom = rawZoom / 255  // Normalize to 0-1

    // Color from store (0-255 RGB) or fallback to prop
    if (fixtureState?.color) {
      liveColor.current.setRGB(
        fixtureState.color.r / 255,
        fixtureState.color.g / 255,
        fixtureState.color.b / 255
      )
    } else {
      liveColor.current.copy(fixture.color)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2088.1: EXPONENTIAL SMOOTHING on normalized values
    //
    // physicalPan arrives from the store at ~60fps with micro-steps.
    // Smooth the 0-1 value BEFORE converting to quaternion.
    // First frame: snap to current position (no animation from 0).
    // ═══════════════════════════════════════════════════════════════════════
    if (smoothPan.current === null) {
      smoothPan.current = livePan
      smoothTilt.current = liveTilt
      smoothZoom.current = liveZoom
    } else {
      smoothPan.current += (livePan - smoothPan.current) * VISUAL_SMOOTH
      smoothTilt.current! += (liveTilt - smoothTilt.current!) * VISUAL_SMOOTH
      smoothZoom.current! += (liveZoom - smoothZoom.current!) * ZOOM_SMOOTH
    }

    // Convert smoothed 0-1 to radians
    // 🛡️ WAVE 2088.11: TILT_REST_ANGLE makes beam point ~45° forward at DMX center.
    // Without this, tilt=0.5 → beam perpendicular to floor → pan sweeps are invisible.
    const panAngle = (smoothPan.current! - 0.5) * PAN_RANGE
    const tiltAngle = -(smoothTilt.current! - 0.5) * TILT_RANGE + TILT_REST_ANGLE
    yokeQuat.current.setFromAxisAngle(PAN_AXIS, panAngle)
    headQuat.current.setFromAxisAngle(TILT_AXIS, tiltAngle)

    if (yokeRef.current) yokeRef.current.quaternion.copy(yokeQuat.current)
    if (headRef.current) headRef.current.quaternion.copy(headQuat.current)

    // Update lens color + intensity
    // 🔧 WAVE 2204: HDR BLOOM RESURRECTION
    // MeshBasicMaterial color en rango 0-1 NUNCA rompe el luminanceThreshold del Bloom (0.85).
    // multiplyScalar empuja el color a rango HDR (>1.0) proporcional al dimmer.
    // A dimmer=1.0: color * 3.0 → luminance ~3.0 → BLOOM explota.
    // A dimmer=0.0: color * 1.0 → sin HDR → sin bloom (correcto, está apagado).
    if (lensMaterialRef.current) {
      lensMaterialRef.current.color.copy(liveColor.current)
      if (liveIntensity > 0.01) {
        lensMaterialRef.current.color.multiplyScalar(1.0 + liveIntensity * 2.0)
      }
      lensMaterialRef.current.opacity = 0.7 + liveIntensity * 0.3
    }

    // Update beam color + intensity + ZOOM WIDTH
    // 🔧 WAVE 2204: Beam también necesita HDR para bloom volumétrico.
    //    Opacity subida de 0.25 a 0.4 para que el haz sea visible.
    if (beamMaterialRef.current && showBeam) {
      beamMaterialRef.current.color.copy(liveColor.current)
      if (liveIntensity > 0.01) {
        beamMaterialRef.current.color.multiplyScalar(1.0 + liveIntensity * 1.5)
      }
      beamMaterialRef.current.opacity = liveIntensity * 0.4
    }

    // 🔦 WAVE 2088.12: DYNAMIC BEAM CONE WIDTH — Vibe-Aware
    //
    // Scale the beam cone mesh's X and Z to reflect zoom.
    // The coneGeometry is built at radius=1.0 (base geometry).
    // We scale it to the desired visual radius based on smoothed zoom.
    //
    // smoothZoom 0.0 (beam) → BEAM_RADIUS_MIN (0.03) → sable láser
    // smoothZoom 1.0 (wash) → BEAM_RADIUS_MAX (0.45) → baño de luz
    if (beamMeshRef.current) {
      const targetRadius = BEAM_RADIUS_MIN + (smoothZoom.current ?? 0.5) * (BEAM_RADIUS_MAX - BEAM_RADIUS_MIN)
      beamMeshRef.current.scale.x = targetRadius
      beamMeshRef.current.scale.z = targetRadius
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
              color={fixture.color}
              transparent
              opacity={1.0}
            />
          </mesh>

          {/* Beam — 🔦 WAVE 2088.12: Dynamic cone width via scale.x/z
              Base geometry radius=1.0, height=3.5. useFrame scales X/Z
              to match zoom: tight laser (techno) → wide wash (chill).
              Opacity controlled by useFrame based on dimmer. */}
          {showBeam && (
            <mesh ref={beamMeshRef} position={[0, -3.5 / 2 - 0.08, 0]}>
              <coneGeometry args={[1.0, 3.5, 16, 1, true]} />
              <meshBasicMaterial
                ref={beamMaterialRef}
                color={fixture.color}
                transparent
                opacity={0.0}
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
