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
  OrthographicCamera,
  OrbitControls,
  TransformControls, 
  Html,
  Text
} from '@react-three/drei'
import { useStageStore, selectFixtures } from '../../../stores/stageStore'
import { useSelectionStore, useSelectedArray } from '../../../stores/selectionStore'
import { useConstructorContext } from '../StageConstructorView'
import { createDefaultFixture, mapLibraryTypeToFixtureType, MotorType, clampToCrystalBox, snapPosition } from '../../../core/stage/ShowFileV2'
import type { FixtureV2, Position3D, FixtureZone, StageDimensions } from '../../../core/stage/ShowFileV2'
// ZoneOverlay eliminado — WAVE 4543: zonas son metadatos puros, no recintos físicos
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
// 🧱 WAVE 4538/4540: FIXTURE BLOCK — true 3D voxel representation
// ═══════════════════════════════════════════════════════════════════════════

const FIXTURE_TYPE_COLOR: Record<string, string> = {
  'moving-head': '#a855f7',
  'par':         '#4ade80',
  'wash':        '#3b82f6',
  'strobe':      '#ef4444',
  'laser':       '#f97316',
  'blinder':     '#fbbf24',
}

interface FixtureBlockProps {
  fixture: FixtureV2
  isSelected: boolean
  isHovered: boolean
  onSelect: (id: string, event: ThreeEvent<MouseEvent>) => void
  onHover: (id: string | null) => void
  onDoubleClick: (id: string) => void
  showDropLines: boolean
  /** WAVE 4545: posición temporal durante drag del gizmo */
  livePos?: Position3D | null
}

const FixtureBlock: React.FC<FixtureBlockProps> = ({
  fixture,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onDoubleClick,
  showDropLines,
  livePos
}) => {
  // WAVE 4545: durante drag, usar livePos para que el HoloCrosshair sea fluido
  const { x, y, z } = livePos ?? fixture.position
  const typeColor = FIXTURE_TYPE_COLOR[fixture.type] ?? '#6b7280'
  const color = isSelected ? '#22d3ee' : isHovered ? '#fbbf24' : typeColor
  // Bloque centrado en su Y real — el fixture vive EN su posición 3D real
  const blockY = y + 0.05    // semi-altura del cilindro (0.1 / 2)
  const hasHeight = y > 0.01

  const dropLine = useMemo(() => {
    if (!hasHeight) return null
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x, 0, z),
    ])
    const mat = new THREE.LineBasicMaterial({ color: typeColor, opacity: 0.4, transparent: true })
    return new THREE.Line(geo, mat)
  }, [x, y, z, hasHeight, typeColor])

  return (
    <group>
      {/* Volumen principal — cilindro 0.08r×0.1h: cabe holgado en voxel 0.25m */}
      <mesh
        position={[x, blockY, z]}
        userData={{ fixtureId: fixture.id }}
        onClick={(e) => { e.stopPropagation(); onSelect(fixture.id, e) }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(fixture.id) }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(fixture.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = 'default' }}
      >
        <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Selection ring — torus flotante al level del bloque */}
      {(isSelected || isHovered) && (
        <mesh position={[x, blockY, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.11, 0.15, 24]} />
          <meshBasicMaterial color={color} opacity={0.9} transparent />
        </mesh>
      )}

      {/* Label — solo visible en hover/selección para no saturar la escena */}
      {(isSelected || isHovered) && (
        <Html
          position={[x, y + 0.4, z]}
          zIndexRange={[0, 10]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="fixture-label-25d">
            <span className="label-name">{fixture.name}</span>
            <span className="label-height">{y.toFixed(2)}m</span>
          </div>
        </Html>
      )}

      {/* HoloCrosshair de selección — sólo cuando está seleccionado */}
      {isSelected && (
        <HoloCrosshair x={x} y={y} z={z} />
      )}

      {/* Drop line hasta Y=0 + anillo en el suelo cuando está elevado */}
      {hasHeight && dropLine && showDropLines && (
        <>
          <primitive object={dropLine} />
          <mesh position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.09, 0.13, 14]} />
            <meshBasicMaterial color={typeColor} opacity={0.5} transparent />
          </mesh>
        </>
      )}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧱 WAVE 4538/4540: VOXEL FLOOR GRID — 3 capas arquitectónicas en Y=0
// ═══════════════════════════════════════════════════════════════════════════

