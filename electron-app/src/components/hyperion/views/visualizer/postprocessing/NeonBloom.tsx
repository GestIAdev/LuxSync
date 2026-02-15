/**
 * ☀️ HYPERION — NeonBloom Post-Processing
 * 
 * Bloom selectivo HDR que hace brillar los fixtures encendidos.
 * Solo se activa en modo HQ — desactivado en LQ para performance.
 * 
 * 🎨 WAVE 2042.14: NEON TUNING
 * - luminanceThreshold alto (0.8) = solo brilla lo muy brillante
 * - radius grande (0.6) = glow suave y difuso
 * - mipmapBlur = calidad cinematográfica
 * - Beat modulation sutil para no saturar
 * 
 * @module components/hyperion/views/visualizer/postprocessing/NeonBloom
 * @since WAVE 2042.6 (Project Hyperion — Phase 4)
 * @updated WAVE 2042.14 — Neon tuning for professional look
 */

import React, { useMemo } from 'react'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface NeonBloomProps {
  /** ¿Activar post-processing? */
  enabled?: boolean
  /** Intensidad del bloom (0-2) */
  intensity?: number
  /** Threshold de luminancia (0-1) - higher = only brightest glow */
  luminanceThreshold?: number
  /** Suavizado de luminancia (0-1) */
  luminanceSmoothing?: number
  /** Radio del bloom - larger = softer glow */
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
 * 🎨 WAVE 2042.14: Professional HDR bloom stack
 * - Bloom: Soft glow from emissive materials
 * - Vignette: Subtle darkening at edges for cinematic feel
 */
export const NeonBloom: React.FC<NeonBloomProps> = ({
  enabled = true,
  intensity = 0.8,
  luminanceThreshold = 0.9,
  luminanceSmoothing = 0.3,
  radius = 0.5,
  beatIntensity = 0,
}) => {
  if (!enabled) return null

  // Very subtle beat modulation
  const adjustedIntensity = intensity + beatIntensity * 0.1

  return (
    <EffectComposer multisampling={0}>
      {/* 🌟 BLOOM - The main glow effect */}
      <Bloom
        intensity={adjustedIntensity}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={luminanceSmoothing}
        radius={radius}
        mipmapBlur
        levels={5}
      />
      
      {/* 🎬 VIGNETTE - Subtle edge darkening for cinematic look */}
      <Vignette
        offset={0.3}
        darkness={0.4}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}

export default NeonBloom
