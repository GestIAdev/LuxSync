/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛰 OrbitThumbnail.tsx — Canvas miniatura de trayectoria de patrón
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Dibuja la trayectoria completa de un patrón en un canvas cuadrado pequeño.
 * Usa patternMath.ts (copia desacoplada del VMM) — no importa del runtime.
 *
 * @module components/vibeLab/panels/OrbitThumbnail
 * @version FASE 3.2
 */

import React, { memo, useRef, useEffect } from 'react'
import { samplePatternTrajectory } from './patternMath'

interface OrbitThumbnailProps {
  patternId: string
  size?: number
  accent?: string
  isSelected?: boolean
  animated?: boolean
}

export const OrbitThumbnail: React.FC<OrbitThumbnailProps> = memo(
  ({ patternId, size = 80, accent = '#ffb020', isSelected = false, animated = true }) => {
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

      const cx = size / 2
      const cy = size / 2
      const scale = size * 0.38 // mapear [-1,1] a pixels

      const trajectory = samplePatternTrajectory(patternId, 256)
      if (trajectory.length === 0) return

      let animPhase = 0

      const draw = () => {
        ctx.clearRect(0, 0, size, size)

        // ── Fondo: grid sutil ──────────────────────────────────────────
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(cx, 0); ctx.lineTo(cx, size)
        ctx.moveTo(0, cy); ctx.lineTo(size, cy)
        ctx.stroke()

        // ── Trayectoria completa (línea tenue) ─────────────────────────
        ctx.strokeStyle = isSelected
          ? `${accent}99`
          : 'rgba(255,255,255,0.15)'
        ctx.lineWidth = isSelected ? 1.2 : 0.8
        ctx.beginPath()
        for (let i = 0; i < trajectory.length; i++) {
          const p = trajectory[i]
          const px = cx + p.x * scale
          const py = cy - p.y * scale // invertir Y (canvas Y va hacia abajo)
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.stroke()

        // ── Punto animado (la "luz" recorriendo la trayectoria) ────────
        if (animated) {
          const idx = Math.floor((animPhase % 1) * trajectory.length)
          const p = trajectory[idx]
          const px = cx + p.x * scale
          const py = cy - p.y * scale

          // Glow
          const grad = ctx.createRadialGradient(px, py, 0, px, py, 6)
          grad.addColorStop(0, accent)
          grad.addColorStop(1, `${accent}00`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(px, py, 6, 0, Math.PI * 2)
          ctx.fill()

          // Núcleo
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px, py, 1.5, 0, Math.PI * 2)
          ctx.fill()

          animPhase += 0.004
          rafRef.current = requestAnimationFrame(draw)
        }
      }

      draw()

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }, [patternId, size, accent, isSelected, animated])

    return (
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block' }}
        className={`orbit-thumbnail ${isSelected ? 'selected' : ''}`}
      />
    )
  },
)

OrbitThumbnail.displayName = 'OrbitThumbnail'
