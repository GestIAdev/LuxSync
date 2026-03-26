/**
 * ☀️ HYPERION — HyperionPar3D v2.3
 * 
 * Simple PAR fixture — body + lente brillante + halo glow.
 * SIN cono volumétrico sólido (se veía horrible).
 * 
 * 🔧 WAVE 2205: CONE EXORCISM
 * Eliminado completamente el mesh del beam cone.
 * 
 * 🔥 WAVE 2212: HALO RESURRECTION
 * Los PARs encendidos ahora muestran un halo de luz visible:
 *   - PointLight reactivo a intensidad y color del fixture
 *   - Esfera glow con AdditiveBlending (semitransparente, se acumula)
 *   - Lente HDR boosteada para bloom del EffectComposer
 * 
 * @module components/hyperion/views/visualizer/fixtures/HyperionPar3D
 * @since WAVE 2042.15 (Clean Rewrite)
 * @updated WAVE 2212 — Halo Resurrection
 */

import React, { useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { getTransientFixture } from '../../../../../stores/transientStore'
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
  const haloMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloOuterRef = useRef<THREE.MeshBasicMaterial>(null)
  const pointLightRef = useRef<THREE.PointLight>(null)

  const { id, selected, hasOverride } = fixture

  // Reusable THREE.Color for useFrame (no allocations per frame)
  const liveColor = useRef(new THREE.Color())

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame(() => {
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2236: READ LIVE DATA FROM TRANSIENT STORE — zero React cost
    //
    // Same pattern as HyperionMovingHead3D (WAVE 2088.9).
    // Props are stale (last React render). For live animation data,
    // read directly from the mutable ref store inside useFrame().
    // ═══════════════════════════════════════════════════════════════════════
    const fixtureState = getTransientFixture(id)
    
    const liveIntensity = fixtureState?.dimmer ?? fixture.intensity
    const isOn = liveIntensity > 0.01
    
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

    // Lente: HDR boost para bloom del EffectComposer
    if (lensMaterialRef.current) {
      lensMaterialRef.current.color.copy(liveColor.current)
      if (isOn) {
        lensMaterialRef.current.color.multiplyScalar(1.0 + liveIntensity * 3.0)
      }
      lensMaterialRef.current.opacity = isOn ? 0.8 + liveIntensity * 0.2 : 0.15
    }

    // Halo interior — glow denso cerca de la lente
    if (haloMaterialRef.current) {
      haloMaterialRef.current.color.copy(liveColor.current)
      if (isOn) {
        haloMaterialRef.current.color.multiplyScalar(1.0 + liveIntensity * 1.5)
      }
      haloMaterialRef.current.opacity = isOn ? liveIntensity * 0.65 : 0
    }

    // Halo exterior — aura suave de mayor radio
    if (haloOuterRef.current) {
      haloOuterRef.current.color.copy(liveColor.current)
      haloOuterRef.current.opacity = isOn ? liveIntensity * 0.25 : 0
    }

    // PointLight — ilumina el entorno cercano (paredes, suelo)
    if (pointLightRef.current) {
      pointLightRef.current.intensity = isOn ? liveIntensity * 2.5 : 0
      pointLightRef.current.color.copy(liveColor.current)
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

      {/* Lente — círculo HDR (MeshBasicMaterial = sin cálculo de luces) */}
      <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.11, 32]} />
        <meshBasicMaterial
          ref={lensMaterialRef}
          color={fixture.color}
          transparent
          opacity={1.0}
        />
      </mesh>

      {/* � WAVE 2212: HALO INTERIOR — esfera glow densa cerca de la lente */}
      <mesh position={[0, -0.07, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial
          ref={haloMaterialRef}
          color={fixture.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 🔥 WAVE 2212: HALO EXTERIOR — aura suave de mayor radio */}
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.42, 16, 16]} />
        <meshBasicMaterial
          ref={haloOuterRef}
          color={fixture.color}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 🔥 WAVE 2212: POINT LIGHT — ilumina el entorno (suelo, paredes cercanas) */}
      <pointLight
        ref={pointLightRef}
        position={[0, -0.1, 0]}
        intensity={0}
        distance={3.5}
        decay={2}
        color={fixture.color}
      />

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