const VoxelFloorGrid: React.FC = () => {
  const fineRef = useRef<THREE.GridHelper>(null)

  useFrame(({ camera }) => {
    if (fineRef.current) {
      const zoom = (camera as THREE.OrthographicCamera).zoom ?? 60
      fineRef.current.visible = zoom >= 40
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Capa gruesa 5m */}
      <gridHelper args={[200, 40, '#2a2a44', '#2a2a44']} />
      {/* Capa media 1m */}
      <gridHelper args={[200, 200, '#1a1a2e', '#1a1a2e']} />
      {/* Capa fina 0.25m — oculta a zoom bajo para evitar Moiré */}
      <primitive object={new THREE.GridHelper(200, 800, 0x12121f, 0x12121f)} ref={fineRef} />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧱 WAVE 4538/4540: CRYSTAL BOX — wireframe completo del volumen edificable
// ═══════════════════════════════════════════════════════════════════════════

const CrystalBox: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const width  = stage?.width  ?? 12
  const depth  = stage?.depth  ??  8
  const height = stage?.height ??  6

  const edgesGeo = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth)),
    [width, depth, height]
  )

  return (
    <group position={[0, height / 2, 0]}>
      {/* Bordes níon cyan — el wireframe de alta precisión */}
      <lineSegments geometry={edgesGeo}>
        <lineBasicMaterial color="#22d3ee" opacity={0.55} transparent />
      </lineSegments>
      {/* Volumen de cristal Tron — tinte azul interior, BackSide para no tapar nada */}
      {/* raycast={() => null} → invisible al raycaster de R3F, el GhostCursor llega limpio al plano del suelo */}
      <mesh raycast={() => null}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.05}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧱 WAVE 4538/4540: CRYSTAL BOX RULERS — etiquetas 3D en los 3 ejes
// ═══════════════════════════════════════════════════════════════════════════

const CrystalBoxRulers: React.FC = () => {
  const stage = useStageStore(state => state.stage)
  const width = stage?.width ?? 12
  const depth = stage?.depth ?? 8
  const height = stage?.height ?? 6
  const halfW = width / 2
  const halfD = depth / 2

  const [visible, setVisible] = useState(true)
  useFrame(({ camera }) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom ?? 60
    const shouldShow = zoom >= 28
    if (shouldShow !== visible) setVisible(shouldShow)
  })

  // X: borde frontal del suelo (Z = +halfD), de -halfW a +halfW a 1m de paso
  const xTicks = useMemo(() =>
    Array.from({ length: Math.floor(width) + 1 }, (_, i) => Math.round(-halfW) + i),
    [width, halfW]
  )
  // Z: borde izquierdo del suelo (X = -halfW), de -halfD a +halfD a 1m de paso
  const zTicks = useMemo(() =>
    Array.from({ length: Math.floor(depth) + 1 }, (_, i) => Math.round(-halfD) + i),
    [depth, halfD]
  )
  // Y: arista vertical frontal-izquierda (X=-halfW, Z=+halfD), de 0 a height a 1m de paso
  const yTicks = useMemo(() =>
    Array.from({ length: Math.floor(height) + 1 }, (_, i) => i),
    [height]
  )

  if (!visible) return null

  return (
    <>
      {/* Eje X — borde frontal, color cyan. rotation Z:PI corrige espejo */}
      {xTicks.map(x => (
        <Text
          key={`rx${x}`}
          position={[x, 0.05, halfD + 0.75]}
          fontSize={0.3}
          color="#22d3ee"
          fillOpacity={0.6}
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, Math.PI]}
        >
          {`${x}m`}
        </Text>
      ))}
      {/* Eje Z — borde izquierdo, color cyan. rotation Z:PI/2 orienta hacia cámara */}
      {zTicks.map(z => (
        <Text
          key={`rz${z}`}
          position={[-(halfW + 0.75), 0.05, z]}
          fontSize={0.3}
          color="#22d3ee"
          fillOpacity={0.6}
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          {`${z}m`}
        </Text>
      ))}
      {/* Eje Y — arista vertical frontal-izquierda, color verde */}
      {yTicks.map(yVal => (
        <Text
          key={`ry${yVal}`}
          position={[-(halfW + 0.75), yVal, halfD + 0.1]}
          fontSize={0.3}
          color="#4ade80"
          fillOpacity={0.75}
          anchorX="right"
          anchorY="middle"
        >
          {`${yVal}m`}
        </Text>
      ))}
    </>
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
  /** WAVE 4545: callback para posición temporal durante drag, via ref */
  onDragPos: (pos: Position3D | null) => void
}

