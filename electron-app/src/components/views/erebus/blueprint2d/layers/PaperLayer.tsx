import React, { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// PaperLayer — Fondo y Textura
// PROYECTO EREBUS FASE 4 — Layer 0
//
// Fondo estático --obs-floor (#14171F).
// Filtro SVG de ruido sutil (2%) que emula grano de plano impreso.
// ═══════════════════════════════════════════════════════════════════════════

interface PaperLayerProps {
  x: number
  y: number
  width: number
  height: number
}

export const PaperLayer: React.FC<PaperLayerProps> = ({ x, y, width, height }) => {
  // Unique filter ID to avoid collisions
  const filterId = useMemo(() => `blueprint-noise-${Math.random().toString(36).slice(2, 9)}`, [])

  return (
    <>
      <defs>
        {/* Noise filter — 2% grain */}
        <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="matrix"
            values="
              0 0 0 0 0.078
              0 0 0 0 0.090
              0 0 0 0 0.122
              0 0 0 0.02 0
            "
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>

      {/* Base fill */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--obs-floor, #14171F)"
      />

      {/* Noise overlay */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--obs-floor, #14171F)"
        filter={`url(#${filterId})`}
      />
    </>
  )
}

export default PaperLayer
