/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 THEIA ENGINE VIEW — WAVE 4862: THE COMMAND DECK
 * Premium industrial-cyberpunk UI for the Theia video engine.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                  HEADER TOOLBAR (60px)                          │
 *   │  [POWER] [BRIGHT][SPEED][BLACKOUT]  [DROP ZONE]  [BETA]         │
 *   ├──────────────────────────────────────────┬──────────────────────┤
 *   │                                          │   INSPECTOR          │
 *   │   MAIN VIEWPORT [RAW | PATCH PREVIEW]    │   (retractable,      │
 *   │   (the canvas + scanlines)               │    glassmorphism)    │
 *   │                                          │                      │
 *   │                                          │   ▸ Section Monitor  │
 *   │                                          │   ▸ Active Clip Meta │
 *   │                                          │   ▸ Manual Overrides │
 *   ├──────────────────────────────────────────┤                      │
 *   │   ASSET DECK (horizontal clip timeline)  │                      │
 *   └──────────────────────────────────────────┴──────────────────────┘
 *
 * MIDI BINDINGS (every control carries data-midi-bind for MidiLearn):
 *   theia.power · theia.brightness · theia.speed · theia.blackout
 *   theia.mode-toggle · theia.force-drop · theia.force-ambient
 *   theia.force-blackout · theia.next-clip · theia.prev-clip
 *
 * @module views/TheiaEngineView
 * @version WAVE 4862 (mockup — wired to ThetaOrchestrator in F4)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './TheiaEngineView.css'
import { getThetaOrchestrator, getSeleneTheiaBridge } from '../../../theia'
import { useControlStore } from '../../../stores/controlStore'
import { useTheiaEditorStore } from '../../../stores/useTheiaEditorStore'
import { useTheiaPackStore } from '../../../stores/useTheiaPackStore'
import { useAuthoringShortcuts } from '../../../hooks/useAuthoringShortcuts'
import TheiaDNALab from '../../theia/TheiaDNALab'
import TheiaTrimmer from '../../theia/TheiaTrimmer'
import WorkshopDeck from '../../theia/WorkshopDeck'
import LiveDeck from '../../theia/LiveDeck'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ViewportMode = 'raw' | 'patch'
type AssetState = 'ambient' | 'drop' | 'transition' | 'idle'
type SectionTag = 'silence' | 'verse' | 'buildup' | 'drop' | 'breakdown' | 'outro'

interface AssetZone {
  /** Position 0..1 along clip duration */
  t: number
  /** Energy peak score 0..1 */
  energy: number
  /** Optional human label */
  label?: string
}

