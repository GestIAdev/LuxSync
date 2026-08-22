/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛰 OrbitTrailCanvas.tsx — Pan/Tilt trail visualization
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traza pan/tilt de los últimos ~3 segundos con estela decreciente.
 * CRITICAL: rAF loop reads from telemetryBus. NO setState.
 *
 * @module components/vibeLab/scope/OrbitTrailCanvas
 * @version FASE 4.1
 */

import React, { memo, useRef, useEffect } from 'react'
import { vibeLabTelemetryBus, TELEMETRY_INDICES } from '../../../stores/vibeLab/telemetryBus'

interface OrbitTrailCanvasProps {
  size?: number
  /** Número de puntos en la estela (~3s a 60fps = 180). */
  trailLength?: number
}

interface TrailPoint { pan: number; tilt: number }

export const OrbitTrailCanvas: React.FC<OrbitTrailCanvasProps> = memo(
  ({ size = 200, trailLength = 120 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rafRef = useRef<number>(0)
    const trailRef = useRef<TrailPoint[]>([])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.scale(dpr, dpr)

      const cx = size / 2
      const cy = size / 2
      const scale = size * 0.4

      const draw = () => {
        const buf = vibeLabTelemetryBus.read()
        const rawPan = buf[TELEMETRY_INDICES.panPosition] ?? 0
        const rawTilt = buf[TELEMETRY_INDICES.tiltPosition] ?? 0
        // 🛡️ WAVE 7569: NaN SHIELD — telemetry can carry NaN from the Aether
        // engine if a fixture has corrupted pan/tilt. createRadialGradient
        // throws TypeError on non-finite coordinates in Chromium.
        const pan = Number.isFinite(rawPan) ? rawPan : 0
        const tilt = Number.isFinite(rawTilt) ? rawTilt : 0

        // Push to trail
        const trail = trailRef.current
        trail.push({ pan, tilt })
        if (trail.length > trailLength) trail.shift()

        ctx.clearRect(0, 0, size, size)

        // ── Grid cross ──────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(cx, 4); ctx.lineTo(cx, size - 4)
        ctx.moveTo(4, cy); ctx.lineTo(size - 4, cy)
        ctx.stroke()

        // ── Bounding circle ─────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.beginPath()
        ctx.arc(cx, cy, scale, 0, Math.PI * 2)
        ctx.stroke()

        // ── Trail with fading alpha ─────────────────────────────────────
        for (let i = 0; i < trail.length - 1; i++) {
          const alpha = (i / trail.length) * 0.6
          const p0 = trail[i]
          const p1 = trail[i + 1]
          ctx.strokeStyle = `rgba(255, 176, 32, ${alpha})`
          ctx.lineWidth = 1 + (i / trail.length) * 1.5
          ctx.beginPath()
          ctx.moveTo(cx + p0.pan * scale, cy - p0.tilt * scale)
          ctx.lineTo(cx + p1.pan * scale, cy - p1.tilt * scale)
          ctx.stroke()
        }

        // ── Current position (glow dot) ─────────────────────────────────
        const px = cx + pan * scale
        const py = cy - tilt * scale
        // 🛡️ WAVE 7569: Guard before createRadialGradient — throws on NaN
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          rafRef.current = requestAnimationFrame(draw)
          return
        }
        // 🛡️ WAVE 7570: Solid-fill concentric circles instead of
        // createRadialGradient. Position changes every frame so gradient
        // can't be cached. Solid circles = zero CanvasGradient C++ objects.
        for (let s = 4; s >= 1; s--) {
          const r = (8 * s) / 4
          const alpha = 0.9 * (1 - (s - 1) / 4) * 0.4
          ctx.fillStyle = `rgba(255, 176, 32, ${alpha})`
          ctx.beginPath()
          ctx.arc(px, py, r, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(px, py, 2, 0, Math.PI * 2)
        ctx.fill()

        rafRef.current = requestAnimationFrame(draw)
      }

      draw()
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        trailRef.current = []
      }
    }, [size, trailLength])

    return (
      <div className="scope-canvas-wrapper">
        <span className="scope-canvas-title">ORBIT TRAIL</span>
        <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
      </div>
    )
  },
)

OrbitTrailCanvas.displayName = 'OrbitTrailCanvas'
