/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📡 RigMonitorCanvas.tsx — 7-zone pulsing visualization
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CRITICAL: This canvas uses a rAF loop that reads directly from
 * vibeLabTelemetryBus.read(). NO React setState for per-frame updates.
 *
 * @module components/vibeLab/scope/RigMonitorCanvas
 * @version FASE 4.1
 */

import React, { memo, useRef, useEffect } from 'react'
import { vibeLabTelemetryBus, TELEMETRY_INDICES } from '../../../stores/vibeLab/telemetryBus'

interface RigMonitorCanvasProps {
  size?: number
}

const ZONE_NAMES = ['Front L', 'Front R', 'Mover L', 'Mover R', 'Back L', 'Back R', 'Ambient']
const ZONE_INDICES = [
  TELEMETRY_INDICES.zoneFrontL,
  TELEMETRY_INDICES.zoneFrontR,
  TELEMETRY_INDICES.zoneMoverL,
  TELEMETRY_INDICES.zoneMoverR,
  TELEMETRY_INDICES.zoneBackL,
  TELEMETRY_INDICES.zoneBackR,
  TELEMETRY_INDICES.zoneAmbient,
]

// Zone positions on the canvas (normalized 0..1)
const ZONE_POS = [
  { x: 0.25, y: 0.7, label: 'FL' },  // Front L
  { x: 0.75, y: 0.7, label: 'FR' },  // Front R
  { x: 0.15, y: 0.4, label: 'ML' },  // Mover L
  { x: 0.85, y: 0.4, label: 'MR' },  // Mover R
  { x: 0.3, y: 0.15, label: 'BL' },  // Back L
  { x: 0.7, y: 0.15, label: 'BR' },  // Back R
  { x: 0.5, y: 0.5, label: 'AM' },   // Ambient (center)
]

export const RigMonitorCanvas: React.FC<RigMonitorCanvasProps> = memo(({ size = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const draw = () => {
      const buf = vibeLabTelemetryBus.read()
      ctx.clearRect(0, 0, size, size)

      // ── Background grid ─────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(4, 4, size - 8, size - 8)

      // ── Draw zones ──────────────────────────────────────────────────
      for (let i = 0; i < 7; i++) {
        const rawIntensity = buf[ZONE_INDICES[i]] ?? 0
        // 🛡️ WAVE 7569: NaN SHIELD — telemetry can carry NaN from the Aether
        // engine. createRadialGradient throws TypeError on non-finite radius.
        const intensity = Number.isFinite(rawIntensity) ? rawIntensity : 0
        const pos = ZONE_POS[i]
        const cx = pos.x * size
        const cy = pos.y * size
        const baseR = size * 0.06
        const glowR = baseR + intensity * baseR * 2

        // Glow — 🛡️ WAVE 7570: Solid-fill concentric circles instead of
        // createRadialGradient. The gradient radius changes every frame
        // (depends on intensity), so it can't be cached. Solid circles
        // achieve the same glow effect with zero CanvasGradient C++ objects.
        if (intensity > 0.01 && Number.isFinite(glowR) && glowR > 0) {
          const steps = 4
          for (let s = steps; s >= 1; s--) {
            const r = (glowR * s) / steps
            const alpha = (0.6 * intensity) * (1 - (s - 1) / steps) * 0.4
            ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`
            ctx.beginPath()
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
            ctx.fill()
          }
        }

        // Core circle
        ctx.fillStyle = `rgba(0, 229, 255, ${0.2 + intensity * 0.6})`
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + intensity * 0.4})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '7px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(pos.label, cx, cy + baseR + 8)
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [size])

  return (
    <div className="scope-canvas-wrapper">
      <span className="scope-canvas-title">RIG MONITOR</span>
      <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
    </div>
  )
})

RigMonitorCanvas.displayName = 'RigMonitorCanvas'