interface ClipManifest {
  id: string
  name: string
  durationMs: number
  /** Current playback state of the asset state-machine */
  state: AssetState
  /** Color palette swatch (3 colors) for the card chip */
  palette: [string, string, string]
  /** Asset DNA — interest zones the engine will sync lights to */
  zones: AssetZone[]
  /** Whether this clip is the currently routed asset */
  active: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA — replace with ThetaOrchestrator + .theia parser in F4
// ═══════════════════════════════════════════════════════════════════════════

const MOCK_CLIPS: ClipManifest[] = [
  {
    id: 'clip-aurora',
    name: 'Aurora Flow',
    durationMs: 184_000,
    state: 'ambient',
    palette: ['#06b6d4', '#a855f7', '#22c55e'],
    zones: [
      { t: 0.18, energy: 0.4, label: 'lift' },
      { t: 0.42, energy: 0.85, label: 'drop' },
      { t: 0.71, energy: 0.55, label: 'wave' },
    ],
    active: true,
  },
  {
    id: 'clip-vortex',
    name: 'Vortex Pulse',
    durationMs: 96_000,
    state: 'idle',
    palette: ['#ef4444', '#fbbf24', '#f97316'],
    zones: [
      { t: 0.30, energy: 0.95, label: 'impact' },
      { t: 0.65, energy: 0.7 },
    ],
    active: false,
  },
  {
    id: 'clip-monolith',
    name: 'Monolith',
    durationMs: 240_000,
    state: 'idle',
    palette: ['#3b82f6', '#06b6d4', '#94a3b8'],
    zones: [
      { t: 0.50, energy: 0.6 },
    ],
    active: false,
  },
  {
    id: 'clip-saturn',
    name: 'Saturn Rings',
    durationMs: 132_000,
    state: 'idle',
    palette: ['#a855f7', '#06b6d4', '#fbbf24'],
    zones: [
      { t: 0.22, energy: 0.5 },
      { t: 0.55, energy: 0.8, label: 'apex' },
      { t: 0.88, energy: 0.4 },
    ],
    active: false,
  },
]

const SECTION_LABELS: Record<SectionTag, { label: string; color: string; emoji: string }> = {
  silence: { label: 'SILENCE',   color: '#475569', emoji: '◦' },
  verse:   { label: 'VERSE',     color: '#3b82f6', emoji: '◆' },
  buildup: { label: 'BUILDUP',   color: '#22c55e', emoji: '▲' },
  drop:    { label: 'DROP',      color: '#ef4444', emoji: '🔥' },
  breakdown:{ label: 'BREAKDOWN',color: '#a855f7', emoji: '▼' },
  outro:   { label: 'OUTRO',     color: '#94a3b8', emoji: '◇' },
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

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

  // ── Viewport mode ──────────────────────────────────────────────────────
  const [viewportMode, setViewportMode] = useState<ViewportMode>('raw')

  // ── Inspector ──────────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(true)

  // ── Live section monitor (mocked — wire to BrainTheiaBridge in F5) ────
  const [section, setSection] = useState<SectionTag>('verse')
  const [sectionConfidence, setSectionConfidence] = useState(0.72)
  const [bpm, setBpm] = useState(124)
  const [energyValue, setEnergyValue] = useState(0.42)

  // ── Sparkline history for the section monitor ────────────────────────
  const sparkRef = useRef<number[]>(new Array(60).fill(0.3))
  const [sparkData, setSparkData] = useState<number[]>(sparkRef.current)

  // ── Output window state ──────────────────────────────────────────────
  const [isOutputActive, setIsOutputActive] = useState(false)

  // ── AI / SeleneTheiaBridge ─────────────────────────────────────────────
  const aiEnabled = useControlStore((s) => s.aiEnabled)

  // ── Theia Editor Mode (WAVE 4910.1) ──────────────────────────────────
  const editorMode    = useTheiaEditorStore((s) => s.editorMode)
  const setEditorMode = useTheiaEditorStore((s) => s.setEditorMode)

  // ── WAVE 4910.7: atajos de teclado en modo AUTHOR ────────────────────
  useAuthoringShortcuts()

  // ── Clips ─────────────────────────────────────────────────────────────
  const [clips, setClips] = useState<ClipManifest[]>(MOCK_CLIPS)
  const activeClip = useMemo(() => clips.find((c) => c.active) ?? clips[0], [clips])

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

  // ─── Mock heartbeat: drives the live section monitor every 100ms ──────
  useEffect(() => {
    if (!enginePower) return
    const handle = window.setInterval(() => {
      // Wobble energy with a sine + noise
      const t = Date.now() / 1000
      const e = 0.5 + 0.35 * Math.sin(t * 0.6) + 0.15 * (Math.random() - 0.5)
      const clamped = Math.max(0, Math.min(1, e))
      setEnergyValue(clamped)
      sparkRef.current.push(clamped)
      if (sparkRef.current.length > 60) sparkRef.current.shift()
      setSparkData([...sparkRef.current])

      // Section heuristic for the mock
      if (clamped > 0.85) setSection('drop')
      else if (clamped > 0.65) setSection('buildup')
      else if (clamped > 0.35) setSection('verse')
      else setSection('silence')
      setSectionConfidence(0.55 + Math.abs(clamped - 0.5))
    }, 120)
    return () => window.clearInterval(handle)
  }, [enginePower])

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

  const handleSelectClip = useCallback((id: string) => {
    setClips((prev) =>
      prev.map((c) => ({
        ...c,
        active: c.id === id,
        state: c.id === id ? (c.state === 'idle' ? 'ambient' : c.state) : 'idle',
      }))
    )
  }, [])

  // 🎬 WAVE 4864 — Phase 4: Force Drop / Force Ambient now drive the
  // ThetaOrchestrator's AssetStateMachine through `forceState()`. The worker
  // runs a 500ms crossfade between the previous frame and the new one.
  const handleForceDrop = useCallback(() => {
    setClips((prev) =>
      prev.map((c) => (c.active ? { ...c, state: 'drop' } : c))
    )
    getThetaOrchestrator().forceState('drop', { manual: true })
  }, [])

  const handleForceAmbient = useCallback(() => {
    setClips((prev) =>
      prev.map((c) => (c.active ? { ...c, state: 'ambient' } : c))
    )
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

  const handleSpeedChange = useCallback((value: number) => {
    setSpeed(value)
    getThetaOrchestrator().setPlaybackRate(value)
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

      if (mode === 'workshop') {
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

        {/* ── WAVE 4921: LIVE ◐ WORKSHOP mode toggle ── */}
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
            onChange={setBrightness}
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
            onChange={setContrast}
            color="#14b8a6"
          />
        </div>

        {/* ── BLACKOUT toggle ── */}
        <button
          className={`theia-blackout ${blackout ? 'is-active' : ''}`}
          onClick={() => setBlackout((b) => !b)}
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
            mode={viewportMode}
            onModeChange={setViewportMode}
            showModeToggle={editorMode !== 'workshop'}
            enginePower={enginePower}
            blackout={blackout}
            activeClip={activeClip}
            section={section}
          />

          {editorMode === 'live' ? (
            <LiveDeck />
          ) : (
            <>
              <WorkshopDeck />
              <TheiaTrimmer />
            </>
          )}
        </div>

        {/* ─── RIGHT COLUMN: inspector | dna-lab placeholder ─── */}
        {editorMode === 'live' ? (
          <Inspector
            open={inspectorOpen}
            activeClip={activeClip}
            section={section}
            sectionConfidence={sectionConfidence}
            bpm={bpm}
            setBpm={setBpm}
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
  mode: ViewportMode
  onModeChange: (m: ViewportMode) => void
  showModeToggle: boolean
  enginePower: boolean
  blackout: boolean
  activeClip: ClipManifest
  section: SectionTag
}

const Viewport: React.FC<ViewportProps> = ({
  mode, onModeChange, showModeToggle, enginePower, blackout, activeClip, section
}) => {
  const sectionMeta = SECTION_LABELS[section]

  // ── WAVE 4910.14 M3: Author mode — native video viewer ──────────────────
  // En AUTHOR el canvas/worker no está activo. Mostramos el <video> nativo
  // directamente en el viewport usando un div contenedor como slot.
  const editorMode = useTheiaEditorStore((s) => s.editorMode)
  const draftId    = useTheiaEditorStore((s) => s.draftAtom?.id)  // dep para re-trigger
  const isAuthorMode = editorMode === 'workshop'
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
      {/* ── Mode toggle ── */}
      <div className="theia-vp__bar">
        {showModeToggle && (
          <div className="theia-vp__mode-toggle" data-midi-bind="theia.mode-toggle">
            <button
              className={mode === 'raw' ? 'is-active' : ''}
              onClick={() => onModeChange('raw')}
            >
              RAW
            </button>
            <button
              className={mode === 'patch' ? 'is-active' : ''}
              onClick={() => onModeChange('patch')}
            >
              PATCH PREVIEW
            </button>
          </div>
        )}

        <div className="theia-vp__live-tag">
          <span className={`theia-vp__live-dot ${enginePower ? 'is-on' : ''}`} />
          <span className="theia-vp__live-text">
            {enginePower ? 'STREAMING' : 'STANDBY'}
          </span>
          <span className="theia-vp__divider" />
          <span
            className="theia-vp__section"
            style={{ color: sectionMeta.color }}
          >
            {sectionMeta.emoji} {sectionMeta.label}
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

        {/* PATCH PREVIEW overlay: 3 totem mock */}
        {mode === 'patch' && enginePower && !blackout && (
          <div className="theia-vp__patch-overlay">
            <Totem index={0} palette={activeClip.palette} />
            <Totem index={1} palette={activeClip.palette} />
            <Totem index={2} palette={activeClip.palette} />
            <div className="theia-vp__patch-info">
              <span>3 TÓTEMS · 1920×1080 SOURCE → 256×512 EACH</span>
            </div>
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

// ─── Totem mock ─────────────────────────────────────────────────────────
const Totem: React.FC<{ index: number; palette: [string, string, string] }> = ({
  index, palette,
}) => {
  const colors = [palette[0], palette[1], palette[2]]
  return (
    <div className={`theia-totem theia-totem--${index}`}>
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className="theia-totem__cell"
          style={{
            background: `linear-gradient(180deg, ${colors[row % 3]}88, ${colors[(row + 1) % 3]}88)`,
            animationDelay: `${row * 0.15 + index * 0.3}s`,
          }}
        />
      ))}
      <div className="theia-totem__label">T-{index + 1}</div>
    </div>
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
  activeClip: ClipManifest
  section: SectionTag
  sectionConfidence: number
  bpm: number
  setBpm: (v: number) => void
  energyValue: number
  sparkData: number[]
  onForceDrop: () => void
  onForceAmbient: () => void
  enginePower: boolean
}

const Inspector: React.FC<InspectorProps> = ({
  open, activeClip, section, sectionConfidence, bpm, energyValue, sparkData,
  onForceDrop, onForceAmbient, enginePower,
}) => {
  const sectionMeta = SECTION_LABELS[section]

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

            {/* Section banner */}
            <div
              className="theia-insp__section"
              style={{
                borderColor: `${sectionMeta.color}66`,
                background: `${sectionMeta.color}15`,
              }}
            >
              <span
                className="theia-insp__section-emoji"
              >{sectionMeta.emoji}</span>
              <div className="theia-insp__section-body">
                <span
                  className="theia-insp__section-label"
                  style={{ color: sectionMeta.color }}
                >
                  {sectionMeta.label}
                </span>
                <span className="theia-insp__section-conf">
                  CONFIDENCE {Math.round(sectionConfidence * 100)}%
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
                <circle
                  cx="100"
                  cy={40 - energyValue * 36 - 2}
                  r="2"
                  fill={sectionMeta.color}
                />
              </svg>
            </div>

            {/* BPM + Energy strip */}
            <div className="theia-insp__metrics">
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">BPM</span>
                <span className="theia-insp__metric-value">{bpm}</span>
              </div>
              <div className="theia-insp__metric">
                <span className="theia-insp__metric-label">ENERGY</span>
                <span className="theia-insp__metric-value">
                  {Math.round(energyValue * 100)}%
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

          {/* ── SECTION 2: Active Clip metadata ── */}
          <div className="theia-insp__block">
            <div className="theia-insp__block-header">
              <span className="theia-insp__block-icon">◈</span>
              <span className="theia-insp__block-title">ACTIVE ASSET</span>
            </div>

            <div className="theia-insp__clip-info">
              <div className="theia-insp__clip-name">{activeClip.name}</div>
              <div className="theia-insp__clip-id">{activeClip.id}</div>

              <div className="theia-insp__kv">
                <span>Duration</span>
                <span>{fmtDuration(activeClip.durationMs)}</span>
              </div>
              <div className="theia-insp__kv">
                <span>State</span>
                <span className={`theia-insp__state-pill theia-insp__state-pill--${activeClip.state}`}>
                  {activeClip.state.toUpperCase()}
                </span>
              </div>
              <div className="theia-insp__kv">
                <span>Zones</span>
                <span>{activeClip.zones.length} interest peaks</span>
              </div>

              {/* Palette swatches */}
              <div className="theia-insp__kv">
                <span>Palette</span>
                <span className="theia-insp__swatches">
                  {activeClip.palette.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
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
              <button
                className="theia-insp__btn theia-insp__btn--blackout"
                data-midi-bind="theia.force-blackout"
              >
                <span className="theia-insp__btn-icon">◉</span>
                <span>BLACK FRAME</span>
              </button>
              <button
                className="theia-insp__btn theia-insp__btn--reset"
                data-midi-bind="theia.reset-state"
              >
                <span className="theia-insp__btn-icon">↻</span>
                <span>RESET</span>
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
