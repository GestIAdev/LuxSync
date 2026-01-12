/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎮 STAGE GRID 3D - WAVE 361
 * "El Lienzo Infinito del Arquitecto"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Canvas 3D interactivo usando React Three Fiber + Drei.
 * 
 * Features:
 * - Renderiza fixtures desde stageStore (posiciones REALES, no algorítmicas)
 * - OrbitControls para navegación
 * - Click to select
 * - TransformControls (Gizmo) para mover fixtures
 * - Grid infinito estilo Tron
 * - Persist position on drag end
 * 
 * @module components/views/StageConstructor/StageGrid3D
 * @version 361.1.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber'
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
// TRANSFORM GIZMO WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

interface TransformGizmoProps {
  fixture: FixtureV2
  onPositionChange: (id: string, position: Position3D) => void
}

const TransformGizmo: React.FC<TransformGizmoProps> = ({ fixture, onPositionChange }) => {
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
        onMouseUp={handleDragEnd}
      />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE GRID SCENE
// ═══════════════════════════════════════════════════════════════════════════

const StageScene: React.FC = () => {
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
      
      {/* Transform Gizmo for selected fixture */}
      {selectedFixture && (
        <TransformGizmo
          fixture={selectedFixture}
          onPositionChange={updateFixturePosition}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const StageGrid3D: React.FC = () => {
  return (
    <div className="stage-grid-3d">
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
        
        <StageScene />
      </Canvas>
      
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
