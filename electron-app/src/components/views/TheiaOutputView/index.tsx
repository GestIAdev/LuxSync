/**
 * 🎬 WAVE 4864 / 🌊 WAVE 8215 — THEIA OUTPUT VIEW (Glass Bridge consumer)
 *
 * Componente hiper-ligero que se monta SOLO en la ventana secundaria del
 * proyector Theia (BrowserWindow gestionada por `TheiaWindowManager`).
 *
 * 🌊 WAVE 8215 — THE OPUS GLASS-BRIDGE PIVOT: ya NO hay SharedArrayBuffer
 * compartido con el main. Los frames llegan por `MessagePort` como
 * `ArrayBuffer` transferibles (ownership move, zero-copy por Mojo):
 *
 *   worker ──{type:'theia:video-frame', seq, buffer}──▶ esta vista
 *   worker ◄─{ack:true, seq, buffer}─────────────────── esta vista
 *
 * El blit ocurre EN el handler del mensaje y el buffer se devuelve
 * (`ackFrame`) inmediatamente después de copiarlo al `ImageData` local —
 * el MISMO ArrayBuffer ping-ponguea por el canal; jamás se instancia uno
 * nuevo en este lado (certificación zero-alloc). Si esta vista va lenta,
 * el pool del worker se agota y el frame se descarta en origen — nunca se
 * acumulan copias aquí.
 *
 * Modo B (Euclid, WAVE 8208): el `telemetry-port` entrega el ring de 256B
 * por clone serializado (WAVE 8216 — `MessagePortMain` no transfiere); se
 * espeja a un ring LOCAL (SAB intra-proceso, legal bajo el veto) y la copia
 * se devuelve por `ack` con transfer DOM→main. El futuro shader de esta
 * ventana consumirá el ring local.
 *
 * Reglas de oro:
 *  - Cero estado React (solo el ref del canvas). React no re-renderiza
 *    una sola vez tras el mount — todo vive en los handlers del port.
 *  - Si no hay frame todavía, el canvas queda negro (background CSS).
 *  - El canvas se redimensiona al `window.innerWidth/Height` en cada resize
 *    y el último frame se re-escala desde el offscreen persistente.
 */

import { useEffect, useRef } from 'react'
import {
  isVideoFrameMessage,
  readVideoFrame,
  type TheiaVideoFrameMessage,
} from '../../../theia/SharedVideoFrameBuffer'
import {
  ackTelemetryFrame,
  createTelemetryRing,
  isTelemetryMessage,
  mirrorTelemetryIntoRing,
} from '../../../theia/TheiaTelemetryRing'
import { onTheiaGlassMessage, requestTheiaPort } from '../../../theia/glassBridge'
import './TheiaOutputView.css'

