import React, { useMemo } from 'react'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// SpatialGuides — Líneas Láser de Proyección Espacial (Estilo AutoCAD)
// PROYECTO EREBUS
//
// Renderiza 3 líneas guía punteadas desde el pivote del objeto seleccionado
// (fixture o rig) hasta los límites del Crystal Box:
//   - Eje Y: proyección vertical hasta el suelo (cyan punteada)
//   - Eje X: proyección horizontal hasta la pared lateral (rojo tenue)
//   - Eje Z: proyección horizontal hasta la pared de fondo (azul tenue)
//
// No estorba el raycasting (raycast={() => null}).
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = '#5EEAD4'
const X_COLOR = '#E57373'
const Z_COLOR = '#64B5F6'
const LINE_OPACITY = 0.5

interface GuideLineProps {
  from: [number, number, number]
  to: [number, number, number]
  color: string
}

const GuideLine: React.FC<GuideLineProps> = ({ from, to, color }) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([...from, ...to], 3),
    )
    return g
  }, [from, to])

  return (
    // @ts-expect-error — raycast override to suppress picking on guide lines
    <line raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <lineDashedMaterial
        color={color}
        transparent
        opacity={LINE_OPACITY}
        dashSize={0.15}
        gapSize={0.1}
        depthWrite={false}
      />
    </line>
  )
}

export const SpatialGuides: React.FC = () => {
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const fixtures = useStageStore(s => s.fixtures)
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const stage = useStageStore(s => s.stage)

  const { position, hasSelection } = useMemo(() => {
    if (selectedIds.size === 0) {
      return { position: null, hasSelection: false }
    }

    const id = [...selectedIds][0]

    const fixture = fixtures.find(f => f.id === id)
    if (fixture) {
      return {
        position: [fixture.position.x, fixture.position.y, fixture.position.z] as [number, number, number],
        hasSelection: true,
      }
    }

    const rig = rigs.find(r => r.id === id)
    if (rig) {
      return {
        position: [rig.position.x, rig.position.y, rig.position.z] as [number, number, number],
        hasSelection: true,
      }
    }

    return { position: null, hasSelection: false }
  }, [selectedIds, fixtures, rigs])

  if (!hasSelection || !position) return null

  const stageW = stage?.width ?? 12
  const stageD = stage?.depth ?? 8
  const stageH = stage?.height ?? 6

  const [x, y, z] = position
  const halfW = stageW / 2
  const halfD = stageD / 2

  const wallX = x >= 0 ? halfW : -halfW
  const wallZ = z >= 0 ? halfD : -halfD

  return (
    <group>
      {/* Y axis — vertical drop to floor */}
      <GuideLine from={[x, y, z]} to={[x, 0, z]} color={ACCENT} />

      {/* X axis — horizontal to nearest side wall */}
      <GuideLine from={[x, y, z]} to={[wallX, y, z]} color={X_COLOR} />

      {/* Z axis — horizontal to nearest back/front wall */}
      <GuideLine from={[x, y, z]} to={[x, y, wallZ]} color={Z_COLOR} />

      {/* Floor marker — small ring at the projected point */}
      <mesh
        position={[x, 0.01, z]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[0.08, 0.12, 24]} />
        <meshBasicMaterial
          color={ACCENT}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default SpatialGuides
