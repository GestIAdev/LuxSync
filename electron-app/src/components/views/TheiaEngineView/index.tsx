/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA ENGINE VIEW — WAVE 4862: THE COMMAND DECK
 * Premium industrial-cyberpunk UI for the Theia video engine.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │          HEADER (60px): logo + LOAD ASSETS / LOAD PACK          │
 *   ├──────────────────────────────────────────┬──────────────────────┤
 *   │                                          │   INSPECTOR          │
 *   │   MAIN VIEWPORT (worker canvas)          │   (retractable)      │
 *   │                                          │   ▸ Live Telemetry   │
 *   │   TRANSPORT BAR (play/loop/seek)         │   ▸ Masters          │
 *   ├──────────────────────────────────────────┤   ▸ Ecosystem Ctrl   │
 *   │   DECK (LiveDeck — Universal Media Pool) │   ▸ Shader Params    │
 *   └──────────────────────────────────────────┴──────────────────────┘
 *
 * MIDI BINDINGS (every control carries data-midi-bind for MidiLearn):
 *   theia.power · theia.brightness · theia.speed · theia.contrast · theia.blackout
 *   theia.transport.play · theia.transport.loop · theia.transport.seek
 *   theia.darwin.favorite · theia.darwin.extinguish · theia.darwin.mutate
 *   theia.toggle-output · theia.load-assets · theia.load-pack
 *
 * 🌊 WAVE 8211 (H1+H2): mock clips, synthetic heartbeat, PATCH PREVIEW and
 * dead buttons purged; masters wired to the worker via `theia:set-uniform`.
 * �️ WAVE 8239 · U1 — HYBRID DECK: el "Author Mode" queda DEMOLIDO
 * (WorkshopDeck/TheiaTrimmer/TheiaDNALab + useTheiaEditorStore eliminados).
 * Theia es 100% LIVE OPERATION: transporte reactivo + media pool universal.
 * 🎛️ WAVE 8240 · U2 — TELEMETRY WIRING: masters consolidados en el
 * Inspector, Manual Overrides sustituidos por Ecosystem Control (Darwin:
 * favorite/extinguish/mutate) y el monitor vive del ring 256B vía
 * `TelemetryWireReader` + rAF — zero React state en la ruta caliente.
 *
 * @module views/TheiaEngineView
 * @version WAVE 8240
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './TheiaEngineView.css'
import { getThetaOrchestrator, getSeleneTheiaBridge, getTheiaAutopilot } from '../../../theia'
// 🔮 WAVE 8230 — EUCLID · E4: meta @euclid → sliders
import type { EuclidMeta } from '../../../theia'
// 🧬 WAVE 8241 · U3 — gene faders (u_gene fast-path) + HUD biológico
import { layoutExprGenes, resolveGeneValues, getFitness } from '../../../theia'
import { useControlStore } from '../../../stores/controlStore'
import {
  isSupportedMediaFile,
  MEDIA_POOL_ACCEPT,
  useTheiaPackStore,
} from '../../../stores/useTheiaPackStore'
// 🖥️ WAVE 8303 — workspaces PERFORM/DESIGN + drawer del Media Browser
import {
  useTheiaUiStore,
  panelCollapseFor,
} from '../../../stores/useTheiaUiStore'
import LiveDeck from '../../theia/LiveDeck'
import ContextStrip from '../../theia/ContextStrip'
import PlaylistLane from '../../theia/PlaylistLane'
import AutoPilotBar from '../../theia/AutoPilotBar'
import DirectorControl from '../../theia/DirectorControl'
import { useTheiaPlaylistStore } from '../../../stores/useTheiaPlaylistStore'
import { LuxIcon } from '../../icons'
// 🎛️ WAVE 8240 · U2 — lectura zero-alloc del ring 256B (Glass Bridge mirror)
import {
  TelemetryWireReader,
  TELEMETRY_SLOT,
  unpackEnums,
  type TelemetryEnums,
} from '../../../theia/telemetry/TheiaTelemetryRing'

// ═══════════════════════════════════════════════════════════════════════════
// TELEMETRY — 🎛️ WAVE 8240 · U2
// ═══════════════════════════════════════════════════════════════════════════

/** energyZone (Selene) → label/color del monitor. Índice = bits 24..31 del ENUMS. */
const ZONE_META = [
  { label: 'CALM',    color: '#2ecc10' },
  { label: 'RISING',  color: '#fbbf24' },
  { label: 'PEAK',    color: '#ef4444' },
  { label: 'FALLING', color: '#a855f7' },
] as const

/** Muestra de energía en el sparkline del Inspector (rolling window). */
const SPARK_LEN = 60

