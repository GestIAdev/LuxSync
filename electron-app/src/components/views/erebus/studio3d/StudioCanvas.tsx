import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { StudioAtmosphere } from './environment/StudioAtmosphere'
import { StudioFloor } from './environment/StudioFloor'
import { ServiceLighting } from './environment/ServiceLighting'

// ═══════════════════════════════════════════════════════════════════════════
// StudioCanvas — El Motor R3F
// PROYECTO EREBUS FASE 2
//
// Ocupa el 100% del contenedor padre (centro libre de ErebusShell).
// z-index inferior a los satélites HUD.
// Tone mapping neutro, fondo --obs-void, DPR capped for performance.
// ═══════════════════════════════════════════════════════════════════════════

interface StudioCanvasProps {
  quality?: 'HQ' | 'LQ'
}

const HQ_DPR: [number, number] = [1, 1.5]
const LQ_DPR: [number, number] = [1, 1]

export const StudioCanvas: React.FC<StudioCanvasProps> = ({ quality = 'HQ' }) => {
  const isHQ = quality === 'HQ'
  const dpr = isHQ ? HQ_DPR : LQ_DPR

  return (
    <Canvas
      shadows={isHQ}
      dpr={dpr}
      frameloop="always"
      gl={{
        antialias: isHQ,
        alpha: false,
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
        {/* Environment */}
        <StudioAtmosphere quality={quality} />
        <ServiceLighting />
        <StudioFloor quality={quality} />

        {/* Placeholder camera — future: OrbitControls from drei */}
        {/* Placeholder content — fixtures, rigs, calibration beams in Phase 3+ */}
      </Suspense>
    </Canvas>
  )
}

export default StudioCanvas
