/**
 * ☀️ HYPERION — VisualizerCanvas (3D Renderer)
 * 
 * Canvas 3D con React Three Fiber para visualización de fixtures.
 * Features:
 * - Quaternion SLERP para rotaciones sin gimbal lock
 * - Materiales emissive neon
 * - NeonFloor con grid reactivo al beat
 * - HyperionTruss con glow
 * - Bloom post-processing (modo HQ)
 * - OrbitControls para navegación
 * - Click to select fixtures
 * 
 * 🔧 WAVE 2204: COLOR SPACE EXORCISM
 * - Canvas gl: toneMapping=NoToneMapping + outputColorSpace=SRGBColorSpace
 * - Esto mata el tinte rojo en LQ causado por ACESFilmicToneMapping default
 * - Ambient light neutralizada: #111118 a 0.08 (antes #1a1a2e a 0.15)
 * 
 * @module components/hyperion/views/visualizer/VisualizerCanvas
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 * @updated WAVE 2204 — Color Space Exorcism: LQ red tint killed
 */

import React, { Suspense, useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei'
import * as THREE from 'three'

import { useAudioStore } from '../../../../stores/audioStore'
import { useSelectionStore, selectVisualizerActions } from '../../../../stores/selectionStore'
import { useStageStore, selectStageDimensions } from '../../../../stores/stageStore'
import { useFixture3DData } from './useFixture3DData'
import { HyperionMovingHead3D, HyperionPar3D } from './fixtures'
import { NeonFloor, HyperionTruss } from './environment'
import { NeonBloom } from './postprocessing'
import { QUALITY_PRESETS, type QualityMode } from '../../shared/types'
import type { StageConfig3D, Visualizer3DMetrics } from './types'

import './VisualizerCanvas.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Fallback stage dimensions (used when show file has no stage data) */
const DEFAULT_STAGE_WIDTH = 12
const DEFAULT_STAGE_DEPTH = 8
const DEFAULT_TRUSS_HEIGHT = 5

/** Camera: fallback position — overridden per-scene via stageConfig diagonal */
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 2, 0]

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface VisualizerCanvasProps {
  /** Modo de calidad (HQ/LQ) */
  quality?: QualityMode
  /** ¿Mostrar grid en el floor? */
  showFloorGrid?: boolean
  /** ¿Mostrar truss? */
  showTruss?: boolean
  /** ¿Mostrar beams de luz? */
  showBeams?: boolean
  /** Callback cuando se selecciona un fixture */
  onFixtureSelect?: (id: string) => void
  /** Callback cuando cambian las métricas */
  onMetricsUpdate?: (metrics: Visualizer3DMetrics) => void
  /** WAVE 2515: Hibernation — when false, pauses R3F render loop */
  isVisible?: boolean
  /** Clase CSS adicional */
  className?: string
}

