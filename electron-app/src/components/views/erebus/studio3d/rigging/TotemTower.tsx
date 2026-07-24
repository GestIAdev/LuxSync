import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'

// ═══════════════════════════════════════════════════════════════════════════
// TotemTower — Tótem / Torre vertical con base lastrada
// PROYECTO EREBUS — Rig System
//
// Torre vertical de aluminio con base cuadrada lastrada.
// Los fixtures se anclan en la parte superior con orientation 'totem'.
//
// Geometría low-poly:
//   - Base: caja cuadrada 0.4m × 0.1m × 0.4m (lastre)
//   - Mastil: cilindro vertical de 0.06m diámetro
//   - Top plate: caja 0.3m × 0.04m × 0.3m (placa de anclaje)
//
// Material: mismo aluminio anodizado que TrussSection
// ═══════════════════════════════════════════════════════════════════════════

interface TotemTowerProps {
  /** Total height of the tower in meters (default 2.5) */
  height?: number
  /** World position [x, y, z] — base sits at y=0 */
  position?: [number, number, number]
}

const MAST_RADIUS = 0.03 // 6cm diameter mast
const BASE_W = 0.4 // 40cm base width
const BASE_H = 0.1 // 10cm base height
const TOP_W = 0.3 // 30cm top plate width
const TOP_H = 0.04 // 4cm top plate height

export const TotemTower: React.FC<TotemTowerProps> = ({
  height = 2.5,
  position = [0, 0, 0],
}) => {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1E2024'),
        metalness: 0.6,
        roughness: 0.4,
        envMapIntensity: 0.5,
      }),
    [],
  )

  const baseGeometry = useMemo(
    () => new THREE.BoxGeometry(BASE_W, BASE_H, BASE_W),
    [],
  )

  const mastGeometry = useMemo(
    () => new THREE.CylinderGeometry(MAST_RADIUS, MAST_RADIUS, height - BASE_H - TOP_H, 12, 1),
    [height],
  )

  const topGeometry = useMemo(
    () => new THREE.BoxGeometry(TOP_W, TOP_H, TOP_W),
    [],
  )

  // Mast center Y: base top is at BASE_H, mast spans from there to (height - TOP_H)
  const mastCenterY = BASE_H + (height - BASE_H - TOP_H) / 2
  const topY = height - TOP_H / 2

  return (
    <group position={position}>
      {/* Base (lastre) */}
      <mesh
        geometry={baseGeometry}
        material={material}
        position={[0, BASE_H / 2, 0]}
        castShadow
        receiveShadow
      >
        <Edges color="#00ffcc" opacity={0.2} transparent />
      </mesh>

      {/* Mast */}
      <mesh
        geometry={mastGeometry}
        material={material}
        position={[0, mastCenterY, 0]}
        castShadow
        receiveShadow
      />

      {/* Top plate */}
      <mesh
        geometry={topGeometry}
        material={material}
        position={[0, topY, 0]}
        castShadow
        receiveShadow
      >
        <Edges color="#00ffcc" opacity={0.2} transparent />
      </mesh>
    </group>
  )
}

export default TotemTower