/** La telemetría del pump caduca: >750 ms sin frame válido = link muerto. */
const TELEMETRY_STALE_MS = 750

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const TheiaEngineView: React.FC = () => {
  // ── Master controls ───────────────────────────────────────────────────
  // 🔥 HOTFIX 8314 — enginePower ya NO es useState local: vive en el UI
  // store global (`engineLive`), hidratado desde `theta.getStatus()` en
  // mount y reconciliado por onWorkerEpoch. Navegar entre vistas no puede
  // resetear el botón a OFF mientras el motor sigue corriendo.
  const enginePower = useTheiaUiStore((s) => s.engineLive)
  const setEngineLive = useTheiaUiStore((s) => s.setEngineLive)
  const [blackout, setBlackout] = useState(false)
  // 🌊 WAVE 8259 — BRIGHT/SPEED/CONTRAST ya NO viven en la raíz: cada `input`
  // del fader re-renderizaba el árbol entero (Viewport+Deck+Inspector) a
  // ~100Hz → el hilo se saturaba y el telemetry port pasaba hambre
  // (telGap>500ms). Ahora residen en <MastersPanel/> (columna fija propia):
  // el re-render queda acotado a 3 nodos y los efectos caros van throttled.

  // 🌊 WAVE 8242 · U4 — estado del fade BLACKOUT + resumen del transporte.
  const blackoutLevelRef = useRef(0)
  const blackoutRafRef = useRef<number | null>(null)
  const resumeAfterBlackoutRef = useRef(false)

  // 🌊 WAVE 8242 · U4 — IGNITION sync: si el motor arranca por otra vía
  // (respawn Phoenix), el epoch del worker refleja `isRunning` en el
  // toggle POWER/STREAMING.
  // 🖥️ WAVE 8268 — un spawn real (LIVE/Phoenix) desarma el tile: el
  // pendingPlayIntent se dispara tras 'theia:ready' + hydrate, así que el
  // marcador "armed" ya cumplió su función visual.
  useEffect(() => {
    const theta = getThetaOrchestrator()
    // 🔥 HOTFIX 8314 — hidratación INMEDIATA en mount: si el motor ya
    // corre (volvimos de otra vista), el botón refleja LIVE sin esperar
    // al próximo evento de epoch.
    setEngineLive(theta.getStatus().isRunning)
    return theta.onWorkerEpoch(() => {
      setEngineLive(theta.getStatus().isRunning)
      useTheiaPackStore.getState().setArmedAtom(null)
    })
  }, [setEngineLive])

  useEffect(() => () => {
    if (blackoutRafRef.current !== null) cancelAnimationFrame(blackoutRafRef.current)
  }, [])

  // ── Inspector ──────────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const toggleInspector = useCallback(() => setInspectorOpen((o) => !o), [])

  // 🖥️ WAVE 8303 — workspace mode (PERFORM ⇄ DESIGN) + drawer del browser.
  const workspaceMode = useTheiaUiStore((s) => s.mode)
  const toggleMode = useTheiaUiStore((s) => s.toggleMode)
  const browserOpen = useTheiaUiStore((s) => s.browserOpen)
  const toggleBrowser = useTheiaUiStore((s) => s.toggleBrowser)

  // Tecla Tab → alterna PERFORM/DESIGN (blueprint §8). Misma guardia que el
  // Spacebar de BLACKOUT: nada dentro de inputs/editables; preventDefault
  // para que Tab no robe el foco.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.repeat) return
      const el = e.target as HTMLElement | null
      if (el) {
        const tag = el.tagName
        if (el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      }
      e.preventDefault()
      toggleMode()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMode])

  // 🎛️ WAVE 8240 · U2 — la telemetría vive en el Inspector/Viewport a través
  // del ring 256B (TelemetryWireReader + rAF sobre refs). Cero React state
  // en la ruta caliente — aquí no queda nada que alimentar.

  // ── Output window state ──────────────────────────────────────────────
  const [isOutputActive, setIsOutputActive] = useState(false)

  // ── AI / SeleneTheiaBridge ─────────────────────────────────────────────
  const aiEnabled = useControlStore((s) => s.aiEnabled)

  // ─── WAVE 4870: SeleneTheiaBridge — attach/detach por aiEnabled ─────────
  useEffect(() => {
    const bridge = getSeleneTheiaBridge()
    const theta  = getThetaOrchestrator()
    if (aiEnabled) {
      bridge.attach(theta)
    } else {
      bridge.detach()
    }
    return () => { bridge.detach() }
  }, [aiEnabled])

  // ─── 🌊 WAVE 8300 — DISK-ONLY: los átomos de fábrica ya no se siembran
  // desde código. El LiveDeck se hidrata EXCLUSIVAMENTE del scan IPC de
  // `userData/theia/packs/` (auto-scan al montar LiveDeck + botón RESCAN).

  // ─── 🌊 WAVE 8211 (H2) — Push initial master values to the worker once.
  // The orchestrator replays them on every 'theia:ready' (Phoenix respawn),
  // so this just keeps the UI and the shader in sync at mount.
  // 🌊 WAVE 8259 — brightness/contrast/speed empujan su inicial desde
  // <MastersPanel/>; aquí solo queda el master que también posee la raíz.
  useEffect(() => {
    getThetaOrchestrator().setUniform('u_blackout', blackout ? 1 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handlePower = useCallback(() => {
    const theta = getThetaOrchestrator()
    // 🌊 WAVE 8220 — UPDATER CLEANSING: los updaters de useState corren en
    // fase de render (y React StrictMode los invoca dos veces) — deben ser
    // puros. start()/stop() ejecutan spawn/terminate/postMessage de forma
    // síncrona en su prefijo; un throw ahí (worker agotado, DataCloneError
    // en un transfer) detonaba DENTRO del render y derribaba el árbol Fiber
    // (crash en flushSyncWorkAcrossRoots_impl). Patrón imperativo: el
    // side-effect queda fuera del updater y cualquier fallo aterriza en el
    // .catch(), nunca en la fase síncrona de React.
    const next = !enginePower
    // Optimista para feedback instantáneo; el settle reconcilia con la
    // verdad del orquestador (start() es idempotente si ya corría).
    setEngineLive(next)
    const reconcile = () => setEngineLive(theta.getStatus().isRunning)
    if (next) {
      theta.start().then(reconcile).catch((err: unknown) => {
        console.error('[Theia UI] start() failed:', err)
        reconcile()
      })
    } else {
      theta.stop().then(reconcile).catch((err: unknown) => {
        console.error('[Theia UI] stop() failed:', err)
        reconcile()
      })
    }
  }, [enginePower, setEngineLive])

  // �️ WAVE 8240 · U2 — MANUAL OVERRIDES demolido: los forceState manuales
  // quedan reemplazados por Ecosystem Control (Darwin). El bridge Selene→
  // forceState() sigue vivo en SeleneTheiaBridge (path automático).

  // 🎬 WAVE 4864 — Phase 3: Open / Close projector window
  // 💡 WAVE 4870: Tracks isOutputActive for visual feedback on the button
  const handleToggleOutput = useCallback(async () => {
    const orch = getThetaOrchestrator()
    const isOpen = await orch.isOutputWindowOpen()
    if (isOpen) {
      await orch.closeOutputWindow()
      setIsOutputActive(false)
    } else {
      const res = await orch.openOutputWindow()
      if (res.ok) {
        setIsOutputActive(true)
      } else {
        console.error('[Theia UI] openOutputWindow failed:', res.error)
      }
    }
  }, [])

  // ── 🌊 WAVE 8211 (H2) — Masters: brightness/contrast/speed viven en
  // <MastersPanel/> (WAVE 8259 — el estado salió de la raíz). ────────────

  const handleBlackout = useCallback(() => {
    // 🌊 WAVE 8242 · U4 — BLACKOUT suave: u_blackout rampea 0↔1 por rAF
    // (smoothstep, ~320ms) — nada de corte seco. Con el nivel a 1 el worker
    // salta el pase pesado y la GPU descansa (early-out en el render loop).
    // Además el transporte se pausa al activar y se reanuda al liberar.
    const theta = getThetaOrchestrator()
    const next = !blackout
    setBlackout(next)

    const vid = theta.getVideoElement()
    if (next) {
      resumeAfterBlackoutRef.current = !!vid && !vid.paused
      try { vid?.pause() } catch { /* noop */ }
    } else if (resumeAfterBlackoutRef.current) {
      resumeAfterBlackoutRef.current = false
      vid?.play().catch((err) => {
        console.warn('[Theia UI] resume after blackout failed:', err)
      })
    }

    if (blackoutRafRef.current !== null) cancelAnimationFrame(blackoutRafRef.current)
    const from = blackoutLevelRef.current
    const to = next ? 1 : 0
    const t0 = performance.now()
    const dur = 320
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const s = k * k * (3 - 2 * k) // smoothstep
      const v = from + (to - from) * s
      blackoutLevelRef.current = v
      theta.setUniform('u_blackout', v)
      blackoutRafRef.current = k < 1 ? requestAnimationFrame(step) : null
    }
    blackoutRafRef.current = requestAnimationFrame(step)
  }, [blackout])

  // 🌊 WAVE 8302 · M2 — BOTÓN DEL PÁNICO: Spacebar → BLACKOUT.
  // Global (window): el botón es un reflejo VJ — debe funcionar con el
  // foco en cualquier hijo del panel. Guardias:
  //  · preventDefault ANTES del toggle (Space scrollea si lo ignoramos).
  //  · skip si el target es input/textarea/select/contenteditable — ahí el
  //    espacio es texto, no panic. repeat filtrado (un toggle por pulsación).
  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null
      if (!el) return false
      if (el.isContentEditable) return true
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (e.repeat || isEditableTarget(e.target)) return
      e.preventDefault()
      handleBlackout()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleBlackout])

  // ✈️ WAVE 8306 — Auto-Pilot: conecta el motor a los stores mientras la
  // vista Theia está montada (rAF propio + SAB de telemetría, fuera de React).
  // 🔥 HOTFIX 8314 — el Auto-Pilot es un singleton del proceso, no una
  // dependencia de vista: NO usamos el dispose que devuelve init() como
  // cleanup, o navegar a otra pestaña silenciaría a Selene aunque el motor
  // siguiera emitiendo vídeo. init() es idempotente; vive con la app.
  useEffect(() => {
    getTheiaAutopilot().init()
  }, [])

  // 🎬 WAVE 8307 — atajos 1–9: disparo manual del slot N de la playlist
  // (solo PERFORM). `playAt` sin `auto` ⇒ take-over: el Director pasa a HOLD.
  useEffect(() => {
    if (workspaceMode !== 'perform') return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (!/^[1-9]$/.test(e.key)) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      const st = useTheiaPlaylistStore.getState()
      const idx = Number(e.key) - 1
      if (idx >= st.items.length) return
      e.preventDefault()
      st.playAt(idx)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [workspaceMode])


  // ── File Picker ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const packInputRef = useRef<HTMLInputElement | null>(null)

  // Inyecta webkitdirectory/directory sobre el input del Pack una sola vez al montar.
  // Son atributos no-estándar que React no acepta como props declarativas.
  useEffect(() => {
    if (packInputRef.current) {
      packInputRef.current.setAttribute('webkitdirectory', '')
      packInputRef.current.setAttribute('directory', '')
    }
  }, [])

  // ── 🎛️ WAVE 8239 · U1 — Universal Media Pool ────────────────────────
  // LOAD ASSETS acepta vídeo (.mp4 .webm .mkv .mov .avi), átomos (.theia) y
  // shaders (.glsl). Todos nacen como átomos jugables en el pack; el primer
  // átomo se dispara por playAtom (la misma vía que un click del LiveDeck).
  // 🖥️ WAVE 8268 — STRICT LIVE GATE: SIN auto-arranque. Con el motor
  // apagado el intent queda ARMADO (pendingPlayIntent + tile is-armed) y
  // se dispara cuando el operador pulse LIVE.
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      isSupportedMediaFile(f.name),
    )
    // Reset para permitir re-selección del mismo archivo
    e.target.value = ''
    if (files.length === 0) {
      console.warn('[Theia UI] No supported files in selection')
      return
    }

    const { ingestFiles, updateRawClip, updateAtomTrim, setArmedAtom } =
      useTheiaPackStore.getState()
    const { clips, atoms } = await ingestFiles(files)
    if (atoms.length === 0 && clips.length === 0) return

    const theta = getThetaOrchestrator()
    const primary = atoms[0]

    try {
      if (primary) {
        await theta.playAtom({
          atomId: primary.id,
          startMs: primary.trim.startMs,
          crossfadeMs: 80,
          reason: `manual:ingest|atom=${primary.id}`,
        })

        // 🖥️ WAVE 8268 — si el motor estaba apagado el intent quedó armado
        // (no arrancó: STRICT LIVE GATE) → el tile se ilumina en standby.
        const st = theta.getStatus()
        setArmedAtom(st.isRunning && st.isReady ? null : primary.id)

        // Duración real del clip para el media pool (metadata ya cargada).
        const clip = clips.find((c) => c.id === primary.id)
        const vidDuration = theta.getVideoElement()?.duration ?? 0
        const durMs = Number.isFinite(vidDuration) && vidDuration > 0
          ? Math.round(vidDuration * 1000)
          : 0
        if (clip && durMs > 0) {
          updateRawClip(clip.id, { durationMs: durMs })
          updateAtomTrim(primary.id, primary.packId, durMs)
        }
      }
      console.log(
        `[Theia UI] ✅ Ingested ${clips.length} clip(s) + ${atoms.length} atom(s) ` +
        `into pack '${primary?.packId ?? '—'}'`
      )
    } catch (err) {
      console.error('[Theia UI] playAtom() failed:', err)
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div
      className={`theia-view is-mode-${workspaceMode} ${inspectorOpen ? 'theia-view--insp-open' : 'theia-view--insp-closed'}`}
    >
      {/* ═══════════════════════════════════════════════════════════════════
       * HEADER TOOLBAR
       * ═══════════════════════════════════════════════════════════════════ */}
      <header className="theia-header">
        <div className="theia-header__brand">
          <div className={`theia-header__logo ${enginePower ? 'is-on' : ''}`}>
            <span className="theia-header__logo-eye" />
          </div>
          <div className="theia-header__title-block">
            <h1 className="theia-header__title">THEIA</h1>
            <span className="theia-header__subtitle">VIDEO ENGINE</span>
          </div>
          <span className="theia-header__beta">BETA</span>
          {/* � WAVE 8301 — LIVE domina el header: movido desde el panel
              MASTERS (hueco libre para futuros faders). Mismo estado
              global — `enginePower`/`handlePower` viven en esta vista. */}
          <button
            className={`theia-power theia-power--header ${enginePower ? 'is-on' : 'is-off'}`}
            onClick={handlePower}
            data-midi-bind="theia.power"
            title="Theia Engine ON/OFF — go LIVE"
          >
            <span className="theia-power__ring" />
            <span className="theia-power__core" />
            <span className="theia-power__label">{enginePower ? 'LIVE' : 'OFF'}</span>
          </button>
          {/* �🎛️ WAVE 8241 · U3 — OUTPUT vuelve al header: inconfundible,
              siempre visible, inmediatamente a la derecha del badge. */}
          <button
            className={`theia-header__output-btn${isOutputActive ? ' theia-header__output-btn--active' : ''}`}
            onClick={handleToggleOutput}
            title="Open Theia output window (HDMI / LED wall)"
            data-midi-bind="theia.toggle-output"
          >
            OUTPUT
          </button>
          {/* 🖥️ WAVE 8303 · M1 — switch de workspace (blueprint §2).
              PERFORM = directo · DESIGN = laboratorio. Tecla Tab. */}
          <div
            className="theia-mode-switch"
            role="tablist"
            aria-label="Workspace mode"
            title="Workspace: PERFORM (directo) / DESIGN (laboratorio) — Tab"
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspaceMode === 'perform'}
              className={`theia-mode-switch__seg${workspaceMode === 'perform' ? ' is-active' : ''}`}
              onClick={() => useTheiaUiStore.getState().setMode('perform')}
            >
              PERFORM
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspaceMode === 'design'}
              className={`theia-mode-switch__seg${workspaceMode === 'design' ? ' is-active' : ''}`}
              onClick={() => useTheiaUiStore.getState().setMode('design')}
            >
              DESIGN
            </button>
          </div>
          {/* 🎬 WAVE 8307 — Director (MANUAL / PLAYLIST / SELENE + ⏸ HOLD) */}
          {workspaceMode === 'perform' && <DirectorControl />}
        </div>

        {/* 🎛️ WAVE 8240 · U2 — header limpio: logo + OUTPUT + ingestión.
            POWER/BLACKOUT/masters viven ahora en el Inspector. */}
        <div className="theia-header__spacer" />

        {/* ── File Picker (ghost/outline, solo LuxIcons) ── */}
        <button
          className="theia-ingest-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Media Pool: vídeo (.mp4 · .webm · .mkv · .mov · .avi) · átomos (.theia) · shaders (.glsl)"
          data-midi-bind="theia.load-assets"
        >
          <LuxIcon name="folder" size={14} />
          <span>LOAD ASSETS</span>
        </button>
        <button
          className="theia-ingest-btn"
          onClick={() => packInputRef.current?.click()}
          title="Cargar una carpeta entera como Pack"
          data-midi-bind="theia.load-pack"
        >
          <LuxIcon name="pack" size={14} />
          <span>LOAD PACK</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={MEDIA_POOL_ACCEPT}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {/* webkitdirectory/directory se inyectan vía useEffect (atributos no-estándar) */}
        <input
          ref={packInputRef}
          type="file"
          multiple
          accept={MEDIA_POOL_ACCEPT}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

      </header>

      {/* ═══════════════════════════════════════════════════════════════════
       * MAIN GRID (viewport + asset deck + inspector)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="theia-main">
        {/* ─── LEFT COLUMN: viewport + transport ─── */}
        <div className="theia-stage">
          <Viewport
            enginePower={enginePower}
            blackout={blackout}
          />

          {/* 🎛️ WAVE 8239 · U1 — transport bar bajo el viewport */}
          {/* 🦎 WAVE 8304 — slot camaleónico 56px: transporte (VIDEO) ⇄
              macro-faders genéticos (SHADER) ⇄ idle, crossfade sin shift. */}
          <ContextStrip />
        </div>

        {/* ─── MASTERS: columna fija (PERFORM) · rail 36px (DESIGN) ─── */}
        <MastersPanel
          collapse={panelCollapseFor('masters', workspaceMode)}
          blackout={blackout}
          onBlackout={handleBlackout}
        />

        {/* ─── BOTTOM: playlist lane (placeholder W-C) + Media Browser ─── */}
        <div
          className="theia-bottom"
          data-collapse={panelCollapseFor('browser', workspaceMode)}
        >
          {/* ✈️ WAVE 8306 — Auto-Pilot (36px) solo en PERFORM: en DESIGN el
              secuenciador queda en segundo plano junto al lane en rail. */}
          {workspaceMode === 'perform' && <AutoPilotBar />}
          <PlaylistLane
            collapse={panelCollapseFor('playlistLane', workspaceMode)}
          />
          <div className="theia-browser">
            <button
              type="button"
              className="theia-browser__bar"
              onClick={toggleBrowser}
              aria-expanded={browserOpen}
              title="Media Browser — packs, vídeos y mutaciones"
            >
              <LuxIcon name={browserOpen ? 'chevron-down' : 'chevron-up'} size={11} />
              <span>MEDIA BROWSER</span>
              <span className="theia-browser__tabs-hint">PACKS · VIDEO · MUTATIONS</span>
            </button>
            {/* P5: drawer cerrado = LiveDeck desmontado → para su rAF
                de perf-report y su auto-scan IPC. En DESIGN el browser es
                panel principal y siempre está montado. */}
            {(workspaceMode === 'design' || browserOpen) && (
              <div className="theia-browser__body">
                <LiveDeck />
              </div>
            )}
          </div>
        </div>

        {/* ─── INSPECTOR: solo existe en DESIGN (HIDDEN en PERFORM = cero
            CPU: telemetría rAF y suscripciones quedan desmontadas) ─── */}
        {workspaceMode === 'design' && (
          <Inspector
            open={inspectorOpen}
            onToggle={toggleInspector}
            enginePower={enginePower}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: MasterSlider — vertical mini-fader with MIDI binding
// ═══════════════════════════════════════════════════════════════════════════

interface MasterSliderProps {
  label: string
  bindId: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  /** 🌊 WAVE 8302 — resolución del rango (STROBE usa enteros de Hz). */
  step?: number
  color: string
  format?: (v: number) => string
}

const MasterSlider: React.FC<MasterSliderProps> = ({
  label,
  bindId,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.001,
  color,
  format,
}) => {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div
      className="theia-master"
      data-midi-bind={bindId}
      style={{ ['--accent' as string]: color }}
    >
      <div className="theia-master__label">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="theia-master__input"
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      <div className="theia-master__value">
        {format ? format(value) : `${Math.round(pct)}%`}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: MastersPanel — 🌊 WAVE 8259 (Slider Choke fix)
// 🖥️ WAVE 8303 · M2 — renombrado: ya no es un clúster dentro del
// Inspector sino la columna fija de masters del layout (blueprint §3).
// Los faders BRIGHT/SPEED/CONTRAST poseen su estado AQUÍ, no en la raíz:
// cada `input` event re-renderiza solo este clúster (3 nodos) en vez del
// árbol entero de la vista. Los efectos caros — `postMessage` al worker y
// `video.playbackRate` — viajan por un throttle trailing (~90ms): el drag
// fluye fluido y el ÚLTIMO valor siempre aterriza en el motor.
// ═══════════════════════════════════════════════════════════════════════════

/** Throttle trailing: corre de inmediato si pasaron ≥ms, si no agenda el
 *  último `fn` para cuando venza la ventana (nunca pierde el valor final). */
function makeTrailingThrottle(ms: number): (fn: () => void) => void {
  let lastAt = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: (() => void) | null = null
  return (fn) => {
    const now = performance.now()
    const elapsed = now - lastAt
    if (elapsed >= ms) {
      lastAt = now
      fn()
      return
    }
    pending = fn
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null
        lastAt = performance.now()
        const p = pending
        pending = null
        p?.()
      }, ms - elapsed)
    }
  }
}

