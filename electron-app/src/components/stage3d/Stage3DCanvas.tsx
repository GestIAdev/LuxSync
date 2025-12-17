/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 STAGE 3D CANVAS - WAVE 30: Stage Command & Dashboard
 * Canvas principal de React Three Fiber para visualización 3D
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este es el canvas principal que renderiza:
 * - Escenario con suelo y truss
 * - Fixtures 3D posicionados según layoutGenerator3D
 * - Efectos de luz volumétricos
 * - Controles de cámara orbital
 * 
 * @module components/stage3d/Stage3DCanvas
 * @version 30.0.0
 */

import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei'
import { useTruthStore, selectHardware, selectPalette } from '../../stores/truthStore'
import { useControlStore, selectViewMode } from '../../stores/controlStore'
import { generateLayout3D, DEFAULT_STAGE_CONFIG } from '../../utils/layoutGenerator3D'
import { Fixture3D } from './fixtures/Fixture3D'
import { StageFloor } from './environment/StageFloor'
import { StageTruss } from './environment/StageTruss'
import './Stage3DCanvas.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Stage3DCanvasProps {
  showStats?: boolean
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE CONTENT - Separado para poder usar hooks de R3F
// ═══════════════════════════════════════════════════════════════════════════

const SceneContent: React.FC<{ showStats: boolean }> = ({ showStats }) => {
  // TRUTH - la única fuente
  const hardware = useTruthStore(selectHardware)
  const palette = useTruthStore(selectPalette)
  
  // Generar layouts 3D a partir de fixtures
  const fixtureLayouts = useMemo(() => {
    const fixtureArray = hardware?.fixtures || []
    if (!Array.isArray(fixtureArray)) return []
    
    // Preparar datos para el generador
    const fixtureInputs = fixtureArray.map(f => ({
      id: f?.id || `fixture-${f?.dmxAddress}`,
      name: f?.name || '',
      type: f?.type || '',
      zone: f?.zone || '',
      dmxAddress: f?.dmxAddress,
    }))
    
    return generateLayout3D(fixtureInputs, DEFAULT_STAGE_CONFIG)
  }, [hardware?.fixtures])
  
  // Crear mapa de valores de fixtures para lookup rápido
  const fixtureValues = useMemo(() => {
    const fixtureArray = hardware?.fixtures || []
    const map = new Map<string, typeof fixtureArray[0]>()
    
    fixtureArray.forEach(f => {
      if (f?.id) {
        map.set(f.id, f)
      } else if (f?.dmxAddress) {
        map.set(`fixture-${f.dmxAddress}`, f)
      }
    })
    
    return map
  }, [hardware?.fixtures])
  
  return (
    <>
      {/* CAMERA */}
      <PerspectiveCamera
        makeDefault
        position={[0, 8, 15]}
        fov={50}
        near={0.1}
        far={100}
      />
      
      {/* CONTROLS */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={30}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2 - 0.1}
        target={[0, 2, 0]}
      />
      
      {/* AMBIENT LIGHT - Muy tenue para ver geometría */}
      <ambientLight intensity={0.05} color="#1a1a2e" />
      
      {/* ENVIRONMENT */}
      <StageFloor />
      <StageTruss />
      
      {/* FIXTURES */}
      {fixtureLayouts.map(layout => {
        const fixtureData = fixtureValues.get(layout.id)
        
        return (
          <Fixture3D
            key={layout.id}
            id={layout.id}
            position={[layout.position.x, layout.position.y, layout.position.z]}
            rotation={[layout.rotation.x, layout.rotation.y, layout.rotation.z]}
            type={layout.type}
            color={fixtureData?.color || { r: 0, g: 0, b: 0, hex: '#000000' }}
            intensity={fixtureData?.intensity ?? 0}
            pan={fixtureData?.pan ?? 0.5}
            tilt={fixtureData?.tilt ?? 0.5}
          />
        )
      })}
      
      {/* DEBUG STATS */}
      {showStats && <Stats />}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK LOADER
// ═══════════════════════════════════════════════════════════════════════════

const Loader: React.FC = () => (
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial color="#ff00ff" wireframe />
  </mesh>
)

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const Stage3DCanvas: React.FC<Stage3DCanvasProps> = ({
  showStats = false,
  className = '',
}) => {
  const showDebugOverlay = useControlStore(state => state.showDebugOverlay)
  
  return (
    <div className={`stage-3d-canvas ${className}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        style={{
          background: '#0a0a0f',
        }}
      >
        <Suspense fallback={<Loader />}>
          <SceneContent showStats={showStats || showDebugOverlay} />
        </Suspense>
        
        {/* FOG para atmósfera */}
        <fog attach="fog" args={['#0a0a0f', 20, 50]} />
      </Canvas>
      
      {/* BADGE DE MODO */}
      <div className="stage-3d-badge">
        🎬 VISUALIZER 3D
      </div>
    </div>
  )
}

export default Stage3DCanvas
