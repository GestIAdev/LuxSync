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
 *   │                                          │   ▸ Section Monitor  │
 *   │                                          │   ▸ Manual Overrides │
 *   ├──────────────────────────────────────────┤                      │
 *   │   DECK (LiveDeck packs | Workshop queue) │                      │
 *   └──────────────────────────────────────────┴──────────────────────┘
 *
 * MIDI BINDINGS (every control carries data-midi-bind for MidiLearn):
 *   theia.power · theia.brightness · theia.speed · theia.contrast · theia.blackout
 *   theia.editor-mode · theia.force-drop · theia.force-ambient
 *   theia.toggle-output · theia.load-assets · theia.load-pack
 *
 * 🌊 WAVE 8211 (H1+H2): mock clips, synthetic heartbeat, PATCH PREVIEW and
 * dead buttons purged; masters wired to the worker via `theia:set-uniform`.
 * 🌊 WAVE 8211.5: WORKSHOP FREEZE — authoring surface quarantined, view is
 * always LIVE (WORKSHOP_FROZEN flag).
 *
 * @module views/TheiaEngineView
 * @version WAVE 8211.5
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './TheiaEngineView.css'
import { getThetaOrchestrator, getSeleneTheiaBridge } from '../../../theia'
import { useControlStore } from '../../../stores/controlStore'
import { useTheiaEditorStore, type EditorMode } from '../../../stores/useTheiaEditorStore'
import { useTheiaPackStore } from '../../../stores/useTheiaPackStore'
import { useAuthoringShortcuts } from '../../../hooks/useAuthoringShortcuts'
import TheiaDNALab from '../../theia/TheiaDNALab'
import TheiaTrimmer from '../../theia/TheiaTrimmer'
import WorkshopDeck from '../../theia/WorkshopDeck'
import LiveDeck from '../../theia/LiveDeck'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type SectionTag = 'silence' | 'verse' | 'buildup' | 'drop' | 'breakdown' | 'outro'

// 🌊 WAVE 8211 (H1) — MOCK_CLIPS, ClipManifest, AssetZone, PATCH PREVIEW and
// the synthetic heartbeat were purged. Telemetry blocks stay but report
// OFFLINE until the TheiaTelemetryRing (Euclid blueprint, WAVE 8208) lands.

// 🌊 WAVE 8211.5 — WORKSHOP FREEZE. The authoring surface (WorkshopDeck /
// TheiaTrimmer / TheiaDNALab + the LIVE◐WORKSHOP toggle) is quarantined
// until the Hybrid Deck redesign lands. Components stay imported so the
// .theia type pipeline keeps compiling; flip to false to thaw.
const WORKSHOP_FROZEN: boolean = true

const SECTION_LABELS: Record<SectionTag, { label: string; color: string; emoji: string }> = {
  silence: { label: 'SILENCE',   color: '#475569', emoji: '◦' },
  verse:   { label: 'VERSE',     color: '#3b82f6', emoji: '◆' },
  buildup: { label: 'BUILDUP',   color: '#22c55e', emoji: '▲' },
  drop:    { label: 'DROP',      color: '#ef4444', emoji: '🔥' },
  breakdown:{ label: 'BREAKDOWN',color: '#a855f7', emoji: '▼' },
  outro:   { label: 'OUTRO',     color: '#94a3b8', emoji: '◇' },
}

/** 🌊 WAVE 8211 (H1) — flat baseline shown while telemetry is offline. */
const OFFLINE_SPARK: readonly number[] = Object.freeze(new Array(60).fill(0))

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov'] as const

function isSupportedVideoFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return ALLOWED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

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

  // ── Theia Editor Mode (WAVE 4910.1) ──────────────────────────────────
  const storeEditorMode = useTheiaEditorStore((s) => s.editorMode)
  const setEditorMode   = useTheiaEditorStore((s) => s.setEditorMode)
  // 🌊 WAVE 8211.5 — freeze: the rendered surface is always LIVE while the
  // workshop is quarantined. The store subscription stays for the thaw.
  const editorMode: EditorMode = WORKSHOP_FROZEN ? 'live' : storeEditorMode

  // ── WAVE 4910.7: atajos de teclado en modo AUTHOR ────────────────────
  useAuthoringShortcuts()

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

  // ─── WAVE 4910.2: Bloqueo de Selene en modo AUTHOR ─────────────────────
  // En AUTHOR el operador edita visualmente; Selene no debe interferir.
  useEffect(() => {
    if (editorMode === 'workshop') {
      getSeleneTheiaBridge().detach()
    }
    // En 'live', el efecto de aiEnabled es la fuente de verdad para attach.
  }, [editorMode])

  // ─── 🌊 WAVE 8211.5: Workshop freeze — pin the store to 'live'. ───────
  // Defensive: any stray setEditorMode('workshop') (HMR state, future
  // callers) is reverted so no workshop surface can mount.
  useEffect(() => {
    if (WORKSHOP_FROZEN && useTheiaEditorStore.getState().editorMode !== 'live') {
      useTheiaEditorStore.getState().setEditorMode('live')
    }
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
    setEnginePower((prev) => {
      const next = !prev
      if (next) {
        theta.start().catch((err: unknown) => {
          console.error('[Theia UI] start() failed:', err)
        })
      } else {
        theta.stop().catch((err: unknown) => {
          console.error('[Theia UI] stop() failed:', err)
        })
      }
      return next
    })
  }, [])

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
    setBlackout((prev) => {
      const next = !prev
      getThetaOrchestrator().setUniform('u_blackout', next ? 1 : 0)
      return next
    })
  }, [])

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

  // Versión del registro — al incrementar fuerza re-render de AuthorAssetDeck
  const [, setAssetVersion] = useState(0)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      isSupportedVideoFileName(f.name) || f.name.toLowerCase().endsWith('.theia')
    )
    // Reset para permitir re-selección del mismo archivo
    e.target.value = ''
    if (files.length === 0) {
      console.warn('[Theia UI] No supported files in selection')
      return
    }

    // ── WAVE 4924 — ingest via Pack Store (async) ─────────────────────────
    // Los .theia se parsean como ITheiaAtom y se adjuntan al pack sin pasar
    // por el workshop. Los vídeos van a rawClips. ingestFiles es async.
    const { ingestFiles, updateRawClip } = useTheiaPackStore.getState()
    const { clips } = await ingestFiles(files)
    if (clips.length === 0) return

    // ── Cargar el primer clip en el orchestrator ─────────────────────────
    const theta = getThetaOrchestrator()
    const { editorMode: mode } = useTheiaEditorStore.getState()
    const primary = clips[0]

    try {
      await theta.start()
      await theta.loadVideo(primary.url)
      // WAVE 4910.14 M2: NO autoplay — el operador controla la reproducción (Space).

      const vidDuration = theta.getVideoElement()?.duration ?? 0
      const durMs = Number.isFinite(vidDuration) && vidDuration > 0
        ? Math.round(vidDuration * 1000)
        : 0
      if (durMs > 0) updateRawClip(primary.id, { durationMs: durMs })

      if (mode === 'workshop' && !WORKSHOP_FROZEN) {
        useTheiaEditorStore.getState().newDraftFromPath(primary.filePath, durMs, primary.id)
        updateRawClip(primary.id, { state: 'editing' })
      }

      console.log(
        `[Theia UI] ✅ Ingested ${clips.length} clip(s) into pack ` +
        `'${primary.packId}' (primary: ${primary.name})`
      )
    } catch (err) {
      console.error('[Theia UI] loadVideo() failed:', err)
    }
    setAssetVersion((v) => v + 1)
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

        {/* ── WAVE 4921: LIVE ◐ WORKSHOP mode toggle ──
            🌊 WAVE 8211.5 — hidden while the workshop is quarantined. */}
        {!WORKSHOP_FROZEN && (
        <div
          className={`theia-mode-toggle${editorMode === 'workshop' ? ' is-author' : ' is-perform'}`}
          data-midi-bind="theia.editor-mode"
        >
          <button
            className={`theia-mode-toggle__btn${editorMode === 'live' ? ' is-active' : ''}`}
            onClick={() => setEditorMode('live')}
            title="LIVE — runtime, Selene al mando"
          >
            LIVE
          </button>
          <span className="theia-mode-toggle__divider">◐</span>
          <button
            className={`theia-mode-toggle__btn${editorMode === 'workshop' ? ' is-active' : ''}`}
            onClick={() => setEditorMode('workshop')}
            title="WORKSHOP — trim, genómoa, export atómico"
          >
            WORKSHOP
          </button>
        </div>
        )}

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
            color="#06b6d4"
          />
          <MasterSlider
            label="SPEED"
            bindId="theia.speed"
            value={speed}
            onChange={handleSpeedChange}
            min={0.25}
            max={2}
            color="#22d3ee"
            format={(v) => `${v.toFixed(2)}×`}
          />
          <MasterSlider
            label="CONTRAST"
            bindId="theia.contrast"
            value={contrast}
            onChange={handleContrastChange}
            color="#14b8a6"
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
          title="Cargar assets de vídeo (.mp4 · .webm · .mkv · .mov)"
          data-midi-bind="theia.load-assets"
        >
          <span className="theia-load-assets-btn__icon">📂</span>
          <span className="theia-load-assets-btn__label">LOAD ASSETS</span>
        </button>
        <button
          className="theia-load-assets-btn theia-load-assets-btn--pack"
          onClick={() => packInputRef.current?.click()}
          title="Cargar una carpeta entera como Pack (.mp4 · .webm · .mkv · .mov)"
          data-midi-bind="theia.load-pack"
        >
          <span className="theia-load-assets-btn__icon">🗂️</span>
          <span className="theia-load-assets-btn__label">LOAD PACK</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp4,.webm,.mkv,.mov,.theia"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {/* webkitdirectory/directory se inyectan vía useEffect (atributos no-estándar) */}
        <input
          ref={packInputRef}
          type="file"
          multiple
          accept=".mp4,.webm,.mkv,.mov,.theia"
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
      <div className={`theia-main${editorMode === 'workshop' ? ' theia-main--author' : ''}`}>
        {/* ─── LEFT COLUMN: viewport + (asset deck | trimmer) ─── */}
        <div className="theia-stage">
          <Viewport
            enginePower={enginePower}
            blackout={blackout}
            section={section}
          />

          {editorMode === 'live' || WORKSHOP_FROZEN ? (
            <LiveDeck />
          ) : (
            <>
              <WorkshopDeck />
              <TheiaTrimmer />
            </>
          )}
        </div>

        {/* ─── RIGHT COLUMN: inspector | dna-lab placeholder ─── */}
        {editorMode === 'live' || WORKSHOP_FROZEN ? (
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
        ) : (
          <TheiaDNALab />
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

  // ── WAVE 4910.14 M3: Author mode — native video viewer ──────────────────
  // En AUTHOR el canvas/worker no está activo. Mostramos el <video> nativo
  // directamente en el viewport usando un div contenedor como slot.
  const editorMode = useTheiaEditorStore((s) => s.editorMode)
  const draftId    = useTheiaEditorStore((s) => s.draftAtom?.id)  // dep para re-trigger
  const isAuthorMode = !WORKSHOP_FROZEN && editorMode === 'workshop'
  const videoSlotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isAuthorMode) return
    const container = videoSlotRef.current
    if (!container) return
    const vid = getThetaOrchestrator().getVideoElement()
    if (!vid) return

    // Override los estilos ocultos del orchestrator para mostrar el vídeo
    vid.style.position    = 'relative'
    vid.style.top         = ''
    vid.style.left        = ''
    vid.style.width       = '100%'
    vid.style.height      = '100%'
    vid.style.objectFit   = 'contain'
    vid.style.opacity     = '1'
    vid.style.zIndex      = '50'
    vid.style.pointerEvents = 'none'
    container.appendChild(vid)

    return () => {
      if (vid.parentElement === container) {
        container.removeChild(vid)
      }
      // Restaurar estilo oculto (idéntico a lo que ThetaOrchestrator.loadVideo() establece)
      vid.style.position    = 'fixed'
      vid.style.top         = '-9999px'
      vid.style.left        = '-9999px'
      vid.style.width       = '1px'
      vid.style.height      = '1px'
      vid.style.opacity     = '0'
      vid.style.zIndex      = ''
      vid.style.pointerEvents = 'none'
    }
  }, [isAuthorMode, draftId])  // re-ejecuta cuando se carga un nuevo archivo en author mode

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hasTransferredCanvasRef = useRef(false)

  useEffect(() => {
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

      const rect = host.getBoundingClientRect()
      const dpr = Math.max(1, window.devicePixelRatio || 1)
      host.width = Math.max(1, Math.floor(rect.width * dpr))
      host.height = Math.max(1, Math.floor(rect.height * dpr))

      const offscreen = host.transferControlToOffscreen()
      getThetaOrchestrator().attachOffscreenCanvas(offscreen)
      hasTransferredCanvasRef.current = true
      console.log('[Theia UI] 🎬 viewport canvas attached to Theta worker')
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
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
      <div className="theia-vp__canvas-wrap">
        {/* Background grid */}
        <div className="theia-vp__grid" />

        {/* Scanlines overlay — solo en perform mode */}
        <div className={`theia-vp__scanlines ${!isAuthorMode && enginePower ? 'is-on' : ''}`} />

        {/* ── AUTHOR MODE: slot donde useEffect inyecta el <video> nativo ── */}
        {isAuthorMode && (
          <div ref={videoSlotRef} className="theia-vp__video-slot">
            {/* Placeholder visible hasta que se cargue un archivo */}
            {!draftId && (
              <div className="theia-vp__off">
                <span className="theia-vp__off-icon">◯</span>
                <span className="theia-vp__off-text">AUTHOR STANDBY — CARGA UN ASSET</span>
              </div>
            )}
          </div>
        )}

        {/* ── PERFORM MODE: canvas renderizado por el worker vía OffscreenCanvas ── */}
        <canvas
          ref={canvasRef}
          className="theia-vp__surface"
          style={{ visibility: isAuthorMode ? 'hidden' : 'visible' }}
        />

        {/* Off state overlay — solo en perform mode */}
        {!isAuthorMode && (!enginePower || blackout) && (
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
// El LIVE deck ahora vive en `components/theia/LiveDeck.tsx` (Pack Slots +
// Atom Tiles) y el WORKSHOP deck en `components/theia/WorkshopDeck.tsx`.

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
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
                    <stop offset="60%" stopColor="#22d3ee" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
                  </linearGradient>
                  <linearGradient id="theia-spark-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.25" />
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
export default TheiaEngineView
