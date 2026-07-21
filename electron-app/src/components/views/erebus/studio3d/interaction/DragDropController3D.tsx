import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { useStageStore } from '../../../../../stores/stageStore'
import { useSelectionStore } from '../../../../../stores/selectionStore'
import { AnchorPoints } from '../rigging/AnchorPoints'
import { FixtureLayer3D } from '../fixtures/FixtureLayer3D'
import type { RigV2, FixtureV2, InstallationOrientation, Position3D } from '../../../../../core/stage/ShowFileV2'
import { snapToVoxel, VOXEL_SIZE, clampToCrystalBox } from '../../../../../core/stage/ShowFileV2'

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
const ANCHOR_SPACING = 0.5 // 50cm entre puntos de anclaje

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

// ── Helper: generate anchor points along a truss ───────────────────────────

function generateAnchorPoints(rig: RigV2): [number, number, number][] {
  const points: [number, number, number][] = []
  const { position, height } = rig

  // Generate anchors along X axis centered on rig position
  // Span ±2m from rig center, every 0.5m
  for (let dx = -2; dx <= 2; dx += ANCHOR_SPACING) {
    points.push([position.x + dx, height - 0.15, position.z]) // 15cm below cord
  }

  return points
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
    const anchors = generateAnchorPoints(rig)
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
}

export const DragDropController3D: React.FC<DragDropController3DProps> = ({
  enabled = true,
  onDragStart,
  onDragEnd,
  stageWidth = 12,
  stageDepth = 8,
  stageHeight = 6,
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

  // ── Invisible drag plane (Y = current fixture height) ────────────────────
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  // ── Stage dimensions for clamping ────────────────────────────────────────
  const stageDims = useMemo(
    () => ({ width: stageWidth, depth: stageDepth, height: stageHeight, gridSize: VOXEL_SIZE }),
    [stageWidth, stageDepth, stageHeight],
  )

  // ── Start drag ───────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: any) => {
      if (!enabled) return
      // Only start drag on left click with a selected fixture
      if (e.button !== 0) return
      // Traverse up to find the group with fixtureId in userData
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

      const fixture = fixtures.find(f => f.id === fixtureId)
      if (!fixture) return

      e.stopPropagation()

      // FASE 8: Notify selectionStore (Shift = add, plain = replace)
      if (e.shiftKey) {
        select(fixtureId, 'add')
      } else if (!selectedIds.has(fixtureId)) {
        select(fixtureId, 'replace')
      }

      draggedFixtureRef.current = fixture
      setIsDragging(true)
      onDragStart?.()

      // Set drag plane at fixture's current Y
      dragPlane.set(new THREE.Vector3(0, 1, 0), -fixture.position.y)

      dragRef.current = {
        fixtureId,
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
          nearbyAnchors.push(...generateAnchorPoints(rig))
        }
      }
      setActiveAnchors(nearbyAnchors)
      setAnchorsVisible(true)
    },
    [enabled, fixtures, rigs, onDragStart, dragPlane, select, selectedIds],
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
      e.preventDefault()
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
      const snappedX = snapToVoxel(hit.x)
      const snappedZ = snapToVoxel(hit.z)
      const currentY = dragRef.current.visualPos.y

      // Clamp to Crystal Box
      const clamped = clampToCrystalBox(
        { x: snappedX, y: currentY, z: snappedZ },
        stageDims,
      )

      const cursorPos = new THREE.Vector3(clamped.x, clamped.y, clamped.z)
      dragRef.current.targetPos.copy(cursorPos)

      // Check for snap targets
      const snap = findNearestSnap(cursorPos, rigs)
      if (snap) {
        dragRef.current.snapTarget = snap
        dragRef.current.isSnapping = true
        dragRef.current.springStart = performance.now()
        // Override target to snap position
        dragRef.current.targetPos.set(
          snap.position.x,
          snap.position.y,
          snap.position.z,
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
            x: snapToVoxel(ds.snapTarget.position.x),
            y: snapToVoxel(ds.snapTarget.rigHeight),
            z: snapToVoxel(ds.snapTarget.position.z),
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
            x: snapToVoxel(ds.visualPos.x),
            y: 0,
            z: snapToVoxel(ds.visualPos.z),
          },
          orientation: 'floor' as InstallationOrientation,
          rigId: undefined,
          placementMode: '3d',
          isPlaced: true,
        })
      } else {
        // Free placement in 3D
        updateFixturePosition(fixture.id, {
          x: snapToVoxel(ds.visualPos.x),
          y: snapToVoxel(ds.visualPos.y),
          z: snapToVoxel(ds.visualPos.z),
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
      onDragEnd?.()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isDragging, camera, gl, raycaster, dragPlane, rigs, updateFixture, updateFixturePosition, stageDims, onDragEnd])

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

    // Live-update fixture position in store so the mesh visually follows
    updateFixturePosition(ds.fixtureId, {
      x: ds.visualPos.x,
      y: ds.visualPos.y,
      z: ds.visualPos.z,
    })
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
