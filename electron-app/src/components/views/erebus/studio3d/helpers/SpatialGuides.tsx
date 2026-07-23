import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { dragPositionRef } from './dragPositionRef'

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
// Se actualiza en tiempo real durante el arrastre leyendo dragPositionRef
// (zero store re-renders — comunicación via ref compartido).
//
// No estorba el raycasting (raycast={() => null}).
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = '#5EEAD4'
const X_COLOR = '#E57373'
const Z_COLOR = '#64B5F6'
const LINE_OPACITY = 0.5

export const SpatialGuides: React.FC = () => {
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const fixtures = useStageStore(s => s.fixtures)
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const stage = useStageStore(s => s.stage)

  // ── Refs for imperative line updates during drag ─────────────────────────
  const yLineGeoRef = useRef<THREE.BufferGeometry>(null)
  const xLineGeoRef = useRef<THREE.BufferGeometry>(null)
  const zLineGeoRef = useRef<THREE.BufferGeometry>(null)
  const floorMarkerRef = useRef<THREE.Mesh>(null)

  // ── Resolve selected object position from store ──────────────────────────
  const { storePos, hasSelection } = useMemo(() => {
    if (selectedIds.size === 0) {
      return { storePos: null, hasSelection: false }
    }

    const id = [...selectedIds][0]

    const fixture = fixtures.find(f => f.id === id)
    if (fixture) {
      return {
        storePos: new THREE.Vector3(fixture.position.x, fixture.position.y, fixture.position.z),
        hasSelection: true,
      }
    }

    const rig = rigs.find(r => r.id === id)
    if (rig) {
      return {
        storePos: new THREE.Vector3(rig.position.x, rig.position.y, rig.position.z),
        hasSelection: true,
      }
    }

    return { storePos: null, hasSelection: false }
  }, [selectedIds, fixtures, rigs])

  const stageW = stage?.width ?? 12
  const stageD = stage?.depth ?? 8
  const halfW = stageW / 2
  const halfD = stageD / 2

  // ── Frame loop: update line positions from live drag ref ─────────────────
  useFrame(() => {
    const livePos = dragPositionRef.current
    const pos = livePos ?? storePos
    if (!pos) return

    const x = pos.x
    const y = pos.y
    const z = pos.z

    const wallX = x >= 0 ? halfW : -halfW
    const wallZ = z >= 0 ? halfD : -halfD

    // Update Y line: [x,y,z] → [x,0,z]
    if (yLineGeoRef.current) {
      const attr = yLineGeoRef.current.getAttribute('position') as THREE.BufferAttribute
      attr.setXYZ(0, x, y, z)
      attr.setXYZ(1, x, 0, z)
      attr.needsUpdate = true
    }

    // Update X line: [x,y,z] → [wallX,y,z]
    if (xLineGeoRef.current) {
      const attr = xLineGeoRef.current.getAttribute('position') as THREE.BufferAttribute
      attr.setXYZ(0, x, y, z)
      attr.setXYZ(1, wallX, y, z)
      attr.needsUpdate = true
    }

    // Update Z line: [x,y,z] → [x,y,wallZ]
    if (zLineGeoRef.current) {
      const attr = zLineGeoRef.current.getAttribute('position') as THREE.BufferAttribute
      attr.setXYZ(0, x, y, z)
      attr.setXYZ(1, x, y, wallZ)
      attr.needsUpdate = true
    }

    // Update floor marker position
    if (floorMarkerRef.current) {
      floorMarkerRef.current.position.set(x, 0.01, z)
    }
  })

  if (!hasSelection || !storePos) return null

  const [x, y, z] = [storePos.x, storePos.y, storePos.z]
  const wallX = x >= 0 ? halfW : -halfW
  const wallZ = z >= 0 ? halfD : -halfD

  return (
    <group>
      {/* Y axis — vertical drop to floor */}
      {/* @ts-expect-error — raycast override to suppress picking on guide lines */}
      <line raycast={() => null}>
        <bufferGeometry ref={yLineGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([x, y, z, x, 0, z]), 3]}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={ACCENT}
          transparent
          opacity={LINE_OPACITY}
          dashSize={0.15}
          gapSize={0.1}
          depthWrite={false}
        />
      </line>

      {/* X axis — horizontal to nearest side wall */}
      {/* @ts-expect-error — raycast override to suppress picking on guide lines */}
      <line raycast={() => null}>
        <bufferGeometry ref={xLineGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([x, y, z, wallX, y, z]), 3]}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={X_COLOR}
          transparent
          opacity={LINE_OPACITY}
          dashSize={0.15}
          gapSize={0.1}
          depthWrite={false}
        />
      </line>

      {/* Z axis — horizontal to nearest back/front wall */}
      {/* @ts-expect-error — raycast override to suppress picking on guide lines */}
      <line raycast={() => null}>
        <bufferGeometry ref={zLineGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([x, y, z, x, y, wallZ]), 3]}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={Z_COLOR}
          transparent
          opacity={LINE_OPACITY}
          dashSize={0.15}
          gapSize={0.1}
          depthWrite={false}
        />
      </line>

      {/* Floor marker — small ring at the projected point */}
      <mesh
        ref={floorMarkerRef}
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