/** Dimensiones resueltas del stage para la escena 3D. */
interface ResolvedStageConfig {
  width: number
  depth: number
  trussHeight: number
  gridSize: number
  /** Distancia de cámara calculada desde la diagonal del escenario */
  cameraDistance: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WebGL Context Handler — Handles context lost/restored events
 */
const WebGLContextHandler: React.FC = () => {
  const { gl } = useThree()

  useEffect(() => {
    const canvas = gl.domElement

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      console.warn('[VisualizerCanvas] ⚠️ WebGL Context Lost')
    }

    const handleContextRestored = () => {
      console.log('[VisualizerCanvas] ✅ WebGL Context Restored')
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [gl])

  return null
}

/**
 * Beat Tracker — Tracks beat intensity for visual effects
 */
const BeatTracker: React.FC<{ onBeatIntensity: (intensity: number) => void }> = ({ onBeatIntensity }) => {
  const onBeat = useAudioStore(state => state.onBeat)
  const beatIntensityRef = useRef(0)

  useFrame((_, delta) => {
    // Decay beat intensity
    if (onBeat) {
      beatIntensityRef.current = 1.0
    } else {
      beatIntensityRef.current *= Math.exp(-8 * delta)  // Exponential decay
    }
    onBeatIntensity(beatIntensityRef.current)
  })

  return null
}

/**
 * Performance Monitor — Tracks FPS and draw calls
 */
const PerformanceMonitor: React.FC<{
  onMetrics: (metrics: Visualizer3DMetrics) => void
  fixtureCount: number
}> = ({ onMetrics, fixtureCount }) => {
  const { gl } = useThree()
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  useFrame(() => {
    frameCountRef.current++
    const now = performance.now()
    const elapsed = now - lastTimeRef.current

    // Update metrics every second
    if (elapsed >= 1000) {
      const fps = Math.round((frameCountRef.current / elapsed) * 1000)
      const info = gl.info

      onMetrics({
        fps,
        frameTime: elapsed / frameCountRef.current,
        fixtureCount,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        memoryMB: (info.memory.geometries + info.memory.textures) / 1024,
      })

      frameCountRef.current = 0
      lastTimeRef.current = now
    }
  })

  return null
}

/**
 * ClippingPlaneSetup
 * 
 * 🎨 WAVE 2042.15.3: Global clipping plane at Y=0
 * Prevents rendering anything below the floor (kills beam penetration visually)
 */
const ClippingPlaneSetup: React.FC = () => {
  const { gl } = useThree()
  
  React.useEffect(() => {
    // Clipping plane at Y=0 with normal pointing UP
    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    gl.clippingPlanes = [clippingPlane]
    gl.localClippingEnabled = true
    
    return () => {
      gl.clippingPlanes = []
      gl.localClippingEnabled = false
    }
  }, [gl])
  
  return null
}

/**
 * Scene — The actual 3D scene contents
 */
const Scene: React.FC<{
  quality: QualityMode
  showFloorGrid: boolean
  showTruss: boolean
  showBeams: boolean
  stageConfig: ResolvedStageConfig
  onSelect: (id: string, shift: boolean, ctrl: boolean) => void
  onMetrics?: (metrics: Visualizer3DMetrics) => void
}> = ({
  quality,
  showFloorGrid,
  showTruss,
  showBeams,
  stageConfig,
  onSelect,
  onMetrics,
}) => {
  const [beatIntensity, setBeatIntensity] = useState(0)
  const qualitySettings = QUALITY_PRESETS[quality]

  // Get fixture data from stores, wiring real stage dimensions
  const { movingHeads, pars, strobes, count: fixtureCount } = useFixture3DData({
    stageConfig: {
      width: stageConfig.width,
      depth: stageConfig.depth,
      trussHeight: stageConfig.trussHeight,
      showFloor: showFloorGrid,
      showTruss,
      floorColor: '#080810',
    },
  })

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
       * CLIPPING PLANE - Cut everything below Y=0 (floor level)
       * 🎨 WAVE 2042.15.3: Kill beam rendering below floor
       * ═══════════════════════════════════════════════════════════════════ */}
      <ClippingPlaneSetup />

      {/* ═══════════════════════════════════════════════════════════════════
       * HELPERS & HANDLERS
       * ═══════════════════════════════════════════════════════════════════ */}
      <WebGLContextHandler />
      <BeatTracker onBeatIntensity={setBeatIntensity} />
      {onMetrics && <PerformanceMonitor onMetrics={onMetrics} fixtureCount={fixtureCount} />}

      {/* ═══════════════════════════════════════════════════════════════════
       * CAMERA & CONTROLS
       * ═══════════════════════════════════════════════════════════════════ */}
      <PerspectiveCamera 
        makeDefault 
        position={[0, stageConfig.trussHeight * 0.8, stageConfig.cameraDistance]}
        fov={50}
        near={0.1}
        far={Math.max(100, stageConfig.cameraDistance * 4)}
      />
      <OrbitControls
        target={DEFAULT_CAMERA_TARGET}
        minDistance={3}
        maxDistance={stageConfig.cameraDistance * 2.5}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2 - 0.1}
        enableDamping
        dampingFactor={0.05}
      />

