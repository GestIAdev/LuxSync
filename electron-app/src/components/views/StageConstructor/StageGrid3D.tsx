/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 STAGE GRID 3D - WAVE 361.5
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
 * 
 * @module components/views/StageConstructor/StageGrid3D
 * @version 361.5.0
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
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
import { useConstructorContext } from '../StageConstructorView'
import { createDefaultFixture } from '../../../core/stage/ShowFileV2'
import type { FixtureV2, Position3D } from '../../../core/stage/ShowFileV2'
import * as THREE from 'three'

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
// TRANSFORM GIZMO WRAPPER - With Snap Support
// ═══════════════════════════════════════════════════════════════════════════

interface TransformGizmoProps {
  fixture: FixtureV2
  onPositionChange: (id: string, position: Position3D) => void
  snapEnabled: boolean
  snapDistance: number
  snapRotation: number
}

const TransformGizmo: React.FC<TransformGizmoProps> = ({ 
  fixture, 
  onPositionChange,
  snapEnabled,
  snapDistance,
  snapRotation
}) => {
  const transformRef = useRef<any>(null)
  const objectRef = useRef<THREE.Group>(null!)
  const { camera } = useThree()
  
  // Handle drag end - persist position
  const handleDragEnd = useCallback(() => {
    if (objectRef.current) {
      const pos = objectRef.current.position
      onPositionChange(fixture.id, {
        x: Math.round(pos.x * 100) / 100, // Round to 2 decimals
        y: Math.round(pos.y * 100) / 100,
        z: Math.round(pos.z * 100) / 100
      })
    }
  }, [fixture.id, onPositionChange])
  
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
        onMouseUp={handleDragEnd}
      />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE GRID SCENE - Receives snap config as props
// ═══════════════════════════════════════════════════════════════════════════

interface StageSceneProps {
  snapEnabled: boolean
  snapDistance: number
  snapRotation: number
  onFixtureDrop: (type: string, position: Position3D) => void
}

const StageScene: React.FC<StageSceneProps> = ({ 
  snapEnabled, 
  snapDistance, 
  snapRotation,
  onFixtureDrop 
}) => {
  const fixtures = useStageStore(selectFixtures)
  const updateFixturePosition = useStageStore(state => state.updateFixturePosition)
  const selectedIds = useSelectionStore(state => state.selectedIds)
  const hoveredId = useSelectionStore(state => state.hoveredId)
  const select = useSelectionStore(state => state.select)
  const setHovered = useSelectionStore(state => state.setHovered)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // Get the single selected fixture for transform controls
  const selectedArray = Array.from(selectedIds)
  const selectedFixture = selectedArray.length === 1 
    ? fixtures.find(f => f.id === selectedArray[0])
    : null
  
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
  
  // Handle click on empty space
  const handleBackgroundClick = useCallback(() => {
    deselectAll()
  }, [deselectAll])
  
  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={50} />
      
      {/* Controls */}
      <OrbitControls
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
      
      {/* Transform Gizmo for selected fixture - WITH SNAP */}
      {selectedFixture && (
        <TransformGizmo
          fixture={selectedFixture}
          onPositionChange={updateFixturePosition}
          snapEnabled={snapEnabled}
          snapDistance={snapDistance}
          snapRotation={snapRotation}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT - Bridge between React Context and R3F
// ═══════════════════════════════════════════════════════════════════════════

interface BoxSelectionRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

const StageGrid3D: React.FC = () => {
  // Get snap settings from parent context
  const { snapEnabled, snapDistance, snapRotation, draggedFixtureType, setDraggedFixtureType, toolMode } = useConstructorContext()
  const addFixture = useStageStore(state => state.addFixture)
  const fixtures = useStageStore(state => state.fixtures)
  const selectMultiple = useSelectionStore(state => state.selectMultiple)
  const canvasRef = useRef<HTMLDivElement>(null)
  
  // Box selection state
  const [boxSelection, setBoxSelection] = useState<BoxSelectionRect | null>(null)
  const isBoxSelecting = useRef(false)
  
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
      
      // Convert screen box to normalized device coordinates
      const ndcMinX = ((minX) / rect.width) * 2 - 1
      const ndcMaxX = ((maxX) / rect.width) * 2 - 1
      const ndcMinY = -((maxY) / rect.height) * 2 + 1 // Y is inverted
      const ndcMaxY = -((minY) / rect.height) * 2 + 1
      
      // Simple screen-space selection based on fixture positions
      // For proper 3D, this should project each fixture to screen space
      // Simplified: map world X/Z to approximate screen position
      const selectedFixtureIds = fixtures.filter(fixture => {
        // Approximate NDC from world position (assuming default camera)
        const approxNdcX = fixture.position.x / 8  // Rough scale
        const approxNdcZ = -fixture.position.z / 6
        
        return (
          approxNdcX >= ndcMinX && 
          approxNdcX <= ndcMaxX &&
          approxNdcZ >= ndcMinY &&
          approxNdcZ <= ndcMaxY
        )
      }).map(f => f.id)
      
      if (selectedFixtureIds.length > 0) {
        selectMultiple(selectedFixtureIds)
      }
    }
    
    isBoxSelecting.current = false
    setBoxSelection(null)
  }, [boxSelection, fixtures, selectMultiple])
  
  // Handle drop - Raycast to ground plane
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const fixtureType = e.dataTransfer.getData('fixture-type')
    if (!fixtureType || !canvasRef.current) return
    
    // Calculate normalized device coordinates
    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    
    // For now, simple mapping to world coordinates
    // TODO: Proper raycast when we have camera reference
    const worldX = x * 6  // Scale to stage size
    const worldZ = y * 4
    
    // Create fixture at drop position
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1  // Auto-assign address
    const newFixture = createDefaultFixture(fixtureId, nextAddress, {
      type: fixtureType as FixtureV2['type'],
      position: { x: worldX, y: 3, z: worldZ }  // Default height 3m
    })
    
    addFixture(newFixture)
    setDraggedFixtureType(null)
  }, [addFixture, setDraggedFixtureType])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])
  
  // Handler for drops from inside R3F (proper raycast)
  const handleFixtureDrop = useCallback((type: string, position: Position3D) => {
    const fixtureId = `fixture-${Date.now()}`
    const nextAddress = useStageStore.getState().fixtures.length * 8 + 1
    const newFixture = createDefaultFixture(fixtureId, nextAddress, {
      type: type as FixtureV2['type'],
      position
    })
    addFixture(newFixture)
  }, [addFixture])
  
  return (
    <div 
      ref={canvasRef}
      className="stage-grid-3d"
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
          powerPreference: 'high-performance'
        }}
        dpr={[1, 2]}
        style={{ background: '#000000' }}
      >
        <color attach="background" args={['#000000']} />
        <fog attach="fog" args={['#000000', 30, 60]} />
        
        <StageScene 
          snapEnabled={snapEnabled}
          snapDistance={snapDistance}
          snapRotation={snapRotation}
          onFixtureDrop={handleFixtureDrop}
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
