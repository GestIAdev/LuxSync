/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA CANVAS — WAVE 8010-P1: LIENZO TÁCTICO BASE
 *
 * <canvas> HTML5 2D con:
 *   - ResizeObserver → backing store escalado por devicePixelRatio + tamaño
 *     CSS publicado al store (las matemáticas mundo↔px lo consumen).
 *   - Loop RAF continuo — P1 dibuja solo fondo + grid de depuración inline
 *     (las capas reales viven en canvas/layers/, WAVE 8010-P2).
 *   - Control de cámara: drag = pan, rueda = zoom al cursor, doble click =
 *     reset. Todo vía acciones del useAsteriaStore.
 *
 * El loop lee el transform con getWorldTransform() (snapshot no reactivo):
 * la cámara puede moverse a 60 fps sin re-renderizar React.
 *
 * @module HephaestusView/asteria/canvas/AsteriaCanvas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef } from 'react'
import { useAsteriaStore } from '../store/useAsteriaStore'
import {
  getWorldTransform,
  visibleWorldRect,
  type WorldTransform,
} from './useWorldTransform'

// ═══════════════════════════════════════════════════════════════════════════
// DRAW — P1 DEBUG GRID (reemplazada por layers/GridLayer en WAVE 8010-P2)
// ═══════════════════════════════════════════════════════════════════════════

function drawDebugGrid(ctx: CanvasRenderingContext2D, t: WorldTransform): void {
  const { minX, minZ, maxX, maxZ } = visibleWorldRect(t)

  // ── Grid cada 1 m (solo en el rango visible — culling gratis) ──
  ctx.lineWidth = 1
  for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
    const major = x % 5 === 0
    ctx.strokeStyle = major
      ? 'rgba(123, 92, 255, 0.22)'
      : 'rgba(123, 92, 255, 0.07)'
    const sx = (x - t.cam.panX) * t.cam.zoom + t.canvasW / 2
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, t.canvasH)
    ctx.stroke()
  }
  for (let z = Math.floor(minZ); z <= Math.ceil(maxZ); z++) {
    const major = z % 5 === 0
    ctx.strokeStyle = major
      ? 'rgba(123, 92, 255, 0.22)'
      : 'rgba(123, 92, 255, 0.07)'
    const sy = (z - t.cam.panY) * t.cam.zoom + t.canvasH / 2
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(t.canvasW, sy)
    ctx.stroke()
  }

  // ── Retícula del origen del mundo (0, 0) — smoke test de la proyección ──
  const ox = (0 - t.cam.panX) * t.cam.zoom + t.canvasW / 2
  const oy = (0 - t.cam.panY) * t.cam.zoom + t.canvasH / 2
  ctx.strokeStyle = 'rgba(123, 92, 255, 0.8)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(ox - 8, oy)
  ctx.lineTo(ox + 8, oy)
  ctx.moveTo(ox, oy - 8)
  ctx.lineTo(ox, oy + 8)
  ctx.stroke()
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export const AsteriaCanvas: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)

  // ── ResizeObserver: backing store ×DPR + tamaño CSS al store ──
  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const applySize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w <= 0 || h <= 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      useAsteriaStore.getState().setCanvasSize(w, h)
    }

    applySize()
    const ro = new ResizeObserver(applySize)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // ── RAF loop: clear + capas (P1: solo debug grid) ──
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    const tick = () => {
      const dpr = window.devicePixelRatio || 1
      const t = getWorldTransform()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Fondo del lienzo táctico
      ctx.fillStyle = '#07070c'
      ctx.fillRect(0, 0, t.canvasW, t.canvasH)

      // WAVE 8010-P2: aquí entran las capas (grid → halo → cells →
      // gesture ghosts → gizmos → isóconas). P1 dibuja solo la debug grid.
      drawDebugGrid(ctx, t)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── Cámara: drag=pan · wheel=zoom al cursor · dblclick=reset ──
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
    e.currentTarget.style.cursor = 'grabbing'
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    useAsteriaStore.getState().panByScreen(dx, dy)
  }

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    e.currentTarget.style.cursor = 'grab'
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const factor = Math.exp(-e.deltaY * 0.0015)
    useAsteriaStore
      .getState()
      .zoomAtScreen(e.clientX - rect.left, e.clientY - rect.top, factor)
  }

  return (
    <div ref={hostRef} className="asteria-canvas-host">
      <canvas
        ref={canvasRef}
        className="asteria-canvas"
        style={{ cursor: 'grab', touchAction: 'none', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onDoubleClick={() => useAsteriaStore.getState().resetCamera()}
      />
    </div>
  )
}
