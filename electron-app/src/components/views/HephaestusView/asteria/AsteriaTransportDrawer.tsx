/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA TRANSPORT DRAWER — WAVE 8150-F2: VISUALIZADOR INTEGRADO
 *
 * Panel de transporte superpuesto en la parte inferior del lienzo táctico
 * (Ruta A de la auditoría 8150-F1: overlay absoluto, el canvas no se
 * re-geometriza). Montado como hijo de <AsteriaCanvas> dentro de
 * `.asteria-canvas-host`.
 *
 *   Colapsado (24px): tira de progreso + aguja viva + botón ▲ PREVIEW.
 *   Expandido (72px): ▶ ⏸ ⏹ + scrubber range + readout de tiempo.
 *
 * ZERO-ALLOC DEL PLAYHEAD (M2): un RAF local lee `previewDataRef.current`
 * cada frame y escribe el DOM por ref (left/textContent/value) — el hook
 * actualiza ese ref a 44 Hz SIN setState (useHephPreview P2#3), así que
 * suscribir React al playhead lo congelaría. React solo ve `isPlaying`
 * (transiciones raras) y `durationMs` (cambia con el documento).
 *
 * El scrubber llama `preview.seek(ms)` → escribe `previewDataRef` →
 * `FeedbackLayer` ya hace fallback a esos fixtures (WAVE 8070-M3): mover
 * la aguja ilumina el lienzo inmediatamente. Bucle ya cerrado.
 *
 * @module HephaestusView/asteria/AsteriaTransportDrawer
 * @version WAVE 8150-F2
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { HephPreviewReturn } from '../useHephPreview'
import { useHephaestusEditorStore } from '../../../../core/hephaestus/store/useHephaestusEditorStore'

interface AsteriaTransportDrawerProps {
  preview: HephPreviewReturn
}

/** mm:ss.mmm — readout del playhead, escrito por ref (no por React). */
function fmtMs(ms: number): string {
  const totalSec = ms / 1000
  const m = Math.floor(totalSec / 60)
  const s = totalSec - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

export const AsteriaTransportDrawer: React.FC<AsteriaTransportDrawerProps> = ({
  preview,
}) => {
  const [open, setOpen] = useState(false)
  const durationMs = useHephaestusEditorStore((s) => s.clip?.durationMs ?? 0)
  const isPlaying = preview.isPlaying // transición rara — suscripción segura

  const needleRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const rangeRef = useRef<HTMLInputElement>(null)
  const draggingRef = useRef(false)

  // ── RAF Zero-Alloc: el playhead corre por DOM, jamás por React ──
  useEffect(() => {
    let raf = 0
    let lastText = ''
    const tick = () => {
      const data = preview.previewDataRef.current
      if (data) {
        const pct = `${(Math.max(0, Math.min(1, data.progress)) * 100).toFixed(3)}%`
        const needle = needleRef.current
        if (needle) needle.style.left = pct
        const t = timeRef.current
        if (t) {
          const txt = `${fmtMs(data.playheadMs)} / ${fmtMs(durationMs)}`
          if (txt !== lastText) {
            t.textContent = txt
            lastText = txt
          }
        }
        const range = rangeRef.current
        if (range && !draggingRef.current) {
          range.value = String(Math.round(data.playheadMs))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [preview, durationMs])

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      preview.seek(Number(e.target.value))
    },
    [preview],
  )

  if (durationMs <= 0) return null

  return (
    <div
      className={`asteria-transport${open ? ' asteria-transport--open' : ''}`}
      aria-label="Clip transport"
    >
      {/* ── Tira colapsada: progreso + aguja viva (siempre visible) ── */}
      <div className="asteria-transport__strip">
        <div className="asteria-transport__track">
          <div ref={needleRef} className="asteria-transport__needle" />
        </div>
        <button
          type="button"
          className="asteria-transport__toggle"
          title={open ? 'Ocultar transporte' : 'Transporte del clip — play / scrub'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '▼' : '▲ PREVIEW'}
        </button>
      </div>

      {/* ── Panel expandido: transporte + scrubber ── */}
      {open && (
        <div className="asteria-transport__panel">
          <div className="asteria-transport__buttons">
            <button
              type="button"
              className="asteria-transport__btn"
              title={isPlaying ? 'Pause' : 'Play'}
              onClick={isPlaying ? preview.pause : preview.play}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              className="asteria-transport__btn"
              title="Stop — playhead a 0"
              onClick={preview.stop}
            >
              ⏹
            </button>
            <span ref={timeRef} className="asteria-transport__time" />
          </div>
          <div className="asteria-transport__scrub">
            <input
              ref={rangeRef}
              type="range"
              className="asteria-transport__range"
              min={0}
              max={durationMs}
              step={1}
              defaultValue={0}
              onPointerDown={() => {
                draggingRef.current = true
              }}
              onPointerUp={() => {
                draggingRef.current = false
              }}
              onPointerCancel={() => {
                draggingRef.current = false
              }}
              onBlur={() => {
                draggingRef.current = false
              }}
              onChange={handleScrub}
              aria-label="Clip playhead"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default AsteriaTransportDrawer