const TransformGizmo: React.FC<TransformGizmoProps> = ({ 
  fixture, 
  onPositionChange,
  snapEnabled,
  snapDistance,
  snapRotation,
  onDraggingChanged,
  onDragPos
}) => {
  const transformRef = useRef<any>(null)
  const objectRef = useRef<THREE.Group>(null!)
  const [currentZone, setCurrentZone] = useState<FixtureZone | null>(null)
  
  // Track zone while dragging — WAVE 4543: zones are pure metadata, no spatial detection
  useFrame(() => {
    if (objectRef.current && transformRef.current?.dragging) {
      if (currentZone !== null) setCurrentZone(null)
    }
  })
  
  // Stage ref para clamp al Crystal Box
  const stage = useStageStore(state => state.stage)

  // Handle dragging state change - WAVE 369 + WAVE 4538 clamp
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    
    const handleDraggingChanged = (event: { value: boolean }) => {
      onDraggingChanged(event.value)
      
      // On drag end: clamp al Crystal Box y reportar posición final
      if (!event.value && objectRef.current) {
        const pos = objectRef.current.position
        const rawPos: Position3D = {
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
          z: Math.round(pos.z * 100) / 100,
        }
        // 🧱 WAVE 4538: clamp dentro del Crystal Box
        const finalPos = stage
          ? clampToCrystalBox(rawPos, stage as StageDimensions)
          : rawPos
        // Sincronizar objeto 3D con la posición clampada
        objectRef.current.position.set(finalPos.x, finalPos.y, finalPos.z)
        onPositionChange(fixture.id, finalPos, null)
      }
    }
    
    // WAVE 4545: objectChange se dispara cada frame durante el drag
    const handleObjectChange = () => {
      if (objectRef.current && transformRef.current?.dragging) {
        const p = objectRef.current.position
        onDragPos({ x: p.x, y: p.y, z: p.z })
      }
    }

    controls.addEventListener('dragging-changed', handleDraggingChanged)
    controls.addEventListener('objectChange', handleObjectChange)
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged)
      controls.removeEventListener('objectChange', handleObjectChange)
    }
  }, [fixture.id, onPositionChange, onDraggingChanged, onDragPos, stage])
  
  return (
    <group>
      {/* Invisible object that TransformControls attaches to */}
      <group 
        ref={objectRef}
        position={[fixture.position.x, fixture.position.y, fixture.position.z]}
      />
      
      {/* � WAVE 4538: showY={true} — movimiento libre en los 3 ejes */}
      <TransformControls
        ref={transformRef}
        object={objectRef.current || undefined}
        mode="translate"
        size={0.8}
        translationSnap={0.25}
        rotationSnap={snapEnabled ? snapRotation : null}
        showY={true}
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

// (GridFloor25D eliminado — reemplazado por VoxelFloorGrid en WAVE 4538/4540)
// (StageOutline eliminado — reemplazado por CrystalBox en WAVE 4538/4540)
// (VoxelGrid3D eliminado — WAVE 4544: causaba Moiré, sin valor visual)

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
  isBoxSelectMode: boolean
  onInteractionChange: (isInteracting: boolean) => void
  selectedIdsArray: string[]
  fixtures: FixtureV2[]
  onFixtureDoubleClick: (id: string) => void
  showCrystalBox: boolean
  showFloorGrid: boolean
  showDropLines: boolean
  /** WAVE 4541: true cuando hay algo siendo arrastrado hacia el canvas */
  isDragging: boolean
  /** WAVE 4541: ref al que GhostCursor escribe la posición validada */
  ghostPosRef: React.MutableRefObject<Position3D | null>
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
  fixtures,
  onFixtureDoubleClick,
  showCrystalBox,
  showFloorGrid,
  showDropLines,
  isDragging,
  ghostPosRef
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

  // WAVE 4545: posición temporal del gizmo durante drag — ref para evitar re-renders de escena
  const gizmoDragPosRef = useRef<Position3D | null>(null)
  const [gizmoDragPos, setGizmoDragPos] = useState<Position3D | null>(null)
  const handleGizmoDragPos = useCallback((pos: Position3D | null) => {
    gizmoDragPosRef.current = pos
    setGizmoDragPos(pos)   // dispara re-render solo de FixtureBlock seleccionado
  }, [])
  
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
    // WAVE 4545: al soltar, limpiar posición temporal para volver al store
    if (!isDragging) handleGizmoDragPos(null)
  }, [onInteractionChange, handleGizmoDragPos])
  
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
      {/* 🏗️ WAVE 4537: Isometric orthographic camera */}
      <OrthographicCamera
        makeDefault
        position={[50, 50, 50]}
        zoom={40}
        near={0.1}
        far={500}
      />

      {/* 🏗️ WAVE 4537: OrbitControls — pan, zoom & free rotation, no sub-floor */}
      <OrbitControls
        makeDefault
        enabled={cameraEnabled}
        maxPolarAngle={Math.PI / 2 - 0.05}
        screenSpacePanning={true}
        minZoom={10}
        maxZoom={300}
        dampingFactor={0.1}
        enableDamping
      />
      
      {/* 🏗️ WAVE 4532: Flat-earth — single ambient light sufficient for unlit materials */}
      <ambientLight intensity={1} />
      
      {/* 🧱 WAVE 4538: Voxel floor grid — 3 capas */}
      {showFloorGrid && <VoxelFloorGrid />}

      {/* 🧱 WAVE 4538: Crystal Box wireframe (volumen edificable) */}
      {showCrystalBox && <CrystalBox />}

      {/* 🧱 WAVE 4538: Reglas 3D — X/Z en suelo, Y en arista vertical */}
      <CrystalBoxRulers />

      {/* Floor plane (for click-to-deselect) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onClick={handleBackgroundClick}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      
      {/* ZoneOverlay eliminado — WAVE 4543: zonas son metadatos puros */}
      
      {/* 🧱 WAVE 4538: Fixtures como bloques 3D en su Y real */}
      {fixtures.map((fixture: FixtureV2) => {
        const isSelected = selectedIds.has(fixture.id)
        // WAVE 4545: si este fixture está siendo arrastrado, usar su posición temporal
        const livePos = isSelected && gizmoDragPos ? gizmoDragPos : null
        return (
          <FixtureBlock
            key={fixture.id}
            fixture={fixture}
            isSelected={isSelected}
            isHovered={hoveredId === fixture.id}
            onSelect={handleSelect}
            onHover={handleHover}
            onDoubleClick={onFixtureDoubleClick}
            showDropLines={showDropLines}
            livePos={livePos}
          />
        )
      })}
      
      {/* WAVE 369: Transform Gizmo - WITH SNAP + INTERACTION LOCK + AUTO-ZONE */}
      {selectedFixture && (
        <TransformGizmo
          fixture={selectedFixture}
          onPositionChange={handlePositionChangeWithZone}
          snapEnabled={snapEnabled}
          snapDistance={snapDistance}
          snapRotation={snapRotation}
          onDraggingChanged={handleGizmoDraggingChanged}
          onDragPos={handleGizmoDragPos}
        />
      )}

      {/* 🎯 WAVE 4541: Ghost Cursor — snap preview durante drag & drop */}
      <GhostCursor isDragging={isDragging} ghostPosRef={ghostPosRef} />
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

