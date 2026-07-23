import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { StudioAtmosphere } from './environment/StudioAtmosphere'
import { StudioFloor } from './environment/StudioFloor'
import { ServiceLighting } from './environment/ServiceLighting'
import { CrystalEdges } from './environment/CrystalEdges'
import { DragDropController3D } from './interaction/DragDropController3D'
import { MeasureLayer3D } from './interaction/MeasureLayer3D'
import { RigSystem } from './rigging/RigSystem'
import { CameraLerpController } from '../transition/ViewTransitionDirector'
import type { CameraKeyframe } from '../transition/ProjectionLerp'
import type { ToolMode } from '../ErebusShell'
import { useSelectionStore } from '../../../../stores/selectionStore'

// ═══════════════════════════════════════════════════════════════════════════
// StudioCanvas — El Motor R3F
// PROYECTO EREBUS — FASE 2 + FASE 5
//
// Ocupa el 100% del contenedor padre (centro libre de ErebusShell).
// z-index inferior a los satélites HUD.
// Tone mapping neutro, fondo --obs-void, DPR capped for performance.
// FASE 5: CameraLerpController para transición cinematográfica 2D↔3D.
// ═══════════════════════════════════════════════════════════════════════════

interface StudioCanvasProps {
  quality?: 'HQ' | 'LQ'
  /** Opacity for crossfade during transition (0→1) */
  opacity?: number
  /** Whether a transition is in progress (enables camera lerp) */
  isTransitioning?: boolean
  /** Getter for interpolated camera keyframe */
  getCameraKeyframe?: () => CameraKeyframe | null
  /** Active tool mode */
  toolMode?: ToolMode
}

const HQ_DPR: [number, number] = [1, 1.5]
const LQ_DPR: [number, number] = [1, 1]

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  quality = 'HQ',
  opacity = 1,
  isTransitioning = false,
  getCameraKeyframe,
  toolMode = 'select',
}) => {
  const isHQ = quality === 'HQ'
  const dpr = isHQ ? HQ_DPR : LQ_DPR
  const deselectAll = useSelectionStore(s => s.deselectAll)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity,
        transition: isTransitioning ? 'none' : 'opacity 200ms ease-out',
        pointerEvents: opacity < 0.5 ? 'none' : 'auto',
      }}
    >
    <Canvas
      shadows={isHQ}
      dpr={dpr}
      frameloop="always"
      onPointerMissed={() => deselectAll()}
      gl={{
        antialias: isHQ,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.9,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#0B0D12',
        zIndex: 1,
      }}
      camera={{
        position: [8, 6, 12],
        fov: 50,
        near: 0.1,
        far: 100,
      }}
    >
      <Suspense fallback={null}>
        {/* Camera transition controller */}
        {isTransitioning && getCameraKeyframe && (
          <CameraLerpController
            getCameraKeyframe={getCameraKeyframe}
            isTransitioning={isTransitioning}
          />
        )}

        {/* Environment */}
        <StudioAtmosphere quality={quality} />
        <ServiceLighting />
        <StudioFloor quality={quality} />
        <CrystalEdges />

        {/* FASE 6: Interaction (renders FixtureLayer3D internally with pointer handlers) */}
        <DragDropController3D toolMode={toolMode} />

        {/* Rig System — renders all rigs + handles rig tool mode */}
        <RigSystem toolMode={toolMode} />

        {/* Measure Tool (3D) */}
        <MeasureLayer3D toolMode={toolMode} />

        {/* Camera controls — disabled during transition and non-interactive tool modes */}
        <OrbitControls
          enabled={!isTransitioning && (toolMode === 'select' || toolMode === 'move')}
          makeDefault
        />
      </Suspense>
    </Canvas>
    </div>
  )
}

export default StudioCanvas
