/**
 * ═══════════════════════════════════════════════════════════════════════════
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
// ⚡ WAVE 2016.5: Engine Status - Command Center in Chronos
import { EngineStatus } from './header/EngineStatus'
// 🧠 WAVE 2017: THE SESSION KEEPER - State persistence across navigation
import { useChronosSession } from '../stores/sessionStore'
import { TimelineCanvas } from './timeline/TimelineCanvas'
// � WAVE 2015: Stage Preview (real fixtures, optimized)
import { StagePreview } from './stage/StagePreview'
// �🎹 WAVE 2009: Arsenal Dock (bottom) replaces Arsenal Panel (sidebar)
import { ArsenalDock } from './arsenal/ArsenalDock'
// 🔍 WAVE 2007: Inspector and Context Menu
import { ClipInspector } from './inspector/ClipInspector'
import { ContextMenu, CLIP_MENU_ITEMS } from './context/ContextMenu'
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
// 🚀 WAVE 2013: ChronosInjector for Stage Simulator link
import { getChronosInjector, type StageCommand } from '../core/ChronosInjector'
// 💾 WAVE 2014: Project persistence (The Memory Core)
import { useChronosProject } from '../hooks/useChronosProject'
// 🧠 WAVE 2014.5: Store singleton for event subscriptions
import { getChronosStore } from '../core/ChronosStore'
// ⚡ WAVE 2015.5: ENGINE IGNITION - Control store for phantom mode
import { useControlStore, type LivingPaletteId } from '../../stores/controlStore'
import { useOverrideStore } from '../../stores/overrideStore'
import type { LuxProject } from '../core/ChronosProject'
import type { AnalysisData } from '../core/types'
import type { DragPayload, TimelineClip } from '../core/TimelineClip'
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
  
  // 💾 WAVE 2014: Project persistence (The Memory Core)
  const project = useChronosProject()
  
  // 🧠 WAVE 2017: THE SESSION KEEPER - State persistence across navigation
  const sessionStore = useChronosSession()
  const sessionRestoredRef = useRef(false)
  
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
  useEffect(() => {
    if (audioLoader.result?.audioPath) {
      console.log('[ChronosLayout] 🎵 Loading audio into streaming player')
      streaming.loadAudio(audioLoader.result.audioPath)
    }
  }, [audioLoader.result?.audioPath])
  
  // Update BPM from analysis if available
  useEffect(() => {
    if (audioLoader.result?.analysisData?.beatGrid?.bpm) {
      setBpm(Math.round(audioLoader.result.analysisData.beatGrid.bpm))
    }
  }, [audioLoader.result])
  
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
  
  // 🎵 WAVE 2005.4: Transport controls now use streaming hook
  const handlePlay = useCallback(() => {
    streaming.togglePlay()
    console.log('[ChronosLayout] ▶️ Play toggled')
  }, [streaming])
  
  const handleStop = useCallback(() => {
    streaming.stop()
    console.log('[ChronosLayout] ⏹️ Stop')
  }, [streaming])
  
  // 🎬 WAVE 2010: Get recorder instance
  const recorder = useMemo(() => getChronosRecorder(), [])
  
  // 🚀 WAVE 2013: Get injector instance for Stage Simulator link
  const injector = useMemo(() => getChronosInjector(), [])
  
  // 🎬 WAVE 2010: Sync recorder with BPM changes
  useEffect(() => {
    recorder.setBpm(bpm)
  }, [bpm, recorder])
  
  // 🎬 WAVE 2010: Sync playhead with recorder during playback
  useEffect(() => {
    if (streaming.isPlaying && isRecording) {
      recorder.updatePlayhead(streaming.currentTimeMs)
    }
  }, [streaming.currentTimeMs, streaming.isPlaying, isRecording, recorder])
  
  // 🚀 WAVE 2013: Tick the injector during playback (sends commands to Stage)
  useEffect(() => {
    if (streaming.isPlaying && !isRecording) {
      // Only inject during playback (not during recording)
      injector.tick(clipState.clips, streaming.currentTimeMs)
    }
  }, [streaming.currentTimeMs, streaming.isPlaying, isRecording, injector, clipState.clips])
  
  // 🚀 WAVE 2013: Reset injector when playback stops or seeks
  useEffect(() => {
    if (!streaming.isPlaying) {
      injector.reset()
    }
  }, [streaming.isPlaying, injector])
  
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
    if (session.audioRealPath) {
      console.log('[SessionKeeper] 🎵 Auto-loading audio from:', session.audioRealPath)
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
  useEffect(() => {
    const audio = audioLoader.result ? {
      name: audioLoader.result.fileName,
      path: audioLoader.result.audioPath,
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
    const handleProjectLoaded = (data: { project: LuxProject; path: string }) => {
      console.log('[ChronosLayout] 📂 Project loaded, syncing UI...')
      
      // Restore clips from loaded project
      clipState.setClips(data.project.timeline.clips)
      
      // Restore audio if path exists and is valid
      if (data.project.audio?.path && !data.project.audio.path.startsWith('blob:')) {
        console.log('[ChronosLayout] 🎵 Loading audio:', data.project.audio.path)
        audioLoader.loadFromPath(data.project.audio.path)
        setBpm(data.project.audio.bpm)
      }
    }
    
    // ✨ NEW: Full cleanup when creating new project
    const handleProjectNew = () => {
      console.log('[ChronosLayout] 🆕 New project, resetting UI...')
      
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
      console.log(`[ChronosLayout] 🎬 Recorded clip received:`, clip.displayName)
      
      // Build TimelineClip based on clip type
      let timelineClip: TimelineClip
      
      if (clip.clipType === 'vibe') {
        timelineClip = {
          id: clip.id,
          type: 'vibe',
          label: clip.displayName,
          startMs: clip.startMs,
          endMs: clip.startMs + clip.durationMs,
          color: clip.color || '#FF6B35',
          trackId: clip.trackId,
          locked: false,
          vibeType: clip.effectId as any,
          intensity: 1.0,
          fadeInMs: 500,
          fadeOutMs: 500,
        }
      } else {
        timelineClip = {
          id: clip.id,
          type: 'fx',
          label: clip.displayName,
          startMs: clip.startMs,
          endMs: clip.startMs + clip.durationMs,
          color: clip.color || '#00D9FF',
          trackId: clip.trackId,
          locked: false,
          fxType: clip.effectId as any,
          keyframes: [],
          params: { intensity: 1.0 },
        }
      }
      
      clipState.addClip(timelineClip)
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
  }, [recorder, clipState])
  
  // 🎬 WAVE 2010: Connect recording toggle to ChronosRecorder
  const handleRecord = useCallback(() => {
    const newState = !isRecording
    setIsRecording(newState)
    
    if (newState) {
      // Update playhead position before starting
      recorder.updatePlayhead(streaming.currentTimeMs)
      recorder.startRecording()
      console.log('[ChronosLayout] ⏺️ Recording STARTED at', streaming.currentTimeMs, 'ms')
    } else {
      // Stop recording and get all recorded clips
      const recordedClips = recorder.stopRecording()
      console.log('[ChronosLayout] ⏹️ Recording STOPPED. Clips:', recordedClips.length)
    }
  }, [isRecording, recorder, streaming.currentTimeMs])
  
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
  
  const handleBackToLibrary = useCallback(() => {
    clipState.deselectAll()
  }, [clipState])
  
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
       * ⚡ WAVE 2016.5: ENGINE STATUS - Command Center
       * Shows POWER/GO/AI states from global stores - control without leaving Chronos
       * ═══════════════════════════════════════════════════════════════════ */}
      <EngineStatus />
      
      {/* ═══════════════════════════════════════════════════════════════════
       * TRANSPORT BAR - The Cockpit
       * ═══════════════════════════════════════════════════════════════════ */}
      <TransportBar
        isPlaying={streaming.isPlaying}
        isRecording={isRecording}
        currentTime={streaming.currentTimeMs}
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
          <div className="drag-icon">🎵</div>
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
          className="chronos-workspace"
          onFocus={() => setIsTimelineFocused(true)}
          onBlur={() => setIsTimelineFocused(false)}
          tabIndex={0}
        >
          {/* Stage Preview (30% height) - WAVE 2015: Real fixtures, WAVE 2015.5: Toggle */}
          <StagePreview visible={stageVisible} />
          
          {/* Horizontal Divider */}
          <div className="chronos-divider horizontal" />
          
          {/* Timeline Canvas (70% height) - WAVE 2006: Interactive */}
          <TimelineCanvas
            currentTime={streaming.currentTimeMs}
            bpm={bpm}
            isPlaying={streaming.isPlaying}
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
            // WAVE 2006: Auto-scroll
            followEnabled={followEnabled}
            onFollowToggle={handleFollowToggle}
            // WAVE 2013.6: THE ADRENALINE SHOT - Live growing clip
            isRecording={isRecording}
            growingClipId={isRecording ? recorder.activeVibeClipId : null}
            growingClipEndMs={isRecording ? recorder.activeVibeClipEndMs : null}
          />
        </div>
        
        {/* Vertical Divider */}
        <div className="chronos-divider vertical" />
        
        {/* Right: Inspector Panel - WAVE 2009: Always visible, wider */}
        <div className="chronos-inspector-panel">
          <ClipInspector
            clip={selectedClip}
            onUpdateClip={handleUpdateClip}
            onDeleteClip={handleDeleteClip}
            onDuplicateClip={handleDuplicateClip}
            onBackToLibrary={handleBackToLibrary}
          />
        </div>
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
