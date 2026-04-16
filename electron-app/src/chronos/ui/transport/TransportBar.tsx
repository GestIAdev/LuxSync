/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ TRANSPORT BAR - WAVE 2040.4: THE MASTER TOOLBAR
 *
 * Unified command center: Engine Status + Transport + Modes + Audio
 * Single bar across 100% width — no more split headers.
 *
 * LAYOUT (Left → Right):
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ [⚡][�][🧠] │ [New][Open][Save] │ [⏮][⏹][▶][⏺] │ 00:00:00 │ BPM │ [Stage][Quant][Snap] │ [Audio] │
 * │   ENGINE      │     PROJECT       │    TRANSPORT     │ TIMECODE │     │        MODES        │         │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * DESIGN: Hephaestus-inspired, Violet Cyberpunk (#a855f7)
 * EXTERMINIO DE EMOJIS: All icons are LuxIcons SVGs
 *
 * FUSION: Absorbs EngineStatus.tsx logic (Reactor / Data / Synapse)
 * NOTE: AI starts OFF by default in Chronos (never pollute manual programming)
 *
 * @module chronos/ui/transport/TransportBar
 * @version WAVE 2040.4
 */

import React, { useCallback, useEffect, useState, memo } from 'react'
import {
  ReactorIcon,
  DataStreamIcon,
  SynapseIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  RecordIcon,
  RewindIcon,
  FilePlusIcon,
  FolderIcon,
  SaveIcon,
  MonitorIcon,
  MagnetIcon,
  WaveformIcon,
  UploadIcon,
  MidiClockIcon,
  MicrophoneIcon,
  LiveSignalIcon,
} from '../../../components/icons/LuxIcons'
import { useStageStore } from '../../../stores/stageStore'
import { usePowerStore, type SystemPowerState } from '../../../hooks/useSystemPower'
import { useControlStore, selectAIEnabled, selectOutputEnabled } from '../../../stores/controlStore'
import { getChronosStore } from '../../core/ChronosStore'
import type { MIDIClockSource } from '../../hooks/useMIDIClock'
import './TransportBar.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TransportBarProps {
  isPlaying: boolean
  isRecording: boolean
  currentTime: number
  bpm: number
  onPlay: () => void
  onStop: () => void
  onRecord: () => void
  onBpmChange: (bpm: number) => void
  audioLoaded?: boolean
  audioFileName?: string
  onLoadAudio?: () => void
  onCloseAudio?: () => void
  projectName?: string
  hasUnsavedChanges?: boolean
  onSaveProject?: () => void
  onLoadProject?: () => void
  onNewProject?: () => void
  stageVisible?: boolean
  onToggleStage?: () => void
  // WAVE 2040.5: Snap toggle — single source of truth for timeline magnetic grid
  snapEnabled?: boolean
  onToggleSnap?: () => void
  // WAVE 2040.10: Quantize toggle — human feel vs beat-locked recording
  quantizeEnabled?: boolean
  onToggleQuantize?: () => void
  // 🎹 WAVE 2045: MIDI Clock source control
  midiClockSource?: MIDIClockSource
  midiSignalQuality?: 'none' | 'weak' | 'stable'
  midiBpm?: number
  onToggleMidiClock?: () => void
  // 🎤 WAVE 2045: Audio source selector (FILE | LIVE)
  audioSourceMode?: 'file' | 'live'
  isLiveActive?: boolean
  liveLevel?: number
  onToggleAudioSource?: () => void
  // 🎛️ WAVE 2046.2: Live Rack toggle (TheProgrammer in Chronos)
  showLiveControls?: boolean
  onToggleLiveControls?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTimecode(ms: number): string {
  const totalMs = Math.floor(ms)
  const totalSeconds = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const milliseconds = totalMs % 1000
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

function getPowerStatus(state: SystemPowerState): 'off' | 'starting' | 'on' {
  switch (state) {
    case 'OFFLINE': return 'off'
    case 'STARTING': return 'starting'
    case 'ONLINE': return 'on'
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE BUTTON (Sub-component — fused from EngineStatus.tsx)
// ═══════════════════════════════════════════════════════════════════════════

interface EngineButtonProps {
  icon: React.ReactNode
  label: string
  state: 'off' | 'starting' | 'on'
  onClick: () => void
  variant: 'power' | 'data' | 'ai'
}

const EngineButton: React.FC<EngineButtonProps> = memo(({
  icon, label, state, onClick, variant,
}) => (
  <button
    className={`ct-engine-btn status-${state} variant-${variant}`}
    onClick={onClick}
    title={`${label}: ${state.toUpperCase()}`}
  >
    <span className="ct-engine-icon">{icon}</span>
    <span className="ct-engine-glow" />
  </button>
))

EngineButton.displayName = 'EngineButton'

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS LOGO — WAVE 2040.15: THE CROWN JEWEL
// Isotipo geométrico (círculo con segmentos) + texto técnico
// ═══════════════════════════════════════════════════════════════════════════

const ChronosLogo: React.FC = memo(() => (
  <div className="ct-logo">
    {/* Isotipo: Círculo con segmentos de tiempo */}
    <svg 
      className="ct-logo-icon" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ring */}
      <circle 
        cx="12" 
        cy="12" 
        r="9" 
        stroke="currentColor" 
        strokeWidth="1.5"
        fill="none"
      />
      {/* Time segments (4 quarters) */}
      <path 
        d="M12 3 L12 12" 
        stroke="currentColor" 
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path 
        d="M12 12 L18 8" 
        stroke="currentColor" 
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle 
        cx="12" 
        cy="12" 
        r="1.5" 
        fill="currentColor"
      />
    </svg>
    
    {/* Texto: CHRONOS */}
    <span className="ct-logo-text">CHRONOS</span>
  </div>
))

ChronosLogo.displayName = 'ChronosLogo'

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT BUTTON (Sub-component — now accepts ReactNode icons)
// ═══════════════════════════════════════════════════════════════════════════

interface TransportButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  variant?: 'default' | 'play' | 'record' | 'stop'
  disabled?: boolean
}

const TransportButton: React.FC<TransportButtonProps> = memo(({
  icon, label, onClick, active = false, variant = 'default', disabled = false,
}) => (
  <button
    className={`ct-transport-btn ${variant} ${active ? 'active' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
  >
    {icon}
  </button>
))

TransportButton.displayName = 'TransportButton'

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: THE MASTER TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════

export const TransportBar: React.FC<TransportBarProps> = memo(({
  isPlaying,
  isRecording,
  currentTime,
  bpm,
  onPlay,
  onStop,
  onRecord,
  onBpmChange,
  audioLoaded = false,
  audioFileName,
  onLoadAudio,
  onCloseAudio,
  projectName,
  hasUnsavedChanges = false,
  onSaveProject,
  onLoadProject,
  onNewProject,
  stageVisible = true,
  onToggleStage,
  snapEnabled = true,
  onToggleSnap,
  quantizeEnabled = true,
  onToggleQuantize,
  // 🎹 WAVE 2045: MIDI Clock
  midiClockSource = 'internal',
  midiSignalQuality = 'none',
  midiBpm = 0,
  onToggleMidiClock,
  // 🎤 WAVE 2045: Audio Source
  audioSourceMode = 'file',
  isLiveActive = false,
  liveLevel = 0,
  onToggleAudioSource,
  // 🎛️ WAVE 2046.2: Live Rack
  showLiveControls = false,
  onToggleLiveControls,
}) => {

  // ─────────────────────────────────────────────────────────────────────────
  // ENGINE STATUS STATE (absorbed from EngineStatus.tsx)
  // ─────────────────────────────────────────────────────────────────────────
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [showSaveIndicator, setShowSaveIndicator] = useState(false)
  const [isProfilerRunning, setIsProfilerRunning] = useState(false)

  const powerState = usePowerStore(s => s.powerState)
  const setPowerState = usePowerStore(s => s.setPowerState)
  const outputEnabled = useControlStore(selectOutputEnabled)
  const setOutputEnabled = useControlStore(s => s.setOutputEnabled)
  const aiEnabled = useControlStore(selectAIEnabled)
  const toggleAI = useControlStore(s => s.toggleAI)

  // ── REACTOR (Power ON/OFF) ──
  const handlePowerToggle = useCallback(async () => {
    if (powerState === 'STARTING') return
    if (powerState === 'OFFLINE') {
      setPowerState('STARTING')
      try {
        if (window.lux?.start) {
          const result = await window.lux.start()
          if (result?.success || result?.alreadyRunning) {
            setPowerState('ONLINE')
            console.log('[TransportBar] ⚡ REACTOR: ONLINE')
          } else {
            setPowerState('OFFLINE')
          }
        } else {
          await new Promise(r => setTimeout(r, 500))
          setPowerState('ONLINE')
        }
      } catch (err) {
        console.error('[TransportBar] Power ON failed:', err)
        setPowerState('OFFLINE')
      }
    } else {
      try {
        if (window.lux?.stop) { await window.lux.stop() }
        setPowerState('OFFLINE')
        console.log('[TransportBar] ⚡ REACTOR: OFFLINE')
      } catch (err) {
        console.error('[TransportBar] Power OFF failed:', err)
      }
    }
  }, [powerState, setPowerState])

  // ── DATA (DMX Output) ──
  const handleDataToggle = useCallback(async () => {
    const newState = !outputEnabled
    try {
      const arb = window.lux?.arbiter as any
      const result = arb?.setOutputEnabledTagged
        ? await arb.setOutputEnabledTagged(newState, 'TransportBar:DATA')
        : await window.lux?.arbiter?.setOutputEnabled?.(newState, 'TransportBar:DATA')
      if (result?.success) {
        setOutputEnabled(newState)
        console.log(`[TransportBar] 📡 DATA: ${newState ? 'LIVE' : 'ARMED'}`)
      }
    } catch (err) {
      console.error('[TransportBar] Data toggle failed:', err)
      setOutputEnabled(newState)
    }
  }, [outputEnabled, setOutputEnabled])

  // ── SYNAPSE (AI) — OFF by default in Chronos ──
  const handleSynapseToggle = useCallback(async () => {
    const newState = !aiEnabled
    toggleAI()
    try {
      await window.lux?.setConsciousnessEnabled?.(newState)
      console.log(`[TransportBar] 🧠 SYNAPSE: ${newState ? 'ACTIVE' : 'DORMANT'}`)
    } catch (err) {
      console.error('[TransportBar] Synapse toggle failed:', err)
    }
  }, [aiEnabled, toggleAI])

  // ── Sync with backend on mount ──
  useEffect(() => {
    const syncWithBackend = async () => {
      try {
        const status = await window.lux?.arbiter?.status()
        if (status?.status?.outputEnabled !== undefined) {
          setOutputEnabled(status.status.outputEnabled)
        }
        if (status && powerState === 'OFFLINE') {
          setPowerState('ONLINE')
        }
      } catch { /* Silent — backend might not be ready */ }
    }
    syncWithBackend()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save indicator ──
  useEffect(() => {
    const store = getChronosStore()
    const handleAutoSaveStart = () => { setIsAutoSaving(true); setShowSaveIndicator(true) }
    const handleAutoSaveComplete = () => { setIsAutoSaving(false); setTimeout(() => setShowSaveIndicator(false), 2000) }
    const handleAutoSaveError = () => { setIsAutoSaving(false); setShowSaveIndicator(false) }

    store.on('auto-save-start', handleAutoSaveStart)
    store.on('auto-save-complete', handleAutoSaveComplete)
    store.on('auto-save-error', handleAutoSaveError)
    return () => {
      store.off('auto-save-start', handleAutoSaveStart)
      store.off('auto-save-complete', handleAutoSaveComplete)
      store.off('auto-save-error', handleAutoSaveError)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSPORT HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleBpmDecrease = useCallback(() => onBpmChange(Math.max(20, bpm - 1)), [bpm, onBpmChange])
  const handleBpmIncrease = useCallback(() => onBpmChange(Math.min(300, bpm + 1)), [bpm, onBpmChange])
  const handleBpmInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && value >= 20 && value <= 300) onBpmChange(value)
  }, [onBpmChange])

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE 2040.5b: LOAD SHOW (absorbed from ActiveSession.tsx)
  // Opens native file dialog → loads .luxshow → stageStore auto-updates
  // ─────────────────────────────────────────────────────────────────────────
  const [isLoadingShow, setIsLoadingShow] = useState(false)
  const showFile = useStageStore(state => state.showFile)
  const fixtureCount = useStageStore(state => state.fixtures.length)

  const handleLoadShow = useCallback(async () => {
    setIsLoadingShow(true)
    try {
      const luxApi = (window as any).lux
      if (!luxApi?.stage?.openDialog) {
        console.error('[TransportBar] window.lux.stage.openDialog not available')
        return
      }
      const result = await luxApi.stage.openDialog()
      if (result?.success) {
        console.log(`[TransportBar] Show loaded: ${result.filePath}`)
        if (result.migrated) {
          console.log('[TransportBar] Show migrated from v1 to v2')
        }
      } else if (!result?.cancelled) {
        console.error('[TransportBar] Failed to load show')
      }
    } catch (err) {
      console.error('[TransportBar] Error in load show dialog:', err)
    } finally {
      setIsLoadingShow(false)
    }
  }, [])

  // ⚡ WAVE X-RAY: CPU Profiler — 15s V8 capture → lux-asesino.cpuprofile
  const handleStartProfiler = useCallback(async () => {
    if (isProfilerRunning) return
    setIsProfilerRunning(true)
    try {
      const result = await window.luxDebug?.startProfiler?.()
      if (result?.success) {
        console.log(`[PROFILER] ✅ Saved: ${result.path}`)
      } else {
        console.error('[PROFILER] ❌', result?.error)
      }
    } catch (err) {
      console.error('[PROFILER] ❌ IPC error:', err)
    } finally {
      setIsProfilerRunning(false)
    }
  }, [isProfilerRunning])

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — THE MASTER TOOLBAR
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="ct-bar">

      {/* ═══════════════════════════════════════════════════════════════
       * ZONE 1: ENGINE & PROJECT (Left)
       * [CHRONOS LOGO] │ [⚡ Reactor] [📡 DMX] [🧠 AI] │ [New] [Open] [Save] │ ProjectName
       * ═══════════════════════════════════════════════════════════════ */}
      <div className="ct-zone ct-zone-left">

        {/* WAVE 2040.15: CHRONOS Logo — The Crown Jewel */}
        <ChronosLogo />
        
        <span className="ct-divider" />

        {/* Engine Triad */}
        <div className="ct-engine-group">
          <EngineButton
            icon={<ReactorIcon size={16} />}
            label="Reactor"
            state={getPowerStatus(powerState)}
            onClick={handlePowerToggle}
            variant="power"
          />
          <EngineButton
            icon={<DataStreamIcon size={16} />}
            label="DMX Output"
            state={outputEnabled ? 'on' : 'off'}
            onClick={handleDataToggle}
            variant="data"
          />
          <EngineButton
            icon={<SynapseIcon size={16} />}
            label="AI Consciousness"
            state={aiEnabled ? 'on' : 'off'}
            onClick={handleSynapseToggle}
            variant="ai"
          />
        </div>

        <span className="ct-divider" />

        {/* Project Controls */}
        <div className="ct-project-group">
          {onNewProject && (
            <button className="ct-project-btn" onClick={onNewProject} title="New Project (Ctrl+N)">
              <FilePlusIcon size={15} />
            </button>
          )}
          {onLoadProject && (
            <button className="ct-project-btn" onClick={onLoadProject} title="Open Project (Ctrl+O)">
              <FolderIcon size={15} />
            </button>
          )}
          {onSaveProject && (
            <button
              className={`ct-project-btn ${hasUnsavedChanges ? 'dirty' : ''}`}
              onClick={onSaveProject}
              title={hasUnsavedChanges ? 'Save Project* (Ctrl+S)' : 'Save Project (Ctrl+S)'}
            >
              <SaveIcon size={15} />
              {hasUnsavedChanges && <span className="ct-dirty-dot" />}
            </button>
          )}

          {/* Auto-save indicator */}
          {showSaveIndicator && (
            <span className={`ct-autosave ${isAutoSaving ? 'saving' : 'saved'}`}>
              {isAutoSaving ? 'SAVING' : 'SAVED'}
            </span>
          )}
        </div>

        <span className="ct-divider" />

        {/* WAVE 2040.5b: Load Show (fixtures/stage) */}
        <div className="ct-show-group">
          <button
            className={`ct-show-btn ${showFile ? 'loaded' : 'empty'}`}
            onClick={handleLoadShow}
            disabled={isLoadingShow}
            title={showFile ? `Show: ${showFile.name} (${fixtureCount} fixtures) — Click to load different show` : 'Load Show File (.luxshow)'}
          >
            <UploadIcon size={14} />
            <span className="ct-show-label">
              {isLoadingShow ? 'LOADING' : showFile ? `${fixtureCount}F` : 'LOAD SHOW'}
            </span>
          </button>
        </div>

        {projectName && (
          <span className="ct-project-name" title={projectName}>
            {projectName.length > 18 ? projectName.slice(0, 15) + '\u2026' : projectName}
            {hasUnsavedChanges && ' \u2022'}
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * ZONE 2: TRANSPORT & TIME (Center)
       * [⏮] [⏹] [▶/⏸] [⏺] │ 00:00:00.000 │ BPM
       * ═══════════════════════════════════════════════════════════════ */}
      <div className="ct-zone ct-zone-center">

        <div className="ct-transport-group">
          <TransportButton
            icon={<RewindIcon size={14} />}
            label="Rewind to Start"
            onClick={onStop}
          />
          <TransportButton
            icon={<StopIcon size={14} />}
            label="Stop"
            onClick={onStop}
            variant="stop"
          />
          <TransportButton
            icon={isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            label={isPlaying ? 'Pause' : 'Play'}
            onClick={onPlay}
            active={isPlaying}
            variant="play"
          />
          <TransportButton
            icon={<RecordIcon size={14} />}
            label="Record Arm"
            onClick={onRecord}
            active={isRecording}
            variant="record"
          />
        </div>

        <div className="ct-timecode">
          <span className="ct-timecode-value">{formatTimecode(currentTime)}</span>
        </div>

        <div className="ct-bpm-group">
          <button className="ct-bpm-adj" onClick={handleBpmDecrease} title="Decrease BPM">{'\u2212'}</button>
          <div className="ct-bpm-display">
            <input
              type="number"
              className="ct-bpm-input"
              value={bpm}
              onChange={handleBpmInput}
              min={20}
              max={300}
            />
            <span className="ct-bpm-label">BPM</span>
          </div>
          <button className="ct-bpm-adj" onClick={handleBpmIncrease} title="Increase BPM">+</button>
        </div>

        {/* 🎹 WAVE 2045: MIDI Clock Source Toggle */}
        {onToggleMidiClock && (
          <button
            className={`ct-midi-btn ${midiClockSource === 'midi' ? 'active' : ''} signal-${midiSignalQuality}`}
            onClick={onToggleMidiClock}
            title={midiClockSource === 'midi' 
              ? `MIDI Clock: ${midiBpm > 0 ? `${midiBpm} BPM` : 'Waiting for signal...'} (Click to switch to Internal)`
              : 'Internal Clock (Click to enable MIDI Clock)'}
          >
            <MidiClockIcon size={13} />
            <span className="ct-midi-label">
              {midiClockSource === 'midi' ? 'MIDI' : 'INT'}
            </span>
            {midiClockSource === 'midi' && midiSignalQuality !== 'none' && (
              <span className={`ct-midi-signal signal-${midiSignalQuality}`} />
            )}
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       * ZONE 3: MODES & AUDIO (Right)
       * [Stage] [Quant] [Snap] │ [Load Audio]
       * ═══════════════════════════════════════════════════════════════ */}
      <div className="ct-zone ct-zone-right">

        <div className="ct-modes-group">
          {onToggleStage && (
            <button
              className={`ct-mode-btn ${stageVisible ? 'active' : ''}`}
              onClick={onToggleStage}
              title={stageVisible ? 'Hide Stage Preview' : 'Show Stage Preview'}
            >
              <MonitorIcon size={13} />
              <span className="ct-mode-label">STAGE</span>
            </button>
          )}
          {onToggleQuantize && (
            <button
              className={`ct-mode-btn ${quantizeEnabled ? 'active' : ''}`}
              onClick={onToggleQuantize}
              title={quantizeEnabled ? 'Quantize Recording: ON (beat-locked)' : 'Quantize Recording: OFF (human feel)'}
            >
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>⊞</span>
              <span className="ct-mode-label">QUANT</span>
            </button>
          )}
          {onToggleSnap && (
            <button
              className={`ct-mode-btn ${snapEnabled ? 'active' : ''}`}
              onClick={onToggleSnap}
              title={snapEnabled ? 'Snap to Beats: ON' : 'Snap to Beats: OFF'}
            >
              <MagnetIcon size={13} />
              <span className="ct-mode-label">SNAP</span>
            </button>
          )}
          {/* 🎛️ WAVE 2046.2: Live Rack toggle */}
          {onToggleLiveControls && (
            <button
              className={`ct-mode-btn ${showLiveControls ? 'active' : ''}`}
              onClick={onToggleLiveControls}
              title={showLiveControls ? 'Hide Live Rack' : 'Show Live Rack (fixture controls)'}
            >
              <span style={{ fontSize: '13px' }}>🎛️</span>
              <span className="ct-mode-label">RACK</span>
            </button>
          )}
        </div>

        <span className="ct-divider" />

        {/* 🎤 WAVE 2045: Audio Source Toggle — FILE | LIVE */}
        {onToggleAudioSource && (
          <div className="ct-source-group">
            <button
              className={`ct-source-btn ${audioSourceMode === 'live' ? 'live' : 'file'}`}
              onClick={onToggleAudioSource}
              title={audioSourceMode === 'file' 
                ? 'Source: FILE (Click for LIVE audio input)'
                : 'Source: LIVE (Click for FILE mode)'}
            >
              {audioSourceMode === 'live' ? (
                <>
                  <LiveSignalIcon size={13} />
                  <span className="ct-source-label">LIVE</span>
                  {isLiveActive && (
                    <span className="ct-source-level" style={{ width: `${liveLevel * 100}%` }} />
                  )}
                </>
              ) : (
                <>
                  <WaveformIcon size={13} />
                  <span className="ct-source-label">FILE</span>
                </>
              )}
            </button>
          </div>
        )}

        <span className="ct-divider" />

        {/* Audio */}
        <div className="ct-audio-group">
          {audioLoaded ? (
            <div className="ct-audio-loaded" title={audioFileName}>
              <WaveformIcon size={14} />
              <span className="ct-audio-name">
                {audioFileName && audioFileName.length > 20
                  ? audioFileName.slice(0, 17) + '\u2026'
                  : audioFileName}
              </span>
              <button className="ct-audio-close" onClick={onCloseAudio} title="Close audio file">{'\u2715'}</button>
            </div>
          ) : (
            <button className="ct-audio-load" onClick={onLoadAudio} title="Load Audio File">
              <WaveformIcon size={14} />
              <span className="ct-audio-label">LOAD AUDIO</span>
            </button>
          )}
        </div>

        <span className="ct-divider" />

        {/* ⚡ WAVE X-RAY: CPU Profiler button */}
        <button
          className={`ct-mode-btn ${isProfilerRunning ? 'active ct-profiler-running' : ''}`}
          onClick={handleStartProfiler}
          disabled={isProfilerRunning}
          title={isProfilerRunning ? 'Profiling… 15s (do not click)' : 'Start V8 CPU Profiler — 15s capture → lux-asesino.cpuprofile'}
          style={{ minWidth: 52 }}
        >
          <span style={{ fontSize: '13px' }}>{isProfilerRunning ? '🔴' : '🎯'}</span>
          <span className="ct-mode-label">{isProfilerRunning ? 'PROF…' : 'PROF'}</span>
        </button>

      </div>
    </div>
  )
})

TransportBar.displayName = 'TransportBar'
