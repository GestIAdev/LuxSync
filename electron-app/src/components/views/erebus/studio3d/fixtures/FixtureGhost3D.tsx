import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// ═══════════════════════════════════════════════════════════════════════════
// FixtureGhost3D — Holograma Unplaced
// PROYECTO EREBUS FASE 3
//
// Representación visual para fixtures con placementMode: 'unplaced'.
// Material holográfico de vidrio:
//   transmission: 0.9, sin sombras, color base de la paleta.
// Flotación suave (animación sine leve en Y).
//
// Sin lógica de interacción — pura representación visual pasiva.
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureGhost3DProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  fixtureType?: string
}

const GHOST_COLOR = '#5EEAD4' // --obs-accent (tinted glass)
const FLOAT_AMPLITUDE = 0.03 // 3cm float
const FLOAT_SPEED = 0.8

export const FixtureGhost3D: React.FC<FixtureGhost3DProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  fixtureType = 'moving-head',
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const baseY = position[1]

  // Holographic glass material
  const ghostMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(GHOST_COLOR),
        metalness: 0.0,
        roughness: 0.1,
        transmission: 0.9,
        transparent: true,
        opacity: 0.35,
        ior: 1.4,
        thickness: 0.5,
        envMapIntensity: 0.3,
        depthWrite: false,
      }),
    [],
  )

  // Wireframe overlay material for hologram effect
  const wireframeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(GHOST_COLOR),
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    [],
  )

  // Gentle float animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = baseY + Math.sin(t * FLOAT_SPEED) * FLOAT_AMPLITUDE
  })

  const isWash = fixtureType === 'par' || fixtureType === 'wash'

  return (
    <group ref={groupRef} position={position} rotation={rotation as any}>
      {/* Ghost body — glass shell */}
      <group>
        {/* Base */}
        <mesh material={ghostMaterial}>
          <cylinderGeometry args={[0.08, 0.1, 0.12, 12]} />
        </mesh>

        {/* Head */}
        <mesh material={ghostMaterial} position={[0, 0.2, 0]}>
          {isWash
            ? <cylinderGeometry args={[0.1, 0.12, 0.1, 16]} />
            : <boxGeometry args={[0.14, 0.12, 0.14]} />}
        </mesh>

        {/* Wireframe overlay for hologram feel */}
        <mesh material={wireframeMaterial} position={[0, 0.2, 0]}>
          {isWash
            ? <cylinderGeometry args={[0.1, 0.12, 0.1, 8, 1, true]} />
            : <boxGeometry args={[0.14, 0.12, 0.14]} />}
        </mesh>
      </group>
    </group>
  )
}

export default FixtureGhost3D
