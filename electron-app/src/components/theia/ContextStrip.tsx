/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🦎 <ContextStrip /> — WAVE 8304 (Blueprint Wave B · §5)
 *
 * Slot camaleónico de 56px bajo el Program Viewport. Reemplaza a la antigua
 * TransportBar: un único hueco, tres vistas mutuamente excluyentes según el
 * medio activo:
 *
 *   IDLE    → placeholder "NO SOURCE" (builtin/standby, nada que controlar).
 *   VIDEO   → PREV · PLAY/PAUSE · NEXT · LOOP · seek bar absoluta + timecode.
 *             El scrub es exclusivo de esta vista (los shaders no tienen
 *             playhead que arrastrar).
 *   SHADER  → PREV · NEXT · ≤4 macro-faders de genes `expr` (los primeros
 *             del layout `u_gene[k]`, misma ruta rápida que GeneFadersPanel)
 *             + MUTATE / FAV / SKIP (Darwin, mismos handlers que
 *             EcosystemControl).
 *
 * Comportamiento de layout: altura FEST (56px) y panes apilados con
 * crossfade de opacidad 150ms — cero layout shift al cambiar de medio.
 * Los tres panes quedan montados (pointer-events apagados en los ocultos):
 * el estado de scrub y los valores de los faders sobreviven a la transición.
 *
 * PREV/NEXT disparan `playPrev/playNext` de `useTheiaPlaylistStore`
 * (WAVE 8305 · Ola C) — se habilitan cuando la playlist tiene ítems y
 * saltan las tarjetas marcadas `skip`.
 *
 * REGLA DE ORO: solo LuxIcons internos. NADA de librerías externas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheiaTransportStore } from '../../stores/useTheiaTransportStore'
import { useTheiaPackStore } from '../../stores/useTheiaPackStore'
import { useTheiaPlaylistStore } from '../../stores/useTheiaPlaylistStore'
import {
  getThetaOrchestrator,
  layoutExprGenes,
  resolveGeneValues,
  type EuclidMeta,
} from '../../theia'
import { TELEMETRY_SLOT } from '../../theia/telemetry/TheiaTelemetryRing'
import { LuxIcon } from '../icons'

/** Máximo de macro-faders genéticos en el strip (blueprint §3, 4–6). */
const STRIP_GENE_SLOTS = 4

function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Throttle trailing por clave — el drag repinta al instante pero el
 *  postMessage al worker queda estrangulado (~11 Hz por canal). */
function makeKeyedThrottle(ms: number) {
  const last = new Map<string, number>()
  const pending = new Map<string, number>()
  return (key: string, fn: () => void) => {
    const now = performance.now()
    const prev = last.get(key) ?? -Infinity
    if (now - prev >= ms) {
      last.set(key, now)
      fn()
      return
    }
    const h = pending.get(key)
    if (h !== undefined) window.clearTimeout(h)
    pending.set(key, window.setTimeout(() => {
      last.set(key, performance.now())
      pending.delete(key)
      fn()
    }, ms - (now - prev)))
  }
}

/** Botón de navegación de playlist — WAVE 8305: dispara playPrev/playNext
 *  del store (salta ítems `skip`; arma si el motor está apagado). */
const NavBtn: React.FC<{
  dir: 'prev' | 'next'
  disabled: boolean
  onFire: () => boolean
}> = ({ dir, disabled, onFire }) => (
  <button
    type="button"
    className="theia-transport__btn"
    disabled={disabled}
    onClick={onFire}
    data-midi-bind={`theia.playlist.${dir}`}
    title={
      disabled
        ? `${dir === 'prev' ? 'PREV' : 'NEXT'} — playlist vacía`
        : `${dir === 'prev' ? 'PREV' : 'NEXT'} — playlist`
    }
    aria-label={dir === 'prev' ? 'Previous playlist item' : 'Next playlist item'}
  >
    {dir === 'prev' ? '⏮' : '⏭'}
  </button>
)

