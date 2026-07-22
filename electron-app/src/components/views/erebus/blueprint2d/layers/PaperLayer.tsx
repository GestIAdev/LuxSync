import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// PaperLayer — Fondo y Textura
// PROYECTO EREBUS FASE 4 — Layer 0
//
// Fondo estático --obs-floor (#14171F).
// Noise 2% mediante data URI pre-generado (sin feTurbulence GPU filter).
//
// PERFIL CRÍTICO: El filtro feTurbulence anterior era GPU-accelerado en
// Chromium y causaba "WebGL Context Lost" durante la transición 2D↔3D
// cuando ambos contextos (WebGL + SVG filter) competían por memoria GPU.
// Reemplazado por un pattern fill estático — cero coste GPU.
// ═══════════════════════════════════════════════════════════════════════════

interface PaperLayerProps {
  x: number
  y: number
  width: number
  height: number
}

// Pre-baked 4×4 noise tile — 2% opacity grain, zero GPU cost
const NOISE_DATA_URI =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="4"%3E%3Crect width="4" height="4" fill="%2314171F"/%3E%3Crect x="0" y="0" width="1" height="1" fill="%23202430" opacity="0.5"/%3E%3Crect x="2" y="1" width="1" height="1" fill="%231a1e28" opacity="0.4"/%3E%3Crect x="1" y="3" width="1" height="1" fill="%23222632" opacity="0.3"/%3E%3Crect x="3" y="2" width="1" height="1" fill="%231c2030" opacity="0.4"/%3E%3C/svg%3E'

export const PaperLayer: React.FC<PaperLayerProps> = ({ x, y, width, height }) => {
  return (
    <>
      <defs>
        <pattern
          id="paper-noise"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <image href={NOISE_DATA_URI} x="0" y="0" width="4" height="4" />
        </pattern>
      </defs>

      {/* Base fill */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--obs-floor, #14171F)"
      />

      {/* Noise overlay — static pattern, no GPU filter */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="url(#paper-noise)"
        opacity={0.15}
      />
    </>
  )
}

export default PaperLayer
