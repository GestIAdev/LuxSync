/**
 * 🎬 WAVE 4864 — THEIA OUTPUT VIEW (Phase 3)
 *
 * Componente hiper-ligero que se monta SOLO en la ventana secundaria del
 * proyector Theia (BrowserWindow gestionada por `TheiaWindowManager`).
 *
 * Responsabilidades:
 *  - Solicitar el `SharedArrayBuffer` del video pipeline al main process.
 *  - Adjuntar un `VideoFrameReader` sobre ese SAB.
 *  - Loop `requestAnimationFrame` que blittea el último frame válido en un
 *    `<canvas>` fullscreen mediante `putImageData`.
 *
 * Reglas de oro:
 *  - Cero estado React (excepto el ref del canvas). Toda la lógica vive en
 *    el rAF — React no re-renderiza una sola vez tras el mount.
 *  - Si no hay frame todavía, el canvas queda negro (background CSS).
 *  - El reader respeta `producerSeq`: solo redibuja cuando hay frame nuevo.
 *  - El canvas se redimensiona al `window.innerWidth/Height` en cada resize
 *    y el frame se escala con `drawImage` desde un offscreen buffer.
 */

import { useEffect, useRef } from 'react'
import { VideoFrameReader } from '../../../theia/SharedVideoFrameBuffer'
import './TheiaOutputView.css'

// ─────────────────────────────────────────────────────────────────────────
// IPC bridge
// ─────────────────────────────────────────────────────────────────────────

interface TheiaOutputBridge {
  getVideoFrameBufferSAB: () => Promise<SharedArrayBuffer | null>
}

function getBridge(): TheiaOutputBridge | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lux = (globalThis as any).lux ?? (globalThis as any).window?.lux
  if (!lux || !lux.theia || typeof lux.theia.getVideoFrameBufferSAB !== 'function') {
    return null
  }
  return lux.theia as TheiaOutputBridge
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

const TheiaOutputView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    let cancelled = false
    let reader: VideoFrameReader | null = null
    // Persistent ImageData allocated once per (w,h) — copying SAB→ImageData
    // requires a non-shared backing buffer.
    let imageData: ImageData | null = null
    let imageDataDims = { w: 0, h: 0 }
    // Offscreen canvas para escalar a fullscreen — ImageData no se puede
    // poner directamente con escalado, así que lo blitteamos a una
    // OffscreenCanvas y luego drawImage al canvas visible.
    let offscreen: HTMLCanvasElement | null = null
    let offscreenCtx: CanvasRenderingContext2D | null = null

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resizeCanvas(): void {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    function ensureImageData(w: number, h: number): ImageData {
      if (imageData && imageDataDims.w === w && imageDataDims.h === h) return imageData
      // 🛡️ WAVE 7569: OILPAN GUARD — Reject dimensions that would allocate
      // excessive memory. createImageData(w, h) allocates w*h*4 bytes.
      // 4096×4096×4 = 67MB — anything larger is almost certainly a corruption.
      if (w > 4096 || h > 4096 || w < 1 || h < 1) {
        console.error(`[TheiaOutput] ensureImageData rejected unsafe dimensions: ${w}×${h}`)
        return imageData ?? ctx!.createImageData(1, 1)
      }
      // Use ctx.createImageData to allocate an ImageData backed by a fresh
      // (non-shared) ArrayBuffer — required because `new ImageData(uint8, w, h)`
      // rejects SharedArrayBuffer-backed Uint8ClampedArray.
      imageData = ctx!.createImageData(w, h)
      imageDataDims = { w, h }
      // Re-allocate offscreen canvas to match source size.
      if (!offscreen) {
        offscreen = document.createElement('canvas')
        offscreenCtx = offscreen.getContext('2d')
      }
      offscreen.width = w
      offscreen.height = h
      return imageData
    }

    function drawScaled(srcW: number, srcH: number): void {
      if (!ctx || !offscreen) return
      // Aspect-fit (letterbox): mantener proporción del frame fuente.
      const dstW = canvas!.width
      const dstH = canvas!.height
      const srcAspect = srcW / srcH
      const dstAspect = dstW / dstH
      let drawW = dstW
      let drawH = dstH
      let drawX = 0
      let drawY = 0
      if (srcAspect > dstAspect) {
        // source wider → letterbox top/bottom
        drawH = Math.floor(dstW / srcAspect)
        drawY = Math.floor((dstH - drawH) / 2)
      } else {
        drawW = Math.floor(dstH * srcAspect)
        drawX = Math.floor((dstW - drawW) / 2)
      }
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, dstW, dstH)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(offscreen, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH)
    }

    async function init(): Promise<void> {
      const bridge = getBridge()
      if (!bridge) {
        // eslint-disable-next-line no-console
        console.error('[TheiaOutput] preload bridge missing — window.lux.theia.getVideoFrameBufferSAB unavailable')
        return
      }
      const sab = await bridge.getVideoFrameBufferSAB()
      if (!sab || cancelled) return
      reader = new VideoFrameReader(sab)
      reader.resync()

      // eslint-disable-next-line no-console
      console.log('[TheiaOutput] 🎬 attached to video SAB — entering rAF loop')

      const tick = (): void => {
        if (cancelled) return
        const snap = reader!.readIfChanged()
        if (snap) {
          const img = ensureImageData(snap.width, snap.height)
          // SAB-backed view → non-shared ImageData
          img.data.set(snap.view)
          if (offscreenCtx) {
            offscreenCtx.putImageData(img, 0, 0)
            drawScaled(snap.width, snap.height)
          }
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    void init()

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', resizeCanvas)
      reader = null
      imageData = null
      offscreen = null
      offscreenCtx = null
    }
  }, [])

  return (
    <div className="theia-output-root">
      <canvas ref={canvasRef} className="theia-output-canvas" />
    </div>
  )
}

export default TheiaOutputView
