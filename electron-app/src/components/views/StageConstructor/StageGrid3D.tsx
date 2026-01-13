/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 STAGE GRID 3D - WAVE 379.3: TRUST THE FRAMEWORK
 * "El Lienzo Infinito del Arquitecto"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Canvas 3D interactivo usando React Three Fiber + Drei.
 * 
 * Features:
 * - Renderiza fixtures desde stageStore (posiciones REALES, no algorítmicas)
 * - OrbitControls para navegación
 * - Click to select
 * - TransformControls (Gizmo) con SNAP system
 * - Grid infinito estilo Tron
 * - Persist position on drag end
 * - Ghost Drag & Drop desde library
 * - Box Selection (RTS-style)
 * - WAVE 368.5: Mathematical Raycaster D&D (bulletproof)
 * - WAVE 369: Camera Lock (input isolation) + Auto-Zoning (geofencing)
 * - WAVE 379.3: Trust R3F cleanup - NO forzar loseContext()
 * 
 * @module components/views/StageConstructor/StageGrid3D
 * @version 379.3.0
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber'
import { 
  OrbitControls, 
  TransformControls, 
  Grid, 
  Environment,
  Html,
  PerspectiveCamera
} from '@react-three/drei'
import { useStageStore, selectFixtures } from '../../../stores/stageStore'
import { useSelectionStore } from '../../../stores/selectionStore'
import { shallow } from 'zustand/shallow'
import { useConstructorContext } from '../StageConstructorView'
import { createDefaultFixture } from '../../../core/stage/ShowFileV2'
import type { FixtureV2, Position3D, FixtureZone } from '../../../core/stage/ShowFileV2'
import ZoneOverlay, { getZoneAtPosition } from './ZoneOverlay'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 378.5: GRANULAR SELECTORS - Prevent re-render cascade during sync
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae SOLO la estructura estática de fixtures (para layout, no RT data)
 * NO incluye: pan, tilt, color, intensity - esos cambian cada frame
 */
const selectFixtureStructure = (state: ReturnType<typeof useStageStore.getState>) => 
  state.fixtures.map(f => ({
    id: f?.id,
    name: f?.name,
    type: f?.type,
    address: f?.address,
    zone: f?.zone,
    position: f?.position,
    rotation: f?.rotation
  }))

/**
 * Igualdad por IDs - si los IDs no cambian, no re-renderizar
 * Ignora cambios en posición/rotación durante sync masivo inicial
 */
const fixtureStructureEquals = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false
  const aIds = a.map(f => f?.id).sort().join(',')
  const bIds = b.map(f => f?.id).sort().join(',')
  return aIds === bIds
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 379.3: WebGL Context - TRUST THE FRAMEWORK
// R3F maneja el dispose automáticamente. NO forzar limpieza manual.
// ═══════════════════════════════════════════════════════════════════════════

const WebGLContextHandler: React.FC = () => {
  const { gl } = useThree()
  
  useEffect(() => {
    const canvas = gl.domElement
    
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      console.warn('[StageGrid3D] ⚠️ WebGL Context Lost')
    }
    
    const handleContextRestored = () => {
      console.log('[StageGrid3D] ✅ WebGL Context Restored')
    }
    
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
    
    console.log('[StageGrid3D] 🎮 WebGL Context Handler mounted')
    
    // 🔥 WAVE 379.3: NO hacer nada en cleanup
    // React + R3F manejan el dispose automáticamente cuando el componente se desmonta
    // Forzar loseContext() causa "Zombie Renderer" crash
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      console.log('[StageGrid3D] 🎮 WebGL Context Handler unmounted - R3F will handle cleanup')
    }
  }, [gl])
  
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 368.5: CAMERA BRIDGE - Expose camera to parent for D&D raycasting
// ═══════════════════════════════════════════════════════════════════════════

interface CameraBridgeProps {
  onCameraReady: (camera: THREE.Camera) => void
}

