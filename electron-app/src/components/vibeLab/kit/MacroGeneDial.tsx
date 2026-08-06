/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ MacroGeneDial.tsx — Circular dial for Macro Genes (0..1)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dial circular de 270° para los 5 Macro Genes (aggression, viscosity,
 * thermalBias, spatialReach, nervousness). Valor 0..1. Drag vertical para
 * ajustar. SVG para el arco + aguja.
 *
 * @module components/vibeLab/kit/MacroGeneDial
 * @version FASE 2 — The Instrument Kit
 */

import React, { memo, useCallback, useRef, useMemo } from 'react'
import type { MacroGeneDialProps } from './types'
import './kit-variables.css'
import './macro-gene-dial.css'

// ═══════════════════════════════════════════════════════════════════════════
// GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════

const SIZE = 64
const CENTER = SIZE / 2
const RADIUS = 24
const STROKE_WIDTH = 4
const START_ANGLE = 135 // grados, abajo-izquierda
const SWEEP = 270 // grados del arco

/** Convierte un valor 0..1 a un ángulo en grados. */
function valueToAngle(value: number): number {
  return START_ANGLE + value * SWEEP
}

/** Convierte grados a coordenadas (x, y) en el SVG. */
function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle - 90) * (Math.PI / 180)
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

/** Describe un arco SVG desde `start` hasta `end` (valores 0..1). */
function describeArc(start: number, end: number): string {
  const startPt = polarToCartesian(valueToAngle(start), RADIUS)
  const endPt = polarToCartesian(valueToAngle(end), RADIUS)
  const largeArc = (end - start) * SWEEP > 180 ? 1 : 0
  return `M ${startPt.x} ${startPt.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${endPt.x} ${endPt.y}`
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const MacroGeneDial: React.FC<MacroGeneDialProps> = memo(({
  id,
  label,
  icon,
  accentHex,
  description,
  value,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  const clampedValue = Math.max(0, Math.min(1, value))

  const needleAngle = useMemo(() => valueToAngle(clampedValue), [clampedValue])
  const needlePt = useMemo(() => polarToCartesian(needleAngle, RADIUS - 2), [needleAngle])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startValue: clampedValue }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [clampedValue],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const deltaY = dragRef.current.startY - e.clientY
      // 150px de drag = rango completo 0..1
      const deltaValue = deltaY / 150
      const newValue = Math.max(0, Math.min(1, dragRef.current.startValue + deltaValue))
      onChange(newValue)
    },
    [onChange],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  const handleDoubleClick = useCallback(() => {
    onChange(0.5) // reset al centro
  }, [onChange])

  return (
    <div
      className="macro-gene-dial"
      style={{ '--vl-accent': accentHex } as React.CSSProperties}
      title={description}
    >
      <div
        className="macro-gene-dial-svg-wrapper"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track de fondo (arco completo 270°) */}
          <path
            d={describeArc(0, 1)}
            fill="none"
            stroke="var(--vl-bg-track)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
          {/* Fill hasta el valor actual */}
          <path
            d={describeArc(0, clampedValue)}
            fill="none"
            stroke="var(--vl-accent)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px var(--vl-accent-glow))` }}
          />
          {/* Aguja */}
          <line
            x1={CENTER}
            y1={CENTER}
            x2={needlePt.x}
            y2={needlePt.y}
            stroke="var(--vl-bg-thumb)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Centro */}
          <circle cx={CENTER} cy={CENTER} r={3} fill="var(--vl-accent)" />
        </svg>
        <span className="macro-gene-dial-icon">{icon}</span>
      </div>
      <div className="macro-gene-dial-info">
        <span className="macro-gene-dial-label">{label}</span>
        <span className="macro-gene-dial-value">{(clampedValue * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
})

MacroGeneDial.displayName = 'MacroGeneDial'
