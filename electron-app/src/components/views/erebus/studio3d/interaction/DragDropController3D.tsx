import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { AnchorPoints } from '../rigging/AnchorPoints'
import { generateRigAnchors } from '../rigging/RigSystem'
import { FixtureLayer3D } from '../fixtures/FixtureLayer3D'
import { dragPositionRef } from '../helpers/dragPositionRef'
import type { RigV2, FixtureV2, InstallationOrientation, Position3D } from '../../../../../core/stage/ShowFileV2'
import { snapToVoxel, VOXEL_SIZE, clampToCrystalBox } from '../../../../../core/stage/ShowFileV2'
import { useSnapStore } from '../../../../../stores/snapStore'
import type { ToolMode } from '../../ErebusShell'

// ═══════════════════════════════════════════════════════════════════════════
// DragDropController3D — El Controlador del Cursor
// PROYECTO EREBUS FASE 6 + FASE 8
//
// Implementa la lógica de arrastre en R3F:
//   - Intercepta eventos de puntero sobre fixtures
//   - Usa un plano invisible de intersección para mapear el cursor al espacio 3D
//   - Oculta los paneles flotantes durante el arrastre
//
// Lógica de Snap Magnético:
//   - Al arrastrar cerca de un truss (<0.4m), revela los AnchorPoints
//   - El foco se imanta al punto más cercano con un spring de 120ms
//   - En el drop: hereda Y, orientation y rigId del truss
//   - Si se suelta en el suelo (Y < 0.3m): orientation 'floor', rigId undefined
//
// FASE 8: selectionStore integration — select on click, hover, context menu.
// Límites: respeta clampToCrystalBox del store.
// ═══════════════════════════════════════════════════════════════════════════

// ── Constants ──────────────────────────────────────────────────────────────

const SNAP_RADIUS = 0.4 // 40cm — distancia de activación del snap magnético
const SPRING_MS = 120 // duración del spring de asentamiento
const FLOOR_THRESHOLD = 0.3 // Y < 0.3m = snap al suelo

// ── Types ──────────────────────────────────────────────────────────────────

interface SnapTarget {
  rigId: string
  position: Position3D
  orientation: InstallationOrientation
  rigHeight: number
}

interface DragState {
  fixtureId: string
  /** Current visual position (lerped toward snap target) */
  visualPos: THREE.Vector3
  /** Target position (raw cursor or snapped) */
  targetPos: THREE.Vector3
  /** Active snap target if within range */
  snapTarget: SnapTarget | null
  /** Whether we're currently snapping */
  isSnapping: boolean
  /** Spring start time */
  springStart: number
}

// ── Helper: find nearest snap target ───────────────────────────────────────

