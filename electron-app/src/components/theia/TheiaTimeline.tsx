/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱ THEIA TIMELINE — WAVE 4910.13
 * Pista horizontal inferior para gestionar los CuePoints del draft.
 *
 * WAVE 4910.13: Drag handles para resize (left/right) y move (centro).
 * ADD CUE coloca el bloque en el playhead, no siempre en 0ms.
 * Double-click en bloque = setDefaultCue.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheiaEditorStore } from '../../stores/useTheiaEditorStore'
import type { DraftCuePoint } from '../../stores/useTheiaEditorStore'
import { getThetaOrchestrator } from '../../theia'
import './TheiaTimeline.css'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const totalS = Math.floor(ms / 1000)
  const m = Math.floor(totalS / 60)
  const s = totalS % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const ZONE_COLORS: Record<string, string> = {
  silence:  '#475569',
  valley:   '#3b82f6',
  ambient:  '#06b6d4',
  gentle:   '#22c55e',
  active:   '#fbbf24',
  intense:  '#f97316',
  peak:     '#ef4444',
}

function cueColor(cue: DraftCuePoint): string {
  return ZONE_COLORS[cue.energyZone.max] ?? '#06b6d4'
}

// ─── SUB-COMPONENT: CueBlock ──────────────────────────────────────────────────

type DragHandle = 'left' | 'right' | 'move'

interface CueBlockProps {
  cue: DraftCuePoint
  leftPct: number
  widthPct: number
  isSelected: boolean
  onSelect: (id: string) => void
  onStartDrag: (e: React.PointerEvent, id: string, handle: DragHandle) => void
  onToggleDefault: (id: string) => void
}

const CueBlock: React.FC<CueBlockProps> = ({
  cue, leftPct, widthPct, isSelected, onSelect, onStartDrag, onToggleDefault,
}) => {
  const color = cueColor(cue)

  return (
    <div
      className={[
        'tl-cue',
        isSelected   ? 'is-selected' : '',
        cue.default  ? 'is-default'  : '',
        cue.isDivineCandidate ? 'is-divine' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left:  `${leftPct}%`,
        width: `${Math.max(widthPct, 2)}%`,
        ['--cue-color' as string]: color,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(cue.id) }}
      onDoubleClick={(e) => { e.stopPropagation(); onToggleDefault(cue.id) }}
      onPointerDown={(e) => {
        // Only start move-drag on the body of the block (not the handles)
        if ((e.target as HTMLElement).classList.contains('tl-cue__handle')) return
        onStartDrag(e, cue.id, 'move')
      }}
      title={`${cue.default ? '★ DEFAULT · ' : ''}${cue.name}\n${fmtMs(cue.startMs)} → ${fmtMs(cue.endMs)}\nDouble-click: ${cue.default ? 'ya es default' : 'marcar como default'}`}
      data-midi-bind={`theia.author.cue.${cue.id}`}
    >
      {/* ← Left resize handle */}
      <div
        className="tl-cue__handle tl-cue__handle--left"
        onPointerDown={(e) => { e.stopPropagation(); onStartDrag(e, cue.id, 'left') }}
        title="Drag to resize start"
      />

      <span className="tl-cue__name">{cue.name}</span>
      {cue.default && <span className="tl-cue__badge" title="Default cuepoint">★</span>}
      {cue.isDivineCandidate && (
        <span className="tl-cue__badge tl-cue__badge--divine" title="Divine candidate">⚡</span>
      )}
      <span className="tl-cue__time">{fmtMs(cue.startMs)}</span>

      {/* → Right resize handle */}
      <div
        className="tl-cue__handle tl-cue__handle--right"
        onPointerDown={(e) => { e.stopPropagation(); onStartDrag(e, cue.id, 'right') }}
        title="Drag to resize end"
      />
    </div>
  )
}

// ─── DRAG STATE TYPE ──────────────────────────────────────────────────────────

