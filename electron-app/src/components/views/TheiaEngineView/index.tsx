/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA ENGINE VIEW — WAVE 4862: THE COMMAND DECK
 * Premium industrial-cyberpunk UI for the Theia video engine.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                  HEADER TOOLBAR (60px)                          │
 *   │  [POWER] [BRIGHT][SPEED][CONTRAST][BLACKOUT]  [LOAD]  [OUTPUT]  │
 *   ├──────────────────────────────────────────┬──────────────────────┤
 *   │                                          │   INSPECTOR          │
 *   │   MAIN VIEWPORT (worker canvas)          │   (retractable)      │
 *   │                                          │                      │
 *   ├──────────────────────────────────────────┤   ▸ Section Monitor  │
 *   │   TRANSPORT BAR (play/loop/seek)         │   ▸ Manual Overrides │
 *   ├──────────────────────────────────────────┤                      │
 *   │   DECK (LiveDeck — Universal Media Pool) │                      │
 *   └──────────────────────────────────────────┴──────────────────────┘
 *
 * MIDI BINDINGS (every control carries data-midi-bind for MidiLearn):
 *   theia.power · theia.brightness · theia.speed · theia.contrast · theia.blackout
 *   theia.transport.play · theia.transport.loop · theia.transport.seek
 *   theia.force-drop · theia.force-ambient
 *   theia.toggle-output · theia.load-assets · theia.load-pack
 *
 * 🌊 WAVE 8211 (H1+H2): mock clips, synthetic heartbeat, PATCH PREVIEW and
 * dead buttons purged; masters wired to the worker via `theia:set-uniform`.
 * �️ WAVE 8239 · U1 — HYBRID DECK: el "Author Mode" queda DEMOLIDO
 * (WorkshopDeck/TheiaTrimmer/TheiaDNALab + useTheiaEditorStore eliminados).
 * Theia es 100% LIVE OPERATION: transporte reactivo + media pool universal.
 *
 * @module views/TheiaEngineView
 * @version WAVE 8239
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './TheiaEngineView.css'
import { getThetaOrchestrator, getSeleneTheiaBridge } from '../../../theia'
// 🔮 WAVE 8230 — EUCLID · E4: átomos generativos + meta @euclid → sliders
import { ensureEuclidShaderAtoms } from '../../../theia/shader/atoms'
import type { EuclidMeta } from '../../../theia'
import { useControlStore } from '../../../stores/controlStore'
import {
  isSupportedMediaFile,
  MEDIA_POOL_ACCEPT,
  useTheiaPackStore,
} from '../../../stores/useTheiaPackStore'
import LiveDeck from '../../theia/LiveDeck'
import TransportBar from '../../theia/TransportBar'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type SectionTag = 'silence' | 'verse' | 'buildup' | 'drop' | 'breakdown' | 'outro'

const SECTION_LABELS: Record<SectionTag, { label: string; color: string; emoji: string }> = {
  silence: { label: 'SILENCE',   color: '#475569', emoji: '◦' },
  verse:   { label: 'VERSE',     color: '#3b82f6', emoji: '◆' },
  buildup: { label: 'BUILDUP',   color: '#a3e635', emoji: '▲' },
  drop:    { label: 'DROP',      color: '#ef4444', emoji: '🔥' },
  breakdown:{ label: 'BREAKDOWN',color: '#a855f7', emoji: '▼' },
  outro:   { label: 'OUTRO',     color: '#94a3b8', emoji: '◇' },
}

