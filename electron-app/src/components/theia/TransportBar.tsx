/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ <TransportBar /> — WAVE 8239 · U1 (Hybrid Deck)
 *
 * Barra de transporte del Command Deck: vive bajo el Viewport y encima del
 * LiveDeck. Gobierna el `HTMLVideoElement` oculto del orchestrator a través
 * del `useTheiaTransportStore` — la UI nunca toca el elemento directamente.
 *
 *   [⏵/⏸]  [LOOP]  ───────●───────────  00:42 / 03:17
 *
 *   - PLAY/PAUSE → `theta.toggleTransport()`
 *   - LOOP       → `theta.setTransportLoop()` (el handler 'ended' lo aplica)
 *   - SEEK       → `theta.seekTransport(sec)` — scrub absoluto con clamp
 *
 * Cuando el medio activo es un átomo `kind:'shader'` (hasVideo=false) la
 * barra se atenúa — un autómata generativo no tiene playhead que arrastrar.
 *
 * REGLA DE ORO: solo LuxIcons internos. NADA de librerías externas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useState } from 'react'
import { useTheiaTransportStore } from '../../stores/useTheiaTransportStore'
import { getThetaOrchestrator } from '../../theia'
import { LuxIcon } from '../icons'

function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const s = Math.floor(seconds)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const TransportBar: React.FC = () => {
  const isPlaying   = useTheiaTransportStore((s) => s.isPlaying)
  const loop        = useTheiaTransportStore((s) => s.loop)
  const currentTime = useTheiaTransportStore((s) => s.currentTime)
  const duration    = useTheiaTransportStore((s) => s.duration)
  const hasVideo    = useTheiaTransportStore((s) => s.hasVideo)

  // Scrub local: mientras el operador arrastra el fader no queremos que el
  // 'timeupdate' del elemento pise la posición bajo su dedo.
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

  return (
    <div
      className={`theia-transport${hasVideo ? '' : ' is-inactive'}`}
      role="group"
      aria-label="Media transport"
    >
      <button
        type="button"
        className={`theia-transport__btn theia-transport__btn--play${isPlaying ? ' is-active' : ''}`}
        onClick={handlePlayPause}
        disabled={!hasVideo}
        data-midi-bind="theia.transport.play"
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        <LuxIcon name={isPlaying ? 'pause' : 'play'} size={16} />
      </button>

      <button
        type="button"
        className={`theia-transport__btn theia-transport__btn--loop${loop ? ' is-active' : ''}`}
        onClick={handleLoop}
        disabled={!hasVideo}
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
        disabled={!hasVideo || duration <= 0}
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
  )
}

export default TransportBar