      {/* ═══════════════════════════════════════════════════════════════════
       * LIGHTING
       * 🔧 WAVE 2204: Ambient neutralizada — gris neutro en vez de púrpura (#1a1a2e)
       *    El color púrpura contaminaba los negros en LQ sin bloom para enmascararlo.
       * ═══════════════════════════════════════════════════════════════════ */}
      <ambientLight intensity={0.08} color="#111118" />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.3}
        color="#8888ff"
        castShadow={qualitySettings.shadows}
      />

      {/* ═══════════════════════════════════════════════════════════════════
       * ENVIRONMENT
       * ═══════════════════════════════════════════════════════════════════ */}
      <NeonFloor
        width={stageConfig.width}
        depth={stageConfig.depth}
        showGrid={showFloorGrid}
        beatIntensity={beatIntensity}
      />
      
      {showTruss && (
        <HyperionTruss
          width={stageConfig.width}
          depth={stageConfig.depth}
          height={stageConfig.trussHeight}
          showGlow={quality === 'HQ'}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * FIXTURES — Moving Heads (individual, complex geometry)
       * ═══════════════════════════════════════════════════════════════════ */}
      {movingHeads.map(fixture => (
        <HyperionMovingHead3D
          key={fixture.id}
          fixture={fixture}
          onSelect={onSelect}
          showBeam={showBeams}
          beatIntensity={beatIntensity}
        />
      ))}

      {/* ═══════════════════════════════════════════════════════════════════
       * FIXTURES — PARs (simpler, could be instanced in future)
       * ═══════════════════════════════════════════════════════════════════ */}
      {pars.map(fixture => (
        <HyperionPar3D
          key={fixture.id}
          fixture={fixture}
          onSelect={onSelect}
          showBeam={showBeams}
          beatIntensity={beatIntensity}
        />
      ))}

      {/* ═══════════════════════════════════════════════════════════════════
       * FIXTURES — Strobes (render as PARs for now)
       * ═══════════════════════════════════════════════════════════════════ */}
      {strobes.map(fixture => (
        <HyperionPar3D
          key={fixture.id}
          fixture={fixture}
          onSelect={onSelect}
          showBeam={showBeams}
          beatIntensity={beatIntensity}
        />
      ))}

      {/* ═══════════════════════════════════════════════════════════════════
       * POST-PROCESSING (HQ ONLY — ZERO GPU cost in LQ)
       * 
       * 🔧 WAVE 2205: GUARANTEED BYPASS
       * qualitySettings.postProcessing=false (LQ) → NeonBloom NO SE MONTA.
       * EffectComposer se desmonta COMPLETAMENTE — cero render passes,
       * cero bloom, cero vignette. GPU libre al 100% para fixtures.
       * ═══════════════════════════════════════════════════════════════════ */}
      {qualitySettings.postProcessing && (
        <NeonBloom
          enabled={true}
          intensity={0.4}
          luminanceThreshold={0.85}
          beatIntensity={beatIntensity * 0.15}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  quality = 'HQ',
  showFloorGrid = true,
  showTruss = true,
  showBeams = true,
  onFixtureSelect,
  onMetricsUpdate,
  isVisible = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  })
  const [isInViewport, setIsInViewport] = useState(true)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setIsInViewport(Boolean(entry?.isIntersecting && entry.intersectionRatio > 0))
      },
      { threshold: 0.01 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  const shouldRender = isVisible && isDocumentVisible && isInViewport

  // ── Stage Dimensions (from show file) ─────────────────────────────────────
  // 🏗️ WAVE 4575-B: Dynamic stage config from stageStore — no more hardcoded 12×8
  const stageDims = useStageStore(selectStageDimensions)
  const stageConfig = useMemo<ResolvedStageConfig>(() => {
    const w = stageDims?.width ?? DEFAULT_STAGE_WIDTH
    const d = stageDims?.depth ?? DEFAULT_STAGE_DEPTH
    const h = stageDims?.height ?? DEFAULT_TRUSS_HEIGHT
    const g = stageDims?.gridSize ?? 1
    // Camera pulled back to diagonal × 0.8 so full stage always fits in FOV=50
    const diag = Math.sqrt(w * w + d * d)
    return {
      width: w,
      depth: d,
      trussHeight: h,
      gridSize: g,
      cameraDistance: Math.max(10, diag * 0.8),
    }
  }, [stageDims])

  // ── Selection Handling ────────────────────────────────────────────────────
  // 🛡️ WAVE 2042.13.8: useShallow for stable reference
  const { toggleSelection, select, selectMultiple, deselectAll } = useSelectionStore(useShallow(selectVisualizerActions))

  const handleFixtureSelect = useCallback((id: string, shift: boolean, ctrl: boolean) => {
    if (shift) {
      // Shift+click: Add to selection
      selectMultiple([id])
    } else if (ctrl) {
      // Ctrl+click: Toggle selection
      toggleSelection(id)
    } else {
      // Click: Select only this fixture
      select(id)
    }
    onFixtureSelect?.(id)
  }, [toggleSelection, select, selectMultiple, onFixtureSelect])

  // ── Quality Settings ──────────────────────────────────────────────────────
  const qualitySettings = QUALITY_PRESETS[quality]

  return (
    <div 
      ref={containerRef}
      className={`visualizer-canvas ${className}`}
    >
      <Canvas
        shadows={qualitySettings.shadows}
        dpr={[1, qualitySettings.maxDPR]}
        frameloop={shouldRender ? 'always' : 'never'}
        gl={{
          antialias: quality === 'HQ',
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          // 🔧 WAVE 2204: Kill LQ red tint
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ background: '#050508' }}
        onPointerMissed={() => deselectAll()}
      >
        <Suspense fallback={null}>
          <Scene
            quality={quality}
            showFloorGrid={showFloorGrid}
            showTruss={showTruss}
            showBeams={showBeams}
            stageConfig={stageConfig}
            onSelect={handleFixtureSelect}
            onMetrics={onMetricsUpdate}
          />
        </Suspense>
      </Canvas>

      {/* ═══════════════════════════════════════════════════════════════════
       * WAVE 4575-B: METRICS HUD — Stage dimensions overlay
       * HTML over canvas — zero GPU cost. Shows real stage math to operator.
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="visualizer-stage-hud">
        <span className="visualizer-stage-hud__label">STAGE</span>
        <span className="visualizer-stage-hud__value">
          {stageConfig.width}m × {stageConfig.depth}m
        </span>
        <span className="visualizer-stage-hud__sep">|</span>
        <span className="visualizer-stage-hud__label">BOUNDS</span>
        <span className="visualizer-stage-hud__value">
          X {(-stageConfig.width / 2).toFixed(1)}..{(stageConfig.width / 2).toFixed(1)}m
        </span>
        <span className="visualizer-stage-hud__value">
          Z {(-stageConfig.depth / 2).toFixed(1)}..{(stageConfig.depth / 2).toFixed(1)}m
        </span>
        <span className="visualizer-stage-hud__sep">|</span>
        <span className="visualizer-stage-hud__label">GRID</span>
        <span className="visualizer-stage-hud__value">{stageConfig.gridSize}m</span>
        <span className="visualizer-stage-hud__sep">|</span>
        <span className="visualizer-stage-hud__label">TRUSS</span>
        <span className="visualizer-stage-hud__value">{stageConfig.trussHeight}m</span>
      </div>

      {/* Quality Badge */}
      <div className={`visualizer-quality-badge ${quality.toLowerCase()}`}>
        {quality === 'HQ' ? '✨ 3D HQ' : '⚡ 3D LQ'}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKWARD COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════

/** @deprecated Use VisualizerCanvas instead */
export const Stage3DCanvas = VisualizerCanvas

export default VisualizerCanvas