/** 🌊 WAVE 8211 (H1) — flat baseline shown while telemetry is offline. */
const OFFLINE_SPARK: readonly number[] = Object.freeze(new Array(60).fill(0))

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const TheiaEngineView: React.FC = () => {
  // ── Master controls ───────────────────────────────────────────────────
  const [enginePower, setEnginePower] = useState(false)
  const [brightness, setBrightness] = useState(0.85)
  const [speed, setSpeed] = useState(1.0)
  const [blackout, setBlackout] = useState(false)
  const [contrast, setContrast] = useState(0.5)

  // ── Inspector ──────────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(true)

  // ── Live telemetry — 🌊 WAVE 8211 (H1): synthetic heartbeat removed.
  // These stay null/empty (displayed as '—' / 'NO SIGNAL') until the
  // TheiaTelemetryRing feeds real Selene/GodEar/Omniliquid data. ──────────
  const section: SectionTag | null = null
  const sectionConfidence: number | null = null
  const bpm: number | null = null
  const energyValue: number | null = null
  const sparkData = OFFLINE_SPARK

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

  // ─── 🔮 WAVE 8230 · E4 — átomos generativos Euclid (kind:'shader') ────
  // Idempotente: registra el pack euclid-oracle en el LiveDeck + registry.
  useEffect(() => {
    ensureEuclidShaderAtoms()
  }, [])

  // ─── 🌊 WAVE 8211 (H2) — Push initial master values to the worker once.
  // The orchestrator replays them on every 'theia:ready' (Phoenix respawn),
  // so this just keeps the UI and the shader in sync at mount. ────────────
  useEffect(() => {
    const theta = getThetaOrchestrator()
    theta.setUniform('u_brightness', brightness)
    theta.setUniform('u_contrast', contrast)
    theta.setUniform('u_speed', speed)
    theta.setUniform('u_blackout', blackout ? 1 : 0)
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
    setEnginePower(next)
    if (next) {
      theta.start().catch((err: unknown) => {
        console.error('[Theia UI] start() failed:', err)
      })
    } else {
      theta.stop().catch((err: unknown) => {
        console.error('[Theia UI] stop() failed:', err)
      })
    }
  }, [enginePower])

  // 🎬 WAVE 4864 — Phase 4: Force Drop / Force Ambient now drive the
  // ThetaOrchestrator's AssetStateMachine through `forceState()`. The worker
  // runs a 500ms crossfade between the previous frame and the new one.
  const handleForceDrop = useCallback(() => {
    getThetaOrchestrator().forceState('drop', { manual: true })
  }, [])

  const handleForceAmbient = useCallback(() => {
    getThetaOrchestrator().forceState('ambient', { manual: true })
  }, [])

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

  // ── 🌊 WAVE 8211 (H2) — Masters wired to the worker via set-uniform ───
  const handleBrightnessChange = useCallback((value: number) => {
    setBrightness(value)
    getThetaOrchestrator().setUniform('u_brightness', value)
  }, [])

  const handleContrastChange = useCallback((value: number) => {
    setContrast(value)
    getThetaOrchestrator().setUniform('u_contrast', value)
  }, [])

  const handleBlackout = useCallback(() => {
    // 🌊 WAVE 8220 — mismo saneamiento que handlePower: el setUniform es un
    // postMessage síncrono — no pertenece a la fase de render del updater.
    const next = !blackout
    setBlackout(next)
    getThetaOrchestrator().setUniform('u_blackout', next ? 1 : 0)
  }, [blackout])

  const handleSpeedChange = useCallback((value: number) => {
    setSpeed(value)
    const theta = getThetaOrchestrator()
    theta.setPlaybackRate(value)
    theta.setUniform('u_speed', value)
  }, [])

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

    const { ingestFiles, updateRawClip, updateAtomTrim } = useTheiaPackStore.getState()
    const { clips, atoms } = await ingestFiles(files)
    if (atoms.length === 0 && clips.length === 0) return

    const theta = getThetaOrchestrator()
    const primary = atoms[0]

    try {
      await theta.start()
      if (primary) {
        await theta.playAtom({
          atomId: primary.id,
          startMs: primary.trim.startMs,
          crossfadeMs: 80,
          reason: `manual:ingest|atom=${primary.id}`,
        })

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
      className={`theia-view ${inspectorOpen ? 'theia-view--insp-open' : 'theia-view--insp-closed'}`}
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
          {/* 🎬 WAVE 4864 — Open the secondary projector window */}
          <button
            className={`theia-header__output-btn${isOutputActive ? ' theia-header__output-btn--active' : ''}`}
            onClick={handleToggleOutput}
            title="Open Theia output window (HDMI / LED wall)"
            data-midi-bind="theia.toggle-output"
          >
            OUTPUT
          </button>
        </div>

        {/* ── Power button (huge, glowing) ── */}
        <button
          className={`theia-power ${enginePower ? 'is-on' : 'is-off'}`}
          onClick={handlePower}
          data-midi-bind="theia.power"
          title="Theia Engine ON/OFF"
        >
          <span className="theia-power__ring" />
          <span className="theia-power__core" />
          <span className="theia-power__label">{enginePower ? 'LIVE' : 'OFFLINE'}</span>
        </button>

        {/* ── Master sliders ── */}
        <div className="theia-masters">
          <MasterSlider
            label="BRIGHT"
            bindId="theia.brightness"
            value={brightness}
            onChange={handleBrightnessChange}
            color="#a3e635"
          />
          <MasterSlider
            label="SPEED"
            bindId="theia.speed"
            value={speed}
            onChange={handleSpeedChange}
            min={0.25}
            max={2}
            color="#84cc16"
            format={(v) => `${v.toFixed(2)}×`}
          />
          <MasterSlider
            label="CONTRAST"
            bindId="theia.contrast"
            value={contrast}
            onChange={handleContrastChange}
            color="#d9f99d"
          />
        </div>

        {/* ── BLACKOUT toggle ── */}
        <button
          className={`theia-blackout ${blackout ? 'is-active' : ''}`}
          onClick={handleBlackout}
          data-midi-bind="theia.blackout"
          title="Force Blackout"
        >
          <span className="theia-blackout__icon">◉</span>
          <span className="theia-blackout__label">BLACKOUT</span>
        </button>

        {/* ── File Picker ── */}
        <button
          className="theia-load-assets-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Media Pool: vídeo (.mp4 · .webm · .mkv · .mov · .avi) · átomos (.theia) · shaders (.glsl)"
          data-midi-bind="theia.load-assets"
        >
          <span className="theia-load-assets-btn__icon">📂</span>
          <span className="theia-load-assets-btn__label">LOAD ASSETS</span>
        </button>
        <button
          className="theia-load-assets-btn theia-load-assets-btn--pack"
          onClick={() => packInputRef.current?.click()}
          title="Cargar una carpeta entera como Pack"
          data-midi-bind="theia.load-pack"
        >
          <span className="theia-load-assets-btn__icon">🗂️</span>
          <span className="theia-load-assets-btn__label">LOAD PACK</span>
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

        {/* ── Inspector toggle ── */}
        <button
          className={`theia-insp-btn ${inspectorOpen ? 'is-open' : ''}`}
          onClick={() => setInspectorOpen((o) => !o)}
          title={inspectorOpen ? 'Collapse Inspector' : 'Expand Inspector'}
        >
          {inspectorOpen ? '▶' : '◀'}
        </button>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
       * MAIN GRID (viewport + asset deck + inspector)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="theia-main">
        {/* ─── LEFT COLUMN: viewport + transport + media pool deck ─── */}
        <div className="theia-stage">
          <Viewport
            enginePower={enginePower}
            blackout={blackout}
            section={section}
          />

          {/* 🎛️ WAVE 8239 · U1 — transport bar bajo el viewport */}
          <TransportBar />

          <LiveDeck />
        </div>

        {/* ─── RIGHT COLUMN: inspector ─── */}
        <Inspector
          open={inspectorOpen}
          section={section}
          sectionConfidence={sectionConfidence}
          bpm={bpm}
          energyValue={energyValue}
          sparkData={sparkData}
          onForceDrop={handleForceDrop}
          onForceAmbient={handleForceAmbient}
          enginePower={enginePower}
        />
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
        step={0.001}
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
// SUB-COMPONENT: Viewport — RAW vs PATCH PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

interface ViewportProps {
  enginePower: boolean
  blackout: boolean
  /** 🌊 WAVE 8211 (H1): real section feed is offline until the telemetry ring. */
  section: SectionTag | null
}

const Viewport: React.FC<ViewportProps> = ({ enginePower, blackout, section }) => {
  const sectionMeta = section ? SECTION_LABELS[section] : null

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasTransferredCanvasRef = useRef(false)

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
    <section className={`theia-viewport ${blackout ? 'is-blackout' : ''}`}>
      {/* ── Live tag (mode toggle removed — RAW canvas only, WAVE 8211) ── */}
      <div className="theia-vp__bar">
        <div className="theia-vp__live-tag">
          <span className={`theia-vp__live-dot ${enginePower ? 'is-on' : ''}`} />
          <span className="theia-vp__live-text">
            {enginePower ? 'STREAMING' : 'STANDBY'}
          </span>
          <span className="theia-vp__divider" />
          <span
            className="theia-vp__section"
            style={{ color: sectionMeta?.color ?? '#475569' }}
          >
            {sectionMeta ? `${sectionMeta.emoji} ${sectionMeta.label}` : '—'}
          </span>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div ref={canvasWrapRef} className="theia-vp__canvas-wrap">
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
// y el transporte en `components/theia/TransportBar.tsx`.

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: Inspector (right rail, retractable)
// ═══════════════════════════════════════════════════════════════════════════

interface InspectorProps {
  open: boolean
  /** 🌊 WAVE 8211 (H1): all telemetry fields are nullable — '—' until the ring lands. */
  section: SectionTag | null
  sectionConfidence: number | null
  bpm: number | null
  energyValue: number | null
  sparkData: readonly number[]
  onForceDrop: () => void
  onForceAmbient: () => void
  enginePower: boolean
}

const Inspector: React.FC<InspectorProps> = ({
  open, section, sectionConfidence, bpm, energyValue, sparkData,
  onForceDrop, onForceAmbient, enginePower,
}) => {
  const sectionMeta = section ? SECTION_LABELS[section] : null

  // ── Sparkline path ──
  const sparkPath = useMemo(() => {
    const w = 100, h = 40
    if (sparkData.length === 0) return ''
    const pts = sparkData.map((v, i) => {
      const x = (i / (sparkData.length - 1)) * w
      const y = h - v * (h - 4) - 2
      return `${x},${y}`
    })
    return `M${pts.join(' L')}`
  }, [sparkData])

  return (
    <aside className={`theia-insp ${open ? 'is-open' : 'is-closed'}`}>
      {/* ─── Collapsed sliver ─── */}
      {!open && (
        <div className="theia-insp__sliver">
          <span className="theia-insp__sliver-icon">▮</span>
          <span className="theia-insp__sliver-icon">◎</span>
          <span className="theia-insp__sliver-icon">◇</span>
        </div>
      )}

      {/* ─── Open content ─── */}
      {open && (
        <div className="theia-insp__content">
          {/* ── SECTION 1: Live Section Monitor (Oracle-style) ── */}
          <div className="theia-insp__block">
            <div className="theia-insp__block-header">
              <span className="theia-insp__block-icon">◉</span>
              <span className="theia-insp__block-title">LIVE SECTION MONITOR</span>
              <span className={`theia-insp__pulse ${enginePower ? 'is-on' : ''}`} />
            </div>

            {/* Section banner — offline until the telemetry ring lands */}
            <div
              className="theia-insp__section"
              style={{
                borderColor: `${sectionMeta?.color ?? '#475569'}66`,
                background: `${sectionMeta?.color ?? '#475569'}15`,
              }}
            >
              <span className="theia-insp__section-emoji">
                {sectionMeta?.emoji ?? '◦'}
              </span>
              <div className="theia-insp__section-body">
                <span
                  className="theia-insp__section-label"
                  style={{ color: sectionMeta?.color ?? '#94a3b8' }}
                >
                  {sectionMeta?.label ?? 'NO SIGNAL'}
                </span>
                <span className="theia-insp__section-conf">
                  {sectionConfidence !== null
                    ? `CONFIDENCE ${Math.round(sectionConfidence * 100)}%`
                    : 'TELEMETRY OFFLINE'}
                </span>
              </div>
            </div>

            {/* Sparkline */}
            <div className="theia-insp__sparkline">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="theia-spark-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#a3e635" stopOpacity="0.7" />
                    <stop offset="60%" stopColor="#84cc16" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="theia-spark-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#a3e635" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
                <path d={`${sparkPath} L100,40 L0,40 Z`} fill="url(#theia-spark-fill)" />
                <path d={sparkPath} fill="none" stroke="url(#theia-spark-grad)" strokeWidth="1.2" />
                {energyValue !== null && (
                  <circle
                    cx="100"
                    cy={40 - energyValue * 36 - 2}
                    r="2"
                    fill={sectionMeta?.color ?? '#475569'}
                  />
                )}
              </svg>
            </div>

            {/* BPM + Energy strip — offline until the telemetry ring lands */}
            <div className="theia-insp__metrics">
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">BPM</span>
                <span className="theia-insp__metric-value">{bpm ?? '—'}</span>
              </div>
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">ENERGY</span>
                <span className="theia-insp__metric-value">
                  {energyValue !== null ? `${Math.round(energyValue * 100)}%` : '—'}
                </span>
              </div>
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">FPS</span>
                <span className="theia-insp__metric-value">
                  {enginePower ? '44.0' : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: Manual Overrides ── */}
          <div className="theia-insp__block">
            <div className="theia-insp__block-header">
              <span className="theia-insp__block-icon">⏵</span>
              <span className="theia-insp__block-title">MANUAL OVERRIDES</span>
            </div>

            <div className="theia-insp__buttons">
              <button
                className="theia-insp__btn theia-insp__btn--drop"
                onClick={onForceDrop}
                data-midi-bind="theia.force-drop"
              >
                <span className="theia-insp__btn-icon">🔥</span>
                <span>FORCE DROP</span>
              </button>
              <button
                className="theia-insp__btn theia-insp__btn--ambient"
                onClick={onForceAmbient}
                data-midi-bind="theia.force-ambient"
              >
                <span className="theia-insp__btn-icon">▒</span>
                <span>FORCE AMBIENT</span>
              </button>
            </div>
          </div>

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

  // Valores por shader-id: la LRU del worker retiene el programa y sus
  // uniforms — al volver a un shader se restauran los valores del usuario,
  // no los defaults.
  const savedRef = useRef<Map<string, Record<string, number>>>(new Map())
  const pushedRef = useRef<Set<string>>(new Set())

  // Relee meta + seed al cambiar de shader. Primera activación de un id:
  // push de los defaults declarados (los uniforms GLSL arrancan en 0).
  useEffect(() => {
    const theta = getThetaOrchestrator()
    const m = theta.getShaderMeta(activeId)
    setMeta(m)
    const saved = savedRef.current.get(activeId)
    const seed: Record<string, number> = {}
    for (const p of m?.params ?? []) seed[p.name] = saved?.[p.name] ?? p.defaultValue
    setValues(seed)
    if (m && m.params.length > 0 && !pushedRef.current.has(activeId)) {
      pushedRef.current.add(activeId)
      for (const p of m.params) theta.setUniform(p.name, p.defaultValue)
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
                savedRef.current.set(activeId, next)
                return next
              })
              getThetaOrchestrator().setUniform(p.name, val)
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default TheiaEngineView
