/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏟️ STAGE FLOOR - WAVE 30.1: Stage Command & Dashboard
 * Suelo del escenario con grid cyberpunk
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { Grid } from '@react-three/drei'
import { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

export interface StageFloorProps {
  size?: number
  gridDivisions?: number
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}

export const StageFloor: React.FC<StageFloorProps> = ({
  size = 20,
  gridDivisions = 20,
  onClick,
}) => {
  return (
    <group>
      {/* PLANO BASE - Clickeable para deseleccionar */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={onClick}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#0a0a0f"
          metalness={0.3}
          roughness={0.8}
        />
      </mesh>
      
      {/* GRID CYBERPUNK */}
      <Grid
        position={[0, 0.01, 0]}
        args={[size, size]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1a1a2e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#ff00ff"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />
      
      {/* LÍNEA DE ESCENARIO (frente) */}
      <mesh position={[0, 0.02, size / 2 - 1]}>
        <boxGeometry args={[size * 0.8, 0.02, 0.1]} />
        <meshBasicMaterial color="#ff00ff" />
      </mesh>
    </group>
  )
}

export default StageFloor
