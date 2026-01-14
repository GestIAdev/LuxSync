/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 STAGE 3D CANVAS - WAVE 379.5: HYBRID RENDERING
 * Canvas principal de React Three Fiber para visualización 3D
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 379.5: HYBRID RENDERING SOURCE
 * - GEOMETRÍA: stageStore (local, inmediato, siempre disponible)
 * - ESTADO (color/intensity): truthStore via useFixtureRender hook
 * - Si el backend no responde, los fixtures se ven (apagados) pero VISIBLES
 * 
 * Este es el canvas principal que renderiza:
 * - Escenario con suelo y truss
 * - Fixtures 3D posicionados según layoutGenerator3D
 * - Efectos de luz volumétricos
 * - Controles de cámara orbital
 * 
 * @module components/stage3d/Stage3DCanvas
 * @version 379.5.0
 */

import React, { Suspense, useMemo, useCallback, memo, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei'
import { useTruthStore } from '../../stores/truthStore'
import { useStageStore } from '../../stores/stageStore'
import { useControlStore } from '../../stores/controlStore'
import { useSelectionStore, selectSelectedIds, selectHoveredId } from '../../stores/selectionStore'
import { generateLayout3D, DEFAULT_STAGE_CONFIG } from '../../utils/layoutGenerator3D'
import { useFixtureRender } from '../../hooks/useFixtureRender'
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
// WAVE 379.5: HYBRID RENDERING - Geometría desde stageStore (local)
// Estado (color/intensity) desde truthStore via useFixtureRender hook
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selector que extrae solo la estructura de fixtures desde STAGESTORE (LOCAL)
 * Esto garantiza que los fixtures siempre se rendericen aunque el backend no responda
 * El color/intensity viene del hook useFixtureRender que lee truthStore
 */
const selectFixtureStructure = (state: ReturnType<typeof useStageStore.getState>) => {
  const fixtures = state.fixtures || []
  return fixtures.map((f: any) => ({
    id: f?.id || `fixture-${f?.address}`,
    name: f?.name || '',
    type: f?.type || '',
    zone: f?.zone || '',
    address: f?.address,
  }))
}

/**
 * Función de igualdad personalizada para el selector
 * Solo retorna false (nuevo estado) si cambian los IDs o la cantidad
 */
const fixtureStructureEquals = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false
  return a.every((fixture, i) => fixture.id === b[i]?.id)
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
      console.warn('[Stage3DCanvas] ⚠️ WebGL Context Lost')
    }
    
    const handleContextRestored = () => {
      console.log('[Stage3DCanvas] ✅ WebGL Context Restored')
    }
    
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
    
    console.log('[Stage3DCanvas] 🎬 WebGL Context Handler mounted')
    
    // 🔥 WAVE 379.3: NO hacer nada en cleanup
    // React + R3F manejan el dispose automáticamente cuando el componente se desmonta
    // Forzar loseContext() causa "Zombie Renderer" crash
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
      console.log('[Stage3DCanvas] 🎬 WebGL Context Handler unmounted - R3F will handle cleanup')
    }
  }, [gl])
  
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART FIXTURE WRAPPER - WAVE 378: Memoized, no debug logs
// ═══════════════════════════════════════════════════════════════════════════

interface SmartFixture3DProps {
  layout: {
    id: string
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    type: 'par' | 'moving' | 'strobe' | 'laser'
  }
  isSelected: boolean
  isHovered: boolean
  allFixtureIds: string[]
  fixtureIndex: number
}

const SmartFixture3D = memo<SmartFixture3DProps>(({ layout, isSelected, isHovered, allFixtureIds, fixtureIndex }) => {
  // 🔥 WAVE 378: truthData ya NO se pasa como prop
  // Fixture3D lee directamente del transient store via getTransientFixture(id)
  // Esto elimina el re-render cascade completamente
  
  // Use the Priority Hook to get initial render values
  // Real-time updates come from transient store inside Fixture3D
  const { color, intensity, pan, tilt } = useFixtureRender(null, layout.id, fixtureIndex)
  
  return (
    <Fixture3D
      id={layout.id}
      position={[layout.position.x, layout.position.y, layout.position.z]}
      rotation={[layout.rotation.x, layout.rotation.y, layout.rotation.z]}
      type={layout.type}
      color={color}
      intensity={intensity}
      pan={pan}
      tilt={tilt}
      selected={isSelected}
      hovered={isHovered}
      allFixtureIds={allFixtureIds}
    />
  )
})

SmartFixture3D.displayName = 'SmartFixture3D'

// ═══════════════════════════════════════════════════════════════════════════
// SCENE CONTENT - WAVE 378: Memoized + Granular Selector
// ═══════════════════════════════════════════════════════════════════════════

const SceneContent = memo<{ showStats: boolean }>(({ showStats }) => {
  // 🔥 WAVE 379.5: HYBRID - Geometría desde stageStore (LOCAL, siempre disponible)
  // El color/intensity viene del hook useFixtureRender que lee truthStore
  const fixtureStructure = useStageStore(selectFixtureStructure, fixtureStructureEquals)
  
  // SELECTION STORE
  const selectedIds = useSelectionStore(selectSelectedIds)
  const hoveredId = useSelectionStore(selectHoveredId)
  const deselectAll = useSelectionStore(state => state.deselectAll)
  
  // 🔥 WAVE 378: Layout generation - Solo depende de estructura (IDs)
  // NO se regenera cuando cambian valores en tiempo real
  const fixtureLayouts = useMemo(() => {
    if (!Array.isArray(fixtureStructure) || fixtureStructure.length === 0) {
      console.log('[Stage3DCanvas] ⚠️ No fixture structure available')
      return []
    }
    console.log(`[Stage3DCanvas] 🎯 Generating layout for ${fixtureStructure.length} fixtures`)
    return generateLayout3D(fixtureStructure, DEFAULT_STAGE_CONFIG)
  }, [fixtureStructure])
  
  // Lista de todos los IDs para Shift+Click
  const allFixtureIds = useMemo(() => {
    return fixtureLayouts.map(l => l.id)
  }, [fixtureLayouts])
  
  // Click en el fondo para deseleccionar todo
  const handleBackgroundClick = useCallback(() => {
    deselectAll()
  }, [deselectAll])
  
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
      <StageFloor onClick={handleBackgroundClick} />
      <StageTruss />
      
      {/* FIXTURES */}
      {/* � WAVE 378: Ya no pasamos truthData - Fixture3D lee del transient store */}
      {/* Esto elimina completamente el re-render cascade */}
      {fixtureLayouts.map((layout, index) => {
        const isSelected = selectedIds.has(layout.id)
        const isHovered = hoveredId === layout.id
        
        return (
          <SmartFixture3D
            key={layout.id}
            layout={layout}
            isSelected={isSelected}
            isHovered={isHovered}
            allFixtureIds={allFixtureIds}
            fixtureIndex={index}
          />
        )
      })}
      
      {/* DEBUG STATS */}
      {showStats && <Stats />}
    </>
  )
})

SceneContent.displayName = 'SceneContent'

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
        dpr={[1, 1.5]}  // WAVE 378.7: Reduce max DPR to prevent GPU overload
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          // WAVE 378.7: Prevent context loss
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false
        }}
        // WAVE 378.8: Revert to default 'always' - 'demand' caused issues
        style={{
          background: '#0a0a0f',
        }}
      >
        {/* WAVE 378.7: WebGL Context Loss Handler */}
        <WebGLContextHandler />
        
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
