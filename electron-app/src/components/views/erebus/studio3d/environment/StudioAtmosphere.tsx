import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// StudioAtmosphere — El Vacío y la Niebla
// PROYECTO EREBUS FASE 2
//
// Color de fondo absoluto: --obs-void (#0B0D12).
// Niebla volumétrica: fog [#0B0D12, 12, 45] — densidad bajísima.
// Partículas de polvo suspendido (~300 sprites, drift lento) solo en HQ.
// ═══════════════════════════════════════════════════════════════════════════

interface StudioAtmosphereProps {
  quality?: 'HQ' | 'LQ'
}

const FOG_COLOR = '#0B0D12'
const FOG_NEAR = 12
const FOG_FAR = 45
const DUST_COUNT = 300
const DUST_SPREAD = 20 // meters
const DUST_AREA_HEIGHT = 8 // meters

export const StudioAtmosphere: React.FC<StudioAtmosphereProps> = ({ quality = 'HQ' }) => {
  const isHQ = quality === 'HQ'

  return (
    <>
      {/* Fog — attach to scene */}
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/* Background color */}
      <color attach="background" args={[FOG_COLOR]} />

      {/* Dust particles — HQ only */}
      {isHQ && <DustParticles />}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DustParticles — suspended dust motes with slow drift
// ═══════════════════════════════════════════════════════════════════════════

const DustParticles: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null)

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3)
    const velocities = new Float32Array(DUST_COUNT * 3)

    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * DUST_SPREAD
      positions[i3 + 1] = Math.random() * DUST_AREA_HEIGHT
      positions[i3 + 2] = (Math.random() - 0.5) * DUST_SPREAD

      // Slow drift velocities
      velocities[i3] = (Math.random() - 0.5) * 0.02
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.01
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))

    const mat = new THREE.PointsMaterial({
      color: new THREE.Color('#8B94A8'),
      size: 0.03,
      transparent: true,
      opacity: 0.25,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [])

  // Drift animation
  useFrame(() => {
    if (!pointsRef.current) return
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const vel = pointsRef.current.geometry.attributes.velocity as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const vArr = vel.array as Float32Array

    for (let i = 0; i < DUST_COUNT; i++) {
      const i3 = i * 3
      arr[i3] += vArr[i3]
      arr[i3 + 1] += vArr[i3 + 1]
      arr[i3 + 2] += vArr[i3 + 2]

      // Wrap around bounds
      if (arr[i3] > DUST_SPREAD / 2) arr[i3] = -DUST_SPREAD / 2
      else if (arr[i3] < -DUST_SPREAD / 2) arr[i3] = DUST_SPREAD / 2

      if (arr[i3 + 1] > DUST_AREA_HEIGHT) arr[i3 + 1] = 0
      else if (arr[i3 + 1] < 0) arr[i3 + 1] = DUST_AREA_HEIGHT

      if (arr[i3 + 2] > DUST_SPREAD / 2) arr[i3 + 2] = -DUST_SPREAD / 2
      else if (arr[i3 + 2] < -DUST_SPREAD / 2) arr[i3 + 2] = DUST_SPREAD / 2
    }
    pos.needsUpdate = true
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

export default StudioAtmosphere
