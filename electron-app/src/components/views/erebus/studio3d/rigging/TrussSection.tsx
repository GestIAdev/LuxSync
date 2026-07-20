import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// TrussSection — Estructura Base de Rigging
// PROYECTO EREBUS FASE 3
//
// Sección de truss triangular (30cm de sección) usando InstancedMesh
// para maximizar rendimiento (≤200 triángulos por sección).
//
// Material: Aluminio anodizado oscuro
//   color: #1B1F2A (--obs-surface)
//   metalness: 0.85
//   roughness: 0.4
//
// Geometría: 3 cordones principales + diagonales en patrón zigzag
// ═══════════════════════════════════════════════════════════════════════════

interface TrussSectionProps {
  length?: number // meters (default 2m)
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const SECTION_RADIUS = 0.15 // 30cm diameter → 15cm radius
const CORD_RADIUS = 0.025 // 5cm cord thickness
const DIAGONAL_RADIUS = 0.015 // 3cm diagonal thickness
const DIAGONAL_SPACING = 0.4 // 40cm between diagonal pairs

export const TrussSection: React.FC<TrussSectionProps> = ({
  length = 2,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) => {
  // ── Material ──────────────────────────────────────────────────────────────
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#1B1F2A'),
        metalness: 0.85,
        roughness: 0.4,
        envMapIntensity: 0.5,
      }),
    [],
  )

  // ── Geometry: build instanced cords + diagonals ───────────────────────────
  const { cordGeometry, cordCount, diagonalGeometry, diagonalCount, matrices } = useMemo(() => {
    // 3 main cords arranged in triangle (pointing down)
    const cordGeo = new THREE.CylinderGeometry(CORD_RADIUS, CORD_RADIUS, length, 8, 1)
    cordGeo.rotateZ(Math.PI / 2) // align along X axis

    // Diagonal struts
    const diagGeo = new THREE.CylinderGeometry(DIAGONAL_RADIUS, DIAGONAL_RADIUS, 1, 6, 1)

    const numDiagPairs = Math.floor(length / DIAGONAL_SPACING)
    const totalCords = 3
    const totalDiags = numDiagPairs * 2 // 2 diagonals per pair (X pattern)
    const total = totalCords + totalDiags

    const cordMats: THREE.Matrix4[] = []
    const diagMats: THREE.Matrix4[] = []

    // Cord positions: triangle cross-section
    // Top cord at (0, +r, 0), bottom-left at (-r*sin60, -r*cos60, 0),
    // bottom-right at (+r*sin60, -r*cos60, 0)
    const r = SECTION_RADIUS
    const cordOffsets: [number, number, number][] = [
      [0, r, 0], // top
      [-r * Math.sin(Math.PI / 3), -r * Math.cos(Math.PI / 3), 0], // bottom-left
      [r * Math.sin(Math.PI / 3), -r * Math.cos(Math.PI / 3), 0], // bottom-right
    ]

    for (let i = 0; i < totalCords; i++) {
      const mat = new THREE.Matrix4()
      mat.makeTranslation(
        cordOffsets[i][0],
        cordOffsets[i][1],
        cordOffsets[i][2],
      )
      cordMats.push(mat)
    }

    // Diagonals: X pattern between top and bottom cords
    const halfLen = length / 2
    for (let i = 0; i < numDiagPairs; i++) {
      const x = -halfLen + (i + 0.5) * DIAGONAL_SPACING
      // Diagonal from top to bottom-left
      const dx1 = cordOffsets[0][0] - cordOffsets[1][0]
      const dy1 = cordOffsets[0][1] - cordOffsets[1][1]
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
      const angle1 = Math.atan2(dy1, dx1) + Math.PI / 2 // cylinder is vertical by default

      const mat1 = new THREE.Matrix4()
      const pos1 = new THREE.Vector3(
        x,
        (cordOffsets[0][1] + cordOffsets[1][1]) / 2,
        0,
      )
      const quat1 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, angle1),
      )
      const scale1 = new THREE.Vector3(1, len1, 1)
      mat1.compose(pos1, quat1, scale1)
      diagMats.push(mat1)

      // Diagonal from top to bottom-right
      const dx2 = cordOffsets[0][0] - cordOffsets[2][0]
      const dy2 = cordOffsets[0][1] - cordOffsets[2][1]
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
      const angle2 = Math.atan2(dy2, dx2) + Math.PI / 2

      const mat2 = new THREE.Matrix4()
      const pos2 = new THREE.Vector3(
        x,
        (cordOffsets[0][1] + cordOffsets[2][1]) / 2,
        0,
      )
      const quat2 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, angle2),
      )
      const scale2 = new THREE.Vector3(1, len2, 1)
      mat2.compose(pos2, quat2, scale2)
      diagMats.push(mat2)
    }

    return {
      cordGeometry: cordGeo,
      cordCount: totalCords,
      diagonalGeometry: diagGeo,
      diagonalCount: totalDiags,
      matrices: { cords: cordMats, diagonals: diagMats },
    }
  }, [length])

  const cordInstRef = useRef<THREE.InstancedMesh>(null)
  const diagInstRef = useRef<THREE.InstancedMesh>(null)

  // Apply instance matrices
  React.useEffect(() => {
    if (cordInstRef.current) {
      matrices.cords.forEach((mat, i) => {
        cordInstRef.current!.setMatrixAt(i, mat)
      })
      cordInstRef.current.instanceMatrix.needsUpdate = true
    }
    if (diagInstRef.current) {
      matrices.diagonals.forEach((mat, i) => {
        diagInstRef.current!.setMatrixAt(i, mat)
      })
      diagInstRef.current.instanceMatrix.needsUpdate = true
    }
  }, [matrices])

  return (
    <group position={position} rotation={rotation as any}>
      {/* Main cords */}
      <instancedMesh
        ref={cordInstRef}
        args={[cordGeometry, material, cordCount]}
        castShadow
        receiveShadow
      />
      {/* Diagonal struts */}
      <instancedMesh
        ref={diagInstRef}
        args={[diagonalGeometry, material, diagonalCount]}
        castShadow
        receiveShadow
      />
    </group>
  )
}

export default TrussSection
