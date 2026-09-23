/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA CANVAS — WAVE 8010/8020: LIENZO TÁCTICO
 *
 * <canvas> HTML5 2D con:
 *   - ResizeObserver → backing store escalado por devicePixelRatio + tamaño
 *     CSS publicado al store (las matemáticas mundo↔px lo consumen).
 *   - Loop RAF con pipeline de capas en orden estricto:
 *       Grid → Node → Feedback → Gesture (tinta + anillos de selección)
 *   - Control de cámara: rueda = zoom al cursor, doble click = reset,
 *     pan = botón medio/derecho o ESPACIO+drag (el botón izquierdo es de
 *     la herramienta activa, WAVE 8020).
 *   - Herramientas: pointer events primarios → tool del store
 *     (TOOL_REGISTRY); hover = pick del nodo más cercano → setHover
 *     (firma-deduplicado — el Poke lo traduce a L3++).
 *
 * El loop lee el transform con getWorldTransform() y el atlas/gesture por
 * referencia estable: la cámara y el gesto se mueven a 60 fps sin
 * re-renderizar React.
 *
 * @module HephaestusView/asteria/canvas/AsteriaCanvas
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useMemo, useRef } from 'react'
import { useAsteriaStore } from '../store/useAsteriaStore'
import { getWorldTransform } from './useWorldTransform'
import { drawGridLayer } from './layers/GridLayer'
import { drawNodeLayer } from './layers/NodeLayer'
import { drawFeedbackLayer } from './layers/FeedbackLayer'
import { drawGestureLayer } from './layers/GestureLayer'
import { getTool, type AsteriaToolContext } from '../tools/ToolRegistry'
import { nearestNodeToScreen } from '../tools/selection'
import type { HephPreviewReturn } from '../../useHephPreview'
import '../tools' // side-effect: puebla TOOL_REGISTRY

/** Radio de pick del hover en px de pantalla. */
const HOVER_PICK_RADIUS_PX = 12

