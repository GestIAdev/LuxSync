/**
 * ☀️ HYPERION — NeonBloom Post-Processing
 * 
 * Bloom selectivo que hace brillar los fixtures encendidos.
 * Solo se activa en modo HQ — desactivado en LQ para performance.
 * 
 * @module components/hyperion/views/visualizer/postprocessing/NeonBloom
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 * @updated WAVE 2042.10 — Post-processing packages installed
 */

import React from 'react'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface NeonBloomProps {
  /** ¿Activar post-processing? */
  enabled?: boolean
  /** Intensidad del bloom (0-2) */
  intensity?: number
  /** Threshold de luminancia (0-1) */
  luminanceThreshold?: number
  /** Suavizado de luminancia (0-1) */
  luminanceSmoothing?: number
  /** Radio del bloom */
  radius?: number
  /** Intensidad del beat (para pulsación) */
  beatIntensity?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * NeonBloom Post-Processing
 * 
 * Bloom HDR que hace brillar los fixtures con emissive materials.
 * Ajusta intensidad con el beat para pulsación dinámica.
 */
export const NeonBloom: React.FC<NeonBloomProps> = ({
  enabled = true,
  intensity = 0.8,
  luminanceThreshold = 0.6,
  luminanceSmoothing = 0.3,
  radius = 0.4,
  beatIntensity = 0,
}) => {
  if (!enabled) return null

  // Ajustar intensidad con beat (pulsación dinámica)
  const adjustedIntensity = intensity + beatIntensity * 0.3

  return (
    <EffectComposer>
      <Bloom
        intensity={adjustedIntensity}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={luminanceSmoothing}
        radius={radius}
        mipmapBlur
      />
    </EffectComposer>
  )
}

export default NeonBloom