const CameraBridge: React.FC<CameraBridgeProps> = ({ onCameraReady }) => {
  const { camera } = useThree()
  
  useEffect(() => {
    onCameraReady(camera)
  }, [camera, onCameraReady])
  
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE 3D MESH
// ═══════════════════════════════════════════════════════════════════════════

interface Fixture3DProps {
  fixture: FixtureV2
  isSelected: boolean
  isHovered: boolean
  onSelect: (id: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (id: string | null) => void
}

const Fixture3D: React.FC<Fixture3DProps> = ({ 
  fixture, 
  isSelected, 
  isHovered,
  onSelect,
  onHover 
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  
  // Determine color based on fixture type and state
  const getColor = () => {
    if (isSelected) return '#22d3ee' // Cyan-400 when selected
    if (isHovered) return '#fbbf24'  // Amber-400 when hovered
    
    switch (fixture.type) {
      case 'moving-head': return '#a855f7' // Purple
      case 'par': return '#4ade80'         // Green
      case 'wash': return '#3b82f6'        // Blue
      case 'strobe': return '#ef4444'      // Red
      case 'laser': return '#f97316'       // Orange
      case 'blinder': return '#fbbf24'     // Amber
      default: return '#6b7280'            // Gray
    }
  }
  
  // Determine geometry based on fixture type
  const renderGeometry = () => {
    switch (fixture.type) {
      case 'moving-head':
        // Cone pointing down (like a spotlight)
        return <coneGeometry args={[0.3, 0.6, 8]} />
      case 'par':
      case 'wash':
        // Cylinder (like a can)
        return <cylinderGeometry args={[0.2, 0.25, 0.3, 16]} />
      case 'strobe':
      case 'blinder':
        // Box (rectangular light)
        return <boxGeometry args={[0.4, 0.2, 0.3]} />
      default:
        // Sphere (generic)
        return <sphereGeometry args={[0.2, 16, 16]} />
    }
  }
  
  return (
    <mesh
      ref={meshRef}
      position={[fixture.position.x, fixture.position.y, fixture.position.z]}
      rotation={[
        THREE.MathUtils.degToRad(fixture.rotation.pitch),
        THREE.MathUtils.degToRad(fixture.rotation.yaw),
        THREE.MathUtils.degToRad(fixture.rotation.roll)
      ]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(fixture.id, e)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(fixture.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        onHover(null)
        document.body.style.cursor = 'default'
      }}
    >
      {renderGeometry()}
      <meshStandardMaterial 
        color={getColor()}
        emissive={getColor()}
        emissiveIntensity={isSelected ? 0.8 : isHovered ? 0.5 : 0.2}
        metalness={0.3}
        roughness={0.4}
      />
      
      {/* Label on hover/select */}
      {(isHovered || isSelected) && (
        <Html
          position={[0, 0.5, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div className="fixture-label-3d">
            <span className="label-name">{fixture.name}</span>
            <span className="label-address">#{fixture.address}</span>
          </div>
        </Html>
      )}
    </mesh>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSFORM GIZMO WRAPPER - With Snap Support + WAVE 369 Interaction Lock
// ═══════════════════════════════════════════════════════════════════════════

interface TransformGizmoProps {
  fixture: FixtureV2
  onPositionChange: (id: string, position: Position3D, newZone: FixtureZone | null) => void
  snapEnabled: boolean
  snapDistance: number
  snapRotation: number
  onDraggingChanged: (isDragging: boolean) => void
}

const TransformGizmo: React.FC<TransformGizmoProps> = ({ 
  fixture, 
  onPositionChange,
  snapEnabled,
  snapDistance,
  snapRotation,
  onDraggingChanged
}) => {
  const transformRef = useRef<any>(null)
  const objectRef = useRef<THREE.Group>(null!)
  const [currentZone, setCurrentZone] = useState<FixtureZone | null>(null)
  
  // Track zone while dragging for visual feedback
  useFrame(() => {
    if (objectRef.current && transformRef.current?.dragging) {
      const pos = objectRef.current.position
      const zone = getZoneAtPosition(pos.x, pos.z)
      if (zone !== currentZone) {
        setCurrentZone(zone)
        // WAVE 378.5: Log removed - was running every frame
      }
    }
  })
  
  // Handle dragging state change - WAVE 369
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    
    const handleDraggingChanged = (event: { value: boolean }) => {
      onDraggingChanged(event.value)
      
      // On drag end, report final position with zone
      if (!event.value && objectRef.current) {
        const pos = objectRef.current.position
        const zone = getZoneAtPosition(pos.x, pos.z)
        onPositionChange(fixture.id, {
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
          z: Math.round(pos.z * 100) / 100
        }, zone)
      }
    }
    
    controls.addEventListener('dragging-changed', handleDraggingChanged)
    return () => controls.removeEventListener('dragging-changed', handleDraggingChanged)
  }, [fixture.id, onPositionChange, onDraggingChanged])
  
  return (
    <group>
      {/* Invisible object that TransformControls attaches to */}
      <group 
        ref={objectRef}
        position={[fixture.position.x, fixture.position.y, fixture.position.z]}
      />
      
      <TransformControls
        ref={transformRef}
        object={objectRef.current || undefined}
        mode="translate"
        size={0.8}
        translationSnap={snapEnabled ? snapDistance : null}
        rotationSnap={snapEnabled ? snapRotation : null}
      />
      
      {/* WAVE 369: Floating zone indicator while dragging */}
      {currentZone && transformRef.current?.dragging && (
        <Html position={[objectRef.current?.position.x || 0, (objectRef.current?.position.y || 3) + 1, objectRef.current?.position.z || 0]}>
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #22d3ee',
            color: '#22d3ee',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}>
            📍 {currentZone}
          </div>
        </Html>
      )}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE GRID SCENE - Receives snap config as props
// WAVE 369: Now with interaction lock for camera control isolation
// WAVE 369.6: Receives selectedIds as ARRAY prop to fix R3F context issue
// WAVE 378.5: MEMOIZED + Granular selectors to prevent Context Lost
// ═══════════════════════════════════════════════════════════════════════════

interface StageSceneProps {
  snapEnabled: boolean
  snapDistance: number
  snapRotation: number
  onFixtureDrop: (type: string, position: Position3D) => void
  showZones: boolean
  highlightedZone: FixtureZone | null
  onZoneClick: (zoneId: FixtureZone) => void
  isBoxSelectMode: boolean  // WAVE 369: Disable camera during box select
  onInteractionChange: (isInteracting: boolean) => void  // WAVE 369
  selectedIdsArray: string[]  // WAVE 369.6: Array instead of Set to fix R3F reactivity
  fixtureStructure: any[]  // WAVE 378.5: Pre-extracted fixture structure (from parent)
}

const StageScene = memo<StageSceneProps>(({ 
  snapEnabled, 
  snapDistance, 
  snapRotation,
  onFixtureDrop,
  showZones,
  highlightedZone,
  onZoneClick,
  isBoxSelectMode,
  onInteractionChange,
  selectedIdsArray,
  fixtureStructure  // WAVE 378.5
}) => {
  // WAVE 378.5: Use fixtureStructure prop instead of subscribing directly
  // This prevents re-renders during TitanSyncBridge sync operations
  const fixtures = fixtureStructure
  
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
  const setFixtureZone = useStageStore(state => state.setFixtureZone)
  
  // WAVE 369.6 FIX: Use array prop, create Set locally only for .has() convenience
  const selectedIds = useMemo(() => new Set(selectedIdsArray), [selectedIdsArray.join(',')])
  
  const hoveredId = useSelectionStore(state => state.hoveredId)
  const select = useSelectionStore(state => state.select)
  const setHovered = useSelectionStore(state => state.setHovered)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // WAVE 369: Gizmo interaction state
  const [isGizmoActive, setIsGizmoActive] = useState(false)
  
  // WAVE 369: Camera disabled when gizmo active OR box select mode
  const cameraEnabled = !isGizmoActive && !isBoxSelectMode
  
  // Get the single selected fixture for transform controls
  const selectedFixture = selectedIdsArray.length === 1 
    ? fixtures.find((f: any) => f.id === selectedIdsArray[0])
    : null
  
  // WAVE 369: Handle gizmo dragging change
  const handleGizmoDraggingChanged = useCallback((isDragging: boolean) => {
    setIsGizmoActive(isDragging)
    onInteractionChange(isDragging)
  }, [onInteractionChange])
  
  // WAVE 369: Handle position change with auto-zoning
  const handlePositionChangeWithZone = useCallback((id: string, position: Position3D, newZone: FixtureZone | null) => {
    updateFixturePosition(id, position)
    if (newZone) {
      setFixtureZone(id, newZone)
      console.log(`[StageScene] 🗺️ Auto-assigned zone: ${newZone}`)
    }
  }, [updateFixturePosition, setFixtureZone])
  
  // Handle fixture selection
  const handleSelect = useCallback((id: string, event: ThreeEvent<MouseEvent>) => {
    const mode = event.nativeEvent.ctrlKey || event.nativeEvent.metaKey 
      ? 'toggle' 
      : 'replace'
    select(id, mode)
  }, [select])
  
  // Handle hover
  const handleHover = useCallback((id: string | null) => {
    setHovered(id)
  }, [setHovered])
  
  // Handle click on empty space - WAVE 369.6: Don't deselect during BoxSelect
  const handleBackgroundClick = useCallback(() => {
    if (isBoxSelectMode) return  // Don't deselect when using box select tool
    deselectAll()
  }, [deselectAll, isBoxSelectMode])
  
  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={50} />
      
      {/* WAVE 369: Controls - DISABLED when gizmo active or box selecting */}
      <OrbitControls
        enabled={cameraEnabled}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.1} // Prevent going below floor
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color="#4080ff" />
      
      {/* Grid - Tron style */}
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      
      {/* Floor plane (for click-to-deselect) */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.01, 0]}
        onClick={handleBackgroundClick}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      
      {/* Stage dimensions indicator */}
      <group position={[0, 0.01, 0]}>
        {/* Stage outline */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(12, 0.02, 8)]} />
          <lineBasicMaterial color="#22d3ee" opacity={0.3} transparent />
        </lineSegments>
      </group>
      
      {/* Zone Overlay - WAVE 363 */}
      <ZoneOverlay
        visible={showZones}
        highlightedZone={highlightedZone}
        onZoneClick={onZoneClick}
      />
      
      {/* Fixtures */}
      {fixtures.map(fixture => (
        <Fixture3D
          key={fixture.id}
          fixture={fixture}
          isSelected={selectedIds.has(fixture.id)}
          isHovered={hoveredId === fixture.id}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      ))}
      
      {/* WAVE 369: Transform Gizmo - WITH SNAP + INTERACTION LOCK + AUTO-ZONE */}
      {selectedFixture && (
        <TransformGizmo
          fixture={selectedFixture}
          onPositionChange={handlePositionChangeWithZone}
          snapEnabled={snapEnabled}
          snapDistance={snapDistance}
          snapRotation={snapRotation}
          onDraggingChanged={handleGizmoDraggingChanged}
        />
      )}
    </>
  )
})

StageScene.displayName = 'StageScene'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - Bridge between React Context and R3F
// WAVE 369: Camera Lock + Auto-Zoning complete
// ═══════════════════════════════════════════════════════════════════════════

interface BoxSelectionRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

// WAVE 368.5: Reusable raycaster and ground plane (created once)
const dropRaycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // Y-up plane at y=0
const intersectionPoint = new THREE.Vector3()

const StageGrid3D: React.FC = () => {
  // Get snap settings from parent context
  const { snapEnabled, snapDistance, snapRotation, draggedFixtureType, setDraggedFixtureType, toolMode, showZones } = useConstructorContext()
  const addFixture = useStageStore(state => state.addFixture)
  const setFixtureZone = useStageStore(state => state.setFixtureZone)
  
  // WAVE 378.5: GRANULAR selector - only re-render when fixture IDs change, not on every sync
  const fixtureStructure = useStageStore(selectFixtureStructure, fixtureStructureEquals)
  
  // Keep a reference to full fixtures for box selection raycasting (read once, not reactive)
  const fixturesRef = useRef(useStageStore.getState().fixtures)
  useEffect(() => {
    // Update ref when structure changes (new fixtures added/removed)
    fixturesRef.current = useStageStore.getState().fixtures
  }, [fixtureStructure])
  
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  
  // WAVE 369.6 FIX: Subscribe to selection changes with a simple primitive selector
  const selectionVersion = useSelectionStore(state => state.selectedIds.size)
  const selectedIdsArray = useSelectionStore(state => [...state.selectedIds])
  
  // Keep Set for local operations that need .has()
  const selectedIds = useMemo(() => new Set(selectedIdsArray), [selectionVersion])
  
  const canvasRef = useRef<HTMLDivElement>(null)
  
  // WAVE 368.5: Camera reference for raycasting
  const cameraRef = useRef<THREE.Camera | null>(null)
  
  // WAVE 369: Gizmo interaction state (passed to StageScene for camera lock)
  const [isGizmoInteracting, setIsGizmoInteracting] = useState(false)
  
  // Is box select tool active
  const isBoxSelectMode = toolMode === 'boxSelect'
  
  // Box selection state
  const [boxSelection, setBoxSelection] = useState<BoxSelectionRect | null>(null)
  const isBoxSelecting = useRef(false)
  
  // Zone highlight state - WAVE 363
  const [highlightedZone, setHighlightedZone] = useState<FixtureZone | null>(null)
  
  // WAVE 368.5: Camera ready callback - WAVE 378.5: Log removed (one-time but noisy)
  const handleCameraReady = useCallback((camera: THREE.Camera) => {
    cameraRef.current = camera
  }, [])
  
  // WAVE 369: Handle gizmo interaction change - WAVE 378.5: Logs removed
  const handleInteractionChange = useCallback((isInteracting: boolean) => {
    setIsGizmoInteracting(isInteracting)
  }, [])
  
  // Handle zone click - assign zone to selected fixtures
  const handleZoneClick = useCallback((zoneId: FixtureZone) => {
    if (selectedIds.size === 0) return
    
    // Assign zone to all selected fixtures
    for (const fixtureId of selectedIds) {
      setFixtureZone(fixtureId, zoneId)
    }
  }, [selectedIds, setFixtureZone])
  
  // Box selection handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (toolMode !== 'boxSelect') return
    if (e.button !== 0) return // Only left click
    if (!canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    isBoxSelecting.current = true
    setBoxSelection({
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    })
  }, [toolMode])
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isBoxSelecting.current || !boxSelection || !canvasRef.current) return
    
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    setBoxSelection(prev => prev ? {
      ...prev,
      currentX: x,
      currentY: y
    } : null)
  }, [boxSelection])
  
  const handleMouseUp = useCallback(() => {
    if (!isBoxSelecting.current || !boxSelection || !canvasRef.current) {
      isBoxSelecting.current = false
      setBoxSelection(null)
      return
    }
    
    // Calculate selection bounds (screen space)
    const minX = Math.min(boxSelection.startX, boxSelection.currentX)
    const maxX = Math.max(boxSelection.startX, boxSelection.currentX)
    const minY = Math.min(boxSelection.startY, boxSelection.currentY)
    const maxY = Math.max(boxSelection.startY, boxSelection.currentY)
    
    // Only select if box is at least 10px
    if (maxX - minX > 10 && maxY - minY > 10) {
      const rect = canvasRef.current.getBoundingClientRect()
      const camera = cameraRef.current
      
      if (!camera) {
        console.warn('[BoxSelect] No camera reference!')
        isBoxSelecting.current = false
        setBoxSelection(null)
        return
      }
      
      // WAVE 369.6: PROPER 3D→2D PROJECTION
      // WAVE 378.5: Use fixturesRef instead of reactive fixtures
      // Project each fixture's 3D position to screen space using the actual camera
      const selectedFixtureIds = fixturesRef.current.filter((fixture: any) => {
        // Create a Vector3 from fixture position
        const worldPos = new THREE.Vector3(
          fixture.position.x,
          fixture.position.y,
          fixture.position.z
        )
        
        // Project to NDC (-1 to +1) using camera's view-projection matrix
        const projected = worldPos.clone().project(camera)
        
        // Convert NDC to screen pixels
        const screenX = (projected.x + 1) / 2 * rect.width
        const screenY = (-projected.y + 1) / 2 * rect.height
        
        // Check if fixture's screen position is inside selection box
        return (
          screenX >= minX && 
          screenX <= maxX &&
          screenY >= minY &&
          screenY <= maxY &&
          projected.z < 1 // Only select fixtures in front of camera
        )
      }).map((f: any) => f.id)
      
      if (selectedFixtureIds.length > 0) {
        selectMultiple(selectedFixtureIds)
      }
    }
    
    isBoxSelecting.current = false
    setBoxSelection(null)
  }, [boxSelection, selectMultiple])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 368.5: BULLETPROOF DROP - Mathematical Raycaster
  // "La Maldición del HTML Invisible" ENDS HERE
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const fixtureType = e.dataTransfer.getData('fixture-type')
    const libraryId = e.dataTransfer.getData('library-fixture-id')
    
    if (!fixtureType || !canvasRef.current) {
      console.warn('[StageGrid3D] Drop failed: no fixture type or canvas ref')
      return
    }
    
    // Step 1: Get mouse position relative to canvas
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Step 2: Convert to Normalized Device Coordinates (-1 to +1)
    const ndcX = (mouseX / rect.width) * 2 - 1
    const ndcY = -(mouseY / rect.height) * 2 + 1
    
    let worldX = 0
    let worldZ = 0
    
    // Step 3: Raycast to ground plane (if camera is available)
    if (cameraRef.current) {
      // Set ray from camera through mouse position
      dropRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cameraRef.current)
      
      // Intersect with ground plane (y=0)
      const ray = dropRaycaster.ray
      const didIntersect = ray.intersectPlane(groundPlane, intersectionPoint)
      
      if (didIntersect) {
        worldX = intersectionPoint.x
        worldZ = intersectionPoint.z
        console.log(`[StageGrid3D] Raycast hit: (${worldX.toFixed(2)}, ${worldZ.toFixed(2)})`)
      } else {
        // Fallback: If ray doesn't hit plane (looking up), use projection
        console.warn('[StageGrid3D] Raycast missed ground plane, using fallback')
        worldX = ndcX * 8
        worldZ = ndcY * 6
      }
    } else {
      // Fallback: No camera yet (shouldn't happen, but safety first)
      console.warn('[StageGrid3D] No camera ref, using fallback projection')
      worldX = ndcX * 8
      worldZ = ndcY * 6
    }
    
    // Clamp to stage bounds (-6 to 6 for X, -4 to 4 for Z)
    worldX = Math.max(-6, Math.min(6, worldX))
    worldZ = Math.max(-4, Math.min(4, worldZ))
    
    // WAVE 369: Auto-detect zone from drop position
    const autoZone = getZoneAtPosition(worldX, worldZ) || 'unassigned'
    
    // Step 4: Create the fixture with auto-assigned zone!
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1
    
    const newFixture = createDefaultFixture(fixtureId, nextAddress, {
      type: fixtureType as FixtureV2['type'],
      position: { x: worldX, y: 3, z: worldZ },  // Default height 3m above ground
      zone: autoZone  // WAVE 369: Auto-zone assignment
    })
    
    addFixture(newFixture)
    setDraggedFixtureType(null)
    
    console.log(`[StageGrid3D] 🎯 Fixture dropped at (${worldX.toFixed(2)}, 3, ${worldZ.toFixed(2)}) → Zone: ${autoZone}`)
  }, [addFixture, setDraggedFixtureType])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])
  
  // Handler for drops from inside R3F (proper raycast)
  const handleFixtureDrop = useCallback((type: string, position: Position3D) => {
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1
    const autoZone = getZoneAtPosition(position.x, position.z) || 'unassigned'
    const newFixture = createDefaultFixture(fixtureId, nextAddress, {
      type: type as FixtureV2['type'],
      position,
      zone: autoZone
    })
    addFixture(newFixture)
  }, [addFixture])
  
  return (
    <div 
      ref={canvasRef}
      className="stage-grid-3d viewport-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: toolMode === 'boxSelect' ? 'crosshair' : 'default' }}
    >
      <Canvas
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          // WAVE 378.7: Prevent context loss
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false
        }}
        dpr={[1, 1.5]}  // WAVE 378.7: Reduce max DPR to prevent GPU overload
        style={{ background: '#000000', pointerEvents: 'auto' }}
        // WAVE 378.8: Revert to 'always' - 'demand' caused context loss on fixture load
      >
        {/* WAVE 378.7: WebGL Context Loss Handler */}
        <WebGLContextHandler />
        
        {/* WAVE 368.5: Camera Bridge - exposes camera for D&D raycasting */}
        <CameraBridge onCameraReady={handleCameraReady} />
        
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 30, 60]} />
        
        <StageScene 
          snapEnabled={snapEnabled}
          snapDistance={snapDistance}
          snapRotation={snapRotation}
          onFixtureDrop={handleFixtureDrop}
          showZones={showZones}
          highlightedZone={highlightedZone}
          onZoneClick={handleZoneClick}
          isBoxSelectMode={isBoxSelectMode}
          onInteractionChange={handleInteractionChange}
          selectedIdsArray={selectedIdsArray}
          fixtureStructure={fixtureStructure}
        />
      </Canvas>
      
      {/* Drag indicator overlay */}
      {draggedFixtureType && (
        <div className="drop-zone-indicator">
          <span>Soltar para añadir {draggedFixtureType}</span>
        </div>
      )}
      
      {/* Snap indicator when active */}
      {snapEnabled && (
        <div className="snap-indicator-overlay">
          <span>🧲 Snap: 0.5m / 15°</span>
        </div>
      )}
      
      {/* Box Selection Rectangle */}
      {boxSelection && (
        <div 
          className="box-selection-rect"
          style={{
            left: Math.min(boxSelection.startX, boxSelection.currentX),
            top: Math.min(boxSelection.startY, boxSelection.currentY),
            width: Math.abs(boxSelection.currentX - boxSelection.startX),
            height: Math.abs(boxSelection.currentY - boxSelection.startY)
          }}
        />
      )}
      
      {/* WAVE 369: Camera Lock Indicator */}
      {(isGizmoInteracting || isBoxSelectMode) && (
        <div className="camera-lock-indicator">
          <span>🔒 Camera Locked</span>
        </div>
      )}
      
      {/* Canvas overlay UI */}
      <div className="grid-overlay">
        <div className="grid-hint">
          <span>🖱️ Left: Select</span>
          <span>🖱️ Right: Rotate View</span>
          <span>⚙️ Scroll: Zoom</span>
        </div>
      </div>
      
      <style>{`
        .stage-grid-3d {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .camera-lock-indicator {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 12px;
          background: rgba(239, 68, 68, 0.9);
          border: 1px solid #ef4444;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: bold;
          pointer-events: none;
          z-index: 100;
          animation: pulse 1s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .grid-overlay {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
        }
        
        .grid-hint {
          display: flex;
          gap: 16px;
          padding: 8px 16px;
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .drop-zone-indicator {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34, 211, 238, 0.1);
          border: 2px dashed rgba(34, 211, 238, 0.5);
          pointer-events: none;
          z-index: 10;
        }
        
        .drop-zone-indicator span {
          padding: 12px 24px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(34, 211, 238, 0.5);
          border-radius: 8px;
          color: #22d3ee;
          font-size: 14px;
          font-weight: 500;
        }
        
        .snap-indicator-overlay {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(168, 85, 247, 0.5);
          border-radius: 6px;
          color: #a855f7;
          font-size: 11px;
          font-weight: 500;
          pointer-events: none;
        }
        
        .box-selection-rect {
          position: absolute;
          background: rgba(34, 211, 238, 0.15);
          border: 1px solid rgba(34, 211, 238, 0.8);
          pointer-events: none;
          z-index: 100;
        }
        
        .fixture-label-3d {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid rgba(34, 211, 238, 0.5);
          border-radius: 4px;
          font-size: 10px;
          white-space: nowrap;
        }
        
        .label-name {
          color: #22d3ee;
          font-weight: 600;
        }
        
        .label-address {
          color: rgba(255, 255, 255, 0.5);
          font-size: 9px;
        }
      `}</style>
    </div>
  )
}

export default StageGrid3D
