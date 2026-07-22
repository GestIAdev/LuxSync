import React from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// PaperLayer — Fondo y Textura
// PROYECTO EREBUS FASE 4 — Layer 0
//
// Fondo estático --obs-floor (#14171F).
// Noise 2% mediante pattern fill (definido en BlueprintCanvas <defs>).
// Sin defs propios — el pattern "paper-noise" vive en la raíz del SVG.
// ═══════════════════════════════════════════════════════════════════════════

interface PaperLayerProps {
  x: number
  y: number
  width: number
  height: number
}

export const PaperLayer: React.FC<PaperLayerProps> = ({ x, y, width, height }) => {
  return (
    <>
      {/* Base fill */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--obs-floor, #14171F)"
      />

      {/* Noise overlay — pattern definido en BlueprintCanvas <defs> */}
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