interface DragState {
  cueId: string
  handle: DragHandle
  startX: number
  origStart: number
  origEnd: number
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const TheiaTimeline: React.FC = () => {
  const draftAsset     = useTheiaEditorStore((s) => s.draftAsset)
  const selectedCueId  = useTheiaEditorStore((s) => s.selectedCueId)
  const selectCue      = useTheiaEditorStore((s) => s.selectCue)
  const addCuePoint    = useTheiaEditorStore((s) => s.addCuePoint)
  const deleteCuePoint = useTheiaEditorStore((s) => s.deleteCuePoint)

  // ── Playhead (RAF loop a ~30fps) ───────────────────────────────────────────
  const [playheadMs, setPlayheadMs]           = useState(0)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const playheadMsRef = useRef(0)           // stable ref for callbacks (no stale read)
  const trackRef      = useRef<HTMLDivElement>(null)
  const rafRef        = useRef<number>(0)

  useEffect(() => {
    let lastUpdate = 0
    const THROTTLE = 1000 / 30 // ~30fps is enough for playhead UX

    const loop = () => {
      const vid = getThetaOrchestrator().getVideoElement()
      if (vid) {
        const now = performance.now()
        if (now - lastUpdate >= THROTTLE) {
          const ms = vid.currentTime * 1000
          playheadMsRef.current = ms
          setPlayheadMs(ms)
          if (isFinite(vid.duration) && vid.duration > 0) {
            setVideoDurationMs(vid.duration * 1000)
          }
          lastUpdate = now
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Escala efectiva ────────────────────────────────────────────────────────

  const totalCueMs = useMemo(() => {
    if (!draftAsset || draftAsset.cuePoints.length === 0) return 0
    return Math.max(...draftAsset.cuePoints.map((cp) => cp.endMs))
  }, [draftAsset])

  const effectiveTotalMs = Math.max(totalCueMs, videoDurationMs)

  // Stable ref so window-level handlers always read the latest value
  const effectiveTotalMsRef = useRef(effectiveTotalMs)
  effectiveTotalMsRef.current = effectiveTotalMs

  const cueLayouts = useMemo(() => {
    if (!draftAsset) return []
    const scale = effectiveTotalMs
    if (scale <= 0) {
      const count = draftAsset.cuePoints.length
      return draftAsset.cuePoints.map((cp, i) => ({
        cue: cp,
        leftPct: (i / count) * 100,
        widthPct: (1 / count) * 100,
      }))
    }
    return draftAsset.cuePoints.map((cp) => ({
      cue: cp,
      leftPct: (cp.startMs / scale) * 100,
      widthPct: ((cp.endMs - cp.startMs) / scale) * 100,
    }))
  }, [draftAsset, effectiveTotalMs])

  // ── Drag logic ─────────────────────────────────────────────────────────────
  // All drag state in a ref → zero re-renders during drag

  const dragRef = useRef<DragState | null>(null)

  useEffect(() => {
    const MIN_DURATION_MS = 500

    const onPointerMove = (e: PointerEvent) => {
      const ds = dragRef.current
      if (!ds || !trackRef.current) return

      const trackWidth = trackRef.current.getBoundingClientRect().width
      if (trackWidth === 0) return

      const totalMs = effectiveTotalMsRef.current
      if (totalMs <= 0) return

      const deltaMs = ((e.clientX - ds.startX) / trackWidth) * totalMs

      const store = useTheiaEditorStore.getState()

      if (ds.handle === 'left') {
        const newStart = Math.max(0, Math.min(ds.origStart + deltaMs, ds.origEnd - MIN_DURATION_MS))
        store.updateCuePoint(ds.cueId, { startMs: Math.round(newStart) })
      } else if (ds.handle === 'right') {
        const newEnd = Math.max(
          ds.origStart + MIN_DURATION_MS,
          Math.min(ds.origEnd + deltaMs, totalMs),
        )
        store.updateCuePoint(ds.cueId, { endMs: Math.round(newEnd) })
      } else {
        // 'move': translate the whole block
        const duration = ds.origEnd - ds.origStart
        const newStart = Math.max(0, Math.min(ds.origStart + deltaMs, totalMs - duration))
        store.updateCuePoint(ds.cueId, {
          startMs: Math.round(newStart),
          endMs: Math.round(newStart + duration),
        })
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
  }, []) // intentionally empty — reads via refs

  const handleStartDrag = useCallback((
    e: React.PointerEvent,
    cueId: string,
    handle: DragHandle,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const cue = useTheiaEditorStore.getState().draftAsset?.cuePoints.find((cp) => cp.id === cueId)
    if (!cue) return
    dragRef.current = {
      cueId,
      handle,
      startX: e.clientX,
      origStart: cue.startMs,
      origEnd: cue.endMs,
    }
    document.body.style.cursor     = handle === 'move' ? 'grabbing' : 'ew-resize'
    document.body.style.userSelect = 'none'
    selectCue(cueId)
  }, [selectCue])

  // ── Select handler ─────────────────────────────────────────────────────────
  // WAVE 4910.14 M1: NUNCA toggle — siempre selecciona el id recibido.
  // La deselección ocurre solo al hacer click en el fondo del track (tl-track).

  const handleSelect = useCallback((id: string) => {
    selectCue(id)
  }, [selectCue])

  // ── Toggle default ──────────────────────────────────────────────────────────

  const handleToggleDefault = useCallback((id: string) => {
    useTheiaEditorStore.getState().setDefaultCue(id)
  }, [])

  // ── ADD CUE — coloca el nuevo cue en el playhead actual ───────────────────

  const handleAddCue = useCallback(() => {
    const startMs = Math.round(playheadMsRef.current)
    const totalMs = effectiveTotalMsRef.current
    const DEFAULT_DUR = 10_000
    const endMs = totalMs > 0
      ? Math.min(startMs + DEFAULT_DUR, totalMs)
      : startMs + DEFAULT_DUR

    addCuePoint({
      name: `cue-${fmtMs(startMs)}`,
      startMs,
      endMs: Math.round(endMs),
      dna: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
      energyZone: { min: 'silence', max: 'peak' },
      validSections: [],
      default: false,
    })
  }, [addCuePoint])

  // ── Delete selected ────────────────────────────────────────────────────────

  const handleDeleteSelected = useCallback(() => {
    if (selectedCueId) deleteCuePoint(selectedCueId)
  }, [deleteCuePoint, selectedCueId])

  // ── Seek on track click ────────────────────────────────────────────────────

  const handleTrackSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el  = trackRef.current
    const vid = getThetaOrchestrator().getVideoElement()
    if (!el || !vid || effectiveTotalMsRef.current <= 0) return
    const rect  = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetMs = ratio * effectiveTotalMsRef.current
    vid.currentTime = targetMs / 1000
    playheadMsRef.current = targetMs
    setPlayheadMs(targetMs)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  const isEmpty = !draftAsset || draftAsset.cuePoints.length === 0

  return (
    <div className="theia-timeline" aria-label="Timeline de CuePoints">
      {/* ── Toolbar ── */}
      <div className="tl-toolbar">
        <div className="tl-toolbar__left">
          <span className="tl-toolbar__label">TIMELINE</span>
          {effectiveTotalMs > 0 && (
            <span className="tl-toolbar__duration">{fmtMs(effectiveTotalMs)}</span>
          )}
          <span className="tl-toolbar__playhead">{fmtMs(playheadMs)}</span>
        </div>
        <div className="tl-toolbar__right">
          {selectedCueId && (
            <button
              className="tl-btn tl-btn--danger"
              onClick={handleDeleteSelected}
              title="Eliminar cue seleccionado"
              data-midi-bind="theia.author.timeline.delete"
            >
              — DEL
            </button>
          )}
          <button
            className="tl-btn tl-btn--add"
            onClick={handleAddCue}
            disabled={!draftAsset}
            title="Añadir cuepoint en el playhead actual"
            data-midi-bind="theia.author.timeline.add"
          >
            + ADD CUE
          </button>
        </div>
      </div>

      {/* ── Track ── */}
      {/* Click en fondo del track (no en un bloque) → deselecciona el cue activo. */}
      <div className="tl-track" ref={trackRef} onClick={() => selectCue(null)}>
        {/* Seek zone (detrás de todo) — también burbujeará deselect al track. */}
        <div className="tl-seekzone" onClick={handleTrackSeek} aria-hidden="true" />

        {/* Regla visual */}
        <div className="tl-ruler" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className="tl-ruler__tick" style={{ left: `${i * 10}%` }}>
              {effectiveTotalMs > 0 && (
                <span className="tl-ruler__label">
                  {fmtMs((effectiveTotalMs * i) / 10)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* CuePoint blocks — stopPropagation en cada bloque para no activar el onClick del track */}
        <div className="tl-blocks">
          {isEmpty ? (
            <div className="tl-empty">
              <span>Sin cuepoints — haz clic en <strong>+ ADD CUE</strong></span>
            </div>
          ) : (
            cueLayouts.map(({ cue, leftPct, widthPct }) => (
              <CueBlock
                key={cue.id}
                cue={cue}
                leftPct={leftPct}
                widthPct={widthPct}
                isSelected={cue.id === selectedCueId}
                onSelect={handleSelect}
                onStartDrag={handleStartDrag}
                onToggleDefault={handleToggleDefault}
              />
            ))
          )}
        </div>

        {/* Playhead needle */}
        {effectiveTotalMs > 0 && (
          <div
            className="tl-playhead"
            style={{ left: `${(playheadMs / effectiveTotalMs) * 100}%` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

export default TheiaTimeline
