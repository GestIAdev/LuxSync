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
      {/* Base fill — data-bg marks this as the lasso-clickable background */}
      <rect
        data-bg="true"
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--obs-floor, #14171F)"
      />

      {/* Subtle texture overlay — solid fill, no pattern dependency */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="var(--obs-surface, #1B1F2A)"
        opacity={0.03}
      />
    </>
  )
}

export default PaperLayer
