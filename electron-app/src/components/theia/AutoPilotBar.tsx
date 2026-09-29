/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✈️ <AutoPilotBar /> — WAVE 8306 (Blueprint Ola D1 · §6.3)
 *
 * Barra de control del secuenciador mecánico, 36px fijos, situada sobre el
 * PlaylistLane en PERFORM. Solo UI: el motor (`TheiaAutopilot`) corre fuera
 * de React con su propio lector del SAB de telemetría.
 *
 *   [■ OFF | ▶ SEQ | ⟲ LOOP | ⤨ SHUFFLE] · DWELL [32 bars ▾] ·
 *   QUANT [phrase ▾] · X-FADE [2s] · DROP SNAP ● · «countdown + mini-prog»
 *
 * El indicador lee `countdownLabel`/`dwellFrac` del store — el engine los
 * escribe ≤ ~8 Hz vía `__engineReport` (anti-churn incorporado).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback } from 'react'
import {
  DWELL_PRESETS_BARS,
  DWELL_PRESETS_SEC,
  useTheiaAutopilotStore,
  type AutopilotMode,
  type AutopilotQuant,
} from '../../stores/useTheiaAutopilotStore'
import { useTheiaPlaylistStore } from '../../stores/useTheiaPlaylistStore'
import { LuxIcon } from '../icons'

const MODES: readonly { id: AutopilotMode; label: string; title: string }[] = [
  { id: 'off', label: '■ OFF', title: 'Auto-Pilot desactivado' },
  { id: 'seq', label: '▶ SEQ', title: 'Secuencia continua — se detiene al final' },
  { id: 'loop', label: '⟲ LOOP', title: 'Loop — vuelve al inicio' },
  { id: 'shuffle', label: '⤨ SHUF', title: 'Shuffle — bolsa sin repetición' },
]

const QUANTS: readonly { id: AutopilotQuant; label: string }[] = [
  { id: 'beat', label: 'beat' },
  { id: 'bar', label: 'bar' },
  { id: 'phrase', label: 'phrase' },
]

const AutoPilotBar: React.FC = () => {
  const mode = useTheiaAutopilotStore((s) => s.mode)
  const dwell = useTheiaAutopilotStore((s) => s.dwell)
  const quant = useTheiaAutopilotStore((s) => s.quant)
  const xFadeSec = useTheiaAutopilotStore((s) => s.xFadeSec)
  const dropSnap = useTheiaAutopilotStore((s) => s.dropSnap)
  const countdownLabel = useTheiaAutopilotStore((s) => s.countdownLabel)
  const dwellFrac = useTheiaAutopilotStore((s) => s.dwellFrac)
  const syncWaiting = useTheiaAutopilotStore((s) => s.syncWaiting)
  const engineRunning = useTheiaAutopilotStore((s) => s.engineRunning)
  const hasItems = useTheiaPlaylistStore((s) => s.items.length > 0)

  const setMode = useTheiaAutopilotStore((s) => s.setMode)
  const setDwell = useTheiaAutopilotStore((s) => s.setDwell)
  const setQuant = useTheiaAutopilotStore((s) => s.setQuant)
  const setXFadeSec = useTheiaAutopilotStore((s) => s.setXFadeSec)
  const setDropSnap = useTheiaAutopilotStore((s) => s.setDropSnap)

  const dwellPresets =
    dwell.unit === 'bars' ? DWELL_PRESETS_BARS : DWELL_PRESETS_SEC

  const handleDwellUnit = useCallback(() => {
    // Alterna bars ⇄ sec manteniendo un preset sensato del nuevo dominio.
    setDwell(
      dwell.unit === 'bars'
        ? { unit: 'sec', value: 20 }
        : { unit: 'bars', value: 32 },
    )
  }, [dwell.unit, setDwell])

  return (
    <div
      className={`theia-autopilot${mode !== 'off' ? ' is-on' : ''}`}
      role="group"
      aria-label="Auto-Pilot"
    >
      <span className="theia-autopilot__label">
        <LuxIcon name="bolt" size={10} />
        PILOT
      </span>

      {/* ── Modo ── */}
      <div className="theia-autopilot__modes" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`theia-autopilot__mode${mode === m.id ? ' is-active' : ''}`}
            onClick={() => setMode(m.id)}
            disabled={m.id !== 'off' && !hasItems}
            title={m.id !== 'off' && !hasItems ? 'Playlist vacía' : m.title}
            data-midi-bind={`theia.pilot.mode.${m.id}`}
            role="tab"
            aria-selected={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── DWELL ── */}
      <label className="theia-autopilot__ctl" title="Permanencia por ítem">
        <span className="theia-autopilot__key">DWELL</span>
        <select
          className="theia-autopilot__select"
          value={dwell.value}
          onChange={(e) => setDwell({ ...dwell, value: Number(e.target.value) })}
          data-midi-bind="theia.pilot.dwell"
        >
          {dwellPresets.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="theia-autopilot__unit"
          onClick={handleDwellUnit}
          title="Unidad del dwell — compases ⇄ segundos"
        >
          {dwell.unit === 'bars' ? 'bars' : 's'}
        </button>
      </label>

      {/* ── QUANT ── */}
      <label className="theia-autopilot__ctl" title="Frontera musical del corte">
        <span className="theia-autopilot__key">QUANT</span>
        <select
          className="theia-autopilot__select"
          value={quant}
          onChange={(e) => setQuant(e.target.value as AutopilotQuant)}
          data-midi-bind="theia.pilot.quant"
        >
          {QUANTS.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
      </label>

      {/* ── X-FADE ── */}
      <label
        className="theia-autopilot__ctl theia-autopilot__ctl--xfade"
        title="Crossfade del disparo automático (0–8 s)"
      >
        <span className="theia-autopilot__key">X-FADE</span>
        <input
          type="range"
          className="theia-autopilot__xfade"
          min={0}
          max={8}
          step={0.5}
          value={xFadeSec}
          onChange={(e) => setXFadeSec(Number(e.target.value))}
          data-midi-bind="theia.pilot.xfade"
        />
        <span className="theia-autopilot__val">{xFadeSec.toFixed(1)}s</span>
      </label>

      {/* ── DROP SNAP ── */}
      <button
        type="button"
        className={`theia-autopilot__snap${dropSnap ? ' is-active' : ''}`}
        onClick={() => setDropSnap(!dropSnap)}
        data-midi-bind="theia.pilot.dropsnap"
        title="DROP SNAP — adelanta el corte al downbeat si hay drop inminente"
        aria-pressed={dropSnap}
      >
        ◆ SNAP
      </button>

      {/* ── Countdown ── */}
      <div
        className={`theia-autopilot__countdown${syncWaiting ? ' is-sync' : ''}`}
        title="Cuenta atrás hasta la próxima transición"
      >
        <span className="theia-autopilot__clock">
          {mode === 'off' ? '—' : engineRunning ? countdownLabel : '—'}
        </span>
        <span className="theia-autopilot__prog" aria-hidden>
          <span
            className="theia-autopilot__prog-fill"
            style={{ width: `${dwellFrac * 100}%` }}
          />
        </span>
      </div>
    </div>
  )
}

export default AutoPilotBar
