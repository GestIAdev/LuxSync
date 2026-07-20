import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// ═══════════════════════════════════════════════════════════════════════════
// AnchorPoints — Snap Visual para Rigging
// PROYECTO EREBUS FASE 3
//
// Discos magnéticos de 6cm de diámetro (3cm radio) con color --obs-accent.
// Se revelan durante la futura interacción de drag (visibilidad controlada
// por prop `visible`).
//
// Comportamiento visual: pulso sutil cuando visibles para atraer el ojo.
// ═══════════════════════════════════════════════════════════════════════════

interface AnchorPointsProps {
  /** Array of anchor positions along the truss (world-space Y of truss cord) */
  positions: [number, number, number][]
  /** Whether anchors are visible (during drag proximity) */
  visible?: boolean
}

const ANCHOR_RADIUS = 0.03 // 6cm diameter → 3cm radius
const ANCHOR_HEIGHT = 0.005 // 5mm thick disc

export const AnchorPoints: React.FC<AnchorPointsProps> = ({
  positions,
  visible = false,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(ANCHOR_RADIUS, ANCHOR_RADIUS, ANCHOR_HEIGHT, 16),
    [],
  )

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#5EEAD4'),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    [],
  )

  // Subtle pulse when visible
  useFrame(({ clock }) => {
    if (!groupRef.current || !visible) return
    const t = clock.getElapsedTime()
    const pulse = 0.7 + Math.sin(t * 3) * 0.15
    material.opacity = pulse
  })

  if (!visible) return null

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={pos}
          rotation={[Math.PI / 2, 0, 0]} // lay flat (disc facing up)
        />
      ))}
    </group>
  )
}

export default AnchorPoints
