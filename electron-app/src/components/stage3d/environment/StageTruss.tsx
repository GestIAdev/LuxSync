/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ STAGE TRUSS - WAVE 30: Stage Command & Dashboard
 * Estructura de truss para montar fixtures
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import * as THREE from 'three'

export interface StageTrussProps {
  width?: number
  height?: number
  depth?: number
}

const TRUSS_COLOR = '#2d2d44'
const TRUSS_THICKNESS = 0.1

export const StageTruss: React.FC<StageTrussProps> = ({
  width = 10,
  height = 5,
  depth = 6,
}) => {
  const halfWidth = width / 2
  const halfDepth = depth / 2
  
  return (
    <group>
      {/* ═══════════════════════════════════════════════════════════════════
       * TRUSS PRINCIPAL (HORIZONTAL AL FONDO)
       * ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, height, -halfDepth + 1]}>
        <boxGeometry args={[width, TRUSS_THICKNESS * 2, TRUSS_THICKNESS * 2]} />
        <meshStandardMaterial
          color={TRUSS_COLOR}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * TRUSS FRONTAL (HORIZONTAL AL FRENTE)
       * ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, height * 0.3, halfDepth - 2]}>
        <boxGeometry args={[width * 0.9, TRUSS_THICKNESS * 1.5, TRUSS_THICKNESS * 1.5]} />
        <meshStandardMaterial
          color={TRUSS_COLOR}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * COLUMNAS VERTICALES LATERALES
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Columna izquierda frontal */}
      <mesh position={[-halfWidth + 0.5, height / 2, halfDepth - 2]}>
        <boxGeometry args={[TRUSS_THICKNESS * 2, height, TRUSS_THICKNESS * 2]} />
        <meshStandardMaterial color={TRUSS_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Columna derecha frontal */}
      <mesh position={[halfWidth - 0.5, height / 2, halfDepth - 2]}>
        <boxGeometry args={[TRUSS_THICKNESS * 2, height, TRUSS_THICKNESS * 2]} />
        <meshStandardMaterial color={TRUSS_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Columna izquierda trasera */}
      <mesh position={[-halfWidth + 0.5, height / 2, -halfDepth + 1]}>
        <boxGeometry args={[TRUSS_THICKNESS * 2, height, TRUSS_THICKNESS * 2]} />
        <meshStandardMaterial color={TRUSS_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Columna derecha trasera */}
      <mesh position={[halfWidth - 0.5, height / 2, -halfDepth + 1]}>
        <boxGeometry args={[TRUSS_THICKNESS * 2, height, TRUSS_THICKNESS * 2]} />
        <meshStandardMaterial color={TRUSS_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * BARRAS LATERALES (CONECTAN COLUMNAS)
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Barra lateral izquierda (arriba) */}
      <mesh position={[-halfWidth + 0.5, height, 0]}>
        <boxGeometry args={[TRUSS_THICKNESS * 2, TRUSS_THICKNESS * 2, depth - 2]} />
        <meshStandardMaterial color={TRUSS_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Barra lateral derecha (arriba) */}
      <mesh position={[halfWidth - 0.5, height, 0]}>
        <boxGeometry args={[TRUSS_THICKNESS * 2, TRUSS_THICKNESS * 2, depth - 2]} />
        <meshStandardMaterial color={TRUSS_COLOR} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * DETALLES DECORATIVOS - Diagonales de refuerzo
       * ═══════════════════════════════════════════════════════════════════ */}
      
      {/* Mini luces piloto en el truss */}
      {[-3, -1, 1, 3].map((x) => (
        <mesh key={`pilot-${x}`} position={[x, height + 0.15, -halfDepth + 1]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
      ))}
    </group>
  )
}

export default StageTruss
