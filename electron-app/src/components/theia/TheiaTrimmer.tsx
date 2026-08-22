/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✂️ THEIA TRIMMER — WAVE 4921 (Atomic Paradigm · Fase 1)
 *
 * Recortador atómico del WORKSHOP. Reemplaza al multi-cuepoint TheiaTimeline
 * de WAVE 4910. Una sola pista, dos tiradores (IN/OUT) y un playhead.
 *
 * Convive con `useTheiaEditorStore.draftAtom`:
 *  - Lee `draftAtom.trim.{startMs,endMs}`.
 *  - Escribe vía `updateTrim(start, end)`.
 *
 * Sin cuepoints. Sin solapamientos. Sin badges. Sin emojis.
 * Iconografía 100% LuxIcons (premium, sin Lucide ni glyphs unicode).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTheiaEditorStore } from '../../stores/useTheiaEditorStore'
import { useKeyMapStore } from '../../stores/keyMapStore'
import { getThetaOrchestrator } from '../../theia'
import {
  PlayIcon,
  PauseIcon,
  ScenesIcon, // proxy "trim brackets" — clappa de cine = recorte de vídeo
} from '../icons/LuxIcons'
import './TheiaTrimmer.css'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const totalS = Math.floor(ms / 1000)
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  const cs = Math.floor((ms % 1000) / 10)
  return `${m}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}

// ─── DRAG STATE ───────────────────────────────────────────────────────────────

type Handle = 'in' | 'out'

interface DragState {
  handle: Handle
  startX: number
  origIn: number
  origOut: number
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const MIN_DURATION_MS = 250

const TheiaTrimmer: React.FC = () => {
  const draftAtom = useTheiaEditorStore((s) => s.draftAtom)
  const updateTrim = useTheiaEditorStore((s) => s.updateTrim)

  // ── Playhead RAF loop ──────────────────────────────────────────────────────
  const [playheadMs, setPlayheadMs] = useState(0)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const playheadMsRef = useRef(0)

  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let lastUpdate = 0
    const THROTTLE_MS = 1000 / 30

    const loop = () => {
      // 🛡️ WAVE 7570.3: Skip when document hidden — video playhead doesn't move in background.
      if (!document.hidden) {
        const vid = getThetaOrchestrator().getVideoElement()
        if (vid) {
          const now = performance.now()
          if (now - lastUpdate >= THROTTLE_MS) {
            const ms = vid.currentTime * 1000
            playheadMsRef.current = ms
            setPlayheadMs(ms)
            setIsPlaying(!vid.paused)
            if (isFinite(vid.duration) && vid.duration > 0) {
              setVideoDurationMs(vid.duration * 1000)
            }
            lastUpdate = now
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Escala efectiva ────────────────────────────────────────────────────────
  // Preferir la duración real del .mp4. Si aún no se cargó, fallback al endMs
  // del trim para mantener proporciones razonables.

  const trimEnd = draftAtom?.trim.endMs ?? 0
  const effectiveTotalMs = Math.max(videoDurationMs, trimEnd)
  const effectiveTotalMsRef = useRef(effectiveTotalMs)
  effectiveTotalMsRef.current = effectiveTotalMs

  // ── Drag logic (zero-rerender via refs) ────────────────────────────────────

  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const ds = dragRef.current
      if (!ds || !trackRef.current) return

      const trackWidth = trackRef.current.getBoundingClientRect().width
      if (trackWidth === 0) return

      const totalMs = effectiveTotalMsRef.current
      if (totalMs <= 0) return

      const deltaMs = ((e.clientX - ds.startX) / trackWidth) * totalMs

      if (ds.handle === 'in') {
        const newIn = Math.max(0, Math.min(ds.origIn + deltaMs, ds.origOut - MIN_DURATION_MS))
        updateTrim(newIn, ds.origOut)
      } else {
        const newOut = Math.max(
          ds.origIn + MIN_DURATION_MS,
          Math.min(ds.origOut + deltaMs, totalMs),
        )
        updateTrim(ds.origIn, newOut)
      }
    }

    const onPointerUp = () => {
      if (dragRef.current) {
        dragRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [updateTrim])

  const handleStartDrag = useCallback((e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation()
    e.preventDefault()
    const atom = useTheiaEditorStore.getState().draftAtom
    if (!atom) return
    dragRef.current = {
      handle,
      startX: e.clientX,
      origIn: atom.trim.startMs,
      origOut: atom.trim.endMs,
    }
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // ── Seek on track click ────────────────────────────────────────────────────

  const handleTrackSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = trackRef.current
    const vid = getThetaOrchestrator().getVideoElement()
    if (!el || !vid || effectiveTotalMsRef.current <= 0) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetMs = ratio * effectiveTotalMsRef.current
    vid.currentTime = targetMs / 1000
    playheadMsRef.current = targetMs
    setPlayheadMs(targetMs)
  }, [])

  // ── Transport: play/pause + reset full ─────────────────────────────────────

  const handleTogglePlay = useCallback(() => {
    const vid = getThetaOrchestrator().getVideoElement()
    if (!vid) return
    if (vid.paused) void vid.play()
    else vid.pause()
  }, [])

  const handleResetFull = useCallback(() => {
    if (!draftAtom) return
    const total = effectiveTotalMsRef.current
    if (total <= 0) return
    updateTrim(0, total)
  }, [draftAtom, updateTrim])

  const handleSnapToPlayhead = useCallback((handle: Handle) => {
    if (!draftAtom) return
    const ph = Math.round(playheadMsRef.current)
    if (handle === 'in') {
      updateTrim(ph, draftAtom.trim.endMs)
    } else {
      updateTrim(draftAtom.trim.startMs, ph)
    }
  }, [draftAtom, updateTrim])

  // ── Keyboard shortcuts (I/O = set IN/OUT a playhead, Space = play/pause) ──

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!draftAtom) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      // Defer to KeyForge when armed — the operator may have mapped I/O/Space.
      if (useKeyMapStore.getState().isArmed) return

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        handleSnapToPlayhead('in')
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        handleSnapToPlayhead('out')
      } else if (e.code === 'Space') {
        e.preventDefault()
        handleTogglePlay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draftAtom, handleSnapToPlayhead, handleTogglePlay])

  // ── Render ────────────────────────────────────────────────────────────────

  if (!draftAtom) {
    return (
      <div className="theia-trimmer theia-trimmer--empty" aria-label="Trimmer">
        <div className="trim-empty">
          <ScenesIcon size={28} className="trim-empty__icon" />
          <span>Drop a <code>.mp4</code> to begin trimming</span>
        </div>
      </div>
    )
  }

  const inPct = effectiveTotalMs > 0 ? (draftAtom.trim.startMs / effectiveTotalMs) * 100 : 0
  const outPct = effectiveTotalMs > 0 ? (draftAtom.trim.endMs / effectiveTotalMs) * 100 : 100
  const phPct = effectiveTotalMs > 0 ? (playheadMs / effectiveTotalMs) * 100 : 0
  const widthPct = Math.max(outPct - inPct, 0.5)

  return (
    <div className="theia-trimmer" aria-label="Trimmer">

      {/* ── Toolbar ── */}
      <div className="trim-toolbar">
        <div className="trim-toolbar__left">
          <button
            className="trim-btn trim-btn--icon"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            data-midi-bind="theia.workshop.transport.toggle"
          >
            {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <span className="trim-toolbar__time">{fmtMs(playheadMs)}</span>
          <span className="trim-toolbar__sep">/</span>
          <span className="trim-toolbar__time trim-toolbar__time--total">
            {fmtMs(effectiveTotalMs)}
          </span>
        </div>

        <div className="trim-toolbar__center">
          <span className="trim-toolbar__label">TRIM</span>
          <span className="trim-toolbar__range">
            {fmtMs(draftAtom.trim.startMs)} → {fmtMs(draftAtom.trim.endMs)}
          </span>
          <span className="trim-toolbar__duration">
            ({fmtMs(draftAtom.trim.endMs - draftAtom.trim.startMs)})
          </span>
        </div>

        <div className="trim-toolbar__right">
          <button
            className="trim-btn"
            onClick={() => handleSnapToPlayhead('in')}
            title="Set IN to playhead (I)"
            data-midi-bind="theia.workshop.trim.setIn"
          >
            SET IN
          </button>
          <button
            className="trim-btn"
            onClick={() => handleSnapToPlayhead('out')}
            title="Set OUT to playhead (O)"
            data-midi-bind="theia.workshop.trim.setOut"
          >
            SET OUT
          </button>
          <button
            className="trim-btn trim-btn--ghost"
            onClick={handleResetFull}
            title="Reset trim to full clip"
            data-midi-bind="theia.workshop.trim.reset"
          >
            RESET
          </button>
        </div>
      </div>

      {/* ── Track ── */}
      <div
        className="trim-track"
        ref={trackRef}
        onClick={handleTrackSeek}
      >
        {/* Ruler ticks */}
        <div className="trim-ruler" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="trim-ruler__tick" style={{ left: `${i * 10}%` }}>
              {effectiveTotalMs > 0 && (
                <span className="trim-ruler__label">
                  {fmtMs((effectiveTotalMs * i) / 10)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Outside-trim mask (left + right) */}
        <div
          className="trim-mask trim-mask--left"
          style={{ left: 0, width: `${inPct}%` }}
          aria-hidden="true"
        />
        <div
          className="trim-mask trim-mask--right"
          style={{ left: `${outPct}%`, width: `${100 - outPct}%` }}
          aria-hidden="true"
        />

        {/* Active trim region */}
        <div
          className="trim-region"
          style={{ left: `${inPct}%`, width: `${widthPct}%` }}
          aria-hidden="true"
        />

        {/* IN handle */}
        <div
          className="trim-handle trim-handle--in"
          style={{ left: `${inPct}%` }}
          onPointerDown={(e) => handleStartDrag(e, 'in')}
          onClick={(e) => e.stopPropagation()}
          title={`IN · ${fmtMs(draftAtom.trim.startMs)} (drag to adjust)`}
          data-midi-bind="theia.workshop.trim.handleIn"
        >
          <span className="trim-handle__grip" aria-hidden="true" />
          <span className="trim-handle__time">IN {fmtMs(draftAtom.trim.startMs)}</span>
        </div>

        {/* OUT handle */}
        <div
          className="trim-handle trim-handle--out"
          style={{ left: `${outPct}%` }}
          onPointerDown={(e) => handleStartDrag(e, 'out')}
          onClick={(e) => e.stopPropagation()}
          title={`OUT · ${fmtMs(draftAtom.trim.endMs)} (drag to adjust)`}
          data-midi-bind="theia.workshop.trim.handleOut"
        >
          <span className="trim-handle__grip" aria-hidden="true" />
          <span className="trim-handle__time">OUT {fmtMs(draftAtom.trim.endMs)}</span>
        </div>

        {/* Playhead needle */}
        {effectiveTotalMs > 0 && (
          <div
            className="trim-playhead"
            style={{ left: `${phPct}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

export default TheiaTrimmer
