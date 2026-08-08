/**
 * ══════════════════════════import { useChronosSession } from '../stores/sessionStore'
import { TimelineCanvas } from './timeline/TimelineCanvas'
// 🎬 WAVE 2040.1: THE CINEMA SIMULATOR (legacy StagePreview.tsx purged)
import { StagePreview } from './stage/StageSimulatorCinema'
// 🎹 WAVE 2009: Arsenal Dock (bottom) replaces Arsenal Panel (sidebar)════════════════════════════════════════════
 * ⏱️ CHRONOS LAYOUT - WAVE 2009: THE FULL SCREEN EXPERIENCE
 * Main container for Chronos Studio - Offline Timeline Editor
 * 
 * Layout Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    TRANSPORT BAR (fixed top)                            │
 * ├─────────────────────────────────────────────────────────┬───────────────┤
 * │                                                         │               │
 * │                 STAGE PREVIEW (30%)                     │   INSPECTOR   │
 * │                 [Mini Stage Simulator]                  │   (280px)     │
 * │                                                         │               │
 * ├─────────────────────────────────────────────────────────┤  Clip Props   │
 * │                                                         │               │
 * │                 TIMELINE CANVAS (70%)                   │               │
 * │                 [Tracks: Ruler | Waveform | Vibe | FX]  │               │
 * │                 🧲 Magnetic Snap to Beats               │               │
 * ├─────────────────────────────────────────────────────────┴───────────────┤
 * │                    ARSENAL DOCK (180px)                                 │
 * │          [🎺 🤖 🎸 🌊]  [ Effect Grid / Launchpad ]  [🔴 ARM]          │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * WAVE 2009: Full screen experience - No global CommandDeck, Zen Mode auto
 * 
 * @module chronos/ui/ChronosLayout
 * @version WAVE 2009
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { TransportBar } from './transport/TransportBar'
// WAVE 2017: THE SESSION KEEPER - State persistence across navigation
import { useChronosSession } from '../stores/sessionStore'
import { TimelineCanvas } from './timeline/TimelineCanvas'
// WAVE 2040.1: THE CINEMA SIMULATOR (replaces StagePreview)
import { StagePreview } from './stage/StageSimulatorCinema'
// WAVE 2009: Arsenal Dock (bottom) replaces Arsenal Panel (sidebar)
import { ArsenalDock } from './arsenal/ArsenalDock'
// WAVE 2007: Context Menu
import { ContextMenu, CLIP_MENU_ITEMS } from './context/ContextMenu'
// 🔧 WAVE 2040.32: ContextualDataSheet replaces ClipInspector
import { ContextualDataSheet } from './inspector/ContextualDataSheet'
// WAVE 2041: AudioWave icon for drag overlay
import { AudioWaveIcon } from '../../components/icons/LuxIcons'
// 👻 WAVE 2005.3: Use Phantom Worker for audio analysis (zero renderer memory)
import { useAudioLoaderPhantom } from '../hooks/useAudioLoaderPhantom'
// 🎵 WAVE 2005.4: Streaming playback (no RAM bloat)
import { useStreamingPlayback } from '../hooks/useStreamingPlayback'
// 🧲 WAVE 2006: Clips state management and auto-scroll
import { useTimelineClips } from '../hooks/useTimelineClips'
import { useAutoScroll } from '../hooks/useAutoScroll'
// ⌨️ WAVE 2007: Keyboard shortcuts
import { useTimelineKeyboard } from '../hooks/useTimelineKeyboard'
// 🎬 WAVE 2010: ChronosRecorder for live recording
import { getChronosRecorder, type RecordedClip } from '../core/ChronosRecorder'
// 🚀 WAVE 2013: ChronosStageDispatcher for Stage Simulator link
// P2.1 FIX: Migrated from legacy ChronosInjector.ts → ChronosStageDispatcher.ts
import { getChronosInjector, type StageCommand } from '../core/ChronosStageDispatcher'
// 💾 WAVE 2014: Project persistence (The Memory Core)
import { useChronosProject } from '../hooks/useChronosProject'
// 🧠 WAVE 2014.5: Store singleton for event subscriptions
import { getChronosStore } from '../core/ChronosStore'
import type { LuxTargetZone } from '../core/LuxFileV3'
// ⚡ WAVE 2015.5: ENGINE IGNITION - Control store for phantom mode
import { useControlStore, type LivingPaletteId } from '../../stores/controlStore'
import { useOverrideStore } from '../../stores/overrideStore'
import type { ChronosProjectV3 } from '../core/LuxFileV3'
import { createEmptyChronosProjectV3 } from '../core/LuxFileV3.factories'
import type { AnalysisData } from '../core/types'
import type { DragPayload, TimelineClip, FXClip } from '../core/TimelineClip'
import { toVibeType, extractVisualKeyframes, createHephFXClip } from '../core/TimelineClip'
import type { HephAutomationClipV3 } from '../../core/hephaestus/types'
// 🔧 WAVE 2044: Navigation store for Hephaestus routing
import { useNavigationStore } from '../../stores/navigationStore'
// 🎵 WAVE 2044.5: BPM UNITY — Sync Chronos BPM to global audioStore
import { useAudioStore } from '../../stores/audioStore'
// 🎹 WAVE 2045: UMBILICAL CORD — External connectivity
import { useMIDIClock } from '../hooks/useMIDIClock'
import { useLiveAudioInput } from '../hooks/useLiveAudioInput'
import { useFreeRunClock } from '../hooks/useFreeRunClock'
// 🎛️ WAVE 2046.2: THE INJERTO — Live Rack (TheProgrammer adapted for Chronos)
import { ChronosLiveRack } from './rack/ChronosLiveRack'
import './ChronosLayout.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChronosLayoutProps {
  className?: string
}

// Context menu state
interface ContextMenuState {
  position: { x: number; y: number } | null
  clipId: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ChronosLayout: React.FC<ChronosLayoutProps> = ({ className = '' }) => {
  // 👻 WAVE 2005.3: Use Phantom Worker for audio analysis (zero renderer memory)
  const audioLoader = useAudioLoaderPhantom()
  
  // 🎵 WAVE 2005.4: Streaming playback (constant ~5MB RAM, no decode to memory)
  const streaming = useStreamingPlayback()
  
  // ⏰ WAVE 2045.2: Free Run Clock — infinite playback for LIVE mode
  const freeRunClock = useFreeRunClock()
  
  // 🎹 WAVE 2045: MIDI Clock — external BPM source
  const midiClock = useMIDIClock()
  
  // 🎤 WAVE 2045: Live Audio Input — microphone/line-in
  const liveAudio = useLiveAudioInput()
  
  // 🎚️ WAVE 2045: Audio source mode (file | live)
  const [audioSourceMode, setAudioSourceMode] = useState<'file' | 'live'>('file')
  
  // 🎛️ WAVE 2046.2: Live Rack visibility toggle
  const [showLiveControls, setShowLiveControls] = useState(false)
  
  // 💾 WAVE 2014: Project persistence (The Memory Core)
  const project = useChronosProject()
  
  // 🧠 WAVE 2017: THE SESSION KEEPER - State persistence across navigation
  const sessionStore = useChronosSession()
  const sessionRestoredRef = useRef(false)
  
  // 🔧 WAVE 2044: Navigation for Hephaestus routing (THE TIME BRIDGE)
  // � WAVE 2044.2: CHRONOS LOOP FIX — Individual selectors prevent infinite loop
  const setActiveTab = useNavigationStore(state => state.setActiveTab)
  const editInHephaestus = useNavigationStore(state => state.editInHephaestus)
  const editInHephaestusWithBpm = useNavigationStore(state => state.editInHephaestusWithBpm)  // WAVE 2044.5
  
  // 🔧 Skip updateFromSession for a brief window after loading a project (prevents flattening tracks)
  const skipSyncUntilRef = useRef(0)

  // 🧠 WAVE 2017 FIX: Use refs to keep track of current state for unmount cleanup
  // This avoids stale closures in the cleanup function
  const stateRef = useRef({
    audioResult: null as any,
    clips: [] as TimelineClip[],
    selectedIds: new Set<string>(),
    playheadMs: 0,
    bpm: 120,
    stageVisible: true,
  })
  
  // Transport state (recording is still local)
  const [isRecording, setIsRecording] = useState(false)
  const [bpm, setBpm] = useState(120)
  
  // 🎭 WAVE 2015.5: Stage visibility toggle
  const [stageVisible, setStageVisible] = useState(true)

  // 🎬 WAVE 2542: Top panel (Stage + Inspector) collapsible accordion
  const [isTopPanelOpen, setIsTopPanelOpen] = useState(true)
  const handleTopPanelToggle = useCallback(() => {
    setIsTopPanelOpen(prev => !prev)
  }, [])
  
  // 🧲 WAVE 2006: Clips state management (needs bpm/duration from above)
  const durationMs = audioLoader.result?.durationMs ?? 60000
  const clipState = useTimelineClips({ bpm, durationMs })
  
  // 🧲 WAVE 2006: Auto-scroll follows playhead when playing
  const [followEnabled, setFollowEnabled] = useState(true)
  
  // Drag state
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 🔍 WAVE 2007: Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    position: null,
    clipId: null,
  })
  
  // 🔍 WAVE 2007: Timeline focus state for keyboard shortcuts
  const [isTimelineFocused, setIsTimelineFocused] = useState(true)
  
  // 🔍 WAVE 2007: Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<TimelineClip[]>([])
  
  // 🔍 WAVE 2007: Get selected clip for inspector (only when single selection)
  const selectedClip = useMemo(() => {
    if (clipState.selectedIds.size !== 1) return null
    const clipId = Array.from(clipState.selectedIds)[0]
    return clipState.getClipById(clipId) ?? null
  }, [clipState.selectedIds, clipState.getClipById, clipState.clips])
  
  // 🎵 WAVE 2005.4: Connect streaming to audioLoader result
  // 🎵 WAVE 2019.7: Use blobUrl instead of audioPath
  // ⚒️ WAVE 2030.22e: Force reconnect on component mount and when audio loads
  useEffect(() => {
    if (audioLoader.result?.blobUrl && !audioLoader.isLoading) {
      console.log('[ChronosLayout] 🎵 Loading audio into streaming player:', audioLoader.result.blobUrl)
      streaming.loadAudio(audioLoader.result.blobUrl)
    }
  }, [audioLoader.result, audioLoader.isLoading]) // Trigger on result object change
  
  // Update BPM from analysis if available
  useEffect(() => {
    if (audioLoader.result?.analysisData?.beatGrid?.bpm) {
      setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm))
    }
  }, [audioLoader.result])
  
  // 🎵 WAVE 2044.5: BPM UNITY — Sync Chronos local BPM → audioStore (global)
  // This ensures Hephaestus always sees current BPM when navigating from Chronos
  // 🔧 WAVE 2205.3: Solo sincronizar cuando Chronos tiene audio real cargado.
  // Sin audio propio, el audioStore lo gestiona el SeleneTruth Audio Bridge (live BPM).
  // Evita la race condition: Chronos default 120 vs SeleneTruth sBPM real.
  useEffect(() => {
    if (!audioLoader.result) return  // Sin audio cargado → no machacar el live BPM
    useAudioStore.getState().updateMetrics({ bpm })
    console.log(`[ChronosLayout] 🎵 BPM synced to audioStore → ${bpm}`)
  }, [bpm, audioLoader.result])
  
  // 🧠 WAVE 2017: Sync audio to session store when loaded (for persistence)
  useEffect(() => {
    if (audioLoader.result?.realPath && sessionRestoredRef.current) {
      // Only save if we've already restored (don't overwrite during restore)
      sessionStore.saveSession({
        audioRealPath: audioLoader.result.realPath,
        audioFileName: audioLoader.result.fileName,
        audioDurationMs: audioLoader.result.durationMs,
        analysisData: audioLoader.result.analysisData,
      })
      console.log('[SessionKeeper] 🎵 Audio synced to session:', audioLoader.result.fileName)
    }
  }, [audioLoader.result])
  
  // 👻 WAVE 2540.4: THE PHANTOM BUFFER — Send heatmap to backend + embed analysis
  // When the GodEar Offline analysis completes:
  // 1. Send the energyHeatmap to TitanEngine for real-time band injection
  // 2. Embed the full AnalysisData as LuxAnalysisV3 into the project (FASE 4)
  useEffect(() => {
    const analysisData = audioLoader.result?.analysisData
    const heatmap = analysisData?.energyHeatmap
    console.log(`[ChronosLayout 👻] Heatmap useEffect fired: analysisData=${!!analysisData} heatmap=${!!heatmap} energyLen=${heatmap?.energy?.length ?? 0}`)
    if (heatmap) {
      const lux = (window as any).lux
      lux?.chronos?.loadHeatmap?.(heatmap)
        .then((r: any) => {
          if (r?.success) {
            console.log('[ChronosLayout 👻] PHANTOM BUFFER sent to backend')
          }
        })
        .catch((err: unknown) => {
          console.error('[ChronosLayout 👻] Failed to send heatmap:', err)
        })

      // 🔬 FASE 4: Embed analysis into the project for persistence
      if (analysisData) {
        const store = getChronosStore()
        store.setAnalysisData(analysisData)
        console.log('[ChronosLayout 🔬] Analysis embedded in project (FASE 4)')
      }
    }
    // NOTE: Do NOT clear heatmap when analysisData is null.
    // When loading a project with embedded analysis, loadFromPath(skipAnalysis=true)
    // sets analysisData=null, which would trigger this else branch and CLEAR the
    // heatmap that was just sent by the project-loaded handler (.then() callback).
    // The heatmap is cleared explicitly in handleCloseAudio instead.
  }, [audioLoader.result?.analysisData])
  
  // 🎵 WAVE 2005.4 + WAVE 2045.2: Transport controls
  // - FILE mode: use streaming.togglePlay()
  // - LIVE mode: use freeRunClock.start/pause
  const handlePlay = useCallback(() => {
    if (audioSourceMode === 'live') {
      // LIVE mode: Free Run Clock (infinite tape)
      if (freeRunClock.isRunning) {
        freeRunClock.pause()
        console.log('[ChronosLayout] ⏸️ LIVE paused')
      } else {
        if (freeRunClock.currentTimeMs > 0) {
          freeRunClock.resume()
          console.log('[ChronosLayout] ▶️ LIVE resumed')
        } else {
          freeRunClock.start()
          console.log('[ChronosLayout] ▶️ LIVE started')
        }
      }
    } else {
      // FILE mode: HTMLAudioElement streaming
      streaming.togglePlay()
      console.log('[ChronosLayout] ▶️ FILE play toggled')
    }
  }, [audioSourceMode, streaming, freeRunClock])
  
  const handleStop = useCallback(() => {
    if (audioSourceMode === 'live') {
      // LIVE mode: stop free run clock and reset to 0
      freeRunClock.stop()
      console.log('[ChronosLayout] ⏹️ LIVE stopped')
    } else {
      // FILE mode: stop streaming playback
      streaming.stop()
      console.log('[ChronosLayout] ⏹️ FILE stopped')
    }
  }, [audioSourceMode, streaming, freeRunClock])
  
  // 🎹 WAVE 2045: MIDI Clock toggle
  const handleToggleMidiClock = useCallback(async () => {
    await midiClock.toggleSource()
  }, [midiClock])
  
  // 🎹 WAVE 2045: When MIDI clock provides BPM, override local BPM
  useEffect(() => {
    if (midiClock.source === 'midi' && midiClock.midiBpm > 0) {
      const roundedBpm = Math.round(midiClock.midiBpm)
      setBpm(roundedBpm)
      console.log(`[ChronosLayout] 🎹 MIDI Clock → BPM: ${roundedBpm}`)
    }
  }, [midiClock.source, midiClock.midiBpm])
  
  // 🎹 WAVE 2045: When MIDI sends Start/Stop, control transport
  useEffect(() => {
    if (midiClock.source !== 'midi') return
    
    if (midiClock.isExternalPlaying && !streaming.isPlaying) {
      streaming.play()
      console.log('[ChronosLayout] 🎹 MIDI START → Play')
    } else if (!midiClock.isExternalPlaying && streaming.isPlaying) {
      streaming.stop()
      console.log('[ChronosLayout] 🎹 MIDI STOP → Stop')
    }
  }, [midiClock.source, midiClock.isExternalPlaying, streaming])
  
  // 🎤 WAVE 2045: Toggle audio source mode (FILE ↔ LIVE)
  const handleToggleAudioSource = useCallback(async () => {
    if (audioSourceMode === 'file') {
      // Switch to LIVE
      console.log('[ChronosLayout] 🎤 Switching to LIVE audio mode')
      
      // Stop file playback
      streaming.stop()
      
      // Start live capture
      await liveAudio.start('microphone')
      
      setAudioSourceMode('live')
      console.log('[ChronosLayout] 🎤 LIVE mode ACTIVE')
    } else {
      // Switch to FILE
      console.log('[ChronosLayout] 📁 Switching to FILE audio mode')
      
      // Stop live capture
      liveAudio.stop()
      
      setAudioSourceMode('file')
      console.log('[ChronosLayout] 📁 FILE mode ACTIVE')
    }
  }, [audioSourceMode, streaming, liveAudio])
  
  // �️ WAVE 2046.2: Toggle Live Rack visibility
  const handleToggleLiveControls = useCallback(() => {
    setShowLiveControls(prev => !prev)
  }, [])
  
  // 🎛️ WAVE 2046.2: Derived — show rack when recording OR manually toggled
  const showRack = isRecording || showLiveControls
  
  // �🎬 WAVE 2010: Get recorder instance
  const recorder = useMemo(() => getChronosRecorder(), [])
  
  // 🧲 WAVE 2040.10: Quantize state (read from recorder, toggle via UI)
  const [quantizeEnabled, setQuantizeEnabled] = useState(recorder.quantizeEnabled)
  
  // 🚀 WAVE 2013: Get injector instance for Stage Simulator link
  const injector = useMemo(() => getChronosInjector(), [])
  
  // 🎬 WAVE 2010: Sync recorder with BPM changes
  useEffect(() => {
    recorder.setBpm(bpm)
  }, [bpm, recorder])
  
  // 🧲 WAVE 2040.10: Toggle quantize
  const handleToggleQuantize = useCallback(() => {
    const newState = !quantizeEnabled
    recorder.setQuantize(newState)
    setQuantizeEnabled(newState)
    console.log(`🧲 [ChronosLayout] Quantize: ${newState ? 'ON' : 'OFF'}`)
  }, [quantizeEnabled, recorder])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ P2.8 FIX: UNIFIED RAF LOOP — Consolidates 3 independent rAF loops into 1
  //
  // Previously, 3 separate requestAnimationFrame loops ran in parallel:
  //   1. Recorder tick (during recording)
  //   2. Injector tick (during playback, non-recording)
  //   3. Playhead sync (during streaming playback)
  //
  // Each loop triggered its own rAF reschedule, causing 3x the GC pressure
  // and 3x the callback overhead per frame. Now a single rAF loop sequentially
  // calls all three tick functions per frame.
  //
  // Mutable state is held in refs so the effect doesn't teardown/rebuild
  // the rAF loop on every state change (P2.9 fix).
  // ═══════════════════════════════════════════════════════════════════════════

  // P2.9 FIX: Refs to hold latest mutable state without re-subscribing listeners
  const isRecordingRef = useRef(isRecording)
  const isPlayingRef = useRef(false)
  const audioSourceModeRef = useRef(audioSourceMode)
  const timeRefHolder = useRef<{ current: number } | null>(null)
  const clipsRef = useRef(clipState.clips)
  const recorderRef = useRef(recorder)
  const injectorRef = useRef(injector)
  const streamingAudioRef = useRef(streaming.audioRef)
  const streamingCurrentTimeMsRef = useRef(streaming.currentTimeMs)

  // Keep refs in sync with state on every render (cheap, no effect needed)
  isRecordingRef.current = isRecording
  audioSourceModeRef.current = audioSourceMode
  clipsRef.current = clipState.clips
  recorderRef.current = recorder
  injectorRef.current = injector
  streamingAudioRef.current = streaming.audioRef
  streamingCurrentTimeMsRef.current = streaming.currentTimeMs

  // Compute isPlaying and timeRef from current state
  const isLive = audioSourceMode === 'live'
  const isPlaying = isLive ? freeRunClock.isRunning : streaming.isPlaying
  const currentTimeRef = isLive ? freeRunClock.currentTimeMsRef : streaming.currentTimeMsRef
  isPlayingRef.current = isPlaying
  timeRefHolder.current = currentTimeRef ?? null

  // Single unified rAF loop — only re-subscribes when isPlaying changes
  useEffect(() => {
    if (!isPlaying) return

    const lux = (window as any).lux
    let rafId = 0

    const unifiedTick = () => {
      const timeRef = timeRefHolder.current
      const recording = isRecordingRef.current

      // 1. Recorder tick (only during recording)
      if (recording && timeRef) {
        recorderRef.current.updatePlayhead(timeRef.current)
      }

      // 2. Injector tick (only during playback, NOT during recording)
      // OPERATION STARDUST (R2): Pre-filter active clips here so the dispatcher
      // receives only active clips (O(log n) via index, not O(n) inside tick).
      if (!recording && timeRef) {
        const t = timeRef.current
        const activeClips = clipsRef.current.filter(c => t >= c.startMs && t < c.endMs)
        injectorRef.current.tick(activeClips, t)
      }

      // 3. Playhead sync (during streaming playback)
      if (lux?.chronos?.syncPlayhead) {
        const audio = streamingAudioRef.current?.current
        if (audio && !audio.paused) {
          lux.chronos.syncPlayhead(audio.currentTime * 1000, true)
        }
      }

      rafId = requestAnimationFrame(unifiedTick)
    }

    rafId = requestAnimationFrame(unifiedTick)

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [isPlaying]) // Only re-run when play/pause state changes

  // ⚡ WAVE 2540.6: One final sync when paused to deactivate phantom
  useEffect(() => {
    if (streaming.isPlaying) return
    const lux = (window as any).lux
    if (!lux?.chronos?.syncPlayhead) return
    lux.chronos.syncPlayhead(streaming.currentTimeMs, false)
  }, [streaming.isPlaying, streaming.currentTimeMs])
  
  // 🚀 WAVE 2013: Reset injector when playback stops or seeks
  useEffect(() => {
    if (!streaming.isPlaying) {
      injector.reset()
    }
  }, [streaming.isPlaying, injector])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 2019: THE PULSE - Connect ChronosInjector to Stage via IPC
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Import and wire the bridge on mount/unmount
  useEffect(() => {
    let disconnectFn: (() => void) | undefined
    
    // Dynamic import to avoid circular dependencies
    import('../bridge/ChronosIPCBridge').then((bridge) => {
      bridge.connectChronosToStage()
      disconnectFn = bridge.disconnectChronosFromStage
      console.log('[ChronosLayout] 🎯 WAVE 2019: IPC Bridge connected!')
    }).catch((err) => {
      console.error('[ChronosLayout] ❌ Failed to connect IPC Bridge:', err)
    })
    
    return () => {
      if (disconnectFn) {
        disconnectFn()
        console.log('[ChronosLayout] 🎯 WAVE 2019: IPC Bridge disconnected')
      }
    }
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ⚒️ WAVE 2044: HOT-RELOAD — Listen for Hephaestus clip saves
  // When a clip is saved in Hephaestus, update any FXClip in the timeline
  // whose hephClip.id matches. Re-embeds the Diamond Data in-place.
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleHephClipSaved = (e: Event) => {
      const { clipId, clip: updatedClipSerialized } = (e as CustomEvent<{
        clipId: string
        clip: HephAutomationClipV3
      }>).detail
      
      console.log(`[ChronosLayout] ⚒️ HOT-RELOAD: Received heph-clip-saved → ${clipId}`)
      
      // Find all FXClips that reference this heph clip
      let updatedCount = 0
      for (const timelineClip of clipState.clips) {
        if (timelineClip.type !== 'fx') continue
        const fxClip = timelineClip as FXClip
        
        // Match by hephClip.id (primary) or by hephFilePath containing the name
        const isMatch = fxClip.hephClip?.id === clipId
        
        if (isMatch) {
          // Re-embed the updated Diamond Data
          const clipDurationMs = fxClip.endMs - fxClip.startMs
          clipState.updateClip(fxClip.id, {
            hephClip: updatedClipSerialized,
            keyframes: extractVisualKeyframes(updatedClipSerialized, clipDurationMs),
            label: updatedClipSerialized.name || fxClip.label,
          })
          updatedCount++
        }
      }
      
      if (updatedCount > 0) {
        console.log(`[ChronosLayout] ⚒️ HOT-RELOAD: Updated ${updatedCount} clip(s) with fresh Diamond Data`)
      }
    }
    
    window.addEventListener('luxsync:heph-clip-saved', handleHephClipSaved)
    return () => window.removeEventListener('luxsync:heph-clip-saved', handleHephClipSaved)
  }, [clipState])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 2017: THE SESSION KEEPER - Restore & Save Logic
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🧠 RESTORE: On mount, check if there's a saved session and restore it
  useEffect(() => {
    if (sessionRestoredRef.current) return // Only restore once
    
    const hasSession = sessionStore.hasSession()
    if (!hasSession) {
      console.log('[SessionKeeper] 📭 No saved session found')
      sessionRestoredRef.current = true
      return
    }
    
    const session = sessionStore
    console.log('[SessionKeeper] 🔄 Restoring session:', {
      audioPath: session.audioRealPath,
      clipCount: session.clips.length,
      playhead: session.playheadMs,
    })
    
    // Restore BPM and stage visibility first (synchronous)
    setBpm(session.bpm)
    setStageVisible(session.stageVisible)
    
    // Restore clips
    if (session.clips.length > 0) {
      clipState.setClips(session.clips)
      console.log(`[SessionKeeper] 📋 Restored ${session.clips.length} clips`)
    }
    
    // Restore audio (asynchronous - auto-load from path)
    // ⚒️ WAVE 2030.22b: Use loadFromPath() instead of fetch() to avoid CORS issues
    if (session.audioRealPath) {
      console.log('[SessionKeeper] 🎵 Restoring audio from:', session.audioRealPath)
      
      // audioLoader.loadFromPath() handles file reading via IPC directly
      audioLoader.loadFromPath(session.audioRealPath)
        .then((result) => {
          if (result) {
            console.log('[SessionKeeper] ✅ Audio restored successfully')
            // Seek to saved playhead position after audio loads
            if (session.playheadMs > 0) {
              streaming.seek(session.playheadMs)
            }
          } else {
            console.warn('[SessionKeeper] ⚠️ Failed to restore audio')
          }
        })
        .catch((err) => {
          console.error('[SessionKeeper] ❌ Error restoring audio:', err)
        })
    }
    
    sessionRestoredRef.current = true
  }, []) // Empty deps - run only on mount
  
  // 🧠 SAVE: On unmount, save the current session
  // Using ref to avoid stale closures - cleanup always has latest values
  useEffect(() => {
    // Keep ref in sync with current state
    stateRef.current = {
      audioResult: audioLoader.result,
      clips: clipState.clips,
      selectedIds: clipState.selectedIds,
      playheadMs: streaming.currentTimeMs,
      bpm,
      stageVisible,
    }
  })
  
  // Actual unmount cleanup - only runs once when component truly unmounts
  useEffect(() => {
    return () => {
      // Save session when leaving Chronos
      const state = stateRef.current
      console.log('[SessionKeeper] 💾 Saving session on unmount', {
        audioPath: state.audioResult?.realPath,
        clipCount: state.clips.length,
        playhead: state.playheadMs,
      })
      
      sessionStore.saveSession({
        // Audio
        audioRealPath: state.audioResult?.realPath || null,
        audioFileName: state.audioResult?.fileName || null,
        audioDurationMs: state.audioResult?.durationMs || 60000,
        analysisData: state.audioResult?.analysisData || null,
        
        // Timeline
        clips: state.clips,
        playheadMs: state.playheadMs,
        bpm: state.bpm,
        
        // Meta
        isDirty: state.clips.length > 0 || state.audioResult !== null,
        stageVisible: state.stageVisible,
        selectedClipIds: Array.from(state.selectedIds),
      })
    }
  }, []) // Empty deps - only run cleanup on true unmount
  
  // 🧠 PERIODIC SYNC: Keep session store in sync with clips changes
  useEffect(() => {
    if (clipState.clips.length > 0) {
      sessionStore.updateClips(clipState.clips)
    }
  }, [clipState.clips])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2017: PROJECT LAZARUS - Auto-Save System
  // ═══════════════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    // Start auto-save when Chronos mounts
    const store = getChronosStore()
    store.startAutoSave(60000) // Every 60 seconds
    
    console.log('[ProjectLazarus] 🛡️ Auto-save started (60s interval)')
    
    return () => {
      // P1.9 FIX: Dispose store — stops auto-save interval AND clears listeners
      store.dispose()
      // P2.17 FIX: Dispose the stage dispatcher — clears listener references
      injector.dispose()
      console.log('[ProjectLazarus] 🛡️ Auto-save stopped + store + dispatcher disposed')
    }
  }, [])
  
  // ⚡ WAVE 2015.5: ENGINE IGNITION - Phantom Mode
  // Connect ChronosInjector commands to controlStore for Stage Preview rendering
  // This enables "visual-only" playback without DMX output
  const setPalette = useControlStore(state => state.setPalette)
  const setGlobalIntensity = useControlStore(state => state.setGlobalIntensity)
  
  useEffect(() => {
    // Subscribe to stage commands from ChronosInjector
    const unsubscribe = injector.subscribe((command: StageCommand) => {
      switch (command.type) {
        case 'vibe-change':
          // Map vibe effectId to palette (vibes ARE palettes in LuxSync)
          // Common vibes: fuego, ocean, neon, sunset, midnight, aurora, etc.
          const paletteId = command.effectId as LivingPaletteId
          console.log(`[ChronosLayout] ⚡ ENGINE IGNITION: Palette → ${paletteId}`)
          setPalette(paletteId)
          break
          
        case 'intensity-change':
          if (command.intensity !== undefined) {
            setGlobalIntensity(command.intensity)
          }
          break
          
        case 'fx-trigger':
          // FX effects are handled by the effect system, not palette changes
          // In phantom mode, we could flash the stage or apply temporary overrides
          console.log(`[ChronosLayout] ⚡ ENGINE IGNITION: FX → ${command.effectId}`)
          break
          
        case 'fx-stop':
          // Effect ended
          break
      }
    })
    
    return unsubscribe
  }, [injector, setPalette, setGlobalIntensity])
  
  // 💾 WAVE 2014: Sync clips to project store for persistence
  // 🎵 WAVE 2019.7: Use realPath for filesystem persistence
  useEffect(() => {
    if (Date.now() < skipSyncUntilRef.current) {
      return
    }
    const audio = audioLoader.result ? {
      name: audioLoader.result.fileName,
      path: audioLoader.result.realPath || audioLoader.result.blobUrl, // Prefer realPath for save
      bpm,
      durationMs: audioLoader.result.durationMs,
    } : null
    
    project.updateFromSession(clipState.clips, audio, streaming.currentTimeMs)
  }, [clipState.clips, audioLoader.result, bpm, project])
  
  // 💾 WAVE 2014: Mark project dirty on any clip operation
  useEffect(() => {
    if (clipState.clips.length > 0) {
      project.markDirty()
    }
  }, [clipState.clips, project])
  
  // 🧠 WAVE 2014.5: THE SYNAPSE - Wire store events to UI
  useEffect(() => {
    const store = getChronosStore()
    
    // 👂 LOAD: Inject data into UI when project is loaded
    const handleProjectLoaded = (data: { project: ChronosProjectV3; path: string }) => {
      console.log('[ChronosLayout] 📂 Project loaded, syncing UI...')

      // Prevent updateFromSession from flattening tracks for 500ms after load
      skipSyncUntilRef.current = Date.now() + 500

      // Restore clips from loaded project
      clipState.setClips(data.project.tracks.flatMap(t => t.clips) as TimelineClip[])

      // Restore audio if path exists and is valid
      const audioInfo = data.project.audio
      let audioPath = audioInfo?.relativePath ?? ''
      
      // If relativePath is empty but fileName exists, try resolving from .lux directory
      if (!audioPath && audioInfo?.fileName && data.path) {
        const lastSlash = Math.max(data.path.lastIndexOf('\\'), data.path.lastIndexOf('/'))
        const luxDir = lastSlash >= 0 ? data.path.substring(0, lastSlash) : ''
        const candidate = luxDir ? `${luxDir}\\${audioInfo.fileName}` : audioInfo.fileName
        audioPath = candidate
        console.log(`[ChronosLayout] 🔍 Resolved audio from .lux dir: ${candidate}`)
      }

      console.log(`[ChronosLayout] 🔍 Audio check: audio=${!!audioInfo} relativePath=${audioInfo?.relativePath ?? 'N/A'} resolvedPath=${audioPath || 'N/A'}`)
      
      if (audioPath && !audioPath.startsWith('blob:')) {
        console.log('[ChronosLayout] 🎵 Loading audio:', audioPath)

        // 🔬 FASE 4: If the project has embedded analysis, use it directly.
        // Skip re-analysis by loading audio without triggering phantom analysis.
        // The heatmap is sent to TitanEngine from the embedded LuxAnalysisV3.
        if (data.project.analysis) {
          console.log('[ChronosLayout] 🔬 Embedded analysis found — using cached data (no re-analysis)')
          setBpm(audioInfo!.detectedBpm)

          // Load audio for playback only (skip analysis — we have it embedded)
          audioLoader.loadFromPath(audioPath, true).then(() => {
            // After audio loads, inject the embedded heatmap into TitanEngine
            const embeddedHeatmap = data.project.analysis?.heatmap
            console.log(`[ChronosLayout 👻] Embedded heatmap check: analysis=${!!data.project.analysis} heatmap=${!!embeddedHeatmap} energyLen=${embeddedHeatmap?.energy?.length ?? 0}`)
            if (embeddedHeatmap) {
              const lux = (window as any).lux
              lux?.chronos?.loadHeatmap?.(embeddedHeatmap)
                .then((r: any) => {
                  if (r?.success) {
                    console.log('[ChronosLayout 👻] Embedded PHANTOM BUFFER sent to backend')
                  }
                })
                .catch((err: unknown) => {
                  console.error('[ChronosLayout 👻] Failed to send embedded heatmap:', err)
                })
            }
          })
        } else {
          // No embedded analysis — load audio and trigger phantom analysis
          console.log('[ChronosLayout] 🔬 No embedded analysis — will analyze on load')
          audioLoader.loadFromPath(audioPath)
          setBpm(audioInfo!.detectedBpm)
        }
      } else if (data.project.analysis?.heatmap) {
        // No audio path but we have embedded heatmap — inject it anyway for vibe rendering
        console.log('[ChronosLayout] 🔬 No audio path but embedded heatmap found — injecting for vibe rendering')
        const embeddedHeatmap = data.project.analysis.heatmap
        const lux = (window as any).lux
        lux?.chronos?.loadHeatmap?.(embeddedHeatmap)
          .then((r: any) => {
            if (r?.success) {
              console.log('[ChronosLayout 👻] Embedded PHANTOM BUFFER sent to backend (no audio)')
            }
          })
          .catch((err: unknown) => {
            console.error('[ChronosLayout 👻] Failed to send embedded heatmap:', err)
          })
        if (audioInfo) {
          setBpm(audioInfo.detectedBpm)
        }
      }
    }
    
    // ✨ NEW: Full cleanup when creating new project
    const handleProjectNew = () => {
      console.log('[ChronosLayout] 🆕 New project, resetting UI...')
      
      // Prevent updateFromSession from firing for 500ms after new project
      skipSyncUntilRef.current = Date.now() + 500

      // Reset unified store with a fresh empty project
      getChronosStore().loadProject(createEmptyChronosProjectV3())
      
      // Clear all clips
      clipState.setClips([])
      
      // Reset audio (stop streaming, clear loader)
      streaming.stop()
      audioLoader.reset()
      
      // Reset BPM to default
      setBpm(120)
      
      // Stop recording if active
      if (isRecording) {
        setIsRecording(false)
        recorder.stopRecording()
      }
    }
    
    store.on('project-loaded', handleProjectLoaded)
    store.on('project-new', handleProjectNew)
    
    return () => {
      store.off('project-loaded', handleProjectLoaded)
      store.off('project-new', handleProjectNew)
    }
  }, [clipState, audioLoader, streaming, isRecording, recorder])
  
  // 🎬 WAVE 2010: Subscribe to recorded clips and add them to timeline
  useEffect(() => {
    const handleClipRecorded = (data: { clip: RecordedClip }) => {
      const clip = data.clip
      console.log(`[ChronosLayout] Recorded clip received:`, clip.displayName, `(${clip.clipType})`)

      // ── WAVE 7107-A.2: DAW TAKE LANE HEURISTIC ──────────────────────
      // a) 'all' → primaryZone = 'global'
      // b) Anchor: first zone in array
      // c) Filter tracks matching primaryZone
      // d) Find first track without collision (Take Lane)
      // e) Auto-create new track if all existing tracks collide
      // f) Assign clip to found or created track
      const store = getChronosStore()
      const zones = clip.zones ?? []
      const isAllZone = zones.includes('all') || zones.length === 0
      const primaryZone: LuxTargetZone = isAllZone ? 'global' : ((zones[0] || 'global') as LuxTargetZone)

      const newStart = clip.startMs
      const newEnd = clip.startMs + clip.durationMs

      // c) Find all tracks for this primaryZone (excluding locked tracks, except global)
      const candidateTracks = store.tracks.filter(t =>
        t.targetZone === primaryZone && (!t.locked || primaryZone === 'global')
      )

      // d) Iterate candidate tracks — find first without collision
      // P2.9 FIX: Use clipsRef.current instead of clipState.clips so the
      // handler always sees the latest clips without the effect needing
      // to re-subscribe on every clip change.
      let resolvedTrackId: string | null = null
      for (const track of candidateTracks) {
        const existingClips = clipsRef.current.filter(c => c.trackId === track.id)
        const hasCollision = existingClips.some(c =>
          newStart < c.endMs && newEnd > c.startMs
        )
        if (!hasCollision) {
          resolvedTrackId = track.id
          console.log(`[ChronosLayout] WAVE 7107-A.2: Routed to existing track "${track.visualLabel}" (${primaryZone})`)
          break
        }
      }

      // e) Auto-create new track if all candidate tracks have collision
      //    P2.11 FIX: Removed hardcoded cap of 2. Now allows up to MAX_TAKE_LANES (8)
      //    tracks per energy zone, so users can stack multiple clips in the same zone.
      //    If all 8 lanes collide → fall back to GLOBAL.
      const MAX_TAKE_LANES = 8
      if (!resolvedTrackId) {
        if (primaryZone === 'global') {
          // GLOBAL track is locked and singleton — just use it even if colliding
          const globalTrack = store.tracks.find(t => t.targetZone === 'global')
          resolvedTrackId = globalTrack?.id ?? 'global'
          console.log(`[ChronosLayout] WAVE 7108: GLOBAL fallback (collision accepted)`)
        } else if (candidateTracks.length < MAX_TAKE_LANES) {
          // Create a new take lane (up to MAX_TAKE_LANES)
          const newTrack = store.addTrack(primaryZone)
          resolvedTrackId = newTrack.id
          console.log(`[ChronosLayout] WAVE 7108: Auto-created track "${newTrack.visualLabel}" for ${primaryZone} (Take Lane ${candidateTracks.length + 1}/${MAX_TAKE_LANES})`)
        } else {
          // All MAX_TAKE_LANES lanes collide → GLOBAL fallback
          const globalTrack = store.tracks.find(t => t.targetZone === 'global')
          resolvedTrackId = globalTrack?.id ?? 'global'
          console.log(`[ChronosLayout] WAVE 7108: Take Lane cap (${MAX_TAKE_LANES}) reached for ${primaryZone} → GLOBAL fallback`)
        }
      }

      if (clip.clipType === 'fx') {
        // ⬡ FASE 6: FX clip — create FXClip with embedded Diamond Data
        const timelineClip: FXClip = createHephFXClip(
          clip.displayName,
          clip.hephFilePath ?? '',
          clip.startMs,
          clip.durationMs,
          resolvedTrackId,
          clip.hephClip?.effectType ?? 'heph-custom',
          clip.hephClip,
          clip.zones,
          clip.priority,
        )
        clipState.addClip(timelineClip as unknown as TimelineClip)
      } else {
        // 🎭 Vibe clip — create VibeClip (existing path)
        const timelineClip: TimelineClip = {
          id: clip.id,
          type: 'vibe',
          label: clip.displayName,
          startMs: clip.startMs,
          endMs: clip.startMs + clip.durationMs,
          color: clip.color || '#FF6B35',
          trackId: resolvedTrackId,
          locked: false,
          vibeType: toVibeType(clip.effectId),
          intensity: 1.0,
          fadeInMs: 500,
          fadeOutMs: 500,
        }
        clipState.addClip(timelineClip)
      }
    }
    
    // 🎹 WAVE 2012: Handle clip updates (Latch Mode duration changes)
    const handleClipUpdated = (data: { clip: RecordedClip }) => {
      const clip = data.clip
      console.log(`[ChronosLayout] 🎹 Clip updated (LATCH):`, clip.displayName, `duration: ${clip.durationMs}ms`)
      
      // Update the clip's endMs based on new duration
      clipState.updateClip(clip.id, {
        endMs: clip.startMs + clip.durationMs,
      })
    }
    
    // 🎬 WAVE 2013: Handle real-time clip growth during recording
    const handleClipGrowing = (data: { clip: RecordedClip }) => {
      const clip = data.clip
      // Update the clip's endMs in real-time (no logging to avoid spam)
      clipState.updateClip(clip.id, {
        endMs: clip.startMs + clip.durationMs,
      })
    }
    
    recorder.on('clip-added', handleClipRecorded)
    recorder.on('clip-updated', handleClipUpdated)
    recorder.on('clip-growing', handleClipGrowing)

    return () => {
      recorder.off('clip-added', handleClipRecorded)
      recorder.off('clip-updated', handleClipUpdated)
      recorder.off('clip-growing', handleClipGrowing)
    }
    // P2.9 FIX: Use refs for clipState.clips so the effect doesn't
    // teardown/rebuild listeners on every clip change. clipsRef is
    // updated on every render (see P2.8 fix above), so the handlers
    // always see the latest clips without re-subscribing.
  }, [recorder, clipState, clipState.addClip, clipState.updateClip])
  
  // 🎬 WAVE 2010: Connect recording toggle to ChronosRecorder
  const handleRecord = useCallback(() => {
    const newState = !isRecording
    setIsRecording(newState)
    
    if (newState) {
      // Update playhead position before starting — use ref for real-time value
      const currentTime = audioSourceMode === 'live'
        ? freeRunClock.currentTimeMsRef.current
        : streaming.currentTimeMsRef.current
      recorder.updatePlayhead(currentTime)
      recorder.startRecording()
      console.log('[ChronosLayout] ⏺️ Recording STARTED at', currentTime, 'ms')
    } else {
      // Stop recording and get all recorded clips
      const recordedClips = recorder.stopRecording()
      console.log('[ChronosLayout] ⏹️ Recording STOPPED. Clips:', recordedClips.length)
    }
  }, [isRecording, recorder, audioSourceMode, streaming.currentTimeMsRef, freeRunClock.currentTimeMsRef])
  
  // 🎵 WAVE 2005.4: Seek uses streaming hook
  const handleSeek = useCallback((timeMs: number) => {
    streaming.seek(timeMs)
    console.log('[ChronosLayout] ⏭️ Seek to:', timeMs)
  }, [streaming])
  
  // ═══════════════════════════════════════════════════════════════════════
  // DRAG & DROP HANDLERS - WAVE 2005 (Audio Files only)
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Check if this is a clip drag - those are handled entirely by TimelineCanvas
    const isClipDrag = e.dataTransfer.types.includes('application/luxsync-vibe') ||
                       e.dataTransfer.types.includes('application/luxsync-fx')
    
    if (isClipDrag) {
      // DON'T prevent default here - let TimelineCanvas decide
      // This allows forbidden cursor to show on invalid drops
      return
    }
    
    // For file drops, show the audio overlay
    const hasFiles = e.dataTransfer.types.includes('Files')
    if (hasFiles) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }, [])
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    // Only handle file drops, not clip drops
    const isClipDrag = e.dataTransfer.types.includes('application/luxsync-vibe') ||
                       e.dataTransfer.types.includes('application/luxsync-fx')
    if (isClipDrag) return  // Let TimelineCanvas handle clip drops
    
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      console.log('[ChronosLayout] 📂 File dropped:', file.name)
      await audioLoader.loadFile(file)
    }
  }, [audioLoader])
  
  const handleLoadAudioClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])
  
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await audioLoader.loadFile(files[0])
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [audioLoader])
  
  // 👻 WAVE 2005.3 + 🎵 WAVE 2005.4: Close audio and reset both loaders
  const handleCloseAudio = useCallback(() => {
    console.log('[ChronosLayout] 🗑️ Closing audio file')
    streaming.unloadAudio()  // Stop streaming playback
    audioLoader.reset()      // Clear analysis data
    setBpm(120)              // Reset to default
    // Clear phantom heatmap from TitanEngine
    const lux = (window as any).lux
    lux?.chronos?.loadHeatmap?.(null)?.catch(() => {})
  }, [audioLoader, streaming])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2006: CLIP INTERACTION CALLBACKS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleClipSelect = useCallback((clipId: string, addToSelection: boolean) => {
    clipState.selectClip(clipId, addToSelection)
    console.log(`[ChronosLayout] 🎯 Clip selected: ${clipId}`)
  }, [clipState])
  
  const handleClipMove = useCallback((clipId: string, newStartMs: number) => {
    clipState.moveClip(clipId, newStartMs)
  }, [clipState])
  
  const handleClipResize = useCallback((clipId: string, edge: 'left' | 'right', newTimeMs: number) => {
    clipState.resizeClip(clipId, edge, newTimeMs)
  }, [clipState])
  
  const handleClipDrop = useCallback((payload: DragPayload, timeMs: number, trackId: string) => {
    const clip = clipState.createClipFromDrop(payload, timeMs, trackId)
    if (clip) {
      console.log(`[ChronosLayout] 🧲 Created ${clip.type} clip at ${(clip.startMs/1000).toFixed(2)}s on track ${trackId}`)
    }
  }, [clipState])
  
  const handleClipContextMenu = useCallback((clipId: string, event: React.MouseEvent) => {
    event.preventDefault()
    // Select the clip first
    clipState.selectClip(clipId, false)
    // Show context menu
    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      clipId,
    })
    console.log(`[ChronosLayout] 📋 Context menu for clip: ${clipId}`)
  }, [clipState])
  
  const handleFollowToggle = useCallback(() => {
    setFollowEnabled(prev => !prev)
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2007: INSPECTOR CALLBACKS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleUpdateClip = useCallback((clipId: string, updates: Partial<TimelineClip>) => {
    clipState.updateClip(clipId, updates)
  }, [clipState])
  
  const handleDeleteClip = useCallback((clipId: string) => {
    clipState.removeClip(clipId)
  }, [clipState])
  
  const handleDuplicateClip = useCallback((clipId: string) => {
    clipState.duplicateClip(clipId)
  }, [clipState])
  
  // ⚒️ WAVE 2044: THE HANDOFF — Navigate to Hephaestus with auto-load
  // 🎵 WAVE 2044.5: BPM UNITY — Pass current BPM to Hephaestus via navigationStore
  // Extracts the hephClip.id from the FXClip and passes it through navigationStore.
  // HephaestusView detects targetHephClipId on mount → auto-loads via IPC.
  const handleEditInHephaestus = useCallback((clipId: string) => {
    // Find the FXClip in clipState to extract heph data
    const fxClip = clipState.getClipById(clipId)
    
    if (fxClip && fxClip.type === 'fx') {
      // Priority: hephClip.id (UUID match) > hephFilePath (filename match)
      const hephId = fxClip.hephClip?.id || fxClip.hephFilePath
      
      if (hephId) {
        console.log(`[ChronosLayout] ⚒️ THE HANDOFF: Sending clip to Hephaestus → ${hephId}, BPM: ${bpm}`)
        clipState.deselectAll()
        editInHephaestusWithBpm(hephId, bpm)  // WAVE 2044.5: Pass BPM
        return
      }
    }
    
    // Fallback: legacy clip without heph data — just navigate
    console.log(`[ChronosLayout] ⚒️ Opening Hephaestus (no heph data for clip: ${clipId})`)
    clipState.deselectAll()
    setActiveTab('hephaestus')
  }, [clipState, setActiveTab, editInHephaestusWithBpm, bpm])  // WAVE 2044.5: Add bpm dependency
  
  // 🎯 WAVE 2044.3: SYNAPSE REPAIR — Double-click Heph clips to edit
  // RULE: Only works for fx clips with isHephCustom === true
  const handleDoubleClickHephClip = useCallback((clipId: string) => {
    const clip = clipState.getClipById(clipId)
    
    // GUARD: Only heph-created clips (fx + isHephCustom) support double-click edit
    if (clip?.type === 'fx' && clip.isHephCustom) {
      console.log(`[ChronosLayout] 🎯 Double-click → Opening Heph clip: ${clipId}`)
      handleEditInHephaestus(clipId)
    }
    // Else: ignore double-click (normal clips, vibe clips, etc.)
  }, [clipState, handleEditInHephaestus])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2007: CONTEXT MENU CALLBACKS
  // ═══════════════════════════════════════════════════════════════════════
  
  const handleContextMenuSelect = useCallback((action: string) => {
    const clipId = contextMenu.clipId
    if (!clipId) return
    
    switch (action) {
      case 'duplicate':
        clipState.duplicateClip(clipId)
        break
      case 'copy':
        const clip = clipState.getClipById(clipId)
        if (clip) setClipboard([{ ...clip }])
        break
      case 'paste':
        if (clipboard.length > 0) {
          clipState.pasteClips(clipboard, streaming.currentTimeMs)
        }
        break
      case 'split':
        clipState.splitClipAtTime(clipId, streaming.currentTimeMs)
        break
      case 'delete':
        clipState.removeClip(clipId)
        break
      case 'lock':
        const toToggle = clipState.getClipById(clipId)
        if (toToggle) {
          clipState.updateClip(clipId, { locked: !toToggle.locked })
        }
        break
      case 'rename':
        // Rename via inspector - clip is already selected
        break
    }
    
    setContextMenu({ position: null, clipId: null })
  }, [contextMenu.clipId, clipState, clipboard, streaming.currentTimeMs])
  
  const handleContextMenuClose = useCallback(() => {
    setContextMenu({ position: null, clipId: null })
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2007: KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════
  
  useTimelineKeyboard({
    selectedIds: clipState.selectedIds,
    clips: clipState.clips,
    currentTimeMs: streaming.currentTimeMs,
    isFocused: isTimelineFocused,
    onDeleteSelected: clipState.deleteSelected,
    onDuplicateSelected: clipState.duplicateSelected,
    onCopy: (clips) => setClipboard(clips.map(c => ({ ...c }))),
    onPaste: (timeMs) => {
      if (clipboard.length > 0) {
        clipState.pasteClips(clipboard, timeMs)
      }
    },
    onSelectAll: clipState.selectAll,
    onDeselectAll: clipState.deselectAll,
    onPlayPause: streaming.togglePlay,
    onSplitAtPlayhead: () => {
      // Split all selected clips at playhead
      clipState.selectedIds.forEach(id => {
        clipState.splitClipAtTime(id, streaming.currentTimeMs)
      })
    },
  })
  
  // Click on background deselects
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only if clicking directly on the layout (not a child)
    if (e.target === e.currentTarget) {
      clipState.deselectAll()
    }
  }, [clipState])

  return (
    <div 
      className={`chronos-layout ${className} ${isDragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.webm,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
       * 🎛️ WAVE 2040.4: THE MASTER TOOLBAR
       * Engine Status fused into TransportBar — single unified cockpit
       * ═══════════════════════════════════════════════════════════════════ */}
      <TransportBar
        isPlaying={audioSourceMode === 'live' ? freeRunClock.isRunning : streaming.isPlaying}
        isRecording={isRecording}
        currentTime={audioSourceMode === 'live' ? freeRunClock.currentTimeMs : streaming.currentTimeMs}
        currentTimeRef={audioSourceMode === 'live' ? freeRunClock.currentTimeMsRef : streaming.currentTimeMsRef}
        bpm={bpm}
        onPlay={handlePlay}
        onStop={handleStop}
        onRecord={handleRecord}
        onBpmChange={setBpm}
        audioLoaded={!!audioLoader.result}
        audioFileName={audioLoader.result?.fileName}
        onLoadAudio={handleLoadAudioClick}
        onCloseAudio={handleCloseAudio}
        // 💾 WAVE 2014: Project persistence
        projectName={project.projectName}
        hasUnsavedChanges={project.hasUnsavedChanges}
        onSaveProject={project.save}
        onLoadProject={project.load}
        onNewProject={project.newProject}
        // 🎭 WAVE 2015.5: Stage visibility toggle
        stageVisible={stageVisible}
        onToggleStage={() => setStageVisible(v => !v)}
        // 🧲 WAVE 2040.5: Snap — single source of truth
        snapEnabled={clipState.snapEnabled}
        onToggleSnap={clipState.toggleSnap}
        // 🧲 WAVE 2040.10: Quantize — human feel vs beat-locked
        quantizeEnabled={quantizeEnabled}
        onToggleQuantize={handleToggleQuantize}
        // 🎹 WAVE 2045: MIDI Clock
        midiClockSource={midiClock.source}
        midiSignalQuality={midiClock.signalQuality}
        midiBpm={midiClock.midiBpm}
        onToggleMidiClock={handleToggleMidiClock}
        // 🎤 WAVE 2045: Audio Source
        audioSourceMode={audioSourceMode}
        isLiveActive={liveAudio.isActive}
        liveLevel={liveAudio.metrics.level}
        onToggleAudioSource={handleToggleAudioSource}
        // 🎛️ WAVE 2046.2: Live Rack toggle
        showLiveControls={showLiveControls}
        onToggleLiveControls={handleToggleLiveControls}
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
       * LOADING OVERLAY
       * ═══════════════════════════════════════════════════════════════════ */}
      {audioLoader.isLoading && (
        <div className="chronos-loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-phase">{audioLoader.phase.toUpperCase()}</div>
          <div className="loading-message">{audioLoader.message}</div>
          <div className="loading-progress-bar">
            <div 
              className="loading-progress-fill"
              style={{ width: `${audioLoader.progress}%` }}
            />
          </div>
          <div className="loading-percent">{audioLoader.progress}%</div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════
       * DRAG OVERLAY
       * ═══════════════════════════════════════════════════════════════════ */}
      {isDragOver && (
        <div className="chronos-drag-overlay">
          <div className="drag-icon"><AudioWaveIcon size={48} /></div>
          <div className="drag-text">DROP AUDIO FILE</div>
          <div className="drag-formats">MP3, WAV, OGG, FLAC, M4A</div>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════
       * MAIN CONTENT AREA
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="chronos-main" onClick={handleBackgroundClick}>
        {/* Left: Stage + Timeline Stack */}
        <div
          className={[
            'chronos-workspace',
            isTopPanelOpen ? 'chronos-workspace--panel-open' : 'chronos-workspace--panel-closed',
          ].join(' ')}
          onFocus={() => setIsTimelineFocused(true)}
          onBlur={() => setIsTimelineFocused(false)}
          tabIndex={0}
        >
          {/* Stage Preview — WAVE 2040.32: Grid Row 1 / WAVE 2542: colapsable / WAVE 7106: unmount when collapsed */}
          {isTopPanelOpen && <StagePreview visible={stageVisible} />}

          {/* ── WAVE 2542: Barra divisoria colapsable ────────────────── */}
          <button
            className="chronos-panel-toggle"
            onClick={handleTopPanelToggle}
            title={isTopPanelOpen ? 'Colapsar Stage' : 'Expandir Stage'}
            aria-label={isTopPanelOpen ? 'Colapsar panel superior' : 'Expandir panel superior'}
          >
            <span className="chronos-panel-toggle__line" />
            <span className="chronos-panel-toggle__arrow">
              {isTopPanelOpen ? '▲' : '▼'}
            </span>
            <span className="chronos-panel-toggle__line" />
          </button>

          {/* Timeline Canvas — WAVE 2040.32: Grid Row 2 (50%) */}
          <div className="chronos-timeline-wrapper chronos-timeline-wrapper--scrollable">
            <TimelineCanvas
              currentTime={audioSourceMode === 'live' ? freeRunClock.currentTimeMs : streaming.currentTimeMs}
              currentTimeRef={audioSourceMode === 'live' ? freeRunClock.currentTimeMsRef : streaming.currentTimeMsRef}
              bpm={bpm}
              isPlaying={audioSourceMode === 'live' ? freeRunClock.isRunning : streaming.isPlaying}
              onSeek={handleSeek}
              analysisData={audioLoader.result?.analysisData ?? null}
              durationMs={durationMs}
              // WAVE 2006: Clips & Interaction
              clips={clipState.clips}
              selectedClipIds={clipState.selectedIds}
              snapEnabled={clipState.snapEnabled}
              snapPosition={clipState.snapPosition}
              onClipSelect={handleClipSelect}
              onClipMove={handleClipMove}
              onClipResize={handleClipResize}
              onClipDrop={handleClipDrop}
              onClipContextMenu={handleClipContextMenu}
              onClipDoubleClick={handleDoubleClickHephClip}  // WAVE 2044.3
              onClipClone={clipState.cloneClip}             // ⚡ WAVE 2045.1.2: Alt+Drag clone
              // WAVE 2006: Auto-scroll
              followEnabled={followEnabled}
              onFollowToggle={handleFollowToggle}
              // WAVE 2013.6: THE ADRENALINE SHOT - Live growing clip
              isRecording={isRecording}
              growingClipId={isRecording ? recorder.activeVibeClipId : null}
              growingClipEndMs={isRecording ? recorder.activeVibeClipEndMs : null}
              // WAVE 2045.2: Audio source mode for live recording indicator
              audioSourceMode={audioSourceMode}
            />
            {/* 🔧 WAVE 2040.32/33/34 → 2046.2: ContextualDataSheet — only when rack is hidden */}
            {!showRack && (
              <ContextualDataSheet
                clip={selectedClip}
                onClose={clipState.deselectAll}
                onEditInHephaestus={handleEditInHephaestus}
              />
            )}
          </div>
        </div>
        
        {/* 🎛️ WAVE 2046.2: LIVE RACK — TheProgrammer adapted for Chronos */}
        {showRack && <ChronosLiveRack />}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * 🎹 WAVE 2009: ARSENAL DOCK (Bottom Panel - Launchpad Style)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="chronos-arsenal-dock-container">
        <ArsenalDock
          isRecording={isRecording}
          onRecordToggle={handleRecord}
        />
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════
       * WAVE 2007: CONTEXT MENU
       * ═══════════════════════════════════════════════════════════════════ */}
      <ContextMenu
        position={contextMenu.position}
        items={CLIP_MENU_ITEMS}
        onSelect={handleContextMenuSelect}
        onClose={handleContextMenuClose}
      />
    </div>
  )
}

export default ChronosLayout
