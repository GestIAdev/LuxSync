import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'

// ═══════════════════════════════════════════════════════════════════════════
// CrystalEdges — Aristas de Contención
// PROYECTO EREBUS FASE 6
//
// 12 segmentos de arista del Crystal Box (caja de límites del escenario).
// Gradiente --obs-accent que se ilumina solo cuando un fixture arrastrado
// se acerca a <0.5m del límite físico.
//
// Las paredes desaparecen — solo las aristas existen, y solo reaccionan.
// ═══════════════════════════════════════════════════════════════════════════

interface CrystalEdgesProps {
  /** Stage width in meters */
  width?: number
  /** Stage depth in meters */
  depth?: number
  /** Stage height in meters */
  height?: number
  /** Position of the dragged fixture (null when not dragging) */
  draggedPosition?: [number, number, number] | null
}

const PROXIMITY_THRESHOLD = 0.5 // 50cm — distancia de activación del glow
const BASE_OPACITY = 0.25 // opacidad en reposo
const ACTIVE_OPACITY = 0.85 // opacidad cuando se acerca el fixture

export const CrystalEdges: React.FC<CrystalEdgesProps> = ({
  width = 12,
  depth = 8,
  height = 6,
  draggedPosition = null,
}) => {
  const groupRef = useRef<THREE.Group>(null)
  const opacitiesRef = useRef<number[]>(new Array(12).fill(BASE_OPACITY))

  // ── Compute 12 edge segments ─────────────────────────────────────────────
  const edges = useMemo(() => {
    const hw = width / 2
    const hd = depth / 2
    const h = height

    // 12 edges of a box: 4 bottom, 4 top, 4 vertical
    return [
      // Bottom (y=0)
      { points: [[-hw, 0, -hd], [hw, 0, -hd]] as [number, number, number][] },
      { points: [[hw, 0, -hd], [hw, 0, hd]] as [number, number, number][] },
      { points: [[hw, 0, hd], [-hw, 0, hd]] as [number, number, number][] },
      { points: [[-hw, 0, hd], [-hw, 0, -hd]] as [number, number, number][] },
      // Top (y=h)
      { points: [[-hw, h, -hd], [hw, h, -hd]] as [number, number, number][] },
      { points: [[hw, h, -hd], [hw, h, hd]] as [number, number, number][] },
      { points: [[hw, h, hd], [-hw, h, hd]] as [number, number, number][] },
      { points: [[-hw, h, hd], [-hw, h, -hd]] as [number, number, number][] },
      // Vertical
      { points: [[-hw, 0, -hd], [-hw, h, -hd]] as [number, number, number][] },
      { points: [[hw, 0, -hd], [hw, h, -hd]] as [number, number, number][] },
      { points: [[hw, 0, hd], [hw, h, hd]] as [number, number, number][] },
      { points: [[-hw, 0, hd], [-hw, h, hd]] as [number, number, number][] },
    ]
  }, [width, depth, height])

  // ── Compute edge midpoints for proximity check ───────────────────────────
  const edgeMidpoints = useMemo(() => {
    return edges.map(e => {
      const p1 = e.points[0]
      const p2 = e.points[1]
      return new THREE.Vector3(
        (p1[0] + p2[0]) / 2,
        (p1[1] + p2[1]) / 2,
        (p1[2] + p2[2]) / 2,
      )
    })
  }, [edges])

  // ── Animate opacities based on proximity ─────────────────────────────────
  useFrame(() => {
    if (!groupRef.current) return

    const dragPos = draggedPosition
      ? new THREE.Vector3(draggedPosition[0], draggedPosition[1], draggedPosition[2])
      : null

    for (let i = 0; i < 12; i++) {
      let targetOpacity = BASE_OPACITY

      if (dragPos) {
        // Distance from dragged fixture to edge midpoint
        const dist = dragPos.distanceTo(edgeMidpoints[i])
        if (dist < PROXIMITY_THRESHOLD) {
          // Closer = brighter (inverse lerp)
          const proximity = 1 - dist / PROXIMITY_THRESHOLD
          targetOpacity = BASE_OPACITY + (ACTIVE_OPACITY - BASE_OPACITY) * proximity
        }
      }

      // Smooth lerp toward target
      opacitiesRef.current[i] += (targetOpacity - opacitiesRef.current[i]) * 0.15
    }
  })

  // ── Render 12 Line segments ──────────────────────────────────────────────
  const accentColor = useMemo(() => new THREE.Color('#5EEAD4'), [])

  return (
    <group ref={groupRef}>
      {edges.map((edge, i) => (
        <EdgeLine
          key={i}
          points={edge.points}
          color={accentColor}
          opacityRef={opacitiesRef}
          index={i}
        />
      ))}
    </group>
  )
}

// ── Individual edge line with animated opacity ─────────────────────────────

interface EdgeLineProps {
  points: [number, number, number][]
  color: THREE.Color
  opacityRef: React.MutableRefObject<number[]>
  index: number
}

const EdgeLine: React.FC<EdgeLineProps> = ({ points, color, opacityRef, index }) => {
  const matRef = useRef<THREE.LineBasicMaterial>(null)

  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity = opacityRef.current[index]
    }
  })

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      transparent
      opacity={BASE_OPACITY}
      depthWrite={false}
    >
      <lineBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={BASE_OPACITY}
        depthWrite={false}
      />
    </Line>
  )
}

export default CrystalEdges
