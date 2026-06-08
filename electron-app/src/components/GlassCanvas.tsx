import { useEffect, useRef } from 'react'

const CANVAS_W = 800
const CANVAS_H = 200

export default function GlassCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestView = useRef<Float32Array | null>(null)
  const rafId = useRef<number>(0)

  useEffect(() => {
    if (!window.glass) {
      console.warn('[GlassCanvas] window.glass no disponible')
      return
    }

    const unsubscribe = window.glass.onFrame((view) => {
      latestView.current = view
    })

    const loop = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const view = latestView.current
      const w = canvas.width
      const h = canvas.height

      if (view && view.length > 0) {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, w, h)

        const intensity = Math.min(1, Math.max(0, view[0] / 255))
        const barW = w * intensity

        const gradient = ctx.createLinearGradient(0, 0, w, 0)
        gradient.addColorStop(0, '#00ff88')
        gradient.addColorStop(0.5, '#ffcc00')
        gradient.addColorStop(1, '#ff3344')
        ctx.fillStyle = gradient
        ctx.fillRect(0, h * 0.3, barW, h * 0.4)

        ctx.strokeStyle = '#333'
        ctx.lineWidth = 1
        ctx.strokeRect(0, h * 0.3, w, h * 0.4)

        ctx.fillStyle = '#aaa'
        ctx.font = '11px monospace'
        ctx.fillText('view[0] = ' + view[0].toFixed(1), 8, h - 12)
        ctx.fillText('len = ' + view.length + ' floats', w - 140, h - 12)

        window.glass.ackFrame()
      } else {
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#333'
        ctx.font = '12px monospace'
        ctx.fillText('Esperando frames del Glass Bridge...', 16, h / 2 + 4)
      }

      rafId.current = requestAnimationFrame(loop)
    }

    rafId.current = requestAnimationFrame(loop)

    return () => {
      unsubscribe()
      cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        border: '1px solid #222',
        borderRadius: 6,
        display: 'block',
      }}
    />
  )
}