const ContextStrip: React.FC = () => {
  // ── Transporte (vídeo) — misma fuente que la antigua TransportBar ──
  const isPlaying   = useTheiaTransportStore((s) => s.isPlaying)
  const loop        = useTheiaTransportStore((s) => s.loop)
  const currentTime = useTheiaTransportStore((s) => s.currentTime)
  const duration    = useTheiaTransportStore((s) => s.duration)
  const hasVideo    = useTheiaTransportStore((s) => s.hasVideo)

  // ── Playlist (Wave C): ⏮/⏭ disparan la lista manual ──
  const hasPlaylist = useTheiaPlaylistStore((s) => s.items.length > 0)
  const handlePlaylistPrev = useCallback(
    () => useTheiaPlaylistStore.getState().playPrev(),
    [],
  )
  const handlePlaylistNext = useCallback(
    () => useTheiaPlaylistStore.getState().playNext(),
    [],
  )

  // ── Shader activo (meta de genes) — mismo patrón ~1 Hz que
  //    GeneFadersPanel/EcosystemControl (perf-report, no ruta caliente). ──
  const [activeId, setActiveId] = useState(() =>
    getThetaOrchestrator().getActiveShaderId(),
  )
  const [meta, setMeta] = useState<EuclidMeta | null>(null)
  const [values, setValues] = useState<Record<string, number>>({})

  useEffect(() => {
    const theta = getThetaOrchestrator()
    const offPerf = theta.onPerfReport((p) => {
      if (p.activeShader !== undefined) setActiveId(p.activeShader)
    })
    const offMeta = theta.onShaderMeta(() => {
      setMeta(theta.getShaderMeta(theta.getActiveShaderId()))
    })
    setMeta(theta.getShaderMeta(theta.getActiveShaderId()))
    return () => {
      offPerf()
      offMeta()
    }
  }, [])

  // Seed de valores al cambiar de átomo: saved (memoria inmortal) ?? fenotipo.
  const throttled = useMemo(() => makeKeyedThrottle(90), [])
  useEffect(() => {
    const theta = getThetaOrchestrator()
    const m = theta.getShaderMeta(activeId)
    setMeta(m)
    const layout = m ? layoutExprGenes(m) : []
    const resolved = m ? (resolveGeneValues(m) ?? {}) : {}
    const saved = useTheiaPackStore.getState().atomGeneValues.get(activeId)
    const seed: Record<string, number> = {}
    for (const name of layout) seed[name] = saved?.[name] ?? resolved[name] ?? 0
    setValues(seed)
    if (saved && layout.length > 0) {
      layout.forEach((name, k) => {
        const v = saved[name]
        if (v !== undefined) theta.setUniform(`u_gene[${k}]`, v)
      })
    }
  }, [activeId])

  // ── Máquina de estados (blueprint §5.1) ──
  const mode: 'idle' | 'video' | 'shader' = hasVideo
    ? 'video'
    : activeId !== 'builtin' && activeId.length > 0
      ? 'shader'
      : 'idle'

  // ── Scrub de vídeo (solo vista VIDEO) ──
  const [scrubbing, setScrubbing] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)
  const shownTime = scrubbing ? scrubTime : currentTime
  const pct = duration > 0 ? Math.min(100, (shownTime / duration) * 100) : 0

  const handlePlayPause = useCallback(() => {
    getThetaOrchestrator().toggleTransport()
  }, [])
  const handleLoop = useCallback(() => {
    getThetaOrchestrator().setTransportLoop(!loop)
  }, [loop])
  const handleScrubStart = useCallback(() => {
    setScrubTime(currentTime)
    setScrubbing(true)
  }, [currentTime])
  const handleScrubMove = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubTime(Number(e.target.value))
  }, [])
  const handleScrubCommit = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      getThetaOrchestrator().seekTransport(Number(e.currentTarget.value))
      setScrubbing(false)
    },
    [],
  )

  // ── Darwin (misma semántica que EcosystemControl) ──
  const handleFavorite = useCallback(() => {
    const id = getThetaOrchestrator().getActiveShaderId()
    if (id !== 'builtin' && id.length > 0) getThetaOrchestrator().markFavorite(id)
  }, [])
  const handleSkip = useCallback(() => {
    const id = getThetaOrchestrator().getActiveShaderId()
    if (id !== 'builtin' && id.length > 0) getThetaOrchestrator().markSkip(id)
  }, [])
  const handleMutate = useCallback(() => {
    const theta = getThetaOrchestrator()
    const id = theta.getActiveShaderId()
    if (id === 'builtin' || id.length === 0) return
    const f32 = new Float32Array(theta.getTelemetryRing())
    const barCount = Math.max(0, Math.floor(f32[TELEMETRY_SLOT.BAR_COUNT] || 0))
    const bpm = f32[TELEMETRY_SLOT.BPM]
    const barMs = bpm > 0 ? (60000 / bpm) * 4 : 0
    theta.evolveGenome(barCount, barMs)
  }, [])

  // ── Primeros N genes expr → macro-faders del strip ──
  const stripGenes = useMemo(() => {
    if (!meta) return []
    return layoutExprGenes(meta)
      .slice(0, STRIP_GENE_SLOTS)
      .map((name, k) => ({ name, k, decl: meta.genes.find((g) => g.name === name)! }))
      .filter((g) => g.decl)
  }, [meta])

  return (
    <div
      className="theia-ctxstrip"
      role="group"
      aria-label="Context strip"
      data-mode={mode}
    >
      {/* ─────────── IDLE ─────────── */}
      <div
        className={`theia-ctxstrip__pane theia-ctxstrip__pane--idle${mode === 'idle' ? ' is-on' : ''}`}
        aria-hidden={mode !== 'idle'}
      >
        <span className="theia-ctxstrip__idle-dot" aria-hidden>◇</span>
        <span className="theia-ctxstrip__idle-text">
          NO SOURCE — dispara un átomo del Media Browser o carga media
        </span>
      </div>

      {/* ─────────── VIDEO — Transport Strip ─────────── */}
      <div
        className={`theia-ctxstrip__pane theia-ctxstrip__pane--video${mode === 'video' ? ' is-on' : ''}`}
        aria-hidden={mode !== 'video'}
      >
        <NavBtn dir="prev" disabled={!hasPlaylist} onFire={handlePlaylistPrev} />
        <button
          type="button"
          className={`theia-transport__btn theia-transport__btn--play${isPlaying ? ' is-active' : ''}`}
          onClick={handlePlayPause}
          data-midi-bind="theia.transport.play"
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <LuxIcon name={isPlaying ? 'pause' : 'play'} size={16} />
        </button>
        <NavBtn dir="next" disabled={!hasPlaylist} onFire={handlePlaylistNext} />
        <button
          type="button"
          className={`theia-transport__btn theia-transport__btn--loop${loop ? ' is-active' : ''}`}
          onClick={handleLoop}
          data-midi-bind="theia.transport.loop"
          title={loop ? 'Loop ON' : 'Loop OFF'}
          aria-label={loop ? 'Loop ON' : 'Loop OFF'}
          aria-pressed={loop}
        >
          <LuxIcon name="loop" size={16} />
        </button>
        <input
          type="range"
          className="theia-transport__seek"
          min={0}
          max={Math.max(1, duration)}
          step={0.01}
          value={shownTime}
          disabled={duration <= 0}
          style={{ ['--pct' as string]: `${pct}%` }}
          onChange={handleScrubMove}
          onPointerDown={handleScrubStart}
          onPointerUp={handleScrubCommit}
          data-midi-bind="theia.transport.seek"
          aria-label="Seek"
        />
        <span className="theia-transport__clock" aria-hidden>
          {formatTimecode(shownTime)}
          <span className="theia-transport__clock-sep">/</span>
          {formatTimecode(duration)}
        </span>
      </div>

      {/* ─────────── SHADER — Genetic Strip ─────────── */}
      <div
        className={`theia-ctxstrip__pane theia-ctxstrip__pane--shader${mode === 'shader' ? ' is-on' : ''}`}
        aria-hidden={mode !== 'shader'}
      >
        <NavBtn dir="prev" disabled={!hasPlaylist} onFire={handlePlaylistPrev} />

        <div className="theia-ctxstrip__genes">
          {stripGenes.length === 0 ? (
            <span className="theia-ctxstrip__nogenes">
              {activeId} — sin genes expr
            </span>
          ) : (
            stripGenes.map(({ name, k, decl }) => {
              const label = (decl.label ?? name.replace(/^G_/, '')).toUpperCase()
              const v = values[name] ?? decl.defaultValue
              const range = Math.max(1e-6, decl.max - decl.min)
              const fill = Math.max(0, Math.min(100, ((v - decl.min) / range) * 100))
              return (
                <div
                  key={name}
                  className="theia-ctxstrip__fader"
                  title={`${name} · u_gene[${k}]`}
                  data-midi-bind={`theia.shader.${name}`}
                >
                  <span className="theia-ctxstrip__fader-label">{label}</span>
                  <input
                    type="range"
                    className="theia-ctxstrip__fader-input"
                    min={decl.min}
                    max={decl.max}
                    step={decl.type === 'int' ? 1 : (range / 200)}
                    value={v}
                    style={{ ['--pct' as string]: `${fill}%` }}
                    onChange={(e) => {
                      const raw = Number(e.target.value)
                      const val = decl.type === 'int' ? Math.round(raw) : raw
                      setValues((prev) => {
                        const next = { ...prev, [name]: val }
                        useTheiaPackStore.getState().setAtomGeneValues(activeId, next)
                        return next
                      })
                      throttled(`u_gene[${k}]`, () =>
                        getThetaOrchestrator().setUniform(`u_gene[${k}]`, val))
                    }}
                    aria-label={label}
                  />
                  <span className="theia-ctxstrip__fader-value">
                    {decl.type === 'int' ? `${Math.round(v)}` : v.toFixed(2)}
                  </span>
                </div>
              )
            })
          )}
        </div>

        <div className="theia-ctxstrip__darwin">
          <button
            type="button"
            className="theia-transport__btn"
            onClick={handleMutate}
            data-midi-bind="theia.darwin.mutate"
            title="MUTATE — evolveGenome fuera de compás"
            aria-label="Force mutation"
          >
            ⟳
          </button>
          <button
            type="button"
            className="theia-transport__btn"
            onClick={handleFavorite}
            data-midi-bind="theia.darwin.favorite"
            title="FAV — impulso positivo al fitness del genoma activo"
            aria-label="Favorite genome"
          >
            ♥
          </button>
          <button
            type="button"
            className="theia-transport__btn"
            onClick={handleSkip}
            data-midi-bind="theia.darwin.skip"
            title="SKIP — impulso negativo al fitness"
            aria-label="Skip genome"
          >
            ✕
          </button>
        </div>

        <NavBtn dir="next" disabled={!hasPlaylist} onFire={handlePlaylistNext} />
      </div>
    </div>
  )
}

export default ContextStrip