const TheiaOutputView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let videoPort: MessagePort | null = null
    let telemetryPort: MessagePort | null = null
    // Persistent ImageData allocated once per (w,h) — el blit copia aquí
    // antes de devolver el buffer transferible por ack.
    let imageData: ImageData | null = null
    let imageDataDims = { w: 0, h: 0 }
    // Offscreen canvas para escalar a fullscreen — ImageData no se puede
    // poner directamente con escalado, así que lo blitteamos a una
    // OffscreenCanvas y luego drawImage al canvas visible.
    let offscreen: HTMLCanvasElement | null = null
    let offscreenCtx: CanvasRenderingContext2D | null = null
    // Último frame válido — re-blit en resize sin esperar un frame nuevo.
    let lastSrc = { w: 0, h: 0 }
    // 🌊 Modo B — ring local de telemetría (256B, intra-proceso). El
    // SharedArrayBuffer local es legal: el veto WAVE 8215 aplica solo a
    // la frontera Main↔Renderer, y el buffer transferible se devuelve por
    // ack en el mismo handler (zero-alloc por tick).
    let telemetryRing: SharedArrayBuffer | null = null
    try {
      telemetryRing = createTelemetryRing()
    } catch {
      telemetryRing = null // sin crossOriginIsolated — Modo B espera al fix
    }

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
      if (lastSrc.w > 0 && lastSrc.h > 0) {
        drawScaled(lastSrc.w, lastSrc.h)
      }
    }

    function ensureImageData(w: number, h: number): ImageData {
      if (imageData && imageDataDims.w === w && imageDataDims.h === h) return imageData
      // 🛡️ WAVE 7569: OILPAN GUARD — Reject dimensions that would allocate
      // excessive memory. createImageData(w, h) allocates w*h*4 bytes.
      // 4096×4096×4 = 67MB — anything larger is almost certainly a corruption.
      if (w > 4096 || h > 4096 || w < 1 || h < 1) {
        console.error(`[TheiaOutput] ensureImageData rejected unsafe dimensions: ${w}×${h}`)
        return imageData ?? ctx!.createImageData(1, 1)
      }
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
      // 🌊 WAVE 8207 — the frame carries a GL readPixels() readout whose rows
      // are BOTTOM-UP (GL origin). Flip vertically at blit time on the GPU —
      // zero CPU cost, keeps the producer zero-copy.
      ctx.save()
      ctx.translate(drawX, drawY + drawH)
      ctx.scale(1, -1)
      ctx.drawImage(offscreen, 0, 0, srcW, srcH, 0, 0, drawW, drawH)
      ctx.restore()
    }

    /**
     * 🌊 WAVE 8215 — CONSUME un frame transferible y devuelve el buffer
     * (ackFrame). Copia los píxeles al ImageData persistente ANTES del ack:
     * tras el postMessage de retorno la propiedad del ArrayBuffer ya es
     * del worker y este lado no debe volver a tocarlo.
     */
    function handleVideoFrame(msg: TheiaVideoFrameMessage, port: MessagePort): void {
      const snap = readVideoFrame(msg.buffer)
      if (snap) {
        const img = ensureImageData(snap.width, snap.height)
        // Copia buffer→ImageData (única copia del camino — 2D putImageData
        // requiere un backing no detachado).
        img.data.set(snap.view)
        if (offscreenCtx) {
          offscreenCtx.putImageData(img, 0, 0)
          lastSrc = { w: snap.width, h: snap.height }
          drawScaled(snap.width, snap.height)
        }
      }
      // Ping-pong: el MISMO ArrayBuffer vuelve al pool del worker.
      port.postMessage({ ack: true, seq: msg.seq, buffer: msg.buffer }, [msg.buffer])
    }

    function attachVideoPort(port: MessagePort): void {
      try { videoPort?.close() } catch { /* noop */ }
      videoPort = port
      port.onmessage = (ev: MessageEvent) => {
        if (cancelled) return
        if (isVideoFrameMessage(ev.data)) {
          handleVideoFrame(ev.data, port)
        }
        // El resto del tráfico del port se ignora — el canal es dedicado.
      }
      port.onmessageerror = () => {
        console.error('[TheiaOutput] video port messageerror — link degradado')
      }
      port.start()
    }

    function attachTelemetryPort(port: MessagePort): void {
      try { telemetryPort?.close() } catch { /* noop */ }
      telemetryPort = port
      port.onmessage = (ev: MessageEvent) => {
        if (cancelled) return
        const data = ev.data
        if (!isTelemetryMessage(data)) return
        // Modo B — espejo del ring (future shader feed), luego ackFrame.
        if (telemetryRing) {
          mirrorTelemetryIntoRing(telemetryRing, data.buffer)
        }
        ackTelemetryFrame(port, data)
      }
      port.start()
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // 🌊 WAVE 8215 — pull de ambos canales Glass. El preload entrega los
    // ports que el broker (TheiaWindowManager / pump de main) pusheó y
    // marca los kinds como wanted para auto-entrega en re-links.
    const unsubGlass = onTheiaGlassMessage((msg) => {
      if (cancelled) return
      if (msg.kind === 'video-port' && msg.port) {
        if (msg.role === 'consumer') {
          attachVideoPort(msg.port)
        } else {
          // Defensive: esta ventana es siempre el consumer.
          try { msg.port.close() } catch { /* noop */ }
        }
      } else if (msg.kind === 'telemetry-port' && msg.port) {
        attachTelemetryPort(msg.port)
      } else if (msg.kind === 'video-unlink') {
        // El worker cerró el canal (ventana principal recargando, worker
        // muerto). Soltamos el extremo — el próximo pull re-brokerea.
        try { videoPort?.close() } catch { /* noop */ }
        videoPort = null
      }
    })
    requestTheiaPort('video-port')
    requestTheiaPort('telemetry-port')

    // eslint-disable-next-line no-console
    console.log('[TheiaOutput] 🌉 Glass Bridge consumer armed — waiting for ports')

    return () => {
      cancelled = true
      unsubGlass()
      window.removeEventListener('resize', resizeCanvas)
      try { videoPort?.close() } catch { /* noop */ }
      try { telemetryPort?.close() } catch { /* noop */ }
      videoPort = null
      telemetryPort = null
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
