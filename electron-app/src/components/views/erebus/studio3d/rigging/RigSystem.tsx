import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { TrussSection } from './TrussSection'
import { TotemTower } from './TotemTower'
import { AnchorPoints } from './AnchorPoints'
import type { RigV2, FixtureV2 } from '../../../../../core/stage/ShowFileV2'
import type { ToolMode } from '../../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// RigSystem — Orquestador de Rigging
// PROYECTO EREBUS — Rig System
//
// Renderiza todos los rigs del showFile en 3D:
//   - Truss: sección horizontal con cordones + diagonales
//   - Totem: torre vertical con base lastrada
//
// En toolMode='rig':
//   - Click en rig → selecciona el rig
//   - Click en vacío → crea un truss nuevo en esa posición
//   - Drag en rig → mueve el rig (y arrastra sus fixtures anclados)
//
// Anchor points visibles cuando hay fixtures arrastrándose cerca.
// ═══════════════════════════════════════════════════════════════════════════

const TRUSS_DEFAULT_LENGTH = 3
const TRUSS_DEFAULT_HEIGHT = 3.5
const ANCHOR_SPACING = 0.5

export function generateRigAnchors(rig: RigV2): [number, number, number][] {
  const points: [number, number, number][] = []
  const { position, height, orientation } = rig

  if (orientation === 'totem') {
    points.push([position.x, height - 0.15, position.z])
  } else {
    for (let dx = -TRUSS_DEFAULT_LENGTH / 2; dx <= TRUSS_DEFAULT_LENGTH / 2; dx += ANCHOR_SPACING) {
      points.push([position.x + dx, height - 0.15, position.z])
    }
  }

  return points
}

interface RigSystemProps {
  toolMode?: ToolMode
  showAnchors?: boolean
  activeAnchors?: [number, number, number][]
}

export const RigSystem: React.FC<RigSystemProps> = ({
  toolMode = 'select',
  showAnchors = false,
  activeAnchors = [],
}) => {
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const addRig = useStageStore(s => s.addRig)
  const updateRig = useStageStore(s => s.updateRig)
  const fixtures = useStageStore(s => s.fixtures)
  const updateFixturePosition = useStageStore(s => s.updateFixturePosition)

  const { raycaster, camera, gl } = useThree()
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const select = useSelectionStore(s => s.select)
  const setHovered = useSelectionStore(s => s.setHovered)

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const isTotem = (rig: RigV2) => rig.orientation === 'totem'

  const handleGroundClick = useCallback(
    (e: any) => {
      if (toolMode !== 'rig') return
      if (e.button !== 0) return
      e.stopPropagation()

      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera)

      const hit = new THREE.Vector3()
      raycaster.ray.intersectPlane(groundPlane, hit)
      if (!hit) return

      const x = Math.round(hit.x / 0.25) * 0.25
      const z = Math.round(hit.z / 0.25) * 0.25

      const rigId = `rig-${Date.now()}`
      const newRig: RigV2 = {
        id: rigId,
        position: { x, y: 0, z },
        height: TRUSS_DEFAULT_HEIGHT,
        orientation: 'truss-front' as any,
      }
      addRig(newRig)
      select(rigId, 'replace')
    },
    [toolMode, gl, raycaster, camera, groundPlane, addRig, select],
  )

  return (
    <group>
      {rigs.map(rig => {
        const isSelected = selectedIds.has(rig.id)
        return (
          <RigRenderer
            key={rig.id}
            rig={rig}
            isSelected={isSelected}
            isTotem={isTotem(rig)}
            toolMode={toolMode}
            updateRig={updateRig}
            updateFixturePosition={updateFixturePosition}
            fixtures={fixtures}
            onSelect={select}
            onHover={setHovered}
          />
        )
      })}

      <AnchorPoints positions={activeAnchors} visible={showAnchors} />

      {toolMode === 'rig' && (
        <mesh
          position={[0, -0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={handleGroundClick}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

// ── Individual Rig Renderer ─────────────────────────────────────────────────

interface RigRendererProps {
  rig: RigV2
  isSelected: boolean
  isTotem: boolean
  toolMode: ToolMode
  updateRig: (id: string, updates: Partial<RigV2>) => void
  updateFixturePosition: (id: string, pos: { x: number; y: number; z: number }) => void
  fixtures: FixtureV2[]
  onSelect: (id: string, mode: 'replace' | 'add' | 'toggle') => void
  onHover: (id: string | null) => void
}

const RigRenderer: React.FC<RigRendererProps> = ({
  rig,
  isSelected,
  isTotem,
  toolMode,
  updateRig,
  updateFixturePosition,
  fixtures,
  onSelect,
  onHover,
}) => {
  const { gl, camera, raycaster, controls } = useThree()
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -rig.height),
    [rig.height],
  )
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; z: number } | null>(null)
  const intersectionRef = useRef(new THREE.Vector3())

  // Disable OrbitControls while dragging a rig
  useEffect(() => {
    if (controls) {
      (controls as any).enabled = !isDragging
    }
  }, [isDragging, controls])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera)

      const hit = raycaster.ray.intersectPlane(dragPlane, intersectionRef.current)
      if (!hit) return

      const x = Math.round(hit.x / 0.25) * 0.25
      const z = Math.round(hit.z / 0.25) * 0.25

      const start = dragStartRef.current
      if (!start) return
      const dx = x - start.x
      const dz = z - start.z

      updateRig(rig.id, { position: { x, y: rig.position.y, z } })

      // Move anchored fixtures with the rig
      for (const f of fixtures) {
        if (f.rigId === rig.id) {
          updateFixturePosition(f.id, {
            x: f.position.x + dx,
            y: f.position.y,
            z: f.position.z + dz,
          })
        }
      }

      dragStartRef.current = { x, z }
    }

    const handleUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isDragging, gl, camera, raycaster, dragPlane, rig.id, rig.position.y, updateRig, updateFixturePosition, fixtures])

  const handlePointerDown = (e: any) => {
    if (e.button !== 0) return
    e.stopPropagation()

    if (e.ctrlKey || e.metaKey) {
      onSelect(rig.id, 'toggle')
    } else if (e.shiftKey) {
      onSelect(rig.id, 'add')
    } else {
      onSelect(rig.id, 'replace')
    }

    if (toolMode !== 'rig') return
    dragStartRef.current = { x: rig.position.x, z: rig.position.z }
    setIsDragging(true)
  }

  return (
    <group
      userData={{ rigId: rig.id }}
      onPointerDown={handlePointerDown}
      onPointerOver={() => onHover(rig.id)}
      onPointerOut={() => onHover(null)}
    >
      {isTotem ? (
        <TotemTower
          height={rig.height}
          position={[rig.position.x, 0, rig.position.z]}
        />
      ) : (
        <TrussSection
          length={TRUSS_DEFAULT_LENGTH}
          position={[rig.position.x, rig.height, rig.position.z]}
        />
      )}

      {isSelected && (
        <mesh
          position={[rig.position.x, 0.01, rig.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.3, 0.35, 32]} />
          <meshBasicMaterial
            color="#5EEAD4"
            transparent
            opacity={0.6}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}

export default RigSystem