export const AsteriaCanvas: React.FC<{
  preview?: HephPreviewReturn
  /** Overlays dentro del host (drift banner, transport drawer…). */
  children?: React.ReactNode
}> = ({ preview, children }) => {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  /** Herramienta con un gesto en curso (pointer capturado). */
  const activeGestureRef = useRef<string | null>(null)
  const spaceHeldRef = useRef(false)

  // Cursor por herramienta (cambio raro — suscripción React segura)
  const activeToolId = useAsteriaStore((s) => s.activeToolId)

  // 🜨 WAVE 8050 (M3): banner de Rig Drift — suscripciones React,
  //  cambia solo al abrir documento / re-patchar el rig.
  const rigDrift = useAsteriaStore((s) => s.rigDrift)
  const driftReadOnly = useAsteriaStore((s) => s.driftReadOnly)
  const resolveDriftRemap = useAsteriaStore((s) => s.resolveDriftRemap)
  const resolveDriftDiscard = useAsteriaStore((s) => s.resolveDriftDiscard)
  const setDriftReadOnly = useAsteriaStore((s) => s.setDriftReadOnly)

  // 🜨 WAVE 8070 (M3): ref al previewDataRef del editor — el RAF lo lee
  // cada frame sin suscripciones ni re-render (Zero React Cost).
  const previewDataRef = useRef(preview?.previewDataRef)
  useEffect(() => {
    previewDataRef.current = preview?.previewDataRef
  }, [preview])

  // Contexto inyectado a las tools — referencias estables, nada de React
  const toolCtx = useMemo<AsteriaToolContext>(() => ({
    transform: getWorldTransform,
    atlas: () => useAsteriaStore.getState().nodeAtlas,
    setSelection: (ids, additive) =>
      useAsteriaStore.getState().setSelection(ids, additive),
    setHover: (ids) => useAsteriaStore.getState().setHover(ids),
    previewSelection: (ids) => useAsteriaStore.getState().setPreview(ids),
    // 🜨 WAVE 8040B: servicios de las tools de pintura/cirugía
    selection: () => useAsteriaStore.getState().selectionNodeIds,
    addGesture: (g) => useAsteriaStore.getState().addGesture(g),
    setSurgeonDevice: (dev) => useAsteriaStore.getState().setSurgeonDevice(dev),
    fitRect: (cx, cz, w, d, m) => useAsteriaStore.getState().fitRect(cx, cz, w, d, m),
  }), [])

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

  // ── ESPACIO = pan temporal (convención de canvas táctico) ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        spaceHeldRef.current = true
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeldRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // ── RAF loop: pipeline de capas ──
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

      // Referencias estables por getState() — zero React cost
      const s = useAsteriaStore.getState()
      drawGridLayer(ctx, t)
      drawNodeLayer(ctx, t, s.nodeAtlas)
      drawFeedbackLayer(ctx, t, s.nodeAtlas, previewDataRef.current?.current)
      drawGestureLayer(ctx, t, s.nodeAtlas, s.selectionNodeIds, s.previewNodeIds, s.hoverNodeIds)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── Pointer: tool = botón izq · pan = medio/derecho/espacio ──
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const panGesture = e.button === 1 || e.button === 2 || spaceHeldRef.current
    e.currentTarget.setPointerCapture(e.pointerId)

    if (panGesture) {
      dragRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
      e.currentTarget.style.cursor = 'grabbing'
      return
    }

    const tool = getTool(useAsteriaStore.getState().activeToolId)
    if (tool?.onPointerDown) {
      activeGestureRef.current = e.pointerId + ':' + tool.id
      const rect = e.currentTarget.getBoundingClientRect()
      tool.onPointerDown(e.clientX - rect.left, e.clientY - rect.top, e.nativeEvent, toolCtx)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const drag = dragRef.current
    if (drag && drag.pointerId === e.pointerId) {
      const dx = e.clientX - drag.lastX
      const dy = e.clientY - drag.lastY
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      useAsteriaStore.getState().panByScreen(dx, dy)
      return
    }

    if (activeGestureRef.current) {
      const tool = getTool(useAsteriaStore.getState().activeToolId)
      tool?.onPointerMove?.(sx, sy, e.nativeEvent, toolCtx)
      return
    }

    // Hover pick — firma-deduplicado en setHover, sin churn de React
    const hit = nearestNodeToScreen(
      useAsteriaStore.getState().nodeAtlas,
      getWorldTransform(),
      sx, sy, HOVER_PICK_RADIUS_PX,
    )
    useAsteriaStore.getState().setHover(hit ? [hit] : [])
  }

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null
    }
    if (activeGestureRef.current) {
      const tool = getTool(useAsteriaStore.getState().activeToolId)
      const rect = e.currentTarget.getBoundingClientRect()
      tool?.onPointerUp?.(
        e.clientX - rect.left, e.clientY - rect.top, e.nativeEvent, toolCtx,
      )
      activeGestureRef.current = null
      // El preview fantasma muere con el gesto (el commit ya quedó)
      useAsteriaStore.getState().setPreview([])
    }
    e.currentTarget.style.cursor = getTool(activeToolId)?.cursor ?? 'grab'
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const factor = Math.exp(-e.deltaY * 0.0015)
    useAsteriaStore
      .getState()
      .zoomAtScreen(e.clientX - rect.left, e.clientY - rect.top, factor)
  }

  const tool = getTool(activeToolId)

  return (
    <div ref={hostRef} className="asteria-canvas-host">
      <canvas
        ref={canvasRef}
        className="asteria-canvas"
        style={{ cursor: tool?.cursor ?? 'grab', touchAction: 'none', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => useAsteriaStore.getState().setHover([])}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          // 🜨 8040B: la tool activa puede reclamar el doble clic
          // (Cell Surgeon abre el inspector celular); si no, reset cámara.
          const t = getTool(useAsteriaStore.getState().activeToolId)
          if (t?.onDoubleClick) {
            const rect = e.currentTarget.getBoundingClientRect()
            t.onDoubleClick(
              e.clientX - rect.left, e.clientY - rect.top, e.nativeEvent, toolCtx,
            )
          } else {
            useAsteriaStore.getState().resetCamera()
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* 🜨 WAVE 8050 (M3): BANNER DE RIG DRIFT — el rig cambió entre
          sesiones. Compilación bloqueada hasta que el operador decida:
          nunca un recompile silencioso (blueprint §Persistencia). */}
      {rigDrift && !driftReadOnly && (
        <div className="asteria-drift-banner" role="alert">
          <div className="asteria-drift-banner__title">
            ⚠ El rig ha cambiado
          </div>
          <div className="asteria-drift-banner__body">
            {rigDrift.missing.length} nodos de esta pila ya no existen ·{' '}
            {rigDrift.unassigned.length} nodos nuevos sin asignar
          </div>
          <div className="asteria-drift-banner__actions">
            <button
              type="button"
              className="asteria-drift-btn asteria-drift-btn--primary"
              onClick={resolveDriftRemap}
            >
              Remapear por proximidad
            </button>
            <button
              type="button"
              className="asteria-drift-btn"
              onClick={resolveDriftDiscard}
            >
              Descartar huérfanos
            </button>
            <button
              type="button"
              className="asteria-drift-btn"
              onClick={() => setDriftReadOnly(true)}
            >
              Solo lectura
            </button>
          </div>
        </div>
      )}
      {rigDrift && driftReadOnly && (
        <button
          type="button"
          className="asteria-drift-chip"
          title="Proyecto en solo lectura — compilación y gestos bloqueados. Clic para resolver el drift."
          onClick={() => setDriftReadOnly(false)}
        >
          🔒 SOLO LECTURA · rig drift pendiente
        </button>
      )}

      {/* 🜨 WAVE 8150-F2: overlays inyectados (Transport Drawer) — se
          pintan por encima del canvas, dentro del host */}
      {children}
    </div>
  )
}
