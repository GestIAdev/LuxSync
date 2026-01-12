/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔬 FIXTURE PREVIEW 3D - WAVE 364: THE FIXTURE FORGE
 * "El Laboratorio de Frankenstein"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Canvas 3D aislado que muestra SOLO el fixture que se está editando.
 * Permite probar Pan/Tilt en tiempo real antes de guardar el perfil.
 * 
 * @module components/modals/FixtureEditor/FixturePreview3D
 * @version 364.0.0
 */

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid, Environment, Html } from '@react-three/drei'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FixturePreviewProps {
  /** Pan value 0-255 (DMX) */
  pan: number
  /** Tilt value 0-255 (DMX) */
  tilt: number
  /** Dimmer value 0-255 */
  dimmer: number
  /** RGB color values */
  color: { r: number; g: number; b: number }
  /** Strobe active */
  strobeActive: boolean
  /** Fixture type for model selection */
  fixtureType: string
  /** Show beam cone */
  showBeam: boolean
  /** Physics stress test active */
  isStressTesting: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DMX_TO_RAD_PAN = (Math.PI * 2) / 255   // 360° range
const DMX_TO_RAD_TILT = (Math.PI) / 255      // 180° range

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Moving Head 3D Model
 */
const MovingHeadModel: React.FC<{
  pan: number
  tilt: number
  dimmer: number
  color: { r: number; g: number; b: number }
  strobeActive: boolean
  showBeam: boolean
  isStressTesting: boolean
}> = ({ pan, tilt, dimmer, color, strobeActive, showBeam, isStressTesting }) => {
  const baseRef = useRef<THREE.Group>(null)
  const yokeRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const strobeRef = useRef<number>(0)
  
  // Convert DMX to radians
  const panRad = (pan / 255) * Math.PI * 2 - Math.PI  // -180 to +180
  const tiltRad = (tilt / 255) * Math.PI - Math.PI / 2 // -90 to +90
  
  // Calculate beam color with dimmer
  const beamColor = useMemo(() => {
    const intensity = dimmer / 255
    return new THREE.Color(
      (color.r / 255) * intensity,
      (color.g / 255) * intensity,
      (color.b / 255) * intensity
    )
  }, [color.r, color.g, color.b, dimmer])
  
  // Animation frame for smooth movement + strobe
  useFrame((state, delta) => {
    // Smooth pan/tilt interpolation
    if (yokeRef.current) {
      yokeRef.current.rotation.y = THREE.MathUtils.lerp(
        yokeRef.current.rotation.y,
        panRad,
        isStressTesting ? 1 : 0.1  // Instant during stress test
      )
    }
    
    if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        tiltRad,
        isStressTesting ? 1 : 0.1
      )
    }
    
    // Strobe effect
    if (beamRef.current && strobeActive) {
      strobeRef.current += delta * 20
      const strobeIntensity = Math.sin(strobeRef.current) > 0 ? 1 : 0
      const mat = beamRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = strobeIntensity * 0.6
    }
  })
  
  return (
    <group ref={baseRef} position={[0, 2, 0]}>
      {/* BASE - The mounting bracket */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* YOKE - Rotates on Y (pan) */}
      <group ref={yokeRef} position={[0, 0, 0]}>
        {/* Left arm */}
        <mesh position={[-0.12, -0.1, 0]}>
          <boxGeometry args={[0.02, 0.25, 0.04]} />
          <meshStandardMaterial color="#222" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Right arm */}
        <mesh position={[0.12, -0.1, 0]}>
          <boxGeometry args={[0.02, 0.25, 0.04]} />
          <meshStandardMaterial color="#222" metalness={0.7} roughness={0.4} />
        </mesh>
        
        {/* HEAD - Rotates on X (tilt) */}
        <group ref={headRef} position={[0, -0.15, 0]}>
          {/* Main body */}
          <mesh>
            <cylinderGeometry args={[0.08, 0.1, 0.18, 16]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.2} />
          </mesh>
          
          {/* Lens */}
          <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 32]} />
            <meshStandardMaterial 
              color={beamColor} 
              emissive={beamColor}
              emissiveIntensity={dimmer / 128}
              transparent
              opacity={0.9}
            />
          </mesh>
          
          {/* BEAM CONE */}
          {showBeam && dimmer > 0 && (
            <mesh ref={beamRef} position={[0, -2, 0]} rotation={[0, 0, 0]}>
              <coneGeometry args={[1.5, 4, 32, 1, true]} />
              <meshBasicMaterial 
                color={beamColor}
                transparent
                opacity={strobeActive ? 0.6 : 0.3}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          )}
          
          {/* Point light for actual illumination */}
          {dimmer > 10 && (
            <pointLight
              color={beamColor}
              intensity={dimmer / 50}
              distance={8}
              decay={2}
              position={[0, -0.2, 0]}
            />
          )}
        </group>
      </group>
      
      {/* Stress test indicator */}
      {isStressTesting && (
        <Html position={[0, 0.5, 0]} center>
          <div style={{
            background: '#ff4444',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            animation: 'pulse 0.5s infinite'
          }}>
            ⚡ STRESS TEST
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * PAR Model (static wash light)
 */
const ParModel: React.FC<{
  dimmer: number
  color: { r: number; g: number; b: number }
  showBeam: boolean
}> = ({ dimmer, color, showBeam }) => {
  const beamColor = useMemo(() => {
    const intensity = dimmer / 255
    return new THREE.Color(
      (color.r / 255) * intensity,
      (color.g / 255) * intensity,
      (color.b / 255) * intensity
    )
  }, [color.r, color.g, color.b, dimmer])
  
  return (
    <group position={[0, 2, 0]}>
      {/* PAR body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.12, 0.2, 16]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Lens */}
      <mesh position={[0, -0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14, 32]} />
        <meshStandardMaterial 
          color={beamColor}
          emissive={beamColor}
          emissiveIntensity={dimmer / 100}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Beam wash */}
      {showBeam && dimmer > 0 && (
        <mesh position={[0, -2, 0]}>
          <coneGeometry args={[2, 3.5, 32, 1, true]} />
          <meshBasicMaterial 
            color={beamColor}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      
      {dimmer > 10 && (
        <pointLight
          color={beamColor}
          intensity={dimmer / 80}
          distance={6}
          decay={2}
          position={[0, -0.3, 0]}
        />
      )}
    </group>
  )
}

/**
 * Floor target for beam visualization
 */
const FloorTarget: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
    <planeGeometry args={[8, 8]} />
    <meshStandardMaterial 
      color="#0a0a0a"
      metalness={0.2}
      roughness={0.8}
    />
  </mesh>
)

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const FixturePreview3D: React.FC<FixturePreviewProps> = ({
  pan = 127,
  tilt = 127,
  dimmer = 200,
  color = { r: 255, g: 255, b: 255 },
  strobeActive = false,
  fixtureType = 'Moving Head',
  showBeam = true,
  isStressTesting = false
}) => {
  const isMovingHead = fixtureType.toLowerCase().includes('moving') || 
                       fixtureType.toLowerCase().includes('beam') ||
                       fixtureType.toLowerCase().includes('spot')
  
  return (
    <div className="fixture-preview-container">
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        style={{ background: '#050508' }}
      >
        <PerspectiveCamera makeDefault position={[2, 2, 4]} fov={50} />
        <OrbitControls 
          enablePan={false}
          minDistance={2}
          maxDistance={8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 5, 5]} intensity={0.3} />
        
        {/* Grid */}
        <Grid
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1a1a2e"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#2a2a4e"
          fadeDistance={15}
          fadeStrength={1}
          followCamera={false}
          position={[0, 0, 0]}
        />
        
        {/* Floor */}
        <FloorTarget />
        
        {/* Fixture Model */}
        {isMovingHead ? (
          <MovingHeadModel
            pan={pan}
            tilt={tilt}
            dimmer={dimmer}
            color={color}
            strobeActive={strobeActive}
            showBeam={showBeam}
            isStressTesting={isStressTesting}
          />
        ) : (
          <ParModel
            dimmer={dimmer}
            color={color}
            showBeam={showBeam}
          />
        )}
      </Canvas>
      
      {/* Overlay info */}
      <div className="preview-overlay-info">
        <span className="preview-stat">
          PAN: <strong>{pan}</strong>
        </span>
        <span className="preview-stat">
          TILT: <strong>{tilt}</strong>
        </span>
        <span className="preview-stat">
          DIM: <strong>{Math.round(dimmer / 255 * 100)}%</strong>
        </span>
      </div>
    </div>
  )
}

export default FixturePreview3D