function findNearestSnap(
  cursorPos: THREE.Vector3,
  rigs: RigV2[],
): SnapTarget | null {
  let nearest: SnapTarget | null = null
  let minDist = SNAP_RADIUS

  for (const rig of rigs) {
    // Generate anchor points for this rig
    const anchors = generateRigAnchors(rig)
    for (const anchor of anchors) {
      const dx = cursorPos.x - anchor[0]
      const dy = cursorPos.y - anchor[1]
      const dz = cursorPos.z - anchor[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (dist < minDist) {
        minDist = dist
        nearest = {
          rigId: rig.id,
          position: { x: anchor[0], y: anchor[1], z: anchor[2] },
          orientation: rig.orientation,
          rigHeight: rig.height,
        }
      }
    }
  }

  return nearest
}

// ── Component ──────────────────────────────────────────────────────────────

interface DragDropController3DProps {
  /** Whether drag interaction is enabled */
  enabled?: boolean
  /** Callback when drag starts (to hide HUD panels) */
  onDragStart?: () => void
  /** Callback when drag ends (to restore HUD panels) */
  onDragEnd?: () => void
  /** Stage dimensions for Crystal Box clamping */
  stageWidth?: number
  stageDepth?: number
  stageHeight?: number
  /** Active tool mode — 'move' enables dragging, 'select' only selects */
  toolMode?: ToolMode
}

export const DragDropController3D: React.FC<DragDropController3DProps> = ({
  enabled = true,
  onDragStart,
  onDragEnd,
  stageWidth = 12,
  stageDepth = 8,
  stageHeight = 6,
  toolMode = 'select',
}) => {
  const { camera, gl, raycaster, pointer, controls } = useThree()

  // ── Store ────────────────────────────────────────────────────────────────
  const fixtures = useStageStore(s => s.fixtures)
  const rigs = useStageStore(s => s.showFile?.rigs ?? [])
  const updateFixture = useStageStore(s => s.updateFixture)
  const updateFixturePosition = useStageStore(s => s.updateFixturePosition)

  // FASE 8: selectionStore integration
  const select = useSelectionStore(s => s.select)
  const setHovered = useSelectionStore(s => s.setHovered)
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const deselectAll = useSelectionStore(s => s.deselectAll)
  const snap = useSnapStore(s => s.snap)
  const snapSize = useSnapStore(s => s.snapSize)

  // ── State ────────────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const [activeAnchors, setActiveAnchors] = useState<[number, number, number][]>([])
  const [anchorsVisible, setAnchorsVisible] = useState(false)
  const [snapActive, setSnapActive] = useState(false)

  // Disable OrbitControls while dragging a fixture
  useEffect(() => {
    if (controls) {
      (controls as any).enabled = !isDragging
    }
  }, [isDragging, controls])

  const dragRef = useRef<DragState | null>(null)
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const intersectionRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const draggedFixtureRef = useRef<FixtureV2 | null>(null)
  const draggedGroupRef = useRef<THREE.Group | null>(null)

  // ── Invisible drag plane (Y = current fixture height) ────────────────────
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  // ── Stage dimensions for clamping ────────────────────────────────────────
  const stageDims = useMemo(
    () => ({ width: stageWidth, depth: stageDepth, height: stageHeight, gridSize: snapSize }),
    [stageWidth, stageDepth, stageHeight, snapSize],
  )

  // ── Start drag ───────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: any) => {
      if (!enabled) return
      if (e.button !== 0) return
      // Traverse up to find the group with fixtureId or rigId in userData
      let obj = e.object
      let targetId: string | undefined
      let isRig = false
      while (obj) {
        if (obj.userData?.fixtureId) {
          targetId = obj.userData.fixtureId
          break
        }
        if (obj.userData?.rigId) {
          targetId = obj.userData.rigId
          isRig = true
          break
        }
        obj = obj.parent
      }
      if (!targetId) return

      e.stopPropagation()

      // Selection logic (works in all modes)
      if (e.ctrlKey || e.metaKey) {
        select(targetId, 'toggle')
      } else if (e.shiftKey) {
        select(targetId, 'add')
      } else if (!selectedIds.has(targetId)) {
        select(targetId, 'replace')
      }

      // Rigs are dragged by RigRenderer's own handler — bail out here
      if (isRig) return

      // Only start fixture drag in 'move' mode
      if (toolMode !== 'move') return

      const fixture = fixtures.find(f => f.id === targetId)
      if (!fixture) return

      draggedFixtureRef.current = fixture
      draggedGroupRef.current = obj as THREE.Group
      setIsDragging(true)
      onDragStart?.()

      // Set drag plane at fixture's current Y
      dragPlane.set(new THREE.Vector3(0, 1, 0), -fixture.position.y)

      dragRef.current = {
        fixtureId: targetId,
        visualPos: new THREE.Vector3(fixture.position.x, fixture.position.y, fixture.position.z),
        targetPos: new THREE.Vector3(fixture.position.x, fixture.position.y, fixture.position.z),
        snapTarget: null,
        isSnapping: false,
        springStart: 0,
      }

      // Reveal anchors for nearby rigs
      const nearbyAnchors: [number, number, number][] = []
      for (const rig of rigs) {
        const dx = fixture.position.x - rig.position.x
        const dz = fixture.position.z - rig.position.z
        const dist2D = Math.sqrt(dx * dx + dz * dz)
        if (dist2D < 3) {
          nearbyAnchors.push(...generateRigAnchors(rig))
        }
      }
      setActiveAnchors(nearbyAnchors)
      setAnchorsVisible(true)
    },
    [enabled, fixtures, rigs, onDragStart, dragPlane, select, selectedIds, toolMode],
  )

  // ── Context menu handler (right-click) ──────────────────────────────────
  const handleContextMenu = useCallback(
    (e: any) => {
      let obj = e.object
      let fixtureId: string | undefined
      while (obj) {
        if (obj.userData?.fixtureId) {
          fixtureId = obj.userData.fixtureId
          break
        }
        obj = obj.parent
      }
      if (!fixtureId) return
      e.stopPropagation()
      if (e.nativeEvent?.preventDefault) e.nativeEvent.preventDefault()
      select(fixtureId, 'replace')
      window.dispatchEvent(new CustomEvent('erebus:radial-menu', {
        detail: { clientX: e.clientX, clientY: e.clientY, fixtureId },
      }))
    },
    [select],
  )

  // ── Update drag position via pointer move ────────────────────────────────
  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current || !draggedFixtureRef.current) return

      // Update raycaster from pointer
      const rect = gl.domElement.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera)

      // Intersect with drag plane
      const hit = raycaster.ray.intersectPlane(dragPlane, intersectionRef.current)
      if (!hit) return

      // Snap to voxel
      const snappedX = snap(hit.x)
      const snappedZ = snap(hit.z)
      const currentY = dragRef.current.visualPos.y

      // Clamp to Crystal Box
      const clamped = clampToCrystalBox(
        { x: snappedX, y: currentY, z: snappedZ },
        stageDims,
      )

      const cursorPos = new THREE.Vector3(clamped.x, clamped.y, clamped.z)
      dragRef.current.targetPos.copy(cursorPos)

      // Check for snap targets
      const snapResult = findNearestSnap(cursorPos, rigs)
      if (snapResult) {
        dragRef.current.snapTarget = snapResult
        dragRef.current.isSnapping = true
        dragRef.current.springStart = performance.now()
        // Override target to snap position
        dragRef.current.targetPos.set(
          snapResult.position.x,
          snapResult.position.y,
          snapResult.position.z,
        )
        setSnapActive(true)
      } else {
        dragRef.current.snapTarget = null
        dragRef.current.isSnapping = false
        setSnapActive(false)
      }
    }

    const handleUp = () => {
      if (!dragRef.current || !draggedFixtureRef.current) return

      const ds = dragRef.current
      const fixture = draggedFixtureRef.current

      // Determine final placement
      if (ds.snapTarget) {
        // Dropped on anchor — inherit rig properties
        updateFixture(fixture.id, {
          position: {
            x: snap(ds.snapTarget.position.x),
            y: snap(ds.snapTarget.rigHeight),
            z: snap(ds.snapTarget.position.z),
          },
          orientation: ds.snapTarget.orientation,
          rigId: ds.snapTarget.rigId,
          placementMode: '3d',
          isPlaced: true,
        })
      } else if (ds.visualPos.y < FLOOR_THRESHOLD) {
        // Dropped on floor
        updateFixture(fixture.id, {
          position: {
            x: snap(ds.visualPos.x),
            y: 0,
            z: snap(ds.visualPos.z),
          },
          orientation: 'floor' as InstallationOrientation,
          rigId: undefined,
          placementMode: '3d',
          isPlaced: true,
        })
      } else {
        // Free placement in 3D
        updateFixturePosition(fixture.id, {
          x: snap(ds.visualPos.x),
          y: snap(ds.visualPos.y),
          z: snap(ds.visualPos.z),
        })
        updateFixture(fixture.id, {
          rigId: undefined,
          placementMode: '3d',
          isPlaced: true,
        })
      }

      // Cleanup
      setIsDragging(false)
      setAnchorsVisible(false)
      setSnapActive(false)
      setActiveAnchors([])
      dragRef.current = null
      draggedFixtureRef.current = null
      draggedGroupRef.current = null
      dragPositionRef.current = null
      onDragEnd?.()
    }

    const handleWheel = (e: WheelEvent) => {
      if (!dragRef.current) return
      e.preventDefault()

      const direction = e.deltaY > 0 ? -1 : 1
      const step = snapSize
      const newY = snap(dragRef.current.targetPos.y + direction * step)

      // Clamp Y to Crystal Box
      const clamped = clampToCrystalBox(
        { x: dragRef.current.targetPos.x, y: newY, z: dragRef.current.targetPos.z },
        stageDims,
      )

      dragRef.current.targetPos.y = clamped.y
      dragRef.current.visualPos.y = clamped.y

      // Update drag plane to new height so XZ movement stays at this Y
      dragPlane.set(new THREE.Vector3(0, 1, 0), -clamped.y)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('wheel', handleWheel)
    }
  }, [isDragging, camera, gl, raycaster, dragPlane, rigs, updateFixture, updateFixturePosition, stageDims, onDragEnd, snap, snapSize])

  // ── Frame loop: spring interpolation + live position update ──────────────
  useFrame(() => {
    if (!dragRef.current || !isDragging) return

    const ds = dragRef.current
    const now = performance.now()

    if (ds.isSnapping) {
      // Spring toward snap target (120ms ease-out)
      const elapsed = now - ds.springStart
      const t = Math.min(elapsed / SPRING_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic

      ds.visualPos.lerp(ds.targetPos, eased * 0.3 + 0.1)

      if (t >= 1) {
        ds.visualPos.copy(ds.targetPos)
      }
    } else {
      // Free drag — follow cursor with slight smoothing
      ds.visualPos.lerp(ds.targetPos, 0.4)
    }

    // Update the dragged group's position imperatively (no store write per frame)
    if (draggedGroupRef.current) {
      draggedGroupRef.current.position.set(ds.visualPos.x, ds.visualPos.y, ds.visualPos.z)
    }

    // Publish live position for SpatialGuides (zero-renders)
    dragPositionRef.current = ds.visualPos
  })

  // ── Render: fixture layer with interaction + anchor points ──────────────
  // FixtureLayer3D renders visible meshes and forwards pointer events here.

  return (
    <>
      {/* FASE 3: Fixture rendering with interaction handlers */}
      <FixtureLayer3D
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          let obj = e.object
          let fid: string | undefined
          while (obj) {
            if (obj.userData?.fixtureId) {
              fid = obj.userData.fixtureId
              break
            }
            obj = obj.parent
          }
          if (fid) setHovered(fid)
        }}
        onPointerOut={() => setHovered(null)}
        onContextMenu={handleContextMenu}
      />

      {/* Selection ring — pulsing torus around selected fixtures */}
      {fixtures.filter(f => selectedIds.has(f.id)).map(f => (
        <mesh
          key={`sel-${f.id}`}
          position={[f.position.x, f.position.y, f.position.z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.12, 0.008, 8, 32]} />
          <meshBasicMaterial
            color="#5EEAD4"
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Anchor points — revealed during drag near rigs */}
      <AnchorPoints positions={activeAnchors} visible={anchorsVisible} />

      {/* Visual ghost of dragged fixture (follows visualPos) */}
      {isDragging && dragRef.current && (
        <mesh position={dragRef.current.visualPos.toArray()}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial
            color={snapActive ? '#5EEAD4' : '#F5B04D'}
            transparent
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  )
}

export default DragDropController3D