// ═══════════════════════════════════════════════════════════════════════════
// 🏗️ WAVE 4534: OFFSET PANEL — precise XYZ input (E12)
// ═══════════════════════════════════════════════════════════════════════════

interface OffsetPanelProps {
  fixtureId: string
  onClose: () => void
}

const OffsetPanel: React.FC<OffsetPanelProps> = ({ fixtureId, onClose }) => {
  const fixture = useStageStore(state => state.fixtures.find(f => f.id === fixtureId))
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)

  const [x, setX] = useState(fixture?.position.x ?? 0)
  const [y, setY] = useState(fixture?.position.y ?? 0)
  const [z, setZ] = useState(fixture?.position.z ?? 0)

  useEffect(() => {
    if (fixture) {
      setX(fixture.position.x)
      setY(fixture.position.y)
      setZ(fixture.position.z)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId])

  if (!fixture) return null

  const apply = () => {
    updateFixturePosition(fixtureId, snapPosition({ x, y, z }))
    onClose()
  }

  const axes = [
    { label: 'X', value: x, set: setX },
    { label: 'Y', value: y, set: setY },
    { label: 'Z', value: z, set: setZ },
  ] as { label: string; value: number; set: (v: number) => void }[]

  return (
    <div className="offset-panel" onClick={(e) => e.stopPropagation()}>
      <div className="offset-panel-header">
        <span>📐 Posición exacta</span>
        <span className="offset-fixture-name">{fixture.name}</span>
        <button className="offset-close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="offset-inputs">
        {axes.map(({ label, value, set }) => (
          <label key={label} className="offset-input-row">
            <span className={`offset-axis offset-axis-${label.toLowerCase()}`}>{label}</span>
            <input
              type="number"
              step="0.25"
              value={value}
              onChange={(e) => set(parseFloat(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
            />
            <span className="offset-unit">m</span>
          </label>
        ))}
      </div>
      <div className="offset-actions">
        <button className="offset-apply-btn" onClick={apply}>Aplicar</button>
        <button className="offset-cancel-btn" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WAVE 4541: GHOST CURSOR — voxel snap preview durante drag & drop
// Prioridad 1: Stacking (apila sobre FixtureBlock existente)
// Prioridad 2: Floor (plano Y=0)
// Color: verde=stack / cyan=floor / rojo=invalid
// ═══════════════════════════════════════════════════════════════════════════

type GhostMode = 'floor' | 'stack' | 'invalid'

const GHOST_COLOR: Record<GhostMode, string> = {
  floor:   '#22d3ee',
  stack:   '#4ade80',
  invalid: '#ef4444',
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WAVE 4544: HOLO-CROSSHAIR — láseres RGB Gizmo + targets de impacto en paredes
// ═══════════════════════════════════════════════════════════════════════════

interface HoloCrosshairProps {
  x: number
  y: number
  z: number
}

const HoloCrosshair: React.FC<HoloCrosshairProps> = ({ x, y, z }) => {
  const stage = useStageStore(state => state.stage)
  const halfW = (stage?.width  ?? 12) / 2
  const halfD = (stage?.depth  ??  8) / 2
  const height = stage?.height ??  6

  // Materiales Additive — efecto neón sin opacidad acumulada
  const matY = useMemo(() => new THREE.LineBasicMaterial({
    color: '#4ade80', opacity: 0.7, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }), [])
  const matX = useMemo(() => new THREE.LineBasicMaterial({
    color: '#ef4444', opacity: 0.7, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }), [])
  const matZ = useMemo(() => new THREE.LineBasicMaterial({
    color: '#3b82f6', opacity: 0.7, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false
  }), [])

  const matTargetY = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#4ade80', opacity: 0.8, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }), [])
  const matTargetX = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ef4444', opacity: 0.8, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }), [])
  const matTargetZ = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#3b82f6', opacity: 0.8, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }), [])

  const { lineY, lineX, lineZ } = useMemo(() => {
    const mk = (pts: THREE.Vector3[], mat: THREE.LineBasicMaterial) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      return new THREE.Line(geo, mat)
    }
    return {
      lineY: mk([new THREE.Vector3(x, 0, z),      new THREE.Vector3(x, height, z)], matY),
      lineX: mk([new THREE.Vector3(-halfW, y, z),  new THREE.Vector3(halfW, y, z)], matX),
      lineZ: mk([new THREE.Vector3(x, y, -halfD),  new THREE.Vector3(x, y, halfD)], matZ),
    }
  }, [x, y, z, halfW, halfD, height, matY, matX, matZ])

  const ringArgs: [number, number, number] = [0.08, 0.15, 16]

  return (
    <group>
      {/* Láser Y — verde, eje vertical */}
      <primitive object={lineY} />
      {/* Target suelo Y */}
      <mesh position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} material={matTargetY}>
        <ringGeometry args={ringArgs} />
      </mesh>
      {/* Target techo Y */}
      <mesh position={[x, height - 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} material={matTargetY}>
        <ringGeometry args={ringArgs} />
      </mesh>

      {/* Láser X — rojo, eje horizontal */}
      <primitive object={lineX} />
      {/* Target pared izquierda X */}
      <mesh position={[-halfW + 0.01, y, z]} rotation={[0, Math.PI / 2, 0]} material={matTargetX}>
        <ringGeometry args={ringArgs} />
      </mesh>
      {/* Target pared derecha X */}
      <mesh position={[halfW - 0.01, y, z]} rotation={[0, Math.PI / 2, 0]} material={matTargetX}>
        <ringGeometry args={ringArgs} />
      </mesh>

      {/* Láser Z — azul, eje profundidad */}
      <primitive object={lineZ} />
      {/* Target pared fondo Z */}
      <mesh position={[x, y, -halfD + 0.01]} material={matTargetZ}>
        <ringGeometry args={ringArgs} />
      </mesh>
      {/* Target pared frente Z */}
      <mesh position={[x, y, halfD - 0.01]} material={matTargetZ}>
        <ringGeometry args={ringArgs} />
      </mesh>
    </group>
  )
}

interface GhostCursorProps {
  /** true sólo cuando hay algo siendo arrastrado hacia el canvas */
  isDragging: boolean
  /** Ref al que se escribe la posición validada (o null si invalid) */
  ghostPosRef: React.MutableRefObject<Position3D | null>
}

/** Vive DENTRO del Canvas — tiene acceso a useThree y useFrame */
const GhostCursor: React.FC<GhostCursorProps> = ({ isDragging, ghostPosRef }) => {
  const { camera, raycaster, pointer, scene } = useThree()
  const stage = useStageStore(state => state.stage)
  const fixtures = useStageStore(selectFixtures)

  // Estado visible del ghost — posición centrada en el voxel (Y = base + 0.125)
  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null)
  const [mode, setMode] = useState<GhostMode>('floor')

  // Plano Y=0 reutilizable (no recrear cada frame)
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const floorHit    = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {  
    if (!isDragging) {
      ghostPosRef.current = null
      if (ghostPos !== null) setGhostPos(null)
      return
    }

    raycaster.setFromCamera(pointer, camera)

    // ── Prioridad 1: stacking sobre FixtureBlock ─────────────────────────
    // Construye la lista de meshes que representan los FixtureBlocks (cilindros)
    const fixtureMeshes: THREE.Object3D[] = []
    scene.traverse((obj) => {
      if (obj.userData['fixtureId']) fixtureMeshes.push(obj)
    })

    let finalPos: Position3D | null = null
    let newMode: GhostMode = 'floor'

    if (fixtureMeshes.length > 0) {
      const hits = raycaster.intersectObjects(fixtureMeshes, true)
      if (hits.length > 0) {
        const hit = hits[0]
        const normal = hit.face?.normal
        if (normal) {
          const worldNormal = normal.clone().transformDirection(hit.object.matrixWorld)
          const fid = hit.object.userData['fixtureId'] ||
                      hit.object.parent?.userData['fixtureId']
          const srcFixture = fixtures.find(f => f.id === fid)
          const baseY = srcFixture?.position.y ?? 0

          let stackX = hit.point.x
          let stackY = baseY + 0.25   // encima del bloque (0.25m)
          let stackZ = hit.point.z

          // Ajustar X o Z según la normal (cara lateral)
          if (Math.abs(worldNormal.y) < 0.5) {
            // Normal horizontal → cara lateral
            stackX += worldNormal.x * 0.25
            stackZ += worldNormal.z * 0.25
            stackY = baseY  // mismo nivel
          }

          finalPos = { x: stackX, y: stackY, z: stackZ }
          newMode = 'stack'
        }
      }
    }

    // ── Prioridad 2: plano del suelo ─────────────────────────────────────
    if (!finalPos) {
      const didHit = raycaster.ray.intersectPlane(floorPlane, floorHit)
      if (didHit) {
        finalPos = { x: floorHit.x, y: 0, z: floorHit.z }
        newMode = 'floor'
      }
    }

    if (!finalPos) {
      // Rayo paralelo al suelo o fuera de escena
      ghostPosRef.current = null
      if (ghostPos !== null) setGhostPos(null)
      return
    }

    // ── Snap al grid voxel ────────────────────────────────────────────────
    const snapped = snapPosition(finalPos)

    // ── Clamp al Crystal Box ─────────────────────────────────────────────
    if (!stage) {
      ghostPosRef.current = null
      if (ghostPos !== null) setGhostPos(null)
      return
    }
    const clamped = clampToCrystalBox(snapped, stage as StageDimensions)

    // Si el clamp cambió la posición fuera del box, marcar invalid
    const isOutside = (
      Math.abs(clamped.x - snapped.x) > 0.001 ||
      Math.abs(clamped.y - snapped.y) > 0.001 ||
      Math.abs(clamped.z - snapped.z) > 0.001
    )
    if (isOutside) newMode = 'invalid'

    // ── Actualizar estado ────────────────────────────────────────────────
    ghostPosRef.current = newMode === 'invalid' ? null : clamped

    const displayY = clamped.y + 0.125  // centrado en el cubo visualizado
    if (
      !ghostPos ||
      Math.abs(ghostPos.x - clamped.x) > 0.001 ||
      Math.abs(ghostPos.y - displayY)  > 0.001 ||
      Math.abs(ghostPos.z - clamped.z) > 0.001
    ) {
      setGhostPos(new THREE.Vector3(clamped.x, displayY, clamped.z))
    }
    if (newMode !== mode) setMode(newMode)
  })

  if (!isDragging || !ghostPos) return null

  // La posición base real (sin el offset de display +0.05)
  const basePos = ghostPosRef.current

  return (
    <group>
      <mesh position={ghostPos}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshBasicMaterial
          color={GHOST_COLOR[mode]}
          wireframe
          opacity={0.85}
          transparent
        />
      </mesh>
      {/* HoloCrosshair anclado — solo cuando posición válida */}
      {basePos && mode !== 'invalid' && (
        <HoloCrosshair x={basePos.x} y={basePos.y} z={basePos.z} />
      )}
    </group>
  )
}

const StageGrid3D: React.FC = () => {
  // Get snap settings from parent context
  const { snapEnabled, snapDistance, snapRotation, draggedFixtureType, setDraggedFixtureType, toolMode, showZones, showCrystalBox, showFloorGrid, showDropLines } = useConstructorContext()
  const addFixture = useStageStore(state => state.addFixture)
  const setFixtureZone = useStageStore(state => state.setFixtureZone)
  const stage = useStageStore(state => state.stage)
  
  // 🎯 WAVE 4541: Ghost cursor position ref — la posición validada del ghost cursor
  // Vive aquí (fuera del Canvas) para que handleDrop la pueda leer
  const ghostPosRef = useRef<Position3D | null>(null)
  // isDragging: true cuando hay un fixture siendo arrastrado sobre el canvas
  const [isDragging, setIsDragging] = useState(false)

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
  
  // 🛡️ WAVE 2042.13.13: Fixed - Use stable hook + primitive selector
  const selectionVersion = useSelectionStore(state => state.selectedIds.size)
  const selectedIdsArray = useSelectedArray()
  
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
  
  // 🏗️ WAVE 4534: Offset panel state
  const [offsetPanelFixtureId, setOffsetPanelFixtureId] = useState<string | null>(null)

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
    
    // WAVE 4543: zones are pure metadata — no auto-assign on flip
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
    
    // WAVE 4543: zones are pure metadata — no auto-assign on flip
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

  // 🏗️ WAVE 4534 E11: ASSIGN ZONE MANUALLY
  const assignZoneManual = useCallback((zone: FixtureZone) => {
    if (!contextMenu) return
    const idsToUpdate = selectedIds.size > 1 ? [...selectedIds] : [contextMenu.fixtureId]
    idsToUpdate.forEach(id => setFixtureZone(id, zone))
    closeContextMenu()
  }, [contextMenu, selectedIds, setFixtureZone, closeContextMenu])

  // 🏗️ WAVE 4534 E12: OPEN OFFSET PANEL
  const handleOpenOffsetPanel = useCallback((id: string) => {
    setOffsetPanelFixtureId(id)
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
  // 🔥 WAVE 384 + 🎯 WAVE 4541: CONSTRUCTOR DROP — posición leída desde GhostCursor
  // ═══════════════════════════════════════════════════════════════════════════
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const fixtureType = e.dataTransfer.getData('fixture-type')
    const libraryId = e.dataTransfer.getData('library-fixture-id')

    if (!fixtureType) {
      console.warn('[StageGrid3D] Drop failed: no fixture type')
      return
    }

    // 🎯 WAVE 4541: Leer posición validada del GhostCursor
    // Si el ghost está en 'invalid' (null), abortar el drop
    const ghostPos = ghostPosRef.current
    if (!ghostPos) {
      console.warn('[StageGrid3D] Drop abortado: ghost en posición inválida o fuera del Crystal Box')
      setDraggedFixtureType(null)
      return
    }

    console.log(`[StageGrid3D] 📍 Drop en posición ghost: (${ghostPos.x}, ${ghostPos.y}, ${ghostPos.z}) | type: "${fixtureType}"`)

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 384: LOAD FULL FIXTURE DEFINITION FROM LIBRARY
    // ═══════════════════════════════════════════════════════════════════════
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1

    let fixtureData: Partial<FixtureV2> = {
      type: fixtureType as FixtureV2['type'],
      position: ghostPos,
      zone: 'unassigned' as FixtureZone,
    }

    if (libraryId && window.lux?.getFixtureDefinition) {
      try {
        console.log(`[StageGrid3D] 🔥 Loading definition for "${libraryId}"...`)
        const result = await window.lux.getFixtureDefinition(libraryId)

        if (result.success && result.definition) {
          const def = result.definition as any
          console.log(`[StageGrid3D] ✅ Got definition: ${def.name} (${def.channelCount}ch, physics.motor: ${def.physics?.motorType || 'none'})`)

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
              invertPan: false,  // 🛡️ WAVE 2093.2 (CW-AUDIT-4): Frozen — use calibration instead
              invertTilt: false, // 🛡️ WAVE 2093.2 (CW-AUDIT-4): Frozen — use calibration instead
              swapPanTilt: def.physics.swapPanTilt ?? false,
              homePosition: def.physics.homePosition || { pan: 127, tilt: 127 },
              tiltLimits: def.physics.tiltLimits || { min: 0, max: 270 }
            } : undefined,
            // 🛡️ WAVE 2093.2 (CW-AUDIT-4): calibration is THE MASTER for invert
            calibration: {
              panOffset: 0,
              tiltOffset: 0,
              panInvert: def.physics?.invertPan ?? false,
              tiltInvert: def.physics?.invertTilt ?? false,
            },
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

    const newFixture = createDefaultFixture(fixtureId, nextAddress, fixtureData)
    addFixture(newFixture)
    setDraggedFixtureType(null)
  }, [addFixture, setDraggedFixtureType])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // 🎯 WAVE 4541: Activar/desactivar la bandera isDragging para el GhostCursor
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('fixture-type')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Solo desactivar si el puntero sale del canvas completamente
    if (!canvasRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
      ghostPosRef.current = null
    }
  }, [])
  
  // Handler for drops from inside R3F (proper raycast)
  // 🔥 WAVE 384: Also make this async and load definition
  // 🔥 WAVE 1042.1: Normalizar zona AL FINAL
  const handleFixtureDrop = useCallback(async (type: string, position: Position3D, libraryId?: string) => {
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1
    
    // 🧱 WAVE 4538: Drop siempre en Y=0 (el técnico eleva con el gizmo)
    let fixtureData: Partial<FixtureV2> = {
      type: type as FixtureV2['type'],
      position: { ...position, y: 0 },
      zone: 'unassigned' as FixtureZone,
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
              invertPan: false,  // 🛡️ WAVE 2093.2 (CW-AUDIT-4): Frozen — use calibration instead
              invertTilt: false, // 🛡️ WAVE 2093.2 (CW-AUDIT-4): Frozen — use calibration instead
              swapPanTilt: def.physics.swapPanTilt ?? false,
              homePosition: def.physics.homePosition || { pan: 127, tilt: 127 },
              tiltLimits: def.physics.tiltLimits || { min: 0, max: 270 }
            } : undefined,
            // 🛡️ WAVE 2093.2 (CW-AUDIT-4): calibration is THE MASTER for invert
            calibration: {
              panOffset: 0,
              tiltOffset: 0,
              panInvert: def.physics?.invertPan ?? false,
              tiltInvert: def.physics?.invertTilt ?? false,
            },
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
    
    // 🧱 WAVE 4538: Zone se asigna manualmente
    const newFixture = createDefaultFixture(fixtureId, nextAddress, fixtureData)
    addFixture(newFixture)
  }, [addFixture])
  
  return (
    <div 
      ref={canvasRef}
      className="stage-grid-3d viewport-container"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
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
        
        <color attach="background" args={['#0a0a14']} />
        
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
          onFixtureDoubleClick={handleOpenOffsetPanel}
          showCrystalBox={showCrystalBox}
          showFloorGrid={showFloorGrid}
          showDropLines={showDropLines}
          isDragging={isDragging}
          ghostPosRef={ghostPosRef}
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
      
      {/* 🏗️ WAVE 4534: Context Menu 2.5D */}
      {contextMenu && (
        <div
          className="fixture-context-menu"
          style={{
            // WAVE 4546: quadrant-aware positioning — el menú siempre crece hacia el centro
            position: 'fixed',
            ...(contextMenu.x > window.innerWidth  / 2
              ? { right:  window.innerWidth  - contextMenu.x }
              : { left:   contextMenu.x }),
            ...(contextMenu.y > window.innerHeight / 2
              ? { bottom: window.innerHeight - contextMenu.y }
              : { top:    contextMenu.y }),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ═════ ASIGNAR ZONA ═════ */}
          <div className="context-menu-divider" />
          <div className="context-menu-title">📍 ASIGNAR ZONA</div>
          {([
            { zone: 'front',        label: 'FRONT',        icon: '🔴' },
            { zone: 'back',         label: 'BACK',         icon: '🔵' },
            { zone: 'center',       label: 'CENTER',       icon: '⚡' },
            { zone: 'movers-left',  label: 'MOVER LEFT',   icon: '🏗️' },
            { zone: 'movers-right', label: 'MOVER RIGHT',  icon: '🏗️' },
            { zone: 'floor',        label: 'FLOOR',        icon: '⬇️' },
            { zone: 'air',          label: 'AIR',          icon: '✨' },
          ] as { zone: FixtureZone; label: string; icon: string }[]).map(({ zone, label, icon }) => (
            <button
              key={zone}
              className="context-menu-item"
              onClick={() => assignZoneManual(zone)}
            >
              <span className="icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}

          {/* ═════ FLIP ═════ */}
          <div className="context-menu-divider" />
          <div className="context-menu-title">🔄 FLIP</div>
          <button className="context-menu-item" onClick={flipLeftRight}>
            <span className="icon">↔️</span><span>FLIP L/R</span><span className="hint">x = -x</span>
          </button>
          <button className="context-menu-item" onClick={flipFrontBack}>
            <span className="icon">↕️</span><span>FLIP F/B</span><span className="hint">z = -z</span>
          </button>

          {/* ═════ PRECISION / CRUD ═════ */}
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={() => { handleOpenOffsetPanel(contextMenu.fixtureId); closeContextMenu() }}>
            <span className="icon">📐</span><span>Posición exacta…</span>
          </button>
          <button className="context-menu-item" onClick={editFixture}>
            <span className="icon">✏️</span><span>EDIT</span><span className="hint">Propiedades</span>
          </button>
          <button className="context-menu-item context-menu-danger" onClick={deleteFixture}>
            <span className="icon">🗑️</span><span>DELETE</span><span className="hint">Eliminar</span>
          </button>

          <div className="context-menu-divider" />
          <button className="context-menu-item context-menu-cancel" onClick={closeContextMenu}>✕ Cancelar</button>
        </div>
      )}

      {/* 🏗️ WAVE 4534: Offset Panel */}
      {offsetPanelFixtureId && (
        <OffsetPanel
          fixtureId={offsetPanelFixtureId}
          onClose={() => setOffsetPanelFixtureId(null)}
        />
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
        
        /* 🏗️ WAVE 4532: 2.5D permanent fixture label */
        .fixture-label-25d {
          display: flex;
          flex-direction: column;
          padding: 2px 6px;
          background: rgba(0, 0, 0, 0.75);
          border-left: 2px solid rgba(34, 211, 238, 0.6);
          border-radius: 0 3px 3px 0;
          font-size: 9px;
          white-space: nowrap;
          line-height: 1.3;
        }
        
        .label-name {
          color: #e2e8f0;
          font-weight: 600;
          font-family: monospace;
        }
        
        .label-height {
          color: #94a3b8;
          font-size: 8px;
          font-family: monospace;
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

        .cm-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* 🏗️ WAVE 4534: Offset Panel */
        .offset-panel {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1100;
          width: 260px;
          background: rgba(10, 10, 22, 0.97);
          border: 1px solid rgba(34, 211, 238, 0.4);
          border-radius: 10px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.7);
          backdrop-filter: blur(12px);
          padding: 0;
          overflow: hidden;
        }
        .offset-panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(34, 211, 238, 0.08);
          border-bottom: 1px solid rgba(34, 211, 238, 0.2);
          font-size: 11px;
          font-weight: 700;
          color: #22d3ee;
          letter-spacing: 0.4px;
        }
        .offset-fixture-name {
          margin-left: auto;
          color: rgba(255,255,255,0.6);
          font-size: 10px;
          font-weight: 400;
          font-family: monospace;
          max-width: 90px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .offset-close-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          font-size: 14px;
          padding: 0 2px;
          line-height: 1;
        }
        .offset-close-btn:hover { color: white; }
        .offset-inputs {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px;
        }
        .offset-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: default;
        }
        .offset-axis {
          width: 14px;
          font-size: 11px;
          font-weight: 700;
          font-family: monospace;
          text-align: center;
        }
        .offset-axis-x { color: #ef4444; }
        .offset-axis-y { color: #22d3ee; }
        .offset-axis-z { color: #4ade80; }
        .offset-input-row input[type=number] {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 5px;
          color: white;
          font-size: 13px;
          font-family: monospace;
          padding: 5px 8px;
          outline: none;
          text-align: right;
        }
        .offset-input-row input[type=number]:focus {
          border-color: #22d3ee;
          background: rgba(34, 211, 238, 0.08);
        }
        .offset-unit {
          width: 14px;
          font-size: 10px;
          color: rgba(255,255,255,0.35);
          font-family: monospace;
        }
        .offset-actions {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }
        .offset-apply-btn {
          flex: 1;
          padding: 7px 0;
          background: rgba(34, 211, 238, 0.2);
          border: 1px solid #22d3ee;
          border-radius: 6px;
          color: #22d3ee;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .offset-apply-btn:hover { background: rgba(34, 211, 238, 0.35); }
        .offset-cancel-btn {
          padding: 7px 14px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          cursor: pointer;
        }
        .offset-cancel-btn:hover { background: rgba(255,255,255,0.08); color: white; }
      `}</style>
    </div>
  )
}

export default StageGrid3D