/** Versión con llaves: una instancia trailing-throttle por canal — drags
 *  simultáneos (MIDI, multi-fader) no se pisan el pending entre sí. */
function makeKeyedThrottle(ms: number): (key: string, fn: () => void) => void {
  const map = new Map<string, (fn: () => void) => void>()
  return (key, fn) => {
    let t = map.get(key)
    if (!t) {
      t = makeTrailingThrottle(ms)
      map.set(key, t)
    }
    t(fn)
  }
}

/**
 * 🖥️ WAVE 8303 · M2 — MastersPanel: columna fija de masters.
 * PERFORM → EXPANDED (faders + BLACKOUT pineado abajo, sin scroll).
 * DESIGN  → RAIL 36px (mini-readouts + BLACKOUT mini — blueprint §7.1).
 * El estado de los faders vive aquí (WAVE 8259): compartido por ambas
 * vistas para que el rail lea los mismos valores sin duplicar stores.
 */
interface MastersPanelProps {
  collapse: 'expanded' | 'rail' | 'hidden'
  blackout: boolean
  onBlackout: () => void
}

const MastersPanel: React.FC<MastersPanelProps> = ({ collapse, blackout, onBlackout }) => {
  const [brightness, setBrightness] = useState(0.85)
  const [speed, setSpeed] = useState(1.0)
  // 🌊 WAVE 8256 — neutro REAL: u_contrast=0.5 comprimía el rango a
  // [0.25,0.75] pre-gamma → grises lavados. 1.0 = identidad; slider 0–2.
  const [contrast, setContrast] = useState(1.0)
  // 🌊 WAVE 8302 · M1 — masters de post-procesado (epílogo pre-ACES).
  const [saturation, setSaturation] = useState(1.0)
  const [hue, setHue] = useState(0.0)
  const [strobe, setStrobe] = useState(0.0)

  // Un throttle por canal — drags simultáneos (MIDI) no se pisan el pending.
  const throttled = useMemo(() => makeKeyedThrottle(90), [])

  // Push inicial de masters al worker (el replay del orchestrator cubre
  // respawns; esto sincroniza el shader con la UI desde el mount).
  useEffect(() => {
    const theta = getThetaOrchestrator()
    theta.setUniform('u_brightness', brightness)
    theta.setUniform('u_contrast', contrast)
    theta.setUniform('u_speed', speed)
    theta.setUniform('u_masterSaturation', saturation)
    theta.setUniform('u_masterHue', hue)
    theta.setUniform('u_masterStrobe', strobe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBrightness = useCallback((v: number) => {
    setBrightness(v)
    throttled('u_brightness', () =>
      getThetaOrchestrator().setUniform('u_brightness', v))
  }, [])

  const handleContrast = useCallback((v: number) => {
    setContrast(v)
    throttled('u_contrast', () =>
      getThetaOrchestrator().setUniform('u_contrast', v))
  }, [])

  const handleSpeed = useCallback((v: number) => {
    setSpeed(v)
    // playbackRate + uniform viajan juntos en el mismo canal throttled.
    throttled('u_speed', () => {
      const theta = getThetaOrchestrator()
      theta.setPlaybackRate(v)
      theta.setUniform('u_speed', v)
    })
  }, [])

  // 🌊 WAVE 8302 · M1 — handlers de post-fx (misma vía throttled+setUniform).
  const handleSaturation = useCallback((v: number) => {
    setSaturation(v)
    throttled('u_masterSaturation', () =>
      getThetaOrchestrator().setUniform('u_masterSaturation', v))
  }, [])

  const handleHue = useCallback((v: number) => {
    setHue(v)
    throttled('u_masterHue', () =>
      getThetaOrchestrator().setUniform('u_masterHue', v))
  }, [])

  const handleStrobe = useCallback((v: number) => {
    setStrobe(v)
    throttled('u_masterStrobe', () =>
      getThetaOrchestrator().setUniform('u_masterStrobe', v))
  }, [])

  // RAIL — lectura compacta de los mismos valores (abreviaturas 3 letras).
  const railCells = [
    ['BRI', `${Math.round(brightness * 100)}%`],
    ['SPD', `${speed.toFixed(2)}×`],
    ['CON', `${contrast.toFixed(2)}×`],
    ['SAT', `${saturation.toFixed(2)}×`],
    ['HUE', hue.toFixed(2)],
    ['STB', strobe < 0.5 ? 'OFF' : `${strobe.toFixed(0)}Hz`],
  ] as const

  if (collapse === 'hidden') return null

  return (
    <aside
      className="theia-masters"
      data-collapse={collapse}
      aria-label="Master controls"
    >
      <div className="theia-masters__head">
        <span className="theia-masters__head-icon">◈</span>
        <span>MASTERS</span>
      </div>

      {/* EXPANDED — faders completos */}
      <div className="theia-masters__full">
        <MasterSlider
        label="BRIGHT"
        bindId="theia.brightness"
        value={brightness}
        onChange={handleBrightness}
        color="#39ff14"
      />
      <MasterSlider
        label="SPEED"
        bindId="theia.speed"
        value={speed}
        onChange={handleSpeed}
        min={0.25}
        max={2}
        color="#2ecc10"
        format={(v) => `${v.toFixed(2)}×`}
      />
      <MasterSlider
        label="CONTRAST"
        bindId="theia.contrast"
        value={contrast}
        onChange={handleContrast}
        max={2}
        color="#d9f99d"
        format={(v) => `${v.toFixed(2)}×`}
      />
      {/* 🌊 WAVE 8302 · M1 — masters de post-fx (SAT/HUE/STROBE). */}
      <MasterSlider
        label="SATURATION"
        bindId="theia.saturation"
        value={saturation}
        onChange={handleSaturation}
        min={0}
        max={2}
        color="#39ff14"
        format={(v) => `${v.toFixed(2)}×`}
      />
      <MasterSlider
        label="HUE"
        bindId="theia.hue"
        value={hue}
        onChange={handleHue}
        min={-0.5}
        max={0.5}
        color="#2ecc10"
        format={(v) => `${v.toFixed(2)}⟳`}
      />
      <MasterSlider
        label="STROBE"
        bindId="theia.strobe"
        value={strobe}
        onChange={handleStrobe}
        min={0}
        max={60}
        step={1}
        color="#1f9c0b"
        format={(v) => v < 0.5 ? 'OFF' : `${v.toFixed(0)}Hz`}
      />
      </div>

      {/* RAIL — readouts compactos de los mismos valores (blueprint:
          "faders en miniatura, solo lectura" — edición fina queda para
          una wave posterior). Cero coste: mismos useState, sin rAF. */}
      <div className="theia-masters__rail" aria-hidden={collapse !== 'rail'}>
        {railCells.map(([abbr, val]) => (
          <div key={abbr} className="theia-masters__railcell" title={abbr}>
            <span className="theia-masters__railabbr">{abbr}</span>
            <span className="theia-masters__railval">{val}</span>
          </div>
        ))}
      </div>

      {/* BLACKOUT pineado al fondo — P1: nunca requiere scroll. En RAIL se
          compacta a un cuadrado (mismo handler + data-midi-bind). */}
      <button
        className={`theia-blackout theia-masters__blackout ${blackout ? 'is-active' : ''}`}
        onClick={onBlackout}
        data-midi-bind="theia.blackout"
        title="Force Blackout [Space]"
      >
        <span className="theia-blackout__icon">◉</span>
        <span className="theia-blackout__label">BLACKOUT</span>
      </button>
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Viewport — RAW vs PATCH PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

interface ViewportProps {
  enginePower: boolean
  blackout: boolean
}

const Viewport: React.FC<ViewportProps> = ({ enginePower, blackout }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasTransferredCanvasRef = useRef(false)

  // 🎛️ WAVE 8240 · U2 — la zona Selene se pinta por ref desde el ring 256B.
  // Reader propio (scratch privado): zero-alloc, sin React state, rAF ~60fps.
  const zoneRef = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    const reader = new TelemetryWireReader(getThetaOrchestrator().getTelemetryRing())
    const enums: TelemetryEnums = { schemaVersion: 0, predictionType: 0, huntState: 0, energyZone: 0 }
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      reader.read()
      const el = zoneRef.current
      if (!el) return
      const stale = reader.timestampMs <= 0 || Date.now() - reader.timestampMs > TELEMETRY_STALE_MS
      const zone = stale ? null : (unpackEnums(reader.enums, enums), ZONE_META[enums.energyZone & 3])
      const label = zone ? zone.label : '—'
      const color = zone ? zone.color : '#475569'
      if (el.textContent !== label) el.textContent = label
      if (el.style.color !== color) el.style.color = color
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 🌊 WAVE 8223 — PREVIEW RESURRECTION: `transferControlToOffscreen` liga
  // un <canvas> DOM a un worker PARA SIEMPRE — tras un respawn (Phoenix o
  // restart manual) el offscreen pertenece al worker muerto y el viewport
  // queda negro de forma permanente. `workerEpoch` bump en cada spawn +
  // `key={workerEpoch}` en el <canvas> fuerzan un remount: elemento nuevo →
  // transfer fresco → `attachOffscreenCanvas` lo entrega al worker vivo
  // (path `theia:attach-canvas` si ya corre, o vía INIT en el próximo spawn).
  const [workerEpoch, setWorkerEpoch] = useState(0)
  useEffect(() => {
    return getThetaOrchestrator().onWorkerEpoch(() => {
      setWorkerEpoch((e) => e + 1)
    })
  }, [])

  // 🌊 WAVE 8225 — ref del wrap movido arriba: el rAF de transfer lo usa
  // como fuente de medida primaria (ver abajo). El RO lo sigue observando
  // para los resizes vivos del layout.
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)

  // 🖥️ WAVE 8262 — FULLSCREEN PREVIEW: doble-click en el lienzo (o el botón
  // de la barra) entrega la sección entera al monitor vía Fullscreen API.
  // La transición re-layout del wrap dispara el ResizeObserver de abajo →
  // `theia:resize-preview` llega al worker con dims ×dpr → bitmap re-alojado
  // nítido a 1080p/4K. `isFullscreen` solo alimenta el icono del botón.
  const viewportRef = useRef<HTMLElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === viewportRef.current)
    }
    // Una denegación de permiso (Electron session handler) puede no rechazar
    // la promise — 'fullscreenerror' es el único rastro visible.
    const onFsError = (ev: Event) => {
      console.warn('[Theia UI] fullscreen request denied:', ev)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('fullscreenerror', onFsError)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('fullscreenerror', onFsError)
    }
  }, [])

  const handleToggleFullscreen = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.warn('[Theia UI] exitFullscreen failed:', err)
      })
    } else {
      el.requestFullscreen().catch((err) => {
        console.warn('[Theia UI] requestFullscreen failed:', err)
      })
    }
  }, [])

  useEffect(() => {
    // Reset por epoch: el guard de una vida anterior bloquearía el re-transfer.
    hasTransferredCanvasRef.current = false
    const canvas = canvasRef.current
    if (!canvas || hasTransferredCanvasRef.current) return
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      console.error('[Theia UI] OffscreenCanvas not supported in this renderer')
      return
    }

    let rafId = 0
    rafId = window.requestAnimationFrame(() => {
      const host = canvasRef.current
      if (!host || hasTransferredCanvasRef.current) return

      // 🌊 WAVE 8225 — medir el WRAP, no el canvas: un <canvas> recién
      // remontado cuyo CSS aún no aplicó reporta su tamaño intrínseco
      // (300×150) o 0×0 si el contenedor estaba colapsado — horneando la
      // basura en el offscreen para siempre. El wrap (inset:0, padre
      // estable) siempre refleja la verdad del layout.
      const rect = canvasWrapRef.current?.getBoundingClientRect()
        ?? host.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      host.width = Math.max(1, Math.floor(rect.width * dpr))
      host.height = Math.max(1, Math.floor(rect.height * dpr))

      const offscreen = host.transferControlToOffscreen()
      const theta = getThetaOrchestrator()
      theta.attachOffscreenCanvas(offscreen)
      // 🌊 WAVE 8225 — dims explícitas post-attach: el ResizeObserver vigila
      // el WRAP (padre — no remonta, no refires) y la medición del rAF puede
      // capturar basura (0×0 colapsado / 300×150 intrínseco). Este envío
      // garantiza que el worker conozca el tamaño real desde el frame 0;
      // si el worker aún no existe, el orchestrator lo retiene y lo replaya
      // en 'theia:ready'.
      theta.resizePreviewCanvas(host.width, host.height)
      hasTransferredCanvasRef.current = true
      console.log('[Theia UI] 🎬 viewport canvas attached to Theta worker')
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [workerEpoch])

  // 🌊 WAVE 8218 — VIEWPORT SCALE FIX: `transferControlToOffscreen` congela
  // el backing del canvas a la medición del mount (si el CSS aún no había
  // aplicado, queda clavado al fallback intrínseco 300×150 para siempre).
  // El DOM no puede re-dimensionar un canvas ya transferido, así que este
  // ResizeObserver reenvía los rects vivos del wrap al worker vía
  // `theia:resize-preview` — el espejo re-aloja su bitmap y el plasma/video
  // escala con la ventana en tiempo real. El GL de salida (1920×1080) y el
  // canal del proyector quedan intactos.
  useEffect(() => {
    const wrap = canvasWrapRef.current
    if (!wrap || typeof ResizeObserver !== 'function') return
    let lastW = 0
    let lastH = 0
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.floor(rect.width * dpr))
      const h = Math.max(1, Math.floor(rect.height * dpr))
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
      getThetaOrchestrator().resizePreviewCanvas(w, h)
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  return (
    <section
      ref={viewportRef}
      className={`theia-viewport ${blackout ? 'is-blackout' : ''}`}
    >
      {/* ── Live tag (mode toggle removed — RAW canvas only, WAVE 8211) ── */}
      <div className="theia-vp__bar">
        <div className="theia-vp__live-tag">
          <span className={`theia-vp__live-dot ${enginePower ? 'is-on' : ''}`} />
          <span className="theia-vp__live-text">
            {enginePower ? 'STREAMING' : 'STANDBY'}
          </span>
          <span className="theia-vp__divider" />
          <span ref={zoneRef} className="theia-vp__section" style={{ color: '#475569' }}>
            —
          </span>
        </div>
        {/* 🖥️ WAVE 8262 — fullscreen toggle (también: doble-click en el lienzo) */}
        <button
          type="button"
          className={`theia-vp__fs-btn${isFullscreen ? ' is-active' : ''}`}
          onClick={handleToggleFullscreen}
          title={isFullscreen
            ? 'Exit fullscreen (Esc / double-click)'
            : 'Fullscreen preview — or double-click the canvas'}
          aria-pressed={isFullscreen}
          data-midi-bind="theia.fullscreen"
        >
          <LuxIcon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={12} />
        </button>
      </div>

      {/* ── Canvas area — doble-click = fullscreen del monitor ── */}
      <div
        ref={canvasWrapRef}
        className="theia-vp__canvas-wrap"
        onDoubleClick={handleToggleFullscreen}
      >
        {/* Background grid */}
        <div className="theia-vp__grid" />

        {/* Scanlines overlay */}
        <div className={`theia-vp__scanlines ${enginePower ? 'is-on' : ''}`} />

        {/* ── Canvas renderizado por el worker vía OffscreenCanvas ── */}
        {/* 🌊 WAVE 8223 — key={workerEpoch}: un <canvas> solo puede     */}
        {/* transferirse una vez; cada respawn remonta un elemento nuevo   */}
        <canvas
          key={workerEpoch}
          ref={canvasRef}
          className="theia-vp__surface"
        />

        {/* Off state overlay */}
        {(!enginePower || blackout) && (
          <div className="theia-vp__off">
            <span className="theia-vp__off-icon">◯</span>
            <span className="theia-vp__off-text">
              {blackout ? 'BLACKOUT ACTIVE' : 'ENGINE OFFLINE'}
            </span>
          </div>
        )}

        {/* Corner brackets */}
        <span className="theia-vp__bracket theia-vp__bracket--tl" />
        <span className="theia-vp__bracket theia-vp__bracket--tr" />
        <span className="theia-vp__bracket theia-vp__bracket--bl" />
        <span className="theia-vp__bracket theia-vp__bracket--br" />
      </div>
    </section>
  )
}

// WAVE 4922 — `AuthorAssetDeck`, `AssetDeck` y `ClipCard` retirados.
// 🎛️ WAVE 8239 · U1 — `WorkshopDeck`/`TheiaTrimmer`/`TheiaDNALab` demolidos:
// el deck vive en `components/theia/LiveDeck.tsx` (Pack Slots + Atom Tiles)
// y la strip contextual en `components/theia/ContextStrip.tsx`.

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Inspector (right rail, retractable)
// ═══════════════════════════════════════════════════════════════════════════

interface InspectorProps {
  open: boolean
  onToggle: () => void
  enginePower: boolean
}

const Inspector: React.FC<InspectorProps> = ({
  open, onToggle, enginePower,
}) => {
  // 🎛️ WAVE 8240 · U2 — telemetría zero-alloc: refs a nodos DOM + rAF que
  // lee el ring 256B (TelemetryWireReader sobre el espejo local del pump).
  // NADA de useState en esta ruta — React no se entera de los ~60fps.
  const zoneBannerRef = useRef<HTMLDivElement | null>(null)
  const zoneLabelRef = useRef<HTMLSpanElement | null>(null)
  const zoneConfRef = useRef<HTMLSpanElement | null>(null)
  const bpmRef = useRef<HTMLSpanElement | null>(null)
  const energyRef = useRef<HTMLSpanElement | null>(null)
  const fpsRef = useRef<HTMLSpanElement | null>(null)
  const sparkPathRef = useRef<SVGPathElement | null>(null)
  const sparkFillRef = useRef<SVGPathElement | null>(null)
  const sparkDotRef = useRef<SVGCircleElement | null>(null)

  useEffect(() => {
    const theta = getThetaOrchestrator()
    const reader = new TelemetryWireReader(theta.getTelemetryRing())
    const enums: TelemetryEnums = {
      schemaVersion: 0, predictionType: 0, huntState: 0, energyZone: 0,
    }
    const spark = new Float32Array(SPARK_LEN)
    let sparkLen = 0
    let raf = 0
    let fpsTick = 0
    // 🌊 WAVE 8295 — dirty-check estricto: el rAF corre ~60fps pero la zona de
    // energía casi nunca cambia. Reescribir borderColor/background cada frame
    // reevaluaba el estilo (y con el antiguo `transition: all` encadenaba
    // repaints de 300ms sin fin). Centinela 'off' = estado offline pintado.
    let lastZoneColor = ''

    const setText = (el: HTMLElement | null, text: string) => {
      if (el && el.textContent !== text) el.textContent = text
    }

    const paintOffline = () => {
      setText(zoneLabelRef.current, 'NO LINK')
      if (lastZoneColor !== 'off') {
        lastZoneColor = 'off'
        if (zoneLabelRef.current) zoneLabelRef.current.style.color = '#94a3b8'
        if (zoneBannerRef.current) {
          zoneBannerRef.current.style.borderColor = '#47556966'
          zoneBannerRef.current.style.background = '#47556915'
        }
      }
      setText(zoneConfRef.current, 'TELEMETRY OFFLINE')
      setText(bpmRef.current, '—')
      setText(energyRef.current, '—')
      setText(fpsRef.current, '—')
      const dot = sparkDotRef.current
      if (dot && dot.getAttribute('opacity') !== '0') dot.setAttribute('opacity', '0')
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const fresh = reader.read()
      const s = reader.getScratch()
      const stale = reader.timestampMs <= 0
        || Date.now() - reader.timestampMs > TELEMETRY_STALE_MS
      if (!s || stale) {
        paintOffline()
        return
      }

      unpackEnums(reader.enums, enums)
      const zone = ZONE_META[enums.energyZone & 3] ?? ZONE_META[0]
      setText(zoneLabelRef.current, zone.label)
      if (zone.color !== lastZoneColor) {
        lastZoneColor = zone.color
        if (zoneLabelRef.current) zoneLabelRef.current.style.color = zone.color
        if (zoneBannerRef.current) {
          zoneBannerRef.current.style.borderColor = `${zone.color}66`
          zoneBannerRef.current.style.background = `${zone.color}15`
        }
        sparkDotRef.current?.setAttribute('fill', zone.color)
      }
      setText(
        zoneConfRef.current,
        `CONFIDENCE ${Math.round(s[TELEMETRY_SLOT.SEL_CONFIDENCE] * 100)}%`,
      )

      const bpm = s[TELEMETRY_SLOT.BPM]
      const energy = Math.max(0, Math.min(1, s[TELEMETRY_SLOT.ENERGY]))
      setText(bpmRef.current, bpm > 0 ? bpm.toFixed(1) : '—')
      setText(energyRef.current, `${Math.round(energy * 100)}%`)

      // FPS del perf-report del governor (~1 Hz — throttle a ~2 lecturas/seg).
      if (++fpsTick >= 30) {
        fpsTick = 0
        const fps = theta.getLastPerfReport()?.fps
        setText(fpsRef.current, fps !== undefined && fps > 0 ? fps.toFixed(1) : '—')
      }

      // Sparkline: solo empuja muestras cuando llegó un frame NUEVO (~44Hz).
      if (fresh) {
        if (sparkLen < SPARK_LEN) spark[sparkLen++] = energy
        else { spark.copyWithin(0, 1); spark[SPARK_LEN - 1] = energy }
        const n = sparkLen
        const denom = n > 1 ? SPARK_LEN - 1 : 1
        let d = `M${((0 / denom) * 100).toFixed(1)},${(40 - spark[0] * 36 - 2).toFixed(1)}`
        for (let i = 1; i < n; i++) {
          d += ` L${((i / denom) * 100).toFixed(1)},${(40 - spark[i] * 36 - 2).toFixed(1)}`
        }
        sparkPathRef.current?.setAttribute('d', d)
        sparkFillRef.current?.setAttribute('d', `${d} L100,40 L0,40 Z`)
        const dot = sparkDotRef.current
        if (dot) {
          if (dot.getAttribute('opacity') !== '1') dot.setAttribute('opacity', '1')
          dot.setAttribute('cy', (40 - energy * 36 - 2).toFixed(1))
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <aside className={`theia-insp ${open ? 'is-open' : 'is-closed'}`}>
      {/* ─── Collapsed sliver (click = abrir) ─── */}
      {!open && (
        <div
          className="theia-insp__sliver"
          onClick={onToggle}
          role="button"
          title="Expand Inspector"
        >
          <span className="theia-insp__sliver-icon">▮</span>
          <span className="theia-insp__sliver-icon">◎</span>
          <span className="theia-insp__sliver-icon">◇</span>
        </div>
      )}

      {/* ─── Open content ─── */}
      {open && (
        <div className="theia-insp__content">
          {/* ── SECTION 1: Live Telemetry — ring 256B via rAF refs ── */}
          <div className="theia-insp__block">
            <div className="theia-insp__block-header">
              <span className="theia-insp__block-icon">◉</span>
              <span className="theia-insp__block-title">LIVE TELEMETRY</span>
              <span className={`theia-insp__pulse ${enginePower ? 'is-on' : ''}`} />
              <button
                className="theia-insp__collapse"
                onClick={onToggle}
                title="Collapse Inspector"
              >
                ▶
              </button>
            </div>

            {/* Zone banner — Selene energyZone del ring (ref-driven) */}
            <div
              ref={zoneBannerRef}
              className="theia-insp__section"
              style={{ borderColor: '#47556966', background: '#47556915' }}
            >
              <div className="theia-insp__section-body">
                <span ref={zoneLabelRef} className="theia-insp__section-label">
                  —
                </span>
                <span ref={zoneConfRef} className="theia-insp__section-conf">
                  TELEMETRY OFFLINE
                </span>
              </div>
            </div>

            {/* Sparkline — energía rolling (paths mutados por el rAF) */}
            <div className="theia-insp__sparkline">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="theia-spark-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#39ff14" stopOpacity="0.7" />
                    <stop offset="60%" stopColor="#2ecc10" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="theia-spark-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#39ff14" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#2ecc10" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
                <path ref={sparkFillRef} d="" fill="url(#theia-spark-fill)" />
                <path ref={sparkPathRef} d="" fill="none" stroke="url(#theia-spark-grad)" strokeWidth="1.2" />
                <circle ref={sparkDotRef} cx="100" cy="38" r="2" opacity="0" fill="#2ecc10" />
              </svg>
            </div>

            {/* BPM + Energy + FPS — ref-driven, sin React state */}
            <div className="theia-insp__metrics">
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">BPM</span>
                <span ref={bpmRef} className="theia-insp__metric-value">—</span>
              </div>
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">ENERGY</span>
                <span ref={energyRef} className="theia-insp__metric-value">—</span>
              </div>
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">FPS</span>
                <span ref={fpsRef} className="theia-insp__metric-value">—</span>
              </div>
            </div>
          </div>

          {/* 🖥️ WAVE 8303 · M2 — MASTERS salió del Inspector: es columna
              fija propia (MastersPanel) accesible en AMBOS modos, no una
              sección más del laboratorio. */}

          {/* ── SECTION 3: Ecosystem Control — botones Darwin + HUD ── */}
          <EcosystemControl />

          {/* ── SECTION 3.4: Genetic Parameters — faders u_gene[k] ── */}
          <GeneFadersPanel />

          {/* ── SECTION 3.5: Shader params — sliders automáticos desde
              los `@euclid param` del shader activo (Euclid §4.2) ── */}
          <ShaderParamsPanel />

          {/* ── SECTION 4: BindingID hint footer ── */}
          <div className="theia-insp__footer">
            <span className="theia-insp__footer-icon">🎹</span>
            <span>
              All controls expose <code>data-midi-bind</code> IDs.
              Map them via global MIDI Learn — no UI rebuild required.
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 8240 · U2 — SUB-COMPONENT: EcosystemControl (Darwin)
//
// Controles de supervivencia biológica sobre el genoma activo:
//   FAVORITE     → markFavorite(atomId)  — impulso positivo al fitness EMA
//   EXTINGUISH   → markSkip(atomId)      — impulso negativo (skip/purga)
//   FORCE MUTATE → evolveGenome(barCount, barMs) — mutación fuera de compás
//
// El id del genoma activo llega por perf-report (~1 Hz) — frecuencia baja,
// useState permitido. La ruta caliente (BPM/energy/zone) vive en el bloque
// de telemetría con refs.
// ═══════════════════════════════════════════════════════════════════════════

const EcosystemControl: React.FC = () => {
  const [activeId, setActiveId] = useState(() =>
    getThetaOrchestrator().getActiveShaderId(),
  )
  // 🧬 WAVE 8241 · U3 — HUD biológico: ADN {a,c,o} + fitness, refresco ~1Hz
  // con el perf-report (baja frecuencia — useState legítimo aquí).
  const [genome, setGenome] = useState<Record<string, number>>({})
  const [fitness, setFitness] = useState(0)

  useEffect(() => {
    const theta = getThetaOrchestrator()
    const refresh = () => {
      const id = theta.getActiveShaderId()
      setGenome(theta.getShaderMeta(id)?.genome ?? {})
      setFitness(getFitness(id))
    }
    const offPerf = theta.onPerfReport((p) => {
      if (p.activeShader !== undefined) setActiveId(p.activeShader)
      refresh()
    })
    const offMeta = theta.onShaderMeta(refresh)
    refresh()
    return () => {
      offPerf()
      offMeta()
    }
  }, [])

  // 'builtin' = shader de vídeo (átomo kind:'video') — no hay genoma que
  // premiar/castigar/mutar. Los controles quedan atenuados.
  const isGenome = activeId !== 'builtin' && activeId.length > 0

  const handleFavorite = useCallback(() => {
    const id = getThetaOrchestrator().getActiveShaderId()
    if (id !== 'builtin' && id.length > 0) getThetaOrchestrator().markFavorite(id)
  }, [])

  const handleExtinguish = useCallback(() => {
    const id = getThetaOrchestrator().getActiveShaderId()
    if (id !== 'builtin' && id.length > 0) getThetaOrchestrator().markSkip(id)
  }, [])

  // Mutación forzada fuera de compás: phraseIndex = barCount actual del ring
  // (el operador dispara, no el reloj de frases). barMs = compás real si el
  // BPM está vivo → crossfade de 2 compases para mutaciones `struct`.
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

  return (
    <div className="theia-insp__block">
      <div className="theia-insp__block-header">
        <span className="theia-insp__block-icon">
          <LuxIcon name="dna" size={12} />
        </span>
        <span className="theia-insp__block-title">ECOSYSTEM CONTROL</span>
      </div>

      <div className="theia-insp__genome">
        <span className="theia-insp__genome-label">ACTIVE GENOME</span>
        <span
          className={`theia-insp__genome-id${isGenome ? ' is-live' : ''}`}
          title={isGenome ? activeId : 'No generative shader active'}
        >
          {isGenome ? activeId : '—'}
        </span>
      </div>

      {/* 🧬 HUD biológico: ADN {aggression, chaos, organicity} + fitness.
          Refresh ~1 Hz vía perf-report — no es ruta caliente. */}
      {isGenome && (
        <div className="theia-insp__hud">
          {(['aggression', 'chaos', 'organicity'] as const).map((k) => {
            const v = Math.max(0, Math.min(1, genome[k] ?? 0))
            return (
              <div key={k} className="theia-insp__hud-row">
                <span className="theia-insp__hud-key">{k.slice(0, 3).toUpperCase()}</span>
                <div className="theia-insp__hud-track">
                  <div
                    className="theia-insp__hud-fill"
                    style={{ width: `${v * 100}%` }}
                  />
                </div>
                <span className="theia-insp__hud-val">{v.toFixed(2)}</span>
              </div>
            )
          })}
          <div className="theia-insp__hud-row">
            <span className="theia-insp__hud-key">FIT</span>
            <div className="theia-insp__hud-track">
              <div
                className={`theia-insp__hud-fill${fitness < 0 ? ' is-neg' : ''}`}
                style={{ width: `${Math.max(0, Math.min(1, Math.abs(fitness))) * 100}%` }}
              />
            </div>
            <span className={`theia-insp__hud-val${fitness < 0 ? ' is-neg' : ''}`}>
              {fitness.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <div className="theia-insp__buttons theia-insp__buttons--darwin">
        <button
          className="theia-insp__btn theia-insp__btn--fav"
          onClick={handleFavorite}
          disabled={!isGenome}
          data-midi-bind="theia.darwin.favorite"
          title="Favorite — impulso positivo al fitness del genoma activo"
        >
          <span className="theia-insp__btn-icon">
            <LuxIcon name="heart" size={14} />
          </span>
          <span>FAVORITE</span>
        </button>
        <button
          className="theia-insp__btn theia-insp__btn--ext"
          onClick={handleExtinguish}
          disabled={!isGenome}
          data-midi-bind="theia.darwin.extinguish"
          title="Extinguish — skip/purga: impulso negativo al fitness"
        >
          <span className="theia-insp__btn-icon">
            <LuxIcon name="trash" size={14} />
          </span>
          <span>EXTINGUISH</span>
        </button>
        <button
          className="theia-insp__btn theia-insp__btn--mut"
          onClick={handleMutate}
          disabled={!isGenome}
          data-midi-bind="theia.darwin.mutate"
          title="Force Mutation — evolveGenome fuera de compás"
        >
          <span className="theia-insp__btn-icon">
            <LuxIcon name="dna" size={14} />
          </span>
          <span>FORCE MUTATION</span>
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 8241 · U3 — SUB-COMPONENT: GeneFadersPanel (GENETIC PARAMETERS)
//
// Faders dinámicos de los genes `expr` del shader activo — un slider por
// declaración `@euclid gene ... expr` en el orden de `layoutExprGenes`
// (índice = slot `u_gene[k]`). La escritura usa la ruta rápida G3:
// `setUniform('u_gene[k]', v)` — el worker la aplica por lazy-loc DESPUÉS
// del `uniform1fv` de `genGeneValues`, así el override persiste cada frame
// sin recompilar ni crossfade. `struct` genes = badges read-only (mutarlos
// exige recompilación → vive en Darwin, no en un fader).
//
//   data-midi-bind="theia.shader.<G_NAME>"  — MIDI Learn nativo.
// ═══════════════════════════════════════════════════════════════════════════

const GeneFadersPanel: React.FC = () => {
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

  const exprGenes = meta ? layoutExprGenes(meta) : []

  // 🌊 WAVE 8261 — throttle trailing por gen: el drag repinta solo este
  // panel y el postMessage al worker se estrangula a ~11 Hz por canal.
  const throttled = useMemo(() => makeKeyedThrottle(90), [])

  // 🩸 WAVE 8294 — memoria inmortal: los valores afinados viven en el
  // store (sobreviven al desmontaje del Inspector). En cada switch el
  // worker purga `u_gene[k]` y el fenotipo arranca desde spec.exprValues;
  // re-empujamos los overrides SOLO si el operador ya afinó este átomo —
  // un id nuevo o mutante `core#seed` conserva su fenotipo declarado.
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

  if (activeId === 'builtin' || !meta || meta.genes.length === 0) {
    return null
  }

  const structGenes = meta.genes.filter((g) => g.cls === 'struct')

  return (
    <div className="theia-insp__block">
      <div className="theia-insp__block-header">
        <span className="theia-insp__block-icon">
          <LuxIcon name="dna" size={12} />
        </span>
        <span className="theia-insp__block-title">GENETIC PARAMETERS</span>
      </div>

      {exprGenes.length > 0 && (
        <div className="theia-insp__masters">
          {exprGenes.map((name, k) => {
            const decl = meta.genes.find((g) => g.name === name)
            if (!decl) return null
            return (
              <MasterSlider
                key={name}
                label={(decl.label ?? name.replace(/^G_/, '')).toUpperCase()}
                bindId={`theia.shader.${name}`}
                value={values[name] ?? decl.defaultValue}
                min={decl.min}
                max={decl.max}
                color="#39ff14"
                format={(v) =>
                  decl.type === 'int' ? `${Math.round(v)}` : v.toFixed(2)
                }
                onChange={(v) => {
                  const val = decl.type === 'int' ? Math.round(v) : v
                  setValues((prev) => {
                    const next = { ...prev, [name]: val }
                    useTheiaPackStore.getState().setAtomGeneValues(activeId, next)
                    return next
                  })
                  // Fast-path G3: override directo del slot del array.
                  throttled(`u_gene[${k}]`, () =>
                    getThetaOrchestrator().setUniform(`u_gene[${k}]`, val))
                }}
              />
            )
          })}
        </div>
      )}

      {structGenes.length > 0 && (
        <div className="theia-insp__struct">
          {structGenes.map((g) => (
            <span key={g.name} className="theia-insp__struct-chip" title={`struct gene — evoluciona vía Darwin, no por fader`}>
              {(g.label ?? g.name.replace(/^G_/, '')).toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔮 WAVE 8230 · E4 — SUB-COMPONENT: ShaderParamsPanel
//
// Los `@euclid param` del shader activo generan sliders automáticos
// (propuesta Hybrid Deck §4.2): data-midi-bind="theia.shader.<id>.<param>"
// para MIDI Learn nativo; cada cambio llega al worker vía set-uniform.
// ═══════════════════════════════════════════════════════════════════════════

const ShaderParamsPanel: React.FC = () => {
  const [activeId, setActiveId] = useState(() =>
    getThetaOrchestrator().getActiveShaderId(),
  )
  const [meta, setMeta] = useState<EuclidMeta | null>(null)
  const [values, setValues] = useState<Record<string, number>>({})

  // Sigue el shader activo (perf-report ~1 Hz lleva activeShader) y la
  // llegada de meta parseado de cualquier loadShader.
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

  // 🩸 WAVE 8294 — memoria inmortal: valores afinados en el store (no en
  // refs de mount). En cada activación re-empujamos saved ?? defaults:
  // los params no comparten namespace entre átomos (nombres únicos), pero
  // el re-push garantiza defaults declarados no-cero tras un respawn donde
  // el panel llegó tarde, y restaura el ajuste del operador al volver.
  const throttled = useMemo(() => makeKeyedThrottle(90), [])

  useEffect(() => {
    const theta = getThetaOrchestrator()
    const m = theta.getShaderMeta(activeId)
    setMeta(m)
    const saved = useTheiaPackStore.getState().atomParamValues.get(activeId)
    const seed: Record<string, number> = {}
    for (const p of m?.params ?? []) seed[p.name] = saved?.[p.name] ?? p.defaultValue
    setValues(seed)
    if (m && m.params.length > 0) {
      for (const p of m.params) theta.setUniform(p.name, seed[p.name])
    }
  }, [activeId])

  if (activeId === 'builtin' || !meta || meta.params.length === 0) {
    return null
  }

  return (
    <div className="theia-insp__block">
      <div className="theia-insp__block-header">
        <span className="theia-insp__block-icon">◇</span>
        <span className="theia-insp__block-title">
          SHADER PARAMS{meta.name ? ` · ${meta.name.toUpperCase()}` : ''}
        </span>
      </div>
      <div className="theia-shader-params">
        {meta.params.map((p) => (
          <MasterSlider
            key={p.name}
            label={p.label.toUpperCase()}
            bindId={`theia.shader.${activeId}.${p.name}`}
            value={values[p.name] ?? p.defaultValue}
            min={p.min}
            max={p.max}
            color="#a855f7"
            format={(v) => (p.type === 'int' ? `${Math.round(v)}` : v.toFixed(2))}
            onChange={(v) => {
              const val = p.type === 'int' ? Math.round(v) : v
              setValues((prev) => {
                const next = { ...prev, [p.name]: val }
                useTheiaPackStore.getState().setAtomParamValues(activeId, next)
                return next
              })
              throttled(p.name, () =>
                getThetaOrchestrator().setUniform(p.name, val))
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default TheiaEngineView
