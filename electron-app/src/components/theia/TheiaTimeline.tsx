/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⏱ THEIA TIMELINE — WAVE 4910.4 / 4910.5
 * Pista horizontal inferior para gestionar los CuePoints del draft.
 *
 * Renderiza bloques proporcionales si draftAsset tiene cuepoints con
 * rangos temporales. Sin duración total conocida → bloques de ancho fijo.
 * Click en bloque → selectCue(id). Botón ADD → addCuePoint con defaults.
 * WAVE 4910.5: RAF playhead polling + click-to-seek.
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

interface CueBlockProps {
  cue: DraftCuePoint
  leftPct: number
  widthPct: number
  isSelected: boolean
  onSelect: (id: string) => void
}

const CueBlock: React.FC<CueBlockProps> = ({
  cue, leftPct, widthPct, isSelected, onSelect,
}) => {
  const color = cueColor(cue)

  return (
    <div
      className={`tl-cue${isSelected ? ' is-selected' : ''}${cue.default ? ' is-default' : ''}${cue.isDivineCandidate ? ' is-divine' : ''}`}
      style={{
        left: `${leftPct}%`,
        width: `${Math.max(widthPct, 3)}%`,
        ['--cue-color' as string]: color,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(cue.id) }}
      title={`${cue.name} · ${fmtMs(cue.startMs)} → ${fmtMs(cue.endMs)}`}
      data-midi-bind={`theia.author.cue.${cue.id}`}
    >
      <span className="tl-cue__name">{cue.name}</span>
      {cue.default && <span className="tl-cue__badge">★</span>}
      {cue.isDivineCandidate && <span className="tl-cue__badge tl-cue__badge--divine">⚡</span>}
      <span className="tl-cue__time">{fmtMs(cue.startMs)}</span>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const TheiaTimeline: React.FC = () => {
  const draftAsset     = useTheiaEditorStore((s) => s.draftAsset)
  const selectedCueId  = useTheiaEditorStore((s) => s.selectedCueId)
  const selectCue      = useTheiaEditorStore((s) => s.selectCue)
  const addCuePoint    = useTheiaEditorStore((s) => s.addCuePoint)
  const deleteCuePoint = useTheiaEditorStore((s) => s.deleteCuePoint)

  // ── Playhead (RAF loop a 60fps) ────────────────────────────────────────────
  const [playheadMs, setPlayheadMs]           = useState(0)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef   = useRef<number>(0)

  useEffect(() => {
    const loop = () => {
      const vid = getThetaOrchestrator().getVideoElement()
      if (vid) {
        setPlayheadMs(vid.currentTime * 1000)
        if (isFinite(vid.duration) && vid.duration > 0) {
          setVideoDurationMs(vid.duration * 1000)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Cálculos de escala ─────────────────────────────────────────────────────

  const totalMs = useMemo(() => {
    if (!draftAsset || draftAsset.cuePoints.length === 0) return 0
    return Math.max(...draftAsset.cuePoints.map((cp) => cp.endMs))
  }, [draftAsset])

  // Escala efectiva: max entre cuepoints y duración real del vídeo
  const effectiveTotalMs = Math.max(totalMs, videoDurationMs)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftAsset, effectiveTotalMs])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string) => {
    selectCue(selectedCueId === id ? null : id)
  }, [selectCue, selectedCueId])

  /** Click en la zona vacía del track → seek al timestamp proporcional. */
  const handleTrackSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el  = trackRef.current
    const vid = getThetaOrchestrator().getVideoElement()
    if (!el || !vid || effectiveTotalMs <= 0) return
    const rect  = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetMs = ratio * effectiveTotalMs
    vid.currentTime = targetMs / 1000
    setPlayheadMs(targetMs)
  }, [effectiveTotalMs])

  const handleAddCue = useCallback(() => {
    addCuePoint({
      name: 'nuevo-cue',
      startMs: 0,
      endMs: 1000,
      dna: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
      energyZone: { min: 'silence', max: 'peak' },
      validSections: [],
      default: false,
    })
  }, [addCuePoint])

  const handleDeleteSelected = useCallback(() => {
    if (selectedCueId) deleteCuePoint(selectedCueId)
  }, [deleteCuePoint, selectedCueId])

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
            title="Añadir nuevo CuePoint"
            data-midi-bind="theia.author.timeline.add"
          >
            + ADD CUE
          </button>
        </div>
      </div>

      {/* ── Track ── */}
      <div className="tl-track" ref={trackRef}>
        {/* Zona invisible de seek — detrás de todo (z-index: 0) */}
        <div className="tl-seekzone" onClick={handleTrackSeek} aria-hidden="true" />

        {/* Regla visual decorativa */}
        <div className="tl-ruler" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => (
            <div
              key={i}
              className="tl-ruler__tick"
              style={{ left: `${i * 10}%` }}
            >
              {effectiveTotalMs > 0 && (
                <span className="tl-ruler__label">
                  {fmtMs((effectiveTotalMs * i) / 10)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* CuePoint blocks */}
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
              />
            ))
          )}
        </div>

        {/* Aguja de playhead */}
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
