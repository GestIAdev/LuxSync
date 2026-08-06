/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 PaletteStripCanvas.tsx — 5-color live swatch
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CRITICAL: rAF loop reads from telemetryBus. NO setState.
 *
 * @module components/vibeLab/scope/PaletteStripCanvas
 * @version FASE 4.1
 */

import React, { memo, useRef, useEffect } from 'react'
import { vibeLabTelemetryBus, TELEMETRY_INDICES } from '../../../stores/vibeLab/telemetryBus'

interface PaletteStripCanvasProps {
  width?: number
  height?: number
}

const PALETTE_NAMES = ['Primary', 'Secondary', 'Ambient', 'Accent', 'Strobe']
const H_INDICES = [
  TELEMETRY_INDICES.palettePrimaryH,
  TELEMETRY_INDICES.paletteSecondaryH,
  TELEMETRY_INDICES.paletteAmbientH,
  TELEMETRY_INDICES.paletteAccentH,
  TELEMETRY_INDICES.paletteStrobeH,
]
const S_INDICES = [
  TELEMETRY_INDICES.palettePrimaryS,
  TELEMETRY_INDICES.paletteSecondaryS,
  TELEMETRY_INDICES.paletteAmbientS,
  TELEMETRY_INDICES.paletteAccentS,
  TELEMETRY_INDICES.paletteStrobeS,
]
const L_INDICES = [
  TELEMETRY_INDICES.palettePrimaryL,
  TELEMETRY_INDICES.paletteSecondaryL,
  TELEMETRY_INDICES.paletteAmbientL,
  TELEMETRY_INDICES.paletteAccentL,
  TELEMETRY_INDICES.paletteStrobeL,
]

export const PaletteStripCanvas: React.FC<PaletteStripCanvasProps> = memo(
  ({ width = 240, height = 60 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number>(0)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      const swatchW = (width - 4) / 5
      const swatchH = height - 20

      const draw = () => {
        const buf = vibeLabTelemetryBus.read()
        ctx.clearRect(0, 0, width, height)

        for (let i = 0; i < 5; i++) {
          const h = buf[H_INDICES[i]] ?? 0
          const s = buf[S_INDICES[i]] ?? 0
          const l = buf[L_INDICES[i]] ?? 50
          const x = 2 + i * swatchW

          // Swatch
          ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%)`
          ctx.fillRect(x, 2, swatchW - 2, swatchH)
          ctx.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(x, 2, swatchW - 2, swatchH)

          // Label
          ctx.fillStyle = 'rgba(255,255,255,0.4)'
          ctx.font = '7px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(PALETTE_NAMES[i], x + swatchW / 2, height - 6)
        }

        rafRef.current = requestAnimationFrame(draw)
      }

      draw()
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }, [width, height])

    return (
      <div className="scope-canvas-wrapper">
        <span className="scope-canvas-title">PALETTE</span>
        <canvas ref={canvasRef} style={{ width, height, display: 'block' }} />
      </div>
    )
  },
)

PaletteStripCanvas.displayName = 'PaletteStripCanvas'
