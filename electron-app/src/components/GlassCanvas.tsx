import { useEffect, useRef } from 'react'
import { getTransientTruth } from '../stores/transientStore'
import { useTruthStore } from '../stores/truthStore'

const CANVAS_W = 800
const CANVAS_H = 200

export default function GlassCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestView = useRef<Float32Array | null>(null)
  const rafId = useRef<number>(0)

  const isSubscribedRef = useRef(false)

  useEffect(() => {
    let _glassFrameCount = 0
    let unsubscribe: (() => void) | null = null

    const connect = () => {
      if (!window.glass || isSubscribedRef.current) return

      unsubscribe = window.glass.onFrame((view) => {
        _glassFrameCount++
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
      
      // 2. Fixtures (desde offset 10) — 🛠️ WAVE 6018 PARCHE 1: Zero-allocation in-place mutation
      // NO recrear array ni Map — mutar objetos existentes para preservar referencias de fixtureIndex.
      const fixtures = useTruthStore.getState().truth?.hardware?.fixtures
      if (fixtures && fixtures.length > 0) {
        if (!transient.hardware) (transient as any).hardware = { fixtures: [] }
        const transientFixtures = transient.hardware.fixtures
        
        for (let i = 0; i < fixtures.length; i++) {
          const off = 10 + i * 16
          const id = fixtures[i]?.id
          if (!id) continue
          
          let tFix: any = transientFixtures.find((f: any) => f.id === id)
          if (!tFix) {
            tFix = { id, name: fixtures[i].name, type: fixtures[i].type, zone: fixtures[i].zone }
            transientFixtures.push(tFix)
          }
          
          tFix.color = { r: view[off], g: view[off+1], b: view[off+2] }
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