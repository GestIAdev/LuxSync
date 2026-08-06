/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 ThermalVector.tsx — Overlay del vector de gravedad térmica
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Muestra el atmosphericTemp (Kelvin) como un gradiente y dibuja un vector
 * animado que indica la dirección del arrastre térmico hacia el polo
 * (cálido o frío). Zona neutral 5800-6200K = sin arrastre.
 *
 * @module components/vibeLab/panels/ThermalVector
 * @version FASE 3.2
 */

import React, { memo, useMemo, useRef, useEffect } from 'react'
import { useVibeLabStore, useGene } from '../../../stores/vibeLabStore'
import { getByPath } from '../../../engine/vibe/custom/pathUtils'
import { COLOR_CONSTITUTIONS } from '../../../engine/color/colorConstitutions'
import './thermal-vector.css'

interface ThermalVectorProps {
  size?: number
}

// Temperatura a color aproximado (planckian locus simplificado)
function kelvinToRGB(kelvin: number): string {
  const t = kelvin / 100
  let r: number, g: number, b: number

  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }

  r = Math.max(0, Math.min(255, r))
  g = Math.max(0, Math.min(255, g))
  b = Math.max(0, Math.min(255, b))
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

export const ThermalVector: React.FC<ThermalVectorProps> = memo(({ size = 120 }) => {
  const draft = useVibeLabStore((s) => s.draft)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const baseDNA = draft?.baseDNA ?? 'techno-club'
  const baseTemp = useMemo(() => {
    const constitution = COLOR_CONSTITUTIONS[baseDNA as keyof typeof COLOR_CONSTITUTIONS]
    if (!constitution) return 5800
    return (getByPath(constitution as unknown as Record<string, unknown>, 'thermal.atmosphericTemp') as number) ?? 5800
  }, [baseDNA])

  const { value } = useGene<number>('color.thermal.atmosphericTemp', baseTemp)
  const temp = typeof value === 'number' ? value : baseTemp

  // Determinar dirección del arrastre
  const { isNeutral, direction, strength } = useMemo(() => {
    const NEUTRAL_LOW = 5800
    const NEUTRAL_HIGH = 6200
    if (temp >= NEUTRAL_LOW && temp <= NEUTRAL_HIGH) {
      return { isNeutral: true, direction: 0, strength: 0 }
    }
    // Frío → arrastra hacia azul (arriba), Cálido → hacia rojo (abajo)
    const dir = temp < NEUTRAL_LOW ? -1 : 1
    const dist = Math.abs(temp - (dir < 0 ? NEUTRAL_LOW : NEUTRAL_HIGH))
    const str = Math.min(1, dist / 3000)
    return { isNeutral: false, direction: dir, strength: str }
  }, [temp])

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
    let phase = 0

    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      // ── Gradiente de temperatura de fondo ───────────────────────────
      const grad = ctx.createLinearGradient(0, 0, 0, size)
      grad.addColorStop(0, kelvinToRGB(10000)) // frío arriba
      grad.addColorStop(0.5, kelvinToRGB(6000)) // neutral centro
      grad.addColorStop(1, kelvinToRGB(2000)) // cálido abajo
      ctx.fillStyle = grad
      ctx.globalAlpha = 0.15
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      // ── Marcador de zona neutral ────────────────────────────────────
      const neutralY1 = cy - (size * 0.1)
      const neutralY2 = cy + (size * 0.1)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(4, neutralY1); ctx.lineTo(size - 4, neutralY1)
      ctx.moveTo(4, neutralY2); ctx.lineTo(size - 4, neutralY2)
      ctx.stroke()
      ctx.setLineDash([])

      // ── Punto de temperatura actual ─────────────────────────────────
      const tempY = cy + ((temp - 6000) / 4000) * (size / 2 - 6)
      const tempColor = kelvinToRGB(temp)
      ctx.fillStyle = tempColor
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, Math.max(4, Math.min(size - 4, tempY)), 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // ── Vector de arrastre animado ──────────────────────────────────
      if (!isNeutral && strength > 0) {
        const vecLen = (size / 3) * strength
        const vecY = tempY + direction * vecLen * (0.8 + 0.2 * Math.sin(phase))
        const arrowSize = 6

        ctx.strokeStyle = direction < 0 ? '#4488ff' : '#ff6644'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, tempY)
        ctx.lineTo(cx, vecY)
        ctx.stroke()

        // Flecha
        ctx.fillStyle = direction < 0 ? '#4488ff' : '#ff6644'
        ctx.beginPath()
        if (direction < 0) {
          ctx.moveTo(cx, vecY - arrowSize)
          ctx.lineTo(cx - arrowSize / 2, vecY)
          ctx.lineTo(cx + arrowSize / 2, vecY)
        } else {
          ctx.moveTo(cx, vecY + arrowSize)
          ctx.lineTo(cx - arrowSize / 2, vecY)
          ctx.lineTo(cx + arrowSize / 2, vecY)
        }
        ctx.closePath()
        ctx.fill()

        phase += 0.05
      }

      // ── Label ───────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${temp}K`, cx, size - 4)

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [size, temp, isNeutral, direction, strength])

  return (
    <div className="thermal-vector">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block' }}
      />
      <div className="thermal-vector-info">
        <span className="tv-label">{isNeutral ? 'NEUTRAL' : direction < 0 ? 'COLD DRAG' : 'WARM DRAG'}</span>
        <span className="tv-strength">{Math.round(strength * 100)}%</span>
      </div>
    </div>
  )
})

ThermalVector.displayName = 'ThermalVector'
