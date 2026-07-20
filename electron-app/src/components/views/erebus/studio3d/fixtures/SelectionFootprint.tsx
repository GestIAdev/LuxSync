import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// ═══════════════════════════════════════════════════════════════════════════
// SelectionFootprint — Peana de Selección
// PROYECTO EREBUS FASE 3
//
// Proyección visual plana en el suelo que acompaña al foco seleccionado.
// Diseño: anillo cian (--obs-accent) proyectado al suelo con pulso sutil.
// Se coloca a y=0.002 (justo sobre el suelo para evitar z-fighting).
// ═══════════════════════════════════════════════════════════════════════════

interface SelectionFootprintProps {
  /** World position of the fixture (footprint uses X/Z, Y is ignored) */
  position: [number, number, number]
  /** Whether the footprint is visible */
  visible?: boolean
}

const FOOTPRINT_RADIUS = 0.25 // 50cm diameter
const FOOTPRINT_RING_WIDTH = 0.03 // 3cm ring thickness
const FOOTPRINT_Y = 0.002 // just above floor

export const SelectionFootprint: React.FC<SelectionFootprintProps> = ({
  position,
  visible = true,
}) => {
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  // Ring geometry (flat ring on the floor)
  const geometry = useMemo(() => {
    const geo = new THREE.RingGeometry(
      FOOTPRINT_RADIUS - FOOTPRINT_RING_WIDTH,
      FOOTPRINT_RADIUS,
      32,
    )
    geo.rotateX(-Math.PI / 2) // lay flat on floor
    return geo
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#5EEAD4'),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  // Subtle pulse
  useFrame(({ clock }) => {
    if (!matRef.current || !visible) return
    const t = clock.getElapsedTime()
    matRef.current.opacity = 0.3 + Math.sin(t * 2) * 0.1
  })

  if (!visible) return null

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position[0], FOOTPRINT_Y, position[2]]}
    />
  )
}

export default SelectionFootprint
