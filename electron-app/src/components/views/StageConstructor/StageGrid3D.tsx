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
import { createDefaultFixture, mapLibraryTypeToFixtureType, MotorType } from '../../../core/stage/ShowFileV2'
import type { FixtureV2, Position3D, FixtureZone } from '../../../core/stage/ShowFileV2'
import ZoneOverlay, { getZoneAtPosition } from './ZoneOverlay'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// 🔓 WAVE 1036.2: UNLOCK THE GRID - FULL REACTIVITY
// Eliminada la memoización agresiva que impedía ver cambios en tiempo real
// En el Constructor, la reactividad es más importante que la performance
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WAVE 2040.27b: ZONE NORMALIZER (Precision Overhaul)
// Jerarquía: TIPO → POSICIÓN (con límites matemáticos claros)
// ═══════════════════════════════════════════════════════════════════════════
const normalizeZone = (rawZone: string, x: number, z: number, type: string): FixtureZone => {
  const typeLower = type.toLowerCase()
  
  // ═══════════════════════════════════════════════════════════════════════
  // NIVEL 1: TIPO ESPECIAL (override de posición)
  // ═══════════════════════════════════════════════════════════════════════
  
  // 1.1. Laser/Atmosphere → AIR (siempre, independiente de posición)
  if (typeLower.includes('laser') || typeLower.includes('aerial') || typeLower.includes('haze')) {
    return 'air'
  }
  
  // 1.2. Strobe/Blinder → CENTER (si está cerca del centro X)
  if (typeLower.includes('strobe') || typeLower.includes('blinder')) {
    // Si está en la zona central (X entre -2 y 2), asignar CENTER
    if (x >= -2 && x <= 2) {
      return 'center'
    }
    // Si está muy lateral, caer a lógica de PARs (front/back)
  }
  
  // 1.3. Moving Heads → MOVERS-LEFT / MOVERS-RIGHT (por columna)
  if (typeLower.includes('moving') || typeLower.includes('head')) {
    // Umbral más estricto: x < -4 o x > 4 para ser "columna lateral"
    if (x < -4) return 'movers-left'
    if (x > 4) return 'movers-right'
    // Si un mover está más al centro (raro), caer a lógica de posición
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // NIVEL 2: POSICIÓN (para PARs, Wash, Bar, Generic)
  // ═══════════════════════════════════════════════════════════════════════
  
  // 2.1. BACK: Fondo del escenario (Z < -1)
  if (z < -1) {
    return 'back'
  }
  
  // 2.2. FRONT: Cerca de audiencia (Z > 1)
  if (z > 1) {
    return 'front'
  }
  
  // 2.3. ZONA MEDIA (Z entre -1 y 1): FLOOR vs CENTER vs BACK
  // Aquí es donde necesitamos más precisión
  
  // Si está en el suelo (Y < 0.5m), es FLOOR (uplights, floor PARs)
  // NOTA: En el grid 3D, Y=0 es el suelo. Si el usuario lo baja manualmente,
  // Y puede ser negativo. Pero el drop default es Y=0, así que Y < 0.5 es suelo.
  // Para fixtures con Y explícito (manual move), si Y < 0.5 → FLOOR
  // Pero esto solo aplica si ya tienen Y seteado. En drop inicial, Y=0 default.
  
  // 🪜 WAVE 2040.27b: Usar proximidad al centro para desambiguar FLOOR vs CENTER
  // Si está MUY central (X entre -2 y 2) y en zona media (Z entre -1 y 1) → CENTER
  if (x >= -2 && x <= 2 && z >= -1 && z <= 1) {
    return 'center'
  }
  
  // Si está lateral (X > 2 o X < -2) pero en zona media → FLOOR
  if ((x < -2 || x > 2) && z >= -1 && z <= 1) {
    return 'floor'
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FALLBACK: Si nada matchea (no debería pasar), default a BACK
  // ═══════════════════════════════════════════════════════════════════════
  return 'back'
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
// 🌊 WAVE 2040.27a: STEREO ZONE INDICATOR (CanonicalZone Native)
// Helper function to show L/R indicator for stereo-capable zones
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera etiqueta con indicador estéreo basado en posición X del fixture
 * @param fixture El fixture a evaluar
 * @returns String con zona + indicador Ⓛ/Ⓡ si aplica
 */
const getStereoZoneLabel = (fixture: FixtureV2): string => {
  const zone = fixture.zone?.toLowerCase() || '';
  const posX = fixture.position?.x ?? 0;
  const side = posX < 0 ? 'Ⓛ' : 'Ⓡ';  // Left / Right indicators
  
  // Movers ya tienen L/R en el nombre de zona
  if (zone === 'movers-left') return 'MOVER Ⓛ';
  if (zone === 'movers-right') return 'MOVER Ⓡ';
  
  // Front/Back muestran stereo basado en posición X
  if (zone === 'front') return `FRONT ${side}`;
  if (zone === 'back') return `BACK ${side}`;
  
  // Zonas centrales/especiales
  if (zone === 'center') return 'CENTER';
  if (zone === 'floor') return `FLOOR ${side}`;
  if (zone === 'air') return 'AIR';
  if (zone === 'ambient') return 'AMBIENT';
  
  // Fallback: mostrar zona raw en mayúsculas
  return fixture.zone?.toUpperCase() || 'ZONE?';
};

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
  
  // 🪜 WAVE 1036: Get fixture height for visual offset calculation
  // This ensures y=0 means "resting on floor", not "center at floor"
  const getFixtureHeight = (): number => {
    switch (fixture.type) {
      case 'moving-head': return 0.6  // cone height
      case 'par':
      case 'wash': return 0.3         // cylinder height
      case 'strobe':
      case 'blinder': return 0.2      // box height
      default: return 0.4             // sphere diameter
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
  
  // 🪜 WAVE 1036 FIX: Visual offset so y=0 = "floor contact"
  const visualYOffset = getFixtureHeight() / 2
  
  return (
    <group
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
      {/* 🪜 WAVE 1036: Mesh offset by half-height so pivot is at BASE */}
      <mesh
        ref={meshRef}
        position={[0, visualYOffset, 0]}
      >
        {renderGeometry()}
        <meshStandardMaterial 
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={isSelected ? 0.8 : isHovered ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Label on hover/select - 🌊 WAVE 1035: Stereo zone indicator */}
      {(isHovered || isSelected) && (
        <Html
          position={[0, visualYOffset + 0.4, 0]}
          center
          zIndexRange={[0, 10]} // WAVE 385.5: No bloquear modales
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <div className="fixture-label-3d">
            <span className="label-name">{fixture.name}</span>
            <span className="label-address">#{fixture.address}</span>
            <span className="label-zone">{getStereoZoneLabel(fixture)}</span>
          </div>
        </Html>
      )}
    </group>
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
  
  // 🪜 WAVE 1036: Hide Y axis gizmo (2D planar movement only)
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    
    // THREE.TransformControls exposes gizmo.children for axis manipulation
    // Find and hide the Y axis helper (green arrow)
    const gizmo = (controls as any).children?.find((c: any) => c.name === 'TransformControlsGizmo')
    if (gizmo) {
      // The gizmo contains axis handles - Y axis is typically the second one
      gizmo.traverse((child: any) => {
        // Hide Y-axis translation handle by checking name/userData
        if (child.name?.includes('Y') || child.userData?.axis === 'Y') {
          child.visible = false
        }
      })
    }
  }, [])
  
  return (
    <group>
      {/* Invisible object that TransformControls attaches to */}
      <group 
        ref={objectRef}
        position={[fixture.position.x, fixture.position.y, fixture.position.z]}
      />
      
      {/* 🪜 WAVE 1036: showY={false} restricts to XZ plane movement */}
      <TransformControls
        ref={transformRef}
        object={objectRef.current || undefined}
        mode="translate"
        size={0.8}
        translationSnap={snapEnabled ? snapDistance : null}
        rotationSnap={snapEnabled ? snapRotation : null}
        showY={false}
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
// WAVE 369.6: Receives selectedIds as ARRAY prop to fix R3F reactivity
// 🔓 WAVE 1036.2: UNLOCKED - Direct fixtures prop for full reactivity
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
  fixtures: FixtureV2[]  // 🔓 WAVE 1036.2: Direct fixtures for immediate reactivity
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
  fixtures  // 🔓 WAVE 1036.2: Direct fixtures prop
}) => {
  // 🔓 WAVE 1036.2: No transformation needed - use fixtures directly
  // Full reactivity: changes in position/height/rotation are immediately visible
  
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
    ? fixtures.find((f: FixtureV2) => f.id === selectedIdsArray[0])
    : null
  
  // WAVE 369: Handle gizmo dragging change
  const handleGizmoDraggingChanged = useCallback((isDragging: boolean) => {
    setIsGizmoActive(isDragging)
    onInteractionChange(isDragging)
  }, [onInteractionChange])
  
  // WAVE 369: Handle position change with auto-zoning
  // 🔥 WAVE 1042: Manejo de movimiento con normalización
  const handlePositionChangeWithZone = useCallback((id: string, position: Position3D, newZone: FixtureZone | null) => {
    updateFixturePosition(id, position)
    
    // Si el gizmo reporta una zona (aunque sea legacy), la normalizamos y aplicamos
    if (newZone) {
      // Obtenemos el tipo del fixture para determinar si es mover
      const fixture = useStageStore.getState().fixtures.find(f => f.id === id)
      const typeHint = fixture?.type || 'par'
      const cleanZone = normalizeZone(newZone, position.x, position.z, typeHint)
      
      setFixtureZone(id, cleanZone)
      console.log(`[StageGrid3D] 🗺️ Moved & Normalized: ${newZone} → ${cleanZone}`)
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
      {fixtures.map((fixture: FixtureV2) => (
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
  
  // 🔓 WAVE 1036.2: FULL REACTIVITY - Direct fixture subscription
  // No memoization - we WANT to see position/height changes immediately
  const fixtures = useStageStore(state => state.fixtures)
  
  // Keep a reference for box selection raycasting (non-reactive read)
  const fixturesRef = useRef(fixtures)
  useEffect(() => {
    fixturesRef.current = fixtures
  }, [fixtures])
  
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const deselectAll = useSelectionStore(state => state.deselectAll)  // 🪜 WAVE 1036
  
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
  
  // 🪜 WAVE 1036: Context Menu state for height management
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    fixtureId: string
  } | null>(null)
  
  // 🪜 WAVE 1036: Get fixture update function
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
  const updateFixture = useStageStore(state => state.updateFixture)
  
  // WAVE 368.5: Camera ready callback - WAVE 378.5: Log removed (one-time but noisy)
  const handleCameraReady = useCallback((camera: THREE.Camera) => {
    cameraRef.current = camera
  }, [])
  
  // WAVE 369: Handle gizmo interaction change - WAVE 378.5: Logs removed
  const handleInteractionChange = useCallback((isInteracting: boolean) => {
    setIsGizmoInteracting(isInteracting)
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🪜 WAVE 1036: CONTEXT MENU - Height Management
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    
    // Find if click is on a fixture by checking selection
    if (selectedIds.size === 1) {
      const fixtureId = [...selectedIds][0]
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        fixtureId
      })
    }
  }, [selectedIds])
  
  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])
  
  // Send fixture to specific height
  const sendFixtureToHeight = useCallback((height: number, invertTilt: boolean = false) => {
    if (!contextMenu) return
    
    const fixture = fixturesRef.current.find((f: FixtureV2) => f.id === contextMenu.fixtureId)
    if (!fixture) return
    
    // Update position with new Y
    const newPosition = { ...fixture.position, y: height }
    updateFixturePosition(contextMenu.fixtureId, newPosition)
    
    // If going to ceiling, auto-invert tilt
    if (invertTilt && fixture.physics) {
      updateFixture(contextMenu.fixtureId, {
        physics: {
          ...fixture.physics,
          invertTilt: true,
          orientation: 'ceiling' as const
        }
      })
    } else if (height === 0 && fixture.physics) {
      // Reset tilt inversion when going to floor
      updateFixture(contextMenu.fixtureId, {
        physics: {
          ...fixture.physics,
          invertTilt: false,
          orientation: 'floor' as const
        }
      })
    }
    
    closeContextMenu()
    console.log(`[StageGrid3D] 🪜 Fixture "${fixture.name}" sent to Y=${height}m ${invertTilt ? '(tilt inverted)' : ''}`)
  }, [contextMenu, updateFixturePosition, updateFixture, closeContextMenu])
  
  // 🪜 WAVE 1036: FLIP Left/Right (mirror X axis)
  const flipLeftRight = useCallback(() => {
    if (!contextMenu) return
    
    const fixture = fixturesRef.current.find((f: FixtureV2) => f.id === contextMenu.fixtureId)
    if (!fixture) return
    
    // Flip X position
    const newPosition = { ...fixture.position, x: -fixture.position.x }
    updateFixturePosition(contextMenu.fixtureId, newPosition)
    
    // Auto-recalculate zone based on new position
    const newZone = getZoneAtPosition(newPosition.x, newPosition.z)
    if (newZone) {
      setFixtureZone(contextMenu.fixtureId, newZone)
    }
    
    closeContextMenu()
    console.log(`[StageGrid3D] 🔄 Fixture "${fixture.name}" flipped L/R to X=${newPosition.x}`)
  }, [contextMenu, updateFixturePosition, setFixtureZone, closeContextMenu])
  
  // 🪜 WAVE 1036: FLIP Front/Back (mirror Z axis)
  const flipFrontBack = useCallback(() => {
    if (!contextMenu) return
    
    const fixture = fixturesRef.current.find((f: FixtureV2) => f.id === contextMenu.fixtureId)
    if (!fixture) return
    
    // Flip Z position
    const newPosition = { ...fixture.position, z: -fixture.position.z }
    updateFixturePosition(contextMenu.fixtureId, newPosition)
    
    // Auto-recalculate zone based on new position
    const newZone = getZoneAtPosition(newPosition.x, newPosition.z)
    if (newZone) {
      setFixtureZone(contextMenu.fixtureId, newZone)
    }
    
    closeContextMenu()
    console.log(`[StageGrid3D] 🔄 Fixture "${fixture.name}" flipped F/B to Z=${newPosition.z}`)
  }, [contextMenu, updateFixturePosition, setFixtureZone, closeContextMenu])
  
  // 🪜 WAVE 1036: DELETE fixture
  const removeFixture = useStageStore(state => state.removeFixture)
  const deleteFixture = useCallback(() => {
    if (!contextMenu) return
    
    const fixture = fixturesRef.current.find((f: FixtureV2) => f.id === contextMenu.fixtureId)
    if (!fixture) return
    
    // Deselect before removing
    deselectAll()
    removeFixture(contextMenu.fixtureId)
    
    closeContextMenu()
    console.log(`[StageGrid3D] 🗑️ Fixture "${fixture.name}" deleted`)
  }, [contextMenu, removeFixture, deselectAll, closeContextMenu])
  
  // 🪜 WAVE 1036: EDIT fixture (open modal)
  const { openFixtureForge } = useConstructorContext()
  const editFixture = useCallback(() => {
    if (!contextMenu) return
    
    openFixtureForge(contextMenu.fixtureId)
    closeContextMenu()
  }, [contextMenu, openFixtureForge, closeContextMenu])
  
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
  // 🔥 WAVE 384: CONSTRUCTOR RESURRECTION - REAL DROP WITH FULL DATA
  // "Cuando arrastres un foco, el objeto en memoria debe ser IDÉNTICO al de la librería"
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDrop = useCallback(async (e: React.DragEvent) => {
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
    
    // 🔥 WAVE 1042.1: DEBUG + FIX - Normalizar DESPUÉS de conocer el tipo real
    console.log(`[StageGrid3D] 📍 Drop position: (${worldX.toFixed(2)}, ${worldZ.toFixed(2)}), fixtureType from drag: "${fixtureType}"`)
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 384: LOAD FULL FIXTURE DEFINITION FROM LIBRARY
    // "Ni un byte menos" - Esta es la resurrección del Constructor
    // ═══════════════════════════════════════════════════════════════════════
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1
    
    // Variable para el tipo REAL (se actualiza si cargamos definición)
    let realType = fixtureType
    
    // Try to load the FULL definition from library
    let fixtureData: Partial<FixtureV2> = {
      type: fixtureType as FixtureV2['type'],
      position: { x: worldX, y: 0, z: worldZ },
      zone: 'unassigned' as FixtureZone  // Placeholder, se normaliza después
    }
    
    if (libraryId && window.lux?.getFixtureDefinition) {
      try {
        console.log(`[StageGrid3D] 🔥 Loading definition for "${libraryId}"...`)
        const result = await window.lux.getFixtureDefinition(libraryId)
        
        if (result.success && result.definition) {
          const def = result.definition as any  // 🔥 WAVE 1042.1: Allow access to physics field
          console.log(`[StageGrid3D] ✅ Got definition: ${def.name} (${def.channelCount}ch, physics.motor: ${def.physics?.motorType || 'none'})`)
          
          // INJECT ALL THE DATA! This is the key fix.
          fixtureData = {
            ...fixtureData,
            name: def.name,
            model: def.name,
            manufacturer: def.manufacturer,
            type: mapLibraryTypeToFixtureType(def.type),
            channelCount: def.channelCount,
            profileId: libraryId,
            definitionPath: def.filePath,
            // 🔥 WAVE 384: Store channels inline for persistence
            channels: def.channels,
            // 🔥 WAVE 1042.1: COPY PHYSICS FROM DEFINITION!
            physics: def.physics ? {
              motorType: def.physics.motorType || 'unknown',
              maxAcceleration: def.physics.maxAcceleration || 2000,
              maxVelocity: def.physics.maxVelocity || 400,
              safetyCap: def.physics.safetyCap ?? true,
              orientation: def.physics.orientation || 'floor',
              invertPan: def.physics.invertPan ?? false,
              invertTilt: def.physics.invertTilt ?? false,
              swapPanTilt: def.physics.swapPanTilt ?? false,
              homePosition: def.physics.homePosition || { pan: 127, tilt: 127 },
              tiltLimits: def.physics.tiltLimits || { min: 0, max: 270 }
            } : undefined,
            // Store capabilities for rendering decisions
            // 🔥 WAVE 1042.1: Include full capabilities with colorEngine and colorWheel
            capabilities: {
              hasMovementChannels: def.hasMovementChannels,
              has16bitMovement: def.has16bitMovement,
              hasColorMixing: def.hasColorMixing,
              hasColorWheel: def.hasColorWheel,
              colorEngine: def.capabilities?.colorEngine,
              colorWheel: def.capabilities?.colorWheel
            }
          }
        } else {
          console.warn(`[StageGrid3D] ⚠️ Definition not found for "${libraryId}", using generic`)
        }
      } catch (err) {
        console.error(`[StageGrid3D] ❌ Error loading definition:`, err)
      }
    } else if (libraryId) {
      console.warn(`[StageGrid3D] ⚠️ No getFixtureDefinition API, falling back to generic`)
    }
    
    // 🔥 WAVE 1042.1: NORMALIZAR ZONA AL FINAL, con el tipo REAL conocido
    const finalType = fixtureData.type || fixtureType
    const cleanZone = normalizeZone('unassigned', worldX, worldZ, finalType)
    fixtureData.zone = cleanZone
    
    console.log(`[StageGrid3D] 🎯 Zone normalization: type="${finalType}", pos=(${worldX.toFixed(2)}, ${worldZ.toFixed(2)}) → zone="${cleanZone}"`)
    console.log(`[StageGrid3D] 📦 fixtureData BEFORE createDefaultFixture:`, JSON.stringify({
      zone: fixtureData.zone,
      physics: fixtureData.physics ? { motorType: fixtureData.physics.motorType } : 'undefined'
    }))
    
    const newFixture = createDefaultFixture(fixtureId, nextAddress, fixtureData)
    
    console.log(`[StageGrid3D] 📦 newFixture AFTER createDefaultFixture:`, JSON.stringify({
      zone: newFixture.zone,
      physics: newFixture.physics ? { motorType: newFixture.physics.motorType } : 'undefined'
    }))
    
    addFixture(newFixture)
    setDraggedFixtureType(null)
    
    console.log(`[StageGrid3D] ✅ Dropped: ${newFixture.name} → Zone: ${cleanZone}`)
  }, [addFixture, setDraggedFixtureType])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])
  
  // Handler for drops from inside R3F (proper raycast)
  // 🔥 WAVE 384: Also make this async and load definition
  // 🔥 WAVE 1042.1: Normalizar zona AL FINAL
  const handleFixtureDrop = useCallback(async (type: string, position: Position3D, libraryId?: string) => {
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1
    
    let fixtureData: Partial<FixtureV2> = {
      type: type as FixtureV2['type'],
      position,
      zone: 'unassigned' as FixtureZone  // Placeholder, se normaliza después
    }
    
    // Load full definition if we have libraryId
    if (libraryId && window.lux?.getFixtureDefinition) {
      try {
        const result = await window.lux.getFixtureDefinition(libraryId)
        if (result.success && result.definition) {
          const def = result.definition
          fixtureData = {
            ...fixtureData,
            name: def.name,
            model: def.name,
            manufacturer: def.manufacturer,
            type: mapLibraryTypeToFixtureType(def.type),
            channelCount: def.channelCount,
            profileId: libraryId,
            definitionPath: def.filePath,
            channels: def.channels,
            // 🔥 WAVE 1042.1: COPY PHYSICS FROM DEFINITION (R3F drop)
            physics: def.physics ? {
              motorType: (def.physics.motorType || 'unknown') as MotorType,
              maxAcceleration: def.physics.maxAcceleration || 2000,
              maxVelocity: def.physics.maxVelocity || 400,
              safetyCap: def.physics.safetyCap ?? true,
              orientation: (['ceiling', 'floor', 'wall-left', 'wall-right', 'truss-front', 'truss-back'].includes(def.physics.orientation || '') 
                ? def.physics.orientation 
                : 'floor') as 'ceiling' | 'floor' | 'wall-left' | 'wall-right' | 'truss-front' | 'truss-back',
              invertPan: def.physics.invertPan ?? false,
              invertTilt: def.physics.invertTilt ?? false,
              swapPanTilt: def.physics.swapPanTilt ?? false,
              homePosition: def.physics.homePosition || { pan: 127, tilt: 127 },
              tiltLimits: def.physics.tiltLimits || { min: 0, max: 270 }
            } : undefined,
            // 🔥 WAVE 1042.1: Include full capabilities with colorEngine and colorWheel
            capabilities: {
              hasMovementChannels: def.hasMovementChannels,
              has16bitMovement: def.has16bitMovement,
              hasColorMixing: def.hasColorMixing,
              hasColorWheel: def.hasColorWheel,
              colorEngine: def.capabilities?.colorEngine,
              colorWheel: def.capabilities?.colorWheel
            }
          }
        }
      } catch (err) {
        console.error('[StageGrid3D] Error loading definition for R3F drop:', err)
      }
    }
    
    // 🔥 WAVE 1042.1: NORMALIZAR ZONA AL FINAL, con el tipo REAL conocido
    const finalType = fixtureData.type || type
    const cleanZone = normalizeZone('unassigned', position.x, position.z, finalType)
    fixtureData.zone = cleanZone
    
    const newFixture = createDefaultFixture(fixtureId, nextAddress, fixtureData)
    addFixture(newFixture)
    
    console.log(`[StageGrid3D] ✅ R3F Drop: ${newFixture.name} → Zone: ${cleanZone}`)
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
      onContextMenu={handleContextMenu}
      onClick={closeContextMenu}
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
          fixtures={fixtures}
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
      
      {/* 🪜 WAVE 1036: Context Menu - THE ULTIMATE MENU */}
      {contextMenu && (
        <div 
          className="fixture-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ═══════ SECTION: HEIGHT (The Elevator) ═══════ */}
          <div className="context-menu-title">🪜 ALTURA</div>
          <button 
            className="context-menu-item"
            onClick={() => sendFixtureToHeight(0, false)}
          >
            <span className="icon">🟢</span>
            <span>FLOOR</span>
            <span className="hint">0m</span>
          </button>
          <button 
            className="context-menu-item"
            onClick={() => sendFixtureToHeight(1.5, false)}
          >
            <span className="icon">🟡</span>
            <span>MID</span>
            <span className="hint">1.5m</span>
          </button>
          <button 
            className="context-menu-item"
            onClick={() => sendFixtureToHeight(3.5, true)}
          >
            <span className="icon">🔴</span>
            <span>CEILING</span>
            <span className="hint">3.5m + ↻</span>
          </button>
          
          {/* ═══════ SECTION: SMART MOVES (Teleport) ═══════ */}
          <div className="context-menu-divider" />
          <div className="context-menu-title">🔄 FLIP</div>
          <button 
            className="context-menu-item"
            onClick={flipLeftRight}
          >
            <span className="icon">↔️</span>
            <span>FLIP L/R</span>
            <span className="hint">x = -x</span>
          </button>
          <button 
            className="context-menu-item"
            onClick={flipFrontBack}
          >
            <span className="icon">↕️</span>
            <span>FLIP F/B</span>
            <span className="hint">z = -z</span>
          </button>
          
          {/* ═══════ SECTION: CRUD ═══════ */}
          <div className="context-menu-divider" />
          <button 
            className="context-menu-item"
            onClick={editFixture}
          >
            <span className="icon">✏️</span>
            <span>EDIT</span>
            <span className="hint">Propiedades</span>
          </button>
          <button 
            className="context-menu-item context-menu-danger"
            onClick={deleteFixture}
          >
            <span className="icon">🗑️</span>
            <span>DELETE</span>
            <span className="hint">Eliminar</span>
          </button>
          
          <div className="context-menu-divider" />
          <button 
            className="context-menu-item context-menu-cancel"
            onClick={closeContextMenu}
          >
            ✕ Cancelar
          </button>
        </div>
      )}
      
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
        
        /* 🌊 WAVE 1035: Stereo zone indicator */
        .label-zone {
          color: #a855f7;
          font-size: 9px;
          font-weight: 500;
          margin-top: 2px;
          padding: 1px 4px;
          background: rgba(168, 85, 247, 0.2);
          border-radius: 2px;
        }
        
        /* 🪜 WAVE 1036: Context Menu Styles */
        .fixture-context-menu {
          position: fixed;
          z-index: 1000;
          min-width: 180px;
          background: rgba(15, 15, 25, 0.98);
          border: 1px solid rgba(168, 85, 247, 0.5);
          border-radius: 8px;
          padding: 4px 0;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
        }
        
        .context-menu-title {
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 4px;
        }
        
        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: white;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }
        
        .context-menu-item:hover {
          background: rgba(168, 85, 247, 0.3);
        }
        
        .context-menu-item .icon {
          font-size: 14px;
        }
        
        .context-menu-item .hint {
          margin-left: auto;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
        }
        
        .context-menu-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 4px 0;
        }
        
        .context-menu-cancel {
          color: rgba(255, 255, 255, 0.5);
          justify-content: center;
        }
        
        .context-menu-cancel:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        /* 🪜 WAVE 1036: Danger button (DELETE) */
        .context-menu-danger {
          color: #ef4444;
        }
        
        .context-menu-danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }
        
        .context-menu-danger .hint {
          color: rgba(239, 68, 68, 0.6);
        }
      `}</style>
    </div>
  )
}

export default StageGrid3D
