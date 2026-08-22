import { useEffect, useRef } from 'react'
import { getTransientTruth, getTransientFixture } from '../stores/transientStore'

const CANVAS_W = 800
const CANVAS_H = 200

export default function GlassCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestView = useRef<Float32Array | null>(null)
  const rafId = useRef<number>(0)

  const isSubscribedRef = useRef(false)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null

    const connect = () => {
      if (!window.glass || isSubscribedRef.current) return

      unsubscribe = window.glass.onFrame((view) => {
        latestView.current = view
      
      // 🩸 WAVE-6018: Inyectar telemetria directamente en transientStore (44Hz, zero React cost)
      const transient = getTransientTruth()
      if (!transient || !view || view.length === 0) return
      
      // 1. Cabecera de Audio (Indices 0-4)
      if (transient.sensory?.audio) {
        transient.sensory.audio.bass = view[0]
        transient.sensory.audio.mid = view[1]
        transient.sensory.audio.high = view[2]
        transient.sensory.audio.energy = view[3]
      }
      if (transient.sensory?.beat) {
        transient.sensory.beat.onBeat = view[4] > 0.5
      }
      
      // 2. Fixtures (desde offset 10) — WAVE 7174: Leer IDs de transientStore (no truthStore que está vacío)
      // O(1) lookup via getTransientFixture() — zero Array.find(), zero allocation.
      const fixtures = transient.hardware?.fixtures
      if (fixtures && fixtures.length > 0) {
        for (let i = 0; i < fixtures.length; i++) {
          const off = 10 + i * 16
          const id = fixtures[i]?.id
          if (!id) continue

          const tFix: any = getTransientFixture(id)
          if (!tFix) continue

          // OOM-FIX: Mutate color in-place — zero allocation per frame.
          // Antes: tFix.color = { r, g, b } → 1 new object/fixture/frame (2,200 objs/sec @ 50 fixtures).
          if (!tFix.color) tFix.color = { r: 0, g: 0, b: 0 }
          tFix.color.r = view[off]
          tFix.color.g = view[off + 1]
          tFix.color.b = view[off + 2]
          tFix.dimmer = view[off+5] / 255
          tFix.intensity = view[off+5] / 255
          tFix.physicalPan = view[off+8] / 255
          tFix.physicalTilt = view[off+9] / 255
          tFix.zoom = view[off+10]
          tFix.focus = view[off+11]
          tFix.panVelocity = view[off+12]
          tFix.tiltVelocity = view[off+13]
          tFix.active = view[off+5] > 0
        }
      }
    })

      isSubscribedRef.current = true
    }

    if (window.glass) {
      connect()
    } else {
      window.addEventListener('glass:ready', connect)
    }

    // 🛡️ WAVE 7570: Cache the gradient — it's identical every frame (same
    // colors, same dimensions). Creating a new CanvasGradient C++ object at
    // 60fps leaks ~162k C++ objects in 45min. Cache it once per canvas size.
    let cachedGradient: CanvasGradient | null = null
    let cachedW = 0

    const loop = () => {
      // 🛡️ WAVE 7570: Pause rAF when document is hidden — zero burn in background.
      if (document.hidden) {
        rafId.current = requestAnimationFrame(loop)
        return
      }

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

        // 🛡️ WAVE 7570: Reuse cached gradient if width hasn't changed.
        if (!cachedGradient || cachedW !== w) {
          cachedGradient = ctx.createLinearGradient(0, 0, w, 0)
          cachedGradient.addColorStop(0, '#00ff88')
          cachedGradient.addColorStop(0.5, '#ffcc00')
          cachedGradient.addColorStop(1, '#ff3344')
          cachedW = w
        }
        ctx.fillStyle = cachedGradient
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
      if (unsubscribe) unsubscribe()
      window.removeEventListener('glass:ready', connect)
      cancelAnimationFrame(rafId.current)
      // CRÍTICO: Permitir re-suscripción tras remounts de React (StrictMode, HMR, etc.)
      isSubscribedRef.current = false
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        display: 'none',
      }}
    />
  )
}