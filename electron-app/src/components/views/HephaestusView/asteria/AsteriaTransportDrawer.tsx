/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA TRANSPORT BAR — WAVE 8150-F2 → WAVE 8203 (M1)
 *
 * Barra de transporte permanente en la parte inferior del lienzo táctico
 * (overlay absoluto dentro de `.asteria-canvas-host`, hijo de
 * <AsteriaCanvas>). WAVE 8203: los controles salen del drawer colapsable —
 * Play/Pause, Stop y Loop viven anclados a la izquierda de la timeline,
 * accesibles a 0 clics, con área táctil generosa. La propia línea de
 * tiempo ES el scrubber (input range transparente sobre la aguja).
 *
 *   ┌─[▶|⏸]─[⏹]─[🔁]──0:04.20 / 0:12.00──┬────────●─────────────┬─[BUDGET]─┐
 *
 * ZERO-ALLOC DEL PLAYHEAD (M2): un RAF local lee `previewDataRef.current`
 * cada frame y escribe el DOM por ref (left/textContent/value) — el hook
 * actualiza ese ref a 44 Hz SIN setState (useHephPreview P2#3), así que
 * suscribir React al playhead lo congelaría. React solo ve `isPlaying`,
 * `loop` (transiciones raras) y `durationMs` (cambia con el documento).
 *
 * El scrubber llama `preview.seek(ms)` → escribe `previewDataRef` →
 * `FeedbackLayer` ya hace fallback a esos fixtures (WAVE 8070-M3): mover
 * la aguja ilumina el lienzo inmediatamente. Bucle ya cerrado.
 *
 * WAVE 8203 (M2): el detalle de warnings del compilador ya NO vive aquí —
 * se cuarentenó al `CompileLogDock` del rail (jamás tapa el canvas).
 *
 * @module HephaestusView/asteria/AsteriaTransportDrawer
 * @version WAVE 8203
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useRef } from 'react'
import type { HephPreviewReturn } from '../useHephPreview'
import { useHephaestusEditorStore } from '../../../../core/hephaestus/store/useHephaestusEditorStore'
import { useAsteriaStore } from './store/useAsteriaStore'
import type { CompileReport } from './compiler/AsteriaCompiler'

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

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8181 (M1): HUD BUDGET — heredero del bloque COMPILE que el
// blueprint §6.2 reservó para la barra inferior. Umbrales §8.4:
// <40 % verde · 40-70 % ámbar · >70 % rojo.
// ─────────────────────────────────────────────────────────────────────────────

/** Límite del archivo .lfx — LfxFileLoader.ts:66 (blueprint §10). */
const LFX_MAX_BYTES = 256 * 1024

const STRATEGY_TAG: Record<CompileReport['strategy'], string> = {
  lambda: 'Λ',
  ride: 'Λ·RIDE',
  cohort: 'COH',
  mcc: 'MCC',
  'mcc-device': 'MCC·D',
}

function budgetClass(pct: number): string {
  if (pct > 0.7) return 'asteria-budget--red'
  if (pct > 0.4) return 'asteria-budget--amber'
  return 'asteria-budget--green'
}

/** Readout compacto del presupuesto — anclado a la derecha de la barra. */
const BudgetHud: React.FC = () => {
  const report = useAsteriaStore((s) => s.lastCompileReport)
  if (!report) return null
  const pct = report.bytes / LFX_MAX_BYTES
  const cls = budgetClass(pct)
  return (
    <div
      className={`asteria-budget ${cls}`}
      title={
        `BUDGET — ${report.trackIds.length} track(s) · ` +
        `${report.keyframeCount} kf · ${report.overrideCount} overrides · ` +
        `${report.nodesCovered} nodes · ${report.devicesTargeted} fixtures` +
        (report.warnings.length > 0
          ? `\n${report.warnings.join('\n')}`
          : '')
      }
    >
      <span className="asteria-budget__strategy">
        {STRATEGY_TAG[report.strategy] ?? report.strategy.toUpperCase()}
      </span>
      <span className="asteria-budget__bytes">
        {(report.bytes / 1024).toFixed(1)} / 256 KB
      </span>
      <span className="asteria-budget__bar">
        <span
          className="asteria-budget__fill"
          style={{ width: `${Math.min(100, pct * 100).toFixed(1)}%` }}
        />
      </span>
      <span className="asteria-budget__pct">{(pct * 100).toFixed(1)}%</span>
      {report.warnings.length > 0 && (
        <span className="asteria-budget__warn">⚠ {report.warnings.length}</span>
      )}
    </div>
  )
}

export const AsteriaTransportDrawer: React.FC<AsteriaTransportDrawerProps> = ({
  preview,
}) => {
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
    <div className="asteria-transport" aria-label="Clip transport">
      <div className="asteria-transport__strip">
        {/* ── 🜨 WAVE 8203 (M1): controles anclados — 0 clics, siempre
            visibles, área táctil generosa ── */}
        <div className="asteria-transport__buttons">
          <button
            type="button"
            className="asteria-transport__btn asteria-transport__btn--play"
            title={isPlaying ? 'Pause' : 'Play'}
            onClick={isPlaying ? preview.pause : preview.play}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            className="asteria-transport__btn"
            title="Stop — playhead to 0"
            onClick={preview.stop}
          >
            ⏹
          </button>
          <button
            type="button"
            className={`asteria-transport__btn asteria-transport__btn--loop ${preview.loop ? 'active' : ''}`}
            title={
              preview.loop
                ? 'Loop ON — wraps at clip end'
                : 'Loop OFF — stops at clip end'
            }
            onClick={() => preview.setLoop(!preview.loop)}
          >
            🔁
          </button>
        </div>

        <span ref={timeRef} className="asteria-transport__time" />

        {/* ── Timeline = scrubber: la aguja dibuja el progreso; un range
            transparente a tamaño completo captura el drag (0 clics) ── */}
        <div className="asteria-transport__track">
          <div ref={needleRef} className="asteria-transport__needle" />
          <input
            ref={rangeRef}
            type="range"
            className="asteria-transport__scrubInput"
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

        {/* 🜨 HUD BUDGET — siempre visible, a la derecha de la barra */}
        <BudgetHud />
      </div>
    </div>
  )
}

export default AsteriaTransportDrawer
